import type { Project, WorkflowInput } from '../../entities/project';
export function canConfigure(project: Project, level: number) {
  return (
    level >= 20 &&
    !project.closedAt &&
    !project.workflowLocked &&
    project.currentStageIndex === 0
  );
}
export function missingDocuments(project: Project) {
  const stage = project.stages.find(
    (item) => item.position === project.currentStageIndex,
  );
  return (
    stage?.documentTypes
      .filter(
        (type) =>
          type.isRequired &&
          !stage.files.some((file) => file.documentTypeId === type.id),
      )
      .map((type) => type.name) ?? []
  );
}
export function validateWorkflow(stages: WorkflowInput[]) {
  if (!stages.length || stages.length > 20)
    return 'Нужно от 1 до 20 этапов после формирования проекта.';
  const titles = stages.map((stage) => stage.title.trim());
  if (
    titles.some((title) => !title || title === 'Формирование проекта') ||
    new Set(titles).size !== titles.length
  )
    return 'Названия этапов должны быть заполнены и не повторяться.';
  for (const stage of stages) {
    if (stage.expectedActor === 'UNIVERSITY' && !stage.expectedContactId)
      return 'Выберите контакт вуза на каждом этапе, ожидающем его действия.';
    const names = stage.documentTypes.map((type) => type.name.trim());
    if (names.some((name) => !name) || new Set(names).size !== names.length)
      return 'Названия документов на этапе должны быть заполнены и не повторяться.';
  }
  return '';
}
