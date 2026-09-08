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
    Shield
  } from '@lucide/svelte';
  import ParticleBackground from '$lib/components/ParticleBackground.svelte';

  let { data, children } = $props();
  let menu = $state(false);
  let scrolled = $state(false);
  let reader = $derived(data.pathname.startsWith('/ler/'));

  onMount(() => {
    function handleScroll() {
      scrolled = window.scrollY > 24;
    }
    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener('scroll', handleScroll);
  });
</script>

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
        <a class:active={data.pathname === '/ranking'} href="/ranking">Comunidade</a>
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
          <a class="avatar-link" href="/perfil" aria-label="Meu perfil">
            {#if data.profile.avatar_id}
              <img
                src="/media/{data.profile.avatar_id}"
                alt=""
                width="34"
                height="34"
                class="avatar-img"
              />
            {:else}
              <span class="avatar-fallback">{data.profile.display_name.slice(0, 1)}</span>
            {/if}
          </a>
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
            <span>Ranking & Comunidade</span>
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
    max-width: 1320px;
    height: 100%;
    margin: 0 auto;
    padding: 0 32px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 32px;
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

  .avatar-link {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    border-radius: 50%;
    border: 1.5px solid rgba(181, 154, 245, 0.4);
    overflow: hidden;
    transition: transform 0.2s ease, border-color 0.2s ease;
  }

  .avatar-link:hover {
    transform: scale(1.06);
    border-color: #b59af5;
  }

  .avatar-img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .avatar-fallback {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    background: #191c30;
    color: #b59af5;
    font-weight: 700;
    font-size: 14px;
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
    max-width: 1320px;
    margin: 0 auto;
    padding: 0 32px;
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 32px;
    flex-wrap: wrap;
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
    max-width: 1320px;
    margin: 32px auto 0;
    padding: 24px 32px 0;
    border-top: 1px solid rgba(255, 255, 255, 0.04);
    display: flex;
    justify-content: space-between;
    font-size: 12px;
    color: #5c596b;
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
