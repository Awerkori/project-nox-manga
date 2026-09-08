<script lang="ts">
  import { date, memberRank } from '$lib/types';
  import { Award, BookOpen, Bookmark, Trophy } from '@lucide/svelte';
  let { data } = $props();
  let rank = $derived(memberRank(data.member.xp));
</script>

<svelte:head><title>{data.member.display_name} (@{data.member.username}) — Project Nox</title></svelte:head>
<div class="container spacer-bottom">
  <div class="page-top">
    <span class="eyebrow">COMUNIDADE NOX</span>
    <h1>Perfil do Leitor</h1>
  </div>
  <section class="panel" style="max-width:720px;margin:auto">
    <div style="display:flex;align-items:center;gap:22px;margin-bottom:24px">
      {#if data.member.avatar_id}
        <img
          src="/media/{data.member.avatar_id}"
          alt="Avatar de {data.member.display_name}"
          width="80"
          height="80"
          style="border-radius:50%;object-fit:cover;border:2px solid var(--purple)"
        />
      {:else}
        <span class="avatar" style="width:80px;height:80px;font-size:32px">
          {data.member.display_name[0] || 'N'}
        </span>
      {/if}
      <div>
        <div style="display:flex;align-items:center;gap:10px">
          <h2 style="font-size:26px;margin:0">{data.member.display_name}</h2>
          <span class="chip" style="color:var(--gold);border-color:#5c4728">{rank.title}</span>
        </div>
        <p class="small muted" style="margin:4px 0 0">
          @{data.member.username} · Na Nox desde {date(data.member.created_at)}
        </p>
      </div>
    </div>
    {#if data.member.bio}
      <p style="white-space:pre-wrap;margin-bottom:25px;color:#d7d1e0">{data.member.bio}</p>
    {/if}
    <div class="stat-row" style="margin-bottom:20px">
      <div class="stat"><strong>{rank.level}</strong><span>Nível</span></div>
      <div class="stat"><strong>{data.member.xp}</strong><span>XP</span></div>
      <div class="stat"><strong>{data.stats.chapters_read}</strong><span>Capítulos lidos</span></div>
      <div class="stat"><strong>{data.stats.completed_works}</strong><span>Obras concluídas</span></div>
      <div class="stat"><strong>{data.stats.favorites}</strong><span>Favoritos</span></div>
    </div>
    <div class="progress" style="margin-bottom:8px">
      <span style="width:{((data.member.xp % 250) / 250) * 100}%"></span>
    </div>
    <p class="small muted" style="margin-bottom:28px">
      {250 - (data.member.xp % 250)} XP para o nível {rank.level + 1}
    </p>
    <div style="border-top:1px solid var(--line);padding-top:20px">
      <h3 style="font-size:16px;margin-bottom:12px;color:var(--gold)">Conquistas na Nox</h3>
      <div class="chips">
        {#if data.stats.chapters_read > 0}
          <span class="chip"><BookOpen size={14} /> Primeiro Capítulo</span>
        {/if}
        {#if data.stats.chapters_read >= 5}
          <span class="chip"><Trophy size={14} /> Leitor Dedicado</span>
        {/if}
        {#if data.stats.completed_works > 0}
          <span class="chip"><Award size={14} /> Obra Concluída</span>
        {/if}
        {#if data.stats.favorites > 0}
          <span class="chip"><Bookmark size={14} /> Colecionador</span>
        {/if}
        {#if data.member.xp >= 250}
          <span class="chip" style="color:var(--purple)">✦ Nível {rank.level}</span>
        {/if}
        {#if data.stats.chapters_read === 0 && data.member.xp === 0}
          <span class="small muted">A jornada deste leitor está apenas começando.</span>
        {/if}
      </div>
    </div>
  </section>
</div>

