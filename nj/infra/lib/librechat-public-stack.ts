import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as ecs from "aws-cdk-lib/aws-ecs";
import * as efs from "aws-cdk-lib/aws-efs";
import * as iam from "aws-cdk-lib/aws-iam";
import * as acm from "aws-cdk-lib/aws-certificatemanager";
import * as elbv2 from "aws-cdk-lib/aws-elasticloadbalancingv2";

// CloudMap service names are prefixed with "lc-" to avoid collisions with the dev stack's
// mongodb.internal and vectordb.internal entries in the shared "internal" namespace.
const DOMAIN = "librechat.ai-assistant.nj.gov";
const ENV_FILE_KEY = "librechat.env";
const ENV_FILES_BUCKET_ARN = "arn:aws:s3:::nj-librechat-env-files";

export interface LibrechatPublicStackProps extends cdk.StackProps {
  cluster: ecs.Cluster;
  listener: elbv2.ApplicationListener;
  loadBalancer: elbv2.ApplicationLoadBalancer;
  certificateArn: string;
}

export class LibrechatPublicStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: LibrechatPublicStackProps) {
    super(scope, id, props);

    const vpc = ec2.Vpc.fromLookup(this, "ExistingVpc", {
      tags: { Name: "VPC-Innov-Platform-*" },
    });

    const fileBucket = this.createFileBucket();
    const execRole = this.createExecRole(fileBucket);
    const envBucket = s3.Bucket.fromBucketArn(this, "EnvFilesBucket", ENV_FILES_BUCKET_ARN);

    const mongoService = this.createMongoService(vpc, props.cluster, execRole);
    const vectorDbService = this.createVectorDbService(vpc, props.cluster, execRole);
    const meiliService = this.createMeiliSearchService(vpc, props.cluster, execRole, envBucket);
    const ragApiService = this.createRagApiService(props.cluster, execRole, envBucket);
    const librechatService = this.createLibrechatService(
      vpc, props.cluster, execRole,
      props.listener, props.certificateArn,
      envBucket, fileBucket,
    );

    mongoService.connections.allowFrom(librechatService, ec2.Port.tcp(27017), "LibreChat to MongoDB");
    vectorDbService.connections.allowFrom(ragApiService, ec2.Port.tcp(5432), "RAG API to VectorDB");
    meiliService.connections.allowFrom(librechatService, ec2.Port.tcp(7700), "LibreChat to MeiliSearch");
    meiliService.connections.allowFrom(ragApiService, ec2.Port.tcp(7700), "RAG API to MeiliSearch");
    ragApiService.connections.allowFrom(librechatService, ec2.Port.tcp(8000), "LibreChat to RAG API");
    librechatService.connections.allowFrom(props.loadBalancer, ec2.Port.tcp(3080), "ALB to LibreChat");
  }

  private createFileBucket(): s3.Bucket {
    return new s3.Bucket(this, "FileBucket", {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      versioned: true,
      lifecycleRules: [{ enabled: true, expiration: cdk.Duration.days(1) }],
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });
  }

  private createExecRole(fileBucket: s3.Bucket): iam.Role {
    const role = new iam.Role(this, "ExecRole", {
      assumedBy: new iam.ServicePrincipal("ecs-tasks.amazonaws.com"),
      description: "Execution and task role for LibreChat public stack",
    });
    role.addManagedPolicy(
      iam.ManagedPolicy.fromAwsManagedPolicyName("service-role/AmazonECSTaskExecutionRolePolicy"),
    );
    role.addManagedPolicy(
      iam.ManagedPolicy.fromAwsManagedPolicyName("AmazonS3ReadOnlyAccess"),
    );
    role.attachInlinePolicy(new iam.Policy(this, "FileBucketPolicy", {
      statements: [new iam.PolicyStatement({
        actions: ["s3:*"],
        resources: [fileBucket.bucketArn, `${fileBucket.bucketArn}/*`],
      })],
    }));
    return role;
  }

  private createMongoService(vpc: ec2.IVpc, cluster: ecs.Cluster, execRole: iam.Role): ecs.FargateService {
    const mongoFs = new efs.FileSystem(this, "MongoFs", {
      vpc,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      encrypted: true,
    });

    const taskDef = new ecs.FargateTaskDefinition(this, "MongoTaskDef", {
      cpu: 256,
      memoryLimitMiB: 512,
      executionRole: execRole,
    });
    taskDef.addVolume({
      name: "mongoData",
      efsVolumeConfiguration: { fileSystemId: mongoFs.fileSystemId, transitEncryption: "ENABLED" },
    });

    const container = taskDef.addContainer("mongodb", {
      image: ecs.ContainerImage.fromRegistry("mongo:8.0.17"),
      logging: ecs.LogDrivers.awsLogs({ streamPrefix: "lc-mongodb" }),
      command: ["mongod", "--noauth"],
      portMappings: [{ containerPort: 27017 }],
    });
    container.addMountPoints({ sourceVolume: "mongoData", containerPath: "/data/db", readOnly: false });

    const service = new ecs.FargateService(this, "MongoService", {
      cluster,
      taskDefinition: taskDef,
      desiredCount: 1,
      enableExecuteCommand: true,
      cloudMapOptions: { name: "lc-mongodb" },
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
    });

    mongoFs.connections.allowDefaultPortFrom(service);
    return service;
  }

  private createVectorDbService(vpc: ec2.IVpc, cluster: ecs.Cluster, execRole: iam.Role): ecs.FargateService {
    const pgFs = new efs.FileSystem(this, "VectorDbFs", {
      vpc,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      encrypted: true,
    });

    const taskDef = new ecs.FargateTaskDefinition(this, "VectorDbTaskDef", {
      cpu: 256,
      memoryLimitMiB: 512,
      executionRole: execRole,
    });
    taskDef.addVolume({
      name: "pgData",
      efsVolumeConfiguration: { fileSystemId: pgFs.fileSystemId, transitEncryption: "ENABLED" },
    });

    const container = taskDef.addContainer("vectordb", {
      image: ecs.ContainerImage.fromRegistry("pgvector/pgvector:0.8.0-pg15-trixie"),
      logging: ecs.LogDrivers.awsLogs({ streamPrefix: "lc-vectordb" }),
      environment: {
        POSTGRES_DB: "mydatabase",
        POSTGRES_USER: "myuser",
        POSTGRES_PASSWORD: "mypassword",
      },
      portMappings: [{ containerPort: 5432 }],
    });
    container.addMountPoints({ sourceVolume: "pgData", containerPath: "/var/lib/postgresql/data", readOnly: false });

    const service = new ecs.FargateService(this, "VectorDbService", {
      cluster,
      taskDefinition: taskDef,
      desiredCount: 1,
      enableExecuteCommand: true,
      cloudMapOptions: { name: "lc-vectordb" },
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
    });

    pgFs.connections.allowDefaultPortFrom(service);
    return service;
  }

  private createMeiliSearchService(
    vpc: ec2.IVpc,
    cluster: ecs.Cluster,
    execRole: iam.Role,
    envBucket: s3.IBucket,
  ): ecs.FargateService {
    const meiliFs = new efs.FileSystem(this, "MeiliFs", {
      vpc,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      encrypted: true,
    });

    const taskDef = new ecs.FargateTaskDefinition(this, "MeiliTaskDef", {
      cpu: 256,
      memoryLimitMiB: 512,
      executionRole: execRole,
    });
    taskDef.addVolume({
      name: "meiliData",
      efsVolumeConfiguration: { fileSystemId: meiliFs.fileSystemId, transitEncryption: "ENABLED" },
    });

    const container = taskDef.addContainer("meilisearch", {
      image: ecs.ContainerImage.fromRegistry("getmeili/meilisearch:v1.35.1"),
      logging: ecs.LogDrivers.awsLogs({ streamPrefix: "lc-meilisearch" }),
      environment: { MEILI_NO_ANALYTICS: "true" },
      environmentFiles: [ecs.EnvironmentFile.fromBucket(envBucket, ENV_FILE_KEY)],
      portMappings: [{ containerPort: 7700 }],
    });
    container.addMountPoints({ sourceVolume: "meiliData", containerPath: "/meili_data", readOnly: false });

    const service = new ecs.FargateService(this, "MeiliService", {
      cluster,
      taskDefinition: taskDef,
      desiredCount: 1,
      enableExecuteCommand: true,
      cloudMapOptions: { name: "lc-meilisearch" },
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
    });

    meiliFs.connections.allowDefaultPortFrom(service);
    return service;
  }

  private createRagApiService(
    cluster: ecs.Cluster,
    execRole: iam.Role,
    envBucket: s3.IBucket,
  ): ecs.FargateService {
    const taskDef = new ecs.FargateTaskDefinition(this, "RagApiTaskDef", {
      cpu: 512,
      memoryLimitMiB: 1024,
      executionRole: execRole,
    });

    taskDef.addContainer("rag_api", {
      image: ecs.ContainerImage.fromRegistry(
        "registry.librechat.ai/danny-avila/librechat-rag-api-dev-lite:latest",
      ),
      logging: ecs.LogDrivers.awsLogs({ streamPrefix: "lc-rag-api" }),
      environment: {
        DB_HOST: "lc-vectordb.internal",
        RAG_PORT: "8000",
        MEILI_HOST: "http://lc-meilisearch.internal:7700",
      },
      environmentFiles: [ecs.EnvironmentFile.fromBucket(envBucket, ENV_FILE_KEY)],
      portMappings: [{ containerPort: 8000 }],
    });

    return new ecs.FargateService(this, "RagApiService", {
      cluster,
      taskDefinition: taskDef,
      desiredCount: 1,
      enableExecuteCommand: true,
      cloudMapOptions: { name: "lc-rag-api" },
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
    });
  }

  private createLibrechatService(
    vpc: ec2.IVpc,
    cluster: ecs.Cluster,
    execRole: iam.Role,
    listener: elbv2.ApplicationListener,
    certificateArn: string,
    envBucket: s3.IBucket,
    fileBucket: s3.Bucket,
  ): ecs.FargateService {
    const taskDef = new ecs.FargateTaskDefinition(this, "LibrechatTaskDef", {
      cpu: 512,
      memoryLimitMiB: 1024,
      executionRole: execRole,
      taskRole: execRole,
    });

    taskDef.addContainer("librechat", {
      image: ecs.ContainerImage.fromRegistry(
        "registry.librechat.ai/danny-avila/librechat-dev:latest",
      ),
      logging: ecs.LogDrivers.awsLogs({ streamPrefix: "lc-librechat" }),
      environment: {
        NODE_ENV: "production",
        PORT: "3080",
        HOST: "0.0.0.0",
        MONGO_URI: "mongodb://lc-mongodb.internal:27017/LibreChat",
        MEILI_HOST: "http://lc-meilisearch.internal:7700",
        RAG_API_URL: "http://lc-rag-api.internal:8000",
        AWS_BUCKET_NAME: fileBucket.bucketName,
        AWS_REGION: this.region,
      },
      environmentFiles: [ecs.EnvironmentFile.fromBucket(envBucket, ENV_FILE_KEY)],
      portMappings: [{ containerPort: 3080 }],
      command: ["npm", "run", "backend"],
    });

    const targetGroup = new elbv2.ApplicationTargetGroup(this, "LibrechatTg", {
      vpc,
      port: 3080,
      protocol: elbv2.ApplicationProtocol.HTTP,
      targetType: elbv2.TargetType.IP,
      healthCheck: {
        path: "/",
        interval: cdk.Duration.seconds(30),
        healthyHttpCodes: "200-399",
      },
    });

    const cert = acm.Certificate.fromCertificateArn(this, "LibrechatCert", certificateArn);
    listener.addCertificates("LibrechatCert", [cert]);
    listener.addAction("LibrechatRule", {
      conditions: [elbv2.ListenerCondition.hostHeaders([DOMAIN])],
      priority: 10,
      action: elbv2.ListenerAction.forward([targetGroup]),
    });

    const service = new ecs.FargateService(this, "LibrechatService", {
      cluster,
      taskDefinition: taskDef,
      desiredCount: 1,
      minHealthyPercent: 50,
      enableExecuteCommand: true,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
    });

    service.attachToApplicationTargetGroup(targetGroup);

    const scalableTarget = service.autoScaleTaskCount({ minCapacity: 1, maxCapacity: 10 });
    scalableTarget.scaleOnCpuUtilization("CpuScaling", { targetUtilizationPercent: 50 });
    scalableTarget.scaleOnMemoryUtilization("MemoryScaling", { targetUtilizationPercent: 50 });

    new cdk.CfnOutput(this, "LibrechatPublicImageUri", {
      value: "registry.librechat.ai/danny-avila/librechat-dev:latest",
    });

    return service;
  }
}
