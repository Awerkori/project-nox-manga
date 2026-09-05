<script lang="ts">
  import '../app.css';
  import {
    Search,
    Library,
    UserRound,
    Bell,
    Menu,
    X,
    ArrowUpRight,
    BookOpen,
    Trophy,
    Shield
  } from '@lucide/svelte';
  let { data, children } = $props();
  let menu = $state(false);
  let reader = $derived(data.pathname.startsWith('/ler/'));
</script>

<svelte:head
  ><title
    >{data.config.site_name || 'Project Nox'} — {data.config.description ||
      'Histórias que ficam com você'}</title
  ><meta
    name="description"
    content={data.config.description ||
      'Mangás, manhwas e webtoons da Project Nox. Descubra sua próxima leitura, acompanhe capítulos e faça parte da comunidade.'}
  /></svelte:head
>
<a class="skip" href="#conteudo">Pular para conteúdo</a>
{#if !reader}
  <header class="site-header">
    <div class="header-inner">
      <a href="/" class="brand" aria-label="Project Nox, início"
        ><span class="brand-symbol">N<span>✦</span></span><span class="brand-text"
          ><small>PROJECT</small><strong>NOX<span>·</span></strong></span
        ></a
      >
      <nav class:open={menu} aria-label="Navegação principal">
        <a class:active={data.pathname === '/'} href="/" onclick={() => (menu = false)}>Início</a><a
          class:active={data.pathname.startsWith('/catalogo')}
          href="/catalogo"
          onclick={() => (menu = false)}>Explorar</a
        ><a class:active={data.pathname === '/ranking'} href="/ranking" onclick={() => (menu = false)}
          >Comunidade</a
        >
      </nav>
      <div class="header-actions">
        <a class="icon-button" href="/catalogo" aria-label="Pesquisar"><Search size={20} /></a>
        {#if data.profile}<a
            class="icon-button notification-link"
            href="/notificacoes"
            aria-label="Notificações"
            ><Bell size={20} />{#if data.unread}<i></i>{/if}</a
          ><a class="avatar" href="/perfil" aria-label="Meu perfil"
            >{#if data.profile.avatar_id}<img
                src="/media/{data.profile.avatar_id}"
                alt=""
                width="38"
                height="38"
                style="border-radius:50%"
              />{:else}{data.profile.display_name.slice(0, 1)}{/if}</a
          >{:else}<a class="button compact" href="/entrar">Entrar <ArrowUpRight size={15} /></a>{/if}
        <button
          class="icon-button mobile-menu"
          aria-label={menu ? 'Fechar menu' : 'Abrir menu'}
          onclick={() => (menu = !menu)}
          >{#if menu}<X size={22} />{:else}<Menu size={22} />{/if}</button
        >
      </div>
    </div>
  </header>
{/if}
<main id="conteudo" class:reader-main={reader}>
  {#key data.pathname}{@render children()}{/key}
</main>
{#if !reader}
  <footer>
    <div class="footer-inner">
      <div>
        <a class="footer-brand" href="/">PROJECT <strong>NOX</strong><span>✦</span></a>
        <p>Histórias que ficam com você.</p>
      </div>
      <div class="footer-links">
        <a href="/catalogo">Catálogo</a><a href="/sobre">Sobre a Nox</a><a href="/privacidade">Privacidade</a
        >{#if data.role === 'ADMIN' || data.role === 'EDITOR'}<a href="/admin"
            ><Shield size={14} /> Editorial</a
          >{/if}
      </div>
    </div>
    <div class="footer-bottom">
      <span>© {new Date().getFullYear()} Project Nox</span><span>Feito para quem vive histórias.</span>
    </div>
  </footer>
  <nav class="mobile-bottom" aria-label="Atalhos">
    <a href="/"><BookOpen size={20} />Início</a><a href="/catalogo"><Search size={20} />Explorar</a><a
      href="/biblioteca"><Library size={20} />Biblioteca</a
    ><a href="/ranking"><Trophy size={20} />Ranking</a><a href="/perfil"><UserRound size={20} />Perfil</a>
  </nav>
{/if}
