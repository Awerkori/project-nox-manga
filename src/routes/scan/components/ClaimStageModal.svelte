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

  // Canonical Stage Names & Colors helper
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

  // Month navigation boundary checks
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

    // Trailing days from next month to complete the last week
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

  // Format selected date for display
  let formattedSelected = $derived.by(() => {
    if (!selectedYMD) return '';
    const [y, m, d] = selectedYMD.split('-').map(Number);
    const dateObj = new Date(y, m - 1, d);
    const formatted = dateObj.toLocaleDateString('pt-BR', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
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
      <!-- 1. MODAL HEADER (Compact & Short) -->
      <header class="modal-header">
        <div class="header-left">
          <div class="icon-orb purple">
            <CalendarIcon size={16} />
          </div>
          <div class="header-titles">
            <h2 id="claim-modal-title" class="modal-title">Assumir Etapa</h2>
            <p class="modal-subtitle">Defina o prazo de entrega (até 3 dias corridos).</p>
          </div>
        </div>
        <button
          type="button"
          class="btn-close-modal"
          onclick={onClose}
          disabled={isSubmitting}
          aria-label="Fechar"
        >
          <X size={16} />
        </button>
      </header>

      <!-- 2. COMPACT ASSIGNMENT BANNER -->
      <section class="assignment-compact-strip">
        <div class="work-thumb-box">
          {#if stageItem.chapter?.work?.cover_id}
            <img
              src="/media/{stageItem.chapter.work.cover_id}"
              alt={stageItem.chapter?.work?.title || 'Capa'}
              class="work-thumb-img"
              loading="lazy"
            />
          {:else}
            <div class="work-thumb-fallback">
              <Briefcase size={14} />
            </div>
          {/if}
        </div>

        <div class="assignment-meta-col">
          <div class="work-and-ch-row">
            <span class="assignment-work-name" title={stageItem.chapter?.work?.title || 'Obra'}>
              {stageItem.chapter?.work?.title || 'Obra'}
            </span>
            <span class="ch-badge">#{stageItem.chapter?.chapter_number || '1'}</span>
          </div>
          <div class="tags-row">
            <span class="stage-tag" style="--stage-c: {stageDisplayColor}">
              <span class="st-dot"></span>
              {stageDisplayName}
            </span>
            <span class="assignee-text">
              Por: <strong>{currentUser?.display_name || currentUser?.username || 'Você'}</strong>
            </span>
          </div>
        </div>
      </section>

      <!-- 3. FORM BODY -->
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
        class="claim-form-layout"
      >
        <input type="hidden" name="chapter_stage_id" value={stageItem.id} />
        <input type="hidden" name="due_date" value={selectedYMD} />

        <div class="claim-form-scrollable">
          {#if errorMessage}
            <div class="alert-banner error" role="alert">
              <AlertCircle size={13} />
              <span>{errorMessage}</span>
            </div>
          {/if}

          <!-- MINI CALENDAR COMPONENT -->
          <div class="mini-calendar-box">
            <div class="cal-header">
              <span class="cal-month-title">{MONTH_NAMES[viewMonth]} {viewYear}</span>
              <div class="cal-nav-buttons">
                <button
                  type="button"
                  class="btn-cal-step"
                  onclick={prevMonth}
                  aria-label="Mês anterior"
                  disabled={isSubmitting || !canPrevMonth}
                >
                  <ChevronLeft size={13} />
                </button>
                <button
                  type="button"
                  class="btn-cal-step"
                  onclick={nextMonth}
                  aria-label="Próximo mês"
                  disabled={isSubmitting || !canNextMonth}
                >
                  <ChevronRight size={13} />
                </button>
              </div>
            </div>

            <!-- Weekdays -->
            <div class="cal-week-row">
              {#each WEEK_DAYS as wd}
                <span class="cal-wd-cell">{wd}</span>
              {/each}
            </div>

            <!-- Days Grid -->
            <div class="cal-grid">
              {#each monthCells as cell}
                <button
                  type="button"
                  class="cal-day-btn"
                  class:is-other={!cell.isCurrentMonth}
                  class:is-today={cell.isToday}
                  class:is-selected={cell.isSelected}
                  class:is-allowed={cell.isAllowed}
                  class:is-blocked={!cell.isAllowed}
                  disabled={!cell.isAllowed || isSubmitting}
                  onclick={() => selectDate(cell.ymd, cell.isAllowed)}
                  title={cell.isAllowed ? `Definir entrega para ${cell.ymd}` : 'Fora do limite de 3 dias'}
                >
                  <span class="day-num-txt">{cell.day}</span>
                  {#if cell.isSelected}
                    <span class="selected-check-dot"><Check size={8} /></span>
                  {:else if cell.isToday}
                    <span class="today-pip"></span>
                  {/if}
                </button>
              {/each}
            </div>
          </div>

          <!-- SUMMARY LINE: SELECTED DATE -->
          <div class="selected-summary-card">
            <div class="summary-line-left">
              <Clock size={14} class="text-purple-400" />
              <div class="summary-text-block">
                <span class="summary-sub-txt">Entrega prevista:</span>
                <strong class="summary-val-txt">{formattedSelected} às 23:59</strong>
              </div>
            </div>
            <div class="summary-hint-line">
              <Info size={11} class="text-cyan-400" />
              <span>Prorrogação (+2d) disponível nas últimas 24h</span>
            </div>
          </div>

          <!-- OPTIONAL NOTES -->
          <div class="notes-block">
            <div class="notes-label-bar">
              <label for="claim-notes" class="notes-lbl">Observações (opcional)</label>
              <span class="notes-counter">{notes.length}/500</span>
            </div>
            <textarea
              id="claim-notes"
              name="notes"
              bind:value={notes}
              maxlength="500"
              rows="2"
              placeholder="Ex.: Tradução em andamento; revisarei no sábado."
              class="notes-input"
              disabled={isSubmitting}
            ></textarea>
          </div>
        </div>

        <!-- 4. PINNED FOOTER (Always visible without awkward scrolling) -->
        <footer class="modal-footer-pinned">
          <button
            type="button"
            class="btn-cancel-claim"
            onclick={onClose}
            disabled={isSubmitting}
          >
            Cancelar
          </button>
          <button
            type="submit"
            class="btn-confirm-stage"
            disabled={!selectedYMD || isSubmitting}
          >
            {#if isSubmitting}
              <span class="btn-spinner"></span>
              <span>Confirmando...</span>
            {:else}
              <Check size={14} />
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
    padding: max(0.5rem, env(safe-area-inset-top, 0.5rem)) 0.5rem max(0.5rem, env(safe-area-inset-bottom, 0.5rem));
    overflow-y: auto;
    -webkit-overflow-scrolling: touch;
  }

  .modal-card {
    background: #090d16;
    border: 1px solid rgba(139, 92, 246, 0.3);
    border-radius: 1rem;
    box-shadow: 0 20px 50px rgba(0, 0, 0, 0.8), 0 0 30px rgba(139, 92, 246, 0.12);
    width: 100%;
    max-width: 420px;
    max-height: min(92vh, 560px);
    margin: auto 0;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    animation: modalPop 0.18s cubic-bezier(0.16, 1, 0.3, 1);
  }

  @keyframes modalPop {
    from {
      opacity: 0;
      transform: scale(0.97) translateY(4px);
    }
    to {
      opacity: 1;
      transform: scale(1) translateY(0);
    }
  }

  /* Header */
  .modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.75rem 1rem 0.65rem;
    border-bottom: 1px solid rgba(255, 255, 255, 0.07);
    flex-shrink: 0;
    gap: 0.5rem;
  }

  .header-left {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    min-width: 0;
  }

  .icon-orb {
    width: 30px;
    height: 30px;
    border-radius: 0.55rem;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(139, 92, 246, 0.16);
    color: #c084fc;
    border: 1px solid rgba(139, 92, 246, 0.35);
    flex-shrink: 0;
  }

  .header-titles {
    display: flex;
    flex-direction: column;
    gap: 0.05rem;
    min-width: 0;
  }

  .modal-title {
    font-size: 0.95rem;
    font-weight: 700;
    color: #f8fafc;
    margin: 0;
    line-height: 1.2;
    letter-spacing: -0.01em;
  }

  .modal-subtitle {
    font-size: 0.72rem;
    color: #94a3b8;
    margin: 0;
    line-height: 1.2;
  }

  .btn-close-modal {
    background: transparent;
    border: none;
    color: #64748b;
    cursor: pointer;
    padding: 0.35rem;
    border-radius: 0.4rem;
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

  /* Compact Assignment Strip */
  .assignment-compact-strip {
    display: flex;
    align-items: center;
    gap: 0.65rem;
    padding: 0.5rem 1rem;
    background: rgba(15, 23, 42, 0.7);
    border-bottom: 1px solid rgba(255, 255, 255, 0.06);
    flex-shrink: 0;
  }

  .work-thumb-box {
    width: 32px;
    height: 42px;
    border-radius: 0.35rem;
    overflow: hidden;
    background: #1e293b;
    flex-shrink: 0;
    border: 1px solid rgba(255, 255, 255, 0.08);
  }

  .work-thumb-img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }

  .work-thumb-fallback {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #64748b;
  }

  .assignment-meta-col {
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
    min-width: 0;
    flex: 1;
  }

  .work-and-ch-row {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    min-width: 0;
  }

  .assignment-work-name {
    font-size: 0.84rem;
    font-weight: 700;
    color: #f1f5f9;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    line-height: 1.2;
  }

  .ch-badge {
    font-size: 0.68rem;
    font-weight: 700;
    background: rgba(255, 255, 255, 0.08);
    color: #cbd5e1;
    padding: 0.05rem 0.3rem;
    border-radius: 0.25rem;
    flex-shrink: 0;
  }

  .tags-row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex-wrap: wrap;
  }

  .stage-tag {
    font-size: 0.68rem;
    font-weight: 600;
    background: color-mix(in srgb, var(--stage-c, #a855f7) 16%, transparent);
    color: var(--stage-c, #a855f7);
    border: 1px solid color-mix(in srgb, var(--stage-c, #a855f7) 35%, transparent);
    padding: 0.06rem 0.4rem;
    border-radius: 0.3rem;
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
  }

  .stage-tag .st-dot {
    width: 4px;
    height: 4px;
    border-radius: 50%;
    background: currentColor;
  }

  .assignee-text {
    font-size: 0.68rem;
    color: #94a3b8;
  }

  .assignee-text strong {
    color: #e2e8f0;
  }

  /* Form Layout */
  .claim-form-layout {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-height: 0;
    overflow: hidden;
  }

  .claim-form-scrollable {
    flex: 1;
    overflow-y: auto;
    -webkit-overflow-scrolling: touch;
    padding: 0.65rem 1rem 0.4rem;
    display: flex;
    flex-direction: column;
    gap: 0.55rem;
  }

  .alert-banner.error {
    background: rgba(239, 68, 68, 0.16);
    border: 1px solid rgba(239, 68, 68, 0.4);
    color: #fca5a5;
    padding: 0.45rem 0.65rem;
    border-radius: 0.4rem;
    font-size: 0.74rem;
    display: flex;
    align-items: center;
    gap: 0.4rem;
  }

  /* Mini Calendar */
  .mini-calendar-box {
    background: rgba(15, 23, 42, 0.8);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 0.65rem;
    padding: 0.5rem 0.65rem;
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
  }

  .cal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .cal-month-title {
    font-size: 0.8rem;
    font-weight: 700;
    color: #f1f5f9;
  }

  .cal-nav-buttons {
    display: flex;
    align-items: center;
    gap: 0.2rem;
  }

  .btn-cal-step {
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.08);
    color: #cbd5e1;
    width: 24px;
    height: 24px;
    border-radius: 0.3rem;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .btn-cal-step:hover:not(:disabled) {
    background: rgba(255, 255, 255, 0.12);
    color: #fff;
  }

  .btn-cal-step:disabled {
    opacity: 0.2;
    cursor: not-allowed;
  }

  .cal-week-row {
    display: grid;
    grid-template-columns: repeat(7, 1fr);
    text-align: center;
    font-size: 0.64rem;
    font-weight: 600;
    color: #64748b;
    padding-bottom: 0.05rem;
  }

  .cal-grid {
    display: grid;
    grid-template-columns: repeat(7, 1fr);
    gap: 0.18rem;
  }

  .cal-day-btn {
    position: relative;
    height: 30px;
    border-radius: 0.35rem;
    border: 1px solid transparent;
    background: rgba(255, 255, 255, 0.02);
    color: #475569;
    font-size: 0.74rem;
    font-weight: 600;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: not-allowed;
    transition: all 0.12s ease;
    padding: 0;
  }

  .cal-day-btn.is-other {
    opacity: 0.2;
  }

  .cal-day-btn.is-blocked {
    opacity: 0.25;
  }

  .cal-day-btn.is-allowed {
    background: rgba(139, 92, 246, 0.08);
    border-color: rgba(139, 92, 246, 0.25);
    color: #f1f5f9;
    cursor: pointer;
  }

  .cal-day-btn.is-allowed:hover:not(.is-selected) {
    background: rgba(139, 92, 246, 0.22);
    border-color: rgba(139, 92, 246, 0.5);
    color: #fff;
  }

  .cal-day-btn.is-today:not(.is-selected) {
    border-color: rgba(6, 182, 212, 0.45);
    color: #38bdf8;
  }

  .today-pip {
    position: absolute;
    bottom: 2px;
    width: 3px;
    height: 3px;
    border-radius: 50%;
    background: #38bdf8;
  }

  .cal-day-btn.is-selected {
    background: #7c3aed !important;
    border-color: #a855f7 !important;
    color: #ffffff !important;
    font-weight: 700;
    box-shadow: 0 0 10px rgba(124, 58, 237, 0.5);
  }

  .selected-check-dot {
    position: absolute;
    top: 1px;
    right: 1px;
    color: #fff;
    opacity: 0.9;
  }

  /* Summary Card */
  .selected-summary-card {
    background: rgba(139, 92, 246, 0.08);
    border: 1px solid rgba(139, 92, 246, 0.25);
    border-radius: 0.55rem;
    padding: 0.45rem 0.65rem;
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .summary-line-left {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .summary-text-block {
    display: flex;
    align-items: baseline;
    gap: 0.35rem;
    flex-wrap: wrap;
  }

  .summary-sub-txt {
    font-size: 0.68rem;
    color: #94a3b8;
  }

  .summary-val-txt {
    font-size: 0.78rem;
    font-weight: 700;
    color: #38bdf8;
  }

  .summary-hint-line {
    display: flex;
    align-items: center;
    gap: 0.3rem;
    font-size: 0.65rem;
    color: #94a3b8;
    border-top: 1px solid rgba(255, 255, 255, 0.06);
    padding-top: 0.25rem;
  }

  /* Notes */
  .notes-block {
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
  }

  .notes-label-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .notes-lbl {
    font-size: 0.68rem;
    font-weight: 600;
    color: #94a3b8;
  }

  .notes-counter {
    font-size: 0.64rem;
    color: #64748b;
  }

  .notes-input {
    width: 100%;
    background: rgba(15, 23, 42, 0.7);
    border: 1px solid rgba(255, 255, 255, 0.09);
    border-radius: 0.45rem;
    padding: 0.35rem 0.55rem;
    color: #f1f5f9;
    font-size: 0.74rem;
    line-height: 1.3;
    resize: none;
    outline: none;
  }

  .notes-input:focus {
    border-color: rgba(139, 92, 246, 0.5);
    background: rgba(15, 23, 42, 0.95);
  }

  .notes-input::placeholder {
    color: #64748b;
    font-size: 0.72rem;
  }

  /* Pinned Footer */
  .modal-footer-pinned {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 0.5rem;
    padding: 0.6rem 1rem max(0.6rem, env(safe-area-inset-bottom, 0.6rem));
    background: #090d16;
    border-top: 1px solid rgba(255, 255, 255, 0.08);
    flex-shrink: 0;
  }

  .btn-cancel-claim {
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.09);
    color: #cbd5e1;
    font-size: 0.76rem;
    font-weight: 600;
    padding: 0.45rem 0.8rem;
    border-radius: 0.45rem;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .btn-cancel-claim:hover:not(:disabled) {
    background: rgba(255, 255, 255, 0.1);
    color: #fff;
  }

  .btn-confirm-stage {
    background: linear-gradient(135deg, #7c3aed 0%, #6366f1 100%);
    border: 1px solid rgba(139, 92, 246, 0.4);
    color: #fff;
    font-size: 0.76rem;
    font-weight: 700;
    padding: 0.45rem 0.95rem;
    border-radius: 0.45rem;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    box-shadow: 0 4px 12px rgba(124, 58, 237, 0.35);
    transition: all 0.15s ease;
  }

  .btn-confirm-stage:hover:not(:disabled) {
    box-shadow: 0 6px 16px rgba(124, 58, 237, 0.5);
    transform: translateY(-1px);
  }

  .btn-confirm-stage:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    transform: none;
    box-shadow: none;
  }

  .btn-spinner {
    width: 12px;
    height: 12px;
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

  /* Responsive Rules for Android (320px, 360px, 390px, 430px) */
  @media (max-width: 480px) {
    .modal-card {
      max-height: calc(100dvh - 1rem);
      border-radius: 0.85rem;
    }

    .modal-header {
      padding: 0.65rem 0.85rem 0.55rem;
    }

    .assignment-compact-strip {
      padding: 0.45rem 0.85rem;
    }

    .claim-form-scrollable {
      padding: 0.55rem 0.85rem 0.35rem;
      gap: 0.45rem;
    }

    .mini-calendar-box {
      padding: 0.45rem 0.55rem;
    }

    .cal-day-btn {
      height: 28px;
      font-size: 0.72rem;
    }

    .modal-footer-pinned {
      padding: 0.55rem 0.85rem max(0.55rem, env(safe-area-inset-bottom, 0.55rem));
      justify-content: space-between;
    }

    .btn-cancel-claim {
      flex: 0 0 auto;
      padding: 0.45rem 0.75rem;
    }

    .btn-confirm-stage {
      flex: 1 1 auto;
      justify-content: center;
      padding: 0.45rem 0.8rem;
    }
  }

  @media (max-width: 340px) {
    .modal-title {
      font-size: 0.88rem;
    }

    .cal-day-btn {
      height: 26px;
      font-size: 0.68rem;
    }

    .btn-confirm-stage {
      font-size: 0.72rem;
      padding: 0.4rem 0.6rem;
    }
  }
</style>
