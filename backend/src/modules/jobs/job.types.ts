import type { Prisma } from '../../generated/prisma/client.js';
export type QueueKind = 'export' | 'import';
export type ExportKind = 'SUMMARY' | 'PROJECT' | 'STATISTICS';
export interface ExportArtifact {
  bytes: Buffer;
  fileName: string;
  mimeType: string;
  projectIds: string[];
}
export interface ExportInput {
  kind: ExportKind;
  format: string;
  permission: 'reports.export' | 'statistics.read';
  parameters: Prisma.InputJsonObject;
}
