<script lang="ts">
  import { untrack } from 'svelte';
  import { beforeNavigate, goto, invalidateAll } from '$app/navigation';
  import { action } from '$lib/actions';
  import { expandFiles, normalizePage } from '$lib/uploads';
  import { flushUploads, UploadRateLimitError } from '$lib/upload-queue';
  import DeleteContent from '$lib/components/DeleteContent.svelte';
  import {
    ArrowLeft,
    Save,
    Send,
    Eye,
    UploadCloud,
    CheckCircle2,
    AlertCircle,
    Loader2,
    Trash2,
    Layers,
    FileText,
    Clock,
    Shield,
    Users
  } from '@lucide/svelte';

  let { data } = $props();
  const initial = untrack(() => data);
  let pages = $state(initial.pages.map((p) => ({ id: p.media_id, name: `Página ${p.position}` }))),
    number = $state(initial.chapter?.number ?? 1),
    title = $state(initial.chapter?.title || ''),
    notice = $state(''),
    busy = $state(false),
    progress = $state(0),
    confirmed = $state(false);
  let selectedScanIds = $state<string[]>((initial.chapterScans || []).map((cs: any) => cs.scan_id));
  let finals = $state<{ id: string; number: string; title: string | null }[]>([]);
  let sourceChapter = $state('');
  let loadingFinals = $state(false), finalsChecked = $state(false);
  let pendingUploads = $state<File[]>([]),
    pauseRequested = $state(false),
    uploading = $state(false);
  let uploadSpeedMBs = $state(0),
    inCooldown = $state(false),
    cooldownSeconds = $state(0);
  let batchTotal = $state(0),
    savedNavigation = false;
  let savedVersion = $state(
    JSON.stringify({
      number: initial.chapter?.number ?? 1,
      title: initial.chapter?.title || '',
      pages: initial.pages.map((p) => p.media_id)
    })
  );
  let dirty = $derived(JSON.stringify({ number, title, pages: pages.map((p) => p.id) }) !== savedVersion);
  beforeNavigate(({ cancel, willUnload }) => {
    if (savedNavigation || (!dirty && !pendingUploads.length && !uploading)) return;
    if (willUnload || !window.confirm('Há páginas pendentes ou alterações não salvas. Sair desta página?'))
      cancel();
  });
  async function loadFinals() {
    loadingFinals = true;
    try {
      const response = await fetch(`/api/staff?work=${data.work.id}`);
      if (!response.ok) throw new Error('Consulta indisponível');
      finals = (await response.json()).chapters;
      finalsChecked = true;
      if (!finals.length) notice = 'Nenhum capítulo final disponível para importação. O upload local continua disponível.';
    } catch {
      notice = 'A central está indisponível no momento. Você ainda pode selecionar arquivos locais.';
    } finally {
      loadingFinals = false;
    }
  }
  async function importFinal() {
    if (!sourceChapter || busy || pendingUploads.length) return;
    busy = true;
    try {
      const response = await fetch(`/api/staff?chapter=${sourceChapter}`);
      const result = await response.json();
      if (!response.ok) throw new Error(result.message);
      notice = 'Baixando somente o arquivo final aprovado…';
      const download = await fetch(result.url);
      if (!download.ok) throw new Error('Não foi possível baixar o arquivo final.');
      const file = new File([await download.blob()], result.name);
      number = Number(result.number);
      title = result.title || '';
      await uploadFiles([file]);
    } catch (e) {
      notice = (e as Error).message;
    } finally {
      busy = false;
    }
  }
  async function upload(event: Event) {
    const element = event.currentTarget as HTMLInputElement;
    const input = element.files;
    if (!input) return;
    const selected = Array.from(input);
    element.value = '';
    await uploadFiles(selected);
  }
  async function uploadFiles(input: File[]) {
    if (pendingUploads.length) return;
    busy = true;
    notice = 'Processando arquivos…';
    progress = 0;
    try {
      const files = await expandFiles(input);
      if (pages.length + files.length > 500) throw new Error('Limite de 500 páginas por capítulo.');
      pendingUploads = files;
      batchTotal = files.length;
      await resumeUploads();
    } catch (e) {
      notice = (e as Error).message;
    } finally {
      busy = false;
    }
  }
  async function resumeUploads() {
    if (uploading || !pendingUploads.length) return;
    busy = uploading = true;
    pauseRequested = false;
    confirmed = false;
    try {
      await flushUploads(
        pendingUploads,
        async (file) => {
          notice = `Enviando página ${batchTotal - pendingUploads.length + 1} de ${batchTotal}: ${file.name}`;
          const image = await normalizePage(file);
          const response = await fetch('/api/upload', {
            method: 'POST',
            headers: { 'Content-Type': image.type },
            body: image
          });
          if (response.status === 429) {
            const body = await response.json().catch(() => ({}));
            const retryAfter = Number(response.headers.get('Retry-After') || body.retryAfter) || 15;
            throw new UploadRateLimitError(retryAfter, body.error || 'Rate limit temporário');
          }
          const result = await response.json();
          if (!response.ok) throw new Error(result.message);
          return result;
        },
        (result, file) => {
          pages.push({ id: result.id, name: file.name });
          progress = Math.round(((batchTotal - pendingUploads.length) / batchTotal) * 100);
        },
        () => pauseRequested,
        {
          maxRetries: 6,
          concurrency: 2,
          basePaceMs: 250,
          onRetry: (_file, attempt, waitSeconds) => {
            inCooldown = true;
            cooldownSeconds = waitSeconds;
            notice = `Aguardando ${waitSeconds}s antes de tentar novamente (tentativa ${attempt})…`;
          },
          onProgress: (stats) => {
            uploadSpeedMBs = stats.speedMBs;
            inCooldown = stats.inCooldown;
            if (stats.cooldownSecondsRemaining !== undefined) {
              cooldownSeconds = stats.cooldownSecondsRemaining;
            }
          }
        }
      );
      notice = pendingUploads.length
        ? 'Envio pausado. As páginas já enviadas foram preservadas.'
        : 'Páginas enviadas. Confira a ordem e salve o rascunho.';
    } catch (e) {
      notice = `${(e as Error).message} As páginas já enviadas foram preservadas. Tente novamente para continuar.`;
    } finally {
      busy = uploading = false;
    }
  }
  function move(index: number, delta: number) {
    const copy = [...pages];
    [copy[index], copy[index + delta]] = [copy[index + delta], copy[index]];
    pages = copy;
  }
  let actionState = $state<'idle' | 'saving' | 'saved' | 'publishing' | 'published' | 'unpublishing' | 'error'>('idle');

  async function save() {
    busy = true;
    actionState = 'saving';
    notice = '';
    try {
      const result = await action('editor', 'chapter', {
        id: data.chapter?.id,
        work_id: data.work.id,
        number,
        title,
        pages: pages.map((p) => p.id),
        scans: selectedScanIds
      });
      savedVersion = JSON.stringify({ number, title, pages: pages.map((p) => p.id) });
      confirmed = false;
      if (!data.chapter) {
        savedNavigation = true;
        try {
          await goto(`/admin/obras/${data.work.id}/capitulos/${result.id}`);
        } finally {
          savedNavigation = false;
        }
      } else {
        notice = 'Rascunho salvo.';
        actionState = 'saved';
        await invalidateAll();
        setTimeout(() => {
          if (actionState === 'saved') actionState = 'idle';
        }, 3500);
      }
    } catch (e) {
      notice = (e as Error).message;
      actionState = 'error';
    } finally {
      busy = false;
    }
  }
  async function publish(unpublish = false) {
    if (!unpublish && (dirty || pendingUploads.length)) {
      notice = 'Salve as alterações e confira a prévia antes de publicar.';
      return;
    }
    busy = true;
    actionState = unpublish ? 'unpublishing' : 'publishing';
    notice = '';
    try {
      await action('editor', unpublish ? 'unpublish' : 'publish', {
        id: data.chapter?.id,
        confirmed_final: confirmed
      });
      notice = unpublish
        ? 'Capítulo despublicado. Você já pode corrigir as páginas.'
        : 'Publicado! O capítulo já está disponível no site.';
      actionState = unpublish ? 'idle' : 'published';
      await invalidateAll();
      setTimeout(() => {
        if (actionState === 'published') actionState = 'idle';
      }, 4000);
    } catch (e) {
      notice = (e as Error).message;
      actionState = 'error';
    } finally {
      busy = false;
    }
  }
</script>

<svelte:head>
  <title>Capítulo {number} — {data.work.title} — Nox Editorial</title>
</svelte:head>

<div class="chapter-editor-view">
  <!-- Top Breadcrumb & Status Bar -->
  <header class="editor-header">
    <div class="breadcrumb">
      <a href="/admin/obras/{data.work.id}">{data.work.title}</a>
      <span>/</span>
      <span>{data.chapter ? `Capítulo ${number}` : 'Adicionar capítulo'}</span>
    </div>

    <div class="header-title-bar">
      <div class="title-group">
        <h1 style="font-size:32px">Uma página de cada vez.</h1>
        <p class="small">1. Dados do capítulo → 2. Enviar páginas → 3. Conferir → 4. Publicar</p>
      </div>

      <div class="status-badge-area">
        {#if actionState === 'saving'}
          <span class="action-pill saving"><Loader2 size={13} class="spin" /> Salvando rascunho…</span>
        {:else if actionState === 'saved'}
          <span class="action-pill saved"><CheckCircle2 size={13} /> Rascunho salvo</span>
        {:else if actionState === 'publishing'}
          <span class="action-pill publishing"><Loader2 size={13} class="spin" /> Publicando no site…</span>
        {:else if actionState === 'published'}
          <span class="action-pill published"><CheckCircle2 size={13} /> Publicado no ar</span>
        {:else if actionState === 'unpublishing'}
          <span class="action-pill saving"><Loader2 size={13} class="spin" /> Despublicando…</span>
        {:else if actionState === 'error'}
          <span class="action-pill error"><AlertCircle size={13} /> Erro na operação</span>
        {:else if data.chapter?.published_at}
          <span class="action-pill live"><span class="dot-live"></span> Publicado</span>
        {:else if data.chapter}
          <span class="action-pill draft"><span class="dot-draft"></span> Rascunho</span>
        {:else}
          <span class="action-pill draft"><span class="dot-draft"></span> Novo Capítulo</span>
        {/if}
      </div>
    </div>
  </header>

  {#if notice}
    <div class="notice" role="status">{notice}</div>
  {/if}

  <!-- Main Workspace -->
  <div class="editor-grid">
    <!-- Chapter Metadata Card -->
    <section class="panel form-panel">
      <div class="panel-header">
        <FileText size={18} class="panel-icon" />
        <h2>Dados do Capítulo</h2>
      </div>

      {#if !data.chapter?.published_at && !finalsChecked}
        <details class="staff-import-accordion">
          <summary>Importação opcional da central</summary>
          <div class="staff-import-body">
            <p class="small muted">
              Para arquivos deste computador, use o upload abaixo. A central só será consultada se você solicitar.
            </p>
            <button class="button secondary compact" onclick={loadFinals} disabled={busy || loadingFinals}>
              {#if loadingFinals}
                <Loader2 size={14} class="spin" />
                <span>Consultando…</span>
              {:else}
                <span>Consultar capítulos finais da central</span>
              {/if}
            </button>
          </div>
        </details>
      {/if}

      {#if finals.length && !data.chapter?.published_at}
        <div class="finals-picker-card">
          <div class="finals-picker-info">
            <strong>Capítulos aprovados na central</strong>
            <p class="small muted">Importe o arquivo final e confira as páginas antes de publicar.</p>
          </div>
          <div class="finals-picker-controls">
            <select class="control" bind:value={sourceChapter} aria-label="Capítulo final da central">
              <option value="">Selecionar capítulo</option>
              {#each finals as final (final.id)}
                <option value={final.id}>Capítulo {final.number}{final.title ? ` — ${final.title}` : ''}</option>
              {/each}
            </select>
            <button
              class="button secondary"
              onclick={importFinal}
              disabled={busy || !!pendingUploads.length || !sourceChapter}
            >
              Importar páginas finais
            </button>
          </div>
        </div>
      {/if}

      <div class="form-grid">
        <label class="field">
          Número do capítulo
          <input
            type="number"
            min="0"
            max="999999"
            step="0.01"
            bind:value={number}
            disabled={!!data.chapter?.published_at}
            required
          />
        </label>

        <label class="field">
          Título opcional
          <input
            type="text"
            bind:value={title}
            maxlength="200"
            disabled={!!data.chapter?.published_at}
          />
        </label>

        <!-- Scan Attribution Selector -->
        <div class="field col-full">
          <span class="field-label">Scans / Tradução deste Capítulo</span>
          <div class="chapter-scans-chips">
            {#each data.allScans as scan (scan.id)}
              <label class="scan-chip-label" class:active={selectedScanIds.includes(scan.id)} class:is-official={scan.is_official}>
                <input
                  type="checkbox"
                  bind:group={selectedScanIds}
                  value={scan.id}
                  class="scan-checkbox"
                  disabled={!!data.chapter?.published_at}
                />
                {#if scan.is_official}
                  <Shield size={13} class="icon-gold" />
                {/if}
                <span>{scan.name}</span>
                {#if scan.is_official}
                  <span class="badge-official-mini">OFICIAL</span>
                {/if}
              </label>
            {/each}
          </div>
          <small class="small muted">
            {#if !selectedScanIds.length}
              Nenhuma scan selecionada (o capítulo não exibirá nome de scan falso).
            {:else}
              Scan(s) vinculada(s): {data.allScans.filter((s: any) => selectedScanIds.includes(s.id)).map((s: any) => s.name).join(' × ')}
            {/if}
          </small>
        </div>
      </div>

      {#if !data.chapter?.published_at}
        <div class="upload-section">
          <label class="upload-zone">
            <span aria-hidden="true">+</span>
            <strong>Selecione imagens ou um arquivo ZIP</strong>
            <small>Ordenação automática por nome. Você pode ajustar antes de publicar.</small>
            <span class="file-choice">Escolher arquivos</span>
            <input
              type="file"
              aria-label="Selecionar imagens ou ZIP"
              multiple
              accept=".zip,image/png,image/jpeg,image/webp"
              onchange={upload}
              disabled={busy || !!pendingUploads.length}
            />
          </label>
        </div>
      {/if}

      {#if uploading}
        <div class="upload-live-metrics-card">
          <div class="metrics-header-row">
            <span class="metrics-title">
              Enviando página <strong>{pages.length + 1}</strong> de <strong>{batchTotal}</strong>
            </span>
            <div class="metrics-chips">
              {#if uploadSpeedMBs > 0}
                <span class="metric-chip speed">{uploadSpeedMBs} MB/s</span>
              {/if}
              <span class="metric-chip percent">{progress}%</span>
            </div>
          </div>

          <div class="progress" style="margin:8px 0">
            <span style="width:{progress}%"></span>
          </div>

          {#if inCooldown && cooldownSeconds > 0}
            <div class="cooldown-alert">
              <Clock size={13} class="spin" />
              <span>Rate limit temporário. Cooldown: <strong>{cooldownSeconds}s</strong> · Retomada gradual automática.</span>
            </div>
          {/if}
        </div>
      {:else if busy && progress > 0}
        <div class="progress" style="margin:20px 0">
          <span style="width:{progress}%"></span>
        </div>
      {/if}

      {#if pendingUploads.length}
        <div class="row" style="margin-top:16px">
          <span class="small">{pendingUploads.length} páginas pendentes</span>
          {#if uploading}
            <button
              class="button secondary compact"
              disabled={pauseRequested}
              onclick={() => (pauseRequested = true)}
            >
              {pauseRequested ? 'Pausando após esta página…' : 'Pausar envio'}
            </button>
          {:else}
            <button class="button secondary compact" onclick={resumeUploads} disabled={busy}>
              Continuar envio
            </button>
            <button
              class="button secondary compact"
              disabled={busy}
              onclick={() => {
                if (
                  window.confirm(
                    'Descartar as páginas ainda não enviadas? As páginas recebidas serão preservadas.'
                  )
                ) {
                  pendingUploads = [];
                  notice = 'Pendências descartadas. Confira as páginas recebidas antes de salvar.';
                }
              }}
            >
              Descartar pendentes
            </button>
          {/if}
        </div>
      {/if}
    </section>

    <!-- Pages Gallery Card -->
    <section class="panel pages-panel">
      <div class="row between" style="margin:0 0 20px">
        <div class="title-with-icon">
          <Layers size={18} class="panel-icon" />
          <h3 style="margin:0">{pages.length} páginas</h3>
        </div>
        <span class="small muted">Ordem de leitura: esquerda para direita</span>
      </div>

      {#if pages.length === 0}
        <div class="empty-pages-state">
          <Layers size={40} class="empty-icon" />
          <h3>Nenhuma página carregada</h3>
          <p class="small muted">Envie imagens ou um arquivo ZIP acima para montar o capítulo.</p>
        </div>
      {:else}
        <div class="page-grid">
          {#each pages as page, index (page.id)}
            <div class="page-tile">
              <img
                src="/media/{page.id}"
                alt="Página {index + 1}: {page.name}"
                loading="lazy"
                width="160"
                height="220"
              />
              <div>
                <strong>{index + 1}</strong>
                <span>{page.name}</span>
              </div>
              {#if !data.chapter?.published_at}
                <div class="page-controls">
                  <button
                    aria-label="Mover página {index + 1} para antes"
                    disabled={index === 0 || busy}
                    onclick={() => move(index, -1)}
                  >
                    ←
                  </button>
                  <button
                    aria-label="Mover página {index + 1} para depois"
                    disabled={index === pages.length - 1 || busy}
                    onclick={() => move(index, 1)}
                  >
                    →
                  </button>
                  <button
                    aria-label="Remover página {index + 1}"
                    disabled={busy}
                    onclick={() => (pages = pages.filter((_, i) => i !== index))}
                  >
                    Remover
                  </button>
                </div>
              {/if}
            </div>
          {/each}
        </div>
      {/if}

      <!-- Bottom Actions for Draft/Preview -->
      <div class="row" style="margin-top:30px">
        {#if !data.chapter?.published_at}
          <button
            class="button"
            onclick={save}
            disabled={busy || !!pendingUploads.length || !pages.length}
          >
            {#if actionState === 'saving'}
              <Loader2 size={15} class="spin" />
              <span>Salvando…</span>
            {:else}
              Salvar rascunho
            {/if}
          </button>
        {/if}

        {#if data.chapter}
          <a
            class="button secondary"
            href="/ler/{data.chapter.id}?preview=1"
            target="_blank"
            rel="noreferrer"
          >
            Visualizar capítulo ↗
          </a>
        {/if}
      </div>
    </section>

    <!-- Publication Control Panel -->
    {#if data.chapter}
      <section class="panel publication-panel">
        <h2 style="font-size:23px">{data.chapter.published_at ? 'Capítulo publicado' : 'Tudo conferido?'}</h2>

        {#if data.chapter.published_at}
          <p class="small">
            Despublique antes de fazer correções. As páginas deixam de ser acessíveis publicamente.
          </p>
          <button
            class="button secondary"
            onclick={() => publish(true)}
            disabled={busy}
          >
            {#if actionState === 'unpublishing'}
              <Loader2 size={15} class="spin" />
              <span>Despublicando…</span>
            {:else}
              Despublicar para corrigir
            {/if}
          </button>
        {:else}
          <p class="small">
            {dirty
              ? 'Há alterações não salvas. Salve o rascunho antes de conferir e publicar.'
              : 'Abra a prévia e confira todas as páginas antes de publicar.'}
          </p>

          <label class="small row" style="margin:20px 0">
            <input type="checkbox" bind:checked={confirmed} />
            Confirmo que são páginas finais, revisadas e autorizadas para publicação.
          </label>

          <button
            class="button"
            onclick={() => publish()}
            disabled={busy || !!pendingUploads.length || !confirmed || dirty}
          >
            {#if actionState === 'publishing'}
              <Loader2 size={15} class="spin" />
              <span>Publicando…</span>
            {:else}
              Publicar capítulo
            {/if}
          </button>
        {/if}
      </section>
    {/if}

    <!-- ADMIN Zone: Delete Chapter -->
    {#if data.role === 'ADMIN' && data.chapter}
      <DeleteContent
        id={data.chapter.id}
        label={`Capítulo ${data.chapter.number}`}
        kind="chapter"
        destination={`/admin/obras/${data.work.id}`}
      />
    {/if}
  </div>
</div>

<style>
  .chapter-editor-view {
    display: flex;
    flex-direction: column;
    gap: 24px;
  }

  .editor-header {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .breadcrumb {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 13px;
    color: var(--muted);
  }

  .breadcrumb a {
    color: var(--muted);
    text-decoration: none;
    transition: color 0.15s ease;
  }

  .breadcrumb a:hover {
    color: var(--fg);
  }

  .header-title-bar {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 16px;
    flex-wrap: wrap;
  }

  .title-group h1 {
    font-size: 28px;
    font-weight: 700;
    margin: 0 0 4px;
    color: #f8fafc;
    letter-spacing: -0.02em;
  }

  .status-badge-area {
    display: flex;
    align-items: center;
  }

  .action-pill {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    padding: 6px 14px;
    border-radius: 999px;
    font-size: 12px;
    font-weight: 600;
    letter-spacing: 0.02em;
  }

  .action-pill.saving {
    background: rgba(245, 158, 11, 0.15);
    color: #f59e0b;
    border: 1px solid rgba(245, 158, 11, 0.3);
  }

  .action-pill.saved {
    background: rgba(16, 185, 129, 0.15);
    color: #10b981;
    border: 1px solid rgba(16, 185, 129, 0.3);
  }

  .action-pill.publishing {
    background: rgba(168, 85, 247, 0.18);
    color: #c084fc;
    border: 1px solid rgba(168, 85, 247, 0.35);
  }

  .action-pill.published {
    background: rgba(16, 185, 129, 0.18);
    color: #34d399;
    border: 1px solid rgba(16, 185, 129, 0.35);
  }

  .action-pill.error {
    background: rgba(239, 68, 68, 0.15);
    color: #f87171;
    border: 1px solid rgba(239, 68, 68, 0.3);
  }

  .action-pill.live {
    background: rgba(16, 185, 129, 0.1);
    color: #34d399;
    border: 1px solid rgba(16, 185, 129, 0.25);
  }

  .action-pill.draft {
    background: rgba(148, 163, 184, 0.1);
    color: #94a3b8;
    border: 1px solid rgba(148, 163, 184, 0.2);
  }

  .dot-live {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: #10b981;
    box-shadow: 0 0 6px rgba(16, 185, 129, 0.7);
  }

  .dot-draft {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: #94a3b8;
  }

  :global(.spin) {
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

  .editor-grid {
    display: flex;
    flex-direction: column;
    gap: 24px;
  }

  .panel {
    background: #110d1a;
    border: 1px solid #231b31;
    border-radius: 14px;
    padding: 24px;
  }

  .panel-header {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 20px;
  }

  .title-with-icon {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  :global(.panel-icon) {
    color: var(--purple, #a78bfa);
  }

  .panel-header h2 {
    font-size: 18px;
    font-weight: 600;
    color: #f1f5f9;
    margin: 0;
  }

  /* Staff accordion */
  .staff-import-accordion {
    margin-bottom: 20px;
    background: #181224;
    border: 1px solid #2d213f;
    border-radius: 10px;
    overflow: hidden;
  }

  .staff-import-accordion summary {
    padding: 12px 16px;
    font-size: 13px;
    font-weight: 500;
    color: #c4b5fd;
    cursor: pointer;
    user-select: none;
  }

  .staff-import-body {
    padding: 14px 16px 18px;
    border-top: 1px solid #2d213f;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .finals-picker-card {
    background: #181224;
    border: 1px solid #3d2b56;
    border-radius: 10px;
    padding: 16px;
    margin-bottom: 20px;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .finals-picker-controls {
    display: flex;
    gap: 12px;
    flex-wrap: wrap;
  }

  .form-grid {
    display: grid;
    grid-template-columns: 1fr 2fr;
    gap: 18px;
    margin-bottom: 20px;
  }

  @media (max-width: 680px) {
    .form-grid {
      grid-template-columns: 1fr;
    }
  }

  .field {
    display: flex;
    flex-direction: column;
    gap: 8px;
    font-size: 12px;
    font-weight: 600;
    color: #cbd5e1;
  }

  .field input {
    background: #090610;
    border: 1px solid #2a2039;
    color: #f1f5f9;
    padding: 10px 14px;
    border-radius: 8px;
    font-size: 14px;
    transition: border-color 0.15s ease;
  }

  .field input:focus {
    outline: none;
    border-color: #9333ea;
  }

  .field input:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .col-full {
    grid-column: 1 / -1;
  }

  .field-label {
    font-size: 12px;
    font-weight: 700;
    color: #dfc28d;
  }

  .chapter-scans-chips {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-top: 4px;
  }

  .scan-chip-label {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    padding: 6px 12px;
    border-radius: 8px;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.08);
    font-size: 12px;
    color: #cbd5e1;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .scan-chip-label:hover {
    background: rgba(255, 255, 255, 0.08);
    color: #ffffff;
  }

  .scan-chip-label.active {
    background: rgba(139, 92, 246, 0.2);
    border-color: rgba(139, 92, 246, 0.5);
    color: #ffffff;
    font-weight: 600;
  }

  .scan-chip-label.is-official {
    border-color: rgba(201, 170, 115, 0.35);
  }

  .scan-chip-label.is-official.active {
    background: rgba(201, 170, 115, 0.2);
    border-color: rgba(201, 170, 115, 0.6);
    color: #fef08a;
  }

  .scan-checkbox {
    accent-color: #8b5cf6;
    cursor: pointer;
  }

  :global(.icon-gold) {
    color: #dfc28d;
  }

  .badge-official-mini {
    font-size: 8.5px;
    font-weight: 800;
    padding: 1px 4px;
    border-radius: 3px;
    background: rgba(201, 170, 115, 0.2);
    color: #dfc28d;
    border: 1px solid rgba(201, 170, 115, 0.4);
    letter-spacing: 0.06em;
  }

  /* Upload dropzone */
  .upload-zone {
    position: relative;
    border: 1px dashed #70518d;
    border-radius: 12px;
    padding: 35px 20px;
    display: flex;
    align-items: center;
    flex-direction: column;
    gap: 12px;
    background: #1b1424;
    cursor: pointer;
    text-align: center;
    transition: all 0.2s ease;
  }

  .upload-zone:hover {
    border-color: #a855f7;
    background: #20172b;
  }

  .upload-zone > span {
    font-size: 30px;
    color: var(--purple);
  }

  .upload-zone strong {
    font-size: 14px;
    color: #f1f5f9;
  }

  .upload-zone small {
    font-size: 11px;
    color: var(--muted);
  }

  .upload-zone input {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    opacity: 0;
    cursor: pointer;
  }

  .upload-zone:focus-within {
    outline: 2px solid var(--purple);
    outline-offset: 4px;
  }

  .upload-zone:has(input:disabled) {
    opacity: 0.55;
  }

  .upload-zone .file-choice {
    font-size: 12px;
    font-weight: 650;
    padding: 9px 16px;
    border-radius: 8px;
    background: #352643;
    border: 1px solid #684781;
    color: #e9d5ff;
  }

  /* Progress */
  .progress {
    height: 8px;
    background: #20172e;
    border-radius: 999px;
    position: relative;
    overflow: hidden;
  }

  .progress > span {
    display: block;
    height: 100%;
    background: linear-gradient(90deg, #9333ea, #c084fc);
    transition: width 0.2s ease;
  }

  /* Pages gallery */
  .empty-pages-state {
    padding: 48px 24px;
    text-align: center;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10px;
  }

  :global(.empty-icon) {
    color: #3b2a52;
  }

  .empty-pages-state h3 {
    margin: 0;
    font-size: 16px;
    color: #cbd5e1;
  }

  .page-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(130px, 1fr));
    gap: 16px;
  }

  .page-tile {
    background: #0e0c14;
    border: 1px solid #302538;
    border-radius: 8px;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    transition: border-color 0.15s ease;
  }

  .page-tile:hover {
    border-color: #553e68;
  }

  .page-tile > img {
    width: 100%;
    height: 180px;
    object-fit: contain;
    background: #18131e;
  }

  .page-tile > div {
    padding: 9px;
    display: flex;
    gap: 8px;
    align-items: center;
  }

  .page-tile strong {
    color: var(--gold);
    font-size: 12px;
  }

  .page-tile span {
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
    font-size: 9px;
    color: var(--muted);
  }

  .page-controls {
    display: flex;
    align-items: center;
    gap: 4px;
    border-top: 1px solid #1f1826;
    background: #0a080f;
  }

  .page-controls button {
    background: #27202e;
    border: 0;
    padding: 6px;
    font-size: 10px;
    border-radius: 4px;
    color: #cbd5e1;
    cursor: pointer;
    transition: background 0.15s ease;
  }

  .page-controls button:hover:not(:disabled) {
    background: #3c2a4f;
    color: #ffffff;
  }

  .page-controls button:last-child {
    margin-left: auto;
  }

  .upload-live-metrics-card {
    background: rgba(223, 194, 141, 0.04);
    border: 1px solid rgba(223, 194, 141, 0.2);
    border-radius: 10px;
    padding: 14px 16px;
    margin: 18px 0;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .metrics-header-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 13px;
    flex-wrap: wrap;
    gap: 8px;
  }

  .metrics-title {
    color: #e2e8f0;
  }

  .metrics-title strong {
    color: #dfc28d;
  }

  .metrics-chips {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .metric-chip {
    font-size: 11px;
    font-weight: 700;
    padding: 2px 8px;
    border-radius: 6px;
    font-variant-numeric: tabular-nums;
  }

  .metric-chip.speed {
    background: rgba(16, 185, 129, 0.15);
    color: #34d399;
    border: 1px solid rgba(16, 185, 129, 0.3);
  }

  .metric-chip.percent {
    background: rgba(223, 194, 141, 0.15);
    color: #dfc28d;
    border: 1px solid rgba(223, 194, 141, 0.3);
  }

  .cooldown-alert {
    display: flex;
    align-items: center;
    gap: 8px;
    background: rgba(245, 158, 11, 0.12);
    border: 1px solid rgba(245, 158, 11, 0.3);
    color: #fbbf24;
    padding: 6px 12px;
    border-radius: 6px;
    font-size: 11.5px;
    margin-top: 4px;
  }
</style>
