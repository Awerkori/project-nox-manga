<script lang="ts">
  import { CheckCircle2, Download, FileText, RefreshCw, Trash2, Upload, X } from '@lucide/svelte';

  type QueueState = 'queued' | 'uploading' | 'success' | 'error';
  type UploadItem = {
    id: string;
    uploadId: string;
    file: File;
    replaceFileId?: string;
    status: QueueState;
    progress: number;
    error?: string;
    version?: number;
  };
  type UploadRequestError = Error & { status?: number };

  let {
    scanId,
    productionChapterId,
    stageId,
    currentFiles = [],
    disabled = false,
    onFilesChanged = async () => {},
    onUploadStateChange = (_hasOpenUploads: boolean) => {}
  } = $props();

  const collator = new Intl.Collator('pt-BR', { numeric: true, sensitivity: 'base' });
  let queue = $state<UploadItem[]>([]);
  let fileInput = $state<HTMLInputElement | null>(null);
  let replaceInput = $state<HTMLInputElement | null>(null);
  let replaceTarget = $state<any | null>(null);
  let dragging = $state(false);
  let isRemoving = $state<string | null>(null);
  let refreshScheduled = false;
  let lastReportedOpenUploads = false;

  let sortedCurrentFiles = $derived(
    [...currentFiles].filter((file: any) => file.is_current).sort((a: any, b: any) => collator.compare(a.file_name, b.file_name))
  );
  let activeUploads = $derived(queue.some((item) => item.status === 'queued' || item.status === 'uploading'));
  let hasFailedUploads = $derived(queue.some((item) => item.status === 'error'));

  $effect(() => {
    const nextOpenState = activeUploads || hasFailedUploads;
    // The parent callback is intentionally invoked only on a real state edge.
    // Calling it on every render creates a parent/child reactive loop when the
    // parent uses an inline callback to keep its completion button disabled.
    if (nextOpenState !== lastReportedOpenUploads) {
      lastReportedOpenUploads = nextOpenState;
      onUploadStateChange(nextOpenState);
    }
  });

  function formatBytes(bytes: number) {
    if (!bytes) return '0 B';
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), sizes.length - 1);
    return `${(bytes / Math.pow(1024, index)).toFixed(index ? 1 : 0)} ${sizes[index]}`;
  }

  function enqueue(files: File[], replaceFileId?: string) {
    const accepted = replaceFileId ? files.slice(0, 1) : files;
    if (!accepted.length) return;
    queue = [
      ...queue,
      ...accepted.map((file) => ({
        id: crypto.randomUUID(),
        uploadId: crypto.randomUUID(),
        file,
        replaceFileId,
        status: 'queued' as QueueState,
        progress: 0
      }))
    ];
    void drainQueue();
  }

  function handleSelection(event: Event, replacement?: any) {
    const input = event.currentTarget as HTMLInputElement;
    enqueue(Array.from(input.files || []), replacement?.id);
    input.value = '';
    replaceTarget = null;
  }

  function startReplace(file: any) {
    if (disabled) return;
    replaceTarget = file;
    replaceInput?.click();
  }

  function concurrencyForQueue() {
    // The existing Worker buffers an artifact before handing it to its storage
    // backend. Two small files are faster; a large artifact remains serialized
    // to keep memory bounded.
    return queue.some((item) => item.file.size > 20_971_520) ? 1 : 2;
  }

  async function drainQueue() {
    const limit = concurrencyForQueue();
    while (queue.filter((item) => item.status === 'uploading').length < limit) {
      const next = queue.find((item) => item.status === 'queued');
      if (!next) break;
      void uploadItem(next);
    }
  }

  function uploadWithProgress(item: UploadItem): Promise<any> {
    return new Promise((resolve, reject) => {
      const data = new FormData();
      data.set('scan_id', scanId);
      data.set('production_chapter_id', productionChapterId);
      data.set('stage_id', stageId);
      data.set('file', item.file);
      data.set('upload_id', item.uploadId);
      if (item.replaceFileId) data.set('replace_file_id', item.replaceFileId);

      const request = new XMLHttpRequest();
      request.open('POST', '/api/scan/production/upload');
      request.responseType = 'json';
      request.upload.onprogress = (event) => {
        if (!event.lengthComputable) return;
        item.progress = Math.max(1, Math.round((event.loaded / event.total) * 100));
        queue = [...queue];
      };
      request.onerror = () => reject(new Error('Falha de rede durante o envio.'));
      request.onload = () => {
        const body = request.response || (() => {
          try { return JSON.parse(request.responseText); } catch { return {}; }
        })();
        if (request.status < 200 || request.status >= 300 || body?.error) {
          const error = new Error(body?.error || `Falha no upload (${request.status})`) as UploadRequestError;
          error.status = request.status;
          reject(error);
          return;
        }
        resolve(body);
      };
      request.send(data);
    });
  }

  async function uploadItem(item: UploadItem) {
    item.status = 'uploading';
    item.error = undefined;
    item.progress = Math.max(item.progress, 1);
    queue = [...queue];
    try {
      const result = await uploadWithProgress(item);
      item.status = 'success';
      item.version = result.version;
      item.progress = 100;
      scheduleRefresh();
    } catch (error) {
      item.status = 'error';
      item.error = error instanceof Error ? error.message : 'Falha no upload.';
      // A stale replacement or a stage claimed/completed by someone else is a
      // normal multi-user race. Refresh the canonical list immediately instead
      // of leaving this browser showing an obsolete delivery state.
      if ((error as UploadRequestError)?.status === 409) scheduleRefresh();
    } finally {
      queue = [...queue];
      void drainQueue();
    }
  }

  function retry(item: UploadItem) {
    item.status = 'queued';
    item.error = undefined;
    item.progress = 0;
    queue = [...queue];
    void drainQueue();
  }

  async function discard(item: UploadItem) {
    await fetch(`/api/scan/production/upload?upload_id=${encodeURIComponent(item.uploadId)}`, { method: 'DELETE' });
    queue = queue.filter((entry) => entry.id !== item.id);
  }

  function scheduleRefresh() {
    if (refreshScheduled) return;
    refreshScheduled = true;
    queueMicrotask(async () => {
      refreshScheduled = false;
      if (!queue.some((item) => item.status === 'queued' || item.status === 'uploading')) await onFilesChanged();
    });
  }

  async function removeCurrentFile(file: any) {
    if (disabled || isRemoving) return;
    isRemoving = file.id;
    try {
      const response = await fetch(`/api/scan/production/files/${file.id}`, { method: 'DELETE' });
      const body = await response.json();
      if (!response.ok || body?.error) throw new Error(body?.error || 'Não foi possível remover o arquivo.');
      await onFilesChanged();
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Não foi possível remover o arquivo.');
    } finally {
      isRemoving = null;
    }
  }

  function handleDrop(event: DragEvent) {
    event.preventDefault();
    dragging = false;
    if (disabled) return;
    enqueue(Array.from(event.dataTransfer?.files || []));
  }

  function downloadAll() {
    // Keep storage streaming one file at a time. Creating a ZIP in the Worker
    // would fetch every private artifact into memory and make a simple action
    // slower and less reliable for large RAW/Clean deliveries.
    for (const file of sortedCurrentFiles) {
      const anchor = document.createElement('a');
      anchor.href = `/api/scan/production/files/${file.id}?download=1`;
      anchor.download = file.file_name;
      anchor.style.display = 'none';
      document.body.append(anchor);
      anchor.click();
      anchor.remove();
    }
  }
</script>

<section class="deliverable-upload" aria-label="Arquivos da entrega">
  {#if sortedCurrentFiles.length > 0}
    {#if sortedCurrentFiles.length > 1}
      <div class="delivery-actions">
        <button type="button" class="text-action" onclick={downloadAll}>
          <Download size={14} /> Baixar todos
        </button>
      </div>
    {/if}
    <div class="delivery-files-list" aria-label="Arquivos atuais da entrega">
      {#each sortedCurrentFiles as file (file.id)}
        <article class="delivery-file-row">
          <FileText size={17} class="file-icon" aria-hidden="true" />
          <div class="file-copy">
            <strong title={file.file_name}>{file.file_name}</strong>
            <span>v{file.version} · {formatBytes(file.byte_size)}</span>
          </div>
          <div class="file-actions">
            <a href="/api/scan/production/files/{file.id}?download=1" download={file.file_name} class="icon-action" title="Baixar {file.file_name}" aria-label="Baixar {file.file_name}">
              <Download size={15} />
            </a>
            <button type="button" class="text-action" onclick={() => startReplace(file)} disabled={disabled}>
              <RefreshCw size={14} /> <span>Substituir</span>
            </button>
            <button type="button" class="icon-action danger" onclick={() => removeCurrentFile(file)} disabled={disabled || isRemoving === file.id} title="Remover da entrega" aria-label="Remover {file.file_name}">
              <Trash2 size={15} />
            </button>
          </div>
        </article>
      {/each}
    </div>
  {/if}

  <input bind:this={fileInput} class="sr-only" type="file" multiple onchange={handleSelection} disabled={disabled} />
  <input bind:this={replaceInput} class="sr-only" type="file" onchange={(event) => handleSelection(event, replaceTarget)} disabled={disabled} />

  <div
    class:dragging
    class:disabled
    class="delivery-dropzone"
    role="button"
    tabindex={disabled ? -1 : 0}
    onclick={() => !disabled && fileInput?.click()}
    onkeydown={(event) => { if (!disabled && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); fileInput?.click(); } }}
    ondragover={(event) => { event.preventDefault(); if (!disabled) dragging = true; }}
    ondragleave={() => (dragging = false)}
    ondrop={handleDrop}
  >
    <Upload size={21} aria-hidden="true" />
    <div>
      <strong>{sortedCurrentFiles.length ? 'Adicionar arquivos à entrega' : 'Selecionar arquivos finais da etapa'}</strong>
      <span>Selecione ou arraste um ou vários arquivos. Cada item mantém sua própria versão.</span>
    </div>
  </div>

  {#if queue.length > 0}
    <div class="upload-queue" aria-live="polite">
      {#each queue as item (item.id)}
        <div class="upload-row status-{item.status}">
          <FileText size={16} aria-hidden="true" />
          <div class="upload-copy">
            <strong title={item.file.name}>{item.file.name}</strong>
            <span>{formatBytes(item.file.size)} · {item.status === 'success' ? `enviado${item.version ? ` · v${item.version}` : ''}` : item.status === 'error' ? item.error : item.status === 'queued' ? 'na fila' : `${item.progress}%`}</span>
            {#if item.status === 'uploading'}
              <div class="progress-track"><span style="width: {item.progress}%"></span></div>
            {/if}
          </div>
          {#if item.status === 'success'}
            <CheckCircle2 size={18} class="success-icon" aria-label="Enviado" />
          {:else if item.status === 'error'}
            <div class="queue-actions">
              <button type="button" class="text-action" onclick={() => retry(item)}><RefreshCw size={14} /> Tentar novamente</button>
              <button type="button" class="icon-action" onclick={() => discard(item)} title="Descartar falha" aria-label="Descartar {item.file.name}"><X size={15} /></button>
            </div>
          {/if}
        </div>
      {/each}
    </div>
  {/if}
</section>

<style>
  .sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; border: 0; }
  .deliverable-upload { display: grid; gap: .75rem; min-width: 0; }
  .delivery-actions { display: flex; justify-content: flex-end; }
  .delivery-files-list, .upload-queue { display: grid; gap: .5rem; }
  .delivery-file-row, .upload-row { display: flex; align-items: center; gap: .65rem; min-width: 0; padding: .7rem .8rem; border: 1px solid rgba(148, 163, 184, .2); border-radius: .7rem; background: rgba(15, 23, 42, .45); }
  .file-icon { color: #a78bfa; flex: 0 0 auto; }
  .file-copy, .upload-copy { min-width: 0; display: grid; gap: .1rem; flex: 1; }
  .file-copy strong, .upload-copy strong { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: #f8fafc; }
  .file-copy span, .upload-copy span { color: #94a3b8; font-size: .78rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .file-actions, .queue-actions { display: flex; align-items: center; gap: .35rem; flex: 0 0 auto; }
  .icon-action, .text-action { display: inline-flex; align-items: center; justify-content: center; gap: .3rem; min-height: 2rem; border: 1px solid rgba(148, 163, 184, .28); border-radius: .45rem; padding: .35rem .48rem; background: rgba(30, 41, 59, .7); color: #cbd5e1; cursor: pointer; text-decoration: none; font: inherit; font-size: .78rem; }
  .icon-action:hover, .text-action:hover { border-color: rgba(167, 139, 250, .75); color: #fff; }
  .icon-action.danger:hover { color: #fecaca; border-color: rgba(248, 113, 113, .7); }
  button:disabled { opacity: .55; cursor: not-allowed; }
  .delivery-dropzone { display: flex; align-items: center; gap: .75rem; padding: .9rem; border: 1px dashed rgba(167, 139, 250, .5); border-radius: .75rem; background: rgba(124, 58, 237, .07); color: #c4b5fd; cursor: pointer; min-height: 4.6rem; }
  .delivery-dropzone:hover, .delivery-dropzone.dragging { border-color: #a78bfa; background: rgba(124, 58, 237, .14); }
  .delivery-dropzone.disabled { cursor: not-allowed; opacity: .55; }
  .delivery-dropzone div { display: grid; gap: .16rem; min-width: 0; }
  .delivery-dropzone strong { color: #f5f3ff; }
  .delivery-dropzone span { color: #c4b5fd; font-size: .8rem; }
  .progress-track { height: .25rem; overflow: hidden; border-radius: 99px; background: rgba(148, 163, 184, .25); margin-top: .2rem; }
  .progress-track span { display: block; height: 100%; background: linear-gradient(90deg, #8b5cf6, #22d3ee); transition: width .15s linear; }
  .status-error { border-color: rgba(248, 113, 113, .45); }
  .success-icon { color: #34d399; flex: 0 0 auto; }
  @media (max-width: 520px) {
    .delivery-file-row, .upload-row { align-items: flex-start; flex-wrap: wrap; }
    .file-actions, .queue-actions { width: 100%; padding-left: 1.55rem; }
    .text-action { min-height: 2.5rem; }
    .delivery-dropzone { align-items: flex-start; }
  }
</style>
