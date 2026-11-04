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

  // Canonical Stage Names & Colors helper (Guarantees NEVER "Etapa Editorial")
  function getCanonicalStageName(stage: any): string {
    const slug = (stage?.slug || '').toLowerCase().trim();
    const name = (stage?.name || '').trim();
    if (slug === 'traducao' || slug === 'translation' || name.toLowerCase().includes('tradu')) return 'Tradução';
    if (slug === 'clean_redraw' || slug === 'clean' || slug === 'redraw' || name.toLowerCase().includes('clean')) return 'Clean/Redraw';
    if (slug === 'typeset' || slug === 'typer' || name.toLowerCase().includes('type')) return 'Typeset';
    if (slug === 'revisor_qc' || slug === 'qc' || slug === 'revisao' || name.toLowerCase().includes('qc') || name.toLowerCase().includes('revis')) return 'Revisor (QC)';
    if (name && name !== 'Etapa Editorial') return name;
    return 'Tradução';
  }

  function getCanonicalStageColor(stage: any): string {
    const slug = (stage?.slug || '').toLowerCase().trim();
    if (slug === 'traducao' || slug === 'translation') return '#38bdf8';
    if (slug === 'clean_redraw' || slug === 'clean') return '#34d399';
    if (slug === 'typeset' || slug === 'typer') return '#f59e0b';
    if (slug === 'revisor_qc' || slug === 'qc' || slug === 'revisao') return '#a855f7';
    return stage?.color || '#8b5cf6';
  }

  let stageDisplayName = $derived(getCanonicalStageName(stageItem?.stage));
  let stageDisplayColor = $derived(getCanonicalStageColor(stageItem?.stage));

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

  // Days matrix for the calendar month: dynamic number of weeks (4, 5, or 6 only if needed)
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

    // Trailing days from next month to complete the last week (multiple of 7)
    const remainder = cells.length % 7;
    if (remainder > 0) {
      const trailingCount = 7 - remainder;
      for (let day = 1; day <= trailingCount; day++) {
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
    const formatted = dateObj.toLocaleDateString('pt-BR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
    return formatted.charAt(0).toUpperCase() + formatted.slice(1);
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
      <!-- Modal Header (Compact & Welcoming) -->
      <header class="modal-header">
        <div class="header-title-row">
          <div class="icon-orb purple">
            <CalendarIcon size={18} />
          </div>
          <div class="header-text-cluster">
            <h2 id="claim-modal-title" class="modal-title">Quando você pretende entregar esta etapa?</h2>
            <p class="modal-subtitle">
              Escolha a data em que pretende concluir seu trabalho. Você tem até 3 dias corridos para realizar a entrega.
            </p>
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

      <!-- Assignment Summary Card (Specific stage name, real avatar, matched chapter) -->
      <section class="assignment-summary-card">
        <div class="work-cover-wrapper">
          {#if stageItem.chapter?.work?.cover_id}
            <img
              src="/media/{stageItem.chapter.work.cover_id}"
              alt={stageItem.chapter?.work?.title || 'Capa'}
              class="work-cover-thumb"
              loading="lazy"
            />
          {:else}
            <div class="work-cover-fallback">
              <Briefcase size={20} />
            </div>
          {/if}
        </div>

        <div class="assignment-meta-details">
          <span class="assignment-work-title" title={stageItem.chapter?.work?.title || 'Obra'}>
            {stageItem.chapter?.work?.title || 'Obra sem título'}
          </span>
          <div class="assignment-pills-row">
            <span class="chapter-number-pill">
              Capítulo #{stageItem.chapter?.chapter_number || '1'}
            </span>
            <span class="stage-tag-pill" style="--stage-c: {stageDisplayColor}">
              <span class="stage-dot"></span>
              {stageDisplayName}
            </span>
          </div>
          <div class="assignee-row">
            <span class="assignee-label">Responsável:</span>
            <div class="user-chip">
              <UserAvatar user={currentUser} size={18} />
              <span class="user-chip-name">{currentUser?.display_name || currentUser?.username || 'Você'}</span>
            </div>
          </div>
        </div>
      </section>

      <!-- Form Body with Compact Scrollable Area & Pinned Footer -->
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

        <div class="claim-form-scrollable">
          {#if errorMessage}
            <div class="alert-banner error" role="alert">
              <AlertCircle size={14} />
              <span>{errorMessage}</span>
            </div>
          {/if}

          <!-- Compact Calendar Component -->
          <div class="compact-calendar-wrapper">
            <div class="calendar-nav-header">
              <span class="calendar-month-heading">{MONTH_NAMES[viewMonth]} {viewYear}</span>
              <div class="calendar-arrows">
                <button
                  type="button"
                  class="btn-cal-arrow"
                  onclick={prevMonth}
                  aria-label="Mês anterior"
                  disabled={isSubmitting || !canPrevMonth}
                >
                  <ChevronLeft size={14} />
                </button>
                <button
                  type="button"
                  class="btn-cal-arrow"
                  onclick={nextMonth}
                  aria-label="Próximo mês"
                  disabled={isSubmitting || !canNextMonth}
                >
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>

            <!-- Weekday Headers -->
            <div class="cal-weekdays-row">
              {#each WEEK_DAYS as wd}
                <span class="cal-weekday-lbl">{wd}</span>
              {/each}
            </div>

            <!-- Compact Days Grid -->
            <div class="cal-days-grid">
              {#each monthCells as cell}
                <button
                  type="button"
                  class="cal-day-cell"
                  class:is-other-month={!cell.isCurrentMonth}
                  class:is-today={cell.isToday}
                  class:is-selected={cell.isSelected}
                  class:is-allowed={cell.isAllowed}
                  class:is-blocked={!cell.isAllowed}
                  disabled={!cell.isAllowed || isSubmitting}
                  onclick={() => selectDate(cell.ymd, cell.isAllowed)}
                  title={cell.isAllowed ? `Definir entrega para ${cell.ymd}` : 'Fora do limite de 3 dias corridos'}
                >
                  <span class="cell-day-text">{cell.day}</span>
                  {#if cell.isToday && !cell.isSelected}
                    <span class="cell-today-pip"></span>
                  {/if}
                  {#if cell.isSelected}
                    <span class="cell-selected-check">
                      <Check size={9} />
                    </span>
                  {/if}
                </button>
              {/each}
            </div>
          </div>

          <!-- Selected Deadline Summary Box (Refined & Compact) -->
          <div class="chosen-date-card">
            <div class="chosen-date-row">
              <div class="chosen-date-icon">
                <Clock size={14} />
              </div>
              <div class="chosen-date-info">
                <span class="chosen-date-prefix">Entrega prevista para</span>
                <strong class="chosen-date-highlight">{formattedSelected}</strong>
                <span class="chosen-date-time">Até 23h59 • Horário de Brasília</span>
              </div>
            </div>
            <div class="extension-micro-hint">
              <Info size={11} class="hint-icon" />
              <span>Prorrogação de +2 dias disponível nas últimas 24h caso precise de mais tempo.</span>
            </div>
          </div>

          <!-- Optional Planning Notes (Compact) -->
          <div class="notes-field-group">
            <div class="notes-header-row">
              <label for="claim-notes-input" class="notes-label">Observações (opcional)</label>
              <span class="notes-char-count">{notes.length}/500</span>
            </div>
            <textarea
              id="claim-notes-input"
              name="notes"
              bind:value={notes}
              maxlength="500"
              rows="2"
              placeholder="Ex.: Tradução em andamento; revisarei diálogos no sábado."
              class="notes-textarea"
              disabled={isSubmitting}
            ></textarea>
          </div>
        </div>

        <!-- Pinned Actions Footer: Both buttons always visible and accessible -->
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
            class="btn-confirm-claim"
            disabled={!selectedYMD || isSubmitting}
          >
            {#if isSubmitting}
              <span class="submit-spinner"></span>
              <span>Confirmando...</span>
            {:else}
              <Check size={15} />
              <span>Confirmar e assumir etapa</span>
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
    background: rgba(4, 7, 18, 0.82);
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: max(0.75rem, env(safe-area-inset-top, 0.75rem)) 0.75rem max(0.75rem, env(safe-area-inset-bottom, 0.75rem));
    overflow-y: auto;
    -webkit-overflow-scrolling: touch;
  }

  .modal-card {
    background: #090d16;
    border: 1px solid rgba(139, 92, 246, 0.28);
    border-radius: 1.15rem;
    box-shadow: 0 25px 60px rgba(0, 0, 0, 0.75), 0 0 35px rgba(139, 92, 246, 0.12);
    width: 100%;
    max-width: 460px;
    max-height: min(92vh, 660px);
    margin: auto 0;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    animation: modalPopIn 0.2s cubic-bezier(0.16, 1, 0.3, 1);
  }

  @keyframes modalPopIn {
    from {
      opacity: 0;
      transform: scale(0.97) translateY(6px);
    }
    to {
      opacity: 1;
      transform: scale(1) translateY(0);
    }
  }

  .modal-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    padding: 0.85rem 1.15rem 0.75rem;
    border-bottom: 1px solid rgba(255, 255, 255, 0.07);
    gap: 0.75rem;
    flex-shrink: 0;
  }

  .header-title-row {
    display: flex;
    align-items: flex-start;
    gap: 0.75rem;
  }

  .icon-orb {
    width: 36px;
    height: 36px;
    border-radius: 0.65rem;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(139, 92, 246, 0.16);
    color: #c084fc;
    border: 1px solid rgba(139, 92, 246, 0.35);
    flex-shrink: 0;
    margin-top: 0.1rem;
  }

  .header-text-cluster {
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
  }

  .modal-title {
    font-size: 1rem;
    font-weight: 700;
    color: #f8fafc;
    margin: 0;
    line-height: 1.3;
    letter-spacing: -0.01em;
  }

  .modal-subtitle {
    font-size: 0.78rem;
    color: #94a3b8;
    margin: 0;
    line-height: 1.35;
  }

  .btn-close-modal {
    background: transparent;
    border: none;
    color: #64748b;
    cursor: pointer;
    padding: 0.4rem;
    border-radius: 0.45rem;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.15s ease;
    flex-shrink: 0;
  }

  .btn-close-modal:hover:not(:disabled) {
    background: rgba(255, 255, 255, 0.08);
    color: #f1f5f9;
  }

  /* Assignment Summary Card */
  .assignment-summary-card {
    display: flex;
    align-items: center;
    gap: 0.85rem;
    padding: 0.75rem 1.15rem;
    background: rgba(15, 23, 42, 0.65);
    border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  }

  .work-cover-wrapper {
    width: 42px;
    height: 56px;
    border-radius: 0.45rem;
    overflow: hidden;
    background: #1e293b;
    flex-shrink: 0;
    border: 1px solid rgba(255, 255, 255, 0.1);
  }

  .work-cover-thumb {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }

  .work-cover-fallback {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #64748b;
  }

  .assignment-meta-details {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    min-width: 0;
    flex: 1;
  }

  .assignment-work-title {
    font-size: 0.925rem;
    font-weight: 700;
    color: #f1f5f9;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    line-height: 1.2;
  }

  .assignment-pills-row {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    flex-wrap: wrap;
  }

  .chapter-number-pill {
    font-size: 0.72rem;
    font-weight: 600;
    background: rgba(255, 255, 255, 0.08);
    color: #e2e8f0;
    padding: 0.12rem 0.45rem;
    border-radius: 0.35rem;
    border: 1px solid rgba(255, 255, 255, 0.06);
  }

  .stage-tag-pill {
    font-size: 0.72rem;
    font-weight: 600;
    background: color-mix(in srgb, var(--stage-c, #a855f7) 16%, transparent);
    color: var(--stage-c, #a855f7);
    border: 1px solid color-mix(in srgb, var(--stage-c, #a855f7) 38%, transparent);
    padding: 0.12rem 0.45rem;
    border-radius: 0.35rem;
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
  }

  .stage-tag-pill .stage-dot {
    width: 5px;
    height: 5px;
    border-radius: 50%;
    background: currentColor;
  }

  .assignee-row {
    display: flex;
    align-items: center;
    gap: 0.35rem;
    font-size: 0.73rem;
    color: #94a3b8;
  }

  .user-chip {
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
    color: #e2e8f0;
    font-weight: 500;
  }

  .user-chip-name {
    font-size: 0.75rem;
  }

  .claim-form-body {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-height: 0;
    padding: 0;
    overflow: hidden;
  }

  .claim-form-scrollable {
    flex: 1;
    overflow-y: auto;
    -webkit-overflow-scrolling: touch;
    padding: 0.75rem 1.15rem 0.5rem;
    display: flex;
    flex-direction: column;
    gap: 0.65rem;
  }

  .alert-banner.error {
    background: rgba(239, 68, 68, 0.16);
    border: 1px solid rgba(239, 68, 68, 0.4);
    color: #fca5a5;
    padding: 0.55rem 0.75rem;
    border-radius: 0.45rem;
    font-size: 0.78rem;
    display: flex;
    align-items: center;
    gap: 0.45rem;
  }

  /* Compact Calendar Component */
  .compact-calendar-wrapper {
    background: rgba(15, 23, 42, 0.75);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 0.75rem;
    padding: 0.65rem 0.75rem;
    display: flex;
    flex-direction: column;
    gap: 0.45rem;
  }

  .calendar-nav-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .calendar-month-heading {
    font-size: 0.84rem;
    font-weight: 700;
    color: #f1f5f9;
    letter-spacing: -0.01em;
  }

  .calendar-arrows {
    display: flex;
    align-items: center;
    gap: 0.25rem;
  }

  .btn-cal-arrow {
    background: rgba(255, 255, 255, 0.06);
    border: 1px solid rgba(255, 255, 255, 0.09);
    color: #cbd5e1;
    width: 26px;
    height: 26px;
    border-radius: 0.35rem;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .btn-cal-arrow:hover:not(:disabled) {
    background: rgba(255, 255, 255, 0.14);
    color: #fff;
  }

  .btn-cal-arrow:disabled {
    opacity: 0.25;
    cursor: not-allowed;
  }

  .cal-weekdays-row {
    display: grid;
    grid-template-columns: repeat(7, 1fr);
    text-align: center;
    font-size: 0.68rem;
    font-weight: 600;
    color: #64748b;
    padding-bottom: 0.1rem;
  }

  .cal-days-grid {
    display: grid;
    grid-template-columns: repeat(7, 1fr);
    gap: 0.25rem;
  }

  .cal-day-cell {
    position: relative;
    height: 36px;
    border-radius: 0.45rem;
    border: 1px solid transparent;
    background: rgba(255, 255, 255, 0.02);
    color: #475569;
    font-size: 0.8rem;
    font-weight: 600;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: not-allowed;
    transition: all 0.15s cubic-bezier(0.16, 1, 0.3, 1);
    padding: 0;
  }

  .cal-day-cell.is-other-month {
    opacity: 0.25;
  }

  .cal-day-cell.is-blocked {
    opacity: 0.35;
  }

  .cal-day-cell.is-allowed {
    background: rgba(139, 92, 246, 0.08);
    border-color: rgba(139, 92, 246, 0.25);
    color: #f1f5f9;
    cursor: pointer;
  }

  .cal-day-cell.is-allowed:hover:not(.is-selected) {
    background: rgba(139, 92, 246, 0.22);
    border-color: rgba(139, 92, 246, 0.5);
    color: #fff;
    transform: translateY(-1px);
  }

  .cal-day-cell.is-today:not(.is-selected) {
    border-color: rgba(6, 182, 212, 0.45);
    color: #38bdf8;
  }

  .cell-today-pip {
    position: absolute;
    bottom: 3px;
    width: 4px;
    height: 4px;
    border-radius: 50%;
    background: #38bdf8;
  }

  .cal-day-cell.is-selected {
    background: #7c3aed !important;
    border-color: #a855f7 !important;
    color: #ffffff !important;
    box-shadow: 0 0 14px rgba(124, 58, 237, 0.55);
    font-weight: 700;
  }

  .cell-selected-check {
    position: absolute;
    top: 2px;
    right: 2px;
    color: #ffffff;
    opacity: 0.9;
  }

  /* Chosen Date Summary Card */
  .chosen-date-card {
    background: rgba(139, 92, 246, 0.08);
    border: 1px solid rgba(139, 92, 246, 0.25);
    border-radius: 0.65rem;
    padding: 0.6rem 0.8rem;
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
  }

  .chosen-date-row {
    display: flex;
    align-items: center;
    gap: 0.65rem;
  }

  .chosen-date-icon {
    width: 28px;
    height: 28px;
    border-radius: 0.5rem;
    background: rgba(139, 92, 246, 0.2);
    color: #c084fc;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .chosen-date-info {
    display: flex;
    flex-direction: column;
    gap: 0.12rem;
    min-width: 0;
  }

  .chosen-date-prefix {
    font-size: 0.68rem;
    color: #94a3b8;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    font-weight: 600;
  }

  .chosen-date-highlight {
    font-size: 0.85rem;
    font-weight: 700;
    color: #f1f5f9;
    letter-spacing: -0.01em;
  }

  .chosen-date-time {
    font-size: 0.71rem;
    color: #38bdf8;
    font-weight: 500;
  }

  .extension-micro-hint {
    display: flex;
    align-items: flex-start;
    gap: 0.35rem;
    font-size: 0.69rem;
    color: #94a3b8;
    line-height: 1.3;
    border-top: 1px solid rgba(255, 255, 255, 0.06);
    padding-top: 0.35rem;
  }

  .hint-icon {
    flex-shrink: 0;
    margin-top: 0.1rem;
    color: #8b5cf6;
  }

  /* Notes Field */
  .notes-field-group {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .notes-header-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .notes-label {
    font-size: 0.72rem;
    font-weight: 600;
    color: #94a3b8;
  }

  .notes-char-count {
    font-size: 0.68rem;
    color: #64748b;
  }

  .notes-textarea {
    width: 100%;
    background: rgba(15, 23, 42, 0.7);
    border: 1px solid rgba(255, 255, 255, 0.09);
    border-radius: 0.5rem;
    padding: 0.4rem 0.6rem;
    color: #f1f5f9;
    font-size: 0.78rem;
    line-height: 1.35;
    resize: none;
    outline: none;
    transition: all 0.15s ease;
  }

  .notes-textarea:focus {
    border-color: rgba(139, 92, 246, 0.5);
    background: rgba(15, 23, 42, 0.95);
    box-shadow: 0 0 0 2px rgba(139, 92, 246, 0.15);
  }

  .notes-textarea::placeholder {
    color: #64748b;
    font-size: 0.76rem;
  }

  /* Actions Footer - Pinned and Always In View */
  .modal-actions-footer {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 0.6rem;
    padding: 0.7rem 1.15rem;
    background: #090d16;
    border-top: 1px solid rgba(255, 255, 255, 0.08);
    flex-shrink: 0;
  }

  .btn-cancel {
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.09);
    color: #cbd5e1;
    font-size: 0.8rem;
    font-weight: 600;
    padding: 0.5rem 0.9rem;
    border-radius: 0.5rem;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .btn-cancel:hover:not(:disabled) {
    background: rgba(255, 255, 255, 0.1);
    color: #fff;
  }

  .btn-confirm-claim {
    background: linear-gradient(135deg, #7c3aed 0%, #6366f1 100%);
    border: 1px solid rgba(139, 92, 246, 0.4);
    color: #fff;
    font-size: 0.8rem;
    font-weight: 700;
    padding: 0.5rem 1.1rem;
    border-radius: 0.5rem;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    gap: 0.45rem;
    box-shadow: 0 4px 15px rgba(124, 58, 237, 0.35);
    transition: all 0.15s cubic-bezier(0.16, 1, 0.3, 1);
  }

  .btn-confirm-claim:hover:not(:disabled) {
    transform: translateY(-1px);
    box-shadow: 0 6px 20px rgba(124, 58, 237, 0.5);
  }

  .btn-confirm-claim:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    transform: none;
    box-shadow: none;
  }

  .submit-spinner {
    width: 13px;
    height: 13px;
    border: 2px solid rgba(255, 255, 255, 0.3);
    border-top-color: #fff;
    border-radius: 50%;
    animation: spin 0.6s linear infinite;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  @media (max-width: 480px) {
    .modal-card {
      max-height: calc(100dvh - 1.5rem);
      margin: auto 0;
    }

    .modal-header {
      padding: 0.75rem 0.9rem 0.65rem;
    }

    .assignment-summary-card {
      padding: 0.55rem 0.9rem;
    }

    .claim-form-scrollable {
      padding: 0.65rem 0.9rem 0.4rem;
      gap: 0.55rem;
    }

    .cal-day-cell {
      height: 32px;
      font-size: 0.76rem;
    }

    /* Footer on mobile: side-by-side so both buttons are immediately accessible without scrolling */
    .modal-actions-footer {
      flex-direction: row;
      justify-content: space-between;
      gap: 0.5rem;
      padding: 0.6rem 0.9rem max(0.6rem, env(safe-area-inset-bottom, 0.6rem));
    }

    .btn-cancel {
      flex: 0 0 auto;
      min-width: 85px;
      padding: 0.55rem 0.8rem;
      text-align: center;
    }

    .btn-confirm-claim {
      flex: 1 1 auto;
      justify-content: center;
      padding: 0.55rem 0.9rem;
    }
  }
</style>
