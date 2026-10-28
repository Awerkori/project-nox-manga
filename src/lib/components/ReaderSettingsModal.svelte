<script lang="ts">
  import {
    X,
    Sliders,
    Zap,
    RotateCcw,
    Layers,
    AlignJustify,
    ArrowLeftRight,
    Palette,
    Check,
    Smartphone,
    Eye,
    ShieldCheck
  } from '@lucide/svelte';
  import type { ReaderSettings, ProgressPosition, PreloadMode, ReaderTheme, PageFitMode, PagedDirection } from '$lib/reader-settings';
  import { DEFAULT_READER_SETTINGS } from '$lib/reader-settings';

  let {
    settings,
    totalPages = 1,
    currentPage = 1,
    onClose = () => {},
    onUpdate = (s: ReaderSettings) => {},
    onJumpPage = (p: number) => {}
  }: {
    settings: ReaderSettings;
    totalPages?: number;
    currentPage?: number;
    onClose?: () => void;
    onUpdate?: (s: ReaderSettings) => void;
    onJumpPage?: (page: number) => void;
  } = $props();

  let local = $state<ReaderSettings>({ ...settings });
  let viewSection = $state<'quick' | 'advanced'>('quick');

  function update(partial: Partial<ReaderSettings>) {
    local = { ...local, ...partial };
    onUpdate({ ...local });
  }

  function handleReset() {
    local = { ...DEFAULT_READER_SETTINGS };
    onUpdate({ ...local });
  }

  const WIDTH_PRESETS = [
    { label: 'Compacto', width: 680, fit: 'custom' as PageFitMode },
    { label: 'Padrão', width: 850, fit: 'custom' as PageFitMode },
    { label: 'Largo', width: 1100, fit: 'custom' as PageFitMode },
    { label: '100%', width: 1400, fit: 'full' as PageFitMode }
  ];

  const THEMES: { id: ReaderTheme; label: string; color: string }[] = [
    { id: 'dark', label: 'Nox Dark', color: '#7c3aed' },
    { id: 'oled', label: 'OLED Puro', color: '#1e293b' },
    { id: 'sepia', label: 'Sépia', color: '#b45309' }
  ];

  const PROGRESS_OPTIONS: { id: ProgressPosition; label: string }[] = [
    { id: 'off', label: 'Desativada (Padrão)' },
    { id: 'bottom', label: 'Inferior' },
    { id: 'left', label: 'Esquerda' },
    { id: 'right', label: 'Direita' }
  ];
</script>

<!-- Backdrop overlay -->
<!-- svelte-ignore a11y_click_events_have_key_events -->
<div
  class="settings-backdrop"
  onclick={onClose}
  role="button"
  tabindex="0"
  aria-label="Fechar ajustes de leitura"
></div>

<!-- Settings Sliding Sheet / Modal -->
<aside class="settings-sheet" role="dialog" aria-modal="true" aria-label="Ajustes de Leitura do Project Nox">
  <!-- Sheet Header -->
  <header class="sheet-header">
    <div class="sheet-title-group">
      <div class="sheet-icon-pill">
        <Sliders size={16} class="text-purple-400" />
      </div>
      <div>
        <h2 class="sheet-title">Ajustes do Leitor</h2>
      </div>
    </div>
    <div class="sheet-header-actions">
      <button
        type="button"
        class="btn-reset-defaults"
        onclick={handleReset}
        title="Restaurar padrões de fábrica"
      >
        <RotateCcw size={12} />
        <span>Padrão</span>
      </button>
      <button
        type="button"
        class="btn-close-sheet"
        onclick={onClose}
        aria-label="Fechar"
      >
        <X size={18} />
      </button>
    </div>
  </header>

  <!-- Clear 2-Way View Selector: Ajustes Rápidos vs Configurações Avançadas -->
  <div class="settings-view-switcher">
    <button
      type="button"
      class="view-switch-btn"
      class:active={viewSection === 'quick'}
      onclick={() => (viewSection = 'quick')}
    >
      <Zap size={14} />
      <span>Ajustes Rápidos</span>
    </button>
    <button
      type="button"
      class="view-switch-btn"
      class:active={viewSection === 'advanced'}
      onclick={() => (viewSection = 'advanced')}
    >
      <Sliders size={14} />
      <span>Configurações Avançadas</span>
    </button>
  </div>

  <!-- Scrollable Sheet Content -->
  <div class="sheet-scroll-body">
    {#if viewSection === 'quick'}
      <!-- ================================================================= -->
      <!-- 1. AJUSTES RÁPIDOS -->
      <!-- ================================================================= -->
      <div class="quick-settings-stack">
        <!-- Modo de Leitura -->
        <div class="setting-row">
          <label class="setting-label">Modo de Leitura</label>
          <div class="grid-2-segmented">
            <button
              type="button"
              class="seg-btn"
              class:active={local.mode === 'webtoon'}
              onclick={() => update({ mode: 'webtoon' })}
            >
              <AlignJustify size={14} />
              <span>Webtoon</span>
            </button>
            <button
              type="button"
              class="seg-btn"
              class:active={local.mode === 'paginated'}
              onclick={() => update({ mode: 'paginated' })}
            >
              <Layers size={14} />
              <span>Paginado</span>
            </button>
          </div>
        </div>

        <!-- Largura das Páginas -->
        <div class="setting-row">
          <div class="label-with-value">
            <label class="setting-label">Largura da Leitura</label>
            <span class="value-chip">{local.fit === 'full' ? '100% da Tela' : `${local.width}px`}</span>
          </div>
          <div class="presets-row">
            {#each WIDTH_PRESETS as preset}
              <button
                type="button"
                class="preset-pill"
                class:active={(preset.fit === 'full' && local.fit === 'full') || (local.fit === 'custom' && local.width === preset.width)}
                onclick={() => update({ fit: preset.fit, width: preset.width })}
              >
                {preset.label}
              </button>
            {/each}
          </div>
        </div>

        <!-- Tema de Fundo -->
        <div class="setting-row">
          <label class="setting-label">Tema Visual</label>
          <div class="themes-grid">
            {#each THEMES as theme}
              <button
                type="button"
                class="theme-chip-btn"
                class:active={local.theme === theme.id}
                onclick={() => update({ theme: theme.id })}
              >
                <span class="theme-color-dot" style="background-color: {theme.color};"></span>
                <span class="theme-chip-label">{theme.label}</span>
                {#if local.theme === theme.id}
                  <Check size={12} class="theme-check-icon" />
                {/if}
              </button>
            {/each}
          </div>
        </div>

        <!-- Barra de Progresso -->
        <div class="setting-row">
          <div class="label-with-value">
            <label class="setting-label">Barra de Progresso</label>
            {#if local.progressPosition === 'off'}
              <span class="badge-off">Desativada</span>
            {/if}
          </div>
          <div class="progress-grid">
            {#each PROGRESS_OPTIONS as opt}
              <button
                type="button"
                class="progress-pill-btn"
                class:active={local.progressPosition === opt.id}
                onclick={() => update({ progressPosition: opt.id })}
              >
                {#if local.progressPosition === opt.id}
                  <Check size={12} class="progress-check-icon" />
                {/if}
                <span>{opt.label}</span>
              </button>
            {/each}
          </div>
        </div>

        <!-- Modo de Carregamento (Turbo vs Econômico) -->
        <div class="setting-row">
          <label class="setting-label">Carregamento do Capítulo</label>
          <div class="preload-modes-container">
            <button
              type="button"
              class="mode-card-btn"
              class:active={local.preloadMode === 'turbo'}
              onclick={() => update({ preloadMode: 'turbo' })}
            >
              <div class="mode-card-header">
                <div class="mode-card-title">
                  <Zap size={14} class="text-purple-400" />
                  <strong>Turbo Inteligente</strong>
                </div>
                <span class="badge-tag purple">Padrão</span>
              </div>
              <p class="mode-card-desc">
                Baixa todas as páginas antecipadamente de forma adaptativa para leitura sem travamentos.
              </p>
            </button>

            <button
              type="button"
              class="mode-card-btn"
              class:active={local.preloadMode === 'eco'}
              onclick={() => update({ preloadMode: 'eco' })}
            >
              <div class="mode-card-header">
                <div class="mode-card-title">
                  <ShieldCheck size={14} class="text-emerald-400" />
                  <strong>Modo Econômico</strong>
                </div>
                <span class="badge-tag green">Econômico</span>
              </div>
              <p class="mode-card-desc">
                Carrega somente as páginas próximas. Ideal para conexões limitadas ou pouca memória.
              </p>
            </button>
          </div>
        </div>
      </div>
    {:else}
      <!-- ================================================================= -->
      <!-- 2. CONFIGURAÇÕES AVANÇADAS -->
      <!-- ================================================================= -->
      <div class="advanced-settings-stack">
        <!-- Direção da Leitura (Paginado) -->
        {#if local.mode === 'paginated'}
          <div class="setting-row">
            <label class="setting-label">Direção da Leitura (Paginado)</label>
            <div class="grid-2-segmented">
              <button
                type="button"
                class="seg-btn"
                class:active={local.pagedDirection === 'ltr'}
                onclick={() => update({ pagedDirection: 'ltr' })}
              >
                <ArrowLeftRight size={14} />
                <span>Esq. → Dir. (Ocidental)</span>
              </button>
              <button
                type="button"
                class="seg-btn"
                class:active={local.pagedDirection === 'rtl'}
                onclick={() => update({ pagedDirection: 'rtl' })}
              >
                <ArrowLeftRight size={14} />
                <span>Dir. → Esq. (Mangá)</span>
              </button>
            </div>
          </div>
        {/if}

        <!-- Ajuste Fino de Largura -->
        <div class="setting-row">
          <div class="label-with-value">
            <label class="setting-label">Ajuste Fino de Largura</label>
            <span class="value-chip">{local.width}px</span>
          </div>
          <input
            type="range"
            min="480"
            max="1400"
            step="20"
            value={local.width}
            oninput={(e) => update({ width: Number((e.target as HTMLInputElement).value), fit: 'custom' })}
            class="nox-range-slider"
          />
          <div class="slider-ticks">
            <span>480px (Celular)</span>
            <span>850px (Padrão)</span>
            <span>1400px (Monitor)</span>
          </div>
        </div>

        <!-- Espaçamento entre Páginas (Webtoon) -->
        {#if local.mode === 'webtoon'}
          <div class="setting-row">
            <div class="label-with-value">
              <label class="setting-label">Espaço entre Páginas</label>
              <span class="value-chip">{local.gap ? 'Ativado (12px)' : 'Sem Espaço (0px)'}</span>
            </div>
            <div class="grid-2-segmented">
              <button
                type="button"
                class="seg-btn"
                class:active={!local.gap}
                onclick={() => update({ gap: false })}
              >
                <span>Contínuo (0px)</span>
              </button>
              <button
                type="button"
                class="seg-btn"
                class:active={local.gap}
                onclick={() => update({ gap: true })}
              >
                <span>Separado (12px)</span>
              </button>
            </div>
          </div>
        {/if}

        <!-- Indicador de Detalhes da Barra de Progresso -->
        {#if local.progressPosition !== 'off'}
          <div class="setting-row">
            <label class="setting-label">Informação da Barra</label>
            <div class="grid-3-segmented">
              <button
                type="button"
                class="seg-btn"
                class:active={local.progressDisplay === 'percent'}
                onclick={() => update({ progressDisplay: 'percent' })}
              >
                <span>Porcentagem (%)</span>
              </button>
              <button
                type="button"
                class="seg-btn"
                class:active={local.progressDisplay === 'pages'}
                onclick={() => update({ progressDisplay: 'pages' })}
              >
                <span>Página Atual (X/Y)</span>
              </button>
              <button
                type="button"
                class="seg-btn"
                class:active={local.progressDisplay === 'none'}
                onclick={() => update({ progressDisplay: 'none' })}
              >
                <span>Sem Texto</span>
              </button>
            </div>
          </div>
        {/if}

        <!-- Ocultação Automática dos Controles -->
        <div class="setting-row toggle-row">
          <div class="toggle-text">
            <strong class="toggle-title">Ocultar Controles ao Rolar</strong>
            <small class="toggle-desc">Esconde o cabeçalho e barras flutuantes durante a leitura para foco total.</small>
          </div>
          <input
            type="checkbox"
            class="nox-checkbox"
            checked={local.autoHideControls}
            onchange={(e) => update({ autoHideControls: (e.target as HTMLInputElement).checked })}
          />
        </div>

        <!-- Info / Diagnostic Box -->
        <div class="advanced-info-box">
          <Eye size={16} class="text-purple-400 shrink-0" />
          <p>
            Suas preferências são salvas automaticamente neste navegador e serão mantidas nos próximos capítulos.
          </p>
        </div>
      </div>
    {/if}
  </div>
</aside>

<style>
  .settings-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.72);
    backdrop-filter: blur(4px);
    -webkit-backdrop-filter: blur(4px);
    z-index: 90;
  }

  .settings-sheet {
    position: fixed;
    top: 0;
    right: 0;
    bottom: 0;
    width: min(100vw, 420px);
    background: #090a12;
    border-left: 1px solid rgba(255, 255, 255, 0.08);
    box-shadow: -8px 0 32px rgba(0, 0, 0, 0.85);
    z-index: 95;
    display: flex;
    flex-direction: column;
    color: #f1f5f9;
  }

  .sheet-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px 20px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.06);
    background: rgba(18, 14, 28, 0.6);
  }

  .sheet-title-group {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .sheet-icon-pill {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    border-radius: 8px;
    background: rgba(168, 85, 247, 0.12);
    border: 1px solid rgba(168, 85, 247, 0.25);
  }

  .sheet-title {
    font-size: 15px;
    font-weight: 700;
    color: #f8fafc;
    margin: 0;
  }

  .sheet-header-actions {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .btn-reset-defaults {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 6px;
    padding: 4px 10px;
    color: #94a3b8;
    font-size: 11px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .btn-reset-defaults:hover {
    background: rgba(255, 255, 255, 0.08);
    color: #f1f5f9;
  }

  .btn-close-sheet {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 8px;
    color: #94a3b8;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .btn-close-sheet:hover {
    background: rgba(239, 68, 68, 0.15);
    border-color: rgba(239, 68, 68, 0.3);
    color: #f87171;
  }

  /* 2-Way View Switcher */
  .settings-view-switcher {
    display: flex;
    padding: 10px 16px;
    gap: 8px;
    background: rgba(0, 0, 0, 0.35);
    border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  }

  .view-switch-btn {
    flex: 1;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 7px;
    padding: 9px 12px;
    border-radius: 8px;
    background: transparent;
    border: 1px solid transparent;
    color: #94a3b8;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .view-switch-btn:hover {
    color: #f1f5f9;
    background: rgba(255, 255, 255, 0.04);
  }

  .view-switch-btn.active {
    background: rgba(168, 85, 247, 0.15);
    border-color: rgba(168, 85, 247, 0.35);
    color: #d8b4fe;
    font-weight: 700;
  }

  /* Scrollable Body */
  .sheet-scroll-body {
    flex: 1;
    overflow-y: auto;
    padding: 16px 20px;
    display: flex;
    flex-direction: column;
    gap: 18px;
  }

  .quick-settings-stack,
  .advanced-settings-stack {
    display: flex;
    flex-direction: column;
    gap: 18px;
  }

  .setting-row {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .setting-label {
    font-size: 12px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: #94a3b8;
  }

  .label-with-value {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .value-chip {
    font-size: 11px;
    font-weight: 700;
    color: #c084fc;
    background: rgba(168, 85, 247, 0.12);
    padding: 2px 8px;
    border-radius: 9999px;
  }

  .badge-off {
    font-size: 10px;
    font-weight: 700;
    color: #64748b;
    background: rgba(255, 255, 255, 0.05);
    padding: 2px 6px;
    border-radius: 4px;
  }

  /* Segmented Controls */
  .grid-2-segmented {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 6px;
  }

  .grid-3-segmented {
    display: grid;
    grid-template-columns: 1fr 1fr 1fr;
    gap: 6px;
  }

  .seg-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 7px;
    padding: 10px 12px;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 8px;
    color: #94a3b8;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .seg-btn:hover {
    background: rgba(255, 255, 255, 0.06);
    color: #f1f5f9;
  }

  .seg-btn.active {
    background: rgba(168, 85, 247, 0.15);
    border-color: rgba(168, 85, 247, 0.4);
    color: #f8fafc;
    box-shadow: 0 0 10px rgba(168, 85, 247, 0.2);
  }

  /* Presets row */
  .presets-row {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 6px;
  }

  .preset-pill {
    padding: 8px 6px;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 8px;
    color: #94a3b8;
    font-size: 11px;
    font-weight: 600;
    cursor: pointer;
    text-align: center;
    transition: all 0.2s ease;
  }

  .preset-pill:hover {
    background: rgba(255, 255, 255, 0.06);
    color: #f1f5f9;
  }

  .preset-pill.active {
    background: rgba(168, 85, 247, 0.18);
    border-color: rgba(168, 85, 247, 0.4);
    color: #d8b4fe;
    font-weight: 700;
  }

  /* Themes */
  .themes-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 8px;
  }

  .theme-chip-btn {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 10px 10px;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 8px;
    color: #94a3b8;
    font-size: 11.5px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .theme-chip-btn:hover {
    background: rgba(255, 255, 255, 0.06);
    color: #f1f5f9;
  }

  .theme-chip-btn.active {
    background: rgba(168, 85, 247, 0.15);
    border-color: rgba(168, 85, 247, 0.4);
    color: #f8fafc;
  }

  .theme-color-dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  .theme-check-icon {
    margin-left: auto;
    color: #c084fc;
  }

  /* Progress grid */
  .progress-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 6px;
  }

  .progress-pill-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    padding: 9px 10px;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 8px;
    color: #94a3b8;
    font-size: 11px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .progress-pill-btn:hover {
    background: rgba(255, 255, 255, 0.06);
    color: #f1f5f9;
  }

  .progress-pill-btn.active {
    background: rgba(168, 85, 247, 0.18);
    border-color: rgba(168, 85, 247, 0.4);
    color: #d8b4fe;
    font-weight: 700;
  }

  .progress-check-icon {
    color: #c084fc;
  }

  /* Preload Mode Cards */
  .preload-modes-container {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .mode-card-btn {
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 12px 14px;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 10px;
    text-align: left;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .mode-card-btn:hover {
    background: rgba(255, 255, 255, 0.06);
  }

  .mode-card-btn.active {
    background: rgba(168, 85, 247, 0.12);
    border-color: rgba(168, 85, 247, 0.4);
    box-shadow: 0 0 10px rgba(168, 85, 247, 0.15);
  }

  .mode-card-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .mode-card-title {
    display: flex;
    align-items: center;
    gap: 7px;
    font-size: 13px;
    color: #f8fafc;
  }

  .badge-tag {
    font-size: 9px;
    font-weight: 800;
    padding: 2px 6px;
    border-radius: 4px;
  }

  .badge-tag.purple {
    background: rgba(168, 85, 247, 0.2);
    color: #c084fc;
  }

  .badge-tag.green {
    background: rgba(52, 211, 153, 0.2);
    color: #34d399;
  }

  .mode-card-desc {
    font-size: 11px;
    color: #94a3b8;
    line-height: 1.4;
    margin: 0;
  }

  /* Sliders and Toggles */
  .nox-range-slider {
    width: 100%;
    accent-color: #a855f7;
    cursor: pointer;
    margin: 6px 0;
  }

  .slider-ticks {
    display: flex;
    justify-content: space-between;
    font-size: 10px;
    color: #64748b;
  }

  .toggle-row {
    flex-direction: row;
    align-items: center;
    justify-content: space-between;
    padding: 12px 14px;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 10px;
  }

  .toggle-text {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .toggle-title {
    font-size: 12.5px;
    color: #f1f5f9;
  }

  .toggle-desc {
    font-size: 10.5px;
    color: #94a3b8;
    max-width: 280px;
  }

  .nox-checkbox {
    width: 18px;
    height: 18px;
    accent-color: #a855f7;
    cursor: pointer;
  }

  .advanced-info-box {
    display: flex;
    gap: 10px;
    padding: 12px;
    background: rgba(168, 85, 247, 0.08);
    border: 1px solid rgba(168, 85, 247, 0.2);
    border-radius: 8px;
    font-size: 11px;
    color: #cbd5e1;
    line-height: 1.4;
  }

  .advanced-info-box p {
    margin: 0;
  }
</style>
