<script lang="ts">
  import { untrack } from 'svelte';
  import { goto, invalidateAll } from '$app/navigation';
  import { action } from '$lib/actions';
  import { expandFiles, normalizePage } from '$lib/uploads';
  import { onMount } from 'svelte';
  import DeleteContent from '$lib/components/DeleteContent.svelte';
  let { data } = $props();
  const initial = untrack(() => data);
  let pages = $state(initial.pages.map((p) => ({ id: p.media_id, name: `Página ${p.position}` }))),
    number = $state(initial.chapter?.number ?? 1),
    title = $state(initial.chapter?.title || ''),
    notice = $state(''),
    busy = $state(false),
    progress = $state(0),
    confirmed = $state(false);
  let finals = $state<{ id: string; number: string; title: string | null }[]>([]);
  let sourceChapter = $state('');
  let savedVersion = $state(
    JSON.stringify({
      number: initial.chapter?.number ?? 1,
      title: initial.chapter?.title || '',
      pages: initial.pages.map((p) => p.media_id)
    })
  );
  let dirty = $derived(JSON.stringify({ number, title, pages: pages.map((p) => p.id) }) !== savedVersion);
  onMount(async () => {
    const response = await fetch(`/api/staff?work=${data.work.id}`);
    if (response.ok) finals = (await response.json()).chapters;
  });
  async function importFinal() {
    if (!sourceChapter) return;
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
    const input = (event.currentTarget as HTMLInputElement).files;
    if (!input) return;
    await uploadFiles(Array.from(input));
  }
  async function uploadFiles(input: File[]) {
    busy = true;
    notice = 'Processando arquivos…';
    progress = 0;
    try {
      const files = await expandFiles(input);
      if (pages.length + files.length > 500) throw new Error('Limite de 500 páginas por capítulo.');
      for (let i = 0; i < files.length; i++) {
        notice = `Enviando página ${i + 1} de ${files.length}: ${files[i].name}`;
        const image = await normalizePage(files[i]);
        const response = await fetch('/api/upload', {
          method: 'POST',
          headers: { 'Content-Type': image.type },
          body: image
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.message);
        pages.push({ id: result.id, name: files[i].name });
        progress = Math.round(((i + 1) / files.length) * 100);
      }
      notice = 'Páginas enviadas. Confira a ordem e salve o rascunho.';
    } catch (e) {
      notice = (e as Error).message;
    } finally {
      busy = false;
    }
  }
  function move(index: number, delta: number) {
    const copy = [...pages];
    [copy[index], copy[index + delta]] = [copy[index + delta], copy[index]];
    pages = copy;
  }
  async function save() {
    busy = true;
    notice = '';
    try {
      const result = await action('editor', 'chapter', {
        id: data.chapter?.id,
        work_id: data.work.id,
        number,
        title,
        pages: pages.map((p) => p.id)
      });
      if (!data.chapter) goto(`/admin/obras/${data.work.id}/capitulos/${result.id}`);
      else {
        savedVersion = JSON.stringify({ number, title, pages: pages.map((p) => p.id) });
        confirmed = false;
        notice = 'Rascunho salvo.';
        await invalidateAll();
      }
    } catch (e) {
      notice = (e as Error).message;
    } finally {
      busy = false;
    }
  }
  async function publish(unpublish = false) {
    if (!unpublish && dirty) {
      notice = 'Salve as alterações e confira a prévia antes de publicar.';
      return;
    }
    busy = true;
    notice = '';
    try {
      await action('editor', unpublish ? 'unpublish' : 'publish', {
        id: data.chapter?.id,
        confirmed_final: confirmed
      });
      notice = unpublish
        ? 'Capítulo despublicado. Você já pode corrigir as páginas.'
        : 'Publicado! O capítulo já está disponível no site.';
      await invalidateAll();
    } catch (e) {
      notice = (e as Error).message;
    } finally {
      busy = false;
    }
  }
</script>

<svelte:head><title>Capítulo {number} — Nox Editorial</title></svelte:head>
<div class="breadcrumb">
  <a href="/admin/obras/{data.work.id}">{data.work.title}</a><span>/</span><span
    >{data.chapter ? 'Editar capítulo' : 'Adicionar capítulo'}</span
  >
</div>
<h1 style="font-size:32px">Uma página de cada vez.</h1>
<p class="small">1. Dados do capítulo → 2. Enviar páginas → 3. Conferir → 4. Publicar</p>
{#if notice}<div class="notice" role="status">{notice}</div>{/if}
<section class="panel">
  {#if finals.length && !data.chapter?.published_at}
    <div class="panel" style="margin-bottom:24px">
      <h3>Capítulos aprovados na central</h3>
      <p class="small">Importe o arquivo final e confira as páginas antes de publicar.</p>
      <div class="row">
        <select
          class="control"
          style="width:auto"
          bind:value={sourceChapter}
          aria-label="Capítulo final da central"
          ><option value="">Selecionar capítulo</option>{#each finals as final (final.id)}<option
              value={final.id}>Capítulo {final.number}</option
            >{/each}</select
        ><button class="button secondary" onclick={importFinal} disabled={busy || !sourceChapter}
          >Importar páginas finais</button
        >
      </div>
    </div>
  {/if}
  <div class="form-grid">
    <label class="field"
      >Número do capítulo<input
        type="number"
        min="0"
        max="999999"
        step="0.01"
        bind:value={number}
        disabled={!!data.chapter?.published_at}
      /></label
    ><label class="field"
      >Título opcional<input
        bind:value={title}
        maxlength="200"
        disabled={!!data.chapter?.published_at}
      /></label
    >
  </div>
  {#if !data.chapter?.published_at}<label class="upload-zone"
      ><span>+</span><strong>Selecione imagens ou um arquivo ZIP</strong><small
        >Ordenação automática por nome. Você pode ajustar antes de publicar.</small
      ><input
        type="file"
        multiple
        accept=".zip,image/png,image/jpeg,image/webp"
        onchange={upload}
        disabled={busy}
      /></label
    >{/if}
  {#if busy && progress > 0}<div class="progress" style="margin:20px 0">
      <span style="width:{progress}%"></span>
    </div>{/if}
  <div class="row between" style="margin:25px 0">
    <h3>{pages.length} páginas</h3>
    <span class="small muted">Ordem de leitura: esquerda para direita</span>
  </div>
  <div class="page-grid">
    {#each pages as page, index (page.id)}<div class="page-tile">
        <img
          src="/media/{page.id}"
          alt="Página {index + 1}: {page.name}"
          loading="lazy"
          width="160"
          height="220"
        />
        <div><strong>{index + 1}</strong><span>{page.name}</span></div>
        {#if !data.chapter?.published_at}<div class="page-controls">
            <button
              aria-label="Mover página {index + 1} para antes"
              disabled={index === 0 || busy}
              onclick={() => move(index, -1)}>←</button
            ><button
              aria-label="Mover página {index + 1} para depois"
              disabled={index === pages.length - 1 || busy}
              onclick={() => move(index, 1)}>→</button
            ><button
              aria-label="Remover página {index + 1}"
              disabled={busy}
              onclick={() => (pages = pages.filter((_, i) => i !== index))}>Remover</button
            >
          </div>{/if}
      </div>{/each}
  </div>
  <div class="row" style="margin-top:30px">
    {#if !data.chapter?.published_at}<button class="button" onclick={save} disabled={busy || !pages.length}
        >Salvar rascunho</button
      >{/if}{#if data.chapter}<a
        class="button secondary"
        href="/ler/{data.chapter.id}?preview=1"
        target="_blank"
        rel="noreferrer">Visualizar capítulo ↗</a
      >{/if}
  </div>
</section>
{#if data.chapter}<section class="panel" style="margin-top:25px">
    <h2 style="font-size:23px">{data.chapter.published_at ? 'Capítulo publicado' : 'Tudo conferido?'}</h2>
    {#if data.chapter.published_at}<p class="small">
        Despublique antes de fazer correções. As páginas deixam de ser acessíveis publicamente.
      </p>
      <button class="button secondary" onclick={() => publish(true)} disabled={busy}
        >Despublicar para corrigir</button
      >{:else}<p class="small">
        {dirty
          ? 'Há alterações não salvas. Salve o rascunho antes de conferir e publicar.'
          : 'Abra a prévia e confira todas as páginas antes de publicar.'}
      </p>
      <label class="small row" style="margin:20px 0"
        ><input type="checkbox" bind:checked={confirmed} /> Confirmo que são páginas finais, revisadas e autorizadas
        para publicação.</label
      ><button class="button" onclick={() => publish()} disabled={busy || !confirmed || dirty}
        >Publicar capítulo</button
      >{/if}
  </section>{/if}
{#if data.role === 'ADMIN' && data.chapter}
  <DeleteContent
    id={data.chapter.id}
    label={`Capítulo ${data.chapter.number}`}
    kind="chapter"
    destination={`/admin/obras/${data.work.id}`}
  />
{/if}

<style>
  .upload-zone {
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
  }
  .upload-zone > span {
    font-size: 30px;
    color: var(--purple);
  }
  .upload-zone strong {
    font-size: 14px;
  }
  .upload-zone small {
    font-size: 11px;
    color: var(--muted);
  }
  .upload-zone input {
    max-width: 100%;
    font-size: 12px;
    margin-top: 10px;
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
  .page-controls button {
    background: #27202e;
    border: 0;
    padding: 6px;
    font-size: 10px;
    border-radius: 4px;
  }
  .page-controls button:last-child {
    margin-left: auto;
  }
</style>
