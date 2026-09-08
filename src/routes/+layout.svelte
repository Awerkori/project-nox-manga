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
    Shield
  } from '@lucide/svelte';
  import { memberRank } from '$lib/types';
  import ParticleBackground from '$lib/components/ParticleBackground.svelte';

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

{#if !reader}
  <ParticleBackground />

  <header class="site-header" class:scrolled class:menu-open={menu}>
    <div class="header-inner">
      <a href="/" class="brand" aria-label="Project Nox, início" onclick={() => (menu = false)}>
        <img
          src="/brand/nox-symbol-64.webp"
          alt="Project Nox"
          width="36"
          height="36"
          class="header-symbol"
        />
        <span class="brand-text">
          <small>PROJECT</small>
          <strong>NOX</strong>
        </span>
      </a>

      <nav class="desktop-nav" aria-label="Navegação principal">
        <a class:active={data.pathname === '/'} href="/">Início</a>
        <a class:active={data.pathname.startsWith('/catalogo')} href="/catalogo">Catálogo</a>
        <a class:active={data.pathname === '/ranking'} href="/ranking">Ranking</a>
      </nav>

      <div class="header-actions">
        <a class="icon-button" href="/catalogo" aria-label="Pesquisar catálogo">
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
            width="28"
            height="28"
            class="footer-symbol"
          />
          <span>PROJECT <strong>NOX</strong></span>
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
    height: 72px;
    z-index: 50;
    background: rgba(6, 7, 12, 0.4);
    border-bottom: 1px solid rgba(255, 255, 255, 0.05);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
  }

  .site-header.scrolled {
    background: rgba(8, 10, 18, 0.85);
    border-bottom-color: rgba(181, 154, 245, 0.14);
    box-shadow: 0 8px 24px -6px rgba(0, 0, 0, 0.6);
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

  .brand {
    display: flex;
    align-items: center;
    gap: 12px;
    text-decoration: none;
  }

  .header-symbol {
    width: 36px;
    height: 36px;
    object-fit: contain;
    filter: drop-shadow(0 0 8px rgba(181, 154, 245, 0.3));
    transition: transform 0.3s ease;
  }

  .brand:hover .header-symbol {
    transform: scale(1.08);
  }

  .brand-text {
    display: flex;
    flex-direction: column;
    line-height: 1;
  }

  .brand-text small {
    font-size: 9px;
    font-weight: 700;
    letter-spacing: 0.28em;
    color: #a6a3b8;
  }

  .brand-text strong {
    font-family: var(--font-heading, Manrope, sans-serif);
    font-size: 20px;
    font-weight: 800;
    letter-spacing: 0.04em;
    color: #ffffff;
  }

  .desktop-nav {
    display: flex;
    align-items: center;
    gap: 28px;
  }

  .desktop-nav a {
    font-size: 14px;
    font-weight: 500;
    color: #a6a3b8;
    text-decoration: none;
    padding: 6px 0;
    position: relative;
    transition: color 0.2s ease;
  }

  .desktop-nav a:hover,
  .desktop-nav a.active {
    color: #ffffff;
  }

  .desktop-nav a.active::after {
    content: '';
    position: absolute;
    bottom: -2px;
    left: 0;
    right: 0;
    height: 2px;
    background: linear-gradient(90deg, #b59af5, #c9aa73);
    border-radius: 2px;
  }

  .header-actions {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .btn-login-nav {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 8px 18px;
    border-radius: 999px;
    background: rgba(181, 154, 245, 0.12);
    border: 1px solid rgba(181, 154, 245, 0.3);
    color: #ffffff;
    font-size: 13px;
    font-weight: 600;
    transition: all 0.25s ease;
  }

  .btn-login-nav:hover {
    background: rgba(181, 154, 245, 0.22);
    border-color: rgba(181, 154, 245, 0.5);
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
    width: 38px;
    height: 38px;
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
  .avatar-btn:focus-visible {
    transform: scale(1.06);
    border-color: #b59af5;
    box-shadow: 0 0 14px rgba(181, 154, 245, 0.35);
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

  .mobile-menu-btn {
    display: none;
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
    gap: 10px;
    font-size: 18px;
    color: #ffffff;
    text-decoration: none;
    margin-bottom: 10px;
  }

  .footer-symbol {
    width: 24px;
    height: 24px;
    object-fit: contain;
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

  @media (max-width: 768px) {
    .header-inner {
      padding: 0 20px;
    }

    .desktop-nav {
      display: none;
    }

    .mobile-menu-btn {
      display: flex;
    }

    .mobile-drawer {
      display: block;
      position: absolute;
      top: 72px;
      left: 0;
      right: 0;
      background: rgba(8, 10, 18, 0.96);
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
