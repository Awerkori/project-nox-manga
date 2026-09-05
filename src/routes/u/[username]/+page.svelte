<script>
  import { date } from '$lib/types';
  let { data } = $props();
</script>

<svelte:head><title>{data.member.display_name} — Project Nox</title></svelte:head>
<div class="container spacer-bottom">
  <div class="page-top">
    <span class="eyebrow">COMUNIDADE NOX</span>
    <h1>{data.member.display_name}</h1>
    <p>@{data.member.username} · Desde {date(data.member.created_at)}</p>
  </div>
  <section class="panel">
    <p style="white-space:pre-wrap">{data.member.bio || 'Uma história ainda sendo escrita.'}</p>
    <div class="stat-row">
      <div class="stat"><strong>{Math.floor(data.member.xp / 250) + 1}</strong><span>Nível</span></div>
      <div class="stat"><strong>{data.member.xp}</strong><span>XP</span></div>
    </div>
  </section>
</div>
