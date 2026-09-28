import {
  DeleteObjectCommand,
  GetObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { Injectable } from '@nestjs/common';

@Injectable()
export class S3Adapter {
  private readonly bucket = process.env.S3_BUCKET ?? 'crm-files';
  private readonly client = new S3Client({
    region: process.env.S3_REGION ?? 'us-east-1',
    endpoint: process.env.S3_ENDPOINT,
    forcePathStyle: process.env.S3_FORCE_PATH_STYLE !== 'false',
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY ?? '',
      secretAccessKey: process.env.S3_SECRET_KEY ?? '',
    },
  });

  put(key: string, body: Buffer, mimeType: string) {
    return this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: body,
        ContentType: mimeType,
      }),
    );
  }

  async get(key: string): Promise<Uint8Array> {
    const result = await this.client.send(
      new GetObjectCommand({ Bucket: this.bucket, Key: key }),
    );
    if (!result.Body) throw new Error('Stored file has no body');
    return result.Body.transformToByteArray();
  }

  async *oldTemporaryKeys(before: Date) {
    // A process may die after upload but before committing the object reference.
    // Restrict orphan cleanup to our temporary prefixes, never project documents.
    for (const prefix of ['exports/', 'imports/']) {
      let cursor: string | undefined;
      do {
        const page = await this.client.send(
          new ListObjectsV2Command({
            Bucket: this.bucket,
            Prefix: prefix,
            ContinuationToken: cursor,
          }),
        );
        for (const object of page.Contents ?? [])
          if (object.Key && object.LastModified && object.LastModified < before)
            yield object.Key;
        cursor = page.IsTruncated ? page.NextContinuationToken : undefined;
      } while (cursor);
    }
  }

  delete(key: string) {
    return this.client.send(
      new DeleteObjectCommand({ Bucket: this.bucket, Key: key }),
    );
  }
}
