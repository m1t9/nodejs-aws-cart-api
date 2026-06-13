import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as path from 'path';
import { Construct } from 'constructs';
import { execSync } from 'child_process';
import { cpSync } from 'fs';

export class CartApiStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const appRoot = path.join(__dirname, '../..');

    const dbHost = this.requiredEnv('DB_HOST');
    const dbPort = this.requiredEnv('DB_PORT');
    const dbName = this.requiredEnv('DB_NAME');
    const dbUser = this.requiredEnv('DB_USER');
    const dbPassword = this.requiredEnv('DB_PASSWORD');
    const dbSsl = process.env.DB_SSL ?? 'true';
    const dbSslRejectUnauthorized =
      process.env.DB_SSL_REJECT_UNAUTHORIZED ?? 'false';

    const cartApiLambda = new lambda.Function(this, 'CartApiLambda', {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'lambda.handler',
      memorySize: 512,
      timeout: cdk.Duration.seconds(30),
      environment: {
        NODE_ENV: 'production',
        DB_HOST: dbHost,
        DB_PORT: dbPort,
        DB_NAME: dbName,
        DB_USER: dbUser,
        DB_PASSWORD: dbPassword,
        DB_SSL: dbSsl,
        DB_SSL_REJECT_UNAUTHORIZED: dbSslRejectUnauthorized,
      },
      code: (() => {
        execSync('npm run build', { cwd: appRoot, stdio: 'inherit' });
        const outputDir = path.join(appRoot, 'dist');
        cpSync(path.join(appRoot, 'package.json'), path.join(outputDir, 'package.json'));
        cpSync(path.join(appRoot, 'package-lock.json'), path.join(outputDir, 'package-lock.json'));
        execSync('npm ci --omit=dev', { cwd: outputDir, stdio: 'inherit' });
        return lambda.Code.fromAsset(outputDir);
      })(),
    });

    const cartApi = new apigateway.RestApi(this, 'CartApi', {
      restApiName: 'Cart Service',
      deployOptions: {
        stageName: 'prod',
      },
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
        allowHeaders: ['*'],
      },
    });

    cartApi.root.addProxy({
      defaultIntegration: new apigateway.LambdaIntegration(cartApiLambda),
      anyMethod: true,
    });

    new cdk.CfnOutput(this, 'CartApiUrl', {
      value: cartApi.url,
    });
  }

  private requiredEnv(name: string): string {
    const value = process.env[name];

    if (!value) {
      throw new Error(`${name} is required in cdk/.env`);
    }

    return value;
  }
}
