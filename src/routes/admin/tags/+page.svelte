<script lang="ts">
  import { action } from '$lib/actions';
  import { invalidateAll } from '$app/navigation';
  import { slugify } from '$lib/types';
  let { data } = $props();
  let id = $state(''),
    name = $state(''),
    kind = $state('TAG'),
    notice = $state(''),
    busy = $state(false);
  async function save() {
    busy = true;
    try {
      await action('editor', 'tag', { id, name, slug: slugify(name), kind });
      id = '';
      name = '';
      notice = 'Tag salva.';
      await invalidateAll();
    } catch (e) {
      notice = (e as Error).message;
    } finally {
      busy = false;
    }
  }
</script>

<svelte:head><title>Gêneros e tags — Nox Editorial</title></svelte:head><span class="eyebrow"
  >DESCOBERTA E ORGANIZAÇÃO</span
>
<h1 style="font-size:34px">Gêneros e tags</h1>
<p class="small">Descrições consistentes ajudam cada leitor a encontrar sua próxima história.</p>
{#if notice}<div class="notice" role="status">{notice}</div>{/if}
<form
  class="panel"
  onsubmit={(e) => {
    e.preventDefault();
    save();
  }}
>
  <div class="form-grid">
    <label class="field">Nome<input bind:value={name} required maxlength="40" /></label><label class="field"
      >Categoria<select bind:value={kind}
        ><option value="GENRE">Gênero</option><option value="TAG">Tag</option></select
      ></label
    >
  </div>
  <div class="row">
    <button class="button" disabled={busy}>{id ? 'Salvar alteração' : 'Criar tag'}</button>{#if id}<button
        type="button"
        class="button secondary"
        onclick={() => {
          id = '';
          name = '';
        }}>Cancelar edição</button
      >{/if}
  </div>
</form>
<section class="panel" style="margin-top:25px">
  <div class="chips">
    {#each data.tags as tag (tag?.id)}<button
        class="chip"
        onclick={() => {
          id = tag.id;
          name = tag.name;
          kind = tag.kind;
        }}>{tag.kind === 'GENRE' ? '◈' : '#'} {tag.name} · Editar</button
      >{/each}
  </div>
</section>
