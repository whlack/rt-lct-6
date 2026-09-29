import {
  array,
  dateTime,
  nullable,
  object,
  text,
  uuid,
} from '../../../common/api-schema.js';
const universityProperties = {
  id: uuid,
  name: text,
  normalizedName: text,
  primaryContactId: nullable(uuid),
  createdById: uuid,
  createdAt: dateTime,
  updatedAt: dateTime,
};
export const universityRecord = object(universityProperties);
export const universityCard = object({
  ...universityProperties,
  assignments: array(object({ userId: uuid })),
});
export const universityList = array(
  object({
    id: uuid,
    name: text,
    primaryContactId: nullable(uuid),
    createdAt: dateTime,
  }),
);
export const universityContact = object({
  id: uuid,
  universityId: uuid,
  name: text,
  email: nullable(text),
  phone: nullable(text),
  createdAt: dateTime,
  updatedAt: dateTime,
});
export const universityContacts = array(universityContact);
export const universityAssignments = array(
  object({
    universityId: uuid,
    userId: uuid,
    user: object({ keycloakSubject: text }),
  }),
);
