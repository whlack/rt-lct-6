import { describe, expect, it } from 'vitest';
import type { Project } from '../../entities/project';
import { canConfigure, missingDocuments, validateWorkflow } from './model';
const project = {
  closedAt: null,
  workflowLocked: false,
  currentStageIndex: 0,
  stages: [
    {
      id: 'first',
      position: 0,
      title: 'Формирование проекта',
      expectedActor: 'KAM',
      expectedContact: null,
      expectedContactId: null,
      documentTypes: [
        { id: 'required', name: 'Договор', isRequired: true },
        { id: 'optional', name: 'Приложение', isRequired: false },
      ],
      files: [],
    },
  ],
} as unknown as Project;
describe('workflow editing and transitions', () => {
  it('locks configuration after leaving the first stage, closing, or for a KAM', () => {
    expect(canConfigure(project, 20)).toBe(true);
    expect(canConfigure(project, 10)).toBe(false);
    expect(canConfigure({ ...project, currentStageIndex: 1 }, 30)).toBe(false);
    expect(canConfigure({ ...project, workflowLocked: true }, 30)).toBe(false);
    expect(canConfigure({ ...project, closedAt: '2026-09-29' }, 30)).toBe(
      false,
    );
  });
  it('requires an attachment for each required type; completion is not required for a transition', () => {
    expect(missingDocuments(project)).toEqual(['Договор']);
    const uploaded = {
      ...project,
      stages: [
        {
          ...project.stages[0],
          files: [
            {
              id: 'file',
              documentTypeId: 'required',
              fileName: 'agreement.pdf',
              mimeType: 'application/pdf',
              size: 100,
              status: 'ATTACHED' as const,
            },
          ],
        },
      ],
    };
    expect(missingDocuments(uploaded)).toEqual([]);
  });
  it('rejects ambiguous stage names and requires a university contact', () => {
    expect(
      validateWorkflow([
        { title: 'Встреча', expectedActor: 'UNIVERSITY', documentTypes: [] },
      ]),
    ).toContain('контакт');
    expect(
      validateWorkflow([
        { title: 'Встреча', expectedActor: 'KAM', documentTypes: [] },
        { title: ' Встреча ', expectedActor: 'KAM', documentTypes: [] },
      ]),
    ).toContain('повторяться');
    expect(
      validateWorkflow([
        {
          title: 'Документы',
          expectedActor: 'KAM',
          documentTypes: [{ name: 'Договор', isRequired: true }],
        },
      ]),
    ).toBe('');
  });
});
