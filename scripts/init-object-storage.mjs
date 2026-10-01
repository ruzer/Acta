import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import {
  S3Client,
  CreateBucketCommand,
  HeadBucketCommand,
  PutBucketPolicyCommand,
  GetObjectCommand,
} from "@aws-sdk/client-s3";
const read = (k) => readFileSync("/run/provision-secrets/" + k, "utf8");
const endpoint = "http://object-storage:9000",
  bucket = process.env.S3_BUCKET;
if (!bucket || !/^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/.test(bucket))
  throw Error("Invalid bucket name");
const access = read("access"),
  secret = read("secret");
const env = {
  ...process.env,
  ADMIN_ACCESS_KEY: read("root-user"),
  ADMIN_SECRET_KEY: read("root-password"),
  ADMIN_ENDPOINT_URL: endpoint,
};
const result = spawnSync(
  "/opt/versitygw",
  [
    "admin",
    "create-user",
    "--access",
    access,
    "--secret",
    secret,
    "--role",
    "user",
  ],
  { env, encoding: "utf8" },
);
// Existing account is accepted only if its configured credentials pass the signed check below.
if (result.status !== 0 && !/exist/i.test(result.stderr + result.stdout))
  throw Error("Account initialization failed; output withheld");
const client = new S3Client({
  endpoint,
  region: "us-east-1",
  forcePathStyle: true,
  credentials: {
    accessKeyId: read("root-user"),
    secretAccessKey: read("root-password"),
  },
});
try {
  await client.send(new HeadBucketCommand({ Bucket: bucket }));
} catch (e) {
  if (e.$metadata?.httpStatusCode !== 404) throw e;
  await client.send(new CreateBucketCommand({ Bucket: bucket }));
}
await client.send(
  new PutBucketPolicyCommand({
    Bucket: bucket,
    Policy: JSON.stringify({
      Version: "2012-10-17",
      Statement: [
        {
          Effect: "Allow",
          Principal: access,
          Action: ["s3:ListBucket", "s3:GetBucketLocation"],
          Resource: "arn:aws:s3:::" + bucket,
        },
        {
          Effect: "Allow",
          Principal: access,
          Action: ["s3:GetObject", "s3:PutObject", "s3:DeleteObject"],
          Resource: "arn:aws:s3:::" + bucket + "/evidence/v1/*",
        },
      ],
    }),
  }),
);
await client.send(new HeadBucketCommand({ Bucket: bucket }));
const app = new S3Client({
  endpoint,
  region: "us-east-1",
  forcePathStyle: true,
  credentials: { accessKeyId: access, secretAccessKey: secret },
});
await app.send(new HeadBucketCommand({ Bucket: bucket }));
try {
  const object = await app.send(
    new GetObjectCommand({
      Bucket: bucket,
      Key: "outside-prefix/provisioning-check",
    }),
  );
  object.Body?.destroy();
  throw Error("Application storage account has excess permissions");
} catch (error) {
  if (error.$metadata?.httpStatusCode !== 403)
    throw Error("Application storage scope verification failed", {
      cause: error,
    });
}
app.destroy();
console.log("Private bucket and restricted application account ready");
client.destroy();
