import {
  array,
  boolean,
  dateTime,
  integer,
  named,
  nullable,
  object,
  publicProfile,
  text,
  uuid,
} from '../../../common/api-schema.js';

/** Возвращаются текущие значения, а период определяет принадлежность проекта выборке. */
export const reportFilterSchema = {
  type: 'object' as const,
  properties: {
    dateFrom: {
      ...text,
      format: 'date',
      description: 'Первый день включительно.',
      example: '2026-01-01',
    },
    dateTo: {
      ...text,
      format: 'date',
      description: 'Последний день включительно.',
      example: '2026-03-31',
    },
    universityId: uuid,
    directionId: uuid,
    programId: uuid,
    productId: uuid,
    responsibleSubject: uuid,
    status: { ...text, enum: ['ACTIVE', 'CLOSED'] },
  },
};
export const summarySchema = object({
  id: uuid,
  university: named,
  direction: named,
  offering: object({
    id: uuid,
    name: text,
    type: { ...text, enum: ['PROGRAM', 'PRODUCT'] },
  }),
  status: { ...text, enum: ['ACTIVE', 'CLOSED'] },
  currentStage: nullable(object({ id: uuid, title: text, position: integer })),
  responsible: publicProfile,
  supervisor: nullable(publicProfile),
  createdAt: dateTime,
  closedAt: nullable(dateTime),
  vendor: nullable(text),
  contractNumber: nullable(text),
  licenseSignedAt: nullable(dateTime),
  licenseExpiresYear: nullable(integer),
  transferStatus: {
    ...text,
    enum: ['NOT_STARTED', 'IN_PROGRESS', 'COMPLETED'],
  },
});
export const listSchema = object({
  rows: array(summarySchema),
  total: integer,
  page: integer,
  pageSize: integer,
  filters: {
    ...reportFilterSchema,
    properties: {
      ...reportFilterSchema.properties,
      page: integer,
      pageSize: integer,
    },
    required: ['page', 'pageSize'],
  },
  generatedAt: dateTime,
  timezone: { ...text, example: 'Europe/Moscow' },
});
/** Полный отчёт не содержит файловое содержимое и служебные ключи хранилища. */
export const detailSchema = object({
  ...summarySchema.properties,
  stages: array(
    object({
      id: uuid,
      projectId: uuid,
      expectedContactId: nullable(uuid),
      title: text,
      position: integer,
      expectedActor: { ...text, enum: ['KAM', 'UNIVERSITY'] },
      expectedContact: nullable(named),
      documentTypes: array(
        object({ id: uuid, stageId: uuid, name: text, isRequired: boolean }),
      ),
      files: array(
        object({
          id: uuid,
          documentTypeId: uuid,
          fileName: text,
          mimeType: text,
          size: integer,
          status: { ...text, enum: ['ATTACHED', 'COMPLETED'] },
          createdAt: dateTime,
          uploadedBy: publicProfile,
        }),
      ),
    }),
  ),
  comments: array(
    object({
      id: uuid,
      parentId: nullable(uuid),
      body: nullable(text),
      deletedAt: nullable(dateTime),
      createdAt: dateTime,
      updatedAt: dateTime,
      author: publicProfile,
    }),
  ),
  events: array(
    object({
      id: uuid,
      projectId: uuid,
      actorId: uuid,
      type: text,
      objectType: text,
      objectId: uuid,
      details: { type: 'object', additionalProperties: true, nullable: true },
      createdAt: dateTime,
      actor: publicProfile,
    }),
  ),
  generatedAt: dateTime,
});
