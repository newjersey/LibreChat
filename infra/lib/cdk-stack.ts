import * as cdk from "aws-cdk-lib";
import * as acm from "aws-cdk-lib/aws-certificatemanager";
import * as apigatewayv2 from "aws-cdk-lib/aws-apigatewayv2";
import * as apigatewayv2Integrations from "aws-cdk-lib/aws-apigatewayv2-integrations";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as ecs from "aws-cdk-lib/aws-ecs";
import * as ecsPatterns from "aws-cdk-lib/aws-ecs-patterns";
import { Protocol } from "aws-cdk-lib/aws-elasticloadbalancingv2";
import { Construct } from "constructs";

/**
 * AWS CDK Stack for deploying the NJ AI Assistant Service to ECS with Fargate
 *
 * This stack creates a production-ready infrastructure for the NJ AI Assistant service following AWS best
 * practices for security, scalability, and reliability. The architecture includes:
 *
 * - ECS cluster with Fargate for serverless container execution
 * - Application Load Balancer for public access and health checks
 * - Single task configuration (no auto-scaling) as requested
 * - Security Groups implementing least-privilege access
 * - CloudWatch monitoring and logging
 *
 * @example
 *   ```typescript
 *   const app = new cdk.App();
 *   new AIAssistantStack(app, 'AIAssistantStack', {
 *     env: { account: '123456789012', region: 'us-east-1' }
 *   });
 *   ```;
 */
export class CdkStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Use an existing VPC by ID
    const vpc = ec2.Vpc.fromLookup(this, "ExistingVpc", {
      vpcId: "vpc-01073d945c76ec056",
    });

    // Create ECS cluster
    const cluster = new ecs.Cluster(this, "AIAssistantCluster", {
      vpc,
      clusterName: "ping-api-cluster",
    });

    // Create Fargate service with internal HTTP ALB
    const fargateService = new ecsPatterns.ApplicationLoadBalancedFargateService(
      this,
      "AIAssistantFargateService",
      {
        cluster,
        memoryLimitMiB: 512,
        cpu: 256,
        desiredCount: 1, // Single instance as requested
        taskImageOptions: {
          image: ecs.ContainerImage.fromAsset(".", {
            file: "Dockerfile",
            platform: cdk.aws_ecr_assets.Platform.LINUX_AMD64,
          }),
          containerPort: 3000,
          environment: {
            NODE_ENV: "production",
            PORT: "3000",
            HOST: "0.0.0.0",
            LOG_LEVEL: "info",
          },
        },
        publicLoadBalancer: false, // Internal ALB due to no public subnets
        listenerPort: 80, // HTTP port - API Gateway handles HTTPS termination
        taskSubnets: {
          subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
        },
      },
    );

    // Set minHealthyPercent to avoid deployment issues (override ECS service properties)
    const cfnService = fargateService.service.node.defaultChild as ecs.CfnService;
    cfnService.addPropertyOverride("DeploymentConfiguration", { MinimumHealthyPercent: 100 });

    // Configure health check to use dedicated health endpoint
    fargateService.targetGroup.configureHealthCheck({
      path: "/health",
      port: "3000",
      protocol: Protocol.HTTP,
      healthyHttpCodes: "200",
      interval: cdk.Duration.seconds(30),
      healthyThresholdCount: 2,
      unhealthyThresholdCount: 5,
      timeout: cdk.Duration.seconds(5),
    });

    // Create VPC Link v2 for HTTP API Gateway
    const vpcLink = new apigatewayv2.VpcLink(this, "AIAssistantVpcLink", {
      vpc,
      subnets: {
        subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
      },
      vpcLinkName: "ping-api-vpc-link",
    });

    // Create a new ACM certificate
    const certificate = new acm.Certificate(this, "AIAssistantCertificate", {
      domainName: "ping.business.nj.gov",
      validation: acm.CertificateValidation.fromDns(),
    });

    // Create custom domain for API Gateway
    const domainName = new apigatewayv2.DomainName(this, "AIAssistantDomainName", {
      domainName: "ping.business.nj.gov",
      certificate,
    });

    // Create HTTP API Gateway (v2) with ALB integration
    const api = new apigatewayv2.HttpApi(this, "AIAssistantGateway", {
      apiName: "NJ AI Assistant Gateway",
      description: "HTTP API Gateway for NJ AI Assistant Service",
      disableExecuteApiEndpoint: true, // Disable default endpoint to force custom domain usage
      corsPreflight: {
        allowOrigins: ["*"],
        allowMethods: [apigatewayv2.CorsHttpMethod.ANY],
        allowHeaders: ["*"],
      },
    });

    // Map the custom domain to the API Gateway
    new apigatewayv2.ApiMapping(this, "AIAssistantMapping", {
      api,
      domainName,
      stage: api.defaultStage,
    });

    // Create ALB integration for HTTP API Gateway with explicit configuration
    const integration = new apigatewayv2Integrations.HttpAlbIntegration(
      "AIAssistantIntegration",
      fargateService.listener,
      {
        vpcLink,
        method: apigatewayv2.HttpMethod.ANY,
      },
    );

    // Add specific timestamp route
    api.addRoutes({
      path: "/timestamp",
      methods: [apigatewayv2.HttpMethod.GET],
      integration,
    });

    // Add proxy route for other paths
    api.addRoutes({
      path: "/{proxy+}",
      methods: [apigatewayv2.HttpMethod.ANY],
      integration,
    });

    // Add root path route
    api.addRoutes({
      path: "/",
      methods: [apigatewayv2.HttpMethod.ANY],
      integration,
    });

    // CloudFormation Outputs
    new cdk.CfnOutput(this, "LoadBalancerUrl", {
      value: `http://${fargateService.loadBalancer.loadBalancerDnsName}`,
      description:
        "HTTP URL of the Internal Application Load Balancer (accessible from within VPC)",
      exportName: "AIAssistantLoadBalancerUrl",
    });

    new cdk.CfnOutput(this, "HealthCheckUrl", {
      value: `http://${fargateService.loadBalancer.loadBalancerDnsName}/health`,
      description: "HTTP URL for the health check endpoint (accessible from within VPC)",
      exportName: "AIAssistantHealthCheckUrl",
    });

    new cdk.CfnOutput(this, "LoadBalancerDnsName", {
      value: fargateService.loadBalancer.loadBalancerDnsName,
      description: "Load Balancer DNS name for DNS configuration",
      exportName: "AIAssistantLoadBalancerDnsName",
    });

    new cdk.CfnOutput(this, "ApiGatewayUrl", {
      value: `https://${domainName.name}`,
      description: "Public API Gateway URL for the NJ AI Assistant service",
      exportName: "AIAssistantGatewayUrl",
    });

    new cdk.CfnOutput(this, "ApiGatewayTimestampUrl", {
      value: `https://${domainName.name}/timestamp`,
      description: "Direct URL to the timestamp endpoint via API Gateway",
      exportName: "AIAssistantGatewayTimestampUrl",
    });

    new cdk.CfnOutput(this, "CustomDomainName", {
      value: domainName.name,
      description: "Custom domain name for the API Gateway",
      exportName: "AIAssistantCustomDomainName",
    });

    new cdk.CfnOutput(this, "DomainNameTarget", {
      value: domainName.regionalDomainName,
      description: "Target domain name for DNS CNAME record",
      exportName: "AIAssistantDomainNameTarget",
    });

    new cdk.CfnOutput(this, "DomainNameHostedZoneId", {
      value: domainName.regionalHostedZoneId,
      description: "Hosted Zone ID for the custom domain (for Route 53 alias records)",
      exportName: "AIAssistantDomainNameHostedZoneId",
    });

    new cdk.CfnOutput(this, "CertificateArn", {
      value: certificate.certificateArn,
      description: "ACM Certificate ARN being used for the custom domain",
      exportName: "AIAssistantCertificateArn",
    });

    new cdk.CfnOutput(this, "InternalAccessNote", {
      value:
        "Service accessible via API Gateway (public HTTPS) or internal HTTP load balancer (VPC only). API Gateway provides HTTPS termination and public access.",
      description: "Service accessibility options",
    });

    new cdk.CfnOutput(this, "DnsSetupInstructions", {
      value: `Create a CNAME record: ping.business.nj.gov -> ${domainName.regionalDomainName}`,
      description: "DNS CNAME record needed to make the custom domain work",
    });

    // Tags for all resources
    cdk.Tags.of(this).add("Project", "AIAssistantService");
    cdk.Tags.of(this).add("Environment", props?.env ? "Production" : "Development");
    cdk.Tags.of(this).add("ManagedBy", "CDK");
  }
}
