import type { ApiResponseOptions } from '@nestjs/swagger';
type SchemaObject = Extract<ApiResponseOptions, { schema: unknown }>['schema'];

const text: SchemaObject = { type: 'string' };
const date: SchemaObject = {
  type: 'string',
  format: 'date-time',
  nullable: true,
};
const named: SchemaObject = {
  type: 'object',
  properties: { id: { type: 'string', format: 'uuid' }, name: text },
};
const person: SchemaObject = {
  type: 'object',
  nullable: true,
  properties: {
    id: text,
    keycloakSubject: text,
    displayName: { ...text, nullable: true },
    email: { ...text, nullable: true },
  },
};
export const summarySchema: SchemaObject = {
  type: 'object',
  properties: {
    id: { type: 'string', format: 'uuid' },
    university: named,
    direction: named,
    offering: {
      ...named,
      properties: {
        ...named.properties,
        type: { type: 'string', enum: ['PROGRAM', 'PRODUCT'] },
      },
    },
    status: { type: 'string', enum: ['ACTIVE', 'CLOSED'] },
    currentStage: {
      ...named,
      properties: { id: text, title: text, position: { type: 'integer' } },
    },
    responsible: person,
    supervisor: person,
    createdAt: date,
    closedAt: date,
    vendor: { ...text, nullable: true },
    contractNumber: { ...text, nullable: true },
    licenseSignedAt: date,
    licenseExpiresYear: { type: 'integer', nullable: true },
    transferStatus: {
      type: 'string',
      enum: ['NOT_STARTED', 'IN_PROGRESS', 'COMPLETED'],
    },
  },
};
export const listSchema: SchemaObject = {
  type: 'object',
  properties: {
    rows: { type: 'array', items: summarySchema },
    total: { type: 'integer' },
    page: { type: 'integer' },
    pageSize: { type: 'integer' },
    filters: { type: 'object', description: 'Validated request filters' },
    generatedAt: date,
    timezone: text,
  },
};
export const detailSchema: SchemaObject = {
  type: 'object',
  properties: {
    ...summarySchema.properties,
    stages: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: text,
          title: text,
          position: { type: 'integer' },
          expectedActor: { type: 'string', enum: ['KAM', 'UNIVERSITY'] },
          expectedContact: { ...named, nullable: true },
          documentTypes: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: text,
                name: text,
                isRequired: { type: 'boolean' },
              },
            },
          },
          files: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: text,
                documentTypeId: text,
                fileName: text,
                mimeType: text,
                size: { type: 'integer' },
                status: { type: 'string', enum: ['ATTACHED', 'COMPLETED'] },
                createdAt: date,
                uploadedBy: person,
              },
            },
          },
        },
      },
    },
    comments: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: text,
          parentId: { ...text, nullable: true },
          body: { ...text, nullable: true },
          deletedAt: date,
          createdAt: date,
          updatedAt: date,
          author: person,
        },
      },
    },
    events: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: text,
          type: text,
          objectType: text,
          objectId: text,
          details: { type: 'object', nullable: true },
          createdAt: date,
          actor: person,
        },
      },
    },
    generatedAt: date,
  },
};
