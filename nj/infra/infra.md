To deploy, you will first need to load AWS credentials. You can get these from the local dev .env in bitwarden under BEDROCK_AWS_ACCESS_KEY_ID and BEDROCK_AWS_SECRET_ACCESS_KEY. Remove the BEDROCK_ prefix and export into your own terminal.

Steps:
1. navigate to `infra/`
2. `npm install`
3. `npx cdk deploy EcsStack`
4. `npx cdk deploy ApiGatewayStack`
