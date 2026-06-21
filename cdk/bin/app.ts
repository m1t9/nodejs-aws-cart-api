import * as cdk from 'aws-cdk-lib';
import { CartApiStack } from '../lib/cart-api-stack';
import 'dotenv/config';

const app = new cdk.App();
new CartApiStack(app, 'CartApiStack');
