<script lang="ts">
  import type { Work } from '$lib/types';
  import { kindLabels } from '$lib/types';
  let { work, index = 0 }: { work: Work; index?: number } = $props();
</script>

<a class="work-card" href="/obra/{work.slug}">
  <div class="cover" style="--delay:{index * 40}ms">
    {#if work.cover_id}<img
        src="/media/{work.cover_id}"
        alt="Capa de {work.title}"
        loading="lazy"
        width="300"
        height="420"
      />{:else}<div class="cover-type"><span>PROJECT<br />NOX</span><strong>{work.title}</strong></div>{/if}
    <span class="cover-kind">{kindLabels[work.kind]}</span>
    <span class="cover-open">Ler obra ↗</span>
  </div>
  <h3>{work.title}</h3>
  <p>
    {work.status === 'COMPLETED' ? 'Concluído' : 'Em andamento'} <span>·</span>
    {work.year || 'Project Nox'}
  </p>
</a>
