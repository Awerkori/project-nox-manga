<script lang="ts">
  import Empty from '$lib/components/Empty.svelte';
  import { memberRank } from '$lib/types';
  import { Trophy } from '@lucide/svelte';
  let { data } = $props();
</script>

<svelte:head><title>Comunidade e ranking de leitores — Project Nox</title></svelte:head>
<div class="container spacer-bottom">
  <div class="page-top">
    <span class="eyebrow">UMA PÁGINA DE CADA VEZ</span>
    <h1>Quem vive as histórias.</h1>
    <p>
      Cada capítulo concluído rende 25 XP. A cada 250 XP, um novo nível. Leia no seu ritmo e deixe sua jornada
      aparecer.
    </p>
  </div>
  {#if data.members.length}
    {#if data.members.length >= 1}
      <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(220px, 1fr));gap:18px;margin-bottom:32px">
        {#each data.members.slice(0, 3) as top, idx (top.id)}
          {@const r = memberRank(top.xp)}
          <a
            href="/u/{top.username}"
            class="panel"
            style="text-align:center;border-color:{idx === 0 ? '#8a6e35' : idx === 1 ? '#584b63' : '#44344e'};position:relative;overflow:hidden;padding:24px 16px"
          >
            <div style="position:absolute;top:12px;right:14px;color:{idx === 0 ? 'var(--gold)' : '#c0b6cb'}">
              <Trophy size={18} />
            </div>
            <div style="margin-bottom:12px">
              {#if top.avatar_id}
                <img
                  src="/media/{top.avatar_id}"
                  alt=""
                  width="58"
                  height="58"
                  style="border-radius:50%;object-fit:cover;margin:auto;display:block"
                />
              {:else}
                <span class="avatar" style="width:58px;height:58px;font-size:22px;margin:auto;display:flex;align-items:center;justify-content:center">
                  {top.display_name[0]}
                </span>
              {/if}
            </div>
            <strong style="display:block;font-size:16px;color:#eee6f7">{top.display_name}</strong>
            <p class="small muted" style="margin:2px 0 8px">@{top.username}</p>
            <div style="display:flex;justify-content:center;gap:8px;align-items:center">
              <span class="chip" style="font-size:11px;padding:3px 8px">{r.title}</span>
              <span class="chip" style="font-size:11px;padding:3px 8px;color:var(--gold)">Nível {r.level} · {top.xp} XP</span>
            </div>
          </a>
        {/each}
      </div>
    {/if}
    <section class="panel table-wrap">
      <table>
        <thead><tr><th>Posição</th><th>Leitor</th><th>Título</th><th>Nível</th><th>XP</th></tr></thead>
        <tbody>
          {#each data.members as member, i (member.id)}
            {@const r = memberRank(member.xp)}
            <tr>
              <td style="color:{i === 0 ? 'var(--gold)' : i < 3 ? '#cfc1df' : 'var(--muted)'};font-weight:700">
                {String(i + 1).padStart(2, '0')}
              </td>
              <td>
                <div style="display:flex;align-items:center;gap:12px">
                  {#if member.avatar_id}
                    <img
                      src="/media/{member.avatar_id}"
                      alt=""
                      width="32"
                      height="32"
                      style="border-radius:50%;object-fit:cover"
                    />
                  {:else}
                    <span class="avatar" style="width:32px;height:32px;font-size:13px">
                      {member.display_name[0]}
                    </span>
                  {/if}
                  <div>
                    <a href="/u/{member.username}"><strong>{member.display_name}</strong></a>
                    <span class="small muted" style="display:block">@{member.username}</span>
                  </div>
                </div>
              </td>
              <td><span class="chip" style="font-size:11px">{r.title}</span></td>
              <td>{r.level}</td>
              <td style="color:var(--gold)">{member.xp}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    </section>
  {:else}
    <Empty
      title="Toda comunidade tem um primeiro leitor."
      text="O ranking ganha vida conforme os capítulos são lidos. Sua história na Nox pode começar agora."
      href="/catalogo"
      label="Encontrar uma leitura"
    />
  {/if}
</div>

