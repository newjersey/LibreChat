import * as cdk from "aws-cdk-lib";
import * as acm from "aws-cdk-lib/aws-certificatemanager";
import * as apigatewayv2 from "aws-cdk-lib/aws-apigatewayv2";
import * as apigatewayv2Integrations from "aws-cdk-lib/aws-apigatewayv2-integrations";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as elbv2 from "aws-cdk-lib/aws-elasticloadbalancingv2";
import { Construct } from "constructs";

export interface ApigStackProps extends cdk.StackProps {
  vpcId?: string;          // replaced vpc: ec2.IVpc
  listener: elbv2.ApplicationListener;
  domainName: string;
}

export class ApigStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: ApigStackProps) {
    super(scope, id, props);
    const vpc = ec2.Vpc.fromLookup(this, "ExistingVpcForApi", {
      vpcId: props.vpcId ?? "vpc-06ea0349e255c4c59",
    });
    // use local vpc instead of props.vpc
    const vpcLink = new apigatewayv2.VpcLink(this, "ServiceVpcLink", {
      vpc,
      subnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      vpcLinkName: "service-vpc-link",
    });

    const certificate = new acm.Certificate(this, "ServiceCertificate", {
      domainName: props.domainName,
      validation: acm.CertificateValidation.fromDns(),
    });

    const domain = new apigatewayv2.DomainName(this, "ServiceDomain", {
      domainName: props.domainName,
      certificate,
    });

    const api = new apigatewayv2.HttpApi(this, "ServiceHttpApi", {
      apiName: "ServiceHttpApi",
      description: "HTTP API for internal ALB via VPC Link",
      disableExecuteApiEndpoint: true,
      corsPreflight: {
        allowOrigins: ["*"],
        allowMethods: [apigatewayv2.CorsHttpMethod.ANY],
        allowHeaders: ["*"],
      },
    });

    new apigatewayv2.ApiMapping(this, "ServiceApiMapping", {
      api,
      domainName: domain,
      stage: api.defaultStage,
    });

    const integration = new apigatewayv2Integrations.HttpAlbIntegration(
      "AlbIntegration",
      props.listener,
      {
        vpcLink,
        method: apigatewayv2.HttpMethod.ANY,
      },
    );

    api.addRoutes({
      path: "/",
      methods: [apigatewayv2.HttpMethod.ANY],
      integration,
    });

    api.addRoutes({
      path: "/{proxy+}",
      methods: [apigatewayv2.HttpMethod.ANY],
      integration,
      // NOTE: Removed reliance on /rag/* and /search/* path routing. Those prefixes are not served by backend containers.
      // External clients cannot directly reach rag_api or Meilisearch; only the main application is exposed.
      // Internal calls use CloudMap hostnames (rag_api.internal, etc.).
    });

    new cdk.CfnOutput(this, "ApiGatewayUrl", {
      value: `https://${domain.name}`,
      exportName: "ServiceApiGatewayUrl",
    });

    new cdk.CfnOutput(this, "CustomDomainName", {
      value: domain.name,
      exportName: "ServiceCustomDomainName",
    });

    new cdk.CfnOutput(this, "DomainNameTarget", {
      value: domain.regionalDomainName,
      exportName: "ServiceDomainNameTarget",
    });

    new cdk.CfnOutput(this, "DomainNameHostedZoneId", {
      value: domain.regionalHostedZoneId,
      exportName: "ServiceDomainNameHostedZoneId",
    });

    new cdk.CfnOutput(this, "CertificateArn", {
      value: certificate.certificateArn,
      exportName: "ServiceCertificateArn",
    });

    cdk.Tags.of(this).add("Component", "ApiGateway");
  }
}
