/**
 * PROJECT NOX — Autoridade Temporal Editorial
 * Fuso Oficial: America/Sao_Paulo (UTC-3)
 * 
 * Regra Temporal Unificada:
 * Garante que Calendário, Minha Fila, Área de Produção e APIs concordem
 * matematicamente sobre datas, tempo restante e rótulos de vencimento.
 */

export interface SaoPauloDateParts {
  year: number;
  month: number; // 0-indexed (0 = Jan, 11 = Dec)
  day: number;
  hours: number;
  minutes: number;
  seconds: number;
  ymd: string; // YYYY-MM-DD
  dayOfWeek: number; // 0 = Sun, 6 = Sat
  weekdayStr: string;
}

export interface DeadlineStatusResult {
  dueYMD: string;
  isOverdue: boolean;
  isDueToday: boolean;
  isDueTomorrow: boolean;
  isDueSoon: boolean; // Dentro das últimas 24h operacionais ou vencendo hoje
  calendarDiffDays: number; // targetYMD - todayYMD em dias inteiros
  remainingHours: number;
  remainingMinutes: number;
  statusClass: 'overdue' | 'due-today' | 'due-soon' | 'extended' | 'in-progress' | 'done';
  statusLabel: string;
  inlineStatusLabel: string | null;
  remainingText: string;
  timeStr: string;
}

/**
 * Converte qualquer timestamp para as partes canônicas no fuso America/Sao_Paulo.
 */
export function getSaoPauloDateParts(dateInput?: Date | string | number | null): SaoPauloDateParts {
  const d = dateInput ? new Date(dateInput) : new Date();
  if (isNaN(d.getTime())) {
    return {
      year: 2026,
      month: 10,
      day: 4,
      hours: 0,
      minutes: 0,
      seconds: 0,
      ymd: '2026-11-04',
      dayOfWeek: 3,
      weekdayStr: 'Wed'
    };
  }

  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
    hour12: false,
    weekday: 'short'
  });

  const parts = formatter.formatToParts(d);
  let year = 2026, month = 1, day = 1, hours = 0, minutes = 0, seconds = 0, weekdayStr = '';
  for (const p of parts) {
    if (p.type === 'year') year = parseInt(p.value, 10);
    else if (p.type === 'month') month = parseInt(p.value, 10);
    else if (p.type === 'day') day = parseInt(p.value, 10);
    else if (p.type === 'hour') hours = parseInt(p.value, 10) % 24;
    else if (p.type === 'minute') minutes = parseInt(p.value, 10);
    else if (p.type === 'second') seconds = parseInt(p.value, 10);
    else if (p.type === 'weekday') weekdayStr = p.value;
  }

  const ymd = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  const weekdayMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  const dayOfWeek = weekdayMap[weekdayStr] ?? 0;
  return { year, month: month - 1, day, hours, minutes, seconds, ymd, dayOfWeek, weekdayStr };
}

/**
 * Calcula a diferença em dias corridos inteiros de calendário entre duas datas YYYY-MM-DD.
 * targetYMD - baseYMD
 */
export function getCalendarDayDiff(targetYMD: string, baseYMD: string): number {
  if (!targetYMD || !baseYMD) return 0;
  const [ty, tm, td] = targetYMD.split('-').map(Number);
  const [by, bm, bd] = baseYMD.split('-').map(Number);
  const targetUtc = Date.UTC(ty, tm - 1, td);
  const baseUtc = Date.UTC(by, bm - 1, bd);
  return Math.round((targetUtc - baseUtc) / 86400000);
}

/**
 * Formata prazo canônico: DD/MM às HH:MM
 */
export function formatDueDisplay(dueAt?: string | null): string {
  if (!dueAt) return 'Sem prazo registrado';
  const parts = getSaoPauloDateParts(dueAt);
  const day = String(parts.day).padStart(2, '0');
  const month = String(parts.month + 1).padStart(2, '0');
  const hours = String(parts.hours).padStart(2, '0');
  const mins = String(parts.minutes).padStart(2, '0');
  return `${day}/${month} às ${hours}:${mins}`;
}

/**
 * Formata timestamp genérico com data e hora.
 */
export function formatDateWithTime(dateStr?: string | null): string {
  if (!dateStr) return '--';
  return formatDueDisplay(dateStr);
}

/**
 * Motor Autorativo de Prazos Editoriais
 * Retorna estado, rótulos e tempos com coerência estrita de fuso horário.
 */
export function calculateEditorialDeadlineStatus(
  dueAt: string | null | undefined,
  status: string,
  options?: {
    nowMs?: number;
    extensionCount?: number;
    completedAt?: string | null;
  }
): DeadlineStatusResult {
  const nowMs = options?.nowMs ?? Date.now();
  const extensionCount = options?.extensionCount ?? 0;

  if (!dueAt) {
    return {
      dueYMD: '',
      isOverdue: false,
      isDueToday: false,
      isDueTomorrow: false,
      isDueSoon: false,
      calendarDiffDays: 999,
      remainingHours: 999,
      remainingMinutes: 999,
      statusClass: status === 'DONE' ? 'done' : 'in-progress',
      statusLabel: status === 'DONE' ? 'Concluído' : 'Sem prazo',
      inlineStatusLabel: null,
      remainingText: status === 'DONE' ? 'Concluído' : 'Sem prazo',
      timeStr: '--'
    };
  }

  const nowParts = getSaoPauloDateParts(nowMs);
  const dueParts = getSaoPauloDateParts(dueAt);
  const dueMs = new Date(dueAt).getTime();
  const diffMs = dueMs - nowMs;

  const dueYMD = dueParts.ymd;
  const todayYMD = nowParts.ymd;
  const calendarDiffDays = getCalendarDayDiff(dueYMD, todayYMD);

  const totalMinutes = Math.floor(diffMs / 60000);
  const totalHours = Math.floor(diffMs / 3600000);
  const isOverdue = diffMs < 0 && status !== 'DONE';

  const isDueToday = !isOverdue && status === 'IN_PROGRESS' && calendarDiffDays === 0;
  const isDueTomorrow = !isOverdue && status === 'IN_PROGRESS' && calendarDiffDays === 1;
  const isWithin24Hours = diffMs > 0 && diffMs <= 24 * 3600 * 1000;
  const isDueSoon = !isOverdue && status === 'IN_PROGRESS' && (isWithin24Hours || isDueToday);

  const timeStr = `${String(dueParts.hours).padStart(2, '0')}:${String(dueParts.minutes).padStart(2, '0')}`;
  const dayStr = `${String(dueParts.day).padStart(2, '0')}/${String(dueParts.month + 1).padStart(2, '0')}`;

  // 1. Status Class & Status Label
  let statusClass: DeadlineStatusResult['statusClass'] = 'in-progress';
  let statusLabel = 'No prazo';
  let inlineStatusLabel: string | null = null;

  if (status === 'DONE') {
    statusClass = 'done';
    statusLabel = 'Concluído';
  } else if (isOverdue) {
    statusClass = 'overdue';
    statusLabel = 'Em atraso';
    inlineStatusLabel = 'Atrasado';
  } else if (extensionCount > 0) {
    statusClass = 'extended';
    statusLabel = 'Prorrogado (+2d)';
    if (isDueToday) {
      inlineStatusLabel = 'Vence hoje';
    } else if (isDueTomorrow) {
      inlineStatusLabel = 'Vence amanhã';
    }
  } else if (isDueToday) {
    statusClass = 'due-soon';
    statusLabel = 'Vence hoje';
    inlineStatusLabel = 'Vence hoje';
  } else if (isDueTomorrow) {
    statusClass = 'due-soon';
    statusLabel = 'Vence amanhã';
    inlineStatusLabel = 'Vence amanhã';
  } else if (isDueSoon) {
    statusClass = 'due-soon';
    statusLabel = 'Vence em breve';
    inlineStatusLabel = 'Vence em breve';
  }

  // 2. Remaining Text em linguagem natural precisa
  let remainingText = '';
  if (status === 'DONE') {
    remainingText = 'Concluído';
  } else if (isOverdue) {
    remainingText = 'Prazo encerrado';
  } else if (totalHours < 1) {
    remainingText = totalMinutes <= 5 ? 'Vence em instantes!' : `Vence em ${Math.max(1, totalMinutes)}min`;
  } else if (isDueToday) {
    remainingText = `Vence hoje, às ${timeStr}`;
  } else if (isDueTomorrow) {
    remainingText = `Vence amanhã, às ${timeStr}`;
  } else {
    // Dias corridos naturais de calendário
    const remHours = totalHours % 24;
    if (calendarDiffDays === 2) {
      remainingText = remHours > 0 ? `Faltam 2 dias e ${remHours}h` : 'Faltam 2 dias';
    } else if (calendarDiffDays === 3) {
      remainingText = remHours > 0 ? `Faltam 3 dias e ${remHours}h` : 'Faltam 3 dias';
    } else {
      const weekdays = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
      const weekdayName = weekdays[dueParts.dayOfWeek] || 'dia';
      remainingText = `Vence ${weekdayName}, às ${timeStr}`;
    }
  }

  return {
    dueYMD,
    isOverdue,
    isDueToday,
    isDueTomorrow,
    isDueSoon,
    calendarDiffDays,
    remainingHours: totalHours,
    remainingMinutes: totalMinutes,
    statusClass,
    statusLabel,
    inlineStatusLabel,
    remainingText,
    timeStr
  };
}
