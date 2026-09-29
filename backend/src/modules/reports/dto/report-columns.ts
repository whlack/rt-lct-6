export const reportColumns = [
  'id',
  'university',
  'direction',
  'offeringType',
  'offering',
  'status',
  'stage',
  'responsible',
  'supervisor',
  'createdAt',
  'closedAt',
  'vendor',
  'contractNumber',
  'licenseSignedAt',
  'licenseExpiresYear',
  'transferStatus',
] as const;
export type ReportColumn = (typeof reportColumns)[number];
