import {
  CreateBucketCommand,
  HeadBucketCommand,
  S3Client,
} from '@aws-sdk/client-s3';

const bucket = process.env.S3_BUCKET;
if (!bucket) throw new Error('S3_BUCKET is required');

const client = new S3Client({
  region: process.env.S3_REGION ?? 'us-east-1',
  endpoint: process.env.S3_ENDPOINT,
  forcePathStyle: true,
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY ?? '',
    secretAccessKey: process.env.S3_SECRET_KEY ?? '',
  },
});

for (let attempt = 0; attempt < 30; attempt += 1) {
  try {
    await client.send(new HeadBucketCommand({ Bucket: bucket }));
    console.info('Storage bucket is ready.');
    process.exit(0);
  } catch (error) {
    if (error?.$metadata?.httpStatusCode === 404) {
      await client.send(new CreateBucketCommand({ Bucket: bucket }));
      console.info('Storage bucket created.');
      process.exit(0);
    }
    if (attempt === 29) throw error;
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
}
