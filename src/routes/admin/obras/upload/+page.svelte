<script lang="ts">
  import { goto, invalidateAll } from '$app/navigation';
  import {
    unpackArchive,
    unpackImages,
    classifyDroppedFiles,
    detectChapterNumber,
    type UnpackedPage,
    type BatchChapterItem
  } from '$lib/client/chapter-unpack';
  import { UploadPool } from '$lib/client/upload-pool';
  import {
    ArrowLeft,
    UploadCloud,
    FolderArchive,
    CheckCircle2,
    AlertCircle,
    AlertTriangle,
    RotateCcw,
    X,
    ExternalLink,
    Play,
    StopCircle,
    Check,
    Layers,
    FileText,
    Eye,
    RefreshCw,
    Trash2,
    Clock,
    FileArchive
  } from '@lucide/svelte';
  import { onDestroy } from 'svelte';

  let { data } = $props();

  // Mode: 'idle' | 'single' | 'batch'
  let uploadMode = $state<'idle' | 'single' | 'batch'>('idle');

  // Work & Global Metadata
  let selectedWorkId = $state(data.preselectedWork?.id || '');
  let language = $state('pt-br');
  let selectedScanId = $state(data.scans?.[0]?.id || '');

  // Single Chapter State
  let chapterNumber = $state<number>(data.suggestedChapterNumber || 1);
  let chapterTitle = $state('');
  let volume = $state('');
  let replaceExisting = $state(false);
  let pages = $state<UnpackedPage[]>([]);
  let singleFileName = $state<string>('');
  let sessionId = $state<string | null>(null);
  let uploadPool = $state<UploadPool | null>(null);
  let isUploading = $state(false);
  let isCommitting = $state(false);
  let uploadCompleted = $state(false);
  let publishedChapter = $state<{ id: string; number: number; slug?: string } | null>(null);
  let totalPages = $state(0);
  let completedPages = $state(0);
  let failedPages = $state(0);
  let progressPercent = $state(0);
  let speedMBs = $state(0);
  let etaSeconds = $state(0);
  let conflictDetected = $state(false);

  // Batch Chapters State
  let batchChapters = $state<BatchChapterItem[]>([]);
  let isBatchUploading = $state(false);
  let activeBatchIndex = $state<number | null>(null);

  // Drag & Unpack State
  let dragOver = $state(false);
  let isUnpacking = $state(false);
  let unpackProgressMessage = $state('');
  let fileInputRef: HTMLInputElement | null = null;

  // Global Messages
  let errorMessage = $state<string | null>(null);
  let successMessage = $state<string | null>(null);

  // When selected work changes, suggest next chapter
  $effect(() => {
    if (selectedWorkId && selectedWorkId !== data.preselectedWork?.id) {
      fetch(`/api/admin/works/${selectedWorkId}/chapters`)
        .then((r) => (r.ok ? r.json() : null))
        .then((chaps) => {
          if (Array.isArray(chaps) && chaps.length > 0) {
            const maxNum = Math.max(...chaps.map((c: any) => Number(c.number) || 0));
            chapterNumber = maxNum + 1;
          }
        })
        .catch(() => {});
    }
  });

  onDestroy(() => {
    if (uploadPool) {
      uploadPool.abort();
    }
    for (const p of pages) {
      if (p.previewUrl) URL.revokeObjectURL(p.previewUrl);
    }
    for (const ch of batchChapters) {
      if (ch.uploadPool) ch.uploadPool.abort();
      for (const p of ch.pages) {
        if (p.previewUrl) URL.revokeObjectURL(p.previewUrl);
      }
    }
  });

  async function handleFileInput(e: Event) {
    const target = e.target as HTMLInputElement;
    if (!target.files || target.files.length === 0) return;
    await processFiles(Array.from(target.files));
  }

  function handleDrop(e: DragEvent) {
    dragOver = false;
    if (!e.dataTransfer || !e.dataTransfer.files || e.dataTransfer.files.length === 0) return;
    processFiles(Array.from(e.dataTransfer.files));
  }

  async function processFiles(files: File[]) {
    if (!files || files.length === 0) return;
    errorMessage = null;
    successMessage = null;
    isUnpacking = true;
    unpackProgressMessage = 'Analisando arquivos…';

    try {
      const { isBatch, isLooseImages, archives, looseImages } = classifyDroppedFiles(files);

      if (archives.length === 0 && looseImages.length === 0) {
        throw new Error('Nenhum arquivo compatível (.zip, .cbz ou imagens .jpg/.png/.webp) foi encontrado.');
      }

      if (isBatch) {
        // MULTI-CHAPTER BATCH MODE
        uploadMode = 'batch';
        const newBatchItems: BatchChapterItem[] = [];

        for (let i = 0; i < archives.length; i++) {
          const archive = archives[i];
          unpackProgressMessage = `Descompactando ${i + 1}/${archives.length}: ${archive.name}…`;
          const chPages = await unpackArchive(archive);
          const detected = detectChapterNumber(archive.name);
          newBatchItems.push({
            id: crypto.randomUUID(),
            file: archive,
            name: archive.name,
            detectedNumber: detected,
            chapterNumber: detected ?? (data.suggestedChapterNumber ? data.suggestedChapterNumber + i : i + 1),
            chapterTitle: '',
            volume: '',
            pages: chPages,
            status: 'READY',
            progress: 0,
            totalPages: chPages.length,
            completedPages: 0,
            failedPages: 0,
            speedMBs: 0,
            etaSeconds: 0,
            replaceExisting: false
          });
        }

        // Sort naturally by chapter number
        newBatchItems.sort((a, b) => a.chapterNumber - b.chapterNumber);
        batchChapters = newBatchItems;
      } else {
        // SINGLE CHAPTER MODE (1 Archive OR Loose Images)
        uploadMode = 'single';
        if (archives.length === 1) {
          const archive = archives[0];
          singleFileName = archive.name;
          unpackProgressMessage = `Descompactando ${archive.name}…`;
          pages = await unpackArchive(archive);
          const detected = detectChapterNumber(archive.name);
          if (detected !== null) {
            chapterNumber = detected;
          }
        } else if (isLooseImages) {
          singleFileName = `${looseImages.length} imagens soltas`;
          unpackProgressMessage = `Processando ${looseImages.length} imagens…`;
          pages = await unpackImages(looseImages);
        }

        totalPages = pages.length;
        completedPages = 0;
        failedPages = 0;
        progressPercent = 0;
      }
    } catch (err: any) {
      errorMessage = err.message || 'Erro ao processar arquivos.';
      uploadMode = 'idle';
    } finally {
      isUnpacking = false;
      unpackProgressMessage = '';
    }
  }

  function removePage(index: number) {
    if (isUploading) return;
    const removed = pages.splice(index - 1, 1);
    if (removed[0]?.previewUrl) {
      URL.revokeObjectURL(removed[0].previewUrl);
    }
    pages = pages.map((p, idx) => ({
      ...p,
      index: idx + 1
    }));
    totalPages = pages.length;
  }

  function resetAll() {
    if (uploadPool) {
      uploadPool.abort();
      uploadPool = null;
    }
    for (const p of pages) {
      if (p.previewUrl) URL.revokeObjectURL(p.previewUrl);
    }
    for (const ch of batchChapters) {
      if (ch.uploadPool) ch.uploadPool.abort();
      for (const p of ch.pages) {
        if (p.previewUrl) URL.revokeObjectURL(p.previewUrl);
      }
    }

    uploadMode = 'idle';
    pages = [];
    batchChapters = [];
    singleFileName = '';
    sessionId = null;
    isUploading = false;
    isCommitting = false;
    uploadCompleted = false;
    publishedChapter = null;
    isBatchUploading = false;
    activeBatchIndex = null;
    errorMessage = null;
    successMessage = null;
    conflictDetected = false;
    completedPages = 0;
    failedPages = 0;
    progressPercent = 0;
  }

  // ----------------------------------------------------
  // SINGLE CHAPTER FLOW
  // ----------------------------------------------------
  async function startSingleUploadSession() {
    if (!selectedWorkId) {
      errorMessage = 'Selecione uma obra para vincular o capítulo.';
      return;
    }
    if (chapterNumber === undefined || chapterNumber === null || isNaN(chapterNumber)) {
      errorMessage = 'Informe um número de capítulo válido.';
      return;
    }
    if (pages.length === 0) {
      errorMessage = 'Adicione ao menos uma página para upload.';
      return;
    }

    errorMessage = null;
    isUploading = true;
    conflictDetected = false;

    try {
      const res = await fetch('/api/staff/uploads/begin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workId: selectedWorkId,
          chapterNumber: Number(chapterNumber),
          chapterTitle: chapterTitle.trim() || undefined,
          volume: volume.trim() || undefined,
          language: language || 'pt-br',
          scanId: selectedScanId || undefined,
          totalPages: pages.length
        })
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || data.error || `Falha ao iniciar sessão (${res.status})`);
      }

      const sessionData = await res.json();
      sessionId = sessionData.sessionId;

      if (!sessionId) {
        throw new Error('Sessão retornou ID inválido.');
      }

      uploadPool = new UploadPool(pages, {
        sessionId,
        concurrency: 6,
        onPageStatusChange: (updatedPage) => {
          const idx = pages.findIndex((p) => p.index === updatedPage.index);
          if (idx !== -1) {
            pages[idx] = { ...updatedPage };
          }
        },
        onOverallProgress: (stats) => {
          totalPages = stats.total;
          completedPages = stats.completed;
          failedPages = stats.failed;
          progressPercent = stats.percentage;
          speedMBs = stats.speedMBs;
          etaSeconds = stats.etaSeconds;
        }
      });

      const allSuccess = await uploadPool.start();
      isUploading = false;

      if (!allSuccess) {
        const failedCount = pages.filter((p) => p.status === 'FAILED').length;
        if (failedCount > 0) {
          errorMessage = `${failedCount} página(s) falharam no envio. Clique em "Tentar novamente" para reenviar.`;
        }
      }
    } catch (err: any) {
      isUploading = false;
      errorMessage = err.message || 'Erro durante upload.';
    }
  }

  async function retryFailedSingleUploads() {
    if (!uploadPool || !sessionId) return;
    errorMessage = null;
    isUploading = true;

    try {
      const allSuccess = await uploadPool.retryFailed();
      isUploading = false;
      if (!allSuccess) {
        const failedCount = pages.filter((p) => p.status === 'FAILED').length;
        if (failedCount > 0) {
          errorMessage = `${failedCount} página(s) ainda falharam. Tente novamente.`;
        }
      }
    } catch (err: any) {
      isUploading = false;
      errorMessage = err.message || 'Erro ao retentar páginas.';
    }
  }

  async function commitSingleSession() {
    if (!sessionId) return;
    if (completedPages < totalPages) {
      errorMessage = 'Aguarde o upload de 100% das páginas antes de publicar.';
      return;
    }

    isCommitting = true;
    errorMessage = null;

    try {
      const res = await fetch(`/api/staff/uploads/${sessionId}/commit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          replaceExisting: replaceExisting
        })
      });

      const resData = await res.json().catch(() => ({}));

      if (!res.ok) {
        if (res.status === 409 || resData.code === 'CHAPTER_EXISTS') {
          conflictDetected = true;
          throw new Error(
            resData.message ||
              `O capítulo ${chapterNumber} já existe nesta obra. Marque "Substituir se o capítulo já existir" abaixo se deseja sobrescrevê-lo.`
          );
        }
        throw new Error(resData.message || resData.error || `Erro ao publicar (${res.status})`);
      }

      uploadCompleted = true;
      publishedChapter = resData.chapter;
      successMessage = `Capítulo ${resData.chapter?.number || chapterNumber} publicado com sucesso no site!`;
      await invalidateAll();
    } catch (err: any) {
      errorMessage = err.message || 'Erro ao finalizar publicação.';
    } finally {
      isCommitting = false;
    }
  }

  async function cancelSingleSession() {
    if (!sessionId) {
      resetAll();
      return;
    }
    if (uploadPool) {
      uploadPool.abort();
    }
    try {
      await fetch(`/api/staff/uploads/${sessionId}/abort`, { method: 'POST' });
    } catch {}
    resetAll();
  }

  // ----------------------------------------------------
  // BATCH CHAPTER FLOW
  // ----------------------------------------------------
  async function uploadSingleBatchChapter(chapter: BatchChapterItem): Promise<boolean> {
    if (!selectedWorkId) {
      chapter.status = 'FAILED';
      chapter.errorMessage = 'Selecione uma obra destino.';
      return false;
    }

    chapter.status = 'UPLOADING';
    chapter.errorMessage = undefined;
    chapter.conflictMessage = undefined;

    try {
      // 1. Begin upload session if not already created
      if (!chapter.sessionId) {
        const res = await fetch('/api/staff/uploads/begin', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            workId: selectedWorkId,
            chapterNumber: Number(chapter.chapterNumber),
            chapterTitle: chapter.chapterTitle.trim() || undefined,
            volume: chapter.volume.trim() || undefined,
            language: language || 'pt-br',
            scanId: selectedScanId || undefined,
            totalPages: chapter.pages.length
          })
        });

        if (!res.ok) {
          const resData = await res.json().catch(() => ({}));
          throw new Error(resData.message || resData.error || `Falha ao iniciar sessão (${res.status})`);
        }

        const sessionData = await res.json();
        chapter.sessionId = sessionData.sessionId;
      }

      // 2. Upload Pool
      chapter.uploadPool = new UploadPool(chapter.pages, {
        sessionId: chapter.sessionId!,
        concurrency: 6,
        onPageStatusChange: (updatedPage) => {
          const idx = chapter.pages.findIndex((p) => p.index === updatedPage.index);
          if (idx !== -1) {
            chapter.pages[idx] = { ...updatedPage };
          }
        },
        onOverallProgress: (stats) => {
          chapter.totalPages = stats.total;
          chapter.completedPages = stats.completed;
          chapter.failedPages = stats.failed;
          chapter.progress = stats.percentage;
          chapter.speedMBs = stats.speedMBs;
          chapter.etaSeconds = stats.etaSeconds;
        }
      });

      const allSuccess = await chapter.uploadPool.start();
      if (!allSuccess) {
        const failedCount = chapter.pages.filter((p) => p.status === 'FAILED').length;
        chapter.status = 'FAILED';
        chapter.errorMessage = `${failedCount} página(s) falharam no envio.`;
        return false;
      }

      // 3. Commit atomic publication
      chapter.status = 'COMMITTING';
      const commitRes = await fetch(`/api/staff/uploads/${chapter.sessionId}/commit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          replaceExisting: chapter.replaceExisting
        })
      });

      const commitData = await commitRes.json().catch(() => ({}));

      if (!commitRes.ok) {
        if (commitRes.status === 409 || commitData.code === 'CHAPTER_EXISTS') {
          chapter.status = 'CONFLICT';
          chapter.conflictMessage = `Capítulo ${chapter.chapterNumber} já existe nesta obra.`;
          return false;
        }
        throw new Error(commitData.message || commitData.error || `Erro ao publicar (${commitRes.status})`);
      }

      chapter.status = 'PUBLISHED';
      chapter.publishedChapter = commitData.chapter;
      return true;
    } catch (err: any) {
      chapter.status = 'FAILED';
      chapter.errorMessage = err.message || 'Erro durante o envio.';
      return false;
    }
  }

  async function startBatchUpload() {
    if (!selectedWorkId) {
      errorMessage = 'Selecione uma obra destino antes de iniciar o envio do lote.';
      return;
    }
    if (batchChapters.length === 0) return;

    isBatchUploading = true;
    errorMessage = null;

    try {
      for (let i = 0; i < batchChapters.length; i++) {
        const ch = batchChapters[i];
        if (ch.status === 'PUBLISHED' || ch.status === 'SKIPPED') {
          continue;
        }
        activeBatchIndex = i;
        await uploadSingleBatchChapter(ch);
      }
      await invalidateAll();
    } finally {
      isBatchUploading = false;
      activeBatchIndex = null;
    }
  }

  async function retryBatchChapter(chapter: BatchChapterItem) {
    if (isBatchUploading) return;
    chapter.status = 'UPLOADING';
    chapter.errorMessage = undefined;

    if (chapter.uploadPool && chapter.sessionId && chapter.completedPages > 0) {
      try {
        const allSuccess = await chapter.uploadPool.retryFailed();
        if (allSuccess) {
          chapter.status = 'COMMITTING';
          const commitRes = await fetch(`/api/staff/uploads/${chapter.sessionId}/commit`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ replaceExisting: chapter.replaceExisting })
          });
          const commitData = await commitRes.json().catch(() => ({}));
          if (commitRes.ok) {
            chapter.status = 'PUBLISHED';
            chapter.publishedChapter = commitData.chapter;
            await invalidateAll();
            return;
          } else if (commitRes.status === 409 || commitData.code === 'CHAPTER_EXISTS') {
            chapter.status = 'CONFLICT';
            chapter.conflictMessage = `Capítulo ${chapter.chapterNumber} já existe nesta obra.`;
            return;
          }
          throw new Error(commitData.message || 'Erro ao publicar.');
        } else {
          chapter.status = 'FAILED';
          chapter.errorMessage = 'Algumas páginas ainda falharam. Tente novamente.';
        }
      } catch (err: any) {
        chapter.status = 'FAILED';
        chapter.errorMessage = err.message || 'Erro ao retentar.';
      }
    } else {
      await uploadSingleBatchChapter(chapter);
      await invalidateAll();
    }
  }

  async function replaceBatchChapter(chapter: BatchChapterItem) {
    if (!chapter.sessionId) return;
    chapter.replaceExisting = true;
    chapter.status = 'COMMITTING';
    chapter.errorMessage = undefined;
    chapter.conflictMessage = undefined;

    try {
      const commitRes = await fetch(`/api/staff/uploads/${chapter.sessionId}/commit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ replaceExisting: true })
      });
      const commitData = await commitRes.json().catch(() => ({}));
      if (!commitRes.ok) {
        throw new Error(commitData.message || 'Erro ao substituir capítulo.');
      }
      chapter.status = 'PUBLISHED';
      chapter.publishedChapter = commitData.chapter;
      await invalidateAll();
    } catch (err: any) {
      chapter.status = 'FAILED';
      chapter.errorMessage = err.message || 'Falha ao substituir.';
    }
  }

  async function ignoreBatchChapter(chapter: BatchChapterItem) {
    if (chapter.sessionId) {
      try {
        await fetch(`/api/staff/uploads/${chapter.sessionId}/abort`, { method: 'POST' });
      } catch {}
    }
    chapter.status = 'SKIPPED';
  }

  function removeBatchChapter(id: string) {
    if (isBatchUploading) return;
    const idx = batchChapters.findIndex((c) => c.id === id);
    if (idx !== -1) {
      const removed = batchChapters.splice(idx, 1)[0];
      for (const p of removed.pages) {
        if (p.previewUrl) URL.revokeObjectURL(p.previewUrl);
      }
      if (batchChapters.length === 0) {
        uploadMode = 'idle';
      }
    }
  }

  const selectedWork = $derived(data.works.find((w: any) => w.id === selectedWorkId));
  const publishedBatchCount = $derived(batchChapters.filter((c) => c.status === 'PUBLISHED').length);
  const totalBatchPages = $derived(batchChapters.reduce((acc, c) => acc + c.totalPages, 0));
  const overallBatchPercent = $derived(
    batchChapters.length > 0 ? Math.round((publishedBatchCount / batchChapters.length) * 100) : 0
  );
</script>

<svelte:head>
  <title>Enviar Capítulos — Nox Editorial</title>
</svelte:head>

<div class="upload-manager-shell">
  <!-- Page Header -->
  <header class="page-header">
    <div class="header-titles">
      <div class="breadcrumb-row">
        <a href="/admin/obras" class="btn-back">
          <ArrowLeft size={16} />
          <span>Voltar para Obras</span>
        </a>
        {#if selectedWork}
          <span class="sep">/</span>
          <a href="/admin/obras/{selectedWork.id}" class="work-link">{selectedWork.title}</a>
        {/if}
      </div>
      <h1 class="page-title">
        <UploadCloud size={26} class="title-icon" />
        <span>Enviar Capítulos</span>
      </h1>
      <p class="page-subtitle">
        Envie um capítulo ou vários de uma vez (ZIP, CBZ ou imagens soltas) com upload paralelo e publicação atômica.
      </p>
    </div>
  </header>

  <!-- Banner Notifications -->
  {#if errorMessage}
    <div class="alert-banner alert-error" role="alert">
      <AlertCircle size={18} class="alert-icon" />
      <div class="alert-content">
        <p class="alert-text">{errorMessage}</p>
        {#if conflictDetected && uploadMode === 'single'}
          <label class="conflict-toggle">
            <input type="checkbox" bind:checked={replaceExisting} />
            <span>Substituir capítulo existente e atualizar páginas</span>
          </label>
        {/if}
      </div>
      <button type="button" class="alert-close" onclick={() => (errorMessage = null)}>
        <X size={14} />
      </button>
    </div>
  {/if}

  {#if successMessage}
    <div class="alert-banner alert-success" role="status">
      <CheckCircle2 size={18} class="alert-icon" />
      <div class="alert-content">
        <p class="alert-text font-bold">{successMessage}</p>
        <div class="success-actions">
          {#if publishedChapter && selectedWork}
            <a
              href="/ler/{selectedWork.slug || selectedWork.id}/{publishedChapter.number}"
              target="_blank"
              rel="noreferrer"
              class="btn-success-view"
            >
              <Eye size={14} />
              <span>Ver no Leitor</span>
              <ExternalLink size={12} />
            </a>
            <a href="/admin/obras/{selectedWork.id}" class="btn-success-manage">
              <span>Gerenciar na Obra</span>
            </a>
          {/if}
          <button type="button" class="btn-success-next" onclick={resetAll}>
            <UploadCloud size={14} />
            <span>Enviar Mais Capítulos</span>
          </button>
        </div>
      </div>
    </div>
  {/if}

  <!-- Work and Destination Configuration Bar -->
  <div class="card destination-card">
    <div class="dest-grid">
      <!-- Work Selection -->
      <div class="form-group flex-2">
        <label for="work-select" class="form-label">Obra Destino *</label>
        <select
          id="work-select"
          class="form-select"
          bind:value={selectedWorkId}
          disabled={isUploading || isCommitting || isBatchUploading}
        >
          <option value="">-- Selecione a Obra --</option>
          {#each data.works as work}
            <option value={work.id}>{work.title}</option>
          {/each}
        </select>
      </div>

      <!-- Scan Group -->
      <div class="form-group flex-1">
        <label for="scan-select" class="form-label">Scan / Grupo</label>
        <select
          id="scan-select"
          class="form-select"
          bind:value={selectedScanId}
          disabled={isUploading || isCommitting || isBatchUploading}
        >
          <option value="">Sem scan vinculada</option>
          {#each data.scans as scan}
            <option value={scan.id}>{scan.name} {scan.isOfficial ? '★' : ''}</option>
          {/each}
        </select>
      </div>

      <!-- Language -->
      <div class="form-group w-32">
        <label for="lang-select" class="form-label">Idioma</label>
        <select
          id="lang-select"
          class="form-select"
          bind:value={language}
          disabled={isUploading || isCommitting || isBatchUploading}
        >
          <option value="pt-br">PT-BR</option>
          <option value="en">EN</option>
          <option value="es">ES</option>
        </select>
      </div>
    </div>
  </div>

  <!-- MAIN UPLOAD WORKFLOW -->
  {#if uploadMode === 'idle'}
    <!-- UNIFIED SINGLE DROPZONE -->
    <div class="card dropzone-card">
      <!-- svelte-ignore a11y_click_events_have_key_events -->
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <div
        class="dropzone"
        class:drag-over={dragOver}
        ondragover={(e) => {
          e.preventDefault();
          dragOver = true;
        }}
        ondragleave={() => (dragOver = false)}
        ondrop={(e) => {
          e.preventDefault();
          handleDrop(e);
        }}
        onclick={() => fileInputRef?.click()}
      >
        <input
          type="file"
          bind:this={fileInputRef}
          multiple
          accept=".zip,.cbz,.jpg,.jpeg,.png,.webp"
          class="hidden-file-input"
          onchange={handleFileInput}
        />
        <div class="dropzone-icon-wrap">
          <UploadCloud size={42} class="dropzone-icon" />
        </div>
        <p class="dropzone-title">
          {isUnpacking ? unpackProgressMessage || 'Descompactando e ordenando páginas…' : 'Arraste capítulos aqui'}
        </p>
        <p class="dropzone-subtitle">
          Envie um capítulo ou vários de uma vez. Compatível com ZIP, CBZ e imagens.
        </p>
        <div class="dropzone-actions">
          <button type="button" class="btn-select-files">
            <FolderArchive size={16} />
            <span>Selecionar Arquivos</span>
          </button>
        </div>
        <div class="badges-row">
          <span class="badge">.ZIP</span>
          <span class="badge">.CBZ</span>
          <span class="badge">Imagens soltas (JPG / PNG / WEBP)</span>
          <span class="badge">Detecção automática de número</span>
          <span class="badge">Capítulo único ou Lote</span>
        </div>
      </div>
    </div>

  {:else if uploadMode === 'single'}
    <!-- SINGLE CHAPTER FLOW -->
    <div class="upload-grid">
      <!-- Left Column: Form Configuration -->
      <div class="card config-card">
        <div class="card-header-row">
          <h2 class="card-title">
            <FileText size={18} />
            <span>Metadados do Capítulo</span>
          </h2>
          {#if singleFileName}
            <span class="file-source-badge" title={singleFileName}>{singleFileName}</span>
          {/if}
        </div>

        <!-- Chapter Number & Volume -->
        <div class="form-row">
          <div class="form-group flex-1">
            <label for="chapter-num" class="form-label">Número do Capítulo *</label>
            <input
              id="chapter-num"
              type="number"
              step="any"
              class="form-input"
              bind:value={chapterNumber}
              disabled={isUploading || isCommitting || uploadCompleted}
              required
            />
          </div>
          <div class="form-group w-32">
            <label for="volume-input" class="form-label">Volume</label>
            <input
              id="volume-input"
              type="text"
              placeholder="Ex: 01"
              class="form-input"
              bind:value={volume}
              disabled={isUploading || isCommitting || uploadCompleted}
            />
          </div>
        </div>

        <!-- Chapter Title -->
        <div class="form-group">
          <label for="chapter-title" class="form-label">Título do Capítulo (Opcional)</label>
          <input
            id="chapter-title"
            type="text"
            placeholder="Ex: O Despertar da Sombra"
            class="form-input"
            bind:value={chapterTitle}
            disabled={isUploading || isCommitting || uploadCompleted}
          />
        </div>

        <!-- Replacement Toggle -->
        <div class="toggle-group">
          <label class="toggle-label">
            <input
              type="checkbox"
              bind:checked={replaceExisting}
              disabled={isUploading || isCommitting || uploadCompleted}
            />
            <span class="toggle-text">Substituir se o capítulo já existir</span>
          </label>
          <p class="toggle-hint">
            Se marcado, caso o capítulo já exista nesta obra, suas páginas serão atualizadas atomicamente.
          </p>
        </div>

        <div class="reset-wrap">
          <button type="button" class="btn-ghost-small" onclick={resetAll} disabled={isUploading || isCommitting}>
            <RotateCcw size={13} />
            <span>Escolher outros arquivos</span>
          </button>
        </div>
      </div>

      <!-- Right Column: Files & Upload Progress -->
      <div class="card files-card">
        <h2 class="card-title">
          <Layers size={18} />
          <span>Páginas e Envio</span>
        </h2>

        <div class="upload-status-box">
          <div class="status-header">
            <div class="status-summary">
              <span class="status-title">
                {uploadCompleted
                  ? '✓ Publicação Concluída'
                  : isUploading
                    ? 'Enviando páginas aos Shards…'
                    : completedPages === totalPages && totalPages > 0
                      ? 'Pronto para Publicação Atômica'
                      : `${totalPages} páginas prontas para envio`}
              </span>
              <span class="status-counter">
                {completedPages} / {totalPages} páginas enviadas ({progressPercent}%)
              </span>
            </div>

            {#if isUploading || (speedMBs > 0 && !uploadCompleted)}
              <div class="live-metrics">
                <span class="metric-speed">{speedMBs} MB/s</span>
                {#if etaSeconds > 0}
                  <span class="metric-eta">Restam ~{etaSeconds}s</span>
                {/if}
              </div>
            {/if}
          </div>

          <!-- Progress Bar -->
          <div class="progress-track" role="progressbar" aria-valuenow={progressPercent} aria-valuemin={0} aria-valuemax={100}>
            <div
              class="progress-fill"
              class:fill-done={completedPages === totalPages && totalPages > 0}
              class:fill-has-error={failedPages > 0}
              style="width: {progressPercent}%"
            ></div>
          </div>

          <!-- Controls Bar -->
          <div class="controls-bar">
            {#if !isUploading && !uploadCompleted && !sessionId}
              <button type="button" class="btn-primary" onclick={startSingleUploadSession}>
                <UploadCloud size={16} />
                <span>Publicar Capítulo ({totalPages} Páginas)</span>
              </button>
              <button type="button" class="btn-ghost" onclick={resetAll}>
                <X size={15} />
                <span>Descartar</span>
              </button>
            {:else if isUploading}
              <button type="button" class="btn-danger" onclick={cancelSingleSession}>
                <StopCircle size={15} />
                <span>Cancelar Upload</span>
              </button>
            {:else if failedPages > 0 && !uploadCompleted}
              <button type="button" class="btn-warning" onclick={retryFailedSingleUploads}>
                <RotateCcw size={15} />
                <span>Tentar Novamente ({failedPages} falhas)</span>
              </button>
              <button type="button" class="btn-ghost" onclick={cancelSingleSession}>
                <X size={15} />
                <span>Cancelar Sessão</span>
              </button>
            {:else if completedPages === totalPages && totalPages > 0 && !uploadCompleted}
              <button
                type="button"
                class="btn-commit"
                disabled={isCommitting}
                onclick={commitSingleSession}
              >
                <Check size={16} />
                <span>{isCommitting ? 'Commitando e Publicando…' : 'Publicar Capítulo Agora'}</span>
              </button>
              <button type="button" class="btn-ghost" onclick={cancelSingleSession}>
                <X size={15} />
                <span>Descartar</span>
              </button>
            {/if}
          </div>
        </div>

        <!-- Pages Thumbnail Grid -->
        <div class="pages-preview-header">
          <span class="preview-title">Grade de Páginas ({pages.length})</span>
          {#if !isUploading && !uploadCompleted && !sessionId}
            <span class="preview-hint">Clique no "X" para remover páginas indesejadas antes de enviar.</span>
          {/if}
        </div>

        <div class="pages-grid">
          {#each pages as page (page.index)}
            <div
              class="page-card"
              class:card-stored={page.status === 'STORED'}
              class:card-uploading={page.status === 'UPLOADING'}
              class:card-failed={page.status === 'FAILED'}
            >
              <div class="thumb-wrap">
                {#if page.previewUrl}
                  <img src={page.previewUrl} alt="Página {page.index}" class="thumb-img" loading="lazy" />
                {:else}
                  <div class="thumb-placeholder">Pág {page.index}</div>
                {/if}

                {#if !isUploading && !sessionId}
                  <button
                    type="button"
                    class="btn-remove-page"
                    title="Remover página"
                    onclick={() => removePage(page.index)}
                  >
                    <X size={12} />
                  </button>
                {/if}

                <div class="page-badge-overlay">
                  {#if page.status === 'STORED'}
                    <span class="badge-stored"><Check size={10} /> {page.index}</span>
                  {:else if page.status === 'UPLOADING'}
                    <span class="badge-uploading">{page.progress}%</span>
                  {:else if page.status === 'FAILED'}
                    <span class="badge-failed">! {page.index}</span>
                  {:else}
                    <span class="badge-idle">{page.index}</span>
                  {/if}
                </div>
              </div>

              <div class="page-info">
                <span class="page-num">Página {page.index}</span>
                <span class="page-file" title={page.filename}>{page.filename}</span>
              </div>
            </div>
          {/each}
        </div>
      </div>
    </div>

  {:else if uploadMode === 'batch'}
    <!-- MULTI-CHAPTER BATCH FLOW -->
    <div class="card batch-card">
      <div class="batch-header-bar">
        <div class="batch-titles">
          <h2 class="card-title-inline">
            <FolderArchive size={20} class="title-icon" />
            <span>{batchChapters.length} capítulos encontrados</span>
          </h2>
          <span class="batch-subtitle">
            {publishedBatchCount} / {batchChapters.length} capítulos publicados • {totalBatchPages} páginas no total
          </span>
        </div>

        <div class="batch-header-actions">
          {#if !isBatchUploading && publishedBatchCount < batchChapters.length}
            <button
              type="button"
              class="btn-primary"
              disabled={!selectedWorkId || isBatchUploading}
              onclick={startBatchUpload}
            >
              <UploadCloud size={16} />
              <span>Iniciar Envio do Lote ({batchChapters.length} Capítulos)</span>
            </button>
          {:else if isBatchUploading}
            <div class="batch-uploading-pill">
              <RefreshCw size={14} class="spin-icon" />
              <span>Enviando lote…</span>
            </div>
          {:else if publishedBatchCount === batchChapters.length && batchChapters.length > 0}
            <div class="batch-all-done-pill">
              <CheckCircle2 size={16} />
              <span>Todos os {batchChapters.length} capítulos foram publicados!</span>
            </div>
          {/if}

          <button
            type="button"
            class="btn-ghost"
            disabled={isBatchUploading}
            onclick={resetAll}
          >
            <RotateCcw size={14} />
            <span>Limpar Lote</span>
          </button>
        </div>
      </div>

      <!-- Overall Batch Progress Bar -->
      <div class="batch-overall-progress">
        <div class="progress-track" role="progressbar" aria-valuenow={overallBatchPercent} aria-valuemin={0} aria-valuemax={100}>
          <div
            class="progress-fill"
            class:fill-done={publishedBatchCount === batchChapters.length}
            style="width: {overallBatchPercent}%"
          ></div>
        </div>
      </div>

      <!-- Batch Chapters List -->
      <div class="batch-chapters-list">
        {#each batchChapters as ch, idx (ch.id)}
          <div
            class="batch-chapter-item"
            class:item-uploading={ch.status === 'UPLOADING'}
            class:item-published={ch.status === 'PUBLISHED'}
            class:item-failed={ch.status === 'FAILED'}
            class:item-conflict={ch.status === 'CONFLICT'}
          >
            <div class="item-left-col">
              <div class="item-file-header">
                <FileArchive size={16} class="file-icon" />
                <span class="item-filename" title={ch.name}>{ch.name}</span>
                <span class="item-page-count">{ch.totalPages} págs</span>
              </div>

              <div class="item-inputs-row">
                <div class="item-input-group">
                  <label for="ch-num-{idx}" class="item-label">Capítulo</label>
                  <input
                    id="ch-num-{idx}"
                    type="number"
                    step="any"
                    class="item-input input-ch-num"
                    bind:value={ch.chapterNumber}
                    disabled={isBatchUploading || ch.status === 'PUBLISHED'}
                  />
                  {#if ch.detectedNumber !== null}
                    <span class="detected-hint" title="Detectado a partir do nome do arquivo">
                      Detectado: {ch.detectedNumber}
                    </span>
                  {/if}
                </div>

                <div class="item-input-group flex-1">
                  <label for="ch-title-{idx}" class="item-label">Título (Opcional)</label>
                  <input
                    id="ch-title-{idx}"
                    type="text"
                    placeholder="Título do capítulo"
                    class="item-input"
                    bind:value={ch.chapterTitle}
                    disabled={isBatchUploading || ch.status === 'PUBLISHED'}
                  />
                </div>

                <div class="item-input-group w-24">
                  <label for="ch-vol-{idx}" class="item-label">Volume</label>
                  <input
                    id="ch-vol-{idx}"
                    type="text"
                    placeholder="Vol."
                    class="item-input"
                    bind:value={ch.volume}
                    disabled={isBatchUploading || ch.status === 'PUBLISHED'}
                  />
                </div>
              </div>

              {#if ch.status === 'UPLOADING' || (ch.status === 'FAILED' && ch.completedPages > 0)}
                <div class="item-progress-track">
                  <div class="item-progress-fill" style="width: {ch.progress}%"></div>
                </div>
              {/if}

              {#if ch.conflictMessage}
                <div class="item-conflict-box">
                  <AlertTriangle size={14} class="conflict-icon" />
                  <span>Capítulo {ch.chapterNumber} já existe nesta obra.</span>
                  <div class="conflict-buttons">
                    <button
                      type="button"
                      class="btn-replace"
                      onclick={() => replaceBatchChapter(ch)}
                    >
                      <span>Substituir</span>
                    </button>
                    <button
                      type="button"
                      class="btn-ignore"
                      onclick={() => ignoreBatchChapter(ch)}
                    >
                      <span>Ignorar</span>
                    </button>
                  </div>
                </div>
              {/if}

              {#if ch.errorMessage && ch.status === 'FAILED'}
                <div class="item-error-box">
                  <AlertCircle size={14} />
                  <span>{ch.errorMessage}</span>
                </div>
              {/if}
            </div>

            <div class="item-right-col">
              <!-- Status Badges -->
              {#if ch.status === 'READY'}
                <span class="status-pill pill-ready">• Aguardando</span>
              {:else if ch.status === 'UPLOADING'}
                <span class="status-pill pill-uploading">
                  <RefreshCw size={12} class="spin-icon" />
                  <span>↑ Enviando ({ch.completedPages}/{ch.totalPages})</span>
                </span>
              {:else if ch.status === 'COMMITTING'}
                <span class="status-pill pill-committing">⏳ Publicando…</span>
              {:else if ch.status === 'PUBLISHED'}
                <span class="status-pill pill-published">
                  <CheckCircle2 size={13} />
                  <span>✓ Pronto</span>
                </span>
              {:else if ch.status === 'FAILED'}
                <span class="status-pill pill-failed">! Falhou</span>
              {:else if ch.status === 'CONFLICT'}
                <span class="status-pill pill-conflict">⚠ Já existe</span>
              {:else if ch.status === 'SKIPPED'}
                <span class="status-pill pill-skipped">Ignorado</span>
              {/if}

              <!-- Action buttons per chapter -->
              {#if ch.status === 'FAILED'}
                <button
                  type="button"
                  class="btn-retry-chapter"
                  disabled={isBatchUploading}
                  onclick={() => retryBatchChapter(ch)}
                >
                  <RotateCcw size={13} />
                  <span>Tentar novamente</span>
                </button>
              {/if}

              {#if ch.status === 'PUBLISHED' && selectedWork}
                <a
                  href="/ler/{selectedWork.slug || selectedWork.id}/{ch.publishedChapter?.number ?? ch.chapterNumber}"
                  target="_blank"
                  rel="noreferrer"
                  class="btn-view-reader"
                  title="Ver no Leitor"
                >
                  <Eye size={13} />
                  <span>Ler</span>
                </a>
              {/if}

              {#if !isBatchUploading && ch.status !== 'PUBLISHED'}
                <button
                  type="button"
                  class="btn-remove-batch-item"
                  title="Remover do lote"
                  onclick={() => removeBatchChapter(ch.id)}
                >
                  <Trash2 size={14} />
                </button>
              {/if}
            </div>
          </div>
        {/each}
      </div>
    </div>
  {/if}
</div>

<style>
  .upload-manager-shell {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
    max-width: 1200px;
    margin: 0 auto;
    width: 100%;
    box-sizing: border-box;
    padding: 0.5rem;
  }

  /* Header */
  .page-header {
    margin-bottom: 0.5rem;
  }

  .breadcrumb-row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.8125rem;
    color: #94a3b8;
    margin-bottom: 0.5rem;
  }

  .btn-back {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    color: #94a3b8;
    text-decoration: none;
    transition: color 0.15s;
  }
  .btn-back:hover {
    color: #f1f5f9;
  }

  .work-link {
    color: #38bdf8;
    text-decoration: none;
    font-weight: 500;
  }

  .page-title {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    font-size: 1.75rem;
    font-weight: 700;
    color: #f8fafc;
    margin: 0 0 0.5rem;
  }

  .title-icon {
    color: #38bdf8;
  }

  .page-subtitle {
    margin: 0;
    font-size: 0.875rem;
    color: #94a3b8;
    max-width: 800px;
    line-height: 1.4;
  }

  /* Alerts */
  .alert-banner {
    display: flex;
    align-items: flex-start;
    gap: 0.75rem;
    padding: 1rem 1.25rem;
    border-radius: 0.5rem;
    font-size: 0.875rem;
  }

  .alert-error {
    background: rgba(239, 68, 68, 0.1);
    border: 1px solid rgba(239, 68, 68, 0.3);
    color: #fca5a5;
  }

  .alert-success {
    background: rgba(34, 197, 94, 0.1);
    border: 1px solid rgba(34, 197, 94, 0.3);
    color: #86efac;
  }

  .alert-icon {
    flex-shrink: 0;
    margin-top: 0.1rem;
  }

  .alert-content {
    flex: 1;
  }

  .alert-text {
    margin: 0 0 0.5rem;
  }

  .alert-close {
    background: none;
    border: none;
    color: inherit;
    cursor: pointer;
    opacity: 0.7;
  }
  .alert-close:hover {
    opacity: 1;
  }

  .conflict-toggle {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    margin-top: 0.5rem;
    font-size: 0.8125rem;
    color: #fecaca;
    cursor: pointer;
  }

  .success-actions {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    margin-top: 0.75rem;
    flex-wrap: wrap;
  }

  .btn-success-view,
  .btn-success-manage,
  .btn-success-next {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    padding: 0.5rem 0.875rem;
    border-radius: 0.375rem;
    font-size: 0.8125rem;
    font-weight: 500;
    text-decoration: none;
    cursor: pointer;
    border: none;
    transition: all 0.15s;
  }

  .btn-success-view {
    background: #16a34a;
    color: white;
  }
  .btn-success-view:hover {
    background: #15803d;
  }

  .btn-success-manage {
    background: #334155;
    color: #f1f5f9;
  }
  .btn-success-manage:hover {
    background: #475569;
  }

  .btn-success-next {
    background: #0284c7;
    color: white;
  }
  .btn-success-next:hover {
    background: #0369a1;
  }

  /* Cards */
  .card {
    background: #0f172a;
    border: 1px solid #1e293b;
    border-radius: 0.75rem;
    padding: 1.5rem;
    box-sizing: border-box;
  }

  .destination-card {
    padding: 1.25rem 1.5rem;
  }

  .dest-grid {
    display: flex;
    gap: 1rem;
    flex-wrap: wrap;
  }

  .flex-2 {
    flex: 2;
    min-width: 260px;
  }

  .flex-1 {
    flex: 1;
    min-width: 180px;
  }

  .w-32 {
    width: 8rem;
  }

  .w-24 {
    width: 6rem;
  }

  .card-header-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-bottom: 1px solid #1e293b;
    padding-bottom: 0.75rem;
    margin-bottom: 1.25rem;
  }

  .card-title {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 1.125rem;
    font-weight: 600;
    color: #f8fafc;
    margin: 0;
  }

  .file-source-badge {
    background: #1e293b;
    border: 1px solid #334155;
    color: #38bdf8;
    font-size: 0.6875rem;
    font-weight: 600;
    padding: 2px 8px;
    border-radius: 4px;
    max-width: 180px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  /* Form Elements */
  .form-group {
    margin-bottom: 1rem;
  }

  .form-label {
    display: block;
    font-size: 0.8125rem;
    font-weight: 500;
    color: #cbd5e1;
    margin-bottom: 0.35rem;
  }

  .form-input,
  .form-select {
    width: 100%;
    box-sizing: border-box;
    background: #1e293b;
    border: 1px solid #334155;
    border-radius: 0.375rem;
    padding: 0.6rem 0.75rem;
    color: #f8fafc;
    font-size: 0.875rem;
    transition: border-color 0.15s, box-shadow 0.15s;
  }

  .form-input:focus,
  .form-select:focus {
    outline: none;
    border-color: #38bdf8;
    box-shadow: 0 0 0 2px rgba(56, 189, 248, 0.2);
  }

  .form-row {
    display: flex;
    gap: 0.75rem;
  }

  .toggle-group {
    margin-top: 1rem;
    padding-top: 1rem;
    border-top: 1px solid #1e293b;
  }

  .toggle-label {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.875rem;
    color: #e2e8f0;
    cursor: pointer;
  }

  .toggle-hint {
    margin: 0.35rem 0 0 1.5rem;
    font-size: 0.75rem;
    color: #94a3b8;
    line-height: 1.35;
  }

  .reset-wrap {
    margin-top: 1.25rem;
    padding-top: 0.75rem;
    border-top: 1px solid #1e293b;
  }

  .btn-ghost-small {
    background: transparent;
    border: none;
    color: #94a3b8;
    font-size: 0.75rem;
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    cursor: pointer;
    padding: 0;
  }
  .btn-ghost-small:hover {
    color: #f1f5f9;
  }

  /* Dropzone */
  .dropzone {
    border: 2px dashed #334155;
    border-radius: 0.75rem;
    padding: 3.5rem 1.5rem;
    text-align: center;
    cursor: pointer;
    transition: all 0.2s;
    background: rgba(30, 41, 59, 0.3);
  }

  .dropzone:hover,
  .dropzone.drag-over {
    border-color: #38bdf8;
    background: rgba(56, 189, 248, 0.05);
  }

  .hidden-file-input {
    display: none;
  }

  .dropzone-icon-wrap {
    width: 72px;
    height: 72px;
    margin: 0 auto 1.25rem;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
    background: rgba(56, 189, 248, 0.1);
    color: #38bdf8;
  }

  .dropzone-title {
    font-size: 1.25rem;
    font-weight: 700;
    color: #f8fafc;
    margin: 0 0 0.5rem;
  }

  .dropzone-subtitle {
    font-size: 0.9375rem;
    color: #94a3b8;
    margin: 0 0 1.5rem;
    max-width: 500px;
    margin-left: auto;
    margin-right: auto;
    line-height: 1.45;
  }

  .dropzone-actions {
    margin-bottom: 1.5rem;
  }

  .btn-select-files {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.75rem 1.5rem;
    border-radius: 0.5rem;
    background: #0284c7;
    color: white;
    font-size: 0.9375rem;
    font-weight: 600;
    border: none;
    cursor: pointer;
    transition: background 0.15s;
  }
  .btn-select-files:hover {
    background: #0369a1;
  }

  .badges-row {
    display: flex;
    justify-content: center;
    gap: 0.5rem;
    flex-wrap: wrap;
  }

  .badge {
    background: #1e293b;
    border: 1px solid #334155;
    border-radius: 0.25rem;
    padding: 0.25rem 0.6rem;
    font-size: 0.6875rem;
    color: #94a3b8;
    font-weight: 600;
  }

  /* Single Grid Layout */
  .upload-grid {
    display: grid;
    grid-template-columns: 380px 1fr;
    gap: 1.5rem;
  }

  @media (max-width: 1024px) {
    .upload-grid {
      grid-template-columns: 1fr;
    }
  }

  /* Status Box */
  .upload-status-box {
    background: #1e293b;
    border: 1px solid #334155;
    border-radius: 0.5rem;
    padding: 1.25rem;
    margin-bottom: 1.5rem;
  }

  .status-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0.75rem;
    flex-wrap: wrap;
    gap: 0.5rem;
  }

  .status-title {
    display: block;
    font-size: 0.9375rem;
    font-weight: 600;
    color: #f8fafc;
  }

  .status-counter {
    font-size: 0.8125rem;
    color: #94a3b8;
  }

  .live-metrics {
    display: flex;
    gap: 0.75rem;
    font-size: 0.8125rem;
    font-weight: 600;
  }

  .metric-speed {
    color: #38bdf8;
  }

  .metric-eta {
    color: #fbbf24;
  }

  .progress-track {
    width: 100%;
    height: 8px;
    background: #0f172a;
    border-radius: 4px;
    overflow: hidden;
    margin-bottom: 1rem;
  }

  .progress-fill {
    height: 100%;
    background: #38bdf8;
    border-radius: 4px;
    transition: width 0.2s ease;
  }

  .progress-fill.fill-done {
    background: #22c55e;
  }

  .progress-fill.fill-has-error {
    background: #f59e0b;
  }

  .controls-bar {
    display: flex;
    gap: 0.75rem;
    align-items: center;
    flex-wrap: wrap;
  }

  .btn-primary,
  .btn-commit,
  .btn-danger,
  .btn-warning,
  .btn-ghost {
    display: inline-flex;
    align-items: center;
    gap: 0.45rem;
    padding: 0.6rem 1.125rem;
    border-radius: 0.375rem;
    font-size: 0.875rem;
    font-weight: 600;
    cursor: pointer;
    border: none;
    transition: all 0.15s;
  }

  .btn-primary {
    background: #0284c7;
    color: white;
  }
  .btn-primary:hover:not(:disabled) {
    background: #0369a1;
  }
  .btn-primary:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .btn-commit {
    background: #16a34a;
    color: white;
  }
  .btn-commit:hover:not(:disabled) {
    background: #15803d;
  }

  .btn-danger {
    background: #dc2626;
    color: white;
  }
  .btn-danger:hover {
    background: #b91c1c;
  }

  .btn-warning {
    background: #d97706;
    color: white;
  }
  .btn-warning:hover {
    background: #b45309;
  }

  .btn-ghost {
    background: transparent;
    color: #94a3b8;
  }
  .btn-ghost:hover:not(:disabled) {
    color: #f1f5f9;
    background: rgba(255, 255, 255, 0.05);
  }

  /* Pages Grid */
  .pages-preview-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0.75rem;
  }

  .preview-title {
    font-size: 0.875rem;
    font-weight: 600;
    color: #cbd5e1;
  }

  .preview-hint {
    font-size: 0.75rem;
    color: #64748b;
  }

  .pages-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(110px, 1fr));
    gap: 0.75rem;
    max-height: 520px;
    overflow-y: auto;
    padding-right: 0.25rem;
  }

  .page-card {
    background: #0b0f19;
    border: 1px solid #1e293b;
    border-radius: 0.375rem;
    overflow: hidden;
    position: relative;
    transition: all 0.15s;
  }

  .page-card.card-stored {
    border-color: #16a34a;
  }

  .page-card.card-uploading {
    border-color: #0284c7;
  }

  .page-card.card-failed {
    border-color: #dc2626;
  }

  .thumb-wrap {
    width: 100%;
    aspect-ratio: 3 / 4;
    background: #1e293b;
    position: relative;
    overflow: hidden;
  }

  .thumb-img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }

  .thumb-placeholder {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #64748b;
    font-size: 0.75rem;
  }

  .btn-remove-page {
    position: absolute;
    top: 4px;
    right: 4px;
    background: rgba(0, 0, 0, 0.7);
    color: #f1f5f9;
    border: none;
    border-radius: 50%;
    width: 20px;
    height: 20px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: background 0.15s;
  }
  .btn-remove-page:hover {
    background: #dc2626;
  }

  .page-badge-overlay {
    position: absolute;
    bottom: 4px;
    left: 4px;
    font-size: 0.625rem;
    font-weight: 700;
  }

  .badge-stored {
    background: #16a34a;
    color: white;
    padding: 1px 4px;
    border-radius: 2px;
    display: inline-flex;
    align-items: center;
    gap: 2px;
  }

  .badge-uploading {
    background: #0284c7;
    color: white;
    padding: 1px 4px;
    border-radius: 2px;
  }

  .badge-failed {
    background: #dc2626;
    color: white;
    padding: 1px 4px;
    border-radius: 2px;
  }

  .badge-idle {
    background: rgba(0, 0, 0, 0.6);
    color: #94a3b8;
    padding: 1px 4px;
    border-radius: 2px;
  }

  .page-info {
    padding: 0.35rem 0.5rem;
    font-size: 0.6875rem;
  }

  .page-num {
    display: block;
    font-weight: 600;
    color: #f1f5f9;
  }

  .page-file {
    display: block;
    color: #64748b;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  /* ---------------------------------------------------- */
  /* BATCH MODE STYLES                                    */
  /* ---------------------------------------------------- */
  .batch-header-bar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-wrap: wrap;
    gap: 1rem;
    margin-bottom: 1.25rem;
  }

  .card-title-inline {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 1.25rem;
    font-weight: 700;
    color: #f8fafc;
    margin: 0;
  }

  .batch-subtitle {
    display: block;
    font-size: 0.8125rem;
    color: #94a3b8;
    margin-top: 0.25rem;
  }

  .batch-header-actions {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    flex-wrap: wrap;
  }

  .batch-uploading-pill {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    padding: 0.5rem 1rem;
    background: rgba(56, 189, 248, 0.15);
    border: 1px solid rgba(56, 189, 248, 0.3);
    color: #38bdf8;
    font-size: 0.875rem;
    font-weight: 600;
    border-radius: 0.375rem;
  }

  .batch-all-done-pill {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    padding: 0.5rem 1rem;
    background: rgba(34, 197, 94, 0.15);
    border: 1px solid rgba(34, 197, 94, 0.3);
    color: #4ade80;
    font-size: 0.875rem;
    font-weight: 600;
    border-radius: 0.375rem;
  }

  .batch-overall-progress {
    margin-bottom: 1.5rem;
  }

  .batch-chapters-list {
    display: flex;
    flex-direction: column;
    gap: 0.875rem;
  }

  .batch-chapter-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    background: #1e293b;
    border: 1px solid #334155;
    border-radius: 0.5rem;
    padding: 1rem 1.25rem;
    gap: 1.25rem;
    transition: all 0.15s;
  }

  .batch-chapter-item.item-uploading {
    border-color: #0284c7;
    background: rgba(2, 132, 199, 0.05);
  }

  .batch-chapter-item.item-published {
    border-color: #16a34a;
    background: rgba(22, 163, 74, 0.04);
  }

  .batch-chapter-item.item-failed {
    border-color: #dc2626;
    background: rgba(220, 38, 38, 0.04);
  }

  .batch-chapter-item.item-conflict {
    border-color: #f59e0b;
    background: rgba(245, 158, 11, 0.04);
  }

  .item-left-col {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 0.6rem;
  }

  .item-file-header {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .file-icon {
    color: #38bdf8;
    flex-shrink: 0;
  }

  .item-filename {
    font-size: 0.875rem;
    font-weight: 600;
    color: #f8fafc;
    word-break: break-all;
  }

  .item-page-count {
    background: #0f172a;
    border: 1px solid #334155;
    border-radius: 3px;
    padding: 1px 6px;
    font-size: 0.6875rem;
    color: #94a3b8;
    font-weight: 500;
    flex-shrink: 0;
  }

  .item-inputs-row {
    display: flex;
    gap: 0.75rem;
    align-items: flex-end;
    flex-wrap: wrap;
  }

  .item-input-group {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .input-ch-num {
    width: 6.5rem;
  }

  .item-label {
    font-size: 0.6875rem;
    color: #94a3b8;
    font-weight: 500;
  }

  .item-input {
    background: #0f172a;
    border: 1px solid #334155;
    border-radius: 0.25rem;
    padding: 0.35rem 0.5rem;
    color: #f8fafc;
    font-size: 0.8125rem;
  }

  .detected-hint {
    font-size: 0.625rem;
    color: #38bdf8;
    font-weight: 500;
  }

  .item-progress-track {
    width: 100%;
    height: 4px;
    background: #0f172a;
    border-radius: 2px;
    overflow: hidden;
    margin-top: 0.25rem;
  }

  .item-progress-fill {
    height: 100%;
    background: #38bdf8;
    border-radius: 2px;
    transition: width 0.2s ease;
  }

  .item-conflict-box {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    padding: 0.5rem 0.75rem;
    background: rgba(245, 158, 11, 0.1);
    border: 1px solid rgba(245, 158, 11, 0.3);
    border-radius: 0.375rem;
    font-size: 0.8125rem;
    color: #fef08a;
    flex-wrap: wrap;
  }

  .conflict-icon {
    color: #f59e0b;
    flex-shrink: 0;
  }

  .conflict-buttons {
    display: flex;
    gap: 0.4rem;
    margin-left: auto;
  }

  .btn-replace {
    background: #f59e0b;
    color: #0f172a;
    border: none;
    border-radius: 0.25rem;
    padding: 0.25rem 0.6rem;
    font-size: 0.75rem;
    font-weight: 700;
    cursor: pointer;
  }
  .btn-replace:hover {
    background: #d97706;
  }

  .btn-ignore {
    background: transparent;
    border: 1px solid #475569;
    color: #cbd5e1;
    border-radius: 0.25rem;
    padding: 0.25rem 0.6rem;
    font-size: 0.75rem;
    cursor: pointer;
  }
  .btn-ignore:hover {
    background: rgba(255, 255, 255, 0.05);
  }

  .item-error-box {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    font-size: 0.75rem;
    color: #fca5a5;
  }

  .item-right-col {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    flex-shrink: 0;
  }

  .status-pill {
    padding: 0.3rem 0.75rem;
    border-radius: 1rem;
    font-size: 0.75rem;
    font-weight: 600;
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
  }

  .pill-ready {
    background: #334155;
    color: #cbd5e1;
  }

  .pill-uploading {
    background: rgba(2, 132, 199, 0.2);
    border: 1px solid rgba(2, 132, 199, 0.4);
    color: #38bdf8;
  }

  .pill-committing {
    background: rgba(234, 179, 8, 0.2);
    color: #fde047;
  }

  .pill-published {
    background: rgba(22, 163, 74, 0.2);
    border: 1px solid rgba(22, 163, 74, 0.4);
    color: #4ade80;
  }

  .pill-failed {
    background: rgba(220, 38, 38, 0.2);
    border: 1px solid rgba(220, 38, 38, 0.4);
    color: #f87171;
  }

  .pill-conflict {
    background: rgba(245, 158, 11, 0.2);
    border: 1px solid rgba(245, 158, 11, 0.4);
    color: #fcd34d;
  }

  .pill-skipped {
    background: #1e293b;
    color: #64748b;
  }

  .btn-retry-chapter {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    padding: 0.35rem 0.65rem;
    background: #d97706;
    color: white;
    border: none;
    border-radius: 0.25rem;
    font-size: 0.75rem;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.15s;
  }
  .btn-retry-chapter:hover:not(:disabled) {
    background: #b45309;
  }

  .btn-view-reader {
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
    padding: 0.35rem 0.65rem;
    background: #16a34a;
    color: white;
    text-decoration: none;
    border-radius: 0.25rem;
    font-size: 0.75rem;
    font-weight: 600;
    transition: background 0.15s;
  }
  .btn-view-reader:hover {
    background: #15803d;
  }

  .btn-remove-batch-item {
    background: transparent;
    border: none;
    color: #64748b;
    padding: 0.35rem;
    border-radius: 0.25rem;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.15s;
  }
  .btn-remove-batch-item:hover {
    color: #ef4444;
    background: rgba(239, 68, 68, 0.1);
  }

  .spin-icon {
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }

  @media (max-width: 768px) {
    .dest-grid {
      flex-direction: column;
    }
    .w-32, .w-24, .flex-2, .flex-1 {
      width: 100%;
    }
    .batch-chapter-item {
      flex-direction: column;
      align-items: stretch;
    }
    .item-right-col {
      justify-content: space-between;
      border-top: 1px solid #334155;
      padding-top: 0.75rem;
    }
  }
</style>
