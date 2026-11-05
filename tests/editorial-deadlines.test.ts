import { describe, it, expect } from 'vitest';
import { calculateEditorialDeadlineStatus, getSaoPauloDateParts } from '../src/lib/editorial-deadlines';

describe('Editorial Deadlines Temporal Accuracy Suite', () => {
  it('converts timestamps accurately into Sao Paulo time parts', () => {
    // 2026-11-04 18:00 UTC = 2026-11-04 15:00 UTC-3
    const parts = getSaoPauloDateParts('2026-11-04T18:00:00.000Z');
    expect(parts.year).toBe(2026);
    expect(parts.month).toBe(10); // Nov
    expect(parts.day).toBe(4);
    expect(parts.hours).toBe(15);
    expect(parts.minutes).toBe(0);
    expect(parts.ymd).toBe('2026-11-04');
  });

  it('correctly handles the user-specified case: 68h remaining across 3 calendar days', () => {
    // Reference now: 2026-11-02 23:00 SP (UTC: 2026-11-03 02:00)
    const mockNow = new Date('2026-11-03T02:00:00.000Z').getTime();
    // Deadline: 2026-11-05 19:00 SP (UTC: 2026-11-05 22:00)
    // Diff: exactly 68 hours.
    // Calendar diff: Nov 5 - Nov 2 = 3 days.
    // Exact diff: 68h = 2 days and 20h.
    const mockDue = '2026-11-05T22:00:00.000Z';

    const result = calculateEditorialDeadlineStatus(mockDue, 'IN_PROGRESS', {
      nowMs: mockNow,
      extensionCount: 0
    });

    expect(result.calendarDiffDays).toBe(3);
    expect(result.exactDiffDays).toBe(2);
    expect(result.remainingHours).toBe(68);
    // Must NOT state "3 dias e 20h", MUST state "Faltam 2 dias e 20h"
    expect(result.remainingText).toBe('Faltam 2 dias e 20h');
    expect(result.civilDayText).toBe('quinta');
  });

  it('correctly reports 49h remaining across 3 calendar days as 2 days and 1h', () => {
    const mockNow = new Date('2026-11-02T22:00:00.000Z').getTime();
    const mockDue = '2026-11-04T23:00:00.000Z'; // 49h later

    const result = calculateEditorialDeadlineStatus(mockDue, 'IN_PROGRESS', {
      nowMs: mockNow,
      extensionCount: 0
    });

    expect(result.exactDiffDays).toBe(2);
    expect(result.remainingHours).toBe(49);
    expect(result.remainingText).toBe('Faltam 2 dias e 1h');
  });

  it('reports exact 48h as Faltam 2 dias', () => {
    const mockNow = new Date('2026-11-02T18:00:00.000Z').getTime();
    const mockDue = '2026-11-04T18:00:00.000Z'; // exactly 48h

    const result = calculateEditorialDeadlineStatus(mockDue, 'IN_PROGRESS', {
      nowMs: mockNow,
      extensionCount: 0
    });

    expect(result.exactDiffDays).toBe(2);
    expect(result.remainingHours).toBe(48);
    expect(result.remainingText).toBe('Faltam 2 dias');
  });

  it('reports due today correctly with natural format', () => {
    const mockNow = new Date('2026-11-04T15:00:00.000Z').getTime(); // 12:00 SP
    const mockDue = '2026-11-04T21:00:00.000Z'; // 18:00 SP (today)

    const result = calculateEditorialDeadlineStatus(mockDue, 'IN_PROGRESS', {
      nowMs: mockNow,
      extensionCount: 0
    });

    expect(result.isDueToday).toBe(true);
    expect(result.isDueTomorrow).toBe(false);
    expect(result.calendarDiffDays).toBe(0);
    expect(result.civilDayText).toBe('Hoje');
    expect(result.remainingText).toBe('Vence hoje, às 18:00');
    expect(result.inlineStatusLabel).toBe('Vence hoje');
  });

  it('reports due tomorrow correctly with natural format', () => {
    const mockNow = new Date('2026-11-04T15:00:00.000Z').getTime(); // 12:00 SP
    const mockDue = '2026-11-05T21:00:00.000Z'; // 18:00 SP (tomorrow)

    const result = calculateEditorialDeadlineStatus(mockDue, 'IN_PROGRESS', {
      nowMs: mockNow,
      extensionCount: 0
    });

    expect(result.isDueToday).toBe(false);
    expect(result.isDueTomorrow).toBe(true);
    expect(result.calendarDiffDays).toBe(1);
    expect(result.civilDayText).toBe('Amanhã');
    expect(result.remainingText).toBe('Vence amanhã, às 18:00');
    expect(result.inlineStatusLabel).toBe('Vence amanhã');
  });

  it('reports minutes remaining when less than 1 hour remains', () => {
    const mockNow = new Date('2026-11-04T15:00:00.000Z').getTime();
    const mockDue = '2026-11-04T15:45:00.000Z'; // 45m later

    const result = calculateEditorialDeadlineStatus(mockDue, 'IN_PROGRESS', {
      nowMs: mockNow,
      extensionCount: 0
    });

    expect(result.remainingHours).toBe(0);
    expect(result.remainingMinutes).toBe(45);
    expect(result.remainingText).toBe('Vence em 45min');
  });

  it('reports Vence em instantes when 5 minutes or less remain', () => {
    const mockNow = new Date('2026-11-04T15:00:00.000Z').getTime();
    const mockDue = '2026-11-04T15:04:00.000Z'; // 4m later

    const result = calculateEditorialDeadlineStatus(mockDue, 'IN_PROGRESS', {
      nowMs: mockNow,
      extensionCount: 0
    });

    expect(result.remainingText).toBe('Vence em instantes!');
  });

  it('reports overdue correctly', () => {
    const mockNow = new Date('2026-11-04T15:00:00.000Z').getTime();
    const mockDue = '2026-11-04T14:00:00.000Z'; // 1h ago

    const result = calculateEditorialDeadlineStatus(mockDue, 'IN_PROGRESS', {
      nowMs: mockNow,
      extensionCount: 0
    });

    expect(result.isOverdue).toBe(true);
    expect(result.statusClass).toBe('overdue');
    expect(result.remainingText).toBe('Prazo encerrado');
    expect(result.inlineStatusLabel).toBe('Atrasado');
  });

  it('reports completed stage correctly', () => {
    const result = calculateEditorialDeadlineStatus('2026-11-04T14:00:00.000Z', 'DONE', {
      extensionCount: 0
    });

    expect(result.statusClass).toBe('done');
    expect(result.statusLabel).toBe('Concluído');
    expect(result.remainingText).toBe('Concluído');
  });

  it('correctly tracks extensionCount > 0 with statusClass extended', () => {
    const mockNow = new Date('2026-11-04T12:00:00.000Z').getTime();
    const mockDue = '2026-11-07T02:59:59.000Z'; // Nov 6 23:59:59 SP (+2d extension)

    const result = calculateEditorialDeadlineStatus(mockDue, 'IN_PROGRESS', {
      nowMs: mockNow,
      extensionCount: 1
    });

    expect(result.statusClass).toBe('extended');
    expect(result.statusLabel).toBe('Prorrogado (+2d)');
  });
});
