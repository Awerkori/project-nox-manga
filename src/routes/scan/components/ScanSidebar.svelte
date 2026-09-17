<script lang="ts">
  import {
    Home,
    Layers,
    ListTodo,
    BookOpen,
    Calendar,
    MessageSquare,
    Pin,
    Inbox,
    GraduationCap,
    FileText,
    BookA,
    Link2,
    Users,
    Activity,
    Briefcase,
    Crown,
    Settings,
    Sliders,
    Hash,
    Search,
    ExternalLink,
    ChevronDown,
    X,
    CheckSquare
  } from '@lucide/svelte';
  import UserAvatar from '$lib/components/UserAvatar.svelte';
  import { normalizePositionName, CANONICAL_PIPELINE_STAGES } from '$lib/scan-roles';

  let {
    currentScan,
    myScans = [],
    userRole = 'MEMBER',
    userPositions = [],
    seenStages = [],
    currentUserId = '',
    activeTab = 'home',
    activeStage = 'clean_redraw',
    stages = [],
    chapterStages = [],
    chapters = [],
    onSelectTab,
    unreadNotifications = 0,
    unreadMessages = 0,
    pendingAppsCount = 0,
    openTasksCount = 0,
    mobileOpen = false,
    onCloseMobile,
    onOpenCommandPalette
  } = $props();

  let scanSelectorOpen = $state(false);

  // 7 Canonical stages for editorial workflow in strict order
  const CANONICAL_STAGES = [
    { slug: 'raw', name: 'Raw Provider', icon: '📦', color: '#94a3b8', aliases: ['raw', 'raw provider'] },
    { slug: 'traducao', name: 'Traduo', icon: '🌐', color: '#3b82f6', aliases: ['traducao', 'translation', 'tradutor'] },
    { slug: 'clean_redraw', name: 'Clean/Redraw', icon: '🎨', color: '#ec4899', aliases: ['clean', 'clean_redraw', 'clean/redraw', 'redraw'] },
    { slug: 'typeset', name: 'Typeset', icon: '✒️', color: '#eab308', aliases: ['typeset', 'typer'] },
    { slug: 'revisor_qc', name: 'Revisor (QC)', icon: '🔎', color: '#a855f7', aliases: ['revisor_qc', 'revisao', 'qc', 'revisor (qc)'] },
    { slug: 'pre_aprovado', name: 'Pr Aprovado', icon: '✅', color: '#06b6d4', aliases: ['pre_aprovado', 'ready', 'pronto_pra_upar', 'preview', 'pr aprovado'] },
    { slug: 'publicado', name: 'Publicado', icon: '📚', color: '#22c55e', aliases: ['publicado', 'published'] }
  ];

  function matchesStageSlug(candidate: any, target: string): boolean {
    const s = (typeof candidate === 'string' ? candidate : candidate?.slug || '').toLowerCase().trim();
    const t = target.toLowerCase().trim();
    if (s === t) return true;
    if (t === 'clean' || t === 'clean_redraw' || t === 'clean/redraw') {
      return s === 'clean' || s === 'clean_redraw' || s === 'clean/redraw';
    }
    if (t === 'pre_aprovado' || t === 'ready' || t === 'pronto_pra_upar' || t === 'preview') {
      return s === 'pre_aprovado' || s === 'ready' || s === 'pronto_pra_upar' || s === 'preview' || s === 'pr aprovado';
    }
    if (t === 'traducao' || t === 'translation') {
      return s === 'traducao' || s === 'translation';
    }
    if (t === 'revisor_qc' || t === 'revisao' || t === 'qc') {
      return s === 'revisor_qc' || s === 'revisao' || s === 'qc' || s === 'revisor (qc)';
    }
    if (t === 'publicado' || t === 'published') {
      return s === 'publicado' || s === 'published';
    }
    return false;
  }

  // Strictly unclaimed available / rework count per stage
  let stageAvailableCounts = $derived.by(() => {
    const counts: Record<string, number> = {};
    for (const cSt of CANONICAL_STAGES) counts[cSt.slug] = 0;

    if (chapterStages && chapterStages.length > 0) {
      for (const cs of chapterStages) {
        const slug = cs.stage?.slug || '';
        for (const cSt of CANONICAL_STAGES) {
          if (matchesStageSlug(slug, cSt.slug)) {
            if ((cs.status === 'AVAILABLE' || cs.status === 'REWORK') && !cs.assignedTo) {
              counts[cSt.slug]++;
            }
          }
        }
      }
    }

    if (chapters && chapters.length > 0) {
      const prevCount = chapters.filter((c: any) => ['READY', 'PREVIEW'].includes(c.status)).length;
      counts['pre_aprovado'] = prevCount;
      const pubCount = chapters.filter((c: any) => c.status === 'PUBLISHED').length;
      counts['publicado'] = pubCount;
    }

    return counts;
  });

  function userHoldsRoleForStage(stageSlug: string): boolean {
    if (stageSlug === 'publicado') return false;
    if (matchesStageSlug(stageSlug, 'pre_aprovado')) {
      return userRole === 'OWNER' || userRole === 'ADMIN';
    }
    const stageConfig = CANONICAL_PIPELINE_STAGES.find(s => matchesStageSlug(s.slug, stageSlug));
    if (!stageConfig || !stageConfig.requiredRoleSlug) return false;

    const normalized = userPositions.map((p: any) => {
      if (typeof p === 'string') return normalizePositionName(p);
      return normalizePositionName(p?.slug || p?.name || '');
    });
    return normalized.includes(stageConfig.requiredRoleSlug);
  }

  let seenStageMap = $derived.by(() => {
    const set = new Set<string>();
    if (Array.isArray(seenStages)) {
      for (const s of seenStages) {
        if (s?.chapterStageId) {
          set.add(`${s.chapterStageId}:${s.availabilityVersion ?? 1}`);
        }
      }
    }
    return set;
  });

  let stagePersonalNewCounts = $derived.by(() => {
    const counts: Record<string, number> = {};
    for (const cSt of CANONICAL_STAGES) counts[cSt.slug] = 0;

    if (chapterStages && chapterStages.length > 0) {
      for (const cs of chapterStages) {
        const slug = cs.stage?.slug || '';
        for (const cSt of CANONICAL_STAGES) {
          if (matchesStageSlug(slug, cSt.slug)) {
            if ((cs.status === 'AVAILABLE' || cs.status === 'REWORK') && !cs.assignedTo) {
              if (userHoldsRoleForStage(cSt.slug)) {
                if (matchesStageSlug(cSt.slug, 'revisor_qc') && cs.qcAssigneeId && cs.qcAssigneeId !== currentUserId) {
                  continue;
                }
                const key = `${cs.id}:${cs.availabilityVersion ?? 1}`;
                if (!seenStageMap.has(key)) {
                  counts[cSt.slug]++;
                }
              }
            }
          }
        }
      }
    }
    return counts;
  });

  let totalAvailablePipeline = $derived.by(() => {
    let sum = 0;
    for (const cSt of CANONICAL_STAGES) {
      if (cSt.slug !== 'publicado') {
        sum += stageAvailableCounts[cSt.slug] || 0;
      }
    }
    return sum;
  });

  let pipelineExpanded = $state(
    typeof window !== 'undefined'
      ? localStorage.getItem('nox_pipeline_expanded') !== 'false'
      : true
  );

  function togglePipeline(e: MouseEvent) {
    e.stopPropagation();
    pipelineExpanded = !pipelineExpanded;
    if (typeof window !== 'undefined') {
      localStorage.setItem('nox_pipeline_expanded', String(pipelineExpanded));
    }
  }

  function handlePipelineClick() {
    if (!pipelineExpanded) {
      pipelineExpanded = true;
      if (typeof window !== 'undefined') {
        localStorage.setItem('nox_pipeline_expanded', 'true');
      }
    }
    selectTab('pipeline', activeStage || 'clean_redraw');
  }

  function handleStageClick(stageSlug: string) {
    selectTab('pipeline', stageSlug);
  }

  function selectTab(tab: string, stage?: string) {
    if (onSelectTab) onSelectTab(tab, stage);
    if (onCloseMobile) onCloseMobile();
  }

  function handleScanSwitch(scanId: string) {
    scanSelectorOpen = false;
    window.location.href = `/scan?id=${scanId}`;
  }
</script>

<!-- Backdrop overlay for mobile drawer -->
{#if mobileOpen}
  <div class="sidebar-backdrop" aria-hidden="true" onclick={onCloseMobile}></div>
{/if}

<aside class="workspace-sidebar" class:mobile-open={mobileOpen}>
  <!-- Scan Brand & Switcher Header -->
  <div class="sidebar-header">
    <div class="scan-brand-lockup">
      <div class="scan-avatar">
        {#if currentScan?.logoId}
          <img src="/media/{currentScan.logoId}" alt="" class="scan-logo-img" />
        {:else}
          <div class="scan-logo-fallback">
            {(currentScan?.name || 'S').slice(0, 2).toUpperCase()}
          </div>
        {/if}
      </div>

      <div class="scan-meta">
        <button
          type="button"
          class="scan-switcher-btn"
          aria-expanded={scanSelectorOpen}
          onclick={() => (scanSelectorOpen = !scanSelectorOpen)}
        >
          <span class="scan-name" title={currentScan?.name}>{currentScan?.name || 'Scan Workspace'}</span>
          {#if myScans.length > 1}
            <ChevronDown size={14} class="switcher-arrow" />
          {/if}
        </button>

        <div class="scan-role-lockup">
          <span class="role-pill" class:is-owner={userRole === 'OWNER'} class:is-admin={userRole === 'ADMIN'}>
            {#if userRole === 'OWNER'}
              <Crown size={10} />
              <span>DONO</span>
            {:else if userRole === 'ADMIN'}
              <Crown size={10} />
              <span>ADMIN</span>
            {:else if userRole === 'UPLOADER'}
              <span>UPLOADER</span>
            {:else}
              <span>MEMBRO</span>
            {/if}
          </span>
          <span class="status-indicator-dot" title="Workspace Operacional Ativo"></span>
        </div>
      </div>

      <button type="button" class="mobile-close-btn" aria-label="Fechar menu" onclick={onCloseMobile}>
        <X size={18} />
      </button>
    </div>

    <!-- Scan Switcher Dropdown Menu -->
    {#if scanSelectorOpen && myScans.length > 1}
      <div class="scan-dropdown-menu" role="menu">
        <div class="dropdown-header">MINHAS SCANS</div>
        {#each myScans as s}
          <button
            type="button"
            class="dropdown-item"
            class:active={s.id === currentScan?.id}
            onclick={() => handleScanSwitch(s.id)}
          >
            <span class="scan-item-name">{s.name}</span>
            <span class="scan-item-role">{s.role}</span>
          </button>
        {/each}
      </div>
    {/if}
  </div>

  <!-- Search Shortcut Bar -->
  <div class="sidebar-search-action">
    <button type="button" class="command-palette-btn" onclick={onOpenCommandPalette}>
      <Search size={14} />
      <span>Busca rpida...</span>
      <kbd>Ctrl+K</kbd>
    </button>
  </div>

  <!-- Primary Workspace Navigation -->
  <nav class="sidebar-nav-tree" aria-label="Navegao do workspace">
    <!-- Home Shortcut -->
    <div class="nav-section">
      <button
        type="button"
        class="nav-link-btn"
        class:active={activeTab === 'home'}
        onclick={() => selectTab('home')}
      >
        <Home size={16} class="nav-icon" />
        <span>Incio</span>
      </button>
    </div>

    <!-- Group: PRODUO -->
    <div class="nav-section">
      <div class="section-title">PRODUO</div>

      <button
        type="button"
        class="nav-link-btn"
        class:active={activeTab === 'minha_fila'}
        onclick={() => selectTab('minha_fila')}
      >
        <CheckSquare size={16} class="nav-icon text-amber" />
        <span>Minha Fila</span>
        {#if openTasksCount > 0}
          <span class="nav-badge amber">{openTasksCount}</span>
        {/if}
      </button>

      <!-- Pipeline Expandable Group -->
      <div class="nav-expandable-group" class:is-expanded={pipelineExpanded}>
        <div class="nav-parent-row" class:parent-active={activeTab === 'pipeline'}>
          <button
            type="button"
            class="nav-link-btn nav-parent-main-btn"
            class:active={activeTab === 'pipeline'}
            onclick={handlePipelineClick}
          >
            <Layers size={16} class="nav-icon text-purple" />
            <span>Pipeline</span>
            {#if totalAvailablePipeline > 0}
              <span class="nav-badge purple total-pipeline-badge">{totalAvailablePipeline}</span>
            {/if}
          </button>
          <button
            type="button"
            class="nav-chevron-toggle-btn"
            onclick={togglePipeline}
            aria-label={pipelineExpanded ? "Recolher etapas do Pipeline" : "Expandir etapas do Pipeline"}
            title={pipelineExpanded ? "Recolher etapas" : "Expandir etapas"}
          >
            <span class="chevron-rotator" class:is-collapsed={!pipelineExpanded}>
              <ChevronDown size={14} />
            </span>
          </button>
        </div>

        <!-- Subcategories / Stages -->
        {#if pipelineExpanded}
          <div class="nav-subcategories-tree">
            {#each CANONICAL_STAGES as st}
              {@const isStageSelected = activeTab === 'pipeline' && (activeStage === st.slug || (st.aliases && st.aliases.includes(activeStage)))}
              {@const availCount = stageAvailableCounts[st.slug] || 0}
              {@const personalNew = stagePersonalNewCounts[st.slug] || 0}
              <button
                type="button"
                class="nav-sub-btn"
                class:active={isStageSelected}
                onclick={() => handleStageClick(st.slug)}
              >
                <span class="sub-stage-icon" aria-hidden="true">{st.icon}</span>
                <span class="sub-stage-title">{st.name}</span>
                {#if personalNew > 0}
                  <span class="nav-sub-personal-badge" title="{personalNew} captulos novos para voc">✨ {personalNew}</span>
                {:else if availCount > 0}
                  <span class="nav-sub-badge">{availCount}</span>
                {/if}
              </button>
            {/each}
          </div>
        {/if}
      </div>

      <button
        type="button"
        class="nav-link-btn"
        class:active={activeTab === 'capitulos' || activeTab === 'obras'}
        onclick={() => selectTab('obras')}
      >
        <BookOpen size={16} class="nav-icon" />
        <span>Obras da Scan</span>
      </button>

      <button
        type="button"
        class="nav-link-btn"
        class:active={activeTab === 'calendario'}
        onclick={() => selectTab('calendario')}
      >
        <Calendar size={16} class="nav-icon" />
        <span>Calendrio</span>
      </button>
    </div>

    <!-- Group: COMUNICAO -->
    <div class="nav-section">
      <div class="section-title">COMUNICAO</div>

      <button
        type="button"
        class="nav-link-btn"
        class:active={activeTab === 'chat'}
        onclick={() => selectTab('chat')}
      >
        <MessageSquare size={16} class="nav-icon text-cyan" />
        <span>Chat</span>
        {#if unreadMessages > 0}
          <span class="nav-badge cyan">{unreadMessages}</span>
        {/if}
      </button>

      <button
        type="button"
        class="nav-link-btn"
        class:active={activeTab === 'mural'}
        onclick={() => selectTab('mural')}
      >
        <Pin size={16} class="nav-icon text-rose" />
        <span>Mural</span>
      </button>

      <button
        type="button"
        class="nav-link-btn"
        class:active={activeTab === 'inbox'}
        onclick={() => selectTab('inbox')}
      >
        <Inbox size={16} class="nav-icon" />
        <span>Notificaes</span>
        {#if unreadNotifications > 0}
          <span class="nav-badge alert">{unreadNotifications}</span>
        {/if}
      </button>
    </div>

    <!-- Group: CONHECIMENTO -->
    <div class="nav-section">
      <div class="section-title">CONHECIMENTO</div>

      <button
        type="button"
        class="nav-link-btn"
        class:active={activeTab === 'tutoriais'}
        onclick={() => selectTab('tutoriais')}
      >
        <GraduationCap size={16} class="nav-icon text-gold" />
        <span>Tutoriais</span>
      </button>

      <button
        type="button"
        class="nav-link-btn"
        class:active={activeTab === 'wiki'}
        onclick={() => selectTab('wiki')}
      >
        <FileText size={16} class="nav-icon" />
        <span>Wiki</span>
      </button>

      <button
        type="button"
        class="nav-link-btn"
        class:active={activeTab === 'glossario'}
        onclick={() => selectTab('glossario')}
      >
        <BookA size={16} class="nav-icon" />
        <span>Glossrio</span>
      </button>

      <button
        type="button"
        class="nav-link-btn"
        class:active={activeTab === 'referencias'}
        onclick={() => selectTab('referencias')}
      >
        <Link2 size={16} class="nav-icon" />
        <span>Referncias</span>
      </button>
    </div>

    <!-- Group: EQUIPE -->
    <div class="nav-section">
      <div class="section-title">EQUIPE</div>

      <button
        type="button"
        class="nav-link-btn"
        class:active={activeTab === 'membros'}
        onclick={() => selectTab('membros')}
      >
        <Users size={16} class="nav-icon" />
        <span>Membros</span>
      </button>

      <button
        type="button"
        class="nav-link-btn"
        class:active={activeTab === 'workload'}
        onclick={() => selectTab('workload')}
      >
        <Activity size={16} class="nav-icon" />
        <span>Carga de Trabalho</span>
      </button>

      <button
        type="button"
        class="nav-link-btn"
        class:active={activeTab === 'recrutamento'}
        onclick={() => selectTab('recrutamento')}
      >
        <Briefcase size={16} class="nav-icon" />
        <span>Recrutamento</span>
      </button>

      {#if ['OWNER', 'ADMIN'].includes(userRole)}
        <button
          type="button"
          class="nav-link-btn"
          class:active={activeTab === 'candidaturas'}
          onclick={() => selectTab('candidaturas')}
        >
          <Users size={16} class="nav-icon" />
          <span>Candidaturas</span>
          {#if pendingAppsCount > 0}
            <span class="nav-badge alert">{pendingAppsCount}</span>
          {/if}
        </button>
      {/if}
    </div>

    <!-- Group: GESTO (Owner & Admin only) -->
    {#if ['OWNER', 'ADMIN'].includes(userRole)}
      <div class="nav-section">
        <div class="section-title">GESTO DA SCAN</div>

        <button
          type="button"
          class="nav-link-btn"
          class:active={activeTab === 'canais_config'}
          onclick={() => selectTab('canais_config')}
        >
          <Hash size={16} class="nav-icon" />
          <span>Canais de Chat</span>
        </button>

        <button
          type="button"
          class="nav-link-btn"
          class:active={activeTab === 'settings'}
          onclick={() => selectTab('settings')}
        >
          <Settings size={16} class="nav-icon" />
          <span>Configuraes & Modos</span>
        </button>
      </div>
    {/if}
  </nav>

  <!-- Sidebar Footer External Link -->
  <div class="sidebar-footer">
    <a
      href="/scans/{currentScan?.slug || ''}"
      target="_blank"
      rel="noopener noreferrer"
      class="public-page-link"
    >
      <span>Ver Pgina Pblica</span>
      <ExternalLink size={13} />
    </a>
  </div>
</aside>

<style>
  .workspace-sidebar {
    width: 248px;
    min-width: 248px;
    height: 100vh;
    background: #08060f;
    border-right: 1px solid rgba(255, 255, 255, 0.07);
    display: flex;
    flex-direction: column;
    position: sticky;
    top: 0;
    z-index: 40;
    user-select: none;
  }

  .sidebar-header {
    padding: 16px 14px 12px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.05);
    position: relative;
  }

  .scan-brand-lockup {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .scan-avatar {
    width: 36px;
    height: 36px;
    border-radius: 8px;
    overflow: hidden;
    background: #151221;
    display: flex;
    align-items: center;
    justify-content: center;
    border: 1px solid rgba(255, 255, 255, 0.1);
    flex-shrink: 0;
  }

  .scan-logo-img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .scan-logo-fallback {
    font-size: 13px;
    font-weight: 700;
    color: #dfc28d;
  }

  .scan-meta {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 3px;
  }

  .scan-switcher-btn {
    all: unset;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 4px;
    width: 100%;
  }

  .scan-name {
    font-size: 14px;
    font-weight: 700;
    color: #f1f5f9;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    letter-spacing: -0.01em;
  }

  .switcher-arrow {
    color: #94a3b8;
    flex-shrink: 0;
  }

  .scan-role-lockup {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .role-pill {
    display: inline-flex;
    align-items: center;
    gap: 3px;
    font-size: 9.5px;
    font-weight: 700;
    letter-spacing: 0.04em;
    padding: 1px 5px;
    border-radius: 4px;
    background: rgba(255, 255, 255, 0.06);
    color: #94a3b8;
  }

  .role-pill.is-owner {
    background: rgba(223, 194, 141, 0.15);
    color: #dfc28d;
    border: 1px solid rgba(223, 194, 141, 0.3);
  }

  .role-pill.is-admin {
    background: rgba(139, 92, 246, 0.15);
    color: #a78bfa;
    border: 1px solid rgba(139, 92, 246, 0.3);
  }

  .status-indicator-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: #10b981;
    box-shadow: 0 0 6px #10b981;
  }

  .mobile-close-btn {
    display: none;
    all: unset;
    cursor: pointer;
    color: #94a3b8;
    padding: 4px;
  }

  /* Scan Switcher Dropdown */
  .scan-dropdown-menu {
    position: absolute;
    top: calc(100% + 4px);
    left: 12px;
    right: 12px;
    background: #120e1f;
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 8px;
    padding: 6px;
    z-index: 50;
    box-shadow: 0 10px 25px rgba(0, 0, 0, 0.6);
  }

  .dropdown-header {
    font-size: 10px;
    font-weight: 700;
    color: #64748b;
    letter-spacing: 0.06em;
    padding: 4px 8px;
  }

  .dropdown-item {
    all: unset;
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: calc(100% - 16px);
    padding: 6px 8px;
    border-radius: 6px;
    cursor: pointer;
    font-size: 12.5px;
    color: #cbd5e1;
    transition: background 0.12s;
  }

  .dropdown-item:hover {
    background: rgba(255, 255, 255, 0.06);
    color: #fff;
  }

  .dropdown-item.active {
    background: rgba(139, 92, 246, 0.2);
    color: #c4b5fd;
    font-weight: 600;
  }

  .scan-item-role {
    font-size: 10px;
    color: #94a3b8;
  }

  /* Command Palette Button */
  .sidebar-search-action {
    padding: 10px 12px;
  }

  .command-palette-btn {
    all: unset;
    display: flex;
    align-items: center;
    gap: 8px;
    width: calc(100% - 16px);
    padding: 6px 8px;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: 6px;
    color: #64748b;
    font-size: 12px;
    cursor: pointer;
    transition: all 0.15s;
  }

  .command-palette-btn:hover {
    background: rgba(255, 255, 255, 0.06);
    border-color: rgba(255, 255, 255, 0.12);
    color: #94a3b8;
  }

  .command-palette-btn kbd {
    margin-left: auto;
    font-size: 10px;
    padding: 1px 4px;
    background: rgba(255, 255, 255, 0.06);
    border-radius: 3px;
    color: #94a3b8;
  }

  /* Nav Tree */
  .sidebar-nav-tree {
    flex: 1;
    overflow-y: auto;
    padding: 4px 8px 16px;
    display: flex;
    flex-direction: column;
    gap: 14px;
  }

  .sidebar-nav-tree::-webkit-scrollbar {
    width: 4px;
  }

  .sidebar-nav-tree::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.08);
    border-radius: 2px;
  }

  .nav-section {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .section-title {
    font-size: 10px;
    font-weight: 700;
    color: #475569;
    letter-spacing: 0.07em;
    padding: 4px 8px 2px;
  }

  .nav-link-btn {
    all: unset;
    display: flex;
    align-items: center;
    gap: 9px;
    padding: 6px 9px;
    border-radius: 6px;
    font-size: 13px;
    color: #94a3b8;
    cursor: pointer;
    transition: all 0.12s ease-in-out;
  }

  .nav-link-btn:hover {
    background: rgba(255, 255, 255, 0.04);
    color: #f1f5f9;
  }

  .nav-link-btn.active {
    background: rgba(139, 92, 246, 0.15);
    color: #f1f5f9;
    font-weight: 600;
  }

  /* Expandable Pipeline Nav Item */
  .nav-expandable-group {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .nav-parent-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    border-radius: 6px;
    transition: background 0.12s ease-in-out;
  }

  .nav-parent-row:hover {
    background: rgba(255, 255, 255, 0.04);
  }

  .nav-parent-row.parent-active {
    background: rgba(139, 92, 246, 0.12);
  }

  .nav-parent-main-btn {
    flex: 1;
    min-width: 0;
  }

  .nav-chevron-toggle-btn {
    all: unset;
    cursor: pointer;
    padding: 6px 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #94a3b8;
    border-radius: 4px;
    transition: all 0.15s ease-in-out;
  }

  .nav-chevron-toggle-btn:hover {
    color: #f1f5f9;
    background: rgba(255, 255, 255, 0.08);
  }

  .chevron-rotator {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    transition: transform 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  }

  .chevron-rotator.is-collapsed {
    transform: rotate(-90deg);
  }

  .nav-subcategories-tree {
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding-left: 14px;
    margin-left: 10px;
    border-left: 1px solid rgba(139, 92, 246, 0.2);
    margin-top: 2px;
    margin-bottom: 4px;
  }

  .nav-sub-btn {
    all: unset;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 5px 8px;
    border-radius: 6px;
    font-size: 12px;
    color: #94a3b8;
    transition: all 0.12s ease-in-out;
  }

  .nav-sub-btn:hover {
    color: #f1f5f9;
    background: rgba(255, 255, 255, 0.04);
  }

  .nav-sub-btn.active {
    color: #fff;
    background: rgba(139, 92, 246, 0.22);
    font-weight: 600;
    box-shadow: inset 0 0 10px rgba(139, 92, 246, 0.2);
  }

  .sub-stage-icon {
    font-size: 13px;
    line-height: 1;
    flex-shrink: 0;
  }

  .sub-stage-title {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .nav-badge {
    margin-left: auto;
    font-size: 10px;
    font-weight: 700;
    padding: 1px 6px;
    border-radius: 10px;
    background: rgba(255, 255, 255, 0.08);
    color: #e2e8f0;
  }

  .nav-badge.alert {
    background: #ef4444;
    color: #fff;
  }

  .nav-badge.amber {
    background: #f59e0b;
    color: #000;
  }

  .nav-badge.cyan {
    background: #06b6d4;
    color: #000;
  }

  .nav-badge.purple {
    background: #8b5cf6;
    color: #fff;
  }

  .nav-sub-badge {
    margin-left: auto;
    font-size: 10px;
    font-weight: 700;
    padding: 1px 6px;
    border-radius: 9999px;
    background: rgba(139, 92, 246, 0.22);
    color: #c4b5fd;
    border: 1px solid rgba(139, 92, 246, 0.35);
    line-height: 1.2;
    min-width: 16px;
    text-align: center;
  }

  .nav-sub-personal-badge {
    margin-left: auto;
    font-size: 10px;
    font-weight: 700;
    padding: 1px 6px;
    border-radius: 9999px;
    background: rgba(245, 158, 11, 0.22);
    color: #fde68a;
    border: 1px solid rgba(245, 158, 11, 0.45);
    line-height: 1.2;
    min-width: 16px;
    text-align: center;
    box-shadow: 0 0 8px rgba(245, 158, 11, 0.2);
  }

  /* Footer */
  .sidebar-footer {
    padding: 10px 12px;
    border-top: 1px solid rgba(255, 255, 255, 0.05);
  }

  .public-page-link {
    display: flex;
    align-items: center;
    justify-content: space-between;
    font-size: 11.5px;
    color: #64748b;
    text-decoration: none;
    padding: 4px 6px;
    border-radius: 5px;
    transition: color 0.12s;
  }

  .public-page-link:hover {
    color: #dfc28d;
  }

  /* Responsive Mobile */
  @media (max-width: 900px) {
    .workspace-sidebar {
      position: fixed;
      top: 0;
      bottom: 0;
      left: 0;
      width: 270px;
      transform: translateX(-100%);
      transition: transform 0.25s cubic-bezier(0.16, 1, 0.3, 1);
      z-index: 60;
    }

    .workspace-sidebar.mobile-open {
      transform: translateX(0);
    }

    .mobile-close-btn {
      display: block;
    }

    .sidebar-backdrop {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.75);
      backdrop-filter: blur(4px);
      z-index: 55;
    }
  }
</style>
