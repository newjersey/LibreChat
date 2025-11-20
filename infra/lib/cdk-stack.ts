import * as cdk from "aws-cdk-lib";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as ecs from "aws-cdk-lib/aws-ecs";
import * as ecr from "aws-cdk-lib/aws-ecr";
import * as ecsPatterns from "aws-cdk-lib/aws-ecs-patterns";
import * as elbv2 from "aws-cdk-lib/aws-elasticloadbalancingv2";
import { Construct } from "constructs";
import { EcsStack } from "./ecs-stack";
import { ApigStack } from "./apig-stack";

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
      vpcId: "vpc-06ea0349e255c4c59",
    });

    const ecsStack = new EcsStack(this, "EcsStack", {
      vpc,
    });

    // Moved API Gateway + certificate to ApigStack
    new ApigStack(this, "ApiGatewayStack", {
      vpc,
      listener: ecsStack.listener,
      domainName: "dev.ai-assistant.nj.gov",
    });

    // Tags for all resources
    cdk.Tags.of(this).add("Project", "AIAssistantService");
    cdk.Tags.of(this).add("Environment", props?.env ? "Production" : "Development");
    cdk.Tags.of(this).add("ManagedBy", "CDK");
  }
}
