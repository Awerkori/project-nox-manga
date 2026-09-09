<script lang="ts">
  import { action } from '$lib/actions';
  import { extractChaptersFromZip, normalizePage, type DetectedChapter } from '$lib/uploads';
  import { flushUploads, UploadRateLimitError } from '$lib/upload-queue';
  import {
    FolderArchive,
    UploadCloud,
    CheckCircle2,
    AlertCircle,
    AlertTriangle,
    Loader2,
    X,
    Play,
    Pause,
    Check
  } from '@lucide/svelte';

  interface ChapterRow extends DetectedChapter {
    id?: string;
    selected: boolean;
    alreadyExists: boolean;
    status: 'idle' | 'uploading' | 'saving' | 'done' | 'error';
    error?: string;
    uploadedCount: number;
  }

  let {
    work,
    existingChapters,
    onClose,
    onSuccess
  }: {
    work: { id: string; title: string };
    existingChapters: { id: string; number: number; title: string | null }[];
    onClose: () => void;
    onSuccess: () => void;
  } = $props();

  let step = $state<'select' | 'parsing' | 'preview' | 'importing' | 'completed'>('select');
  let chapters = $state<ChapterRow[]>([]);
  let parseError = $state('');
  let isPaused = $state(false);
  let cancelRequested = $state(false);

  // Overall import state
  let currentIdx = $state(0);
  let currentProgressText = $state('');
  let currentRetryNotice = $state('');
  let currentChapterPageTotal = $state(0);
  let currentChapterPageDone = $state(0);

  let selectedChapters = $derived(chapters.filter((c) => c.selected));
  let completedCount = $derived(chapters.filter((c) => c.status === 'done').length);
  let overallPercent = $derived(
    selectedChapters.length > 0
      ? Math.round((completedCount / selectedChapters.length) * 100)
      : 0
  );

  async function handleFileSelect(e: Event) {
    const input = e.currentTarget as HTMLInputElement;
    if (!input.files?.length) return;
    const file = input.files[0];
    input.value = '';

    step = 'parsing';
    parseError = '';

    try {
      const detected = await extractChaptersFromZip(file);
      const existingMap = new Map(existingChapters.map((c) => [c.number, c.id]));

      chapters = detected.map((item) => {
        const existingId = existingMap.get(item.number);
        return {
          ...item,
          id: existingId,
          selected: true,
          alreadyExists: !!existingId,
          status: 'idle',
          uploadedCount: 0
        };
      });

      step = 'preview';
    } catch (err) {
      parseError = (err as Error).message || 'Falha ao processar arquivo ZIP.';
      step = 'select';
    }
  }

  async function startImport() {
    if (!selectedChapters.length) return;
    step = 'importing';
    isPaused = false;
    cancelRequested = false;

    for (let i = 0; i < chapters.length; i++) {
      if (cancelRequested) break;
      const ch = chapters[i];
      if (!ch.selected || ch.status === 'done') continue;

      currentIdx = i;
      ch.status = 'uploading';
      currentChapterPageTotal = ch.files.length;
      currentChapterPageDone = 0;
      currentProgressText = `Capítulo ${ch.number}: preparando páginas…`;

      try {
        // 1. Get or create chapter record
        let chapterId = ch.id;
        if (!chapterId) {
          const createRes = (await action('editor', 'chapter', {
            work_id: work.id,
            number: ch.number,
            title: ch.title || '',
            pages: []
          })) as { id: string };
          chapterId = createRes.id;
          ch.id = chapterId;
        }

        // 2. Upload pages
        const pendingFiles = [...ch.files];
        const uploadedMediaIds: string[] = [];

        await flushUploads(
          pendingFiles,
          async (file) => {
            currentProgressText = `Capítulo ${ch.number}: enviando ${file.name} (${uploadedMediaIds.length + 1}/${ch.files.length})…`;
            const blob = await normalizePage(file);
            const res = await fetch('/api/upload', {
              method: 'POST',
              headers: { 'Content-Type': blob.type },
              body: blob
            });
            if (res.status === 429) {
              const retryAfter = Number(res.headers.get('Retry-After') || 5);
              const body = await res.json().catch(() => ({}));
              throw new UploadRateLimitError(retryAfter, body.error || 'Rate limit temporário');
            }

            const data = await res.json();
            if (!res.ok) throw new Error(data.message || 'Falha no upload da página');
            return data;
          },
          (result) => {
            uploadedMediaIds.push(result.id);
            currentChapterPageDone = uploadedMediaIds.length;
            ch.uploadedCount = uploadedMediaIds.length;
          },
          () => isPaused,
          {
            maxRetries: 6,
            onRetry: (_file, attempt, waitSeconds) => {
              currentRetryNotice = `Aguardando ${waitSeconds}s (tentativa ${attempt}) antes de prosseguir…`;
            }
          }
        );

        currentRetryNotice = '';
        ch.status = 'saving';
        currentProgressText = `Capítulo ${ch.number}: salvando e publicando…`;

        // 3. Save chapter pages
        await action('editor', 'chapter', {
          id: chapterId,
          work_id: work.id,
          number: ch.number,
          title: ch.title || '',
          pages: uploadedMediaIds
        });

        // 4. Publish chapter
        await action('editor', 'publish', {
          id: chapterId,
          confirmed_final: true
        });

        ch.status = 'done';
      } catch (err) {
        ch.status = 'error';
        ch.error = (err as Error).message || 'Erro durante o envio.';
        // Stop batch if user didn't request pause, let user inspect error
        break;
      }
    }

    if (chapters.filter((c) => c.selected).every((c) => c.status === 'done')) {
      step = 'completed';
    }
  }
</script>

<div class="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="batch-title">
  <div class="modal-card">
    <div class="modal-header">
      <div class="modal-title-cluster">
        <FolderArchive size={20} class="header-icon" />
        <div>
          <h2 id="batch-title" class="modal-title">Importação em Lote por ZIP</h2>
          <span class="modal-subtitle">{work.title}</span>
        </div>
      </div>
      {#if step !== 'importing'}
        <button type="button" class="btn-close" onclick={onClose} aria-label="Fechar">
          <X size={18} />
        </button>
      {/if}
    </div>

    <div class="modal-body">
      {#if step === 'select'}
        <div class="select-view">
          <div class="info-guide">
            <strong>Estrutura recomendada de pastas dentro do ZIP:</strong>
            <ul>
              <li><code>Capítulo 01/001.jpg</code>, <code>Capítulo 01/002.jpg</code>…</li>
              <li><code>Cap 02/01.png</code>, <code>Cap 02/02.png</code>…</li>
              <li>ou <code>001/01.webp</code>, <code>002/01.webp</code>…</li>
            </ul>
            <p class="guide-note">
              O sistema detecta os números dos capítulos automaticamente, ordena as páginas por ordem natural e permite revisar tudo antes de iniciar o envio.
            </p>
          </div>

          {#if parseError}
            <div class="error-box">
              <AlertCircle size={16} />
              <span>{parseError}</span>
            </div>
          {/if}

          <label class="dropzone">
            <UploadCloud size={40} />
            <span class="dropzone-label">Clique para selecionar o arquivo ZIP</span>
            <span class="dropzone-hint">Formatos aceitos: .zip (máx. 800 MB)</span>
            <input
              type="file"
              accept=".zip,application/zip"
              onchange={handleFileSelect}
              style="display:none"
            />
          </label>
        </div>

      {:else if step === 'parsing'}
        <div class="loading-view">
          <Loader2 size={36} class="spinner" />
          <p class="loading-msg">Lendo e validando estrutura do arquivo ZIP…</p>
          <span class="loading-sub">Isso pode levar alguns segundos dependendo do tamanho do arquivo.</span>
        </div>

      {:else if step === 'preview'}
        <div class="preview-view">
          <div class="preview-header">
            <span><strong>{chapters.length}</strong> capítulos identificados:</span>
            <button
              type="button"
              class="btn-toggle-all"
              onclick={() => {
                const allSelected = chapters.every((c) => c.selected);
                chapters = chapters.map((c) => ({ ...c, selected: !allSelected }));
              }}
            >
              {chapters.every((c) => c.selected) ? 'Desmarcar todos' : 'Selecionar todos'}
            </button>
          </div>

          <div class="chapters-preview-table-wrap">
            <table class="preview-table">
              <thead>
                <tr>
                  <th style="width: 40px"></th>
                  <th>Pasta no ZIP</th>
                  <th style="width: 110px">Capítulo</th>
                  <th>Título Opcional</th>
                  <th style="width: 90px">Páginas</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {#each chapters as ch, idx (ch.folder + idx)}
                  <tr class="preview-row" class:is-disabled={!ch.selected}>
                    <td>
                      <input type="checkbox" bind:checked={ch.selected} />
                    </td>
                    <td class="folder-cell">
                      <code>{ch.folder}</code>
                    </td>
                    <td>
                      <input
                        type="number"
                        step="any"
                        bind:value={ch.number}
                        class="input-table-num"
                        disabled={!ch.selected}
                      />
                    </td>
                    <td>
                      <input
                        type="text"
                        bind:value={ch.title}
                        placeholder="Sem título"
                        class="input-table-title"
                        disabled={!ch.selected}
                      />
                    </td>
                    <td class="pages-cell">
                      {ch.files.length} págs
                    </td>
                    <td>
                      {#if ch.alreadyExists}
                        <span class="tag-warn" title="O capítulo já existe no site. As páginas serão substituídas.">
                          <AlertTriangle size={12} />
                          <span>Já existe</span>
                        </span>
                      {:else}
                        <span class="tag-new">
                          <Check size={12} />
                          <span>Novo</span>
                        </span>
                      {/if}
                    </td>
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
        </div>

      {:else if step === 'importing'}
        <div class="importing-view">
          <div class="overall-progress-card">
            <div class="progress-bar-wrap">
              <div class="progress-bar-fill" style="width: {overallPercent}%"></div>
            </div>
            <div class="progress-text-row">
              <span class="prog-label">Progresso Geral: {completedCount} de {selectedChapters.length} capítulos ({overallPercent}%)</span>
            </div>
          </div>

          <div class="current-task-card">
            <div class="task-info">
              <Loader2 size={18} class="spinner" />
              <span class="task-name">{currentProgressText}</span>
            </div>
            {#if currentRetryNotice}
              <div class="retry-notice">
                <AlertCircle size={14} />
                <span>{currentRetryNotice}</span>
              </div>
            {/if}
            {#if currentChapterPageTotal > 0}
              <div class="sub-progress-bar-wrap">
                <div
                  class="sub-progress-bar-fill"
                  style="width: {Math.round((currentChapterPageDone / currentChapterPageTotal) * 100)}%"
                ></div>
              </div>
              <span class="sub-progress-text">{currentChapterPageDone} / {currentChapterPageTotal} páginas enviadas</span>
            {/if}
          </div>

          <div class="chapters-status-list">
            {#each chapters.filter((c) => c.selected) as ch (ch.folder)}
              <div class="status-item" class:is-done={ch.status === 'done'} class:is-err={ch.status === 'error'}>
                {#if ch.status === 'done'}
                  <CheckCircle2 size={16} class="icon-done" />
                {:else if ch.status === 'error'}
                  <AlertCircle size={16} class="icon-err" />
                {:else if ch.status === 'uploading' || ch.status === 'saving'}
                  <Loader2 size={16} class="spinner icon-active" />
                {:else}
                  <span class="icon-pending">○</span>
                {/if}
                <span class="status-ch-name">Capítulo {ch.number} ({ch.files.length} págs)</span>
                {#if ch.error}
                  <span class="status-ch-err">— {ch.error}</span>
                {/if}
              </div>
            {/each}
          </div>
        </div>

      {:else if step === 'completed'}
        <div class="completed-view">
          <CheckCircle2 size={52} class="icon-success-large" />
          <h3 class="completed-heading">Lote Concluído com Sucesso!</h3>
          <p class="completed-sub">
            Todos os {completedCount} capítulos selecionados foram enviados e publicados na obra.
          </p>
        </div>
      {/if}
    </div>

    <div class="modal-footer">
      {#if step === 'preview'}
        <button type="button" class="btn-modal-cancel" onclick={() => (step = 'select')}>
          Voltar
        </button>
        <button
          type="button"
          class="btn-modal-primary"
          onclick={startImport}
          disabled={!selectedChapters.length}
        >
          <Play size={15} />
          <span>Iniciar Importação ({selectedChapters.length})</span>
        </button>
      {:else if step === 'importing'}
        <button
          type="button"
          class="btn-modal-cancel"
          onclick={() => {
            cancelRequested = true;
            onClose();
          }}
        >
          Parar e Fechar
        </button>
        <button
          type="button"
          class="btn-modal-secondary"
          onclick={() => (isPaused = !isPaused)}
        >
          {#if isPaused}
            <Play size={15} />
            <span>Continuar</span>
          {:else}
            <Pause size={15} />
            <span>Pausar</span>
          {/if}
        </button>
      {:else if step === 'completed'}
        <button type="button" class="btn-modal-primary" onclick={onSuccess}>
          Concluir e Atualizar Obra
        </button>
      {:else}
        <button type="button" class="btn-modal-cancel" onclick={onClose}>
          Fechar
        </button>
      {/if}
    </div>
  </div>
</div>

<style>
  .modal-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.75);
    backdrop-filter: blur(8px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    padding: 20px;
  }

  .modal-card {
    background: #0d101a;
    border: 1px solid rgba(181, 154, 245, 0.2);
    border-radius: 20px;
    width: 100%;
    max-width: 780px;
    max-height: 90vh;
    display: flex;
    flex-direction: column;
    box-shadow: 0 30px 80px rgba(0, 0, 0, 0.8), 0 0 40px rgba(181, 154, 245, 0.1);
    overflow: hidden;
  }

  .modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 20px 24px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  }

  .modal-title-cluster {
    display: flex;
    align-items: center;
    gap: 14px;
  }

  :global(.header-icon) {
    color: #b59af5;
  }

  .modal-title {
    font-size: 18px;
    font-weight: 750;
    color: #ffffff;
    margin: 0;
  }

  .modal-subtitle {
    font-size: 12px;
    color: #8c899e;
  }

  .btn-close {
    background: none;
    border: none;
    color: #8c899e;
    cursor: pointer;
    padding: 6px;
    border-radius: 8px;
    display: flex;
  }

  .btn-close:hover {
    color: #ffffff;
    background: rgba(255, 255, 255, 0.06);
  }

  .modal-body {
    padding: 24px;
    overflow-y: auto;
    flex: 1;
  }

  .info-guide {
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: 12px;
    padding: 16px;
    margin-bottom: 20px;
    font-size: 13px;
    color: #b3afc2;
    line-height: 1.6;
  }

  .info-guide strong {
    color: #dfc28d;
    display: block;
    margin-bottom: 6px;
  }

  .info-guide ul {
    margin: 6px 0 10px 20px;
    padding: 0;
  }

  .info-guide code {
    background: rgba(0, 0, 0, 0.4);
    padding: 2px 6px;
    border-radius: 4px;
    color: #b59af5;
  }

  .guide-note {
    margin: 0;
    font-size: 12px;
    color: #8c899e;
  }

  .dropzone {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 10px;
    border: 2px dashed rgba(181, 154, 245, 0.3);
    border-radius: 16px;
    padding: 48px 24px;
    cursor: pointer;
    background: rgba(181, 154, 245, 0.02);
    transition: all 0.2s ease;
  }

  .dropzone:hover {
    border-color: #b59af5;
    background: rgba(181, 154, 245, 0.06);
  }

  .dropzone-label {
    font-size: 15px;
    font-weight: 650;
    color: #ffffff;
  }

  .dropzone-hint {
    font-size: 12px;
    color: #8c899e;
  }

  .loading-view,
  .completed-view {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 40px 20px;
    text-align: center;
  }

  .loading-msg {
    font-size: 16px;
    font-weight: 650;
    color: #ffffff;
    margin: 16px 0 4px;
  }

  .loading-sub {
    font-size: 13px;
    color: #8c899e;
  }

  .completed-heading {
    font-size: 20px;
    font-weight: 800;
    color: #ffffff;
    margin: 16px 0 8px;
  }

  .completed-sub {
    font-size: 14px;
    color: #8c899e;
    max-width: 440px;
  }

  :global(.icon-success-large) {
    color: #10b981;
  }

  .preview-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 14px;
    font-size: 14px;
    color: #d1cde0;
  }

  .btn-toggle-all {
    background: none;
    border: none;
    color: #b59af5;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
  }

  .btn-toggle-all:hover {
    text-decoration: underline;
  }

  .chapters-preview-table-wrap {
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 12px;
    overflow: hidden;
    max-height: 420px;
    overflow-y: auto;
  }

  .preview-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 13px;
  }

  .preview-table th {
    background: rgba(255, 255, 255, 0.04);
    padding: 10px 12px;
    text-align: left;
    font-weight: 600;
    color: #8c899e;
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }

  .preview-row td {
    padding: 10px 12px;
    border-top: 1px solid rgba(255, 255, 255, 0.04);
  }

  .preview-row.is-disabled {
    opacity: 0.45;
  }

  .input-table-num {
    width: 80px;
    padding: 6px 8px;
    border-radius: 6px;
    background: rgba(0, 0, 0, 0.4);
    border: 1px solid rgba(255, 255, 255, 0.12);
    color: #ffffff;
    font-weight: 700;
    font-size: 13px;
  }

  .input-table-title {
    width: 100%;
    padding: 6px 10px;
    border-radius: 6px;
    background: rgba(0, 0, 0, 0.4);
    border: 1px solid rgba(255, 255, 255, 0.12);
    color: #ffffff;
    font-size: 13px;
  }

  .tag-warn {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 3px 8px;
    border-radius: 6px;
    background: rgba(245, 158, 11, 0.15);
    color: #fbbf24;
    font-size: 11px;
    font-weight: 650;
  }

  .tag-new {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 3px 8px;
    border-radius: 6px;
    background: rgba(16, 185, 129, 0.15);
    color: #34d399;
    font-size: 11px;
    font-weight: 650;
  }

  .overall-progress-card {
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: 14px;
    padding: 16px;
    margin-bottom: 16px;
  }

  .progress-bar-wrap {
    height: 8px;
    background: rgba(255, 255, 255, 0.08);
    border-radius: 999px;
    overflow: hidden;
    margin-bottom: 10px;
  }

  .progress-bar-fill {
    height: 100%;
    background: linear-gradient(90deg, #8b5cf6, #3b82f6);
    transition: width 0.3s ease;
  }

  .progress-text-row {
    font-size: 13px;
    font-weight: 650;
    color: #ffffff;
  }

  .current-task-card {
    background: rgba(181, 154, 245, 0.06);
    border: 1px solid rgba(181, 154, 245, 0.2);
    border-radius: 12px;
    padding: 14px;
    margin-bottom: 20px;
  }

  .task-info {
    display: flex;
    align-items: center;
    gap: 10px;
    font-size: 13.5px;
    color: #ffffff;
    font-weight: 600;
  }

  .sub-progress-bar-wrap {
    height: 4px;
    background: rgba(255, 255, 255, 0.08);
    border-radius: 999px;
    overflow: hidden;
    margin: 10px 0 6px;
  }

  .sub-progress-bar-fill {
    height: 100%;
    background: #b59af5;
    transition: width 0.2s ease;
  }

  .sub-progress-text {
    font-size: 11px;
    color: #8c899e;
  }

  .retry-notice {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-top: 8px;
    font-size: 12px;
    color: #fbbf24;
  }

  .chapters-status-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
    max-height: 240px;
    overflow-y: auto;
  }

  .status-item {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 12px;
    border-radius: 8px;
    background: rgba(255, 255, 255, 0.02);
    font-size: 13px;
    color: #b3afc2;
  }

  :global(.icon-done) {
    color: #10b981;
  }

  :global(.icon-err) {
    color: #ef4444;
  }

  :global(.icon-active) {
    color: #b59af5;
  }

  .icon-pending {
    color: #635f73;
    font-size: 12px;
    width: 16px;
    text-align: center;
  }

  .status-ch-err {
    color: #f87171;
    font-size: 12px;
  }

  .error-box {
    display: flex;
    align-items: center;
    gap: 8px;
    background: rgba(239, 68, 68, 0.12);
    border: 1px solid rgba(239, 68, 68, 0.25);
    border-radius: 10px;
    padding: 12px 14px;
    color: #fca5a5;
    font-size: 13px;
    margin-bottom: 16px;
  }

  .modal-footer {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 12px;
    padding: 16px 24px;
    border-top: 1px solid rgba(255, 255, 255, 0.08);
  }

  .btn-modal-cancel {
    padding: 10px 18px;
    border-radius: 10px;
    background: rgba(255, 255, 255, 0.06);
    border: 1px solid rgba(255, 255, 255, 0.1);
    color: #d1cde0;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
  }

  .btn-modal-cancel:hover {
    background: rgba(255, 255, 255, 0.1);
    color: #ffffff;
  }

  .btn-modal-secondary {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 10px 18px;
    border-radius: 10px;
    background: rgba(181, 154, 245, 0.15);
    border: 1px solid rgba(181, 154, 245, 0.3);
    color: #ffffff;
    font-size: 13px;
    font-weight: 650;
    cursor: pointer;
  }

  .btn-modal-primary {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 10px 22px;
    border-radius: 10px;
    background: linear-gradient(135deg, #8b5cf6, #6d28d9);
    border: 1px solid rgba(255, 255, 255, 0.2);
    color: #ffffff;
    font-size: 13.5px;
    font-weight: 700;
    cursor: pointer;
    box-shadow: 0 4px 16px rgba(109, 40, 217, 0.4);
    transition: all 0.2s ease;
  }

  .btn-modal-primary:hover:not(:disabled) {
    transform: translateY(-1px);
    box-shadow: 0 6px 20px rgba(109, 40, 217, 0.6);
  }

  .btn-modal-primary:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  :global(.spinner) {
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    from {
      transform: rotate(0deg);
    }
    to {
      transform: rotate(360deg);
    }
  }
</style>
