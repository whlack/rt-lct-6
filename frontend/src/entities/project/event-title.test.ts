import { describe, expect, it } from 'vitest';
import { eventTitle } from './index';

describe('stage transition history', () => {
  it('names new events and resolves older ID-only events from project stages', () => {
    const stages = new Map([
      ['first', 'Формирование проекта'],
      ['second', 'Согласование'],
    ]);
    expect(
      eventTitle(
        {
          type: 'STAGE_ADVANCED',
          details: { from: 'first', to: 'second' },
        },
        stages,
      ),
    ).toBe('Переход: Формирование проекта → Согласование');
    expect(
      eventTitle({
        type: 'STAGE_ADVANCED',
        details: { fromTitle: 'Согласование', toTitle: 'Завершение' },
      }),
    ).toBe('Переход: Согласование → Завершение');
  });
});
