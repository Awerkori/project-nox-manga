<script lang="ts">
  import { ArrowRight, ArrowUpRight, BookOpen, Sparkles, Compass } from '@lucide/svelte';
  import WorkCard from '$lib/components/WorkCard.svelte';
  let { data } = $props();
</script>

<div class="container">
  <section class="hero">
    <div class="hero-copy">
      <div class="eyebrow"><span></span> SEU PRÓXIMO UNIVERSO</div>
      <h1>Algumas histórias<br />só começam<br /><em>depois do escuro.</em></h1>
      <p>Mangás, manhwas e webtoons. Novos mundos, a mesma vontade de ler só mais um capítulo.</p>
      <div class="hero-actions">
        <a href="/catalogo" class="button">Encontrar minha próxima leitura <ArrowRight size={18} /></a><a
          href="/sobre"
          class="text-link">Conheça a Nox <ArrowUpRight size={16} /></a
        >
      </div>
      <div class="hero-note"><span class="gold-line"></span> UMA NOVA PÁGINA DA PROJECT NOX</div>
    </div>
    <div class="hero-art" aria-hidden="true">
      <div class="orbit orbit-one"></div>
      <div class="orbit orbit-two"></div>
      <div class="nocturne">
        <span class="art-caption">NOCTURNE / 001</span><span class="art-letter">N</span><span class="art-star"
          >✦</span
        >
        <div class="art-bottom"><span>BEYOND<br />THE ORDINARY.</span><span>夜</span></div>
      </div>
      <div class="art-label"><span>PROJECT NOX</span><span>EST. 2026</span></div>
    </div>
  </section>
  <div class="discovery-strip">
    <span><Sparkles size={17} /> Sua próxima obsessão está por aqui</span><a href="/catalogo?tag=acao"
      >Ação ↗</a
    ><a href="/catalogo?tag=fantasia">Fantasia ↗</a><a href="/catalogo?tag=romance">Romance ↗</a><a
      href="/catalogo?tag=misterio">Mistério ↗</a
    >
  </div>
  {#if data.recent.length}<section class="section">
      <div class="section-heading">
        <div>
          <span class="eyebrow">NO SEU RITMO</span>
          <h2>De onde você parou</h2>
        </div>
        <a href="/historico" class="text-link">Histórico <ArrowRight size={17} /></a>
      </div>
      <div class="continue-grid">
        {#each data.recent as item (item.chapters.id)}<a class="continue-card" href="/ler/{item.chapters.id}"
            ><BookOpen size={26} />
            <div>
              <strong>{item.chapters.works.title}</strong>
              <p>Capítulo {item.chapters.number} · Página {item.page}</p>
            </div>
            <ArrowRight size={18} /></a
          >{/each}
      </div>
    </section>{/if}
  {#if data.works.length}<section class="section">
      <div class="section-heading">
        <div>
          <span class="eyebrow">ACABARAM DE CHEGAR</span>
          <h2>Novas histórias. Novos capítulos.</h2>
        </div>
        <a href="/catalogo" class="text-link">Ver catálogo <ArrowRight size={17} /></a>
      </div>
      <div class="work-grid">
        {#each data.works as work, index (work.id)}<WorkCard {work} {index} />{/each}
      </div>
    </section>{:else}<section class="launch-panel">
      <div class="launch-icon"><BookOpen size={30} strokeWidth={1.2} /></div>
      <div>
        <span class="eyebrow">NOS BASTIDORES</span>
        <h2>As primeiras histórias estão a caminho.</h2>
        <p>Nossa equipe está preparando os capítulos. Quando a revisão terminar, você encontra tudo aqui.</p>
      </div>
      <a href="/cadastrar" class="button secondary">Faça parte da Nox <ArrowUpRight size={17} /></a>
    </section>{/if}
  <section class="community-banner">
    <div>
      <span class="eyebrow">MAIS QUE A ÚLTIMA PÁGINA</span>
      <h2>Seu lugar entre<br />uma história e outra.</h2>
      <p>
        Organize suas leituras, acompanhe cada capítulo e encontre gente que também não consegue parar de ler.
      </p>
      <a href={data.profile ? '/biblioteca' : '/cadastrar'} class="text-link"
        >{data.profile ? 'Abrir minha biblioteca' : 'Criar minha conta'} <ArrowRight size={18} /></a
      >
    </div>
    <div class="community-seal" aria-hidden="true">
      <Compass size={110} strokeWidth={0.7} /><span>EXPLORE · READ · BELONG</span>
    </div>
  </section>
</div>
