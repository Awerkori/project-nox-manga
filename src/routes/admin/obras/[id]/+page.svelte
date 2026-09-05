<script lang="ts">
  import { untrack } from 'svelte';
  import { goto, invalidateAll } from '$app/navigation';
  import { action } from '$lib/actions';
  import { kindLabels, statusLabels, slugify } from '$lib/types';
  import DeleteContent from '$lib/components/DeleteContent.svelte';
  let { data } = $props();
  const initial = untrack(() => data);
  let title = $state(initial.work?.title || ''),
    slug = $state(initial.work?.slug || ''),
    cover = $state(initial.work?.cover_id || ''),
    notice = $state(''),
    busy = $state(false),
    uploading = $state(false),
    selected = $state<string[]>(initial.selected);
  async function upload(event: Event) {
    const file = (event.currentTarget as HTMLInputElement).files?.[0];
    if (!file) return;
    uploading = true;
    notice = '';
    try {
      const { normalizePage } = await import('$lib/uploads');
      const image = await normalizePage(file);
      const response = await fetch('/api/upload', {
        method: 'POST',
        headers: { 'Content-Type': image.type },
        body: image
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message);
      cover = result.id;
    } catch (e) {
      notice = (e as Error).message;
    } finally {
      uploading = false;
    }
  }
  async function save(event: SubmitEvent) {
    event.preventDefault();
    busy = true;
    notice = '';
    try {
      const fields = Object.fromEntries(new FormData(event.currentTarget as HTMLFormElement));
      const result = await action('editor', 'work', {
        ...fields,
        id: data.work?.id,
        aliases: String(fields.aliases)
          .split('\n')
          .map((s) => s.trim())
          .filter(Boolean),
        tags: selected,
        cover_id: cover
      });
      if (!data.work) goto(`/admin/obras/${result.id}`);
      else {
        notice = 'Obra salva.';
        await invalidateAll();
      }
    } catch (e) {
      notice = (e as Error).message;
    } finally {
      busy = false;
    }
  }
  async function archive() {
    busy = true;
    try {
      await action('editor', 'archive', { id: data.work?.id });
      await invalidateAll();
      notice = 'Obra arquivada. Ela deixou de aparecer publicamente.';
    } catch (e) {
      notice = (e as Error).message;
    } finally {
      busy = false;
    }
  }
</script>

<svelte:head
  ><title>{data.work ? 'Editar ' + data.work.title : 'Adicionar obra'} — Nox Editorial</title></svelte:head
>
<div class="breadcrumb">
  <a href="/admin/obras">Obras</a><span>/</span><span>{data.work?.title || 'Adicionar obra'}</span>
</div>
<div class="row between">
  <h1 style="font-size:32px">{data.work ? 'Editar obra' : 'Uma nova história.'}</h1>
  {#if data.work?.published}<a href="/obra/{data.work.slug}" class="text-link">Ver no site ↗</a>{/if}
</div>
{#if notice}<div class="notice" role="status">{notice}</div>{/if}
<form class="panel" onsubmit={save}>
  <div class="editor-cover">
    <div>
      {#if cover}<img src="/media/{cover}" alt="Prévia da capa" width="150" height="210" />{:else}<div
          class="cover-empty"
        >
          Capa da obra
        </div>{/if}
    </div>
    <div>
      <h3>Capa</h3>
      <p class="small">Escolha uma imagem vertical. JPEG, PNG ou WebP.</p>
      <label class="button secondary compact"
        >{uploading ? 'Enviando capa…' : 'Selecionar capa'}<input
          type="file"
          accept="image/png,image/jpeg,image/webp"
          disabled={uploading}
          onchange={upload}
          style="display:none"
        /></label
      >
    </div>
  </div>
  <div class="form-grid">
    <label class="field full"
      >Título<input
        name="title"
        bind:value={title}
        oninput={() => {
          if (!data.work) slug = slugify(title);
        }}
        required
        maxlength="200"
      /></label
    ><label class="field full"
      >Endereço da obra<input name="slug" bind:value={slug} required pattern="[a-z0-9]+(-[a-z0-9]+)*" /><small
        >/obra/{slug || 'titulo-da-obra'}</small
      ></label
    ><label class="field full"
      >Outros nomes<textarea name="aliases" rows="2">{data.work?.aliases.join('\n') || ''}</textarea><small
        >Um nome por linha.</small
      ></label
    ><label class="field full"
      >Sinopse<textarea name="synopsis" rows="5" maxlength="5000" required
        >{data.work?.synopsis || ''}</textarea
      ></label
    ><label class="field full"
      >Descrição adicional<textarea name="description" rows="3" maxlength="10000"
        >{data.work?.description || ''}</textarea
      ></label
    ><label class="field">Autor<input name="author" value={data.work?.author || ''} maxlength="200" /></label
    ><label class="field"
      >Artista<input name="artist" value={data.work?.artist || ''} maxlength="200" /></label
    ><label class="field"
      >Formato<select name="kind" value={data.work?.kind || 'MANHWA'}
        >{#each Object.entries(kindLabels) as [value, label] (value)}<option {value}>{label}</option
          >{/each}</select
      ></label
    ><label class="field"
      >Status<select name="status" value={data.work?.status || 'ONGOING'}
        >{#each ['ONGOING', 'COMPLETED', 'HIATUS', 'CANCELLED'] as value (value)}<option {value}
            >{statusLabels[value]}</option
          >{/each}</select
      ></label
    ><label class="field"
      >Ano<input name="year" type="number" min="1900" max="2200" value={data.work?.year || ''} /></label
    ><label class="field"
      >Classificação indicativa<select name="age_rating" value={data.work?.age_rating ?? 12}
        >{#each [0, 10, 12, 14, 16, 18] as value (value)}<option {value}
            >{value === 0 ? 'Livre' : `${value} anos`}</option
          >{/each}</select
      ></label
    >
  </div>
  <fieldset class="tag-options">
    <legend>Gêneros e tags</legend>{#each data.tags as tag (tag?.id)}<label class="chip"
        ><input type="checkbox" bind:group={selected} value={tag.id} />{tag.name}</label
      >{/each}
  </fieldset>
  <div class="row">
    <button class="button" disabled={busy || uploading}>{busy ? 'Salvando…' : 'Salvar obra'}</button
    >{#if data.work?.published}<button
        type="button"
        class="button secondary"
        onclick={archive}
        disabled={busy}>Arquivar obra</button
      >{/if}
  </div>
</form>
{#if data.role === 'ADMIN' && data.work}
  <DeleteContent id={data.work.id} label={data.work.title} kind="work" destination="/admin/obras" />
{/if}
{#if data.work}<section style="margin-top:40px">
    <div class="row between">
      <h2 style="font-size:25px">Capítulos</h2>
      <a class="button" href="/admin/obras/{data.work.id}/capitulos/novo">Adicionar capítulo +</a>
    </div>
    <div class="panel table-wrap" style="margin-top:20px">
      <table>
        <thead><tr><th>Capítulo</th><th>Status</th><th></th></tr></thead><tbody
          >{#each data.chapters as chapter (chapter.id)}<tr
              ><td>Capítulo {chapter.number} {chapter.title}</td><td
                ><span class="chip">{chapter.published_at ? 'Publicado' : 'Rascunho'}</span></td
              ><td
                ><a class="text-link" href="/admin/obras/{data.work.id}/capitulos/{chapter.id}">Abrir →</a
                ></td
              ></tr
            >{/each}</tbody
        >
      </table>
      {#if !data.chapters.length}<p class="small">Ainda não há capítulos nesta obra.</p>{/if}
    </div>
  </section>{/if}

<style>
  .editor-cover {
    display: flex;
    gap: 28px;
    align-items: center;
    margin-bottom: 32px;
  }
  .editor-cover img {
    width: 130px;
    height: 182px;
    object-fit: cover;
    border-radius: 9px;
  }
  .cover-empty {
    width: 130px;
    height: 182px;
    display: flex;
    align-items: center;
    justify-content: center;
    border: 1px dashed #5e486f;
    border-radius: 9px;
    font-size: 12px;
    color: var(--muted);
  }
  .tag-options {
    border: 0;
    padding: 0;
    margin: 5px 0 28px;
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }
  .tag-options legend {
    font-size: 12px;
    color: var(--muted);
    margin-bottom: 15px;
  }
  .tag-options input {
    accent-color: var(--purple);
    margin-right: 6px;
  }
  .tag-options label {
    cursor: pointer;
  }
</style>
