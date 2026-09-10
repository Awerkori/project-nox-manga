<script lang="ts">
  import {
    BookOpen,
    Tags,
    Users,
    Settings,
    ArrowUpRight,
    LayoutDashboard,
    Menu,
    X,
    Shield,
    Sparkles,
    Activity,
    Flag,
    UserCheck,
    ShoppingBag
  } from '@lucide/svelte';

  let { data, children } = $props();
  let mobileDrawerOpen = $state(false);

  let currentPath = $derived(data.pathname || '');

  function isActive(path: string, exact = false) {
    if (exact) return currentPath === path;
    if (path === '/admin') return currentPath === '/admin';
    return currentPath === path || currentPath.startsWith(path + '/');
  }

  function closeMobile() {
    mobileDrawerOpen = false;
  }
</script>

<svelte:head>
  <meta name="robots" content="noindex,nofollow" />
</svelte:head>

<div class="admin-shell">
  <!-- Mobile Backdrop Overlay -->
  {#if mobileDrawerOpen}
    <div
      class="mobile-backdrop"
      aria-hidden="true"
      onclick={closeMobile}
    ></div>
  {/if}

  <!-- Sidebar (Desktop Fixed & Mobile Drawer) -->
  <aside class="admin-sidebar" class:open={mobileDrawerOpen}>
    <!-- Sidebar Brand & Operator Lockup -->
    <div class="sidebar-header">
      <div class="brand-cluster">
        <img
          src="/brand/nox-symbol-64.webp"
          alt="Project Nox"
          width="36"
          height="36"
          class="sidebar-symbol"
        />
        <div class="brand-text">
          <span class="brand-editorial">PROJECT NOX</span>
          <span class="brand-sub">Painel de Controle</span>
        </div>
      </div>

      <!-- Mobile Close Button inside Drawer -->
      <button
        type="button"
        class="drawer-close-btn"
        aria-label="Fechar menu do painel"
        onclick={closeMobile}
      >
        <X size={18} />
      </button>

      <!-- Operator Identity Card -->
      <div class="operator-card">
        <div class="operator-avatar">
          {#if data.profile?.avatar_id}
            <img
              src="/media/{data.profile.avatar_id}"
              alt=""
              width="36"
              height="36"
              class="avatar-img"
            />
          {:else}
            <span class="avatar-fallback">
              {data.profile?.display_name ? data.profile.display_name.slice(0, 1).toUpperCase() : (data.role === 'ADMIN' ? 'A' : 'E')}
            </span>
          {/if}
          <span class="operator-status-dot"></span>
        </div>

        <div class="operator-meta">
          <span class="operator-name" title={data.profile?.display_name || 'Operador Nox'}>
            {data.profile?.display_name || (data.role === 'ADMIN' ? 'Administrador' : 'Editor Nox')}
          </span>
          <span class="operator-badge" class:role-admin={data.role === 'ADMIN'}>
            {#if data.role === 'ADMIN'}
              <Shield size={10} />
              <span>ADMINISTRADOR</span>
            {:else}
              <Sparkles size={10} />
              <span>EDITOR</span>
            {/if}
          </span>
        </div>
      </div>
    </div>

    <!-- Grouped Admin Navigation -->
    <nav class="sidebar-nav" aria-label="Navegação administrativa">
      <!-- Group: GERAL -->
      <div class="nav-group">
        <span class="group-label">GERAL</span>
        <a
          href="/admin"
          class="nav-link"
          class:active={isActive('/admin', true)}
          onclick={closeMobile}
        >
          <LayoutDashboard size={17} class="nav-icon" />
          <span>Visão Geral</span>
        </a>
      </div>

      <!-- Group: CONTEÚDO -->
      <div class="nav-group">
        <span class="group-label">CONTEÚDO</span>
        <a
          href="/admin/obras"
          class="nav-link"
          class:active={isActive('/admin/obras')}
          onclick={closeMobile}
        >
          <BookOpen size={17} class="nav-icon" />
          <span>Obras e Capítulos</span>
        </a>
        <a
          href="/admin/tags"
          class="nav-link"
          class:active={isActive('/admin/tags')}
          onclick={closeMobile}
        >
          <Tags size={17} class="nav-icon" />
          <span>Gêneros e Tags</span>
        </a>
      </div>

      <!-- Group: PARCEIROS -->
      <div class="nav-group">
        <span class="group-label">PARCEIROS</span>
        <a
          href="/admin/scans"
          class="nav-link"
          class:active={isActive('/admin/scans')}
          onclick={closeMobile}
        >
          <Users size={17} class="nav-icon" />
          <span>Gestão de Scans</span>
        </a>
      </div>

      <!-- Group: OPERAÇÕES -->
      <div class="nav-group">
        <span class="group-label">OPERAÇÕES</span>
        <a
          href="/admin/importer"
          class="nav-link"
          class:active={isActive('/admin/importer')}
          onclick={closeMobile}
        >
          <Activity size={17} class="nav-icon" />
          <span>Central do Importer</span>
        </a>
      </div>

      <!-- Group: STAFF -->
      <div class="nav-group">
        <span class="group-label">STAFF</span>
        <a
          href="/admin/reports"
          class="nav-link"
          class:active={isActive('/admin/reports')}
          onclick={closeMobile}
        >
          <Flag size={17} class="nav-icon" />
          <span>Denúncias & Moderação</span>
          {#if (data.pendingReportsCount ?? 0) > 0}
            <span class="nav-badge alert">{(data.pendingReportsCount ?? 0)}</span>
          {/if}
        </a>
      </div>

      <!-- Group: ADMINISTRAÇÃO -->
      <div class="nav-group">
        <span class="group-label">ADMINISTRAÇÃO</span>
        {#if data.role === 'ADMIN'}
          <a
            href="/admin/staff"
            class="nav-link"
            class:active={isActive('/admin/staff')}
            onclick={closeMobile}
          >
            <UserCheck size={17} class="nav-icon" />
            <span>Gestão da Staff</span>
          </a>
          <a
            href="/admin/gestao"
            class="nav-link"
            class:active={isActive('/admin/gestao', true)}
            onclick={closeMobile}
          >
            <Users size={17} class="nav-icon" />
            <span>Membros & Leitores</span>
          </a>
        {/if}
        <a
          href="/admin/loja"
          class="nav-link"
          class:active={isActive('/admin/loja')}
          onclick={closeMobile}
        >
          <ShoppingBag size={17} class="nav-icon" />
          <span>Gestão da Loja</span>
        </a>
        {#if data.role === 'ADMIN'}
          <a
            href="/admin/gestao/configuracoes"
            class="nav-link"
            class:active={isActive('/admin/gestao/configuracoes')}
            onclick={closeMobile}
          >
            <Settings size={17} class="nav-icon" />
            <span>Configurações</span>
          </a>
        {/if}
      </div>

      <!-- Group: ATALHOS EXTERNOS -->
      <div class="nav-group nav-group-bottom">
        <a href="/" class="nav-link public-link" target="_blank" rel="noopener noreferrer">
          <ArrowUpRight size={17} class="nav-icon" />
          <span>Ver Site Público</span>
        </a>
      </div>
    </nav>
  </aside>

  <!-- Main Content Workspace -->
  <main class="admin-content">
    <!-- Mobile Header Trigger -->
    <div class="mobile-admin-header">
      <button
        type="button"
        class="mobile-expand-btn"
        onclick={() => (mobileDrawerOpen = true)}
        aria-label="Expandir painel de controle"
      >
        <Menu size={17} />
        <span>Expandir painel de controle</span>
      </button>
    </div>

    {@render children()}
  </main>
</div>

<style>
  .admin-shell {
    display: grid;
    grid-template-columns: 260px minmax(0, 1fr);
    max-width: 1480px;
    margin: 0 auto;
    min-height: calc(100vh - 78px);
    position: relative;
  }

  /* Mobile Admin Top Header (< 950px) */
  .mobile-admin-header {
    display: none;
    margin-bottom: 20px;
    padding-bottom: 16px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  }

  .mobile-expand-btn {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    justify-content: center;
    padding: 11px 16px;
    border-radius: 10px;
    background: rgba(18, 22, 34, 0.85);
    border: 1px solid rgba(223, 194, 141, 0.35);
    color: #dfc28d;
    font-weight: 750;
    font-size: 13.5px;
    cursor: pointer;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4);
    transition: all 0.2s ease;
  }

  .mobile-expand-btn:hover {
    background: rgba(223, 194, 141, 0.12);
    border-color: #dfc28d;
  }

  .drawer-close-btn {
    display: none;
    align-items: center;
    justify-content: center;
    width: 34px;
    height: 34px;
    border-radius: 8px;
    background: rgba(255, 255, 255, 0.06);
    border: 1px solid rgba(255, 255, 255, 0.12);
    color: #d1cde0;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .drawer-close-btn:hover {
    background: rgba(255, 255, 255, 0.14);
    color: #ffffff;
  }

  .mobile-backdrop {
    display: none;
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.7);
    backdrop-filter: blur(4px);
    z-index: 40;
  }

  /* Editorial Sidebar */
  .admin-sidebar {
    min-width: 0;
    background: rgba(10, 12, 20, 0.7);
    border-right: 1px solid rgba(255, 255, 255, 0.08);
    padding: 28px 20px;
    display: flex;
    flex-direction: column;
    gap: 24px;
    backdrop-filter: blur(16px);
    -webkit-backdrop-filter: blur(16px);
  }

  .sidebar-header {
    display: flex;
    flex-direction: column;
    gap: 18px;
    padding-bottom: 20px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.07);
  }

  .brand-cluster {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .sidebar-symbol {
    filter: drop-shadow(0 2px 10px rgba(223, 194, 141, 0.25));
  }

  .brand-text {
    display: flex;
    flex-direction: column;
  }

  .brand-editorial {
    font-family: var(--font-heading, 'Manrope', sans-serif);
    font-size: 13.5px;
    font-weight: 850;
    letter-spacing: 0.08em;
    color: #ffffff;
  }

  .brand-sub {
    font-size: 10.5px;
    font-weight: 500;
    color: #7b8396;
    letter-spacing: 0.02em;
  }

  /* Operator Card */
  .operator-card {
    display: flex;
    align-items: center;
    gap: 11px;
    padding: 10px 12px;
    background: rgba(18, 22, 34, 0.6);
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: 10px;
  }

  .operator-avatar {
    position: relative;
    width: 36px;
    height: 36px;
    flex-shrink: 0;
  }

  .avatar-img {
    width: 36px;
    height: 36px;
    border-radius: 8px;
    object-fit: cover;
    border: 1px solid rgba(181, 154, 245, 0.35);
  }

  .avatar-fallback {
    width: 36px;
    height: 36px;
    border-radius: 8px;
    background: linear-gradient(135deg, #2b2238 0%, #171520 100%);
    border: 1px solid rgba(223, 194, 141, 0.35);
    color: #dfc28d;
    font-weight: 700;
    font-size: 14px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .operator-status-dot {
    position: absolute;
    bottom: -2px;
    right: -2px;
    width: 9px;
    height: 9px;
    border-radius: 50%;
    background: #10b981;
    border: 2px solid #0a0c14;
    box-shadow: 0 0 6px #10b981;
  }

  .operator-meta {
    display: flex;
    flex-direction: column;
    gap: 3px;
    min-width: 0;
    flex: 1;
  }

  .operator-name {
    font-size: 12.5px;
    font-weight: 700;
    color: #e2e7f2;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .operator-badge {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-size: 9.5px;
    font-weight: 750;
    letter-spacing: 0.05em;
    padding: 2px 7px;
    border-radius: 4px;
    background: rgba(223, 194, 141, 0.12);
    color: #dfc28d;
    border: 1px solid rgba(223, 194, 141, 0.3);
    width: fit-content;
  }

  .operator-badge.role-admin {
    background: rgba(181, 154, 245, 0.14);
    color: #cbb4ff;
    border-color: rgba(181, 154, 245, 0.35);
  }

  /* Navigation Groups */
  .sidebar-nav {
    display: flex;
    flex-direction: column;
    gap: 20px;
    flex: 1;
  }

  .nav-group {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .group-label {
    font-size: 10px;
    font-weight: 700;
    color: #646b80;
    letter-spacing: 0.08em;
    padding: 0 10px 4px;
  }

  .nav-link {
    display: flex;
    align-items: center;
    gap: 11px;
    padding: 9px 12px;
    border-radius: 8px;
    color: #98a2b8;
    font-size: 12.5px;
    font-weight: 550;
    text-decoration: none;
    position: relative;
    transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
    border: 1px solid transparent;
  }

  .nav-link:hover {
    color: #ffffff;
    background: rgba(255, 255, 255, 0.05);
    border-color: rgba(255, 255, 255, 0.05);
  }

  .nav-badge {
    margin-left: auto;
    font-size: 10px;
    font-weight: 750;
    padding: 1px 6px;
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.1);
    color: #cbd5e1;
    line-height: 1.4;
  }

  .nav-badge.alert {
    background: rgba(239, 68, 68, 0.18);
    color: #fca5a5;
    border: 1px solid rgba(239, 68, 68, 0.35);
  }

  .nav-link.active {
    color: #ffffff;
    font-weight: 700;
    background: linear-gradient(90deg, rgba(181, 154, 245, 0.16) 0%, rgba(223, 194, 141, 0.08) 100%);
    border-color: rgba(181, 154, 245, 0.35);
    box-shadow: 0 2px 12px rgba(0, 0, 0, 0.4);
  }

  .nav-link.active::before {
    content: '';
    position: absolute;
    left: 0;
    top: 6px;
    bottom: 6px;
    width: 3px;
    border-radius: 0 3px 3px 0;
    background: linear-gradient(180deg, #dfc28d 0%, #b59af5 100%);
    box-shadow: 0 0 8px rgba(181, 154, 245, 0.5);
  }

  :global(.nav-icon) {
    flex-shrink: 0;
    opacity: 0.75;
    transition: opacity 0.2s ease;
  }

  .nav-link:hover :global(.nav-icon),
  .nav-link.active :global(.nav-icon) {
    opacity: 1;
    color: #dfc28d;
  }

  .nav-link.active :global(.nav-icon) {
    color: #b59af5;
  }

  .nav-group-bottom {
    margin-top: auto;
    padding-top: 14px;
    border-top: 1px solid rgba(255, 255, 255, 0.06);
  }

  .public-link {
    color: #7b8396;
    border: 1px dashed rgba(255, 255, 255, 0.08);
  }

  .public-link:hover {
    color: #dfc28d;
    border-color: rgba(223, 194, 141, 0.3);
    background: rgba(223, 194, 141, 0.05);
  }

  /* Main Workspace Area */
  .admin-content {
    padding: 36px 40px 70px;
    min-width: 0;
  }

  /* Responsive Breakpoints (< 950px) */
  @media (max-width: 950px) {
    .admin-shell {
      grid-template-columns: 1fr;
    }

    .mobile-admin-header {
      display: block;
    }

    .drawer-close-btn {
      display: flex;
      position: absolute;
      top: 0;
      right: 0;
    }

    .sidebar-header {
      position: relative;
    }

    .mobile-backdrop {
      display: block;
    }

    .admin-sidebar {
      position: fixed;
      top: 0;
      bottom: 0;
      left: 0;
      width: 280px;
      max-width: 85vw;
      z-index: 50;
      transform: translateX(-100%);
      transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1);
      box-shadow: 8px 0 32px rgba(0, 0, 0, 0.85);
      overflow-y: auto;
      background: #090a12;
      border-right: 1px solid rgba(255, 255, 255, 0.1);
      padding: 24px 18px;
    }

    .admin-sidebar.open {
      transform: translateX(0);
    }

    .admin-content {
      padding: 24px 20px 60px;
    }
  }

  @media (max-width: 480px) {
    .admin-content {
      padding: 20px 14px 50px;
    }
  }
</style>
