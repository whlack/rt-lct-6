import {
  S3Client,
  ListObjectsV2Command,
  GetObjectCommand,
  PutObjectCommand,
} from '@aws-sdk/client-s3';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const mode = process.argv[2];
if (!['save', 'restore', 'verify'].includes(mode))
  throw new Error('Invalid backup mode');
const directory = '/backup/s3';
await mkdir(directory, { recursive: true });
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const client = new S3Client({
  region: process.env.S3_REGION ?? 'us-east-1',
  endpoint: process.env.S3_ENDPOINT,
  forcePathStyle: true,
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY ?? '',
    secretAccessKey: process.env.S3_SECRET_KEY ?? '',
  },
});
const bucket = process.env.S3_BUCKET;
if (mode === 'save') {
  const manifest = [];
  let continuation;
  do {
    const page = await client.send(
      new ListObjectsV2Command({
        Bucket: bucket,
        ContinuationToken: continuation,
      }),
    );
    for (const object of page.Contents ?? []) {
      if (!object.Key) continue;
      const response = await client.send(
        new GetObjectCommand({ Bucket: bucket, Key: object.Key }),
      );
      if (!response.Body) throw new Error('Missing backup object body');
      const bytes = Buffer.from(await response.Body.transformToByteArray());
      const file = hash(Buffer.from(object.Key)) + '.bin';
      await writeFile(directory + '/' + file, bytes, { mode: 0o600 });
      manifest.push({
        key: object.Key,
        file,
        checksum: hash(bytes),
        size: bytes.length,
        type: response.ContentType ?? 'application/octet-stream',
      });
    }
    continuation = page.NextContinuationToken;
  } while (continuation);
  await writeFile(directory + '/manifest.json', JSON.stringify(manifest), {
    mode: 0o600,
  });
  console.log(
    JSON.stringify({ result: 'S3_BACKUP_SAVED', objects: manifest.length }),
  );
} else {
  const manifest = JSON.parse(
    await readFile(directory + '/manifest.json', 'utf8'),
  );
  if (!Array.isArray(manifest)) throw new Error('Invalid backup manifest');
  for (const item of manifest) {
    if (
      typeof item.key !== 'string' ||
      !/^[a-f0-9]{64}\.bin$/.test(item.file) ||
      typeof item.type !== 'string'
    )
      throw new Error('Invalid backup entry');
    const bytes = await readFile(directory + '/' + item.file);
    if (bytes.length !== item.size || hash(bytes) !== item.checksum)
      throw new Error('Backup checksum mismatch');
    if (mode === 'restore') {
      await client.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: item.key,
          Body: bytes,
          ContentType: item.type,
        }),
      );
      const restored = await client.send(
        new GetObjectCommand({ Bucket: bucket, Key: item.key }),
      );
      if (
        !restored.Body ||
        hash(Buffer.from(await restored.Body.transformToByteArray())) !==
          item.checksum
      )
        throw new Error('Restored object mismatch');
    }
  }
  console.log(
    JSON.stringify({
      result:
        mode === 'restore' ? 'S3_RESTORED_VERIFIED' : 'S3_MANIFEST_VERIFIED',
      objects: manifest.length,
    }),
  );
}
