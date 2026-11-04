<script lang="ts">
  import {
    Calendar as CalendarIcon,
    Clock,
    X,
    Check,
    AlertCircle,
    Briefcase
  } from '@lucide/svelte';
  import { enhance } from '$app/forms';

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

  // Canonical Timezone: America/Sao_Paulo using Intl.DateTimeFormat for locale-independent accuracy
  const SP_TIMEZONE = 'America/Sao_Paulo';

  function getSaoPauloDateParts(dateInput?: string | Date | number) {
    const d = dateInput ? new Date(dateInput) : new Date();
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: SP_TIMEZONE,
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
    return { year, month: month - 1, day, hours, minutes, seconds, ymd, dayOfWeek };
  }

  function formatYMD(year: number, month: number, day: number): string {
    return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
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

  // Stage-specific contextual placeholder for observations
  function getContextualNotesPlaceholder(stage: any): string {
    const name = getCanonicalStageName(stage);
    if (name === 'Tradução') return 'Ex.: Pretendo concluir a tradução amanhã.';
    if (name === 'Clean/Redraw') return 'Ex.: Vou finalizar a limpeza e o redraw das páginas.';
    if (name === 'Typeset') return 'Ex.: Pretendo concluir a diagramação até sexta.';
    if (name === 'Revisor (QC)') return 'Ex.: Vou revisar as páginas e registrar eventuais correções.';
    return 'Ex.: Pretendo entregar esta etapa no prazo planejado.';
  }

  let stageDisplayName = $derived(getCanonicalStageName(stageItem?.stage));
  let stageDisplayColor = $derived(getCanonicalStageColor(stageItem?.stage));

  // Reactive baseline timestamp to detect date rollover & ensure Svelte 5 reactivity
  let currentTimestamp = $state(Date.now());

  $effect(() => {
    if (!isOpen) return;
    currentTimestamp = Date.now();
    const interval = setInterval(() => {
      currentTimestamp = Date.now();
    }, 15000);
    return () => clearInterval(interval);
  });

  // Dynamically derive allowed date options according to backend rule:
  // Strictly 4 options: Hoje, Amanhã, +2 dias, +3 dias ahead in America/Sao_Paulo timezone.
  let maxAllowedOffset = $derived.by(() => {
    const _ = currentTimestamp;
    let limit = 3;
    if (typeof stageItem?.maxAllowedDays === 'number') {
      limit = Math.min(3, Math.max(0, stageItem.maxAllowedDays));
    }
    return limit;
  });

  let dateOptions = $derived.by(() => {
    const nowSp = getSaoPauloDateParts(currentTimestamp);
    const list: Array<{
      offset: number;
      label: string;
      ymd: string;
      weekday: string;
      dayMonth: string;
      fullDateStr: string;
      formattedSummary: string;
    }> = [];

    for (let offset = 0; offset <= maxAllowedOffset; offset++) {
      // Deterministic UTC baseline to avoid any client timezone / DST drift
      const utcMs = Date.UTC(nowSp.year, nowSp.month, nowSp.day + offset, 12, 0, 0);
      const d = new Date(utcMs);
      const ymd = formatYMD(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());

      let label = '';
      if (offset === 0) label = 'Hoje';
      else if (offset === 1) label = 'Amanhã';
      else if (offset === 2) label = '+2 dias';
      else label = `+${offset} dias`;

      const weekdayShort = d.toLocaleDateString('pt-BR', { weekday: 'short', timeZone: 'UTC' }).replace('.', '');
      const weekdayLong = d.toLocaleDateString('pt-BR', { weekday: 'long', timeZone: 'UTC' });
      const monthLong = d.toLocaleDateString('pt-BR', { month: 'long', timeZone: 'UTC' });
      const day = String(d.getUTCDate()).padStart(2, '0');
      const month = String(d.getUTCMonth() + 1).padStart(2, '0');
      const dayMonth = `${day}/${month}`;

      const fullDateStr = d.toLocaleDateString('pt-BR', {
        weekday: 'long',
        day: 'numeric',
        month: 'short',
        timeZone: 'UTC'
      });

      // Format for compact summary: "sábado, 7 de novembro, até 23h59."
      const formattedSummary = `${weekdayLong}, ${d.getUTCDate()} de ${monthLong}, até 23h59.`;

      list.push({
        offset,
        label,
        ymd,
        weekday: weekdayShort.charAt(0).toUpperCase() + weekdayShort.slice(1),
        dayMonth,
        fullDateStr: fullDateStr.charAt(0).toUpperCase() + fullDateStr.slice(1),
        formattedSummary
      });
    }
    return list;
  });

  let contextualPlaceholder = $derived(
    getContextualNotesPlaceholder(stageItem?.stage)
  );

  // State management
  let selectedYMD = $state('');
  let notes = $state('');
  let isSubmitting = $state(false);
  let errorMessage = $state<string | null>(null);

  // Sync state whenever modal opens or stageItem changes
  $effect(() => {
    if (isOpen) {
      currentTimestamp = Date.now();
      // Default to max permitted (Hoje + maxOffset) to provide comfortable default margin
      const defaultOption = dateOptions[dateOptions.length - 1];
      selectedYMD = defaultOption?.ymd || '';
      notes = '';
      errorMessage = null;
      isSubmitting = false;
    }
  });

  // Keep selection valid if time crosses midnight while open
  $effect(() => {
    if (isOpen && selectedYMD) {
      const isStillValid = dateOptions.some((opt) => opt.ymd === selectedYMD);
      if (!isStillValid && dateOptions.length > 0) {
        selectedYMD = dateOptions[dateOptions.length - 1].ymd;
      }
    }
  });

  let selectedOption = $derived(
    dateOptions.find((opt) => opt.ymd === selectedYMD) || dateOptions[dateOptions.length - 1]
  );

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape' && isOpen && !isSubmitting) {
      onClose();
    }
  }
</script>

<svelte:window onkeydown={handleKeydown} />

{#if isOpen && stageItem}
  <div
    class="modal-backdrop"
    tabindex="-1"
    onclick={(e) => {
      if (e.target === e.currentTarget && !isSubmitting) onClose();
    }}
    onkeydown={(e) => {
      if (e.key === 'Escape' && !isSubmitting) onClose();
    }}
    role="dialog"
    aria-modal="true"
    aria-labelledby="claim-modal-title"
  >
    <div class="modal-card">
      <!-- 1. MODAL HEADER -->
      <header class="modal-header">
        <div class="header-left">
          <div class="icon-orb purple">
            <CalendarIcon size={16} />
          </div>
          <div class="header-titles">
            <h2 id="claim-modal-title" class="modal-title">Defina seu prazo de entrega</h2>
            <p class="modal-subtitle">Escolha quando pretende concluir esta etapa. Você tem até 3 dias corridos.</p>
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

      <!-- 2. OBRA, CAPÍTULO E TIPO DE TRABALHO -->
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

      <!-- 3. FORM BODY WITH COMPACT DATE CHIPS -->
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

          <!-- SELETOR COMPACTO DE DATAS (Substitui o calendário mensal completo) -->
          <div class="compact-date-selector-section">
            <span class="selector-section-title">Escolha o prazo de entrega</span>
            <div
              class="date-chips-grid"
              style="--chips-count: {dateOptions.length};"
              role="radiogroup"
              aria-label="Prazo de entrega elegível"
            >
              {#each dateOptions as opt}
                <button
                  type="button"
                  class="date-chip-btn"
                  class:is-selected={selectedYMD === opt.ymd}
                  onclick={() => { selectedYMD = opt.ymd; errorMessage = null; }}
                  role="radio"
                  aria-checked={selectedYMD === opt.ymd}
                  disabled={isSubmitting}
                >
                  <div class="chip-top-row">
                    <span class="chip-relative-tag">{opt.label}</span>
                    {#if selectedYMD === opt.ymd}
                      <span class="chip-check-indicator"><Check size={10} /></span>
                    {/if}
                  </div>
                  <div class="chip-date-row">
                    <strong class="chip-day-val">{opt.dayMonth}</strong>
                    <span class="chip-sep">•</span>
                    <span class="chip-wd-val">{opt.weekday}</span>
                  </div>
                </button>
              {/each}
            </div>
          </div>

          <!-- 4. RESUMO DO PRAZO ESCOLHIDO -->
          <div class="selected-summary-card">
            <Clock size={15} class="summary-clock-icon text-purple-400" />
            <div class="summary-text-block">
              <span class="summary-sub-txt">Entrega prevista:</span>
              <strong class="summary-val-txt">
                {selectedOption?.formattedSummary || 'Selecione uma data'}
              </strong>
            </div>
          </div>

          <!-- 5. OBSERVAÇÕES OPCIONAIS (Contextual por etapa) -->
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
              placeholder={contextualPlaceholder}
              class="notes-input"
              disabled={isSubmitting}
            ></textarea>
          </div>
        </div>

        <!-- 6. CANCELAR E CONFIRMAR (PINNED FOOTER) -->
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
    background: rgba(4, 7, 18, 0.84);
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: max(0.5rem, env(safe-area-inset-top, 0.5rem)) 0.75rem max(0.5rem, env(safe-area-inset-bottom, 0.5rem));
    overflow-y: auto;
    -webkit-overflow-scrolling: touch;
  }

  .modal-card {
    background: #090d16;
    border: 1px solid rgba(139, 92, 246, 0.3);
    border-radius: 1rem;
    box-shadow: 0 20px 50px rgba(0, 0, 0, 0.8), 0 0 30px rgba(139, 92, 246, 0.12);
    width: 100%;
    max-width: 440px;
    max-height: min(92vh, 520px);
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

  /* 1. Header */
  .modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.75rem 1rem 0.65rem;
    background: rgba(15, 23, 42, 0.75);
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  }

  .header-left {
    display: flex;
    align-items: center;
    gap: 0.55rem;
    min-width: 0;
  }

  .icon-orb {
    width: 30px;
    height: 30px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .icon-orb.purple {
    background: rgba(139, 92, 246, 0.2);
    color: #c084fc;
    border: 1px solid rgba(139, 92, 246, 0.35);
  }

  .header-titles {
    display: flex;
    flex-direction: column;
    gap: 0.1rem;
    min-width: 0;
  }

  .modal-title {
    font-size: 0.96rem;
    font-weight: 700;
    color: #f8fafc;
    margin: 0;
    line-height: 1.2;
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
    padding: 0.35rem;
    cursor: pointer;
    border-radius: 0.35rem;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.12s ease;
  }

  .btn-close-modal:hover:not(:disabled) {
    color: #cbd5e1;
    background: rgba(255, 255, 255, 0.08);
  }

  /* 2. Compact Assignment Strip */
  .assignment-compact-strip {
    display: flex;
    align-items: center;
    gap: 0.65rem;
    padding: 0.6rem 1rem;
    background: rgba(139, 92, 246, 0.06);
    border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  }

  .work-thumb-box {
    width: 34px;
    height: 46px;
    border-radius: 0.35rem;
    overflow: hidden;
    background: #1e293b;
    border: 1px solid rgba(255, 255, 255, 0.1);
    flex-shrink: 0;
  }

  .work-thumb-img {
    width: 100%;
    height: 100%;
    object-fit: cover;
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
    font-size: 0.88rem;
    font-weight: 700;
    color: #f8fafc;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .ch-badge {
    font-size: 0.72rem;
    font-weight: 700;
    color: #cbd5e1;
    background: rgba(255, 255, 255, 0.1);
    padding: 0.06rem 0.32rem;
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
    font-size: 0.72rem;
    font-weight: 600;
    color: var(--stage-c, #c084fc);
    background: color-mix(in srgb, var(--stage-c, #c084fc) 14%, transparent);
    padding: 0.06rem 0.35rem;
    border-radius: 0.25rem;
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
  }

  .st-dot {
    width: 5px;
    height: 5px;
    border-radius: 50%;
    background: currentColor;
  }

  .assignee-text {
    font-size: 0.72rem;
    color: #94a3b8;
  }

  .assignee-text strong {
    color: #e2e8f0;
  }

  /* 3. Form Layout */
  .claim-form-layout {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-height: 0;
    overflow: hidden;
  }

  .claim-form-scrollable {
    padding: 0.85rem 1rem;
    overflow-y: auto;
    -webkit-overflow-scrolling: touch;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .alert-banner.error {
    display: flex;
    align-items: center;
    gap: 0.45rem;
    background: rgba(239, 68, 68, 0.15);
    border: 1px solid rgba(239, 68, 68, 0.35);
    color: #fca5a5;
    padding: 0.5rem 0.75rem;
    border-radius: 0.45rem;
    font-size: 0.75rem;
    line-height: 1.35;
  }

  /* Compact Date Selector */
  .compact-date-selector-section {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
  }

  .selector-section-title {
    font-size: 0.72rem;
    font-weight: 700;
    color: #94a3b8;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  .date-chips-grid {
    display: grid;
    grid-template-columns: repeat(var(--chips-count, 4), minmax(0, 1fr));
    gap: 0.45rem;
  }

  .date-chip-btn {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    justify-content: space-between;
    gap: 0.25rem;
    background: rgba(15, 23, 42, 0.75);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 0.55rem;
    padding: 0.45rem 0.5rem;
    cursor: pointer;
    text-align: left;
    transition: all 0.14s ease;
    min-height: 52px;
  }

  .date-chip-btn:hover:not(:disabled) {
    background: rgba(139, 92, 246, 0.12);
    border-color: rgba(139, 92, 246, 0.35);
    transform: translateY(-1px);
  }

  .date-chip-btn:focus-visible {
    outline: 2px solid #a855f7;
    outline-offset: 2px;
  }

  .date-chip-btn.is-selected {
    background: linear-gradient(135deg, rgba(139, 92, 246, 0.28) 0%, rgba(99, 102, 241, 0.2) 100%);
    border-color: #a855f7;
    box-shadow: 0 0 12px rgba(168, 85, 247, 0.3), inset 0 0 0 1px #a855f7;
  }

  .chip-top-row {
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .chip-relative-tag {
    font-size: 0.72rem;
    font-weight: 700;
    color: #cbd5e1;
  }

  .date-chip-btn.is-selected .chip-relative-tag {
    color: #e9d5ff;
  }

  .chip-check-indicator {
    color: #c084fc;
    display: flex;
    align-items: center;
  }

  .chip-date-row {
    display: flex;
    align-items: baseline;
    gap: 0.2rem;
    font-size: 0.68rem;
    color: #94a3b8;
  }

  .chip-day-val {
    font-size: 0.76rem;
    font-weight: 700;
    color: #f1f5f9;
  }

  .chip-sep {
    font-size: 0.6rem;
    color: #64748b;
  }

  .chip-wd-val {
    font-size: 0.68rem;
    color: #94a3b8;
  }

  .date-chip-btn.is-selected .chip-wd-val {
    color: #cbd5e1;
  }

  /* 4. Selected Summary Card */
  .selected-summary-card {
    display: flex;
    align-items: center;
    gap: 0.55rem;
    background: rgba(139, 92, 246, 0.1);
    border: 1px solid rgba(139, 92, 246, 0.25);
    border-radius: 0.55rem;
    padding: 0.5rem 0.75rem;
  }

  :global(.summary-clock-icon) {
    flex-shrink: 0;
  }

  .summary-text-block {
    display: flex;
    flex-direction: column;
    gap: 0.05rem;
    min-width: 0;
  }

  .summary-sub-txt {
    font-size: 0.66rem;
    color: #94a3b8;
    text-transform: uppercase;
    letter-spacing: 0.03em;
  }

  .summary-val-txt {
    font-size: 0.8rem;
    font-weight: 700;
    color: #f1f5f9;
  }

  /* 5. Notes Block */
  .notes-block {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .notes-label-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .notes-lbl {
    font-size: 0.70rem;
    font-weight: 600;
    color: #94a3b8;
    text-transform: uppercase;
    letter-spacing: 0.03em;
  }

  .notes-counter {
    font-size: 0.65rem;
    color: #64748b;
  }

  .notes-input {
    background: rgba(15, 23, 42, 0.8);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 0.5rem;
    color: #f1f5f9;
    padding: 0.5rem 0.65rem;
    font-size: 0.78rem;
    line-height: 1.4;
    resize: none;
    font-family: inherit;
    transition: all 0.14s ease;
  }

  .notes-input:focus {
    outline: none;
    border-color: rgba(168, 85, 247, 0.6);
    box-shadow: 0 0 0 2px rgba(168, 85, 247, 0.15);
  }

  .notes-input::placeholder {
    color: #64748b;
  }

  /* 6. Pinned Footer */
  .modal-footer-pinned {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 0.55rem;
    padding: 0.75rem 1rem;
    background: rgba(15, 23, 42, 0.85);
    border-top: 1px solid rgba(255, 255, 255, 0.08);
  }

  .btn-cancel-claim {
    background: transparent;
    border: 1px solid rgba(255, 255, 255, 0.12);
    color: #94a3b8;
    padding: 0.45rem 0.85rem;
    border-radius: 0.45rem;
    font-size: 0.78rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.12s ease;
  }

  .btn-cancel-claim:hover:not(:disabled) {
    background: rgba(255, 255, 255, 0.06);
    color: #e2e8f0;
  }

  .btn-confirm-stage {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    background: linear-gradient(135deg, #7c3aed 0%, #9333ea 100%);
    border: 1px solid rgba(168, 85, 247, 0.4);
    color: #fff;
    padding: 0.48rem 0.95rem;
    border-radius: 0.45rem;
    font-size: 0.8rem;
    font-weight: 700;
    cursor: pointer;
    box-shadow: 0 2px 10px rgba(124, 58, 237, 0.35);
    transition: all 0.14s ease;
  }

  .btn-confirm-stage:hover:not(:disabled) {
    background: linear-gradient(135deg, #8b5cf6 0%, #a855f7 100%);
    box-shadow: 0 4px 14px rgba(168, 85, 247, 0.45);
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
    animation: spin 0.7s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  /* Mobile Responsive Tweaks */
  @media (max-width: 480px) {
    .modal-header {
      padding: 0.55rem 0.85rem;
    }

    .modal-title {
      font-size: 0.88rem;
    }

    .assignment-compact-strip {
      padding: 0.45rem 0.85rem;
    }

    .work-thumb-box {
      width: 28px;
      height: 38px;
    }

    .claim-form-scrollable {
      padding: 0.55rem 0.85rem;
      gap: 0.5rem;
    }

    .selected-summary-card {
      padding: 0.4rem 0.6rem;
    }

    .modal-footer-pinned {
      padding: 0.55rem 0.85rem max(0.55rem, env(safe-area-inset-bottom, 0.55rem));
    }
  }

  @media (max-width: 380px) {
    .date-chips-grid {
      grid-template-columns: repeat(var(--chips-count, 4), minmax(0, 1fr));
      gap: 0.22rem;
    }

    .date-chip-btn {
      padding: 0.35rem 0.22rem;
      min-height: 44px;
      border-radius: 0.45rem;
    }

    .chip-relative-tag {
      font-size: 0.65rem;
    }

    .chip-day-val {
      font-size: 0.68rem;
    }

    .chip-sep {
      display: none;
    }

    .chip-wd-val {
      font-size: 0.6rem;
    }

    .btn-confirm-stage {
      padding: 0.42rem 0.7rem;
      font-size: 0.74rem;
    }
  }
</style>
