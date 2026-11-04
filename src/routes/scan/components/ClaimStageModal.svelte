<script lang="ts">
  import {
    Calendar as CalendarIcon,
    Clock,
    X,
    Check,
    AlertCircle,
    Info,
    ChevronLeft,
    ChevronRight,
    Sparkles,
    Briefcase
  } from '@lucide/svelte';
  import { enhance } from '$app/forms';
  import UserAvatar from '$lib/components/UserAvatar.svelte';

  interface Props {
    isOpen: boolean;
    stageItem: any | null; // { id, stage: { name, slug, color }, chapter: { chapter_number, chapter_label, work: { title, cover_id } } }
    currentUser: any;
    onClose: () => void;
    onSuccess?: () => void;
  }

  let {
    isOpen = false,
    stageItem = null,
    currentUser = {},
    onClose,
    onSuccess
  }: Props = $props();

  const MONTH_NAMES = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ];

  const WEEK_DAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

  // Timezone helper: America/Sao_Paulo
  function getSaoPauloDate(): Date {
    const now = new Date();
    const spStr = now.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' });
    return new Date(spStr);
  }

  function formatYMD(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  let spToday = $derived(getSaoPauloDate());
  let todayYMD = $derived(formatYMD(spToday));

  // Max allowed is today + 3 calendar days
  let spMaxDate = $derived.by(() => {
    const d = new Date(spToday);
    d.setDate(d.getDate() + 3);
    return d;
  });
  let maxYMD = $derived(formatYMD(spMaxDate));

  // Calendar view state
  let viewYear = $state(new Date().getFullYear());
  let viewMonth = $state(new Date().getMonth());

  // Selected date defaults to max permitted (today + 3 days)
  let selectedYMD = $state('');
  let notes = $state('');
  let isSubmitting = $state(false);
  let errorMessage = $state<string | null>(null);

  // Sync state whenever modal opens
  $effect(() => {
    if (isOpen) {
      const nowSp = getSaoPauloDate();
      viewYear = nowSp.getFullYear();
      viewMonth = nowSp.getMonth();
      const defaultMax = new Date(nowSp);
      defaultMax.setDate(defaultMax.getDate() + 3);
      selectedYMD = formatYMD(defaultMax);
      notes = '';
      errorMessage = null;
      isSubmitting = false;
    }
  });

  // Allowed YMDs set: today, today+1, today+2, today+3
  let allowedYMDs = $derived.by(() => {
    const set = new Set<string>();
    for (let i = 0; i <= 3; i++) {
      const d = new Date(spToday);
      d.setDate(d.getDate() + i);
      set.add(formatYMD(d));
    }
    return set;
  });

  // Month navigation boundary checks (only allow navigating within months containing allowed dates)
  let canPrevMonth = $derived(
    viewYear > spToday.getFullYear() ||
    (viewYear === spToday.getFullYear() && viewMonth > spToday.getMonth())
  );
  let canNextMonth = $derived(
    viewYear < spMaxDate.getFullYear() ||
    (viewYear === spMaxDate.getFullYear() && viewMonth < spMaxDate.getMonth())
  );

  function prevMonth() {
    if (!canPrevMonth || isSubmitting) return;
    if (viewMonth === 0) {
      viewMonth = 11;
      viewYear--;
    } else {
      viewMonth--;
    }
  }

  function nextMonth() {
    if (!canNextMonth || isSubmitting) return;
    if (viewMonth === 11) {
      viewMonth = 0;
      viewYear++;
    } else {
      viewMonth++;
    }
  }

  // Days matrix for the calendar month
  let monthCells = $derived.by(() => {
    const firstDay = new Date(viewYear, viewMonth, 1).getDay();
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const daysInPrevMonth = new Date(viewYear, viewMonth, 0).getDate();

    const cells: Array<{
      day: number;
      ymd: string;
      isCurrentMonth: boolean;
      isToday: boolean;
      isSelected: boolean;
      isAllowed: boolean;
    }> = [];

    // Leading days from previous month
    for (let i = firstDay - 1; i >= 0; i--) {
      const day = daysInPrevMonth - i;
      const prevDate = new Date(viewYear, viewMonth - 1, day);
      const ymd = formatYMD(prevDate);
      cells.push({
        day,
        ymd,
        isCurrentMonth: false,
        isToday: ymd === todayYMD,
        isSelected: ymd === selectedYMD,
        isAllowed: allowedYMDs.has(ymd)
      });
    }

    // Days in current month
    for (let day = 1; day <= daysInMonth; day++) {
      const curDate = new Date(viewYear, viewMonth, day);
      const ymd = formatYMD(curDate);
      cells.push({
        day,
        ymd,
        isCurrentMonth: true,
        isToday: ymd === todayYMD,
        isSelected: ymd === selectedYMD,
        isAllowed: allowedYMDs.has(ymd)
      });
    }

    // Trailing days from next month to fill 7 columns (up to 35 or 42 cells)
    const totalCells = cells.length <= 35 ? 35 : 42;
    const remaining = totalCells - cells.length;
    for (let day = 1; day <= remaining; day++) {
      const nextDate = new Date(viewYear, viewMonth + 1, day);
      const ymd = formatYMD(nextDate);
      cells.push({
        day,
        ymd,
        isCurrentMonth: false,
        isToday: ymd === todayYMD,
        isSelected: ymd === selectedYMD,
        isAllowed: allowedYMDs.has(ymd)
      });
    }

    return cells;
  });

  function selectDate(ymd: string, isAllowed: boolean) {
    if (!isAllowed) return;
    selectedYMD = ymd;
    errorMessage = null;
  }

  // Format selected date for display (ex: "Sexta-feira, 7 de Novembro de 2026")
  let formattedSelected = $derived.by(() => {
    if (!selectedYMD) return '';
    const [y, m, d] = selectedYMD.split('-').map(Number);
    const dateObj = new Date(y, m - 1, d);
    return dateObj.toLocaleDateString('pt-BR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  });

  let formattedMax = $derived.by(() => {
    return spMaxDate.toLocaleDateString('pt-BR', {
      day: 'numeric',
      month: 'long'
    });
  });

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape' && isOpen) {
      onClose();
    }
  }
</script>

<svelte:window onkeydown={handleKeydown} />

{#if isOpen && stageItem}
  <div
    class="modal-backdrop"
    onclick={(e) => {
      if (e.target === e.currentTarget && !isSubmitting) onClose();
    }}
    role="dialog"
    aria-modal="true"
    aria-labelledby="claim-modal-title"
  >
    <div class="modal-card">
      <!-- Modal Header -->
      <header class="modal-header">
        <div class="header-title-row">
          <div class="icon-orb purple">
            <CalendarIcon size={20} />
          </div>
          <div>
            <h2 id="claim-modal-title" class="modal-title">Assumir etapa e definir prazo</h2>
            <p class="modal-subtitle">Escolha sua data de entrega. Prazo máximo: 3 dias.</p>
          </div>
        </div>
        <button
          type="button"
          class="btn-close-modal"
          onclick={onClose}
          disabled={isSubmitting}
          aria-label="Fechar"
        >
          <X size={18} />
        </button>
      </header>

      <!-- Work & Chapter Context Hero -->
      <section class="stage-context-box">
        <div class="work-cover-wrapper">
          {#if stageItem.chapter?.work?.cover_id}
            <img
              src="/media/{stageItem.chapter.work.cover_id}"
              alt={stageItem.chapter?.work?.title || 'Capa'}
              class="work-cover-thumb"
            />
          {:else}
            <div class="work-cover-fallback">
              <Briefcase size={22} />
            </div>
          {/if}
        </div>

        <div class="stage-info-meta">
          <span class="stage-work-title">{stageItem.chapter?.work?.title || 'Obra'}</span>
          <div class="stage-badge-row">
            <span class="chapter-pill">Capítulo #{stageItem.chapter?.chapter_number || '1'}</span>
            <span class="stage-pill" style="--stage-color: {stageItem.stage?.color || '#8b5cf6'}">
              <span class="dot"></span>
              {stageItem.stage?.name || 'Etapa Editorial'}
            </span>
          </div>
          <div class="assignee-preview-row">
            <span class="assignee-label">Responsável:</span>
            <div class="user-inline-pill">
              <UserAvatar user={currentUser} size={18} />
              <span class="user-name">{currentUser?.display_name || currentUser?.username || 'Você'}</span>
            </div>
          </div>
        </div>
      </section>

      <!-- Form Body with Calendar Picker -->
      <form
        method="POST"
        action="?/claimStage"
        use:enhance={() => {
          isSubmitting = true;
          errorMessage = null;
          return async ({ result, update }) => {
            isSubmitting = false;
            if (result.type === 'failure') {
              errorMessage = (result.data as any)?.message || 'Não foi possível assumir esta etapa.';
            } else if (result.type === 'success') {
              await update();
              if (onSuccess) onSuccess();
              onClose();
            }
          };
        }}
        class="claim-form-body"
      >
        <input type="hidden" name="chapter_stage_id" value={stageItem.id} />
        <input type="hidden" name="due_date" value={selectedYMD} />

        {#if errorMessage}
          <div class="alert-banner error" role="alert">
            <AlertCircle size={16} />
            <span>{errorMessage}</span>
          </div>
        {/if}

        <!-- Interactive Calendar Component -->
        <div class="calendar-picker-wrapper">
          <div class="calendar-header-nav">
            <span class="calendar-month-label">{MONTH_NAMES[viewMonth]} {viewYear}</span>
            <div class="nav-arrows">
              <button
                type="button"
                class="arrow-btn"
                onclick={prevMonth}
                aria-label="Mês anterior"
                disabled={isSubmitting || !canPrevMonth}
              >
                <ChevronLeft size={16} />
              </button>
              <button
                type="button"
                class="arrow-btn"
                onclick={nextMonth}
                aria-label="Próximo mês"
                disabled={isSubmitting || !canNextMonth}
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>

          <!-- Weekday Names -->
          <div class="week-days-row">
            {#each WEEK_DAYS as wd}
              <span class="week-day-name">{wd}</span>
            {/each}
          </div>

          <!-- Days Grid -->
          <div class="month-grid">
            {#each monthCells as cell}
              <button
                type="button"
                class="grid-day-cell"
                class:is-other-month={!cell.isCurrentMonth}
                class:is-today={cell.isToday}
                class:is-selected={cell.isSelected}
                class:is-allowed={cell.isAllowed}
                class:is-disabled={!cell.isAllowed}
                disabled={!cell.isAllowed || isSubmitting}
                onclick={() => selectDate(cell.ymd, cell.isAllowed)}
                title={cell.isAllowed ? `Entregar em ${cell.ymd}` : 'Fora do prazo máximo de 3 dias'}
              >
                <span class="day-num">{cell.day}</span>
                {#if cell.isToday}
                  <span class="today-marker" title="Hoje"></span>
                {/if}
                {#if cell.isSelected}
                  <span class="selected-check">
                    <Check size={10} />
                  </span>
                {/if}
              </button>
            {/each}
          </div>
        </div>

        <!-- Selected Deadline Summary Box -->
        <div class="deadline-summary-box">
          <div class="summary-line">
            <span class="summary-label">
              <Clock size={14} class="ico-summary cyan" />
              Previsão de Entrega:
            </span>
            <strong class="summary-value cyan">{formattedSelected} às 23:59</strong>
          </div>
          <div class="summary-hint">
            <Info size={13} class="ico-info" />
            <span>Horário de Brasília (America/Sao_Paulo). Prazo máximo permitido: {formattedMax}.</span>
          </div>
        </div>

        <!-- Optional Observation / Planning Notes Field -->
        <div class="notes-field-group">
          <label for="claim-notes-input" class="notes-label">
            <span>Observações de planejamento (opcional)</span>
            <span class="char-count">{notes.length}/500</span>
          </label>
          <textarea
            id="claim-notes-input"
            name="notes"
            bind:value={notes}
            maxlength="500"
            rows="2"
            placeholder="Ex: Planejo entregar metade das páginas amanhã à noite..."
            class="notes-textarea"
            disabled={isSubmitting}
          ></textarea>
        </div>

        <!-- Action Buttons -->
        <footer class="modal-actions-footer">
          <button
            type="button"
            class="btn-cancel"
            onclick={onClose}
            disabled={isSubmitting}
          >
            Cancelar
          </button>
          <button
            type="submit"
            class="btn-confirm"
            disabled={!selectedYMD || isSubmitting}
          >
            {#if isSubmitting}
              <span class="spinner"></span>
              <span>Registrando compromisso...</span>
            {:else}
              <Check size={16} />
              <span>Confirmar Compromisso</span>
            {/if}
          </button>
        </footer>
      </form>
    </div>
  </div>
{/if}

<style>
  .modal-backdrop {
    position: fixed;
    inset: 0;
    z-index: 9999;
    background: rgba(4, 7, 18, 0.78);
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
    display: flex;
    align-items: flex-start;
    justify-content: center;
    padding: max(1rem, env(safe-area-inset-top, 1rem)) 1rem max(1rem, env(safe-area-inset-bottom, 1rem));
    overflow-y: auto;
    -webkit-overflow-scrolling: touch;
  }

  .modal-card {
    background: #0b0f19;
    border: 1px solid rgba(139, 92, 246, 0.25);
    border-radius: 1.25rem;
    box-shadow: 0 20px 50px rgba(0, 0, 0, 0.6), 0 0 30px rgba(139, 92, 246, 0.12);
    width: 100%;
    max-width: 480px;
    margin: auto 0;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    animation: modalPop 0.2s cubic-bezier(0.16, 1, 0.3, 1);
  }

  @keyframes modalPop {
    from {
      opacity: 0;
      transform: scale(0.96) translateY(8px);
    }
    to {
      opacity: 1;
      transform: scale(1) translateY(0);
    }
  }

  .modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 1.25rem 1.25rem 1rem;
    border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  }

  .header-title-row {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .icon-orb {
    width: 40px;
    height: 40px;
    border-radius: 0.75rem;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(139, 92, 246, 0.15);
    color: #c084fc;
    border: 1px solid rgba(139, 92, 246, 0.3);
    flex-shrink: 0;
  }

  .modal-title {
    font-size: 1.05rem;
    font-weight: 700;
    color: #f8fafc;
    margin: 0;
    line-height: 1.25;
  }

  .modal-subtitle {
    font-size: 0.8rem;
    color: #94a3b8;
    margin: 0.2rem 0 0;
  }

  .btn-close-modal {
    background: transparent;
    border: none;
    color: #64748b;
    cursor: pointer;
    padding: 0.5rem;
    border-radius: 0.5rem;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.15s ease;
  }

  .btn-close-modal:hover:not(:disabled) {
    background: rgba(255, 255, 255, 0.08);
    color: #f1f5f9;
  }

  .stage-context-box {
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 0.9rem 1.25rem;
    background: rgba(15, 23, 42, 0.6);
    border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  }

  .work-cover-wrapper {
    width: 48px;
    height: 64px;
    border-radius: 0.5rem;
    overflow: hidden;
    background: #1e293b;
    flex-shrink: 0;
    border: 1px solid rgba(255, 255, 255, 0.08);
  }

  .work-cover-thumb {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .work-cover-fallback {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #64748b;
  }

  .stage-info-meta {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    min-width: 0;
  }

  .stage-work-title {
    font-size: 0.95rem;
    font-weight: 700;
    color: #f1f5f9;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .stage-badge-row {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    flex-wrap: wrap;
  }

  .chapter-pill {
    font-size: 0.72rem;
    font-weight: 600;
    background: rgba(255, 255, 255, 0.07);
    color: #cbd5e1;
    padding: 0.15rem 0.45rem;
    border-radius: 0.35rem;
  }

  .stage-pill {
    font-size: 0.72rem;
    font-weight: 600;
    background: rgba(139, 92, 246, 0.15);
    color: var(--stage-color, #a855f7);
    border: 1px solid color-mix(in srgb, var(--stage-color, #a855f7) 35%, transparent);
    padding: 0.15rem 0.45rem;
    border-radius: 0.35rem;
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
  }

  .stage-pill .dot {
    width: 5px;
    height: 5px;
    border-radius: 50%;
    background: currentColor;
  }

  .assignee-preview-row {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    font-size: 0.75rem;
    color: #94a3b8;
    margin-top: 0.1rem;
  }

  .user-inline-pill {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    color: #e2e8f0;
    font-weight: 500;
  }

  .claim-form-body {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    padding: 1.25rem;
  }

  .alert-banner.error {
    background: rgba(239, 68, 68, 0.15);
    border: 1px solid rgba(239, 68, 68, 0.35);
    color: #fca5a5;
    padding: 0.6rem 0.8rem;
    border-radius: 0.5rem;
    font-size: 0.8rem;
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  /* Calendar Picker */
  .calendar-picker-wrapper {
    background: rgba(15, 23, 42, 0.7);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 0.85rem;
    padding: 0.9rem;
    display: flex;
    flex-direction: column;
    gap: 0.6rem;
  }

  .calendar-header-nav {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .calendar-month-label {
    font-size: 0.875rem;
    font-weight: 700;
    color: #f1f5f9;
  }

  .nav-arrows {
    display: flex;
    align-items: center;
    gap: 0.25rem;
  }

  .arrow-btn {
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.08);
    color: #cbd5e1;
    width: 28px;
    height: 28px;
    border-radius: 0.4rem;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .arrow-btn:hover:not(:disabled) {
    background: rgba(255, 255, 255, 0.12);
    color: #fff;
  }

  .arrow-btn:disabled {
    opacity: 0.25;
    cursor: not-allowed;
  }

  .week-days-row {
    display: grid;
    grid-template-columns: repeat(7, 1fr);
    text-align: center;
    font-size: 0.7rem;
    font-weight: 600;
    color: #64748b;
    padding-bottom: 0.2rem;
  }

  .month-grid {
    display: grid;
    grid-template-columns: repeat(7, 1fr);
    gap: 0.25rem;
  }

  .grid-day-cell {
    position: relative;
    aspect-ratio: 1;
    border-radius: 0.5rem;
    border: 1px solid transparent;
    background: transparent;
    color: #475569;
    font-size: 0.8rem;
    font-weight: 500;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: not-allowed;
    transition: all 0.15s ease;
    padding: 0;
  }

  .grid-day-cell.is-other-month {
    opacity: 0.25;
  }

  .grid-day-cell.is-allowed {
    background: rgba(139, 92, 246, 0.08);
    border-color: rgba(139, 92, 246, 0.2);
    color: #cbd5e1;
    font-weight: 600;
    cursor: pointer;
  }

  .grid-day-cell.is-allowed:hover:not(:disabled) {
    background: rgba(139, 92, 246, 0.2);
    border-color: rgba(139, 92, 246, 0.45);
    color: #fff;
    transform: translateY(-1px);
  }

  .grid-day-cell.is-selected {
    background: #8b5cf6 !important;
    border-color: #a78bfa !important;
    color: #fff !important;
    font-weight: 700;
    box-shadow: 0 4px 12px rgba(139, 92, 246, 0.4);
  }

  .grid-day-cell.is-today .day-num {
    text-decoration: underline;
    text-underline-offset: 2px;
  }

  .today-marker {
    position: absolute;
    bottom: 3px;
    width: 4px;
    height: 4px;
    border-radius: 50%;
    background: #06b6d4;
  }

  .selected-check {
    position: absolute;
    top: 2px;
    right: 2px;
    color: #fff;
    opacity: 0.85;
  }

  .grid-day-cell.is-disabled {
    opacity: 0.35;
    pointer-events: none;
  }

  /* Summary Box */
  .deadline-summary-box {
    background: rgba(6, 182, 212, 0.06);
    border: 1px solid rgba(6, 182, 212, 0.2);
    border-radius: 0.75rem;
    padding: 0.75rem 0.9rem;
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
  }

  .summary-line {
    display: flex;
    align-items: center;
    justify-content: space-between;
    font-size: 0.82rem;
    flex-wrap: wrap;
    gap: 0.3rem;
  }

  .summary-label {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    color: #94a3b8;
  }

  :global(.ico-summary.cyan) {
    color: #06b6d4;
  }

  .summary-value.cyan {
    color: #22d3ee;
    font-weight: 700;
    font-size: 0.85rem;
  }

  .summary-hint {
    display: flex;
    align-items: flex-start;
    gap: 0.35rem;
    font-size: 0.72rem;
    color: #64748b;
    line-height: 1.35;
  }

  :global(.ico-info) {
    color: #64748b;
    flex-shrink: 0;
    margin-top: 1px;
  }

  /* Notes field */
  .notes-field-group {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
  }

  .notes-label {
    display: flex;
    align-items: center;
    justify-content: space-between;
    font-size: 0.75rem;
    color: #94a3b8;
  }

  .char-count {
    font-size: 0.7rem;
    color: #64748b;
  }

  .notes-textarea {
    width: 100%;
    background: rgba(15, 23, 42, 0.6);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 0.6rem;
    padding: 0.6rem 0.75rem;
    font-size: 0.82rem;
    color: #f1f5f9;
    resize: none;
    box-sizing: border-box;
    font-family: inherit;
    transition: border-color 0.15s ease;
  }

  .notes-textarea:focus {
    outline: none;
    border-color: #8b5cf6;
    box-shadow: 0 0 0 2px rgba(139, 92, 246, 0.2);
  }

  /* Actions Footer */
  .modal-actions-footer {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 0.75rem;
    padding-top: 0.5rem;
    border-top: 1px solid rgba(255, 255, 255, 0.06);
  }

  .btn-cancel {
    background: transparent;
    border: 1px solid rgba(255, 255, 255, 0.12);
    color: #94a3b8;
    padding: 0.6rem 1rem;
    border-radius: 0.6rem;
    font-size: 0.82rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .btn-cancel:hover:not(:disabled) {
    background: rgba(255, 255, 255, 0.06);
    color: #f1f5f9;
  }

  .btn-confirm {
    background: linear-gradient(135deg, #8b5cf6, #7c3aed);
    border: none;
    color: #fff;
    padding: 0.6rem 1.15rem;
    border-radius: 0.6rem;
    font-size: 0.82rem;
    font-weight: 700;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    gap: 0.45rem;
    box-shadow: 0 4px 15px rgba(139, 92, 246, 0.35);
    transition: all 0.15s ease;
  }

  .btn-confirm:hover:not(:disabled) {
    transform: translateY(-1px);
    box-shadow: 0 6px 20px rgba(139, 92, 246, 0.45);
    filter: brightness(1.05);
  }

  .btn-confirm:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    transform: none;
  }

  .spinner {
    width: 14px;
    height: 14px;
    border: 2px solid rgba(255, 255, 255, 0.3);
    border-top-color: #fff;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  @media (max-width: 480px) {
    .modal-backdrop {
      padding: 0.75rem 0.6rem;
    }
    .modal-card {
      border-radius: 1rem;
      max-width: 100%;
      margin: auto 0;
    }
    .modal-header {
      padding: 0.85rem 1rem 0.75rem;
    }
    .icon-orb {
      width: 36px;
      height: 36px;
    }
    .modal-title {
      font-size: 0.95rem;
    }
    .stage-context-box {
      padding: 0.65rem 0.85rem;
      gap: 0.75rem;
    }
    .work-cover-wrapper {
      width: 40px;
      height: 54px;
    }
    .stage-work-title {
      font-size: 0.88rem;
    }
    .claim-form-body {
      padding: 0.85rem;
      gap: 0.7rem;
    }
    .calendar-picker-wrapper {
      padding: 0.65rem;
      gap: 0.45rem;
    }
    .grid-day-cell {
      min-height: 34px;
      font-size: 0.78rem;
    }
    .deadline-summary-box {
      padding: 0.55rem 0.75rem;
    }
    .modal-actions-footer {
      flex-direction: row;
      gap: 0.5rem;
      padding-top: 0.5rem;
    }
    .btn-cancel {
      flex: 1;
      padding: 0.65rem 0.75rem;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      text-align: center;
    }
    .btn-confirm {
      flex: 2;
      padding: 0.65rem 0.75rem;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      text-align: center;
    }
  }
</style>
