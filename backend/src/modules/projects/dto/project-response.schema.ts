import {
  array,
  boolean,
  dateTime,
  integer,
  named,
  nullable,
  object,
  profileName,
  subjectProfile,
  text,
  uuid,
} from '../../../common/api-schema.js';

const projectProperties = {
  id: uuid,
  universityId: uuid,
  directionId: uuid,
  programId: nullable(uuid),
  productId: nullable(uuid),
  responsibleId: uuid,
  supervisorId: nullable(uuid),
  createdById: uuid,
  vendor: nullable(text),
  contractNumber: nullable(text),
  licenseSignedAt: nullable(dateTime),
  licenseExpiresYear: nullable(integer),
  transferStatus: {
    type: 'string' as const,
    enum: ['NOT_STARTED', 'IN_PROGRESS', 'COMPLETED'],
  },
  currentStageIndex: integer,
  workflowLocked: boolean,
  closedAt: nullable(dateTime),
  createdAt: dateTime,
  updatedAt: dateTime,
};
export const projectRecord = object(projectProperties);
const fileProperties = {
  id: uuid,
  stageId: uuid,
  documentTypeId: uuid,
  fileName: text,
  mimeType: text,
  size: integer,
  status: { type: 'string' as const, enum: ['ATTACHED', 'COMPLETED'] },
  uploadedById: uuid,
  createdAt: dateTime,
};
export const projectFile = object(fileProperties);
const { stageId: _stageId, ...stageFileProperties } = fileProperties;
// Stage projections omit stageId; upload/complete responses include it.
void _stageId;
const stage = object({
  id: uuid,
  projectId: uuid,
  position: integer,
  title: text,
  expectedActor: { type: 'string', enum: ['KAM', 'UNIVERSITY'] },
  expectedContactId: nullable(uuid),
  expectedContact: nullable(named),
  documentTypes: array(
    object({ id: uuid, stageId: uuid, name: text, isRequired: boolean }),
  ),
  files: array(object(stageFileProperties)),
});
export const projectCard = object({
  ...projectProperties,
  university: named,
  direction: named,
  program: nullable(named),
  product: nullable(named),
  responsible: subjectProfile,
  supervisor: nullable(subjectProfile),
  stages: array(stage),
});
const currentStage = object({ id: uuid, position: integer, title: text });
export const projectPage = object({
  rows: array(
    object({
      id: uuid,
      university: named,
      direction: named,
      program: nullable(named),
      product: nullable(named),
      responsibleId: uuid,
      supervisorId: nullable(uuid),
      currentStageIndex: integer,
      closedAt: nullable(dateTime),
      createdAt: dateTime,
      currentStage: nullable(currentStage),
    }),
  ),
  total: integer,
  page: integer,
  pageSize: integer,
});
const commentProperties = {
  id: uuid,
  projectId: uuid,
  parentId: nullable(uuid),
  authorId: uuid,
  body: nullable(text),
  createdAt: dateTime,
  updatedAt: dateTime,
  deletedAt: nullable(dateTime),
};
export const projectComment = object(commentProperties);
const { projectId: _projectId, ...listedComment } = commentProperties;
void _projectId;
export const projectComments = array(
  object({ ...listedComment, author: profileName }),
);
export const projectHistory = array(
  object({
    id: uuid,
    projectId: uuid,
    actorId: uuid,
    type: text,
    objectType: text,
    objectId: text,
    details: { type: 'object', additionalProperties: true, nullable: true },
    createdAt: dateTime,
    actor: profileName,
  }),
);
