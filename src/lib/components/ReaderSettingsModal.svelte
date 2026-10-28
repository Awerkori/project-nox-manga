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
    AlignJustify
  } from '@lucide/svelte';
  import type { ReaderSettings } from '$lib/reader-settings';
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

  function setMode(m: 'webtoon' | 'paginated') {
    local.mode = m;
    onUpdate({ ...local });
  }

  function setFit(fit: 'container' | 'full' | 'custom', widthValue?: number) {
    local.fit = fit;
    if (widthValue) local.width = widthValue;
    onUpdate({ ...local });
  }

  function setTheme(t: 'dark' | 'oled' | 'sepia') {
    local.theme = t;
    onUpdate({ ...local });
  }

  function toggleProgressBar() {
    local.progressBar = !local.progressBar;
    onUpdate({ ...local });
  }

  function setProgressPosition(pos: 'bottom' | 'top') {
    local.progressPosition = pos;
    onUpdate({ ...local });
  }

  function setProgressDisplay(disp: 'percent' | 'pages' | 'both') {
    local.progressDisplay = disp;
    onUpdate({ ...local });
  }

  function toggleGap() {
    local.gap = !local.gap;
    onUpdate({ ...local });
  }

  function handleReset() {
    local = { ...DEFAULT_READER_SETTINGS };
    onUpdate({ ...local });
  }
</script>

<div
  class="settings-backdrop"
  onclick={onClose}
  onkeydown={(e) => { if (e.key === 'Escape') onClose(); }}
  role="button"
  tabindex="0"
  aria-label="Fechar ajustes"
></div>

<aside class="settings-sheet" role="dialog" aria-modal="true" aria-label="Ajustes de Leitura">
  <div class="sheet-header">
    <div class="sheet-title-row">
      <Sliders size={18} class="text-purple-400" />
      <h2>Ajustes de Leitura</h2>
    </div>
    <div class="sheet-header-actions">
      <button
        type="button"
        class="btn-reset-defaults"
        onclick={handleReset}
        title="Restaurar padrões"
        aria-label="Restaurar configurações padrão"
      >
        <RotateCcw size={14} />
        <span>Padrões</span>
      </button>
      <button
        type="button"
        class="btn-close-sheet"
        onclick={onClose}
        aria-label="Fechar ajustes de leitura"
      >
        <X size={18} />
      </button>
    </div>
  </div>

  <div class="sheet-scroll-body">
    <!-- 1. Modo de Leitura -->
    <div class="settings-group">
      <div class="group-label">
        <AlignJustify size={14} />
        <span>Modo de Leitura</span>
      </div>
      <div class="segmented-control">
        <button
          type="button"
          class="segment-btn"
          class:active={local.mode === 'webtoon'}
          onclick={() => setMode('webtoon')}
        >
          <span class="segment-title">Webtoon</span>
          <span class="segment-desc">Rolagem Contínua</span>
        </button>
        <button
          type="button"
          class="segment-btn"
          class:active={local.mode === 'paginated'}
          onclick={() => setMode('paginated')}
        >
          <span class="segment-title">Por Página</span>
          <span class="segment-desc">Toque / Teclado</span>
        </button>
      </div>
    </div>

    <!-- 2. Barra de Progresso (Mihon) -->
    <div class="settings-group highlight-box">
      <div class="group-header-with-toggle">
        <div class="group-label">
          <Zap size={14} class="text-amber-400" />
          <span>Barra de Progresso (Estilo Mihon)</span>
        </div>
        <button
          type="button"
          class="toggle-switch"
          class:active={local.progressBar}
          onclick={toggleProgressBar}
          role="switch"
          aria-checked={local.progressBar}
          aria-label="Ativar barra de progresso"
        >
          <span class="toggle-dot"></span>
        </button>
      </div>

      {#if local.progressBar}
        <div class="sub-settings-row">
          <div class="sub-setting-col">
            <span class="sub-label">Posição:</span>
            <div class="mini-segmented">
              <button
                type="button"
                class="mini-btn"
                class:active={local.progressPosition === 'bottom'}
                onclick={() => setProgressPosition('bottom')}
              >
                Rodapé
              </button>
              <button
                type="button"
                class="mini-btn"
                class:active={local.progressPosition === 'top'}
                onclick={() => setProgressPosition('top')}
              >
                Topo
              </button>
            </div>
          </div>

          <div class="sub-setting-col">
            <span class="sub-label">Exibição:</span>
            <div class="mini-segmented">
              <button
                type="button"
                class="mini-btn"
                class:active={local.progressDisplay === 'percent'}
                onclick={() => setProgressDisplay('percent')}
              >
                %
              </button>
              <button
                type="button"
                class="mini-btn"
                class:active={local.progressDisplay === 'pages'}
                onclick={() => setProgressDisplay('pages')}
              >
                Páginas
              </button>
              <button
                type="button"
                class="mini-btn"
                class:active={local.progressDisplay === 'both'}
                onclick={() => setProgressDisplay('both')}
              >
                Ambos
              </button>
            </div>
          </div>
        </div>
      {/if}
    </div>

    <!-- 3. Largura das Páginas -->
    <div class="settings-group">
      <div class="group-label">
        <Monitor size={14} />
        <span>Largura das Páginas</span>
      </div>
      <div class="preset-pills-row">
        <button
          type="button"
          class="pill-btn"
          class:active={local.width === 650 && local.fit === 'custom'}
          onclick={() => setFit('custom', 650)}
        >
          650px
        </button>
        <button
          type="button"
          class="pill-btn"
          class:active={local.width === 850 && local.fit === 'custom'}
          onclick={() => setFit('custom', 850)}
        >
          850px
        </button>
        <button
          type="button"
          class="pill-btn"
          class:active={local.width === 1050 && local.fit === 'custom'}
          onclick={() => setFit('custom', 1050)}
        >
          1050px
        </button>
        <button
          type="button"
          class="pill-btn"
          class:active={local.fit === 'full'}
          onclick={() => setFit('full', 1400)}
        >
          100% Tela
        </button>
      </div>

      <div class="slider-box">
        <div class="slider-header">
          <span>Ajuste fino:</span>
          <strong>{local.fit === 'full' ? '100% da tela' : `${local.width}px`}</strong>
        </div>
        <input
          type="range"
          min="400"
          max="1400"
          step="25"
          value={local.width}
          disabled={local.fit === 'full'}
          oninput={(e) => {
            local.fit = 'custom';
            local.width = Number((e.target as HTMLInputElement).value);
            onUpdate({ ...local });
          }}
          class="range-slider"
          aria-label="Largura personalizada das páginas"
        />
      </div>
    </div>

    <!-- 4. Tema de Fundo -->
    <div class="settings-group">
      <div class="group-label">
        <Palette size={14} />
        <span>Cor de Fundo do Leitor</span>
      </div>
      <div class="theme-options-row">
        <button
          type="button"
          class="theme-card"
          class:active={local.theme === 'dark'}
          onclick={() => setTheme('dark')}
        >
          <span class="theme-preview dark-bg"></span>
          <span class="theme-name">Nox Dark</span>
        </button>
        <button
          type="button"
          class="theme-card"
          class:active={local.theme === 'oled'}
          onclick={() => setTheme('oled')}
        >
          <span class="theme-preview oled-bg"></span>
          <span class="theme-name">OLED Black</span>
        </button>
        <button
          type="button"
          class="theme-card"
          class:active={local.theme === 'sepia'}
          onclick={() => setTheme('sepia')}
        >
          <span class="theme-preview sepia-bg"></span>
          <span class="theme-name">Sépia Noturno</span>
        </button>
      </div>
    </div>

    <!-- 5. Espaçamento & Pré-carregamento -->
    <div class="settings-group">
      <div class="checkbox-setting-row">
        <label class="custom-checkbox-label">
          <input
            type="checkbox"
            checked={local.gap}
            onchange={toggleGap}
            class="custom-checkbox"
          />
          <div class="label-info">
            <span class="checkbox-title">Espaçamento entre páginas</span>
            <span class="checkbox-desc">Adiciona intervalo de 20px entre quadros</span>
          </div>
        </label>
      </div>

      <div class="field-select-row">
        <div class="label-info">
          <span class="field-title">Carregamento Inteligente</span>
          <span class="field-desc">Controle de consumo de dados e cache</span>
        </div>
        <select
          value={local.preload}
          onchange={(e) => {
            local.preload = (e.currentTarget.value as 'full' | 'off');
            onUpdate({ ...local });
          }}
          class="select-control"
          aria-label="Modo de pré-carregamento"
        >
          <option value="full">Capítulo Completo (Rápido)</option>
          <option value="off">Econômico (Menos dados/RAM)</option>
        </select>
      </div>
    </div>

    <!-- 6. Pular para página -->
    {#if totalPages > 1}
      <div class="settings-group">
        <div class="field-select-row">
          <div class="label-info">
            <span class="field-title">Ir para Página</span>
            <span class="field-desc">Página atual: {currentPage} de {totalPages}</span>
          </div>
          <select
            value={currentPage}
            onchange={(e) => onJumpPage(Number(e.currentTarget.value))}
            class="select-control"
            aria-label="Pular para página específica"
          >
            {#each Array.from({ length: totalPages }, (_, i) => i + 1) as p}
              <option value={p}>Página {p}</option>
            {/each}
          </select>
        </div>
      </div>
    {/if}
  </div>

  <div class="sheet-footer">
    <button type="button" class="btn-done" onclick={onClose}>
      Concluir Ajustes
    </button>
  </div>
</aside>

<style>
  .settings-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.7);
    backdrop-filter: blur(4px);
    z-index: 100;
    cursor: pointer;
  }

  .settings-sheet {
    position: fixed;
    top: 0;
    right: 0;
    bottom: 0;
    width: 100%;
    max-width: 440px;
    background: #090b14;
    border-left: 1px solid rgba(181, 154, 245, 0.2);
    box-shadow: -10px 0 35px rgba(0, 0, 0, 0.85);
    z-index: 101;
    display: flex;
    flex-direction: column;
    animation: slideInRight 0.25s cubic-bezier(0.16, 1, 0.3, 1);
  }

  @keyframes slideInRight {
    from { transform: translateX(100%); }
    to { transform: translateX(0); }
  }

  .sheet-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 18px 20px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
    background: rgba(11, 13, 23, 0.95);
  }

  .sheet-title-row {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .sheet-title-row h2 {
    font-size: 16px;
    font-weight: 750;
    color: #f2f0f7;
    margin: 0;
  }

  .sheet-header-actions {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .btn-reset-defaults {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    background: transparent;
    border: none;
    color: #9d9aa9;
    font-size: 12px;
    cursor: pointer;
    padding: 4px 8px;
    border-radius: 6px;
    transition: color 0.2s, background 0.2s;
  }

  .btn-reset-defaults:hover {
    color: #c084fc;
    background: rgba(192, 132, 252, 0.1);
  }

  .btn-close-sheet {
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.1);
    color: #9d9aa9;
    width: 32px;
    height: 32px;
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: background 0.2s, color 0.2s;
  }

  .btn-close-sheet:hover {
    background: rgba(255, 255, 255, 0.12);
    color: #fff;
  }

  .sheet-scroll-body {
    flex: 1;
    overflow-y: auto;
    padding: 20px;
    display: flex;
    flex-direction: column;
    gap: 20px;
  }

  .settings-group {
    background: rgba(16, 18, 30, 0.7);
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: 14px;
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .settings-group.highlight-box {
    background: rgba(26, 18, 48, 0.5);
    border-color: rgba(168, 85, 247, 0.25);
  }

  .group-label {
    display: flex;
    align-items: center;
    gap: 8px;
    color: #c4c1d3;
    font-size: 13px;
    font-weight: 700;
  }

  .group-header-with-toggle {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .segmented-control {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
    background: rgba(0, 0, 0, 0.35);
    padding: 4px;
    border-radius: 10px;
  }

  .segment-btn {
    background: transparent;
    border: 1px solid transparent;
    border-radius: 8px;
    padding: 8px 10px;
    display: flex;
    flex-direction: column;
    align-items: center;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .segment-btn.active {
    background: rgba(168, 85, 247, 0.2);
    border-color: rgba(192, 132, 252, 0.5);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.4);
  }

  .segment-title {
    color: #f2f0f7;
    font-size: 13px;
    font-weight: 700;
  }

  .segment-desc {
    color: #9d9aa9;
    font-size: 11px;
    margin-top: 2px;
  }

  .segment-btn.active .segment-title {
    color: #e9d5ff;
  }

  .toggle-switch {
    width: 44px;
    height: 24px;
    background: rgba(255, 255, 255, 0.15);
    border-radius: 999px;
    border: none;
    position: relative;
    cursor: pointer;
    transition: background 0.25s ease;
  }

  .toggle-switch.active {
    background: #7c3aed;
  }

  .toggle-dot {
    position: absolute;
    top: 2px;
    left: 2px;
    width: 20px;
    height: 20px;
    background: #fff;
    border-radius: 50%;
    transition: transform 0.25s cubic-bezier(0.16, 1, 0.3, 1);
  }

  .toggle-switch.active .toggle-dot {
    transform: translateX(20px);
  }

  .sub-settings-row {
    display: flex;
    flex-direction: column;
    gap: 10px;
    margin-top: 4px;
    padding-top: 10px;
    border-top: 1px solid rgba(255, 255, 255, 0.06);
  }

  .sub-setting-col {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }

  .sub-label {
    font-size: 12px;
    color: #a7a3b6;
    font-weight: 600;
  }

  .mini-segmented {
    display: flex;
    gap: 4px;
    background: rgba(0, 0, 0, 0.3);
    padding: 3px;
    border-radius: 7px;
  }

  .mini-btn {
    background: transparent;
    border: none;
    color: #8c899a;
    font-size: 11px;
    font-weight: 600;
    padding: 3px 8px;
    border-radius: 5px;
    cursor: pointer;
    transition: all 0.2s;
  }

  .mini-btn.active {
    background: #7c3aed;
    color: #fff;
  }

  .preset-pills-row {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 6px;
  }

  .pill-btn {
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.08);
    color: #d1cddc;
    font-size: 11px;
    font-weight: 600;
    padding: 6px 4px;
    border-radius: 8px;
    cursor: pointer;
    text-align: center;
    transition: all 0.2s;
  }

  .pill-btn.active {
    background: rgba(168, 85, 247, 0.25);
    border-color: rgba(192, 132, 252, 0.5);
    color: #e9d5ff;
  }

  .slider-box {
    display: flex;
    flex-direction: column;
    gap: 6px;
    margin-top: 4px;
  }

  .slider-header {
    display: flex;
    justify-content: space-between;
    font-size: 12px;
    color: #9d9aa9;
  }

  .slider-header strong {
    color: #e9d5ff;
  }

  .range-slider {
    width: 100%;
    accent-color: #9333ea;
    height: 5px;
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.1);
    outline: none;
  }

  .theme-options-row {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 8px;
  }

  .theme-card {
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 10px;
    padding: 10px 6px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    cursor: pointer;
    transition: all 0.2s;
  }

  .theme-card.active {
    border-color: #a855f7;
    background: rgba(168, 85, 247, 0.15);
  }

  .theme-preview {
    width: 24px;
    height: 24px;
    border-radius: 50%;
    border: 1px solid rgba(255, 255, 255, 0.2);
  }

  .dark-bg { background: #06070c; }
  .oled-bg { background: #000000; }
  .sepia-bg { background: #161219; }

  .theme-name {
    font-size: 11px;
    font-weight: 600;
    color: #c4c1d3;
  }

  .checkbox-setting-row {
    padding-bottom: 10px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  }

  .custom-checkbox-label {
    display: flex;
    align-items: flex-start;
    gap: 10px;
    cursor: pointer;
  }

  .custom-checkbox {
    accent-color: #9333ea;
    width: 16px;
    height: 16px;
    margin-top: 2px;
  }

  .label-info {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .checkbox-title, .field-title {
    font-size: 13px;
    font-weight: 600;
    color: #e2dfec;
  }

  .checkbox-desc, .field-desc {
    font-size: 11px;
    color: #8c899a;
  }

  .field-select-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  }

  .select-control {
    background: rgba(0, 0, 0, 0.4);
    border: 1px solid rgba(255, 255, 255, 0.15);
    color: #f2f0f7;
    font-size: 12px;
    border-radius: 8px;
    padding: 6px 10px;
    outline: none;
    cursor: pointer;
  }

  .select-control:focus {
    border-color: #a855f7;
  }

  .sheet-footer {
    padding: 16px 20px;
    border-top: 1px solid rgba(255, 255, 255, 0.08);
    background: rgba(11, 13, 23, 0.95);
  }

  .btn-done {
    width: 100%;
    padding: 10px;
    background: linear-gradient(135deg, #7c3aed, #9333ea);
    border: none;
    border-radius: 10px;
    color: #fff;
    font-size: 14px;
    font-weight: 700;
    cursor: pointer;
    box-shadow: 0 4px 14px rgba(124, 58, 237, 0.4);
    transition: transform 0.15s, opacity 0.15s;
  }

  .btn-done:hover {
    transform: translateY(-1px);
    opacity: 0.95;
  }
</style>
