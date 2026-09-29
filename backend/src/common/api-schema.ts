import type { SchemaObject } from '@nestjs/swagger';

export const uuid: SchemaObject = { type: 'string', format: 'uuid' };
export const text: SchemaObject = { type: 'string' };
export const integer: SchemaObject = { type: 'integer' };
export const boolean: SchemaObject = { type: 'boolean' };
export const dateTime: SchemaObject = { type: 'string', format: 'date-time' };
export const nullable = (schema: SchemaObject): SchemaObject => ({
  ...schema,
  nullable: true,
});
export const array = (items: SchemaObject): SchemaObject => ({
  type: 'array',
  items,
});
export const object = (
  properties: Record<string, SchemaObject>,
): SchemaObject => ({
  type: 'object',
  properties,
  required: Object.keys(properties),
});
export const named = object({ id: uuid, name: text });
export const subjectProfile = object({ id: uuid, keycloakSubject: text });
export const publicProfile = object({
  id: uuid,
  keycloakSubject: text,
  displayName: nullable(text),
  email: nullable(text),
});

export const profileName = object({
  displayName: nullable(text),
  email: nullable(text),
});
