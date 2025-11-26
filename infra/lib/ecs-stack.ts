import * as cdk from "aws-cdk-lib";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as ecs from "aws-cdk-lib/aws-ecs";
import * as ecsPatterns from "aws-cdk-lib/aws-ecs-patterns";
import * as elbv2 from "aws-cdk-lib/aws-elasticloadbalancingv2";
import * as efs from "aws-cdk-lib/aws-efs";
import * as iam from "aws-cdk-lib/aws-iam";
import { Construct } from "constructs";

export interface EcsServicesProps extends cdk.StackProps {
  vpcId?: string;
  librechatImage?: string;
  ragApiImage?: string;
  meiliImage?: string;
  mongoImage?: string;
  postgresImage?: string;
}

export class EcsStack extends cdk.Stack {
  public readonly listener: elbv2.ApplicationListener;
  public readonly loadBalancer: elbv2.ApplicationLoadBalancer;
  public readonly service: ecs.FargateService;

  constructor(scope: Construct, id: string, props: EcsServicesProps) {
    super(scope, id, props);
    const vpc = ec2.Vpc.fromLookup(this, "ExistingVpc", {
      vpcId: props.vpcId ?? "vpc-06ea0349e255c4c59",
    });

    const librechatImage =
      props.librechatImage ??
      "152320432929.dkr.ecr.us-east-1.amazonaws.com/newjersey/librechat:latest";
    const ragApiImage =
      props.ragApiImage ??
      "152320432929.dkr.ecr.us-east-1.amazonaws.com/newjersey/rag-api:latest";
    const meiliImage =
      props.meiliImage ??
      "152320432929.dkr.ecr.us-east-1.amazonaws.com/newjersey/meilisearch:v1.12.3";
    const mongoImage =
      props.mongoImage ??
      "152320432929.dkr.ecr.us-east-1.amazonaws.com/newjersey/mongo:latest";
    const postgresImage =
      props.postgresImage ??
      "152320432929.dkr.ecr.us-east-1.amazonaws.com/newjersey/pgvector:0.8.0-pg15-trixie";

    // Interface endpoints for private subnet ECR access (no NAT required)
    const endpointsSg = new ec2.SecurityGroup(this, "VpcEndpointsSg", { vpc });
    vpc.addInterfaceEndpoint("EcrDockerEndpoint", {
      service: ec2.InterfaceVpcEndpointAwsService.ECR_DOCKER,
      securityGroups: [endpointsSg],
    });
    vpc.addInterfaceEndpoint("EcrApiEndpoint", {
      service: ec2.InterfaceVpcEndpointAwsService.ECR,
      securityGroups: [endpointsSg],
    });
    vpc.addInterfaceEndpoint("CloudWatchLogsEndpoint", {
      service: ec2.InterfaceVpcEndpointAwsService.CLOUDWATCH_LOGS,
      securityGroups: [endpointsSg],
    });
    // ADD: S3 gateway endpoint required for ECR layer downloads when no NAT
    vpc.addGatewayEndpoint("S3GatewayEndpoint", {
      service: ec2.GatewayVpcEndpointAwsService.S3,
      // (Optional) specify subnets; leaving default to all route tables
    });

    const cluster = new ecs.Cluster(this, "AIAssistantCluster", {
      vpc,
      clusterName: "ai-assistant-cluster",
    });
    cluster.addDefaultCloudMapNamespace({ name: "internal" });

    // Shared execution role for all task definitions
    const commonExecRole = new iam.Role(this, "CommonTaskExecutionRole", {
      assumedBy: new iam.ServicePrincipal("ecs-tasks.amazonaws.com"),
      description: "Execution role for pulling ECR images and writing logs",
    });
    commonExecRole.addManagedPolicy(
      iam.ManagedPolicy.fromAwsManagedPolicyName("service-role/AmazonECSTaskExecutionRolePolicy")
    );

    // Create LibreChat task definition using the shared execution role
    const librechatTaskDef = new ecs.FargateTaskDefinition(this, "LibreChatTaskDef", {
      cpu: 256,
      memoryLimitMiB: 512,
      executionRole: commonExecRole,
    });

    librechatTaskDef.addContainer("librechat", {
      image: ecs.ContainerImage.fromRegistry(librechatImage),
      logging: ecs.LogDrivers.awsLogs({ streamPrefix: "librechat" }),
      environment: {
        NODE_ENV: "production",
        PORT: "3080",
        HOST: "0.0.0.0",
        LOG_LEVEL: "info",
        MONGO_URI: "mongodb://mongodb.internal:27017/LibreChat",
        MEILI_HOST: "http://rag_api.internal:7700",
        RAG_API_URL: "http://rag_api.internal:8000",
      },
      portMappings: [{ containerPort: 3080 }],
      command: ["npm","run","backend"], 
    });

    const librechatService = new ecsPatterns.ApplicationLoadBalancedFargateService(
      this,
      "LibreChatFargateService",
      {
        cluster,
        desiredCount: 1,
        taskDefinition: librechatTaskDef, // use custom task definition with shared exec role
        publicLoadBalancer: false,
        listenerPort: 80,
        taskSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      }
    );
    this.listener = librechatService.listener;
    this.loadBalancer = librechatService.loadBalancer;
    this.service = librechatService.service;

    const dependencyTaskDef = new ecs.FargateTaskDefinition(this, "RagApiTaskDef", {
      cpu: 1024,
      memoryLimitMiB: 4096,
      ephemeralStorageGiB: 50,
      executionRole: commonExecRole,
    });

    dependencyTaskDef.addContainer("rag_api", {
      image: ecs.ContainerImage.fromRegistry(ragApiImage),
      logging: ecs.LogDrivers.awsLogs({ streamPrefix: "rag_api" }),
      environment: {
        NODE_ENV: "production",
        RAG_PORT: "8000",
        DB_HOST: "vectordb.internal",
      },
      portMappings: [{ containerPort: 8000 }],
    });

    dependencyTaskDef.addContainer("meilisearch", {
      image: ecs.ContainerImage.fromRegistry(meiliImage),
      logging: ecs.LogDrivers.awsLogs({ streamPrefix: "meilisearch" }),
      environment: {
        MEILI_HOST: "http://meilisearch:7700",
        MEILI_NO_ANALYTICS: "true",
      },
      portMappings: [{ containerPort: 7700 }],
      essential: true,
    });

    const ragSg = new ec2.SecurityGroup(this, "RagServiceSg", { vpc });
    const ragService = new ecs.FargateService(this, "RagApiService", {
      cluster,
      taskDefinition: dependencyTaskDef,
      desiredCount: 1,
      cloudMapOptions: { name: "rag_api" },
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      securityGroups: [ragSg],
    });

    const mongoFs = new efs.FileSystem(this, "MongoFs", {
      vpc,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      encrypted: true,
    });

    const mongoTaskDef = new ecs.FargateTaskDefinition(this, "MongoTaskDef", {
      cpu: 256,
      memoryLimitMiB: 1024,
      executionRole: commonExecRole,
    });

    mongoTaskDef.addVolume({
      name: "mongoData",
      efsVolumeConfiguration: {
        fileSystemId: mongoFs.fileSystemId,
        transitEncryption: "ENABLED",
      },
    });

    const mongoContainer = mongoTaskDef.addContainer("mongodb", {
      image: ecs.ContainerImage.fromRegistry(mongoImage),
      logging: ecs.LogDrivers.awsLogs({ streamPrefix: "mongodb" }),
      command: ["mongod", "--noauth"],
      portMappings: [{ containerPort: 27017 }],
    });
    mongoContainer.addMountPoints({
      sourceVolume: "mongoData",
      containerPath: "/data/db",
      readOnly: false,
    });

    const mongoSg = new ec2.SecurityGroup(this, "MongoSg", { vpc });
    const mongoService = new ecs.FargateService(this, "MongoService", {
      cluster,
      taskDefinition: mongoTaskDef,
      desiredCount: 1,
      cloudMapOptions: { name: "mongodb" },
      securityGroups: [mongoSg],
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
    });

    const pgFs = new efs.FileSystem(this, "PgFs", {
      vpc,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      encrypted: true,
    });

    const pgTaskDef = new ecs.FargateTaskDefinition(this, "VectorDbTaskDef", {
      cpu: 256,
      memoryLimitMiB: 1024,
      executionRole: commonExecRole,
    });

    pgTaskDef.addVolume({
      name: "pgData",
      efsVolumeConfiguration: {
        fileSystemId: pgFs.fileSystemId,
        transitEncryption: "ENABLED",
      },
    });

    const pgContainer = pgTaskDef.addContainer("vectordb", {
      image: ecs.ContainerImage.fromRegistry(postgresImage),
      logging: ecs.LogDrivers.awsLogs({ streamPrefix: "vectordb" }),
      environment: {
        POSTGRES_DB: "mydatabase",
        POSTGRES_USER: "myuser",
        POSTGRES_PASSWORD: "mypassword",
      },
      portMappings: [{ containerPort: 5432 }],
    });
    pgContainer.addMountPoints({
      sourceVolume: "pgData",
      containerPath: "/var/lib/postgresql/data",
      readOnly: false,
    });

    const pgSg = new ec2.SecurityGroup(this, "PgSg", { vpc });
    const vectordbService = new ecs.FargateService(this, "VectorDbService", {
      cluster,
      taskDefinition: pgTaskDef,
      desiredCount: 1,
      cloudMapOptions: { name: "vectordb" },
      securityGroups: [pgSg],
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
    });

    mongoService.connections.allowFrom(librechatService.service, ec2.Port.tcp(27017), "App to MongoDB");
    mongoService.connections.allowFrom(ragService, ec2.Port.tcp(27017), "RAG to MongoDB");
    vectordbService.connections.allowFrom(ragService, ec2.Port.tcp(5432), "RAG to Postgres");
    vectordbService.connections.allowFrom(librechatService.service, ec2.Port.tcp(5432), "App to Postgres");
    ragService.connections.allowFrom(librechatService.service, ec2.Port.tcp(8000), "App to rag_api");
    ragService.connections.allowFrom(librechatService.service, ec2.Port.tcp(7700), "App to meilisearch");

    // FIX: allow NFS (2049) from ECS services to EFS
    mongoFs.connections.allowDefaultPortFrom(mongoService);
    pgFs.connections.allowDefaultPortFrom(vectordbService);

    new cdk.CfnOutput(this, "LibrechatImageUri", { value: librechatImage });
    new cdk.CfnOutput(this, "RagApiImageUri", { value: ragApiImage });
    new cdk.CfnOutput(this, "MeiliImageUri", { value: meiliImage });
    new cdk.CfnOutput(this, "MongoImageUri", { value: mongoImage });
    new cdk.CfnOutput(this, "PostgresImageUri", { value: postgresImage });
  }
}