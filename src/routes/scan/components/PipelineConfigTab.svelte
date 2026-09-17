<script lang="ts">
  import {
    Sliders,
    Plus,
    X,
    Check,
    Palette,
    Layers,
    Save,
    Trash2,
    MoveUp,
    MoveDown,
    AlertCircle
  } from '@lucide/svelte';
  import { enhance } from '$app/forms';

  let {
    stages = [],
    scanId,
    pipelineTemplates = [],
    userRole = 'MEMBER'
  } = $props();

  let showNewStageModal = $state(false);
  let newStageName = $state('');
  let newStageSlug = $state('');
  let newStageColor = $state('#8b5cf6');
  let newStageRequired = $state(true);
  let newStageDesc = $state('');

  let selectedTemplate = $state('MANHWA');
</script>

<div class="pipeline-config-container">
  <header class="config-header">
    <div>
      <div class="title-cluster">
        <Sliders size={20} class="text-purple-400" />
        <h1>Configurao do Pipeline & Automao</h1>
      </div>
      <p class="subtitle">rea exclusiva da administrao. Ajuste as etapas, dependncias, cores e templates sem poluir a operao diria.</p>
    </div>

    <button type="button" class="btn-primary" onclick={() => (showNewStageModal = true)}>
      <Plus size={15} />
      <span>Nova Etapa Personalizada</span>
    </button>
  </header>

  <!-- Template Selector Section -->
  <section class="config-section">
    <h2>Template de Fluxo de Trabalho</h2>
    <p class="section-desc">Escolha um dos modelos pr-configurados para a sua Scan ou mantenha o fluxo customizado.</p>

    <div class="templates-grid">
      {#each pipelineTemplates as tpl}
        <div class="template-card" class:active={selectedTemplate === tpl.code}>
          <div class="template-top">
            <span class="template-name">{tpl.name}</span>
            {#if selectedTemplate === tpl.code}
              <span class="active-badge">ATIVO</span>
            {/if}
          </div>
          <p class="template-desc">{tpl.description}</p>
          <div class="template-stages-preview">
            {#each (tpl.stages || []).slice(0, 5) as s}
              <span class="stage-tag" style="background: {s.color || '#8b5cf6'}22; color: {s.color || '#8b5cf6'}; border: 1px solid {s.color || '#8b5cf6'}44">
                {s.name}
              </span>
            {/each}
            {#if (tpl.stages || []).length > 5}
              <span class="stage-more">+{tpl.stages.length - 5}</span>
            {/if}
          </div>
        </div>
      {/each}
    </div>
  </section>

  <!-- Active Stages Table -->
  <section class="config-section">
    <h2>Etapas Ativas ({stages.length})</h2>
    <p class="section-desc">Sequncia operacional atual seguida pelos captulos desta scan.</p>

    <div class="stages-table">
      {#each stages as st, idx}
        <div class="stage-row">
          <span class="stage-index">{idx + 1}</span>
          <div class="stage-color-dot" style="background: {st.color || '#8b5cf6'}"></div>
          <div class="stage-main-info">
            <span class="stage-title">{st.name}</span>
            <span class="stage-slug">Slug: {st.slug}</span>
          </div>
          <div class="stage-desc-col">
            <span>{st.description || 'Sem descrio'}</span>
          </div>
          <div class="stage-flags">
            {#if st.required}
              <span class="flag-pill required">Obrigatria</span>
            {:else}
              <span class="flag-pill optional">Opcional</span>
            {/if}
          </div>
        </div>
      {/each}
    </div>
  </section>
</div>

<!-- Modal: New Stage -->
{#if showNewStageModal}
  <div class="modal-backdrop" onclick={() => (showNewStageModal = false)}>
    <div class="modal-window" onclick={(e) => e.stopPropagation()}>
      <header class="modal-header">
        <h2>Adicionar Nova Etapa ao Pipeline</h2>
        <button type="button" class="btn-close" onclick={() => (showNewStageModal = false)}>
          <X size={18} />
        </button>
      </header>

      <form method="POST" action="?/savePipelineStage" use:enhance class="modal-form">
        <input type="hidden" name="scan_id" value={scanId} />

        <div class="form-group">
          <label for="stage-name">Nome da Etapa *</label>
          <input
            id="stage-name"
            type="text"
            name="name"
            bind:value={newStageName}
            placeholder="Ex: Redraw Especial, Reviso Extra"
            class="form-input"
            required
          />
        </div>

        <div class="form-row">
          <div class="form-group flex-1">
            <label for="stage-color">Cor da Etapa</label>
            <input id="stage-color" type="color" name="color" bind:value={newStageColor} class="form-color-input" />
          </div>

          <div class="form-group flex-1 pt-6">
            <label class="checkbox-label">
              <input type="checkbox" name="required" bind:checked={newStageRequired} value="true" />
              <span>Etapa Obrigatria</span>
            </label>
          </div>
        </div>

        <div class="form-group">
          <label for="stage-desc">Descrio / Instrues</label>
          <textarea
            id="stage-desc"
            name="description"
            bind:value={newStageDesc}
            rows={3}
            placeholder="Instrues para a equipe nesta etapa..."
            class="form-textarea"
          ></textarea>
        </div>

        <footer class="modal-footer">
          <button type="button" class="btn-cancel" onclick={() => (showNewStageModal = false)}>
            Cancelar
          </button>
          <button type="submit" class="btn-submit" disabled={!newStageName.trim()}>
            Criar Etapa
          </button>
        </footer>
      </form>
    </div>
  </div>
{/if}

<style>
  .pipeline-config-container {
    padding: 24px;
    max-width: 1080px;
    margin: 0 auto;
    display: flex;
    flex-direction: column;
    gap: 24px;
  }

  .config-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    border-bottom: 1px solid rgba(255, 255, 255, 0.06);
    padding-bottom: 16px;
  }

  .title-cluster {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .title-cluster h1 {
    font-size: 20px;
    font-weight: 800;
    color: #f8fafc;
    margin: 0;
  }

  .subtitle {
    font-size: 13px;
    color: #94a3b8;
    margin: 4px 0 0;
  }

  .btn-primary {
    all: unset;
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 9px 16px;
    background: #8b5cf6;
    color: #fff;
    font-size: 13px;
    font-weight: 600;
    border-radius: 8px;
    cursor: pointer;
  }

  .config-section {
    background: #0d0a18;
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: 10px;
    padding: 20px;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .config-section h2 {
    font-size: 15px;
    font-weight: 700;
    color: #f1f5f9;
    margin: 0;
  }

  .section-desc {
    font-size: 12.5px;
    color: #94a3b8;
    margin: 0 0 8px;
  }

  /* Templates Grid */
  .templates-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
    gap: 12px;
  }

  .template-card {
    background: rgba(255, 255, 255, 0.02);
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: 8px;
    padding: 14px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .template-card.active {
    border-color: rgba(139, 92, 246, 0.4);
    background: rgba(139, 92, 246, 0.04);
  }

  .template-top {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .template-name {
    font-size: 13px;
    font-weight: 700;
    color: #f8fafc;
  }

  .active-badge {
    font-size: 9.5px;
    font-weight: 800;
    padding: 1px 6px;
    border-radius: 4px;
    background: rgba(16, 185, 129, 0.2);
    color: #34d399;
  }

  .template-desc {
    font-size: 11.5px;
    color: #94a3b8;
    margin: 0;
    line-height: 1.4;
  }

  .template-stages-preview {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    margin-top: 4px;
  }

  .stage-tag {
    font-size: 9.5px;
    font-weight: 700;
    padding: 2px 6px;
    border-radius: 4px;
  }

  .stage-more {
    font-size: 9.5px;
    color: #64748b;
    padding: 2px 4px;
  }

  /* Stages Table */
  .stages-table {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .stage-row {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 10px 14px;
    background: rgba(255, 255, 255, 0.02);
    border-radius: 6px;
  }

  .stage-index {
    font-size: 12px;
    font-weight: 800;
    color: #64748b;
    width: 20px;
  }

  .stage-color-dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
  }

  .stage-main-info {
    display: flex;
    flex-direction: column;
    width: 160px;
  }

  .stage-title {
    font-size: 13px;
    font-weight: 700;
    color: #f1f5f9;
  }

  .stage-slug {
    font-size: 10px;
    color: #64748b;
  }

  .stage-desc-col {
    flex: 1;
    font-size: 12px;
    color: #94a3b8;
  }

  .flag-pill {
    font-size: 10px;
    font-weight: 700;
    padding: 2px 8px;
    border-radius: 4px;
  }

  .flag-pill.required { background: rgba(139, 92, 246, 0.15); color: #c4b5fd; }
  .flag-pill.optional { background: rgba(255, 255, 255, 0.06); color: #94a3b8; }

  /* Modal */
  .modal-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.75);
    backdrop-filter: blur(4px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 70;
    padding: 16px;
  }

  .modal-window {
    background: #0e0b1c;
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 12px;
    width: 100%;
    max-width: 520px;
    overflow: hidden;
  }

  .modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px 20px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  }

  .modal-header h2 { font-size: 16px; font-weight: 700; color: #fff; margin: 0; }
  .btn-close { all: unset; cursor: pointer; color: #94a3b8; }

  .modal-form { padding: 20px; display: flex; flex-direction: column; gap: 14px; }
  .form-group { display: flex; flex-direction: column; gap: 6px; }
  .form-group label { font-size: 12px; font-weight: 600; color: #cbd5e1; }
  .form-row { display: flex; align-items: center; gap: 12px; }
  .flex-1 { flex: 1; }
  .pt-6 { padding-top: 16px; }
  .checkbox-label { display: flex; align-items: center; gap: 6px; font-size: 12px; color: #cbd5e1; cursor: pointer; }

  .form-input, .form-textarea {
    background: #090712;
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 6px;
    padding: 8px 12px;
    color: #fff;
    font-size: 13px;
    outline: none;
  }

  .form-color-input {
    all: unset;
    width: 100%;
    height: 36px;
    border-radius: 6px;
    cursor: pointer;
  }

  .modal-footer {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 10px;
    margin-top: 10px;
  }

  .btn-cancel { all: unset; padding: 8px 14px; font-size: 12.5px; color: #94a3b8; cursor: pointer; }
  .btn-submit { all: unset; padding: 8px 18px; background: #8b5cf6; color: #fff; font-size: 12.5px; font-weight: 600; border-radius: 6px; cursor: pointer; }
</style>
