<script lang="ts">
  import { action } from '$lib/actions';
  import { goto } from '$app/navigation';
  let { id, label, kind, destination } = $props<{
    id: string;
    label: string;
    kind: 'work' | 'chapter';
    destination: string;
  }>();
  let confirmation = $state(''),
    busy = $state(false),
    notice = $state('');
  async function remove(event: SubmitEvent) {
    event.preventDefault();
    if (confirmation !== label || busy) return;
    busy = true;
    try {
      await action('owner', `delete_${kind}`, { id });
      await goto(destination, { invalidateAll: true });
    } catch (e) {
      notice = (e as Error).message;
    } finally {
      busy = false;
    }
  }
</script>

<details class="panel" style="margin-top:28px">
  <summary>Remoo definitiva — somente admin</summary>
  <p class="small">
    Excluir {kind === 'work'
      ? 'a obra remove tambm seus captulos, comentrios e progressos'
      : 'o captulo remove tambm seus comentrios e progressos'}. Esta ao no pode ser desfeita pelo
    painel. Os arquivos originais da central da staff no sero alterados.
  </p>
  <form onsubmit={remove}>
    <label class="field"
      >Para confirmar, digite: {label}<input bind:value={confirmation} autocomplete="off" required /></label
    >
    <button class="button secondary" disabled={busy || confirmation !== label}
      >{busy ? 'Excluindo…' : 'Excluir definitivamente'}</button
    >
  </form>
  {#if notice}<p class="notice" role="alert">{notice}</p>{/if}
</details>
