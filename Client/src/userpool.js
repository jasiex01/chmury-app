import { CognitoUserPool } from 'amazon-cognito-identity-js';
const poolData = {
  UserPoolId: "us-east-1_4O2HYiNzF",
  ClientId: "51blesi42j585u435i1hbrc4fs",
};

export default new CognitoUserPool(poolData);