<script lang="ts">
  import {
    ArrowLeft,
    Layers,
    ListTodo,
    FolderArchive,
    MessageSquare,
    Eye,
    CheckSquare,
    Clock,
    User,
    Upload,
    Download,
    Plus,
    X,
    CheckCircle2,
    AlertTriangle,
    AlertCircle,
    FileText,
    Sparkles,
    Send,
    ExternalLink,
    BookOpen,
    Lock,
    RotateCcw,
    History,
    ShieldCheck,
    Check
  } from '@lucide/svelte';
  import { enhance } from '$app/forms';
  import { invalidateAll } from '$app/navigation';
  import { relativeTime } from '$lib/types';
  import UserAvatar from '$lib/components/UserAvatar.svelte';

  let {
    chapterId,
    scanId,
    userProfile,
    currentUserId = '',
    userRole = 'MEMBER',
    chapters = [],
    stages = [],
    chapterStages = [],
    productionFiles = [],
    chapterTimeline = [],
    tasks = [],
    qcIssues = [],
    team = [],
    onBackToPipeline = () => {}
  } = $props();

  // Find current chapter
  let chapterItem = $derived(
    chapters.find((c: any) => (c.chapters?.id || c.id) === chapterId || c.target_chapter_id === chapterId) ||
      chapters[0] ||
      null
  );

  let chapterData = $derived(chapterItem?.chapters || chapterItem || {});
  let workData = $derived(chapterData?.works || chapterData?.work || {});
  let actualChapterId = $derived(chapterData.id || chapterId);
  let previewId = $derived(chapterData.target_chapter_id || actualChapterId);

  // Stages for this chapter
  let currentChapterStages = $derived(
    chapterStages
      .filter((cs: any) => cs.production_chapter_id === actualChapterId)
      .sort((a: any, b: any) => (a.stage?.display_order || 0) - (b.stage?.display_order || 0))
  );

  // Files for this chapter
  let currentChapterFiles = $derived(
    productionFiles
      .filter((f: any) => f.production_chapter_id === actualChapterId)
      .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
  );

  // Timeline for this chapter
  let currentChapterTimeline = $derived(
    chapterTimeline
      .filter((t: any) => t.production_chapter_id === actualChapterId)
      .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
  );

  // QC issues for this chapter
  let currentQcIssues = $derived(
    qcIssues.filter((q: any) => q.chapter_id === actualChapterId || q.chapter_id === chapterId)
  );
  let openQcCount = $derived(currentQcIssues.filter((q: any) => q.status === 'OPEN').length);

  // Sub-navigation: 'work' (Seu Trabalho) is the primary focused tab!
  let activeTab = $state<'work' | 'files' | 'history' | 'qc' | 'chat'>('work');

  // Active Stage selection in "Seu Trabalho"
  // Default to the first stage that is IN_PROGRESS or AVAILABLE, or the user's claimed stage
  let selectedStageId = $state<string>('');

  $effect(() => {
    if (currentChapterStages.length > 0 && !selectedStageId) {
      const myStage = currentChapterStages.find((s: any) => s.assigned_to === currentUserId && s.status === 'IN_PROGRESS');
      const inProgressStage = currentChapterStages.find((s: any) => s.status === 'IN_PROGRESS');
      const availStage = currentChapterStages.find((s: any) => s.status === 'AVAILABLE');
      const target = myStage || inProgressStage || availStage || currentChapterStages[0];
      if (target) selectedStageId = target.id;
    }
  });

  let activeStageItem = $derived(
    currentChapterStages.find((s: any) => s.id === selectedStageId) || currentChapterStages[0] || null
  );

  // Upstream dependency files for active stage
  let upstreamFiles = $derived(() => {
    if (!activeStageItem) return [];
    const deps: string[] = activeStageItem.stage?.dependencies || [];
    if (deps.length === 0) return [];

    const result: any[] = [];
    for (const depSlug of deps) {
      const file = currentChapterFiles.find(
        (f: any) => (f.stage_slug === depSlug || f.stage?.slug === depSlug) && f.is_current
      );
      if (file) {
        result.push(file);
      }
    }
    return result;
  });

  // Current deliverable file uploaded for active stage
  let activeStageCurrentFile = $derived(
    activeStageItem
      ? currentChapterFiles.find(
          (f: any) =>
            (f.stage_id === activeStageItem.stage_id ||
              f.stage_slug === activeStageItem.stage?.slug ||
              f.stage?.slug === activeStageItem.stage?.slug) &&
            f.is_current
        )
      : null
  );

  // File upload state for active stage
  let isUploadingFile = $state(false);
  let uploadProgress = $state(0);
  let uploadError = $state('');
  let uploadSuccess = $state('');

  // Rework Return Modal
  let showReworkModal = $state(false);
  let reworkTargetSlug = $state('typeset');
  let reworkReason = $state('');

  // QC modal
  let showNewQcModal = $state(false);
  let qcPageNumber = $state(1);
  let qcType = $state('TYPESET');
  let qcComment = $state('');

  async function handleDeliverableUpload(e: Event) {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file || !activeStageItem) return;

    isUploadingFile = true;
    uploadProgress = 20;
    uploadError = '';
    uploadSuccess = '';

    try {
      const formData = new FormData();
      formData.set('scan_id', scanId);
      formData.set('production_chapter_id', actualChapterId);
      formData.set('stage_id', activeStageItem.stage_id);
      formData.set('file', file);

      uploadProgress = 50;
      const res = await fetch('/api/scan/production/upload', {
        method: 'POST',
        body: formData
      });
      uploadProgress = 85;

      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || 'Falha no upload do arquivo');
      }

      uploadProgress = 100;
      uploadSuccess = `Arquivo "${file.name}" enviado com sucesso (v${data.version || 1})!`;
      await invalidateAll();
    } catch (err: any) {
      uploadError = err.message || 'Erro ao enviar arquivo';
    } finally {
      isUploadingFile = false;
      input.value = '';
    }
  }

  function formatBytes(bytes: number): string {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  // Can the stage be completed?
  // Requires deliverable upload unless requires_output is false (like revisao or qc)
  let requiresDeliverable = $derived(activeStageItem?.stage?.requires_output !== false);
  let hasDeliverable = $derived(Boolean(activeStageCurrentFile));
  let canCompleteStage = $derived(
    activeStageItem &&
      activeStageItem.status === 'IN_PROGRESS' &&
      (!requiresDeliverable || hasDeliverable)
  );

  let isReadyToPublish = $derived(
    chapterData.status === 'READY' ||
      (currentChapterStages.length > 0 &&
        currentChapterStages.every((s: any) => s.status === 'DONE' || s.stage?.slug === 'publicado'))
  );
</script>

<div class="workspace-shell">
  <!-- Top Navigation Bar -->
  <nav class="workspace-nav-bar">
    <button type="button" class="btn-back" onclick={onBackToPipeline}>
      <ArrowLeft size={16} />
      <span>Voltar ao Pipeline</span>
    </button>

    <div class="nav-breadcrumbs">
      <span class="crumb-work">{workData.title || 'Obra'}</span>
      <span class="crumb-sep">/</span>
      <span class="crumb-ch">Capítulo #{chapterData.chapter_number || chapterData.number || '—'}</span>
    </div>

    <div class="nav-right-actions">
      <a
        href="/ler/{previewId}?preview=1"
        target="_blank"
        rel="noopener noreferrer"
        class="btn-preview"
        title="Abrir Leitor de Preview interno"
      >
        <Eye size={14} />
        <span>Leitor de Preview</span>
        <ExternalLink size={12} />
      </a>

      {#if ['OWNER', 'ADMIN', 'UPLOADER'].includes(userRole)}
        <form method="POST" action="?/publishProductionChapter" use:enhance>
          <input type="hidden" name="production_chapter_id" value={actualChapterId} />
          <input type="hidden" name="scan_id" value={scanId} />
          <button
            type="submit"
            class="btn-publish-header"
            disabled={!isReadyToPublish || chapterData.status === 'PUBLISHED'}
          >
            <CheckCircle2 size={15} />
            <span>{chapterData.status === 'PUBLISHED' ? 'Publicado' : 'Publicar no Site'}</span>
          </button>
        </form>
      {/if}
    </div>
  </nav>

  <!-- Workspace Top Hero -->
  <header class="workspace-hero">
    <div class="hero-left">
      <div class="hero-thumb">
        {#if workData.cover_id}
          <img src="/media/{workData.cover_id}" alt={workData.title} class="hero-thumb-img" />
        {:else}
          <BookOpen size={28} class="text-purple-400" />
        {/if}
      </div>

      <div class="hero-title-cluster">
        <div class="hero-series-title">{workData.title || 'Obra em Produção'}</div>
        <h1 class="hero-chapter-heading">
          Capítulo #{chapterData.chapter_number || chapterData.number || '—'}
          {#if chapterData.chapter_title || chapterData.title}
            <span class="hero-chapter-sub">— {chapterData.chapter_title || chapterData.title}</span>
          {/if}
        </h1>

        <div class="hero-badges">
          <div class="hero-badge stage-badge">
            <span class="badge-dot"></span>
            <span>Etapa Atual: {activeStageItem?.stage?.name || 'RAW'}</span>
          </div>

          <div class="hero-badge assignee-badge">
            <User size={13} />
            <span>Responsável: {activeStageItem?.assignee?.display_name || activeStageItem?.assignee?.username || 'Disponível'}</span>
          </div>

          <div class="hero-badge priority-badge">
            <Clock size={13} />
            <span>Prioridade: Alta</span>
          </div>

          {#if openQcCount > 0}
            <div class="hero-badge qc-alert-badge">
              <AlertTriangle size={13} />
              <span>QC: {openQcCount} pendência{openQcCount > 1 ? 's' : ''}</span>
            </div>
          {/if}
        </div>
      </div>
    </div>
  </header>

  <!-- Stepper Bar (Horizontal 7 stages) -->
  <div class="stepper-band">
    <div class="stepper-band-track">
      {#each currentChapterStages as st, idx}
        {@const isSelected = st.id === selectedStageId}
        {@const isDone = st.status === 'DONE'}
        {@const isProgress = st.status === 'IN_PROGRESS'}
        {@const isAvail = st.status === 'AVAILABLE'}
        {@const isRework = st.status === 'REWORK'}

        <button
          type="button"
          class="stepper-band-node"
          class:is-selected={isSelected}
          class:is-done={isDone}
          class:is-progress={isProgress}
          class:is-avail={isAvail}
          class:is-rework={isRework}
          onclick={() => (selectedStageId = st.id)}
        >
          <div class="node-icon-box">
            {#if isDone}
              <Check size={12} />
            {:else if isProgress}
              <span class="node-pulse-dot"></span>
            {:else if isRework}
              <RotateCcw size={10} />
            {:else if isAvail}
              <span class="node-open-dot"></span>
            {:else}
              <Lock size={10} />
            {/if}
          </div>
          <span class="node-title">{st.stage?.name || 'Etapa'}</span>
        </button>

        {#if idx < currentChapterStages.length - 1}
          <div class="node-divider-line" class:line-done={isDone}></div>
        {/if}
      {/each}
    </div>
  </div>

  <!-- Primary Sub-navigation Tabs -->
  <nav class="workspace-tabs">
    <button
      type="button"
      class="tab-link"
      class:active={activeTab === 'work'}
      onclick={() => (activeTab = 'work')}
    >
      <CheckCircle2 size={16} />
      <span>Seu Trabalho</span>
      {#if activeStageItem?.status === 'IN_PROGRESS'}
        <span class="tab-chip progress">Em Andamento</span>
      {/if}
    </button>

    <button
      type="button"
      class="tab-link"
      class:active={activeTab === 'files'}
      onclick={() => (activeTab = 'files')}
    >
      <FolderArchive size={16} />
      <span>Arquivos & Linhagem ({currentChapterFiles.length})</span>
    </button>

    <button
      type="button"
      class="tab-link"
      class:active={activeTab === 'history'}
      onclick={() => (activeTab = 'history')}
    >
      <History size={16} />
      <span>Histórico ({currentChapterTimeline.length})</span>
    </button>

    <button
      type="button"
      class="tab-link"
      class:active={activeTab === 'qc'}
      onclick={() => (activeTab = 'qc')}
    >
      <CheckSquare size={16} />
      <span>QC Inspector ({currentQcIssues.length})</span>
      {#if openQcCount > 0}
        <span class="tab-chip alert">{openQcCount}</span>
      {/if}
    </button>

    <button
      type="button"
      class="tab-link"
      class:active={activeTab === 'chat'}
      onclick={() => (activeTab = 'chat')}
    >
      <MessageSquare size={16} />
      <span>Chat & Notas</span>
    </button>
  </nav>

  <!-- TAB CONTENT -->
  <div class="workspace-tab-viewport">
    <!-- TAB 1: SEU TRABALHO (FOCUSED ACTION) -->
    {#if activeTab === 'work'}
      <section class="work-focused-panel">
        {#if activeStageItem}
          <!-- Stage Status & Actions Header -->
          <div class="stage-hero-bar">
            <div class="stage-hero-left">
              <span class="stage-tag-badge" style="background: {activeStageItem.stage?.color || '#8b5cf6'}22; color: {activeStageItem.stage?.color || '#c4b5fd'}; border-color: {activeStageItem.stage?.color || '#8b5cf6'}55;">
                {activeStageItem.stage?.name}
              </span>
              <div class="stage-state-tag status-{activeStageItem.status.toLowerCase()}">
                Status: {activeStageItem.status === 'DONE' ? 'Concluído' : activeStageItem.status === 'IN_PROGRESS' ? 'Em Andamento' : activeStageItem.status === 'AVAILABLE' ? 'Disponível' : activeStageItem.status === 'REWORK' ? 'Retrabalho Solicitado' : 'Bloqueado'}
              </div>
            </div>

            <!-- Stage Claim / Release Actions -->
            <div class="stage-hero-actions">
              {#if activeStageItem.status === 'AVAILABLE' || activeStageItem.status === 'REWORK'}
                <form method="POST" action="?/claimStage" use:enhance>
                  <input type="hidden" name="chapter_stage_id" value={activeStageItem.id} />
                  <button type="submit" class="btn-claim-primary">
                    <CheckSquare size={15} />
                    <span>Pegar Esta Etapa</span>
                  </button>
                </form>
              {:else if activeStageItem.status === 'IN_PROGRESS' && activeStageItem.assigned_to === currentUserId}
                <form method="POST" action="?/releaseStage" use:enhance>
                  <input type="hidden" name="chapter_stage_id" value={activeStageItem.id} />
                  <button type="submit" class="btn-release-secondary" title="Devolver etapa para a fila de disponíveis">
                    <RotateCcw size={14} />
                    <span>Largar Etapa</span>
                  </button>
                </form>
              {/if}

              <!-- Rework return option for Review & QC -->
              {#if ['revisao', 'qc'].includes(activeStageItem.stage?.slug) && activeStageItem.status === 'IN_PROGRESS'}
                <button
                  type="button"
                  class="btn-rework-trigger"
                  onclick={() => (showReworkModal = true)}
                >
                  <AlertTriangle size={14} />
                  <span>Solicitar Retrabalho</span>
                </button>
              {/if}
            </div>
          </div>

          <!-- Step 1: O que baixar -->
          <div class="editorial-step-card">
            <div class="step-card-header">
              <div class="step-number-bubble">1</div>
              <div>
                <h3 class="step-card-title">O que baixar para trabalhar</h3>
                <p class="step-card-desc">Arquivos upstream gerados pelas etapas anteriores necessários para a execução deste trabalho.</p>
              </div>
            </div>

            <div class="step-card-body">
              {#if upstreamFiles().length > 0}
                <div class="upstream-files-grid">
                  {#each upstreamFiles() as file}
                    <div class="upstream-file-item">
                      <div class="file-icon-box">
                        <FileText size={20} class="text-purple-400" />
                      </div>
                      <div class="file-info-col">
                        <span class="file-name">{file.file_name}</span>
                        <div class="file-sub-tags">
                          <span class="file-tag-stage">Etapa: {file.stage?.name || file.stage_slug}</span>
                          <span class="file-tag-version">v{file.version}</span>
                          <span class="file-tag-size">{formatBytes(file.byte_size)}</span>
                        </div>
                      </div>
                      <a
                        href="/api/scan/production/files/{file.id}?download=1"
                        download={file.file_name}
                        class="btn-download-action"
                      >
                        <Download size={14} />
                        <span>Baixar Arquivo</span>
                      </a>
                    </div>
                  {/each}
                </div>
              {:else}
                <div class="no-upstream-box">
                  <Sparkles size={18} class="text-purple-400" />
                  <span>Esta etapa não requer arquivos anteriores (ex: RAW) ou todas as dependências estão prontas.</span>
                </div>
              {/if}
            </div>
          </div>

          <!-- Step 2: O que fazer -->
          <div class="editorial-step-card">
            <div class="step-card-header">
              <div class="step-number-bubble">2</div>
              <div>
                <h3 class="step-card-title">O que fazer nesta etapa</h3>
                <p class="step-card-desc">Instruções editoriais e diretrizes de qualidade do Project Nox.</p>
              </div>
            </div>

            <div class="step-card-body">
              <div class="instructions-block">
                {#if activeStageItem.stage?.slug === 'raw'}
                  <p>Obtenha os arquivos RAW originais em alta resolução, descompacte, verifique se não faltam páginas e empacote em ZIP/CBZ organizado numericamente (001.jpg, 002.jpg...).</p>
                {:else if activeStageItem.stage?.slug === 'clean_redraw'}
                  <p>Abra as páginas no Photoshop/Clip Studio, limpe todos os textos e balões. Redesenhe onomatopeias e artes de fundo com capricho, preservando os detalhes da arte original.</p>
                {:else if activeStageItem.stage?.slug === 'traducao'}
                  <p>Traduza o texto mantendo o tom dos personagens, fluidez do português e fidelidade ao contexto da obra. Envie o roteiro em arquivo formatado (.docx, .txt ou .psd com texto).</p>
                {:else if activeStageItem.stage?.slug === 'typeset'}
                  <p>Diagramação completa dos balões e onomatopeias utilizando as fontes e tamanhos padrão do guia de estilo da scan. Garanta alinhamento centralizado e legibilidade perfeita.</p>
                {:else if activeStageItem.stage?.slug === 'revisao'}
                  <p>Leitura atenta de todas as páginas diagramadas, caçando erros ortográficos, gramaticais, pontuação ou problemas de concordância. Nenhum upload obrigatório nesta etapa.</p>
                {:else if activeStageItem.stage?.slug === 'qc'}
                  <p>Inspeção final de controle de qualidade página por página. Se encontrar problemas pontuais, registre apontamentos no QC Inspector ou solicite retrabalho.</p>
                {:else}
                  <p>Siga os procedimentos padrão da scan para a etapa {activeStageItem.stage?.name}. Em caso de dúvidas, consulte os líderes no chat da equipe.</p>
                {/if}
              </div>
            </div>
          </div>

          <!-- Step 3: O que enviar (Deliverable Upload) -->
          <div class="editorial-step-card">
            <div class="step-card-header">
              <div class="step-number-bubble">3</div>
              <div>
                <h3 class="step-card-title">O que enviar (Entregável da Etapa)</h3>
                <p class="step-card-desc">
                  {#if requiresDeliverable}
                    Upload obrigatório para que a etapa possa ser concluída e desbloqueie o próximo estágio no pipeline.
                  {:else}
                    Upload opcional nesta etapa (Revisão / QC).
                  {/if}
                </p>
              </div>
            </div>

            <div class="step-card-body">
              <!-- Current active file if exists -->
              {#if activeStageCurrentFile}
                <div class="current-deliverable-card">
                  <div class="deliv-left">
                    <CheckCircle2 size={20} class="text-emerald-400" />
                    <div class="deliv-info">
                      <span class="deliv-name">{activeStageCurrentFile.file_name}</span>
                      <div class="deliv-sub">
                        <span class="deliv-badge-v">Versão v{activeStageCurrentFile.version}</span>
                        <span>{formatBytes(activeStageCurrentFile.byte_size)}</span>
                        <span>•</span>
                        <span>Enviado por {activeStageCurrentFile.uploader?.display_name || activeStageCurrentFile.uploader?.username || 'Membro'}</span>
                      </div>
                    </div>
                  </div>
                  <a
                    href="/api/scan/production/files/{activeStageCurrentFile.id}?download=1"
                    download={activeStageCurrentFile.file_name}
                    class="btn-deliv-download"
                  >
                    <Download size={14} />
                    <span>Baixar</span>
                  </a>
                </div>
              {/if}

              <!-- Upload input form -->
              {#if activeStageItem.status === 'IN_PROGRESS'}
                <div class="upload-dropzone">
                  <Upload size={24} class="text-purple-400" />
                  <div class="upload-text-group">
                    <span class="upload-main-text">
                      {activeStageCurrentFile ? 'Enviar nova versão do arquivo entregável' : 'Selecione ou arraste o arquivo final desta etapa'}
                    </span>
                    <span class="upload-sub-text">Formatos suportados: ZIP, RAR, PSD, KRA, DOCX, CBZ (Máx: 200MB)</span>
                  </div>

                  <label class="btn-select-file" class:disabled={isUploadingFile}>
                    <Upload size={14} />
                    <span>{isUploadingFile ? `Enviando (${uploadProgress}%)...` : 'Selecionar Arquivo'}</span>
                    <input
                      type="file"
                      class="hidden-file-input"
                      onchange={handleDeliverableUpload}
                      disabled={isUploadingFile}
                    />
                  </label>
                </div>

                {#if uploadSuccess}
                  <div class="feedback-box success">
                    <CheckCircle2 size={16} />
                    <span>{uploadSuccess}</span>
                  </div>
                {/if}

                {#if uploadError}
                  <div class="feedback-box error">
                    <AlertCircle size={16} />
                    <span>{uploadError}</span>
                  </div>
                {/if}
              {:else}
                <div class="notice-box-muted">
                  <Lock size={15} />
                  <span>Para enviar arquivos, você precisa primeiro assumir a etapa clicando em "Pegar Esta Etapa".</span>
                </div>
              {/if}
            </div>
          </div>

          <!-- Step 4: Concluir Etapa -->
          <div class="editorial-step-card complete-step">
            <div class="step-card-header">
              <div class="step-number-bubble complete-bubble">4</div>
              <div>
                <h3 class="step-card-title">Conclusão da Etapa</h3>
                <p class="step-card-desc">Finalize o trabalho para gravar a linhagem e liberar a próxima etapa aos colegas.</p>
              </div>
            </div>

            <div class="step-card-body">
              {#if activeStageItem.status === 'DONE'}
                <div class="completed-banner">
                  <CheckCircle2 size={24} class="text-emerald-400" />
                  <div>
                    <strong>Etapa Concluída com Sucesso!</strong>
                    <p>Concluída por {activeStageItem.completer?.display_name || activeStageItem.completer?.username || 'Membro'}.</p>
                  </div>
                </div>
              {:else if activeStageItem.status === 'IN_PROGRESS'}
                {#if requiresDeliverable && !hasDeliverable}
                  <div class="gated-warning-banner">
                    <AlertTriangle size={18} class="text-amber-400" />
                    <div>
                      <strong>Ação Bloqueada: Arquivo de entrega ausente</strong>
                      <p>O Project Nox exige o upload do arquivo entregável no Passo 3 antes de permitir a conclusão da etapa.</p>
                    </div>
                  </div>
                {/if}

                <form method="POST" action="?/completeStageAction" use:enhance class="complete-form">
                  <input type="hidden" name="chapter_stage_id" value={activeStageItem.id} />
                  <input type="text" name="notes" placeholder="Observações opcionais sobre esta entrega..." class="notes-input" />
                  <button
                    type="submit"
                    class="btn-complete-submit"
                    disabled={!canCompleteStage}
                  >
                    <CheckCircle2 size={16} />
                    <span>Concluir e Liberar Próxima Etapa</span>
                  </button>
                </form>
              {:else}
                <div class="notice-box-muted">
                  <Clock size={15} />
                  <span>Esta etapa não está em andamento. Assuma a etapa para poder trabalhar nela.</span>
                </div>
              {/if}
            </div>
          </div>
        {:else}
          <div class="empty-stage-state">
            <Layers size={32} class="text-purple-400" />
            <p>Selecione uma etapa no topo para visualizar seu fluxo de trabalho.</p>
          </div>
        {/if}
      </section>

    <!-- TAB 2: ARQUIVOS & LINHAGEM -->
    {:else if activeTab === 'files'}
      <section class="files-lineage-panel">
        <div class="panel-section-header">
          <div>
            <h2 class="panel-title">Arquivos & Linhagem Editorial</h2>
            <p class="panel-desc">Registro rigoroso de todas as versões de arquivos produzidos e suas dependências diretas.</p>
          </div>
        </div>

        {#if currentChapterFiles.length > 0}
          <div class="files-lineage-list">
            {#each currentChapterFiles as f}
              <div class="file-lineage-card" class:is-stale={f.is_stale}>
                <div class="file-lineage-top">
                  <div class="file-left-cluster">
                    <div class="file-icon-square">
                      <FileText size={22} class="text-purple-400" />
                    </div>
                    <div class="file-text-col">
                      <div class="file-title-line">
                        <span class="file-name-bold">{f.file_name}</span>
                        <span class="file-badge-version">v{f.version}</span>
                        <span class="file-stage-pill">{f.stage?.name || f.stage_slug}</span>
                      </div>
                      <div class="file-meta-sub">
                        <span>{formatBytes(f.byte_size)}</span>
                        <span>•</span>
                        <span>Enviado por {f.uploader?.display_name || f.uploader?.username || 'Membro'}</span>
                        <span>•</span>
                        <span>{new Date(f.created_at).toLocaleString('pt-BR')}</span>
                      </div>
                    </div>
                  </div>

                  <div class="file-right-cluster">
                    {#if f.is_stale}
                      <div class="stale-alert-badge">
                        <AlertTriangle size={14} />
                        <span>DESATUALIZADO (STALE)</span>
                      </div>
                    {:else}
                      <div class="valid-alert-badge">
                        <ShieldCheck size={14} />
                        <span>Válido</span>
                      </div>
                    {/if}

                    <a
                      href="/api/scan/production/files/{f.id}?download=1"
                      download={f.file_name}
                      class="btn-download-file-lineage"
                    >
                      <Download size={14} />
                      <span>Baixar</span>
                    </a>
                  </div>
                </div>

                <!-- Stale Explanation banner if stale -->
                {#if f.is_stale}
                  <div class="stale-banner-explanation">
                    <AlertTriangle size={15} class="text-red-400" />
                    <div>
                      <strong>Atenção:</strong> Este arquivo foi marcado como obsoleto porque:
                      <em>{f.stale_reason || 'Uma das dependências upstream foi regravada com uma versão mais recente.'}</em>
                    </div>
                  </div>
                {/if}

                <!-- Upstream Input Lineage -->
                {#if f.input_files && Object.keys(f.input_files).length > 0}
                  <div class="input-lineage-box">
                    <span class="lineage-label">Linhagem de Entrada (Inputs Utilizados):</span>
                    <div class="lineage-tags-strip">
                      {#each Object.entries(f.input_files) as [depSlug, info]}
                        <span class="lineage-tag">
                          <strong>{depSlug.toUpperCase()}:</strong> {(info as any).file_name || 'arquivo'} (v{(info as any).version || 1})
                        </span>
                      {/each}
                    </div>
                  </div>
                {/if}
              </div>
            {/each}
          </div>
        {:else}
          <div class="empty-tab-box">
            <FolderArchive size={32} class="text-purple-400" />
            <p>Nenhum arquivo de produção foi anexado a este capítulo ainda.</p>
          </div>
        {/if}
      </section>

    <!-- TAB 3: HISTÓRICO -->
    {:else if activeTab === 'history'}
      <section class="history-panel">
        <div class="panel-section-header">
          <div>
            <h2 class="panel-title">Histórico de Atividades do Capítulo</h2>
            <p class="panel-desc">Trilha de auditoria completa com todas as ações e transições executadas pela equipe.</p>
          </div>
        </div>

        {#if currentChapterTimeline.length > 0}
          <div class="timeline-feed">
            {#each currentChapterTimeline as item}
              <div class="timeline-row">
                <div class="timeline-dot-connector">
                  <div class="timeline-dot"></div>
                  <div class="timeline-line"></div>
                </div>
                <div class="timeline-content-card">
                  <div class="timeline-top">
                    <span class="timeline-event-name">{item.event_type}</span>
                    <span class="timeline-stage-tag">{item.stage_slug || 'PRODUÇÃO'}</span>
                    <span class="timeline-time">{relativeTime(item.created_at)}</span>
                  </div>
                  <div class="timeline-user-row">
                    <User size={12} />
                    <span>{item.user_name || 'Membro'}</span>
                  </div>
                  {#if item.details}
                    <div class="timeline-details-snippet">
                      {#if item.details.reason}
                        <p class="detail-reason"><strong>Motivo:</strong> {item.details.reason}</p>
                      {/if}
                      {#if item.details.notes}
                        <p class="detail-notes"><strong>Notas:</strong> {item.details.notes}</p>
                      {/if}
                      {#if item.details.file_name}
                        <p class="detail-file"><strong>Arquivo:</strong> {item.details.file_name} (v{item.details.version})</p>
                      {/if}
                    </div>
                  {/if}
                </div>
              </div>
            {/each}
          </div>
        {:else}
          <div class="empty-tab-box">
            <History size={32} class="text-purple-400" />
            <p>Nenhum evento registrado no histórico deste capítulo ainda.</p>
          </div>
        {/if}
      </section>

    <!-- TAB 4: QC INSPECTOR -->
    {:else if activeTab === 'qc'}
      <section class="qc-panel">
        <div class="panel-section-header flex-between">
          <div>
            <h2 class="panel-title">Quality Control (QC) Inspector</h2>
            <p class="panel-desc">Acompanhamento e resolução de apontamentos de erro por página.</p>
          </div>
          <button type="button" class="btn-create-qc-primary" onclick={() => (showNewQcModal = true)}>
            <Plus size={14} />
            <span>Novo Apontamento</span>
          </button>
        </div>

        {#if currentQcIssues.length > 0}
          <div class="qc-issues-grid">
            {#each currentQcIssues as q}
              <div class="qc-card" class:resolved={q.status === 'RESOLVED'}>
                <div class="qc-card-top">
                  <span class="qc-page-pill">Página #{q.page_number}</span>
                  <span class="qc-type-pill">{q.issue_type}</span>
                  <span class="qc-status-badge status-{q.status.toLowerCase()}">{q.status}</span>
                </div>
                <p class="qc-desc-text">{q.description}</p>
                <div class="qc-card-footer">
                  <span class="qc-author">Criado por {q.creator?.display_name || q.creator?.username || 'Revisor'}</span>
                </div>
              </div>
            {/each}
          </div>
        {:else}
          <div class="empty-tab-box">
            <CheckCircle2 size={36} class="text-emerald-400" />
            <p>Nenhum erro de QC registrado. O capítulo está limpo!</p>
          </div>
        {/if}
      </section>

    <!-- TAB 5: CHAT & NOTAS -->
    {:else if activeTab === 'chat'}
      <section class="chapter-notes-panel">
        <div class="panel-section-header">
          <div>
            <h2 class="panel-title">Chat & Notas do Capítulo</h2>
            <p class="panel-desc">Comunicação e orientações internas entre os membros envolvidos na produção.</p>
          </div>
        </div>

        <div class="notes-placeholder-box">
          <MessageSquare size={32} class="text-purple-400" />
          <p>Para interações em tempo real com a equipe completa da scan, utilize a aba geral <strong>Chat de Equipe</strong> no menu lateral.</p>
        </div>
      </section>
    {/if}
  </div>
</div>

<!-- Modal: Solicitar Retrabalho -->
{#if showReworkModal}
  <div class="modal-backdrop" onclick={() => (showReworkModal = false)}>
    <div class="modal-card" onclick={(e) => e.stopPropagation()}>
      <div class="modal-header">
        <h3 class="modal-title">Devolver para Retrabalho</h3>
        <button type="button" class="btn-close-modal" onclick={() => (showReworkModal = false)}>
          <X size={16} />
        </button>
      </div>

      <form
        method="POST"
        action="?/returnStageAction"
        use:enhance={() => {
          return async ({ update }) => {
            showReworkModal = false;
            await update();
          };
        }}
        class="modal-body"
      >
        <input type="hidden" name="source_stage_id" value={activeStageItem?.id} />

        <div class="form-group">
          <label for="rw-target" class="form-label">Devolver para qual etapa?</label>
          <select id="rw-target" name="target_stage_slug" class="form-select" bind:value={reworkTargetSlug}>
            <option value="raw">Raw Provider</option>
            <option value="traducao">Tradução</option>
            <option value="clean_redraw">Clean/Redraw</option>
            <option value="typeset">Typeset</option>
          </select>
        </div>

        <div class="form-group">
          <label for="rw-reason" class="form-label">Motivo do Retrabalho (Obrigatório, mín. 3 caracteres)</label>
          <textarea
            id="rw-reason"
            name="reason"
            required
            rows={3}
            class="form-textarea"
            placeholder="Descreva detalhadamente o que precisa ser corrigido pelo colega..."
            bind:value={reworkReason}
          ></textarea>
        </div>

        <div class="modal-actions">
          <button type="button" class="btn-cancel" onclick={() => (showReworkModal = false)}>
            Cancelar
          </button>
          <button type="submit" class="btn-confirm-return" disabled={reworkReason.trim().length < 3}>
            Confirmar Retrabalho
          </button>
        </div>
      </form>
    </div>
  </div>
{/if}

<style>
  .workspace-shell {
    display: flex;
    flex-direction: column;
    width: 100%;
    min-height: calc(100vh - 120px);
    background: #07050e;
    color: #f1f5f9;
  }

  /* Nav Bar */
  .workspace-nav-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    padding: 12px 24px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.06);
    background: #0b0816;
    flex-wrap: wrap;
  }

  .btn-back {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 6px;
    color: #cbd5e1;
    font-size: 12.5px;
    font-weight: 700;
    padding: 6px 12px;
    cursor: pointer;
    transition: all 0.15s;
  }

  .btn-back:hover {
    background: rgba(139, 92, 246, 0.15);
    color: #c4b5fd;
    border-color: rgba(139, 92, 246, 0.3);
  }

  .nav-breadcrumbs {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 13px;
  }

  .crumb-work {
    color: #94a3b8;
    font-weight: 600;
  }

  .crumb-sep {
    color: #475569;
  }

  .crumb-ch {
    color: #dfc28d;
    font-weight: 800;
  }

  .nav-right-actions {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .btn-preview {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    background: rgba(56, 189, 248, 0.1);
    border: 1px solid rgba(56, 189, 248, 0.25);
    color: #38bdf8;
    font-size: 12px;
    font-weight: 700;
    padding: 6px 12px;
    border-radius: 6px;
    text-decoration: none;
    transition: all 0.15s;
  }

  .btn-preview:hover {
    background: rgba(56, 189, 248, 0.2);
    border-color: #38bdf8;
  }

  .btn-publish-header {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    background: #10b981;
    color: #ffffff;
    border: none;
    font-size: 12px;
    font-weight: 700;
    padding: 6px 12px;
    border-radius: 6px;
    cursor: pointer;
    transition: opacity 0.15s;
  }

  .btn-publish-header:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  /* Hero */
  .workspace-hero {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 20px;
    padding: 24px;
    background: linear-gradient(180deg, #0f0b1e 0%, #090714 100%);
    border-bottom: 1px solid rgba(255, 255, 255, 0.06);
    flex-wrap: wrap;
  }

  .hero-left {
    display: flex;
    align-items: center;
    gap: 18px;
    min-width: 0;
  }

  .hero-thumb {
    width: 60px;
    height: 84px;
    border-radius: 8px;
    overflow: hidden;
    background: #18142a;
    display: flex;
    align-items: center;
    justify-content: center;
    border: 1px solid rgba(255, 255, 255, 0.1);
    flex-shrink: 0;
  }

  .hero-thumb-img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .hero-title-cluster {
    display: flex;
    flex-direction: column;
    gap: 4px;
    min-width: 0;
  }

  .hero-series-title {
    font-size: 13px;
    color: #94a3b8;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  .hero-chapter-heading {
    font-size: 22px;
    font-weight: 800;
    color: #f8fafc;
    margin: 0;
    line-height: 1.2;
    letter-spacing: -0.01em;
  }

  .hero-chapter-sub {
    font-size: 16px;
    font-weight: 600;
    color: #cbd5e1;
  }

  .hero-badges {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
    margin-top: 4px;
  }

  .hero-badge {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    font-size: 11.5px;
    font-weight: 700;
    padding: 3px 8px;
    border-radius: 6px;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.08);
  }

  .stage-badge {
    background: rgba(139, 92, 246, 0.15);
    color: #c4b5fd;
    border-color: rgba(139, 92, 246, 0.3);
  }

  .badge-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: #a78bfa;
  }

  .qc-alert-badge {
    background: rgba(239, 68, 68, 0.15);
    color: #f87171;
    border-color: rgba(239, 68, 68, 0.3);
  }

  /* Stepper Band */
  .stepper-band {
    padding: 10px 24px;
    background: #090712;
    border-bottom: 1px solid rgba(255, 255, 255, 0.04);
    overflow-x: auto;
  }

  .stepper-band-track {
    display: flex;
    align-items: center;
    gap: 6px;
    min-width: 680px;
  }

  .stepper-band-node {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 5px 10px;
    border-radius: 6px;
    background: transparent;
    border: 1px solid transparent;
    color: #94a3b8;
    font-size: 12px;
    font-weight: 700;
    cursor: pointer;
    transition: all 0.15s;
  }

  .stepper-band-node:hover {
    background: rgba(255, 255, 255, 0.04);
    color: #f1f5f9;
  }

  .stepper-band-node.is-selected {
    background: rgba(139, 92, 246, 0.18);
    border-color: rgba(139, 92, 246, 0.4);
    color: #c4b5fd;
  }

  .node-icon-box {
    width: 18px;
    height: 18px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    background: #171226;
    border: 1px solid #334155;
  }

  .stepper-band-node.is-done .node-icon-box {
    background: rgba(16, 185, 129, 0.2);
    border-color: #10b981;
    color: #34d399;
  }

  .stepper-band-node.is-progress .node-icon-box {
    background: rgba(245, 158, 11, 0.2);
    border-color: #f59e0b;
    color: #fbbf24;
  }

  .node-pulse-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: #fbbf24;
  }

  .node-open-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    border: 1.5px solid #38bdf8;
  }

  .node-divider-line {
    flex: 1;
    height: 1.5px;
    background: rgba(255, 255, 255, 0.08);
  }

  .node-divider-line.line-done {
    background: #10b981;
  }

  /* Sub-Navigation Tabs */
  .workspace-tabs {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 0 24px;
    background: #090712;
    border-bottom: 1px solid rgba(255, 255, 255, 0.06);
    overflow-x: auto;
  }

  .tab-link {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 12px 16px;
    background: transparent;
    border: none;
    border-bottom: 2px solid transparent;
    color: #94a3b8;
    font-size: 13px;
    font-weight: 700;
    cursor: pointer;
    transition: all 0.15s;
    white-space: nowrap;
  }

  .tab-link:hover {
    color: #f1f5f9;
  }

  .tab-link.active {
    color: #dfc28d;
    border-bottom-color: #dfc28d;
    background: rgba(223, 194, 141, 0.05);
  }

  .tab-chip {
    font-size: 10.5px;
    font-weight: 800;
    padding: 1px 6px;
    border-radius: 10px;
  }

  .tab-chip.progress {
    background: rgba(245, 158, 11, 0.2);
    color: #fbbf24;
  }

  .tab-chip.alert {
    background: rgba(239, 68, 68, 0.2);
    color: #f87171;
  }

  /* Tab Viewport */
  .workspace-tab-viewport {
    padding: 24px;
    flex: 1;
  }

  /* Work Focused Panel */
  .work-focused-panel {
    display: flex;
    flex-direction: column;
    gap: 18px;
    max-width: 900px;
    margin: 0 auto;
  }

  .stage-hero-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    padding: 14px 18px;
    background: #0e0a1a;
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 10px;
    flex-wrap: wrap;
  }

  .stage-hero-left {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .stage-tag-badge {
    font-size: 13px;
    font-weight: 800;
    padding: 4px 10px;
    border-radius: 6px;
    border: 1px solid;
    text-transform: uppercase;
  }

  .stage-state-tag {
    font-size: 12px;
    font-weight: 700;
    padding: 3px 8px;
    border-radius: 4px;
  }

  .stage-state-tag.status-done {
    color: #34d399;
    background: rgba(16, 185, 129, 0.15);
  }

  .stage-state-tag.status-in_progress {
    color: #fbbf24;
    background: rgba(245, 158, 11, 0.15);
  }

  .stage-state-tag.status-available {
    color: #38bdf8;
    background: rgba(56, 189, 248, 0.15);
  }

  .stage-state-tag.status-rework {
    color: #f87171;
    background: rgba(239, 68, 68, 0.15);
  }

  .stage-hero-actions {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .btn-claim-primary {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    background: #8b5cf6;
    color: #ffffff;
    border: none;
    border-radius: 6px;
    font-size: 12.5px;
    font-weight: 700;
    padding: 7px 14px;
    cursor: pointer;
    transition: opacity 0.15s;
  }

  .btn-release-secondary {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.1);
    color: #cbd5e1;
    border-radius: 6px;
    font-size: 12px;
    font-weight: 600;
    padding: 6px 12px;
    cursor: pointer;
  }

  .btn-rework-trigger {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    background: rgba(239, 68, 68, 0.15);
    border: 1px solid rgba(239, 68, 68, 0.3);
    color: #f87171;
    border-radius: 6px;
    font-size: 12px;
    font-weight: 700;
    padding: 6px 12px;
    cursor: pointer;
  }

  /* Editorial Step Card */
  .editorial-step-card {
    background: #0b0816;
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: 12px;
    padding: 18px 20px;
    display: flex;
    flex-direction: column;
    gap: 14px;
  }

  .step-card-header {
    display: flex;
    align-items: flex-start;
    gap: 12px;
  }

  .step-number-bubble {
    width: 28px;
    height: 28px;
    border-radius: 50%;
    background: rgba(139, 92, 246, 0.15);
    border: 1.5px solid #8b5cf6;
    color: #c4b5fd;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 13px;
    font-weight: 800;
    flex-shrink: 0;
  }

  .complete-bubble {
    background: rgba(16, 185, 129, 0.15);
    border-color: #10b981;
    color: #34d399;
  }

  .step-card-title {
    font-size: 15px;
    font-weight: 800;
    color: #f8fafc;
    margin: 0;
  }

  .step-card-desc {
    font-size: 12.5px;
    color: #94a3b8;
    margin: 3px 0 0;
  }

  .step-card-body {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  /* Upstream Files */
  .upstream-files-grid {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .upstream-file-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 10px 14px;
    background: rgba(255, 255, 255, 0.025);
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: 8px;
    flex-wrap: wrap;
  }

  .file-icon-box {
    width: 36px;
    height: 36px;
    border-radius: 6px;
    background: #141026;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .file-info-col {
    display: flex;
    flex-direction: column;
    gap: 2px;
    flex: 1;
    min-width: 180px;
  }

  .file-name {
    font-size: 13px;
    font-weight: 700;
    color: #f1f5f9;
  }

  .file-sub-tags {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 11px;
    color: #94a3b8;
  }

  .file-tag-stage {
    color: #c4b5fd;
    font-weight: 600;
  }

  .file-tag-version {
    background: rgba(223, 194, 141, 0.15);
    color: #dfc28d;
    padding: 1px 5px;
    border-radius: 3px;
    font-weight: 700;
  }

  .btn-download-action {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    background: rgba(139, 92, 246, 0.15);
    border: 1px solid rgba(139, 92, 246, 0.3);
    color: #c4b5fd;
    font-size: 12px;
    font-weight: 700;
    padding: 6px 12px;
    border-radius: 6px;
    text-decoration: none;
    transition: all 0.15s;
  }

  .btn-download-action:hover {
    background: #8b5cf6;
    color: #ffffff;
  }

  .no-upstream-box {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 12px 14px;
    background: rgba(139, 92, 246, 0.05);
    border: 1px dashed rgba(139, 92, 246, 0.2);
    border-radius: 8px;
    font-size: 12.5px;
    color: #c4b5fd;
  }

  /* Instructions */
  .instructions-block {
    padding: 14px;
    background: rgba(255, 255, 255, 0.02);
    border-radius: 8px;
    border-left: 3px solid #8b5cf6;
    font-size: 13px;
    line-height: 1.5;
    color: #cbd5e1;
  }

  .instructions-block p {
    margin: 0;
  }

  /* Deliverable Card */
  .current-deliverable-card {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 12px 14px;
    background: rgba(16, 185, 129, 0.08);
    border: 1px solid rgba(16, 185, 129, 0.25);
    border-radius: 8px;
  }

  .deliv-left {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .deliv-info {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .deliv-name {
    font-size: 13px;
    font-weight: 700;
    color: #f1f5f9;
  }

  .deliv-sub {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 11px;
    color: #94a3b8;
  }

  .deliv-badge-v {
    background: rgba(16, 185, 129, 0.2);
    color: #34d399;
    padding: 1px 5px;
    border-radius: 3px;
    font-weight: 700;
  }

  .btn-deliv-download {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.1);
    color: #cbd5e1;
    font-size: 12px;
    font-weight: 600;
    padding: 5px 10px;
    border-radius: 4px;
    text-decoration: none;
  }

  /* Dropzone */
  .upload-dropzone {
    padding: 24px;
    border: 2px dashed rgba(139, 92, 246, 0.3);
    border-radius: 10px;
    background: rgba(139, 92, 246, 0.03);
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10px;
    text-align: center;
  }

  .upload-text-group {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .upload-main-text {
    font-size: 13.5px;
    font-weight: 700;
    color: #f1f5f9;
  }

  .upload-sub-text {
    font-size: 11.5px;
    color: #64748b;
  }

  .btn-select-file {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    background: #8b5cf6;
    color: #ffffff;
    font-size: 12.5px;
    font-weight: 700;
    padding: 7px 16px;
    border-radius: 6px;
    cursor: pointer;
    transition: opacity 0.15s;
  }

  .hidden-file-input {
    display: none;
  }

  .feedback-box {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 14px;
    border-radius: 6px;
    font-size: 12.5px;
  }

  .feedback-box.success {
    background: rgba(16, 185, 129, 0.12);
    border: 1px solid rgba(16, 185, 129, 0.3);
    color: #34d399;
  }

  .feedback-box.error {
    background: rgba(239, 68, 68, 0.12);
    border: 1px solid rgba(239, 68, 68, 0.3);
    color: #f87171;
  }

  .notice-box-muted {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 12px 14px;
    background: rgba(255, 255, 255, 0.03);
    border-radius: 6px;
    font-size: 12px;
    color: #94a3b8;
  }

  /* Completion Step */
  .completed-banner {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 14px 18px;
    background: rgba(16, 185, 129, 0.12);
    border: 1px solid rgba(16, 185, 129, 0.3);
    border-radius: 8px;
    color: #34d399;
  }

  .gated-warning-banner {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 16px;
    background: rgba(245, 158, 11, 0.12);
    border: 1px solid rgba(245, 158, 11, 0.3);
    border-radius: 8px;
    color: #fbbf24;
    font-size: 12.5px;
  }

  .complete-form {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .notes-input {
    background: #0d0a18;
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 6px;
    padding: 9px 14px;
    font-size: 13px;
    color: #f1f5f9;
    outline: none;
  }

  .btn-complete-submit {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    background: #10b981;
    color: #ffffff;
    border: none;
    border-radius: 8px;
    font-size: 13.5px;
    font-weight: 800;
    padding: 11px 18px;
    cursor: pointer;
    transition: opacity 0.15s, transform 0.1s;
  }

  .btn-complete-submit:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  /* Files & Lineage */
  .files-lineage-panel,
  .history-panel,
  .qc-panel,
  .chapter-notes-panel {
    display: flex;
    flex-direction: column;
    gap: 18px;
    max-width: 900px;
    margin: 0 auto;
  }

  .panel-section-header {
    border-bottom: 1px solid rgba(255, 255, 255, 0.06);
    padding-bottom: 12px;
  }

  .panel-section-header.flex-between {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
  }

  .panel-title {
    font-size: 18px;
    font-weight: 800;
    color: #f8fafc;
    margin: 0;
  }

  .panel-desc {
    font-size: 12.5px;
    color: #94a3b8;
    margin: 3px 0 0;
  }

  .files-lineage-list {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .file-lineage-card {
    background: #0b0816;
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: 10px;
    padding: 14px 16px;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .file-lineage-card.is-stale {
    border-color: rgba(239, 68, 68, 0.4);
    background: #130911;
  }

  .file-lineage-top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    flex-wrap: wrap;
  }

  .file-left-cluster {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .file-icon-square {
    width: 40px;
    height: 40px;
    border-radius: 8px;
    background: #141026;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .file-title-line {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  }

  .file-name-bold {
    font-size: 13.5px;
    font-weight: 800;
    color: #f1f5f9;
  }

  .file-badge-version {
    background: rgba(223, 194, 141, 0.15);
    color: #dfc28d;
    font-size: 11px;
    font-weight: 800;
    padding: 1px 6px;
    border-radius: 4px;
  }

  .file-stage-pill {
    background: rgba(139, 92, 246, 0.15);
    color: #c4b5fd;
    font-size: 11px;
    font-weight: 700;
    padding: 1px 6px;
    border-radius: 4px;
  }

  .file-meta-sub {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 11px;
    color: #94a3b8;
  }

  .file-right-cluster {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .stale-alert-badge {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    background: rgba(239, 68, 68, 0.2);
    color: #f87171;
    border: 1px solid rgba(239, 68, 68, 0.4);
    font-size: 11px;
    font-weight: 800;
    padding: 3px 8px;
    border-radius: 4px;
  }

  .valid-alert-badge {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    background: rgba(16, 185, 129, 0.15);
    color: #34d399;
    border: 1px solid rgba(16, 185, 129, 0.3);
    font-size: 11px;
    font-weight: 700;
    padding: 3px 8px;
    border-radius: 4px;
  }

  .btn-download-file-lineage {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.1);
    color: #cbd5e1;
    font-size: 12px;
    font-weight: 700;
    padding: 5px 12px;
    border-radius: 6px;
    text-decoration: none;
  }

  .stale-banner-explanation {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    background: rgba(239, 68, 68, 0.1);
    border-radius: 6px;
    font-size: 12px;
    color: #fca5a5;
  }

  .input-lineage-box {
    display: flex;
    align-items: center;
    gap: 8px;
    padding-top: 8px;
    border-top: 1px solid rgba(255, 255, 255, 0.04);
    flex-wrap: wrap;
  }

  .lineage-label {
    font-size: 11.5px;
    color: #94a3b8;
    font-weight: 600;
  }

  .lineage-tags-strip {
    display: flex;
    align-items: center;
    gap: 6px;
    flex-wrap: wrap;
  }

  .lineage-tag {
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.08);
    padding: 2px 6px;
    border-radius: 4px;
    font-size: 11px;
    color: #cbd5e1;
  }

  /* History Timeline */
  .timeline-feed {
    display: flex;
    flex-direction: column;
    position: relative;
  }

  .timeline-row {
    display: flex;
    gap: 14px;
  }

  .timeline-dot-connector {
    display: flex;
    flex-direction: column;
    align-items: center;
    width: 20px;
  }

  .timeline-dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: #8b5cf6;
    margin-top: 4px;
  }

  .timeline-line {
    flex: 1;
    width: 2px;
    background: rgba(255, 255, 255, 0.08);
    margin: 4px 0;
  }

  .timeline-content-card {
    flex: 1;
    background: #0b0816;
    border: 1px solid rgba(255, 255, 255, 0.05);
    border-radius: 8px;
    padding: 10px 14px;
    margin-bottom: 12px;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .timeline-top {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  }

  .timeline-event-name {
    font-size: 12.5px;
    font-weight: 800;
    color: #f1f5f9;
  }

  .timeline-stage-tag {
    font-size: 10.5px;
    font-weight: 700;
    color: #c4b5fd;
    background: rgba(139, 92, 246, 0.15);
    padding: 1px 5px;
    border-radius: 3px;
  }

  .timeline-time {
    font-size: 11px;
    color: #64748b;
    margin-left: auto;
  }

  .timeline-user-row {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 11.5px;
    color: #94a3b8;
  }

  .timeline-details-snippet {
    margin-top: 4px;
    padding-top: 4px;
    border-top: 1px solid rgba(255, 255, 255, 0.04);
    font-size: 12px;
    color: #cbd5e1;
  }

  .timeline-details-snippet p {
    margin: 2px 0;
  }

  /* QC Panel */
  .btn-create-qc-primary {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    background: #8b5cf6;
    color: #ffffff;
    border: none;
    border-radius: 6px;
    font-size: 12px;
    font-weight: 700;
    padding: 6px 12px;
    cursor: pointer;
  }

  .qc-issues-grid {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .qc-card {
    background: #0b0816;
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: 8px;
    padding: 12px 14px;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .qc-card.resolved {
    opacity: 0.6;
  }

  .qc-card-top {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .qc-page-pill {
    font-size: 11px;
    font-weight: 800;
    color: #dfc28d;
    background: rgba(223, 194, 141, 0.15);
    padding: 1px 6px;
    border-radius: 3px;
  }

  .qc-type-pill {
    font-size: 11px;
    font-weight: 700;
    color: #c4b5fd;
    background: rgba(139, 92, 246, 0.15);
    padding: 1px 6px;
    border-radius: 3px;
  }

  .qc-status-badge {
    font-size: 10.5px;
    font-weight: 800;
    padding: 1px 6px;
    border-radius: 3px;
    margin-left: auto;
  }

  .qc-status-badge.status-open {
    background: rgba(239, 68, 68, 0.2);
    color: #f87171;
  }

  .qc-desc-text {
    font-size: 13px;
    color: #cbd5e1;
    margin: 0;
  }

  .qc-card-footer {
    font-size: 11px;
    color: #64748b;
  }

  /* Modals */
  .modal-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.7);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    padding: 16px;
  }

  .modal-card {
    width: 100%;
    max-width: 440px;
    background: #0f0b1e;
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 12px;
    padding: 20px;
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .modal-title {
    font-size: 16px;
    font-weight: 800;
    color: #f8fafc;
    margin: 0;
  }

  .btn-close-modal {
    background: transparent;
    border: none;
    color: #94a3b8;
    cursor: pointer;
  }

  .modal-body {
    display: flex;
    flex-direction: column;
    gap: 14px;
  }

  .form-group {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .form-label {
    font-size: 12px;
    font-weight: 700;
    color: #cbd5e1;
  }

  .form-select,
  .form-textarea {
    background: #090712;
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 6px;
    padding: 8px 12px;
    color: #f1f5f9;
    font-size: 13px;
    outline: none;
  }

  .modal-actions {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 10px;
    margin-top: 6px;
  }

  .btn-cancel {
    background: transparent;
    border: 1px solid rgba(255, 255, 255, 0.1);
    color: #94a3b8;
    padding: 7px 14px;
    border-radius: 6px;
    font-size: 12.5px;
    font-weight: 600;
    cursor: pointer;
  }

  .btn-confirm-return {
    background: #ef4444;
    border: none;
    color: #ffffff;
    padding: 7px 14px;
    border-radius: 6px;
    font-size: 12.5px;
    font-weight: 700;
    cursor: pointer;
  }

  .btn-confirm-return:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .empty-tab-box,
  .empty-stage-state,
  .notes-placeholder-box {
    padding: 40px 20px;
    text-align: center;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10px;
    background: #090712;
    border: 1px dashed rgba(255, 255, 255, 0.08);
    border-radius: 10px;
    color: #94a3b8;
    font-size: 13px;
  }

  @media (max-width: 640px) {
    .workspace-nav-bar {
      padding: 10px 14px;
    }
    .workspace-hero {
      padding: 16px 14px;
    }
    .workspace-tab-viewport {
      padding: 14px;
    }
    .stage-hero-bar {
      flex-direction: column;
      align-items: stretch;
    }
    .stage-hero-actions {
      justify-content: space-between;
    }
  }
</style>
