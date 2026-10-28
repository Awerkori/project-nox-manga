<script lang="ts">
  import {
    X,
    Sliders,
    Monitor,
    BookOpen,
    Eye,
    Palette,
    Zap,
    RotateCcw,
    Layers,
    AlignJustify,
    ArrowLeftRight,
    Gauge,
    Sparkles,
    Check
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
  let activeTab = $state<'appearance' | 'navigation' | 'progress' | 'performance'>('appearance');

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

  const THEMES: { id: ReaderTheme; label: string; bg: string; border: string; desc: string }[] = [
    { id: 'dark', label: 'Nox Dark', bg: '#06070c', border: '#7c3aed', desc: 'Escuro equilibrado' },
    { id: 'oled', label: 'OLED Black', bg: '#000000', border: '#3b82f6', desc: 'Preto puro econômico' },
    { id: 'sepia', label: 'Sépia Suave', bg: '#1c1917', border: '#f59e0b', desc: 'Conforto visual térmico' }
  ];

  const PROGRESS_POSITIONS: { id: ProgressPosition; label: string; desc: string }[] = [
    { id: 'bottom', label: 'Inferior', desc: 'Barra horizontal na base da tela' },
    { id: 'left', label: 'Esquerda', desc: 'Barra vertical na lateral esquerda' },
    { id: 'right', label: 'Direita', desc: 'Barra vertical na lateral direita' },
    { id: 'off', label: 'Desativada', desc: 'Sem barra de progresso na tela' }
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
    <div class="sheet-title-row">
      <div class="sheet-title-badge">
        <Sliders size={18} class="text-purple-400" />
      </div>
      <div>
        <h2 class="sheet-title">Ajustes do Leitor</h2>
        <p class="sheet-subtitle">Personalize a sua experiência de leitura</p>
      </div>
    </div>
    <div class="sheet-header-actions">
      <button
        type="button"
        class="btn-reset-defaults"
        onclick={handleReset}
        title="Restaurar padrões de fábrica"
        aria-label="Restaurar padrões"
      >
        <RotateCcw size={13} />
        <span>Padrão</span>
      </button>
      <button
        type="button"
        class="btn-close-sheet"
        onclick={onClose}
        aria-label="Fechar painel de ajustes"
      >
        <X size={18} />
      </button>
    </div>
  </header>

  <!-- Category Navigation Tabs -->
  <nav class="settings-tabs-nav" aria-label="Categorias de ajustes">
    <button
      type="button"
      class="nav-tab-btn"
      class:active={activeTab === 'appearance'}
      onclick={() => (activeTab = 'appearance')}
    >
      <Palette size={14} />
      <span>Aparência</span>
    </button>
    <button
      type="button"
      class="nav-tab-btn"
      class:active={activeTab === 'navigation'}
      onclick={() => (activeTab = 'navigation')}
    >
      <AlignJustify size={14} />
      <span>Navegação</span>
    </button>
    <button
      type="button"
      class="nav-tab-btn"
      class:active={activeTab === 'progress'}
      onclick={() => (activeTab = 'progress')}
    >
      <Gauge size={14} />
      <span>Progresso</span>
    </button>
    <button
      type="button"
      class="nav-tab-btn"
      class:active={activeTab === 'performance'}
      onclick={() => (activeTab = 'performance')}
    >
      <Zap size={14} />
      <span>Turbo / Cache</span>
    </button>
  </nav>

  <!-- Sheet Scrollable Body -->
  <div class="sheet-scroll-body">
    <!-- ==================================================================== -->
    <!-- TAB 1: APARÊNCIA                                                     -->
    <!-- ==================================================================== -->
    {#if activeTab === 'appearance'}
      <div class="tab-pane">
        <!-- Tema de Fundo -->
        <div class="settings-section">
          <label class="section-heading">Tema de Fundo</label>
          <div class="theme-cards-grid">
            {#each THEMES as theme}
              <button
                type="button"
                class="theme-card-option"
                class:active={local.theme === theme.id}
                onclick={() => update({ theme: theme.id })}
                style="background-color: {theme.bg};"
              >
                <div class="theme-card-preview" style="border-color: {theme.border};">
                  {#if local.theme === theme.id}
                    <Check size={14} class="theme-check-icon" />
                  {/if}
                </div>
                <div class="theme-card-info">
                  <span class="theme-name">{theme.label}</span>
                  <span class="theme-desc">{theme.desc}</span>
                </div>
              </button>
            {/each}
          </div>
        </div>

        <!-- Largura das Páginas -->
        <div class="settings-section">
          <div class="section-heading-row">
            <label class="section-heading">Largura Máxima da Imagem</label>
            <span class="value-chip">{local.fit === 'full' ? '100% (Tela Cheia)' : `${local.width}px`}</span>
          </div>

          <!-- Presets -->
          <div class="preset-pill-row">
            {#each WIDTH_PRESETS as p}
              <button
                type="button"
                class="preset-pill-btn"
                class:active={local.fit === p.fit && (p.fit === 'full' || local.width === p.width)}
                onclick={() => update({ fit: p.fit, width: p.width })}
              >
                {p.label}
              </button>
            {/each}
          </div>

          <!-- Custom Slider (Active when not 100%) -->
          {#if local.fit !== 'full'}
            <div class="slider-control-box">
              <input
                type="range"
                min="400"
                max="1400"
                step="25"
                value={local.width}
                oninput={(e) => update({ width: Number((e.target as HTMLInputElement).value), fit: 'custom' })}
                class="nox-slider"
                aria-label="Ajustar largura máxima"
              />
              <div class="slider-ticks-row">
                <span>400px</span>
                <span>850px</span>
                <span>1400px</span>
              </div>
            </div>
          {/if}
        </div>

        <!-- Espaçamento Entre Páginas (Webtoon Gap) -->
        <div class="settings-section">
          <label class="toggle-card">
            <div class="toggle-info">
              <span class="toggle-title">Espaçamento Entre Páginas</span>
              <span class="toggle-desc">Insere uma fenda suave de 12px entre as páginas no modo cascata</span>
            </div>
            <input
              type="checkbox"
              checked={local.gap}
              onchange={(e) => update({ gap: (e.target as HTMLInputElement).checked })}
              class="nox-switch"
            />
          </label>
        </div>
      </div>
    {/if}

    <!-- ==================================================================== -->
    <!-- TAB 2: NAVEGAÇÃO                                                     -->
    <!-- ==================================================================== -->
    {#if activeTab === 'navigation'}
      <div class="tab-pane">
        <!-- Modo de Leitura -->
        <div class="settings-section">
          <label class="section-heading">Modo de Leitura</label>
          <div class="segmented-control-large">
            <button
              type="button"
              class="segment-choice"
              class:active={local.mode === 'webtoon'}
              onclick={() => update({ mode: 'webtoon' })}
            >
              <AlignJustify size={18} />
              <div>
                <strong>Cascata Webtoon</strong>
                <small>Rolagem contínua vertical</small>
              </div>
            </button>
            <button
              type="button"
              class="segment-choice"
              class:active={local.mode === 'paginated'}
              onclick={() => update({ mode: 'paginated' })}
            >
              <BookOpen size={18} />
              <div>
                <strong>Modo Paginado</strong>
                <small>Página a página / Toque</small>
              </div>
            </button>
          </div>
        </div>

        <!-- Se estiver em Paginado: Direção de Leitura -->
        {#if local.mode === 'paginated'}
          <div class="settings-section">
            <label class="section-heading">Direção de Leitura Paginada</label>
            <div class="segmented-control-pills">
              <button
                type="button"
                class="seg-pill"
                class:active={local.pagedDirection === 'ltr'}
                onclick={() => update({ pagedDirection: 'ltr' })}
              >
                Esquerda ➔ Direita (Ocidental)
              </button>
              <button
                type="button"
                class="seg-pill"
                class:active={local.pagedDirection === 'rtl'}
                onclick={() => update({ pagedDirection: 'rtl' })}
              >
                Direita ➔ Esquerda (Mangá)
              </button>
            </div>
          </div>
        {/if}

        <!-- Pular para Página -->
        <div class="settings-section">
          <div class="section-heading-row">
            <label class="section-heading">Salto Rápido de Página</label>
            <span class="value-chip">{currentPage} de {totalPages}</span>
          </div>
          <div class="page-jump-row">
            <input
              type="range"
              min="1"
              max={totalPages}
              step="1"
              value={currentPage}
              oninput={(e) => onJumpPage(Number((e.target as HTMLInputElement).value))}
              class="nox-slider"
              aria-label="Pular para página específica"
            />
          </div>
        </div>

        <!-- Auto-ocultação dos Controles -->
        <div class="settings-section">
          <label class="toggle-card">
            <div class="toggle-info">
              <span class="toggle-title">Auto-ocultar Controles</span>
              <span class="toggle-desc">Oculta cabeçalho e barras durante a rolagem para leitura imersiva. Toque na tela para reexibir.</span>
            </div>
            <input
              type="checkbox"
              checked={local.autoHideControls}
              onchange={(e) => update({ autoHideControls: (e.target as HTMLInputElement).checked })}
              class="nox-switch"
            />
          </label>
        </div>
      </div>
    {/if}

    <!-- ==================================================================== -->
    <!-- TAB 3: BARRA DE PROGRESSO                                            -->
    <!-- ==================================================================== -->
    {#if activeTab === 'progress'}
      <div class="tab-pane">
        <!-- Posição da Barra -->
        <div class="settings-section">
          <label class="section-heading">Posição da Barra de Progresso</label>
          <div class="position-cards-grid">
            {#each PROGRESS_POSITIONS as pos}
              <button
                type="button"
                class="position-card-btn"
                class:active={local.progressPosition === pos.id}
                onclick={() => update({ progressPosition: pos.id })}
              >
                <div class="pos-card-header">
                  <span class="pos-card-title">{pos.label}</span>
                  {#if local.progressPosition === pos.id}
                    <Check size={14} class="pos-check-icon" />
                  {/if}
                </div>
                <span class="pos-card-desc">{pos.desc}</span>
              </button>
            {/each}
          </div>
        </div>

        <!-- Formato do Indicador Flutuante -->
        {#if local.progressPosition !== 'off'}
          <div class="settings-section">
            <label class="section-heading">Indicador Flutuante</label>
            <div class="segmented-control-pills">
              <button
                type="button"
                class="seg-pill"
                class:active={local.progressDisplay === 'percent'}
                onclick={() => update({ progressDisplay: 'percent' })}
              >
                Porcentagem (45%)
              </button>
              <button
                type="button"
                class="seg-pill"
                class:active={local.progressDisplay === 'pages'}
                onclick={() => update({ progressDisplay: 'pages' })}
              >
                Páginas (12 / 28)
              </button>
              <button
                type="button"
                class="seg-pill"
                class:active={local.progressDisplay === 'both'}
                onclick={() => update({ progressDisplay: 'both' })}
              >
                Ambos
              </button>
              <button
                type="button"
                class="seg-pill"
                class:active={local.progressDisplay === 'none'}
                onclick={() => update({ progressDisplay: 'none' })}
              >
                Ocultar Pill
              </button>
            </div>
          </div>
        {/if}
      </div>
    {/if}

    <!-- ==================================================================== -->
    <!-- TAB 4: TURBO / DESEMPENHO                                            -->
    <!-- ==================================================================== -->
    {#if activeTab === 'performance'}
      <div class="tab-pane">
        <!-- Modos de Pré-carregamento -->
        <div class="settings-section">
          <label class="section-heading">Estratégia de Carregamento de Páginas</label>

          <div class="preload-mode-cards">
            <!-- Modo Turbo / Inteligente (Padrão) -->
            <button
              type="button"
              class="preload-mode-card"
              class:active={local.preloadMode === 'turbo'}
              onclick={() => update({ preloadMode: 'turbo' })}
            >
              <div class="preload-card-top">
                <div class="preload-title-group">
                  <Zap size={18} class="text-amber-400" />
                  <div>
                    <strong>⚡ Modo Turbo / Inteligente (Padrão Recomendado)</strong>
                    <span class="badge-recommended">RECOMENDADO</span>
                  </div>
                </div>
                {#if local.preloadMode === 'turbo'}
                  <Check size={16} class="text-purple-400" />
                {/if}
              </div>
              <p class="preload-desc">
                Baixa antecipadamente todas as páginas do capítulo em segundo plano com concorrência adaptativa. Garante rolagem 100% fluida sem paradas para carregar.
              </p>
            </button>

            <!-- Modo Econômico -->
            <button
              type="button"
              class="preload-mode-card"
              class:active={local.preloadMode === 'eco'}
              onclick={() => update({ preloadMode: 'eco' })}
            >
              <div class="preload-card-top">
                <div class="preload-title-group">
                  <Layers size={18} class="text-emerald-400" />
                  <div>
                    <strong>🌱 Modo Econômico</strong>
                    <span class="badge-eco">DADOS MÓVEIS</span>
                  </div>
                </div>
                {#if local.preloadMode === 'eco'}
                  <Check size={16} class="text-purple-400" />
                {/if}
              </div>
              <p class="preload-desc">
                Carrega apenas as próximas 2 páginas à frente. Economiza plano de dados celulares e consome menos memória RAM em celulares modestos.
              </p>
            </button>
          </div>
        </div>

        <div class="settings-tip-box">
          <Sparkles size={16} class="text-purple-400 flex-shrink-0" />
          <p>
            O Project Nox memoriza suas preferências de leitura neste dispositivo. Se você salvou este capítulo para leitura offline, o carregamento é instantâneo via IndexedDB.
          </p>
        </div>
      </div>
    {/if}
  </div>
</aside>

<style>
  /* Backdrop */
  .settings-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.75);
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
    z-index: 90;
    transition: opacity 0.25s ease;
  }

  /* Sheet Container */
  .settings-sheet {
    position: fixed;
    top: 0;
    right: 0;
    bottom: 0;
    width: min(480px, 100vw);
    background: #090a10;
    border-left: 1px solid rgba(255, 255, 255, 0.1);
    box-shadow: -8px 0 32px rgba(0, 0, 0, 0.8);
    z-index: 95;
    display: flex;
    flex-direction: column;
    color: #e2e8f0;
    animation: slideInRight 0.28s cubic-bezier(0.16, 1, 0.3, 1) forwards;
  }

  @keyframes slideInRight {
    from {
      transform: translateX(100%);
    }
    to {
      transform: translateX(0);
    }
  }

  /* Header */
  .sheet-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 18px 20px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
    background: rgba(14, 16, 26, 0.6);
  }

  .sheet-title-row {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .sheet-title-badge {
    width: 36px;
    height: 36px;
    border-radius: 10px;
    background: rgba(168, 85, 247, 0.15);
    border: 1px solid rgba(168, 85, 247, 0.3);
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .sheet-title {
    font-size: 16px;
    font-weight: 700;
    color: #ffffff;
    margin: 0;
    line-height: 1.2;
  }

  .sheet-subtitle {
    font-size: 12px;
    color: #94a3b8;
    margin: 2px 0 0 0;
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
    padding: 6px 10px;
    border-radius: 6px;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.1);
    color: #94a3b8;
    font-size: 11px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .btn-reset-defaults:hover {
    background: rgba(255, 255, 255, 0.1);
    color: #ffffff;
  }

  .btn-close-sheet {
    width: 34px;
    height: 34px;
    border-radius: 8px;
    background: transparent;
    border: 1px solid rgba(255, 255, 255, 0.1);
    color: #94a3b8;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .btn-close-sheet:hover {
    background: rgba(255, 255, 255, 0.08);
    color: #ffffff;
  }

  /* Category Navigation Tabs */
  .settings-tabs-nav {
    display: flex;
    background: rgba(14, 16, 26, 0.85);
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
    padding: 6px 12px;
    gap: 4px;
    overflow-x: auto;
    scrollbar-width: none;
  }

  .settings-tabs-nav::-webkit-scrollbar {
    display: none;
  }

  .nav-tab-btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 8px 12px;
    border-radius: 8px;
    background: transparent;
    border: none;
    color: #94a3b8;
    font-size: 12px;
    font-weight: 600;
    white-space: nowrap;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .nav-tab-btn:hover {
    color: #f1f5f9;
    background: rgba(255, 255, 255, 0.04);
  }

  .nav-tab-btn.active {
    background: rgba(168, 85, 247, 0.18);
    color: #d8b4fe;
    box-shadow: inset 0 0 0 1px rgba(168, 85, 247, 0.35);
  }

  /* Scroll Body */
  .sheet-scroll-body {
    flex: 1;
    overflow-y: auto;
    padding: 20px;
    overscroll-behavior: contain;
  }

  .tab-pane {
    display: flex;
    flex-direction: column;
    gap: 22px;
  }

  /* Sections */
  .settings-section {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .section-heading-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .section-heading {
    font-size: 13px;
    font-weight: 700;
    color: #cbd5e1;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .value-chip {
    font-size: 11px;
    font-weight: 700;
    color: #c084fc;
    background: rgba(168, 85, 247, 0.15);
    padding: 2px 8px;
    border-radius: 6px;
    border: 1px solid rgba(168, 85, 247, 0.3);
  }

  /* Themes */
  .theme-cards-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 10px;
  }

  .theme-card-option {
    border-radius: 12px;
    border: 1px solid rgba(255, 255, 255, 0.1);
    padding: 12px 10px;
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    gap: 8px;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .theme-card-option.active {
    border-color: #a855f7;
    box-shadow: 0 0 12px rgba(168, 85, 247, 0.4);
  }

  .theme-card-preview {
    width: 24px;
    height: 24px;
    border-radius: 50%;
    border: 2px solid;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .theme-check-icon {
    color: #ffffff;
  }

  .theme-name {
    font-size: 12px;
    font-weight: 700;
    color: #f8fafc;
  }

  .theme-desc {
    font-size: 10px;
    color: #94a3b8;
  }

  /* Width Presets */
  .preset-pill-row {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 6px;
  }

  .preset-pill-btn {
    padding: 8px 4px;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 8px;
    color: #94a3b8;
    font-size: 11px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .preset-pill-btn:hover {
    background: rgba(255, 255, 255, 0.08);
    color: #f8fafc;
  }

  .preset-pill-btn.active {
    background: rgba(168, 85, 247, 0.18);
    color: #d8b4fe;
    border-color: rgba(168, 85, 247, 0.4);
    font-weight: 700;
  }

  /* Slider */
  .slider-control-box {
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 8px 0;
  }

  .nox-slider {
    width: 100%;
    accent-color: #a855f7;
    cursor: pointer;
  }

  .slider-ticks-row {
    display: flex;
    justify-content: space-between;
    font-size: 10px;
    color: #64748b;
  }

  /* Toggle Cards */
  .toggle-card {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 14px;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 12px;
    cursor: pointer;
    gap: 12px;
  }

  .toggle-info {
    display: flex;
    flex-direction: column;
    gap: 3px;
  }

  .toggle-title {
    font-size: 13px;
    font-weight: 600;
    color: #f1f5f9;
  }

  .toggle-desc {
    font-size: 11px;
    color: #94a3b8;
    line-height: 1.3;
  }

  .nox-switch {
    width: 20px;
    height: 20px;
    accent-color: #a855f7;
    cursor: pointer;
    flex-shrink: 0;
  }

  /* Segmented Controls */
  .segmented-control-large {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
  }

  .segment-choice {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 12px 14px;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 12px;
    color: #94a3b8;
    text-align: left;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .segment-choice strong {
    display: block;
    font-size: 13px;
    color: #e2e8f0;
  }

  .segment-choice small {
    display: block;
    font-size: 10px;
    color: #64748b;
    margin-top: 2px;
  }

  .segment-choice.active {
    background: rgba(168, 85, 247, 0.15);
    border-color: rgba(168, 85, 247, 0.4);
    color: #c084fc;
    box-shadow: 0 0 12px rgba(168, 85, 247, 0.25);
  }

  .segment-choice.active strong {
    color: #f8fafc;
  }

  .segmented-control-pills {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }

  .seg-pill {
    flex: 1 1 calc(50% - 6px);
    padding: 10px 8px;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 8px;
    color: #94a3b8;
    font-size: 11px;
    font-weight: 600;
    cursor: pointer;
    text-align: center;
    transition: all 0.2s ease;
  }

  .seg-pill:hover {
    background: rgba(255, 255, 255, 0.08);
    color: #f8fafc;
  }

  .seg-pill.active {
    background: rgba(168, 85, 247, 0.18);
    color: #d8b4fe;
    border-color: rgba(168, 85, 247, 0.4);
  }

  /* Progress Positions */
  .position-cards-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
  }

  .position-card-btn {
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 12px;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 10px;
    text-align: left;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .position-card-btn:hover {
    background: rgba(255, 255, 255, 0.06);
  }

  .position-card-btn.active {
    background: rgba(168, 85, 247, 0.15);
    border-color: rgba(168, 85, 247, 0.4);
    box-shadow: 0 0 10px rgba(168, 85, 247, 0.2);
  }

  .pos-card-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .pos-card-title {
    font-size: 13px;
    font-weight: 700;
    color: #f8fafc;
  }

  .pos-check-icon {
    color: #c084fc;
  }

  .pos-card-desc {
    font-size: 10px;
    color: #94a3b8;
    line-height: 1.3;
  }

  /* Turbo / Preload Cards */
  .preload-mode-cards {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .preload-mode-card {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 14px;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 12px;
    text-align: left;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .preload-mode-card:hover {
    background: rgba(255, 255, 255, 0.06);
  }

  .preload-mode-card.active {
    background: rgba(168, 85, 247, 0.12);
    border-color: rgba(168, 85, 247, 0.4);
    box-shadow: 0 0 12px rgba(168, 85, 247, 0.2);
  }

  .preload-card-top {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .preload-title-group {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .preload-title-group strong {
    display: block;
    font-size: 13px;
    color: #f8fafc;
  }

  .badge-recommended {
    display: inline-block;
    font-size: 9px;
    font-weight: 800;
    color: #a855f7;
    background: rgba(168, 85, 247, 0.2);
    padding: 1px 6px;
    border-radius: 4px;
    margin-top: 2px;
  }

  .badge-eco {
    display: inline-block;
    font-size: 9px;
    font-weight: 800;
    color: #34d399;
    background: rgba(52, 211, 153, 0.2);
    padding: 1px 6px;
    border-radius: 4px;
    margin-top: 2px;
  }

  .preload-desc {
    font-size: 11px;
    color: #94a3b8;
    line-height: 1.4;
    margin: 0;
  }

  .settings-tip-box {
    display: flex;
    gap: 10px;
    padding: 12px;
    background: rgba(168, 85, 247, 0.08);
    border: 1px solid rgba(168, 85, 247, 0.2);
    border-radius: 10px;
    font-size: 11px;
    color: #cbd5e1;
    line-height: 1.4;
  }

  .settings-tip-box p {
    margin: 0;
  }
</style>
