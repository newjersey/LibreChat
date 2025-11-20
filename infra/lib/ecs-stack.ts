import * as cdk from "aws-cdk-lib";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as ecs from "aws-cdk-lib/aws-ecs";
import * as ecr from "aws-cdk-lib/aws-ecr";
import * as ecsPatterns from "aws-cdk-lib/aws-ecs-patterns";
import * as elbv2 from "aws-cdk-lib/aws-elasticloadbalancingv2";
import * as efs from "aws-cdk-lib/aws-efs";
import { Construct } from "constructs";

// Use an existing VPC by ID
export interface EcsServicesProps extends cdk.StackProps { // extend StackProps
    vpc: ec2.IVpc;
    ragHostnames?: string[];
    apiHostnames?: string[];        // hostnames for main API
    meiliHostnames?: string[];      // hostnames for Meilisearch
}

export class EcsStack extends cdk.Stack {
  public readonly listener: elbv2.ApplicationListener;          // added
  public readonly loadBalancer: elbv2.ApplicationLoadBalancer;  // added
  public readonly service: ecs.FargateService;                  // added
  constructor(scope: Construct, id: string, props: EcsServicesProps) {
    super(scope, id, props);
    const cluster = new ecs.Cluster(this, "AIAssistantCluster", {
      vpc: props.vpc,
      clusterName: "ai-assistant-cluster",
    });
    cluster.addDefaultCloudMapNamespace({ name: "internal" });

    const repository = ecr.Repository.fromRepositoryName( // removed 'new'
      this,
      "AIAssistantEcrRepo",
      "librechat-ai-assistant",
    );

    const fargateService = new ecsPatterns.ApplicationLoadBalancedFargateService(
      this,
      "PingApiFargateService",
      {
        cluster,
        memoryLimitMiB: 512,
        cpu: 256,
        desiredCount: 1,
        taskImageOptions: {
          image: ecs.ContainerImage.fromAsset("../infra"),
          containerPort: 3080,
          environment: {
            NODE_ENV: "production",
            PORT: "3080",
            HOST: "0.0.0.0",
            LOG_LEVEL: "info",
            MONGO_URI: "mongodb://mongodb.internal:27017/LibreChat",
            MEILI_HOST: "http://meilisearch:7700",
            RAG_API_URL: "http://rag_api.internal:8000",
          },
        },
        publicLoadBalancer: false, // Internal ALB due to no public subnets
        listenerPort: 80, // HTTP port - API Gateway handles HTTPS termination
        taskSubnets: {
          subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
        },
      },
    );
    this.listener = fargateService.listener;       
    this.loadBalancer = fargateService.loadBalancer;
    this.service = fargateService.service;         

    // RAG API service (separate task definition)
    const dependencyTaskDef = new ecs.FargateTaskDefinition(this, "RagApiTaskDef", {
      cpu: 1024,
      memoryLimitMiB: 4096,
      ephemeralStorageGiB: 50,
    });

    const ragContainer = dependencyTaskDef.addContainer("rag_api", {
      image: ecs.ContainerImage.fromRegistry("ghcr.io/danny-avila/librechat-rag-api-dev-lite:latest"), // or a different repo
      logging: ecs.LogDrivers.awsLogs({ streamPrefix: "rag_api" }),
      environment: {
        NODE_ENV: "production",
        RAG_PORT: "8000",
        DB_HOST: "vectordb.internal", // updated from vectordb
      },
      portMappings: [{ containerPort: 8000 }],
    });

    const meiliContainer = dependencyTaskDef.addContainer("meilisearch", {
      image: ecs.ContainerImage.fromRegistry("getmeili/meilisearch:v1.12.3"),
      logging: ecs.LogDrivers.awsLogs({ streamPrefix: "meilisearch" }),
      environment: {
        MEILI_HOST: "http://meilisearch:7700",
        MEILI_NO_ANALYTICS: "true",
        // MEILI_MASTER_KEY can be injected via task env/secret if needed
      },
      portMappings: [{ containerPort: 7700 }],
      essential: false,
    });

    // Dedicated security group for rag service
    const ragSg = new ec2.SecurityGroup(this, "RagServiceSg", { vpc: props.vpc });
    const ragService = new ecs.FargateService(this, "RagApiService", {
      cluster,
      taskDefinition: dependencyTaskDef,
      desiredCount: 1,
      cloudMapOptions: { name: "rag_api" },
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      securityGroups: [ragSg],
    });

    // --- MongoDB dedicated service ---
    const mongoFs = new efs.FileSystem(this, "MongoFs", {
      vpc: props.vpc,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      encrypted: true,
    });

    const mongoTaskDef = new ecs.FargateTaskDefinition(this, "MongoTaskDef", {
      cpu: 256,
      memoryLimitMiB: 1024,
    });

    mongoTaskDef.addVolume({
      name: "mongoData",
      efsVolumeConfiguration: {
        fileSystemId: mongoFs.fileSystemId,
        transitEncryption: "ENABLED",
      },
    });

    const mongoContainer = mongoTaskDef.addContainer("mongodb", {
      image: ecs.ContainerImage.fromRegistry("mongo:latest"),
      logging: ecs.LogDrivers.awsLogs({ streamPrefix: "mongodb" }),
      command: ["mongod", "--noauth"],
      portMappings: [{ containerPort: 27017 }],
      // removed mountPoints from options
    });
    mongoContainer.addMountPoints({
      sourceVolume: "mongoData",
      containerPath: "/data/db",
      readOnly: false,
    });

    const mongoSg = new ec2.SecurityGroup(this, "MongoSg", { vpc: props.vpc });
    const mongoService = new ecs.FargateService(this, "MongoService", {
      cluster,
      taskDefinition: mongoTaskDef,
      desiredCount: 1,
      cloudMapOptions: { name: "mongodb" },
      securityGroups: [mongoSg],
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
    });

    // --- Postgres (vectordb) dedicated service ---
    const pgFs = new efs.FileSystem(this, "PgFs", {
      vpc: props.vpc,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      encrypted: true,
    });

    const pgTaskDef = new ecs.FargateTaskDefinition(this, "VectorDbTaskDef", {
      cpu: 256,
      memoryLimitMiB: 1024,
    });

    pgTaskDef.addVolume({
      name: "pgData",
      efsVolumeConfiguration: {
        fileSystemId: pgFs.fileSystemId,
        transitEncryption: "ENABLED",
      },
    });

    const pgContainer = pgTaskDef.addContainer("vectordb", {
      image: ecs.ContainerImage.fromRegistry("pgvector/pgvector:0.8.0-pg15-trixie"),
      logging: ecs.LogDrivers.awsLogs({ streamPrefix: "vectordb" }),
      environment: {
        POSTGRES_DB: "mydatabase",
        POSTGRES_USER: "myuser",
        POSTGRES_PASSWORD: "mypassword",
      },
      portMappings: [{ containerPort: 5432 }],
      // removed mountPoints from options
    });
    pgContainer.addMountPoints({
      sourceVolume: "pgData",
      containerPath: "/var/lib/postgresql/data",
      readOnly: false,
    });

    const pgSg = new ec2.SecurityGroup(this, "PgSg", { vpc: props.vpc });
    const vectordbService = new ecs.FargateService(this, "VectorDbService", {
      cluster,
      taskDefinition: pgTaskDef,
      desiredCount: 1,
      cloudMapOptions: { name: "vectordb" },
      securityGroups: [pgSg],
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
    });

    // Security: allow only app & rag_api to DB ports
    mongoService.connections.allowFrom(fargateService.service, ec2.Port.tcp(27017), "App -> MongoDB");
    mongoService.connections.allowFrom(ragService, ec2.Port.tcp(27017), "RAG -> MongoDB (if needed)");

    vectordbService.connections.allowFrom(ragService, ec2.Port.tcp(5432), "RAG -> Postgres");
    vectordbService.connections.allowFrom(fargateService.service, ec2.Port.tcp(5432), "App -> Postgres");

    // Target group for rag_api
    const ragTg = new elbv2.ApplicationTargetGroup(this, "RagApiTargetGroup", {
      vpc: props.vpc,
      port: 8000,
      protocol: elbv2.ApplicationProtocol.HTTP,
      targetType: elbv2.TargetType.IP,
      healthCheck: {
        path: "/health",
        healthyHttpCodes: "200",
        interval: cdk.Duration.seconds(30),
        timeout: cdk.Duration.seconds(5),
      },
    });

    // Attach service targets
    ragTg.addTarget(ragService);

    // Restrict ALB -> rag_api + meilisearch ports explicitly
    const albSg = fargateService.loadBalancer.connections.securityGroups[0];
    ragSg.addIngressRule(albSg, ec2.Port.tcp(8000), "ALB -> rag_api");
    ragSg.addIngressRule(albSg, ec2.Port.tcp(7700), "ALB -> meilisearch");

    // Host rule for main API (aiAssistant container)
    fargateService.listener.addAction("ApiHostRule", {
      priority: 5,
      conditions: [
        elbv2.ListenerCondition.hostHeaders(props.apiHostnames ?? ["api.internal"]),
      ],
      action: elbv2.ListenerAction.forward([fargateService.targetGroup]),
    });

    // Existing rag_api host rule (keep priority distinct)
    fargateService.listener.addAction("RagApiHostRule", {
      priority: 10,
      conditions: [
        elbv2.ListenerCondition.hostHeaders(props.ragHostnames ?? ["rag-api.internal"]),
      ],
      action: elbv2.ListenerAction.forward([ragTg]),
    });

    // Meilisearch target group (HTTP)
    const meiliTg = new elbv2.ApplicationTargetGroup(this, "MeiliTargetGroup", {
      vpc: props.vpc,
      port: 7700,
      protocol: elbv2.ApplicationProtocol.HTTP,
      targetType: elbv2.TargetType.IP,
      healthCheck: {
        path: "/health",
        healthyHttpCodes: "200",
        interval: cdk.Duration.seconds(30),
        timeout: cdk.Duration.seconds(5),
      },
    });
    meiliTg.addTarget(ragService);

    // Meilisearch host rule
    fargateService.listener.addAction("MeiliHostRule", {
      priority: 15,
      conditions: [
        elbv2.ListenerCondition.hostHeaders(props.meiliHostnames ?? ["search.internal"]),
      ],
      action: elbv2.ListenerAction.forward([meiliTg]),
    });

    // Path-based rule for rag_api (supports API Gateway /rag/* routes)
    fargateService.listener.addAction("RagApiPathRule", {
      priority: 20,
      conditions: [elbv2.ListenerCondition.pathPatterns(["/rag/*"])],
      action: elbv2.ListenerAction.forward([ragTg]),
    });

    // Path-based rule for meilisearch (supports API Gateway /search/* routes)
    fargateService.listener.addAction("MeiliPathRule", {
      priority: 25,
      conditions: [elbv2.ListenerCondition.pathPatterns(["/search/*"])],
      action: elbv2.ListenerAction.forward([meiliTg]),
    });

    // Notes:
    // - Consider migrating credentials to Secrets Manager (ecs.Secret.fromSecretCompleteArn).
    // - Use EFS Access Points for stronger isolation and enforce POSIX ownership.
    // - Replace inline DB images with managed services (DocumentDB/RDS) later.
    // - Add healthCheckGracePeriod to services with slower startup if needed.
    }
}