<script lang="ts">
  import { onMount } from 'svelte';
  import { afterNavigate } from '$app/navigation';
  import { page } from '$app/state';
  import {
    LayoutDashboard,
    BookOpen,
    Tags,
    ShoppingBag,
    Palette,
    Tag,
    Crown,
    ImageIcon,
    Activity,
    Radio,
    Compass,
    Flame,
    Layers,
    ListOrdered,
    AlertOctagon,
    AlertTriangle,
    Gauge,
    Users,
    ShieldAlert,
    UserCheck,
    Settings,
    Server,
    ChevronDown,
    ChevronRight,
    ArrowUpRight,
    Menu,
    X,
    Shield,
    Sparkles,
    FileEdit,
    Code,
    Headphones,
    Scan,
    Flag,
    Trophy,
    Ticket,
    FileCheck
  } from '@lucide/svelte';
  import UserAvatar from '$lib/components/UserAvatar.svelte';

  let { data, children } = $props();

  let mobileDrawerOpen = $state(false);
  let currentPath = $derived(page.url.pathname);
  let currentTab = $derived(page.url.searchParams.get('tab') || '');
  let activeImporterTab = $state(page.url.searchParams.get('tab') || 'resumo');

  const sectionLabel = $derived.by(() => {
    if (currentPath === '/admin') return 'Início';
    if (currentPath.startsWith('/admin/tickets')) {
      if (currentTab === 'scans') return 'Inscrições';
      if (currentTab === 'moderacao') return 'Moderação';
      return 'Relatórios';
    }
    if (currentPath.startsWith('/admin/obras')) return 'Obras';
    if (currentPath.startsWith('/admin/tags')) return 'Tags';
    if (currentPath.startsWith('/admin/loja')) return 'Loja';
    if (currentPath.startsWith('/admin/importer')) return 'Importer';
    if (currentPath.startsWith('/admin/rankings')) return 'Rankings';
    if (currentPath.startsWith('/admin/scans')) return 'Scans';
    if (currentPath.startsWith('/admin/staff')) return 'Staff';
    if (currentPath.startsWith('/admin/health') || currentPath.startsWith('/admin/sistema')) return 'Sistema';
    if (currentPath.startsWith('/admin/gestao')) return 'Gestão';
    return currentPath.replace(/^\/admin\/?/, '').replace(/\//g, ' / ') || 'Painel';
  });

  // Role & Capabilities
  let role = $derived((data.role || 'LEITOR').toUpperCase());
  let isAdmin = $derived(role === 'ADMIN');
  let isOwnerOrAdmin = $derived(role === 'ADMIN' || role === 'GERENTE');
  let canViewOverview = $derived(true);
  let canViewTickets = $derived(true);
  let canManageWorks = $derived(true);
  let canManageTags = $derived(true);
  let canManageShop = $derived(isOwnerOrAdmin);
  let canViewImporter = $derived(true);
  let canManageMembers = $derived(isAdmin);
  // Global Scan Management is an ADMIN-only route.
  let canManageScans = $derived(isAdmin);
  let canViewStaff = $derived(isOwnerOrAdmin);
  let canViewSystem = $derived(isAdmin);
  let canManageConfig = $derived(isAdmin);

  // Role metadata
  const roleMeta = $derived.by(() => {
    switch (role) {
      case 'ADMIN':
        return { label: 'Admin Geral', badgeClass: 'badge-admin', icon: Shield };
      case 'GERENTE':
        return { label: 'Gerente', badgeClass: 'badge-gerente', icon: Sparkles };
      case 'DEVELOPER':
        return { label: 'Developer', badgeClass: 'badge-dev', icon: Code };
      case 'EDITOR':
        return { label: 'Editor', badgeClass: 'badge-gerente', icon: FileEdit };
      case 'SUPORTE':
        return { label: 'Suporte', badgeClass: 'badge-suporte', icon: Headphones };
      default:
        return { label: 'Staff Site', badgeClass: 'badge-staff', icon: Shield };
    }
  });

  // Collapsible category state with localStorage persistence
  let collapsed = $state<Record<string, boolean>>({});

  onMount(() => {
    try {
      const saved = localStorage.getItem('nox_admin_sidebar_collapsed');
      if (saved) {
        collapsed = JSON.parse(saved);
      }
    } catch {
      /* ignore */
    }
    const syncImporterTab = (event: Event) => {
      activeImporterTab = (event as CustomEvent<string>).detail || 'resumo';
    };
    window.addEventListener('nox:importer-tab', syncImporterTab);

    // --- GESTURE NAVIGATION FOR MOBILE SIDEBAR ---
    let startX = 0;
    let startY = 0;
    let isTracking = false;
    let isEdgeSwipe = false;

    const EDGE_THRESHOLD = 45; // px from the left edge of viewport
    const MIN_SWIPE_DISTANCE = 50; // px
    const HORIZONTAL_BIAS = 1.5; // horizontal movement must dominate vertical

    function isInteractiveOrScrollable(el: HTMLElement | null): boolean {
      if (!el || typeof el.closest !== 'function') return false;
      return Boolean(
        el.closest(
          'input, textarea, select, [contenteditable="true"], .table-responsive, .table-container, .horizontal-scroll, pre, code'
        )
      );
    }

    function onTouchStart(e: TouchEvent) {
      if (e.touches.length !== 1) return;
      const touch = e.touches[0];
      startX = touch.clientX;
      startY = touch.clientY;

      if (!mobileDrawerOpen) {
        // Only start tracking if gesture begins near left viewport edge
        if (startX <= EDGE_THRESHOLD) {
          const target = e.target as HTMLElement;
          if (!isInteractiveOrScrollable(target)) {
            isTracking = true;
            isEdgeSwipe = true;
          }
        }
      } else {
        // When drawer is open, any swipe to the left on sidebar or backdrop closes it
        isTracking = true;
        isEdgeSwipe = false;
      }
    }

    function onTouchEnd(e: TouchEvent) {
      if (!isTracking) return;
      isTracking = false;

      if (e.changedTouches.length === 0) return;
      const touch = e.changedTouches[0];
      const deltaX = touch.clientX - startX;
      const deltaY = touch.clientY - startY;
      const absX = Math.abs(deltaX);
      const absY = Math.abs(deltaY);

      if (absX >= MIN_SWIPE_DISTANCE && absX > absY * HORIZONTAL_BIAS) {
        if (!mobileDrawerOpen && isEdgeSwipe && deltaX > 0) {
          // Swipe right from left edge -> OPEN drawer
          mobileDrawerOpen = true;
        } else if (mobileDrawerOpen && deltaX < 0) {
          // Swipe left -> CLOSE drawer
          mobileDrawerOpen = false;
        }
      }
    }

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && mobileDrawerOpen) {
        closeMobile();
      }
    }

    window.addEventListener('touchstart', onTouchStart, { passive: true });
    window.addEventListener('touchend', onTouchEnd, { passive: true });
    window.addEventListener('keydown', onKeyDown);

    return () => {
      window.removeEventListener('nox:importer-tab', syncImporterTab);
      window.removeEventListener('touchstart', onTouchStart);
      window.removeEventListener('touchend', onTouchEnd);
      window.removeEventListener('keydown', onKeyDown);
    };
  });

  afterNavigate(() => {
    mobileDrawerOpen = false;
  });

  function toggleCategory(cat: string) {
    collapsed[cat] = !collapsed[cat];
    try {
      localStorage.setItem('nox_admin_sidebar_collapsed', JSON.stringify(collapsed));
    } catch {
      /* ignore */
    }
  }

  function isCategoryOpen(cat: string, paths: string[]): boolean {
    // On a phone the drawer is a navigation sheet, not an accordion maze:
    // expose every permitted destination as soon as it opens.
    if (mobileDrawerOpen) return true;
    if (paths.some(p => isActive(p))) return true;
    return !collapsed[cat];
  }

  function isActive(path: string, exact = false, tabParam?: string) {
    if (path === '/admin/tickets') {
      const isTicketsRoute = currentPath === '/admin/tickets' || currentPath === '/admin/reports' || currentPath === '/admin/relatorios';
      if (!isTicketsRoute) return false;
      if (tabParam === 'relatorios') {
        return currentTab === 'relatorios' || !currentTab;
      }
      return currentTab === tabParam;
    }
    if (tabParam !== undefined) {
      const isBase = currentPath === path || currentPath.startsWith(path + '/');
      return isBase && currentTab === tabParam;
    }
    if (exact) {
      if (path === '/admin') return currentPath === '/admin';
      if (path === '/admin/importer') return currentPath === '/admin/importer' && !currentTab;
      if (path === '/admin/loja') return currentPath === '/admin/loja' && !currentTab;
      return currentPath === path;
    }
    if (path === '/scan') return currentPath.startsWith('/scan');
    return currentPath === path || currentPath.startsWith(path + '/');
  }

  function closeMobile() {
    mobileDrawerOpen = false;
  }

  function selectImporterTab(event: MouseEvent, tab: string) {
    closeMobile();
    if (currentPath !== '/admin/importer') return;
    event.preventDefault();
    activeImporterTab = tab;
    window.dispatchEvent(new CustomEvent('nox:importer-tab', { detail: tab }));
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
    <!-- Sidebar Header & Brand -->
    <div class="sidebar-header">
      <div class="brand-cluster">
        <img
          src="/brand/nox-symbol-64.webp"
          alt="Project Nox"
          width="34"
          height="34"
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
        aria-label="Fechar menu"
        onclick={closeMobile}
      >
        <X size={18} />
      </button>

      <!-- Operator Identity Card -->
      <div class="operator-card">
        <div class="operator-avatar">
          <UserAvatar
            user={data.profile}
            avatarId={data.profile?.avatar_id || data.profile?.avatarId}
            displayName={data.profile?.display_name || data.profile?.displayName || role || 'Operador Nox'}
            crop={data.profile?.avatar_crop}
            frameId={data.profile?.avatar_frame_id}
            size={36}
            loading="eager"
          />
          <span class="operator-status-dot"></span>
        </div>

        <div class="operator-meta">
          <span class="operator-name" title={data.profile?.display_name || data.profile?.displayName || 'Operador Nox'}>
            {data.profile?.display_name || data.profile?.displayName || 'Operador Nox'}
          </span>
          <span class="operator-badge {roleMeta.badgeClass}">
            {#snippet roleIcon()}
              {@const Icon = roleMeta.icon}
              <Icon size={11} />
            {/snippet}
            {@render roleIcon()}
            <span>{roleMeta.label}</span>
          </span>
        </div>
      </div>
    </div>

    <!-- Grouped Admin Navigation -->
    <nav class="sidebar-nav" aria-label="Navegação administrativa">
      <!-- 1. GERAL -->
      {#if canViewOverview}
        <div class="nav-category">
          <button
            type="button"
            class="category-toggle"
            onclick={() => toggleCategory('geral')}
          >
            <span class="category-label">GERAL</span>
            {#if isCategoryOpen('geral', ['/admin', '/scan', '/admin/scans'])}
              <ChevronDown size={14} />
            {:else}
              <ChevronRight size={14} />
            {/if}
          </button>

          {#if isCategoryOpen('geral', ['/admin', '/scan', '/admin/scans'])}
            <div class="category-links">
              <a
                href="/admin"
                class="nav-link"
                class:active={isActive('/admin', true)}
                onclick={closeMobile}
              >
                <LayoutDashboard size={16} class="nav-icon" />
                <span>Início</span>
              </a>
              {#if data.userScans && data.userScans.length > 0}
                <a
                  href="/scan?id={data.userScans[0].id}"
                  class="nav-link"
                  class:active={isActive('/scan')}
                  onclick={closeMobile}
                >
                  <Scan size={16} class="nav-icon" />
                  <span>Minha Scan</span>
                </a>
              {:else if isOwnerOrAdmin}
                <a
                  href="/admin/scans"
                  class="nav-link"
                  class:active={isActive('/admin/scans')}
                  onclick={closeMobile}
                >
                  <Scan size={16} class="nav-icon" />
                  <span>Minha Scan</span>
                </a>
              {/if}
            </div>
          {/if}
        </div>
      {/if}

      <!-- 2. TICKETS -->
      {#if canViewTickets}
        <div class="nav-category">
          <button
            type="button"
            class="category-toggle"
            onclick={() => toggleCategory('tickets')}
          >
            <div class="category-title-group">
              <span class="category-label">TICKETS</span>
              {#if (data.totalTicketsCount ?? 0) > 0}
                <span class="category-badge alert">{(data.totalTicketsCount ?? 0)}</span>
              {/if}
            </div>
            {#if isCategoryOpen('tickets', ['/admin/tickets', '/admin/reports', '/admin/relatorios'])}
              <ChevronDown size={14} />
            {:else}
              <ChevronRight size={14} />
            {/if}
          </button>

          {#if isCategoryOpen('tickets', ['/admin/tickets', '/admin/reports', '/admin/relatorios'])}
            <div class="category-links">
              <a
                href="/admin/tickets?tab=relatorios"
                class="nav-link"
                class:active={isActive('/admin/tickets', false, 'relatorios')}
                onclick={closeMobile}
              >
                <Flag size={16} class="nav-icon" />
                <span>Relatórios</span>
                {#if (data.pendingReportsCount ?? 0) > 0}
                  <span class="nav-badge alert">{(data.pendingReportsCount ?? 0)}</span>
                {/if}
              </a>

              {#if isAdmin}
                <a
                  href="/admin/tickets?tab=scans"
                  class="nav-link"
                  class:active={isActive('/admin/tickets', false, 'scans')}
                  onclick={closeMobile}
                >
                  <FileCheck size={16} class="nav-icon" />
                  <span>Inscrições de Scans</span>
                  {#if (data.pendingScansCount ?? 0) > 0}
                    <span class="nav-badge alert">{(data.pendingScansCount ?? 0)}</span>
                  {/if}
                </a>

                <a
                  href="/admin/tickets?tab=moderacao"
                  class="nav-link"
                  class:active={isActive('/admin/tickets', false, 'moderacao')}
                  onclick={closeMobile}
                >
                  <ShieldAlert size={16} class="nav-icon" />
                  <span>Moderação</span>
                  {#if (data.pendingModerationCount ?? 0) > 0}
                    <span class="nav-badge alert">{(data.pendingModerationCount ?? 0)}</span>
                  {/if}
                </a>
              {/if}
            </div>
          {/if}
        </div>
      {/if}

      <!-- 3. CONTEÚDO -->
      {#if canManageWorks || canManageTags}
        <div class="nav-category">
          <button
            type="button"
            class="category-toggle"
            onclick={() => toggleCategory('conteudo')}
          >
            <span class="category-label">CONTEÚDO</span>
            {#if isCategoryOpen('conteudo', ['/admin/obras', '/admin/tags'])}
              <ChevronDown size={14} />
            {:else}
              <ChevronRight size={14} />
            {/if}
          </button>

          {#if isCategoryOpen('conteudo', ['/admin/obras', '/admin/tags'])}
            <div class="category-links">
              {#if canManageWorks}
                <a
                  href="/admin/obras"
                  class="nav-link"
                  class:active={isActive('/admin/obras')}
                  onclick={closeMobile}
                >
                  <BookOpen size={16} class="nav-icon" />
                  <span>Obras</span>
                </a>
              {/if}
              {#if canManageTags}
                <a
                  href="/admin/tags"
                  class="nav-link"
                  class:active={isActive('/admin/tags')}
                  onclick={closeMobile}
                >
                  <Tags size={16} class="nav-icon" />
                  <span>Gêneros & Tags</span>
                </a>
              {/if}
            </div>
          {/if}
        </div>
      {/if}

      <!-- 3. LOJA -->
      {#if canManageShop}
        <div class="nav-category">
          <button
            type="button"
            class="category-toggle"
            onclick={() => toggleCategory('loja')}
          >
            <span class="category-label">LOJA</span>
            {#if isCategoryOpen('loja', ['/admin/loja'])}
              <ChevronDown size={14} />
            {:else}
              <ChevronRight size={14} />
            {/if}
          </button>

          {#if isCategoryOpen('loja', ['/admin/loja'])}
            <div class="category-links">
              <a
                href="/admin/loja"
                class="nav-link"
                class:active={isActive('/admin/loja', true)}
                onclick={closeMobile}
              >
                <ShoppingBag size={16} class="nav-icon" />
                <span>Resumo</span>
              </a>
              <a
                href="/admin/loja?tab=cores"
                class="nav-link"
                class:active={isActive('/admin/loja', false, 'cores')}
                onclick={closeMobile}
              >
                <Palette size={16} class="nav-icon" />
                <span>Cores</span>
              </a>
              <a
                href="/admin/loja?tab=titulos"
                class="nav-link"
                class:active={isActive('/admin/loja', false, 'titulos')}
                onclick={closeMobile}
              >
                <Tag size={16} class="nav-icon" />
                <span>Títulos</span>
              </a>
              <a
                href="/admin/loja?tab=molduras"
                class="nav-link"
                class:active={isActive('/admin/loja', false, 'molduras')}
                onclick={closeMobile}
              >
                <Crown size={16} class="nav-icon" />
                <span>Molduras</span>
              </a>
              <a
                href="/admin/loja?tab=banners"
                class="nav-link"
                class:active={isActive('/admin/loja', false, 'banners')}
                onclick={closeMobile}
              >
                <ImageIcon size={16} class="nav-icon" />
                <span>Banners</span>
              </a>
            </div>
          {/if}
        </div>
      {/if}

      <!-- 4. IMPORTER -->
      {#if canViewImporter}
        <div class="nav-category">
          <button
            type="button"
            class="category-toggle"
            onclick={() => toggleCategory('importer')}
          >
            <span class="category-label">IMPORTER</span>
            {#if isCategoryOpen('importer', ['/admin/importer'])}
              <ChevronDown size={14} />
            {:else}
              <ChevronRight size={14} />
            {/if}
          </button>

          {#if isCategoryOpen('importer', ['/admin/importer'])}
            <div class="category-links">
              <a
                href="/admin/importer"
                class="nav-link"
                class:active={currentPath === '/admin/importer' && activeImporterTab === 'resumo'}
                onclick={(event) => selectImporterTab(event, 'resumo')}
              >
                <Activity size={16} class="nav-icon" />
                <span>Resumo</span>
              </a>
              <a
                href="/admin/importer?tab=fontes"
                class="nav-link"
                class:active={currentPath === '/admin/importer' && activeImporterTab === 'fontes'}
                onclick={(event) => selectImporterTab(event, 'fontes')}
              >
                <Radio size={16} class="nav-icon" />
                <span>Fontes</span>
              </a>
              <a
                href="/admin/importer?tab=atividade"
                class="nav-link"
                class:active={currentPath === '/admin/importer' && activeImporterTab === 'atividade'}
                onclick={(event) => selectImporterTab(event, 'atividade')}
              >
                <Compass size={16} class="nav-icon" />
                <span>Atividade</span>
              </a>
              <a
                href="/admin/importer?tab=erros"
                class="nav-link"
                class:active={currentPath === '/admin/importer' && activeImporterTab === 'erros'}
                onclick={(event) => selectImporterTab(event, 'erros')}
              >
                <AlertOctagon size={16} class="nav-icon" />
                <span>Erros</span>
              </a>
              <a
                href="/admin/importer?tab=cap-min"
                class="nav-link"
                class:active={currentPath === '/admin/importer' && activeImporterTab === 'cap-min'}
                onclick={(event) => selectImporterTab(event, 'cap-min')}
              >
                <Gauge size={16} class="nav-icon" />
                <span>Cap/min</span>
              </a>
              <a
                href="/admin/importer?tab=prioridades"
                class="nav-link"
                class:active={currentPath === '/admin/importer' && activeImporterTab === 'prioridades'}
                onclick={(event) => selectImporterTab(event, 'prioridades')}
              >
                <Flame size={16} class="nav-icon" />
                <span>Prioridades</span>
              </a>
              <a
                href="/admin/importer?tab=proximas-obras"
                class="nav-link"
                class:active={currentPath === '/admin/importer' && activeImporterTab === 'proximas-obras'}
                onclick={(event) => selectImporterTab(event, 'proximas-obras')}
              >
                <Layers size={16} class="nav-icon" />
                <span>Próximas Obras</span>
              </a>
              <a
                href="/admin/importer?tab=proximos-capitulos"
                class="nav-link"
                class:active={currentPath === '/admin/importer' && activeImporterTab === 'proximos-capitulos'}
                onclick={(event) => selectImporterTab(event, 'proximos-capitulos')}
              >
                <ListOrdered size={16} class="nav-icon" />
                <span>Próximos Capítulos</span>
              </a>
              <a
                href="/admin/importer?tab=capitulos-faltando"
                class="nav-link"
                class:active={currentPath === '/admin/importer' && activeImporterTab === 'capitulos-faltando'}
                onclick={(event) => selectImporterTab(event, 'capitulos-faltando')}
              >
                <AlertTriangle size={16} class="nav-icon" />
                <span>Capítulos Faltando</span>
              </a>
            </div>
          {/if}
        </div>
      {/if}

      <!-- 6. ADMINISTRAÇÃO 🔒 (Posicionada no final do menu) -->
      {#if canManageMembers || canManageScans || canViewStaff || canViewSystem || canManageConfig}
        <div class="nav-category">
          <button
            type="button"
            class="category-toggle"
            onclick={() => toggleCategory('administracao')}
          >
            <span class="category-label">ADMINISTRAÇÃO 🔒</span>
            {#if isCategoryOpen('administracao', ['/admin/gestao', '/admin/rankings', '/admin/scans', '/admin/staff', '/admin/health', '/admin/sistema', '/admin/gestao/configuracoes', '/admin/configuracoes'])}
              <ChevronDown size={14} />
            {:else}
              <ChevronRight size={14} />
            {/if}
          </button>

          {#if isCategoryOpen('administracao', ['/admin/gestao', '/admin/rankings', '/admin/scans', '/admin/staff', '/admin/health', '/admin/sistema', '/admin/gestao/configuracoes', '/admin/configuracoes'])}
            <div class="category-links">
              {#if canManageMembers}
                <a
                  href="/admin/gestao"
                  class="nav-link"
                  class:active={isActive('/admin/gestao')}
                  onclick={closeMobile}
                >
                  <Users size={16} class="nav-icon" />
                  <span>Membros</span>
                </a>
              {/if}
              {#if canManageConfig}
                <a
                  href="/admin/rankings"
                  class="nav-link"
                  class:active={isActive('/admin/rankings')}
                  onclick={closeMobile}
                >
                  <Trophy size={16} class="nav-icon" />
                  <span>Rankings & Temporadas</span>
                </a>
              {/if}
              {#if canManageScans}
                <a
                  href="/admin/scans"
                  class="nav-link"
                  class:active={isActive('/admin/scans')}
                  onclick={closeMobile}
                >
                  <Scan size={16} class="nav-icon" />
                  <span>Diretório de Scans</span>
                </a>
              {/if}
              {#if canViewStaff}
                <a
                  href="/admin/staff"
                  class="nav-link"
                  class:active={isActive('/admin/staff')}
                  onclick={closeMobile}
                >
                  <UserCheck size={16} class="nav-icon" />
                  <span>Staff Site</span>
                </a>
              {/if}
              {#if canViewSystem}
                <a
                  href="/admin/health"
                  class="nav-link"
                  class:active={isActive('/admin/health') || isActive('/admin/sistema')}
                  onclick={closeMobile}
                >
                  <Server size={16} class="nav-icon" />
                  <span>Sistema</span>
                </a>
              {/if}
              {#if canManageConfig}
                <a
                  href="/admin/gestao/configuracoes"
                  class="nav-link"
                  class:active={isActive('/admin/gestao/configuracoes') || isActive('/admin/configuracoes')}
                  onclick={closeMobile}
                >
                  <Settings size={16} class="nav-icon" />
                  <span>Configurações</span>
                </a>
              {/if}
            </div>
          {/if}
        </div>
      {/if}

      <!-- Bottom External Link -->
      <div class="sidebar-bottom">
        <a href="/" class="nav-link public-link" target="_blank" rel="noopener noreferrer">
          <ArrowUpRight size={16} class="nav-icon" />
          <span>Ver Site Público</span>
        </a>
      </div>
    </nav>
  </aside>

  <!-- Main Workspace -->
  <main class="admin-content">
    <!-- Mobile Header (Clean, Unified Topbar on Phones & Small Tablets) -->
    <header class="mobile-admin-header">
      <div class="mobile-brand-group">
        <a href="/" class="mobile-brand-link" title="Voltar ao site público">
          <img
            src="/brand/nox-symbol-64.webp"
            alt="Project Nox"
            width="34"
            height="34"
            class="mobile-nox-symbol"
          />
        </a>
        <div class="mobile-brand-titles">
          <span class="mobile-brand-name">PROJECT NOX</span>
          <span class="mobile-brand-sub">Painel de Controle</span>
        </div>
      </div>

      <div class="mobile-header-actions">
        <span class="mobile-section-badge" title={sectionLabel}>
          {sectionLabel}
        </span>

        {#if (data.totalTicketsCount ?? 0) > 0}
          <a
            href="/admin/tickets"
            class="mobile-tickets-alert"
            title="Existem {(data.totalTicketsCount ?? 0)} tickets pendentes de atenção"
          >
            <Ticket size={14} />
            <span>{data.totalTicketsCount}</span>
          </a>
        {/if}

        <button
          type="button"
          class="mobile-drawer-toggle"
          class:is-open={mobileDrawerOpen}
          onclick={() => (mobileDrawerOpen = !mobileDrawerOpen)}
          aria-label={mobileDrawerOpen ? 'Fechar menu do painel' : 'Abrir menu do painel'}
        >
          {#if mobileDrawerOpen}
            <X size={18} />
            <span class="mobile-drawer-toggle-label">Fechar</span>
          {:else}
            <Menu size={18} />
            <span class="mobile-drawer-toggle-label">Menu</span>
          {/if}
        </button>
      </div>
    </header>

    <!-- Active Page Content -->
    <div class="admin-page-container">
      {@render children()}
    </div>
  </main>
</div>

<style>
  .admin-shell {
    display: grid;
    grid-template-columns: 260px minmax(0, 1fr);
    max-width: 1520px;
    margin: 0 auto;
    min-height: calc(100vh - 78px);
    position: relative;
    padding: 0 16px;
    gap: 24px;
  }

  /* Sidebar */
  .admin-sidebar {
    position: sticky;
    top: 86px;
    height: calc(100vh - 102px);
    display: flex;
    flex-direction: column;
    background: rgba(13, 17, 23, 0.75);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 16px;
    backdrop-filter: blur(12px);
    overflow: hidden;
    z-index: 100;
  }

  .sidebar-header {
    padding: 18px 18px 14px 18px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.06);
    position: relative;
  }

  .brand-cluster {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 14px;
  }

  .sidebar-symbol {
    border-radius: 8px;
  }

  .brand-text {
    display: flex;
    flex-direction: column;
  }

  .brand-editorial {
    font-size: 13.5px;
    font-weight: 850;
    letter-spacing: 0.08em;
    color: #dfc28d;
  }

  .brand-sub {
    font-size: 11px;
    color: #94a3b8;
    font-weight: 550;
  }

  .drawer-close-btn {
    display: none;
    position: absolute;
    top: 16px;
    right: 16px;
    background: rgba(255, 255, 255, 0.06);
    border: 1px solid rgba(255, 255, 255, 0.1);
    color: #94a3b8;
    width: 32px;
    height: 32px;
    border-radius: 8px;
    cursor: pointer;
    align-items: center;
    justify-content: center;
  }

  /* Operator Card */
  .operator-card {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 12px;
    border-radius: 10px;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.06);
  }

  .operator-avatar {
    position: relative;
    width: 34px;
    height: 34px;
    flex-shrink: 0;
  }

  .avatar-img {
    width: 100%;
    height: 100%;
    border-radius: 50%;
    object-fit: cover;
  }

  .avatar-fallback {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    height: 100%;
    border-radius: 50%;
    background: #1e293b;
    color: #dfc28d;
    font-size: 13px;
    font-weight: 750;
  }

  .operator-status-dot {
    position: absolute;
    bottom: -1px;
    right: -1px;
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: #22c55e;
    box-shadow: 0 0 6px rgba(34, 197, 94, 0.6);
    border: 1.5px solid #0d1117;
  }

  .operator-meta {
    display: flex;
    flex-direction: column;
    gap: 3px;
    min-width: 0;
  }

  .operator-name {
    font-size: 12.5px;
    font-weight: 700;
    color: #f1f5f9;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .operator-badge {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 2px 6px;
    border-radius: 4px;
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.03em;
    width: fit-content;
  }

  .badge-admin {
    background: rgba(223, 194, 141, 0.15);
    color: #dfc28d;
    border: 1px solid rgba(223, 194, 141, 0.3);
  }
  .badge-gerente {
    background: rgba(168, 85, 247, 0.15);
    color: #c084fc;
    border: 1px solid rgba(168, 85, 247, 0.3);
  }
  .badge-staff {
    background: rgba(56, 189, 248, 0.15);
    color: #38bdf8;
    border: 1px solid rgba(56, 189, 248, 0.3);
  }
  .badge-dev {
    background: rgba(34, 197, 94, 0.15);
    color: #4ade80;
    border: 1px solid rgba(34, 197, 94, 0.3);
  }
  .badge-suporte {
    background: rgba(245, 158, 11, 0.15);
    color: #fbbf24;
    border: 1px solid rgba(245, 158, 11, 0.3);
  }

  /* Navigation */
  .sidebar-nav {
    flex: 1;
    overflow-y: auto;
    padding: 12px;
    display: flex;
    flex-direction: column;
    gap: 12px;
    scrollbar-width: thin;
    scrollbar-color: rgba(255, 255, 255, 0.1) transparent;
  }

  .nav-category {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .category-toggle {
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
    padding: 6px 10px;
    border: none;
    background: transparent;
    color: #64748b;
    font-size: 11px;
    font-weight: 750;
    letter-spacing: 0.06em;
    cursor: pointer;
    border-radius: 6px;
    transition: all 0.15s ease;
  }
  .category-toggle:hover {
    color: #94a3b8;
    background: rgba(255, 255, 255, 0.03);
  }

  .category-title-group {
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }
  .category-badge {
    padding: 1px 6px;
    border-radius: 999px;
    font-size: 10px;
    font-weight: 800;
    line-height: 1.1;
  }
  .category-badge.alert {
    background: rgba(239, 68, 68, 0.22);
    color: #f87171;
    border: 1px solid rgba(239, 68, 68, 0.4);
  }

  .category-links {
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding-left: 2px;
  }

  .nav-link {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 12px;
    border-radius: 8px;
    font-size: 13px;
    font-weight: 600;
    color: #94a3b8;
    text-decoration: none;
    transition: all 0.16s ease;
    border: 1px solid transparent;
  }

  .nav-link:hover {
    color: #f1f5f9;
    background: rgba(255, 255, 255, 0.04);
  }

  .nav-link.active {
    color: #dfc28d;
    background: rgba(223, 194, 141, 0.1);
    border-color: rgba(223, 194, 141, 0.25);
    font-weight: 700;
  }

  :global(.nav-icon) {
    flex-shrink: 0;
    opacity: 0.8;
  }
  .nav-link.active :global(.nav-icon) {
    opacity: 1;
    color: #dfc28d;
  }

  .nav-badge {
    margin-left: auto;
    padding: 1px 6px;
    border-radius: 999px;
    font-size: 10.5px;
    font-weight: 750;
  }
  .nav-badge.alert {
    background: rgba(239, 68, 68, 0.2);
    color: #f87171;
    border: 1px solid rgba(239, 68, 68, 0.35);
  }

  .sidebar-bottom {
    margin-top: auto;
    padding-top: 10px;
    border-top: 1px solid rgba(255, 255, 255, 0.06);
  }

  .public-link {
    color: #64748b;
  }
  .public-link:hover {
    color: #dfc28d;
  }

  /* Content area */
  .admin-content {
    min-width: 0;
    padding: 14px 0 48px 0;
  }

  .admin-page-container {
    min-width: 0;
  }

  /* Mobile Topbar & Layout */
  .mobile-admin-header {
    display: none;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  }

  .mobile-brand-group {
    display: flex;
    align-items: center;
    gap: 10px;
    min-width: 0;
    flex-shrink: 0;
  }

  .mobile-brand-link {
    display: flex;
    align-items: center;
    text-decoration: none;
  }

  .mobile-nox-symbol {
    border-radius: 8px;
    box-shadow: 0 0 10px rgba(223, 194, 141, 0.2);
  }

  .mobile-brand-titles {
    display: flex;
    flex-direction: column;
    justify-content: center;
    line-height: 1.15;
  }

  .mobile-brand-name {
    font-size: 13px;
    font-weight: 850;
    letter-spacing: 0.08em;
    color: #dfc28d;
    white-space: nowrap;
  }

  .mobile-brand-sub {
    font-size: 10.5px;
    color: #94a3b8;
    font-weight: 600;
    letter-spacing: 0.02em;
    white-space: nowrap;
  }

  .mobile-header-actions {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-shrink: 0;
  }

  .mobile-section-badge {
    display: inline-block;
    max-width: 110px;
    padding: 3px 8px;
    border-radius: 6px;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.1);
    color: #cbd5e1;
    font-size: 11px;
    font-weight: 650;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .mobile-tickets-alert {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 4px 8px;
    border-radius: 6px;
    background: rgba(225, 29, 72, 0.15);
    border: 1px solid rgba(225, 29, 72, 0.35);
    color: #fb7185;
    font-size: 11px;
    font-weight: 750;
    text-decoration: none;
  }

  .mobile-drawer-toggle {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    height: 38px;
    padding: 0 12px;
    border-radius: 9px;
    background: rgba(223, 194, 141, 0.12);
    border: 1px solid rgba(223, 194, 141, 0.35);
    color: #dfc28d;
    cursor: pointer;
    transition: all 0.2s ease;
    user-select: none;
  }

  .mobile-drawer-toggle.is-open {
    background: rgba(239, 68, 68, 0.15);
    border-color: rgba(239, 68, 68, 0.4);
    color: #fca5a5;
  }

  .mobile-drawer-toggle-label {
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 0.02em;
    text-transform: uppercase;
  }

  .mobile-drawer-toggle:active {
    transform: scale(0.96);
    background: rgba(223, 194, 141, 0.2);
  }

  @media (max-width: 950px) {
    .admin-shell {
      grid-template-columns: 1fr;
      padding: 0 12px;
      gap: 0;
      min-height: 100vh;
    }

    .mobile-admin-header {
      display: flex;
      position: sticky;
      top: 0;
      z-index: 95;
      min-height: 56px;
      margin: 0 -12px 14px;
      padding: max(8px, env(safe-area-inset-top)) 12px 8px;
      background: #07090f;
      border-bottom: 1px solid rgba(255, 255, 255, 0.08);
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.45);
    }

    .admin-content {
      padding-top: 0;
    }

    .admin-sidebar {
      position: fixed;
      top: 0;
      left: 0;
      bottom: 0;
      width: min(340px, calc(100vw - 32px));
      max-width: 92vw;
      height: 100vh;
      border-radius: 0;
      border: none;
      border-right: 1px solid rgba(255, 255, 255, 0.1);
      transform: translateX(-100%);
      transition: transform 0.24s cubic-bezier(0.16, 1, 0.3, 1);
      z-index: 1000;
      background: #0d1117;
      padding-top: env(safe-area-inset-top);
      padding-bottom: env(safe-area-inset-bottom);
    }

    .admin-sidebar.open {
      transform: translateX(0);
      box-shadow: 10px 0 40px rgba(0, 0, 0, 0.7);
    }

    .drawer-close-btn {
      display: flex;
      width: 40px;
      height: 40px;
    }

    .mobile-backdrop {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.75);
      z-index: 999;
    }

    .nav-link,
    .category-toggle {
      min-height: 44px;
    }

    .sidebar-nav {
      padding-bottom: max(16px, env(safe-area-inset-bottom));
    }
  }

  @media (max-width: 370px) {
    .mobile-section-badge {
      display: none;
    }
  }
</style>
