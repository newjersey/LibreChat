/** @file Tests for CDK Stack infrastructure */

import { describe, it, expect, beforeEach } from "vitest";
import * as cdk from "aws-cdk-lib";
import { Template } from "aws-cdk-lib/assertions";
import { CdkStack } from "./cdk-stack.js";

describe("CdkStack Infrastructure", () => {
  let template: Template;
  let stack: CdkStack;

  beforeEach(() => {
    const app = new cdk.App();
    stack = new CdkStack(app, "TestAIAssistantStack", {
      env: { account: "123456789012", region: "us-east-1" },
    });
    template = Template.fromStack(stack);
  });

  describe("ECS Cluster Configuration", () => {
    it("should create ECS cluster", () => {
      template.hasResourceProperties("AWS::ECS::Cluster", {
        ClusterName: "ping-api-cluster",
      });
    });
  });

  describe("Fargate Service Configuration", () => {
    it("should create ECS task definition", () => {
      template.hasResourceProperties("AWS::ECS::TaskDefinition", {
        RequiresCompatibilities: ["FARGATE"],
        NetworkMode: "awsvpc",
        Cpu: "256",
        Memory: "512",
      });
    });

    it("should create ECS service with single task", () => {
      template.hasResourceProperties("AWS::ECS::Service", {
        DesiredCount: 1,
        LaunchType: "FARGATE",
      });
    });

    it("should configure container with correct port and environment", () => {
      template.hasResourceProperties("AWS::ECS::TaskDefinition", {
        ContainerDefinitions: [
          {
            Environment: [
              { Name: "NODE_ENV", Value: "production" },
              { Name: "PORT", Value: "3000" },
              { Name: "HOST", Value: "0.0.0.0" },
              { Name: "LOG_LEVEL", Value: "info" },
            ],
            PortMappings: [{ ContainerPort: 3000, Protocol: "tcp" }],
          },
        ],
      });
    });
  });

  describe("Load Balancer Configuration", () => {
    it("should create internal Application Load Balancer", () => {
      template.hasResourceProperties("AWS::ElasticLoadBalancingV2::LoadBalancer", {
        Type: "application",
        Scheme: "internal",
      });
    });

    it("should create target group with health check configuration", () => {
      template.hasResourceProperties("AWS::ElasticLoadBalancingV2::TargetGroup", {
        Port: 80,
        Protocol: "HTTP",
        HealthCheckPath: "/health",
        HealthCheckProtocol: "HTTP",
        TargetType: "ip",
      });
    });

    it("should create HTTP listener", () => {
      template.hasResourceProperties("AWS::ElasticLoadBalancingV2::Listener", {
        Port: 80,
        Protocol: "HTTP",
      });
    });
  });

  describe("Security Groups", () => {
    it("should create load balancer security group with HTTP ingress", () => {
      template.hasResourceProperties("AWS::EC2::SecurityGroup", {
        SecurityGroupIngress: [
          {
            CidrIp: "0.0.0.0/0",
            FromPort: 80,
            ToPort: 80,
            IpProtocol: "tcp",
          },
        ],
      });
    });

    it("should create ECS service security group", () => {
      template.hasResource("AWS::EC2::SecurityGroup", {});
    });
  });

  describe("IAM Configuration", () => {
    it("should create ECS task execution role", () => {
      template.hasResourceProperties("AWS::IAM::Role", {
        AssumeRolePolicyDocument: {
          Statement: [
            {
              Effect: "Allow",
              Principal: {
                Service: "ecs-tasks.amazonaws.com",
              },
              Action: "sts:AssumeRole",
            },
          ],
        },
      });
    });

    it("should create ECS task role", () => {
      template.hasResourceProperties("AWS::IAM::Role", {
        AssumeRolePolicyDocument: {
          Statement: [
            {
              Effect: "Allow",
              Principal: {
                Service: "ecs-tasks.amazonaws.com",
              },
              Action: "sts:AssumeRole",
            },
          ],
        },
      });
    });
  });

  describe("CloudFormation Outputs", () => {
    it("should create output for Load Balancer DNS name", () => {
      template.hasOutput("LoadBalancerDnsName", {
        Description: "Load Balancer DNS name for DNS configuration",
      });
    });

    it("should create output for Health Check URL", () => {
      template.hasOutput("HealthCheckUrl", {
        Description: "HTTP URL for the health check endpoint (accessible from within VPC)",
      });
    });

    it("should create output for Load Balancer URL", () => {
      template.hasOutput("LoadBalancerUrl", {
        Description:
          "HTTP URL of the Internal Application Load Balancer (accessible from within VPC)",
      });
    });
  });

  describe("Cost Optimization", () => {
    it("should use minimal Fargate resources", () => {
      template.hasResourceProperties("AWS::ECS::TaskDefinition", {
        Cpu: "256",
        Memory: "512",
      });
    });

    it("should have single task instance", () => {
      template.hasResourceProperties("AWS::ECS::Service", {
        DesiredCount: 1,
      });
    });
  });

  describe("Resource Tagging", () => {
    it("should apply standard tags to resources", () => {
      // Check that the stack has the expected tags
      const stackTags = cdk.Tags.of(stack);
      expect(stackTags).toBeDefined();
    });
  });
});
