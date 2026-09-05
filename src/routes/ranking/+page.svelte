<script>
  import Empty from '$lib/components/Empty.svelte';
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
  {#if data.members.length}<section class="panel">
      <table>
        <thead><tr><th>Posição</th><th>Leitor</th><th>Nível</th><th>XP</th></tr></thead><tbody
          >{#each data.members as member, i (member.id)}<tr
              ><td style="color:var(--gold)">{String(i + 1).padStart(2, '0')}</td><td
                ><a href="/u/{member.username}">{member.display_name}</a></td
              ><td>{Math.floor(member.xp / 250) + 1}</td><td>{member.xp}</td></tr
            >{/each}</tbody
        >
      </table>
    </section>{:else}<Empty
      title="Toda comunidade tem um primeiro leitor."
      text="O ranking ganha vida conforme os capítulos são lidos. Sua história na Nox pode começar agora."
      href="/catalogo"
      label="Encontrar uma leitura"
    />{/if}
</div>
