import { writeFile } from 'node:fs/promises';
import { fixture } from './openapi-app.mjs';
const { app, createApiDocument } = await fixture(process.argv[2]);
try {
  await writeFile(process.argv[3], JSON.stringify(createApiDocument(app)));
} finally {
  await app.close();
}
