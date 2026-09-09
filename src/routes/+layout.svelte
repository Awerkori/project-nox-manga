<script lang="ts">
  import '../app.css';
  import { onMount } from 'svelte';
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
    Bookmark,
    History,
    LogOut,
    Shield,
    ExternalLink
  } from '@lucide/svelte';
  import { memberRank } from '$lib/types';
  import ParticleBackground from '$lib/components/ParticleBackground.svelte';
  import AgeGateModal from '$lib/components/AgeGateModal.svelte';

  let { data, children } = $props();
  let menu = $state(false);
  let userMenuOpen = $state(false);
  let scrolled = $state(false);
  let reader = $derived(data.pathname.startsWith('/ler/'));
  let rank = $derived(data.profile ? memberRank(data.profile.xp) : null);

  onMount(() => {
    function handleScroll() {
      scrolled = window.scrollY > 24;
    }
    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener('scroll', handleScroll);
  });
</script>

<svelte:window
  onkeydown={(e) => {
    if (e.key === 'Escape') {
      userMenuOpen = false;
      menu = false;
    }
  }}
  onclick={(e) => {
    const target = e.target as HTMLElement | null;
    if (userMenuOpen && target && !target.closest('.user-menu-container')) {
      userMenuOpen = false;
    }
  }}
/>

<svelte:head>
  <title
    >{data.config.site_name || 'Project Nox'} — {data.config.description ||
      'Histórias que nascem nas sombras e conquistam a noite'}</title
  >
  <meta
    name="description"
    content={data.config.description ||
      'Mangás, manhwas e webtoons da Project Nox. Descubra sua próxima leitura, acompanhe capítulos e faça parte da comunidade.'}
  />
  <meta property="og:site_name" content="Project Nox" />
  <meta property="og:type" content="website" />
  <meta property="og:image" content="/brand/nox-symbol-256.webp" />
  <meta name="twitter:card" content="summary" />
  <meta name="twitter:image" content="/brand/nox-symbol-256.webp" />
</svelte:head>

<a class="skip" href="#conteudo">Pular para conteúdo</a>

<AgeGateModal status={data.ageStatus} isLoggedIn={!!data.profile} />

{#if !reader}
  <ParticleBackground />

  <header class="site-header" class:scrolled class:menu-open={menu}>
    <div class="header-inner">
      <a href="/" class="brand" aria-label="Project Nox, início" onclick={() => (menu = false)}>
        <div class="brand-symbol-wrap">
          <img
            src="/brand/nox-symbol-64.webp"
            alt="Project Nox"
            width="46"
            height="46"
            class="header-symbol"
          />
          <span class="brand-symbol-glow"></span>
        </div>
        <span class="brand-text">
          <span class="brand-project">PROJECT</span>
          <span class="brand-nox">NOX</span>
        </span>
      </a>

      <nav class="desktop-nav" aria-label="Navegação principal">
        <a class:active={data.pathname === '/'} href="/">
          <span>Início</span>
        </a>
        <a class:active={data.pathname.startsWith('/catalogo')} href="/catalogo">
          <span>Catálogo</span>
        </a>
        <a class:active={data.pathname === '/ranking'} href="/ranking">
          <span>Ranking</span>
        </a>
      </nav>

      <div class="header-actions">
        <!-- Official Desktop Community Links (Tracker style) -->
        <div class="header-community-group">
          <a
            class="header-community-btn fluxer-btn"
            href="https://web.canary.fluxer.app/invite/q456UCVt"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Fluxer Oficial"
            title="Fluxer Oficial"
          >
            <svg viewBox="0 0 512 512" fill="none" class="community-svg" aria-hidden="true">
              <path d="M187.53 266.057C171.987 266.057 157.206 269.562 143.187 276.571C129.321 283.581 118.044 294.781 109.359 310.171C103.743 320.3 100.041 332.574 98.2529 346.993C96.5986 360.334 107.829 371.2 121.271 371.2C135.049 371.2 145.336 359.626 148.673 346.259C150.564 338.68 153.612 332.67 157.815 328.229C165.891 319.695 176.101 315.429 188.444 315.429C196.673 315.429 204.216 317.486 211.073 321.6C217.93 325.562 226.844 332.343 237.815 341.943C254.577 356.724 269.359 367.467 282.159 374.171C294.959 380.724 309.13 384 324.673 384C340.216 384 354.997 380.495 369.016 373.486C383.035 366.476 394.387 355.276 403.073 339.886C408.811 329.718 412.521 317.389 414.202 302.899C415.745 289.597 404.498 278.857 391.106 278.857C377.243 278.858 366.904 290.561 363.218 303.927C361.421 310.442 358.706 315.952 355.073 320.457C347.454 329.905 337.016 334.629 323.759 334.629C315.53 334.629 308.063 332.647 301.359 328.686C294.806 324.571 285.816 317.714 274.387 308.114C257.473 293.943 242.615 283.429 229.815 276.571C217.168 269.562 203.073 266.057 187.53 266.057Z" fill="currentColor"/>
              <path d="M187.53 128C171.987 128 157.206 131.505 143.187 138.514C129.321 145.524 118.044 156.724 109.359 172.114C103.743 182.243 100.041 194.517 98.2529 208.935C96.5985 222.276 107.829 233.142 121.271 233.143C135.049 233.143 145.336 221.569 148.673 208.202C150.564 200.623 153.612 194.613 157.815 190.171C165.891 181.638 176.101 177.371 188.444 177.371C196.673 177.371 204.216 179.429 211.073 183.543C217.93 187.505 226.844 194.286 237.815 203.886C254.577 218.667 269.359 229.41 282.159 236.114C294.959 242.667 309.13 245.943 324.673 245.943C340.216 245.943 354.997 242.438 369.016 235.429C383.035 228.419 394.387 217.219 403.073 201.829C408.811 191.661 412.521 179.332 414.202 164.842C415.745 151.539 404.498 140.8 391.106 140.8C377.243 140.8 366.904 152.504 363.218 165.87C361.421 172.385 358.706 177.895 355.073 182.4C347.454 191.848 337.016 196.571 323.759 196.571C315.53 196.571 308.063 194.59 301.359 190.629C294.806 186.514 285.816 179.657 274.387 170.057C257.473 155.886 242.615 145.371 229.815 138.514C217.168 131.505 203.073 128 187.53 128Z" fill="currentColor"/>
            </svg>
            <span class="community-btn-text">Fluxer</span>
          </a>
          <a
            class="header-community-btn discord-btn"
            href="https://discord.com/invite/qNAMYUEmGj"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Discord Oficial"
            title="Discord Oficial"
          >
            <svg viewBox="0 0 24 24" fill="currentColor" class="community-svg" aria-hidden="true">
              <path d="M19.54 4.46A16.5 16.5 0 0 0 15.4 3.2l-.5 1.02a15.3 15.3 0 0 0-5.8 0L8.6 3.2a16.5 16.5 0 0 0-4.14 1.26C1.84 8.4 1.13 12.24 1.48 16.03A16.65 16.65 0 0 0 6.56 18.6l1.23-1.68a10.33 10.33 0 0 1-1.94-.93l.47-.36a11.92 11.92 0 0 0 11.36 0l.47.36c-.62.37-1.27.69-1.94.93l1.23 1.68a16.62 16.62 0 0 0 5.08-2.57c.41-4.4-.7-8.2-2.98-11.57ZM8.68 13.7c-1.1 0-2-1.01-2-2.25s.88-2.25 2-2.25 2.02 1.01 2 2.25c0 1.24-.88 2.25-2 2.25Zm6.64 0c-1.1 0-2-1.01-2-2.25s.88-2.25 2-2.25 2.02 1.01 2 2.25c0 1.24-.88 2.25-2 2.25Z"/>
            </svg>
            <span class="community-btn-text">Discord</span>
          </a>
        </div>

        <a class="icon-button header-search-btn" href="/catalogo" aria-label="Pesquisar catálogo">
          <Search size={18} />
        </a>

        {#if data.profile}
          <a
            class="icon-button notification-link"
            href="/notificacoes"
            aria-label="Notificações"
          >
            <Bell size={18} />
            {#if data.unread}<i></i>{/if}
          </a>

          <div class="user-menu-container">
            <button
              type="button"
              class="avatar-btn"
              aria-label="Menu do usuário"
              aria-expanded={userMenuOpen}
              onclick={() => (userMenuOpen = !userMenuOpen)}
            >
              {#if data.profile.avatar_id}
                <img
                  src="/media/{data.profile.avatar_id}"
                  alt=""
                  width="34"
                  height="34"
                  class="avatar-img"
                />
              {:else}
                <span class="avatar-fallback">{data.profile.display_name.slice(0, 1).toUpperCase()}</span>
              {/if}
            </button>

            {#if userMenuOpen}
              <div class="user-dropdown" role="menu">
                <a href="/perfil" class="dropdown-header-link" onclick={() => (userMenuOpen = false)}>
                  {#if data.profile.avatar_id}
                    <img
                      src="/media/{data.profile.avatar_id}"
                      alt=""
                      width="40"
                      height="40"
                      class="dropdown-avatar-img"
                    />
                  {:else}
                    <span class="dropdown-avatar-fallback">{data.profile.display_name.slice(0, 1).toUpperCase()}</span>
                  {/if}
                  <div class="dropdown-user-meta">
                    <span class="dropdown-user-name">{data.profile.display_name}</span>
                    <span class="dropdown-user-handle">@{data.profile.username || 'leitor'}</span>
                    {#if rank}
                      <span class="dropdown-rank-pill">{rank.title}</span>
                    {/if}
                  </div>
                </a>

                <div class="dropdown-divider"></div>

                <div class="dropdown-links">
                  <a href="/perfil" role="menuitem" onclick={() => (userMenuOpen = false)}>
                    <UserRound size={16} />
                    <span>Meu Perfil</span>
                  </a>
                  <a href="/biblioteca" role="menuitem" onclick={() => (userMenuOpen = false)}>
                    <Library size={16} />
                    <span>Minha Biblioteca</span>
                  </a>
                  <a href="/favoritos" role="menuitem" onclick={() => (userMenuOpen = false)}>
                    <Bookmark size={16} />
                    <span>Favoritos</span>
                  </a>
                  <a href="/historico" role="menuitem" onclick={() => (userMenuOpen = false)}>
                    <History size={16} />
                    <span>Histórico</span>
                  </a>
                  <a href="/notificacoes" role="menuitem" onclick={() => (userMenuOpen = false)}>
                    <Bell size={16} />
                    <span>Notificações</span>
                    {#if data.unread}
                      <span class="dropdown-badge">{data.unread}</span>
                    {/if}
                  </a>
                  <a href="/ranking" role="menuitem" onclick={() => (userMenuOpen = false)}>
                    <Trophy size={16} />
                    <span>Ranking Geral</span>
                  </a>
                  {#if data.role === 'ADMIN' || data.role === 'EDITOR'}
                    <a href="/admin" class="dropdown-admin-link" role="menuitem" onclick={() => (userMenuOpen = false)}>
                      <Shield size={16} />
                      <span>Painel Editorial</span>
                    </a>
                  {/if}
                </div>

                <div class="dropdown-divider"></div>
                <div class="dropdown-section-title">COMUNIDADE</div>

                <div class="dropdown-links">
                  <a
                    href="https://web.canary.fluxer.app/invite/q456UCVt"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="community-dropdown-item item-fluxer"
                    role="menuitem"
                    onclick={() => (userMenuOpen = false)}
                  >
                    <svg viewBox="0 0 512 512" fill="none" class="dropdown-icon-svg" aria-hidden="true">
                      <path d="M187.53 266.057C171.987 266.057 157.206 269.562 143.187 276.571C129.321 283.581 118.044 294.781 109.359 310.171C103.743 320.3 100.041 332.574 98.2529 346.993C96.5986 360.334 107.829 371.2 121.271 371.2C135.049 371.2 145.336 359.626 148.673 346.259C150.564 338.68 153.612 332.67 157.815 328.229C165.891 319.695 176.101 315.429 188.444 315.429C196.673 315.429 204.216 317.486 211.073 321.6C217.93 325.562 226.844 332.343 237.815 341.943C254.577 356.724 269.359 367.467 282.159 374.171C294.959 380.724 309.13 384 324.673 384C340.216 384 354.997 380.495 369.016 373.486C383.035 366.476 394.387 355.276 403.073 339.886C408.811 329.718 412.521 317.389 414.202 302.899C415.745 289.597 404.498 278.857 391.106 278.857C377.243 278.858 366.904 290.561 363.218 303.927C361.421 310.442 358.706 315.952 355.073 320.457C347.454 329.905 337.016 334.629 323.759 334.629C315.53 334.629 308.063 332.647 301.359 328.686C294.806 324.571 285.816 317.714 274.387 308.114C257.473 293.943 242.615 283.429 229.815 276.571C217.168 269.562 203.073 266.057 187.53 266.057Z" fill="currentColor"/>
                      <path d="M187.53 128C171.987 128 157.206 131.505 143.187 138.514C129.321 145.524 118.044 156.724 109.359 172.114C103.743 182.243 100.041 194.517 98.2529 208.935C96.5985 222.276 107.829 233.142 121.271 233.143C135.049 233.143 145.336 221.569 148.673 208.202C150.564 200.623 153.612 194.613 157.815 190.171C165.891 181.638 176.101 177.371 188.444 177.371C196.673 177.371 204.216 179.429 211.073 183.543C217.93 187.505 226.844 194.286 237.815 203.886C254.577 218.667 269.359 229.41 282.159 236.114C294.959 242.667 309.13 245.943 324.673 245.943C340.216 245.943 354.997 242.438 369.016 235.429C383.035 228.419 394.387 217.219 403.073 201.829C408.811 191.661 412.521 179.332 414.202 164.842C415.745 151.539 404.498 140.8 391.106 140.8C377.243 140.8 366.904 152.504 363.218 165.87C361.421 172.385 358.706 177.895 355.073 182.4C347.454 191.848 337.016 196.571 323.759 196.571C315.53 196.571 308.063 194.59 301.359 190.629C294.806 186.514 285.816 179.657 274.387 170.057C257.473 155.886 242.615 145.371 229.815 138.514C217.168 131.505 203.073 128 187.53 128Z" fill="currentColor"/>
                    </svg>
                    <span>Fluxer Oficial</span>
                    <ExternalLink size={12} class="ext-badge-icon" />
                  </a>
                  <a
                    href="https://discord.com/invite/qNAMYUEmGj"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="community-dropdown-item item-discord"
                    role="menuitem"
                    onclick={() => (userMenuOpen = false)}
                  >
                    <svg viewBox="0 0 24 24" fill="currentColor" class="dropdown-icon-svg" aria-hidden="true">
                      <path d="M19.54 4.46A16.5 16.5 0 0 0 15.4 3.2l-.5 1.02a15.3 15.3 0 0 0-5.8 0L8.6 3.2a16.5 16.5 0 0 0-4.14 1.26C1.84 8.4 1.13 12.24 1.48 16.03A16.65 16.65 0 0 0 6.56 18.6l1.23-1.68a10.33 10.33 0 0 1-1.94-.93l.47-.36a11.92 11.92 0 0 0 11.36 0l.47.36c-.62.37-1.27.69-1.94.93l1.23 1.68a16.62 16.62 0 0 0 5.08-2.57c.41-4.4-.7-8.2-2.98-11.57ZM8.68 13.7c-1.1 0-2-1.01-2-2.25s.88-2.25 2-2.25 2.02 1.01 2 2.25c0 1.24-.88 2.25-2 2.25Zm6.64 0c-1.1 0-2-1.01-2-2.25s.88-2.25 2-2.25 2.02 1.01 2 2.25c0 1.24-.88 2.25-2 2.25Z"/>
                    </svg>
                    <span>Discord Oficial</span>
                    <ExternalLink size={12} class="ext-badge-icon" />
                  </a>
                </div>

                <div class="dropdown-divider"></div>

                <form method="POST" action="/auth/sair" class="dropdown-logout-form">
                  <button type="submit" class="dropdown-logout-btn" role="menuitem">
                    <LogOut size={16} />
                    <span>Sair da conta</span>
                  </button>
                </form>
              </div>
            {/if}
          </div>
        {:else}
          <a class="btn-login-nav" href="/entrar">
            <span>Entrar</span>
            <ArrowUpRight size={14} />
          </a>
        {/if}

        <button
          class="icon-button mobile-menu-btn"
          aria-label={menu ? 'Fechar menu' : 'Abrir menu'}
          onclick={() => (menu = !menu)}
        >
          {#if menu}<X size={20} />{:else}<Menu size={20} />{/if}
        </button>
      </div>
    </div>

    <!-- Mobile Drawer Dropdown -->
    {#if menu}
      <div class="mobile-drawer" role="dialog" aria-modal="true">
        <nav class="mobile-drawer-nav" aria-label="Menu móvel">
          <a class:active={data.pathname === '/'} href="/" onclick={() => (menu = false)}>
            <BookOpen size={18} />
            <span>Início</span>
          </a>
          <a class:active={data.pathname.startsWith('/catalogo')} href="/catalogo" onclick={() => (menu = false)}>
            <Search size={18} />
            <span>Catálogo</span>
          </a>
          <a class:active={data.pathname === '/ranking'} href="/ranking" onclick={() => (menu = false)}>
            <Trophy size={18} />
            <span>Ranking</span>
          </a>
          {#if data.profile}
            <a class:active={data.pathname === '/biblioteca'} href="/biblioteca" onclick={() => (menu = false)}>
              <Library size={18} />
              <span>Minha Biblioteca</span>
            </a>
            <a class:active={data.pathname === '/perfil'} href="/perfil" onclick={() => (menu = false)}>
              <UserRound size={18} />
              <span>Meu Perfil</span>
            </a>
          {/if}
        </nav>
      </div>
    {/if}
  </header>
{/if}

<main id="conteudo" class:reader-main={reader}>
  {#key data.pathname}{@render children()}{/key}
</main>

{#if !reader}
  <footer class="site-footer">
    <div class="footer-inner">
      <div class="footer-brand-col">
        <a class="footer-brand" href="/">
          <img
            src="/brand/nox-symbol-64.webp"
            alt=""
            width="32"
            height="32"
            class="footer-symbol"
          />
          <span class="brand-text footer-brand-text">
            <span class="brand-project">PROJECT</span>
            <span class="brand-nox">NOX</span>
          </span>
        </a>
        <p class="footer-tagline">Histórias que nascem nas sombras e conquistam a noite.</p>
      </div>

      <div class="footer-links">
        <a href="/catalogo">Catálogo</a>
        <a href="/ranking">Ranking</a>
        <a href="/sobre">Sobre a Nox</a>
        <a href="/privacidade">Privacidade</a>
        {#if data.role === 'ADMIN' || data.role === 'EDITOR'}
          <a href="/admin" class="footer-admin-link">
            <Shield size={14} />
            <span>Editorial</span>
          </a>
        {/if}
      </div>

      <div class="footer-community">
        <span class="footer-col-heading">Comunidade</span>
        <div class="footer-community-btns">
          <a
            href="https://web.canary.fluxer.app/invite/q456UCVt"
            target="_blank"
            rel="noopener noreferrer"
            class="footer-community-btn btn-fluxer"
            title="Entrar no Fluxer oficial do Project Nox"
          >
            <svg viewBox="0 0 512 512" fill="none" class="community-svg" aria-hidden="true">
              <path d="M187.53 266.057C171.987 266.057 157.206 269.562 143.187 276.571C129.321 283.581 118.044 294.781 109.359 310.171C103.743 320.3 100.041 332.574 98.2529 346.993C96.5986 360.334 107.829 371.2 121.271 371.2C135.049 371.2 145.336 359.626 148.673 346.259C150.564 338.68 153.612 332.67 157.815 328.229C165.891 319.695 176.101 315.429 188.444 315.429C196.673 315.429 204.216 317.486 211.073 321.6C217.93 325.562 226.844 332.343 237.815 341.943C254.577 356.724 269.359 367.467 282.159 374.171C294.959 380.724 309.13 384 324.673 384C340.216 384 354.997 380.495 369.016 373.486C383.035 366.476 394.387 355.276 403.073 339.886C408.811 329.718 412.521 317.389 414.202 302.899C415.745 289.597 404.498 278.857 391.106 278.857C377.243 278.858 366.904 290.561 363.218 303.927C361.421 310.442 358.706 315.952 355.073 320.457C347.454 329.905 337.016 334.629 323.759 334.629C315.53 334.629 308.063 332.647 301.359 328.686C294.806 324.571 285.816 317.714 274.387 308.114C257.473 155.886 242.615 145.371 229.815 138.514C217.168 131.505 203.073 128 187.53 128Z" fill="currentColor"/>
              <path d="M187.53 128C171.987 128 157.206 131.505 143.187 138.514C129.321 145.524 118.044 156.724 109.359 172.114C103.743 182.243 100.041 194.517 98.2529 208.935C96.5985 222.276 107.829 233.142 121.271 233.143C135.049 233.143 145.336 221.569 148.673 208.202C150.564 200.623 153.612 194.613 157.815 190.171C165.891 181.638 176.101 177.371 188.444 177.371C196.673 177.371 204.216 179.429 211.073 183.543C217.93 187.505 226.844 194.286 237.815 203.886C254.577 218.667 269.359 229.41 282.159 236.114C294.959 242.667 309.13 245.943 324.673 245.943C340.216 245.943 354.997 242.438 369.016 235.429C383.035 228.419 394.387 217.219 403.073 201.829C408.811 191.661 412.521 179.332 414.202 164.842C415.745 151.539 404.498 140.8 391.106 140.8C377.243 140.8 366.904 152.504 363.218 165.87C361.421 172.385 358.706 177.895 355.073 182.4C347.454 191.848 337.016 196.571 323.759 196.571C315.53 196.571 308.063 194.59 301.359 190.629C294.806 186.514 285.816 179.657 274.387 170.057C257.473 155.886 242.615 145.371 229.815 138.514C217.168 131.505 203.073 128 187.53 128Z" fill="currentColor"/>
            </svg>
            <span>Fluxer</span>
          </a>
          <a
            href="https://discord.com/invite/qNAMYUEmGj"
            target="_blank"
            rel="noopener noreferrer"
            class="footer-community-btn btn-discord"
            title="Entrar no Discord oficial do Project Nox"
          >
            <svg viewBox="0 0 24 24" fill="currentColor" class="community-svg" aria-hidden="true">
              <path d="M19.54 4.46A16.5 16.5 0 0 0 15.4 3.2l-.5 1.02a15.3 15.3 0 0 0-5.8 0L8.6 3.2a16.5 16.5 0 0 0-4.14 1.26C1.84 8.4 1.13 12.24 1.48 16.03A16.65 16.65 0 0 0 6.56 18.6l1.23-1.68a10.33 10.33 0 0 1-1.94-.93l.47-.36a11.92 11.92 0 0 0 11.36 0l.47.36c-.62.37-1.27.69-1.94.93l1.23 1.68a16.62 16.62 0 0 0 5.08-2.57c.41-4.4-.7-8.2-2.98-11.57ZM8.68 13.7c-1.1 0-2-1.01-2-2.25s.88-2.25 2-2.25 2.02 1.01 2 2.25c0 1.24-.88 2.25-2 2.25Zm6.64 0c-1.1 0-2-1.01-2-2.25s.88-2.25 2-2.25 2.02 1.01 2 2.25c0 1.24-.88 2.25-2 2.25Z"/>
            </svg>
            <span>Discord</span>
          </a>
        </div>
      </div>
    </div>

    <div class="footer-bottom">
      <span>© {new Date().getFullYear()} Project Nox</span>
      <span class="footer-credit">Feito para quem vive histórias.</span>
    </div>
  </footer>

  <nav class="mobile-bottom" aria-label="Atalhos">
    <a href="/" class:active={data.pathname === '/'}><BookOpen size={20} /><span>Início</span></a>
    <a href="/catalogo" class:active={data.pathname.startsWith('/catalogo')}><Search size={20} /><span>Explorar</span></a>
    <a href="/biblioteca" class:active={data.pathname === '/biblioteca'}><Library size={20} /><span>Biblioteca</span></a>
    <a href="/ranking" class:active={data.pathname === '/ranking'}><Trophy size={20} /><span>Ranking</span></a>
    <a href="/perfil" class:active={data.pathname === '/perfil'}><UserRound size={20} /><span>Perfil</span></a>
  </nav>
{/if}

<style>
  .site-header {
    position: sticky;
    top: 0;
    left: 0;
    right: 0;
    height: 78px;
    z-index: 50;
    background: rgba(6, 7, 14, 0.65);
    border-bottom: 1px solid rgba(255, 255, 255, 0.07);
    backdrop-filter: blur(18px);
    -webkit-backdrop-filter: blur(18px);
    transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
  }

  .site-header.scrolled {
    background: rgba(6, 7, 14, 0.92);
    border-bottom-color: rgba(181, 154, 245, 0.2);
    box-shadow: 0 10px 30px -8px rgba(0, 0, 0, 0.75);
  }

  .header-inner {
    max-width: 1440px;
    height: 100%;
    margin: 0 auto;
    padding: 0 36px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 32px;
  }
  @media (min-width: 1600px) {
    .header-inner {
      max-width: 1520px;
      padding: 0 48px;
    }
  }

  /* Brand Lockup Horizontal */
  .brand {
    display: inline-flex;
    align-items: center;
    gap: 14px;
    text-decoration: none;
    user-select: none;
    flex-shrink: 0;
    transition: transform 0.25s cubic-bezier(0.16, 1, 0.3, 1);
  }

  .brand:hover {
    transform: translateY(-1px);
  }

  .brand-symbol-wrap {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .header-symbol {
    width: 46px;
    height: 46px;
    object-fit: contain;
    filter: drop-shadow(0 0 12px rgba(181, 154, 245, 0.38));
    transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1), filter 0.3s ease;
  }

  .brand-symbol-glow {
    position: absolute;
    inset: -6px;
    border-radius: 50%;
    background: radial-gradient(circle, rgba(181, 154, 245, 0.45), transparent 70%);
    opacity: 0;
    pointer-events: none;
    transition: opacity 0.3s ease;
  }

  .brand:hover .brand-symbol-glow {
    opacity: 1;
  }

  .brand:hover .header-symbol {
    transform: scale(1.06) rotate(1deg);
    filter: drop-shadow(0 0 20px rgba(181, 154, 245, 0.6));
  }

  .brand-text {
    display: inline-flex;
    align-items: baseline;
    gap: 8px;
    line-height: 1;
  }

  .brand-project {
    font-family: var(--font-heading, Manrope, sans-serif);
    font-size: 22px;
    font-weight: 850;
    letter-spacing: 0.04em;
    color: #dfc28d;
    background: linear-gradient(135deg, #ffffff 0%, #f6e4c7 35%, #dfc28d 75%, #b89352 100%);
    -webkit-background-clip: text;
    background-clip: text;
    -webkit-text-fill-color: transparent;
    filter: drop-shadow(0 2px 10px rgba(223, 194, 141, 0.25));
  }

  .brand-nox {
    font-family: var(--font-heading, Manrope, sans-serif);
    font-size: 22px;
    font-weight: 850;
    letter-spacing: 0.05em;
    color: #b59af5;
    background: linear-gradient(135deg, #ffffff 0%, #e6dcfe 35%, #b59af5 75%, #8b5cf6 100%);
    -webkit-background-clip: text;
    background-clip: text;
    -webkit-text-fill-color: transparent;
    filter: drop-shadow(0 2px 14px rgba(181, 154, 245, 0.35));
  }

  /* Desktop Navigation in Segmented Glass Capsule */
  .desktop-nav {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 6px 8px;
    border-radius: 999px;
    background: rgba(14, 18, 28, 0.65);
    border: 1px solid rgba(255, 255, 255, 0.08);
    box-shadow: 0 4px 20px -2px rgba(0, 0, 0, 0.45), inset 0 1px 1px rgba(255, 255, 255, 0.06);
    backdrop-filter: blur(16px);
    -webkit-backdrop-filter: blur(16px);
  }

  .desktop-nav a {
    display: inline-flex;
    align-items: center;
    font-family: var(--font-heading, Manrope, sans-serif);
    font-size: 14.5px;
    font-weight: 600;
    letter-spacing: 0.01em;
    color: #b5b1c7;
    text-decoration: none;
    padding: 8px 20px;
    border-radius: 999px;
    position: relative;
    transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
  }

  .desktop-nav a:hover {
    color: #ffffff;
    background: rgba(255, 255, 255, 0.08);
  }

  .desktop-nav a.active {
    color: #ffffff;
    font-weight: 700;
    background: linear-gradient(135deg, rgba(181, 154, 245, 0.22) 0%, rgba(201, 170, 115, 0.15) 100%);
    border: 1px solid rgba(181, 154, 245, 0.4);
    box-shadow: 0 0 18px rgba(181, 154, 245, 0.22), inset 0 1px 1px rgba(255, 255, 255, 0.3);
  }

  /* Actions Toolbar */
  .header-actions {
    display: flex;
    align-items: center;
    gap: 12px;
    flex-shrink: 0;
  }

  /* Header Community Links (Tracker Style) */
  .header-community-group {
    display: inline-flex;
    align-items: center;
    gap: 8px;
  }

  .header-community-btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    height: 38px;
    padding: 0 12px;
    border-radius: 9px;
    border: 1px solid rgba(255, 255, 255, 0.08);
    font-size: 13px;
    font-weight: 700;
    text-decoration: none;
    transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
    cursor: pointer;
  }

  .header-community-btn .community-svg {
    width: 17px;
    height: 17px;
    flex-shrink: 0;
  }

  .header-community-btn.fluxer-btn {
    background: rgba(22, 21, 44, 0.7);
    color: #e9e4ff;
    border-color: rgba(214, 162, 255, 0.2);
  }

  .header-community-btn.fluxer-btn:hover {
    border-color: #d6a2ff;
    background: rgba(162, 107, 222, 0.22);
    color: #f1dcff;
    transform: translateY(-1px);
    box-shadow: 0 0 14px rgba(214, 162, 255, 0.25);
  }

  .header-community-btn.discord-btn {
    background: rgba(22, 21, 44, 0.7);
    color: #e9e4ff;
    border-color: rgba(114, 137, 218, 0.2);
  }

  .header-community-btn.discord-btn:hover {
    border-color: #7289da;
    background: rgba(88, 101, 242, 0.2);
    color: #bdc8ff;
    transform: translateY(-1px);
    box-shadow: 0 0 14px rgba(114, 137, 218, 0.25);
  }

  @media (max-width: 1120px) {
    .header-community-btn {
      padding: 0;
      width: 38px;
      height: 38px;
      justify-content: center;
      border-radius: 50%;
    }
    .header-community-btn .community-btn-text {
      display: none;
    }
  }

  @media (max-width: 768px) {
    .header-community-group {
      display: none !important;
    }
  }

  .header-actions .icon-button {
    width: 42px;
    height: 42px;
    border-radius: 50%;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    background: rgba(14, 18, 28, 0.65);
    border: 1px solid rgba(255, 255, 255, 0.09);
    color: #b5b1c7;
    transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
    cursor: pointer;
    text-decoration: none;
    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.3);
    padding: 0;
  }

  .header-actions .icon-button:hover {
    color: #ffffff;
    background: rgba(28, 33, 54, 0.85);
    border-color: rgba(181, 154, 245, 0.4);
    transform: translateY(-1px);
    box-shadow: 0 4px 18px rgba(181, 154, 245, 0.2);
  }

  .btn-login-nav {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 9px 22px;
    border-radius: 999px;
    background: linear-gradient(135deg, rgba(181, 154, 245, 0.2), rgba(201, 170, 115, 0.14));
    border: 1px solid rgba(181, 154, 245, 0.38);
    color: #ffffff;
    font-size: 14px;
    font-weight: 700;
    box-shadow: 0 2px 14px rgba(181, 154, 245, 0.18), inset 0 1px 1px rgba(255, 255, 255, 0.2);
    transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
    text-decoration: none;
  }

  .btn-login-nav:hover {
    background: linear-gradient(135deg, rgba(181, 154, 245, 0.32), rgba(201, 170, 115, 0.24));
    border-color: rgba(181, 154, 245, 0.65);
    box-shadow: 0 6px 24px rgba(181, 154, 245, 0.35), inset 0 1px 1px rgba(255, 255, 255, 0.3);
    transform: translateY(-1px);
  }

  .user-menu-container {
    position: relative;
    display: inline-flex;
    align-items: center;
  }

  .avatar-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 42px;
    height: 42px;
    padding: 0;
    border-radius: 50%;
    background: transparent;
    border: 1.5px solid rgba(181, 154, 245, 0.4);
    box-shadow: 0 0 10px rgba(181, 154, 245, 0.15);
    cursor: pointer;
    overflow: hidden;
    transition: transform 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease;
  }

  .avatar-btn:hover,
  .avatar-btn:focus-visible,
  .avatar-btn[aria-expanded="true"] {
    transform: translateY(-1px) scale(1.04);
    border-color: #b59af5;
    box-shadow: 0 0 16px rgba(181, 154, 245, 0.45);
  }

  .avatar-img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .avatar-fallback {
    width: 100%;
    height: 100%;
    display: grid;
    place-items: center;
    background: #191c30;
    color: #b59af5;
    font-weight: 800;
    font-size: 14px;
    line-height: 1;
    text-transform: uppercase;
    user-select: none;
  }

  /* Kuro-Style User Dropdown */
  .user-dropdown {
    position: absolute;
    top: calc(100% + 12px);
    right: 0;
    width: 260px;
    background: rgba(11, 13, 24, 0.96);
    border: 1px solid rgba(181, 154, 245, 0.22);
    border-radius: 14px;
    box-shadow: 0 18px 42px -8px rgba(0, 0, 0, 0.8), 0 0 20px rgba(181, 154, 245, 0.08);
    backdrop-filter: blur(24px);
    -webkit-backdrop-filter: blur(24px);
    padding: 10px;
    z-index: 100;
    animation: dropdownFade 0.18s cubic-bezier(0.16, 1, 0.3, 1);
  }

  @keyframes dropdownFade {
    from {
      opacity: 0;
      transform: translateY(-8px) scale(0.97);
    }
    to {
      opacity: 1;
      transform: translateY(0) scale(1);
    }
  }

  .dropdown-header-link {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 8px;
    border-radius: 10px;
    text-decoration: none;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.04);
    transition: background 0.2s ease, border-color 0.2s ease;
  }

  .dropdown-header-link:hover {
    background: rgba(181, 154, 245, 0.08);
    border-color: rgba(181, 154, 245, 0.2);
  }

  .dropdown-avatar-img {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    object-fit: cover;
    border: 1.5px solid rgba(181, 154, 245, 0.4);
    flex-shrink: 0;
  }

  .dropdown-avatar-fallback {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    display: grid;
    place-items: center;
    background: #191c30;
    color: #b59af5;
    font-weight: 800;
    font-size: 16px;
    line-height: 1;
    text-transform: uppercase;
    border: 1.5px solid rgba(181, 154, 245, 0.4);
    flex-shrink: 0;
  }

  .dropdown-user-meta {
    display: flex;
    flex-direction: column;
    min-width: 0;
    flex: 1;
  }

  .dropdown-user-name {
    font-size: 13.5px;
    font-weight: 700;
    color: #ffffff;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .dropdown-user-handle {
    font-size: 11px;
    color: #8c889f;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .dropdown-rank-pill {
    display: inline-block;
    margin-top: 4px;
    align-self: flex-start;
    font-size: 10px;
    font-weight: 700;
    padding: 2px 7px;
    border-radius: 6px;
    background: rgba(201, 170, 115, 0.12);
    color: #dfc28d;
    border: 1px solid rgba(201, 170, 115, 0.25);
    white-space: nowrap;
  }

  .dropdown-divider {
    height: 1px;
    background: rgba(255, 255, 255, 0.06);
    margin: 8px 0;
  }

  .dropdown-links {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .dropdown-links a {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 10px;
    border-radius: 8px;
    color: #c2bed4;
    font-size: 13px;
    font-weight: 500;
    text-decoration: none;
    transition: background 0.15s ease, color 0.15s ease;
  }

  .dropdown-links a:hover {
    background: rgba(181, 154, 245, 0.1);
    color: #ffffff;
  }

  .dropdown-admin-link {
    color: #dfc28d !important;
  }

  .dropdown-badge {
    margin-left: auto;
    font-size: 10px;
    font-weight: 800;
    background: #ff4772;
    color: #ffffff;
    padding: 1px 6px;
    border-radius: 10px;
  }

  .dropdown-logout-form {
    margin: 0;
  }

  .dropdown-logout-btn {
    display: flex;
    align-items: center;
    gap: 10px;
    width: 100%;
    padding: 8px 10px;
    border-radius: 8px;
    background: transparent;
    border: none;
    color: #f87171;
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    text-align: left;
    transition: background 0.15s ease, color 0.15s ease;
  }

  .dropdown-logout-btn:hover {
    background: rgba(248, 113, 113, 0.12);
    color: #fca5a5;
  }

  /* Dropdown Community */
  .dropdown-section-title {
    font-size: 10px;
    font-weight: 700;
    color: #6c697c;
    letter-spacing: 0.08em;
    padding: 6px 10px 2px;
    text-transform: uppercase;
  }

  .community-dropdown-item {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 10px;
    border-radius: 8px;
    font-size: 13px;
    font-weight: 500;
    text-decoration: none;
    transition: all 0.15s ease;
  }

  .community-dropdown-item :global(.ext-badge-icon) {
    margin-left: auto;
    opacity: 0.4;
  }

  .community-dropdown-item.item-fluxer {
    color: #d6a2ff;
  }
  .community-dropdown-item.item-fluxer:hover {
    background: rgba(214, 162, 255, 0.12);
    color: #f1dcff;
  }
  .community-dropdown-item.item-fluxer:hover :global(.ext-badge-icon) {
    opacity: 0.8;
  }

  .community-dropdown-item.item-discord {
    color: #9cb0ff;
  }
  .community-dropdown-item.item-discord:hover {
    background: rgba(156, 176, 255, 0.12);
    color: #ffffff;
  }
  .community-dropdown-item.item-discord:hover :global(.ext-badge-icon) {
    opacity: 0.8;
  }

  .dropdown-icon-svg {
    width: 16px;
    height: 16px;
    flex-shrink: 0;
  }

  .mobile-menu-btn {
    display: none !important;
  }

  .mobile-drawer {
    display: none;
  }

  /* Footer */
  .site-footer {
    border-top: 1px solid rgba(255, 255, 255, 0.06);
    background: rgba(6, 7, 12, 0.95);
    padding: 48px 0 32px;
    margin-top: 64px;
    position: relative;
    z-index: 10;
  }

  .footer-inner {
    max-width: 1440px;
    margin: 0 auto;
    padding: 0 36px;
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 32px;
    flex-wrap: wrap;
  }
  @media (min-width: 1600px) {
    .footer-inner {
      max-width: 1520px;
      padding: 0 48px;
    }
  }

  .footer-brand-col {
    max-width: 400px;
  }

  .footer-brand {
    display: inline-flex;
    align-items: center;
    gap: 12px;
    text-decoration: none;
    margin-bottom: 12px;
    user-select: none;
  }

  .footer-symbol {
    width: 32px;
    height: 32px;
    object-fit: contain;
    filter: drop-shadow(0 0 8px rgba(181, 154, 245, 0.3));
  }

  .footer-brand-text {
    display: inline-flex;
    align-items: baseline;
    gap: 6px;
  }

  .footer-brand-text .brand-project {
    font-size: 19px;
  }

  .footer-brand-text .brand-nox {
    font-size: 19px;
  }

  .footer-tagline {
    font-size: 13px;
    color: #7b788a;
    margin: 0;
    line-height: 1.6;
  }

  .footer-links {
    display: flex;
    align-items: center;
    gap: 24px;
    flex-wrap: wrap;
  }

  .footer-links a {
    font-size: 14px;
    color: #9d99ab;
    text-decoration: none;
    transition: color 0.2s ease;
  }

  .footer-links a:hover {
    color: #ffffff;
  }

  .footer-admin-link {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    color: #c9aa73 !important;
  }

  /* Footer Community Buttons */
  .footer-community {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .footer-col-heading {
    font-size: 12px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: #8c889c;
  }

  .footer-community-btns {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .footer-community-btn {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 7px 14px;
    border-radius: 8px;
    font-size: 13px;
    font-weight: 600;
    text-decoration: none;
    transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
  }

  .footer-community-btn .community-svg {
    width: 17px;
    height: 17px;
    flex-shrink: 0;
  }

  .footer-community-btn.btn-fluxer {
    background: rgba(214, 162, 255, 0.08);
    border: 1px solid rgba(214, 162, 255, 0.25);
    color: #d6a2ff;
  }

  .footer-community-btn.btn-fluxer:hover {
    background: rgba(214, 162, 255, 0.16);
    border-color: rgba(214, 162, 255, 0.5);
    color: #f1dcff;
    box-shadow: 0 0 16px rgba(214, 162, 255, 0.25);
    transform: translateY(-1px);
  }

  .footer-community-btn.btn-discord {
    background: rgba(114, 137, 218, 0.08);
    border: 1px solid rgba(114, 137, 218, 0.25);
    color: #9cb0ff;
  }

  .footer-community-btn.btn-discord:hover {
    background: rgba(114, 137, 218, 0.16);
    border-color: rgba(114, 137, 218, 0.5);
    color: #ffffff;
    box-shadow: 0 0 16px rgba(114, 137, 218, 0.25);
    transform: translateY(-1px);
  }

  .footer-bottom {
    max-width: 1440px;
    margin: 32px auto 0;
    padding: 24px 36px 0;
    border-top: 1px solid rgba(255, 255, 255, 0.04);
    display: flex;
    justify-content: space-between;
    font-size: 12px;
    color: #5c596b;
  }
  @media (min-width: 1600px) {
    .footer-bottom {
      max-width: 1520px;
      padding: 24px 48px 0;
    }
  }

  @media (max-width: 980px) and (min-width: 769px) {
    .header-inner {
      padding: 0 24px;
      gap: 20px;
    }
    .desktop-nav {
      gap: 4px;
      padding: 5px 6px;
    }
    .desktop-nav a {
      padding: 7px 14px;
      font-size: 14px;
    }
    .brand-project,
    .brand-nox {
      font-size: 20px;
    }
    .header-symbol {
      width: 42px;
      height: 42px;
    }
  }

  @media (max-width: 768px) {
    .site-header {
      height: 68px;
    }

    .header-inner {
      padding: 0 16px;
      gap: 12px;
    }

    .brand {
      gap: 10px;
    }

    .header-symbol {
      width: 36px;
      height: 36px;
    }

    .brand-project,
    .brand-nox {
      font-size: 17.5px;
    }

    .desktop-nav {
      display: none;
    }

    .header-actions {
      gap: 10px;
    }

    .header-actions .icon-button {
      width: 38px;
      height: 38px;
    }

    .header-search-btn {
      display: none !important;
    }

    .btn-login-nav {
      padding: 7px 16px;
      font-size: 13px;
    }

    .avatar-btn {
      width: 38px;
      height: 38px;
    }

    .mobile-menu-btn {
      display: inline-flex !important;
    }

    .mobile-drawer {
      display: block;
      position: absolute;
      top: 68px;
      left: 0;
      right: 0;
      background: rgba(8, 10, 18, 0.97);
      border-bottom: 1px solid rgba(181, 154, 245, 0.2);
      backdrop-filter: blur(20px);
      padding: 20px 24px;
      box-shadow: 0 16px 32px rgba(0, 0, 0, 0.7);
    }

    .mobile-drawer-nav {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    .mobile-drawer-nav a {
      display: flex;
      align-items: center;
      gap: 12px;
      font-size: 16px;
      font-weight: 500;
      color: #c2bed4;
      text-decoration: none;
      padding: 8px 0;
    }

    .mobile-drawer-nav a.active {
      color: #b59af5;
    }

    .site-footer {
      padding-bottom: 84px; /* Space for mobile bottom bar */
    }

    .footer-inner {
      flex-direction: column;
      padding: 0 20px;
    }

    .footer-bottom {
      padding: 20px 20px 0;
      flex-direction: column;
      gap: 8px;
    }
  }
</style>
