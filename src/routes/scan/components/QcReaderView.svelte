<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { enhance } from '$app/forms';
  import {
    ArrowLeft,
    AlertCircle,
    AlertTriangle,
    CheckCircle2,
    Check,
    ChevronDown,
    ChevronUp,
    ChevronLeft,
    ChevronRight,
    Eye,
    Flag,
    Layers,
    List,
    Maximize,
    Minimize,
    MessageSquare,
    RotateCcw,
    Send,
    Settings,
    Sparkles,
    Trash2,
    User,
    X,
    ZoomIn,
    ZoomOut,
    CheckSquare
  } from '@lucide/svelte';
  import UserAvatar from '$lib/components/UserAvatar.svelte';

  interface Props {
    chapterId: string;
    chapter?: any;
    scan?: any;
    qcIssues?: any[];
    chapterStages?: any[];
    currentUserId?: string;
    userRole?: string;
    onBack?: () => void;
  }

  let {
    chapterId = '',
    chapter = null,
    scan = null,
    qcIssues = [],
    chapterStages = [],
    currentUserId = '',
    userRole = 'MEMBER',
    onBack = () => {}
  }: Props = $props();

  // State
  let loading = $state(true);
  let errorMsg = $state('');
  let manifest = $state<any>(null);
  let currentPage = $state(1);
  let totalPages = $state(0);
  let fitMode = $state<'fit' | 'original'>('fit');
  let sidebarOpen = $state(typeof window !== 'undefined' ? window.innerWidth > 1024 : false);
  let showIssueModal = $state(false);
  let showReworkModal = $state(false);
  let showApproveModal = $state(false);
  let mobileMenuOpen = $state(false);
  let submittingAction = $state(false);
  let toastMsg = $state('');

  $effect(() => {
    if (typeof window !== 'undefined') {
      (window as any).__openQcApproveModal = () => { showApproveModal = true; };
    }
  });

  // Per-page load and error tracking
  let pageLoadingStates = $state<Record<number, boolean>>({});
  let pageErrors = $state<Record<number, boolean>>({});
  let pageRetryKeys = $state<Record<number, number>>({});

  function retryPage(index: number) {
    pageErrors[index] = false;
    pageLoadingStates[index] = true;
    pageRetryKeys[index] = Date.now();
  }

  // Form State for "Apontar erro"
  let issuePageNumber = $state(1);
  let issueRegion = $state('');
  let issueType = $state<'TRANSLATION' | 'CLEAN' | 'TYPE' | 'OTHER'>('TYPE');
  let issueTargetStage = $state<'traducao' | 'clean_redraw' | 'typeset'>('typeset');
  let issueDescription = $state('');

  // IntersectionObserver for active page tracking
  let observer: IntersectionObserver | null = null;
  let scrollContainer: HTMLElement | null = null;

  // Resolve QC Stage for this chapter
  let currentQcStage = $derived.by(() => {
    const chId = chapter?.id || chapterId;
    return chapterStages.find((cs: any) => {
      const matchCh = cs.production_chapter_id === chId || cs.chapter_id === chId || cs.production_chapter_id === chapter?.target_chapter_id;
      const matchStage = cs.stage?.slug === 'revisor_qc' || cs.stage?.slug === 'qc' || cs.stage?.slug === 'revisao';
      return matchCh && matchStage;
    }) || null;
  });

  // Filter issues for this specific chapter
  let chapterQcIssues = $derived.by(() => {
    const chId = chapter?.id || chapterId;
    const targetId = chapter?.target_chapter_id;
    return qcIssues.filter((q: any) => {
      return q.chapter_id === chId || q.production_chapter_id === chId ||
             (targetId && (q.chapter_id === targetId || q.production_chapter_id === targetId));
    });
  });

  let openIssuesCount = $derived(chapterQcIssues.filter((q: any) => q.status === 'OPEN').length);

  // Auto-switch target stage when issue type changes
  $effect(() => {
    if (issueType === 'TRANSLATION') issueTargetStage = 'traducao';
    else if (issueType === 'CLEAN') issueTargetStage = 'clean_redraw';
    else if (issueType === 'TYPE') issueTargetStage = 'typeset';
  });

  function showToast(msg: string) {
    toastMsg = msg;
    setTimeout(() => {
      if (toastMsg === msg) toastMsg = '';
    }, 4000);
  }

  // Load manifest on mount
  async function loadManifest() {
    loading = true;
    errorMsg = '';
    try {
      const targetId = chapter?.id || chapterId;
      const res = await fetch(`/api/scan/production/reader/${targetId}/manifest`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `HTTP ${res.status}: Falha ao obter leitor`);
      }
      const data = await res.json();
      manifest = data;
      totalPages = data.totalPages || (data.pages ? data.pages.length : 0);
      loading = false;
      setupObserver();
    } catch (err: any) {
      errorMsg = err.message || 'Não foi possível carregar as páginas do capítulo.';
      loading = false;
    }
  }

  function setupObserver() {
    if (typeof window === 'undefined') return;
    if (observer) observer.disconnect();

    observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const pageIdx = parseInt(entry.target.getAttribute('data-page-index') || '1', 10);
            if (pageIdx > 0) {
              currentPage = pageIdx;
            }
          }
        });
      },
      {
        root: scrollContainer,
        threshold: 0.25
      }
    );

    // Observe each page after render
    setTimeout(() => {
      const pageElements = document.querySelectorAll('.qc-page-wrapper');
      pageElements.forEach((el) => observer?.observe(el));
    }, 150);
  }

  function scrollToPage(pageIdx: number) {
    const el = document.getElementById(`qc-page-wrap-${pageIdx}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      currentPage = pageIdx;
    }
  }

  function openNewIssueModal(pageIdx?: number) {
    issuePageNumber = pageIdx || currentPage || 1;
    issueRegion = '';
    issueDescription = '';
    showIssueModal = true;
  }

  function parseIssueRegion(desc: string): { region: string; text: string } {
    const match = (desc || '').match(/^\[(.*?)\]\s*(.*)$/s);
    if (match) {
      return { region: match[1], text: match[2] };
    }
    return { region: '', text: desc || '' };
  }

  function handleKeyDown(e: KeyboardEvent) {
    if (showIssueModal || showReworkModal || showApproveModal) {
      if (e.key === 'Escape') {
        showIssueModal = false;
        showReworkModal = false;
        showApproveModal = false;
      }
      return;
    }
    if (e.key === 'Escape') {
      onBack();
      return;
    }
    const target = e.target as HTMLElement;
    if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || (target as any).isContentEditable)) {
      return;
    }
    if (e.key === 'ArrowDown' || e.key === 'ArrowRight' || e.key === 'j') {
      if (currentPage < totalPages) {
        scrollToPage(currentPage + 1);
      }
    } else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft' || e.key === 'k') {
      if (currentPage > 1) {
        scrollToPage(currentPage - 1);
      }
    }
  }

  onMount(() => {
    loadManifest();
    window.addEventListener('keydown', handleKeyDown);
  });

  onDestroy(() => {
    if (observer) observer.disconnect();
    if (typeof window !== 'undefined') {
      window.removeEventListener('keydown', handleKeyDown);
    }
  });
</script>

<div class="qc-reader-root">
  <!-- Top Navigation & Action Bar -->
  <header class="qc-top-bar">
    <div class="qc-bar-left">
      <button
        type="button"
        class="qc-btn-back"
        onclick={onBack}
        title="Voltar para a área de Revisor (QC)"
      >
        <ArrowLeft size={18} />
        <span class="btn-text-desktop">Voltar ao QC</span>
        <span class="btn-text-mobile">Voltar</span>
      </button>

      <div class="qc-header-info">
        <span class="qc-header-badge">QC LEITOR</span>
        <h1 class="qc-header-title">
          {manifest?.workTitle || chapter?.work?.title || 'Céu Distante'}
          <span class="qc-header-ch">Cap. #{manifest?.chapterNumber || chapter?.chapter_number || 84}</span>
        </h1>
      </div>
    </div>

    <!-- Center Page Indicator -->
    <div class="qc-bar-center">
      {#if loading}
        <div class="qc-page-indicator is-loading">
          <span class="loading-dot"></span>
          <span>Carregando...</span>
        </div>
      {:else if totalPages > 0}
        <div class="qc-page-indicator">
          <span class="qc-page-curr">Pág. {currentPage}</span>
          <span class="qc-page-sep">/</span>
          <span class="qc-page-total">{totalPages}</span>
        </div>
      {/if}
    </div>

    <!-- Right Actions: Desktop Full Bar -->
    <div class="qc-bar-right desktop-actions">
      <!-- Toggle Fit Width -->
      <button
        type="button"
        class="qc-icon-btn"
        class:active={fitMode === 'original'}
        onclick={() => fitMode = fitMode === 'fit' ? 'original' : 'fit'}
        title={fitMode === 'fit' ? 'Tamanho real da imagem' : 'Ajustar à largura'}
      >
        {#if fitMode === 'fit'}
          <Maximize size={16} />
        {:else}
          <Minimize size={16} />
        {/if}
      </button>

      <!-- Toggle Observations Sidebar -->
      <button
        type="button"
        class="qc-icon-btn qc-badge-btn"
        class:active={sidebarOpen}
        onclick={() => sidebarOpen = !sidebarOpen}
        title="Apontamentos e Observações"
      >
        <List size={16} />
        {#if openIssuesCount > 0}
          <span class="qc-icon-badge">{openIssuesCount}</span>
        {/if}
      </button>

      <!-- Apontar Erro Button (Primary Accent) -->
      <button
        type="button"
        class="qc-btn-flag"
        onclick={() => openNewIssueModal(currentPage)}
      >
        <Flag size={14} />
        <span>Apontar erro</span>
      </button>

      <!-- Solicit Rework Button -->
      <button
        type="button"
        class="qc-btn-rework"
        onclick={() => showReworkModal = true}
        title="Devolver para correção"
      >
        <RotateCcw size={14} />
        <span class="btn-text-desktop">Solicitar correções</span>
      </button>

      <!-- Approve Button -->
      <button
        type="button"
        class="qc-btn-approve"
        class:btn-disabled={Boolean(manifest?.isIncompleteTypeset)}
        disabled={Boolean(manifest?.isIncompleteTypeset)}
        onclick={() => {
          if (manifest?.isIncompleteTypeset) return;
          showApproveModal = true;
        }}
        title={manifest?.isIncompleteTypeset ? "Aprovação bloqueada: páginas sem falas diagramadas" : "Aprovar qualidade do capítulo"}
      >
        <CheckCircle2 size={14} />
        <span class="btn-text-desktop">Aprovar capítulo</span>
      </button>
    </div>

    <!-- Right Actions: Mobile Compact Bar -->
    <div class="qc-bar-right mobile-actions">
      <button
        type="button"
        class="qc-mob-quick-approve"
        class:btn-disabled={Boolean(manifest?.isIncompleteTypeset)}
        disabled={Boolean(manifest?.isIncompleteTypeset)}
        onclick={() => {
          if (manifest?.isIncompleteTypeset) return;
          showApproveModal = true;
        }}
        title={manifest?.isIncompleteTypeset ? "Aprovação bloqueada: páginas sem falas diagramadas" : "Aprovar capítulo"}
      >
        <CheckCircle2 size={15} />
        <span>Aprovar</span>
      </button>

      <button
        type="button"
        class="qc-mob-menu-btn"
        class:active={mobileMenuOpen}
        onclick={() => mobileMenuOpen = !mobileMenuOpen}
        aria-label="Mais opções"
        title="Opções do leitor"
      >
        <Settings size={17} />
      </button>
    </div>
  </header>

  {#if manifest?.isIncompleteTypeset}
    <div class="qc-reader-incomplete-banner" role="alert">
      <AlertTriangle size={15} class="flex-shrink-0" />
      <span>
        <strong>Material Incompleto:</strong> O pacote contém páginas limpas do Clean/Redraw com balões vazios. As falas da tradução não foram diagramadas. A aprovação está bloqueada.
      </span>
    </div>
  {/if}

  <!-- Mobile Actions Sheet / Dropdown Menu -->
  {#if mobileMenuOpen}
    <div class="qc-mob-menu-backdrop" onclick={() => mobileMenuOpen = false}>
      <div class="qc-mob-menu-sheet" onclick={(e) => e.stopPropagation()}>
        <div class="qc-mob-menu-header">
          <span class="qc-mob-menu-title">Opções do Leitor QC</span>
          <button type="button" class="qc-mob-menu-close" onclick={() => mobileMenuOpen = false}>
            <X size={18} />
          </button>
        </div>
        <div class="qc-mob-menu-items">
          <button
            type="button"
            class="qc-sheet-item"
            onclick={() => { mobileMenuOpen = false; openNewIssueModal(currentPage); }}
          >
            <Flag size={16} class="text-amber-400" />
            <span>Apontar erro na página {currentPage}</span>
          </button>
          <button
            type="button"
            class="qc-sheet-item"
            onclick={() => { mobileMenuOpen = false; sidebarOpen = true; }}
          >
            <List size={16} class="text-purple-400" />
            <span>Ver apontamentos ({openIssuesCount})</span>
          </button>
          <button
            type="button"
            class="qc-sheet-item"
            onclick={() => { fitMode = fitMode === 'fit' ? 'original' : 'fit'; mobileMenuOpen = false; }}
          >
            {#if fitMode === 'fit'}
              <Maximize size={16} class="text-slate-400" />
              <span>Ver em tamanho original</span>
            {:else}
              <Minimize size={16} class="text-slate-400" />
              <span>Ajustar à largura da tela</span>
            {/if}
          </button>
          <button
            type="button"
            class="qc-sheet-item text-red-400"
            onclick={() => { mobileMenuOpen = false; showReworkModal = true; }}
          >
            <RotateCcw size={16} class="text-red-400" />
            <span>Solicitar correções aos responsáveis</span>
          </button>
          <button
            type="button"
            class="qc-sheet-item"
            class:is-disabled={Boolean(manifest?.isIncompleteTypeset)}
            disabled={Boolean(manifest?.isIncompleteTypeset)}
            onclick={() => {
              if (manifest?.isIncompleteTypeset) return;
              mobileMenuOpen = false;
              showApproveModal = true;
            }}
            title={manifest?.isIncompleteTypeset ? "Aprovação bloqueada: páginas sem falas diagramadas" : "Aprovar capítulo"}
          >
            <CheckCircle2 size={16} class={manifest?.isIncompleteTypeset ? "text-zinc-500" : "text-emerald-400"} />
            <span class={manifest?.isIncompleteTypeset ? "text-zinc-500 font-normal" : "text-emerald-400 font-bold"}>
              {manifest?.isIncompleteTypeset ? "Aprovação Bloqueada (Balões Vazios)" : "Aprovar capítulo"}
            </span>
          </button>
        </div>
      </div>
    </div>
  {/if}

  <!-- Main Viewport Body -->
  <div class="qc-viewport-body">
    <!-- Reading Canvas (Manga Scroll) -->
    <main
      class="qc-reading-canvas"
      class:sidebar-open={sidebarOpen}
      bind:this={scrollContainer}
    >
      {#if loading}
        <div class="qc-loading-state">
          <div class="qc-spinner"></div>
          <p class="qc-loading-title">Carregando páginas de revisão...</p>
          <p class="qc-loading-desc">Descompactando o pacote do Typeset e organizando as páginas com alta resolução.</p>
        </div>
      {:else if errorMsg}
        <div class="qc-error-state">
          <AlertCircle size={36} class="qc-error-icon" />
          <h2 class="qc-error-title">Não foi possível abrir o leitor QC</h2>
          <p class="qc-error-desc">{errorMsg}</p>
          <div class="qc-error-actions">
            <button type="button" class="btn-retry" onclick={loadManifest}>
              Tentar novamente
            </button>
            <button type="button" class="btn-back-qc" onclick={onBack}>
              Voltar ao painel
            </button>
          </div>
        </div>
      {:else if manifest && manifest.pages && manifest.pages.length > 0}
        <div class="qc-scroll-strip" class:fit-width={fitMode === 'fit'} class:original-width={fitMode === 'original'}>
          {#each manifest.pages as page, idx (page.index)}
            {@const pageIssues = chapterQcIssues.filter((q: any) => q.page_number === page.index)}
            <div
              id="qc-page-wrap-{page.index}"
              class="qc-page-wrapper"
              data-page-index={page.index}
            >
              <!-- Page Header Banner (Discrete) -->
              <div class="qc-page-meta-bar">
                <span class="qc-page-num-badge">Página {page.index}</span>
                {#if pageIssues.length > 0}
                  <div class="qc-page-issue-badge" onclick={() => sidebarOpen = true}>
                    <Flag size={11} />
                    <span>{pageIssues.length} {pageIssues.length === 1 ? 'problema' : 'problemas'}</span>
                  </div>
                {/if}
                <button
                  type="button"
                  class="qc-btn-flag-page"
                  onclick={() => openNewIssueModal(page.index)}
                  title="Apontar erro nesta página"
                >
                  <Flag size={12} />
                  <span>Apontar erro</span>
                </button>
              </div>

              <!-- Page Image -->
              <div
                class="qc-img-container"
                class:is-loading={pageLoadingStates[page.index] !== false && !pageErrors[page.index]}
                class:has-error={pageErrors[page.index]}
              >
                {#if pageErrors[page.index]}
                  <div class="qc-page-error-box">
                    <AlertTriangle size={36} class="text-amber-400" />
                    <span class="qc-error-title">Falha ao carregar Página {page.index}</span>
                    <span class="qc-error-sub">Não foi possível carregar a imagem. Verifique a conexão e tente novamente.</span>
                    <button
                      type="button"
                      class="btn-retry-page"
                      onclick={() => retryPage(page.index)}
                    >
                      <RotateCcw size={14} />
                      <span>Recarregar página {page.index}</span>
                    </button>
                  </div>
                {:else}
                  {#if pageLoadingStates[page.index] !== false}
                    <div class="qc-page-skeleton">
                      <div class="skeleton-shimmer"></div>
                      <span class="skeleton-label">Carregando Página {page.index}...</span>
                    </div>
                  {/if}
                  <img
                    src="{page.url}{pageRetryKeys[page.index] ? `?retry=${pageRetryKeys[page.index]}` : ''}"
                    alt="Página {page.index}"
                    loading={idx < 2 ? 'eager' : 'lazy'}
                    class="qc-manga-page"
                    class:is-loaded={pageLoadingStates[page.index] === false}
                    onload={() => { pageLoadingStates[page.index] = false; pageErrors[page.index] = false; }}
                    onerror={() => { pageLoadingStates[page.index] = false; pageErrors[page.index] = true; }}
                  />
                {/if}
              </div>
            </div>
          {/each}

          <!-- End of Chapter Review Summary Card -->
          <div class="qc-end-review-card">
            <CheckCircle2 size={32} class="qc-end-icon" />
            <h3 class="qc-end-title">Fim da revisão das {totalPages} páginas</h3>
            <p class="qc-end-desc">
              {#if manifest?.isIncompleteTypeset}
                Nenhum apontamento pendente, mas o material ainda precisa ser finalizado pelo Typeset.
              {:else if openIssuesCount === 0}
                Nenhum problema pendente encontrado. Você pode aprovar o capítulo e encaminhá-lo para a etapa Pré-aprovado.
              {:else}
                Foram identificados <strong>{openIssuesCount} {openIssuesCount === 1 ? 'problema' : 'problemas'}</strong> que precisam de correção antes da aprovação final.
              {/if}
            </p>
            <div class="qc-end-actions">
              {#if openIssuesCount > 0 || manifest?.isIncompleteTypeset}
                <button type="button" class="qc-btn-rework-lg" onclick={() => showReworkModal = true}>
                  <RotateCcw size={16} />
                  <span>Solicitar correções {openIssuesCount > 0 ? `(${openIssuesCount})` : ''}</span>
                </button>
              {/if}
              <button
                type="button"
                class="qc-btn-approve-lg"
                class:btn-disabled={Boolean(manifest?.isIncompleteTypeset)}
                disabled={Boolean(manifest?.isIncompleteTypeset)}
                onclick={() => {
                  if (manifest?.isIncompleteTypeset) return;
                  showApproveModal = true;
                }}
                title={manifest?.isIncompleteTypeset ? "Aprovação bloqueada: páginas sem falas diagramadas" : "Aprovar capítulo"}
              >
                <CheckCircle2 size={16} />
                <span>Aprovar capítulo</span>
              </button>
            </div>
          </div>
          <!-- Clearance Spacer so bottom floating action bar NEVER covers the end review card -->
          <div class="qc-scroll-bottom-spacer" style="height: 150px; width: 100%; flex-shrink: 0;" aria-hidden="true"></div>
        </div>
      {/if}
    </main>

    <!-- Collapsible Observations Sidebar -->
    {#if sidebarOpen}
      <aside class="qc-observations-sidebar">
        <div class="qc-sidebar-header">
          <div class="qc-sidebar-title-row">
            <h2 class="qc-sidebar-title">
              Apontamentos do QC
              <span class="qc-sidebar-count">({chapterQcIssues.length})</span>
            </h2>
            <button
              type="button"
              class="qc-sidebar-close"
              onclick={() => sidebarOpen = false}
              title="Recolher barra lateral"
            >
              <X size={16} />
            </button>
          </div>
          <p class="qc-sidebar-subtitle">Erros mapeados para devolução e conferência.</p>
        </div>

        <!-- Add Issue Quick Action -->
        <div class="qc-sidebar-actions-bar">
          <button
            type="button"
            class="qc-btn-add-issue"
            onclick={() => openNewIssueModal(currentPage)}
          >
            <Flag size={13} />
            <span>Novo apontamento (Pág. {currentPage})</span>
          </button>
        </div>

        <!-- Issue List -->
        <div class="qc-sidebar-list">
          {#if chapterQcIssues.length === 0}
            <div class="qc-sidebar-empty">
              <CheckCircle2 size={24} class="qc-empty-icon" />
              <p class="qc-empty-title">Nenhum erro registrado</p>
              <p class="qc-empty-desc">Conforme navegar pelas páginas, use <strong>Apontar erro</strong> se encontrar algo incorreto.</p>
            </div>
          {:else}
            {#each chapterQcIssues as issue (issue.id)}
              {@const parsed = parseIssueRegion(issue.description)}
              <div
                class="qc-issue-card"
                class:status-open={issue.status === 'OPEN'}
                class:status-resolved={issue.status === 'RESOLVED'}
              >
                <div class="qc-issue-top">
                  <button
                    type="button"
                    class="qc-issue-page-btn"
                    onclick={() => scrollToPage(issue.page_number)}
                    title="Pular para a página {issue.page_number}"
                  >
                    <span>Pág. {issue.page_number}</span>
                  </button>

                  {#if parsed.region}
                    <span class="qc-issue-region-tag">{parsed.region}</span>
                  {/if}

                  <span class="qc-issue-type-badge type-{issue.issue_type?.toLowerCase()}">
                    {issue.issue_type === 'TRANSLATION' ? 'Tradução' :
                     issue.issue_type === 'CLEAN' ? 'Clean' :
                     issue.issue_type === 'TYPE' ? 'Typeset' : 'Geral'}
                  </span>
                </div>

                <p class="qc-issue-desc">{parsed.text}</p>

                <div class="qc-issue-footer">
                  <div class="qc-issue-meta">
                    <span class="qc-issue-status-badge" class:open={issue.status === 'OPEN'}>
                      {issue.status === 'OPEN' ? 'Aberto' :
                       issue.status === 'IN_PROGRESS' ? 'Em correção' :
                       issue.status === 'RESOLVED' ? 'Resolvido' : issue.status}
                    </span>
                  </div>

                  <!-- Actions for this issue -->
                  <div class="qc-issue-card-actions">
                    <form method="POST" action="?/updateQcStatus" use:enhance={() => {
                      return async ({ update }) => {
                        await update();
                        showToast(issue.status === 'OPEN' ? 'Apontamento marcado como resolvido.' : 'Apontamento reaberto.');
                      };
                    }}>
                      <input type="hidden" name="issueId" value={issue.id} />
                      <input type="hidden" name="status" value={issue.status === 'OPEN' ? 'RESOLVED' : 'OPEN'} />
                      <button
                        type="submit"
                        class="btn-toggle-resolve"
                        title={issue.status === 'OPEN' ? 'Marcar como resolvido' : 'Reabrir apontamento'}
                      >
                        {#if issue.status === 'OPEN'}
                          <Check size={13} />
                          <span>Resolver</span>
                        {:else}
                          <RotateCcw size={13} />
                          <span>Reabrir</span>
                        {/if}
                      </button>
                    </form>

                    <form method="POST" action="?/deleteQcIssue" use:enhance={() => {
                      return async ({ update }) => {
                        await update();
                        showToast('Apontamento excluído com sucesso.');
                      };
                    }}>
                      <input type="hidden" name="issueId" value={issue.id} />
                      <button
                        type="submit"
                        class="btn-delete-issue"
                        title="Excluir apontamento"
                      >
                        <Trash2 size={13} />
                      </button>
                    </form>
                  </div>
                </div>
              </div>
            {/each}
          {/if}
        </div>
      </aside>
    {/if}
  </div>

  <!-- Mobile Floating Action Bar (Always Accessible) -->
  {#if !loading && totalPages > 0}
    <div class="qc-mobile-floating-bar">
      <button
        type="button"
        class="qc-mob-btn-action"
        onclick={() => openNewIssueModal(currentPage)}
      >
        <Flag size={15} />
        <span>Apontar erro</span>
      </button>

      <div class="qc-mob-page-chip">
        <span>{currentPage} / {totalPages}</span>
      </div>

      <button
        type="button"
        class="qc-mob-btn-sidebar"
        onclick={() => sidebarOpen = !sidebarOpen}
      >
        <List size={15} />
        <span>Erros ({openIssuesCount})</span>
      </button>
    </div>
  {/if}

  <!-- Modal: Apontar Erro -->
  {#if showIssueModal}
    <div class="qc-modal-backdrop" onclick={() => showIssueModal = false} role="dialog" aria-modal="true">
      <div class="qc-modal-card" onclick={(e) => e.stopPropagation()}>
        <div class="qc-modal-header">
          <div class="qc-modal-title-cluster">
            <div class="qc-modal-icon-flag">
              <Flag size={18} />
            </div>
            <div>
              <h3 class="qc-modal-title">Apontar Erro no Capítulo</h3>
              <p class="qc-modal-subtitle">Indique o local exato e descreva a correção solicitada.</p>
            </div>
          </div>
          <button type="button" class="btn-close-modal" onclick={() => showIssueModal = false}>
            <X size={18} />
          </button>
        </div>

        <form
          method="POST"
          action="?/createQcIssue"
          use:enhance={() => {
            submittingAction = true;
            return async ({ update }) => {
              submittingAction = false;
              showIssueModal = false;
              await update();
              showToast(`Problema apontado na página ${issuePageNumber}.`);
            };
          }}
          class="qc-issue-form"
        >
          <input type="hidden" name="chapterId" value={chapter?.id || chapterId} />

          <div class="form-row-2">
            <!-- Página -->
            <div class="form-group">
              <label for="qc-issue-page" class="form-label">Página Afetada *</label>
              <div class="input-with-controls">
                <input
                  id="qc-issue-page"
                  name="pageNumber"
                  type="number"
                  min="1"
                  max={totalPages || 200}
                  bind:value={issuePageNumber}
                  required
                  class="form-input"
                />
              </div>
            </div>

            <!-- Balão / Região -->
            <div class="form-group">
              <label for="qc-issue-region" class="form-label">Balão ou Região (Opcional)</label>
              <input
                id="qc-issue-region"
                name="region"
                type="text"
                placeholder="Ex: Balão 2, Painel inferior"
                bind:value={issueRegion}
                class="form-input"
              />
            </div>
          </div>

          <!-- Tipo de Problema -->
          <div class="form-group">
            <label class="form-label">Tipo do Problema *</label>
            <div class="issue-type-grid">
              <button
                type="button"
                class="type-choice-btn"
                class:selected={issueType === 'TRANSLATION'}
                onclick={() => issueType = 'TRANSLATION'}
              >
                Tradução incorreta
              </button>
              <button
                type="button"
                class="type-choice-btn"
                class:selected={issueType === 'CLEAN'}
                onclick={() => issueType = 'CLEAN'}
              >
                Limpeza / Redraw
              </button>
              <button
                type="button"
                class="type-choice-btn"
                class:selected={issueType === 'TYPE'}
                onclick={() => issueType = 'TYPE'}
              >
                Typeset / Balão
              </button>
              <button
                type="button"
                class="type-choice-btn"
                class:selected={issueType === 'OTHER'}
                onclick={() => issueType = 'OTHER'}
              >
                Outro problema
              </button>
            </div>
            <input type="hidden" name="issueType" value={issueType} />
          </div>

          <!-- Devolver Para (Etapa Responsável) -->
          <div class="form-group">
            <label for="qc-issue-target-stage" class="form-label">Devolver Para (Etapa Responsável) *</label>
            <select
              id="qc-issue-target-stage"
              bind:value={issueTargetStage}
              class="form-select"
            >
              <option value="traducao">Tradução</option>
              <option value="clean_redraw">Clean/Redraw</option>
              <option value="typeset">Typeset</option>
            </select>
          </div>

          <!-- Descrição -->
          <div class="form-group">
            <label for="qc-issue-desc" class="form-label">Descrição do Erro e Correção Esperada *</label>
            <textarea
              id="qc-issue-desc"
              name="description"
              rows="3"
              placeholder="Explique detalhadamente o que precisa ser corrigido..."
              bind:value={issueDescription}
              required
              class="form-textarea"
            ></textarea>
          </div>

          <div class="qc-modal-footer">
            <button
              type="button"
              class="btn-cancel"
              onclick={() => showIssueModal = false}
            >
              Cancelar
            </button>
            <button
              type="submit"
              class="btn-save-issue"
              disabled={submittingAction || !issueDescription.trim()}
            >
              <Flag size={14} />
              <span>{submittingAction ? 'Salvando...' : 'Registrar Apontamento'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  {/if}

  <!-- Modal: Solicitar Correções (Rework) -->
  {#if showReworkModal}
    {@const affectedStages = Array.from(new Set(chapterQcIssues.filter((q: any) => q.status === 'OPEN').map((q: any) => {
      if (q.issue_type === 'TRANSLATION') return 'traducao';
      if (q.issue_type === 'CLEAN' || q.issue_type === 'REDRAW') return 'clean_redraw';
      return 'typeset';
    })))}
    <div class="qc-modal-backdrop" onclick={() => showReworkModal = false} role="dialog" aria-modal="true">
      <div class="qc-modal-card qc-modal-rework" onclick={(e) => e.stopPropagation()}>
        <div class="qc-modal-header">
          <div class="qc-modal-title-cluster">
            <div class="qc-modal-icon-rework">
              <RotateCcw size={20} />
            </div>
            <div>
              <h3 class="qc-modal-title">Solicitar Correções no Capítulo</h3>
              <p class="qc-modal-subtitle">
                {manifest?.workTitle || 'Céu Distante'} — Capítulo #{manifest?.chapterNumber || 84}
              </p>
            </div>
          </div>
          <button type="button" class="btn-close-modal" onclick={() => showReworkModal = false}>
            <X size={18} />
          </button>
        </div>

        <form
          method="POST"
          action="?/requestQcRework"
          use:enhance={() => {
            submittingAction = true;
            return async ({ update }) => {
              submittingAction = false;
              showReworkModal = false;
              await update();
              showToast('Correções solicitadas aos responsáveis.');
              onBack();
            };
          }}
          class="qc-rework-form"
        >
          <input type="hidden" name="qc_stage_id" value={currentQcStage?.id || ''} />
          <input type="hidden" name="rework_stages" value={JSON.stringify(affectedStages.length > 0 ? affectedStages : ['typeset'])} />

          <div class="qc-rework-summary-box">
            <h4 class="summary-box-title">Resumo dos Apontamentos</h4>
            <div class="summary-metrics">
              <div class="metric-item">
                <span class="metric-num">{chapterQcIssues.length}</span>
                <span class="metric-lbl">Total de erros</span>
              </div>
              <div class="metric-item">
                <span class="metric-num">{affectedStages.length || 1}</span>
                <span class="metric-lbl">Etapas afetadas</span>
              </div>
              <div class="metric-item">
                <span class="metric-num">
                  {new Set(chapterQcIssues.map((q: any) => q.page_number)).size || 1}
                </span>
                <span class="metric-lbl">Páginas afetadas</span>
              </div>
            </div>

            <div class="affected-stages-list">
              <span class="stages-label">Etapas que receberão o pedido de correção:</span>
              <div class="stage-tags-row">
                {#each (affectedStages.length > 0 ? affectedStages : ['typeset']) as st}
                  <span class="stage-tag">{st === 'traducao' ? 'Tradução' : st === 'clean_redraw' ? 'Clean/Redraw' : 'Typeset'}</span>
                {/each}
              </div>
            </div>
          </div>

          <div class="form-group">
            <label for="qc-rework-reason" class="form-label">Mensagem para a Equipe *</label>
            <textarea
              id="qc-rework-reason"
              name="reason"
              rows="3"
              class="form-textarea"
              placeholder="Explique os ajustes gerais solicitados para os responsáveis..."
              value={manifest?.isIncompleteTypeset
                ? 'O pacote anexado contém apenas páginas limpas do Clean/Redraw com balões em branco. As falas da tradução não foram inseridas nos balões. Necessário diagramar as falas antes de aprovar.'
                : `Revisão QC apontou ${chapterQcIssues.length} pendências que precisam de correção.`}
              required
            ></textarea>
          </div>

          <div class="qc-alert-preserve">
            <AlertTriangle size={15} />
            <span>Os arquivos anteriores e o histórico serão preservados. O capítulo voltará ao status de retrabalho para as etapas indicadas.</span>
          </div>

          <div class="qc-modal-footer">
            <button type="button" class="btn-cancel" onclick={() => showReworkModal = false}>
              Cancelar
            </button>
            <button
              type="submit"
              class="btn-confirm-rework"
              disabled={submittingAction}
            >
              <RotateCcw size={15} />
              <span>{submittingAction ? 'Enviando...' : 'Confirmar Solicitação de Correções'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  {/if}

  <!-- Modal: Aprovar Capítulo -->
  {#if showApproveModal}
    <div class="qc-modal-backdrop" onclick={() => showApproveModal = false} role="dialog" aria-modal="true">
      <div class="qc-modal-card qc-modal-approve" onclick={(e) => e.stopPropagation()}>
        <div class="qc-modal-header">
          <div class="qc-modal-title-cluster">
            <div class="qc-modal-icon-approve">
              <CheckCircle2 size={22} />
            </div>
            <div>
              <h3 class="qc-modal-title">Aprovar Qualidade do Capítulo</h3>
              <p class="qc-modal-subtitle">
                {manifest?.workTitle || 'Céu Distante'} — Capítulo #{manifest?.chapterNumber || 84}
              </p>
            </div>
          </div>
          <button type="button" class="btn-close-modal" onclick={() => showApproveModal = false}>
            <X size={18} />
          </button>
        </div>

        <form
          method="POST"
          action="?/approveQcStage"
          use:enhance={() => {
            submittingAction = true;
            return async ({ update }) => {
              submittingAction = false;
              showApproveModal = false;
              await update();
              showToast('Capítulo aprovado pelo QC com sucesso!');
              onBack();
            };
          }}
          class="qc-approve-form"
        >
          <input type="hidden" name="chapter_stage_id" value={currentQcStage?.id || ''} />

          <p class="qc-approve-text">
            Confirma a aprovação do capítulo <strong>#{manifest?.chapterNumber || 84}</strong> de <strong>{manifest?.workTitle || 'Céu Distante'}</strong>?
          </p>

          {#if manifest?.isIncompleteTypeset}
            <div class="qc-approve-warning error">
              <AlertTriangle size={16} class="flex-shrink-0" />
              <span>Atenção: <strong>Aprovação bloqueada</strong>. O pacote atual contém apenas páginas limpas sem falas diagramadas (balões em branco). Use <strong>Solicitar correções</strong> para devolver ao Typeset.</span>
            </div>
          {:else if openIssuesCount > 0}
            <div class="qc-approve-warning">
              <AlertTriangle size={16} />
              <span>Atenção: Existem <strong>{openIssuesCount} apontamentos ainda em aberto</strong>. Eles devem ser resolvidos antes da aprovação definitiva.</span>
            </div>
          {/if}

          <div class="qc-approve-check-list">
            <div class="check-row">
              <Check size={14} class="check-icon" />
              <span>Todas as {totalPages || 28} páginas foram conferidas visualmente</span>
            </div>
            <div class="check-row" class:is-fail={manifest?.isIncompleteTypeset}>
              {#if manifest?.isIncompleteTypeset}
                <AlertTriangle size={14} class="check-icon fail text-rose-400" />
                <span class="text-rose-400 font-semibold">Diagramação e balões: Reprovado (Balões em branco / Sem falas)</span>
              {:else}
                <Check size={14} class="check-icon" />
                <span>Letreiramento e balões revisados e legíveis</span>
              {/if}
            </div>
            <div class="check-row">
              <Check size={14} class="check-icon" />
              <span>O capítulo avançará para a etapa <strong>Pré-aprovado</strong></span>
            </div>
          </div>

          <div class="qc-modal-footer">
            <button type="button" class="btn-cancel" onclick={() => showApproveModal = false}>
              Voltar à Leitura
            </button>
            <button
              type="submit"
              class="btn-confirm-approve"
              disabled={submittingAction || openIssuesCount > 0 || Boolean(manifest?.isIncompleteTypeset)}
              title={manifest?.isIncompleteTypeset
                ? 'Aprovação bloqueada: páginas sem falas diagramadas'
                : openIssuesCount > 0
                  ? 'Resolva os apontamentos antes de aprovar'
                  : 'Confirmar Aprovação'}
            >
              <CheckCircle2 size={16} />
              <span>{submittingAction ? 'Aprovando...' : 'Confirmar Aprovação'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  {/if}

  <!-- Toast Notification -->
  {#if toastMsg}
    <div class="qc-toast">
      <CheckCircle2 size={16} class="toast-icon" />
      <span>{toastMsg}</span>
    </div>
  {/if}
</div>

<style>
  :global(body:has(.qc-reader-root) .site-header) {
    display: none !important;
  }

  .qc-reader-root {
    position: fixed;
    inset: 0;
    z-index: 9999;
    display: flex;
    flex-direction: column;
    background-color: #070709;
    color: #f1f5f9;
    font-family: inherit;
    overflow: hidden;
  }

  /* ------------------------------------------------------------------------- */
  /* Top Bar                                                                   */
  /* ------------------------------------------------------------------------- */
  .qc-top-bar {
    height: 58px;
    background: rgba(13, 13, 18, 0.95);
    backdrop-filter: blur(12px);
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 16px;
    z-index: 20;
    gap: 12px;
  }

  .qc-bar-left {
    display: flex;
    align-items: center;
    gap: 14px;
    min-width: 0;
  }

  .qc-btn-back {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    background: rgba(255, 255, 255, 0.06);
    border: 1px solid rgba(255, 255, 255, 0.12);
    color: #e2e8f0;
    padding: 6px 12px;
    border-radius: 8px;
    font-size: 0.8125rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.15s ease;
    white-space: nowrap;
  }

  .qc-btn-back:hover {
    background: rgba(255, 255, 255, 0.12);
    color: #ffffff;
    border-color: rgba(255, 255, 255, 0.2);
  }

  .qc-header-info {
    display: flex;
    align-items: center;
    gap: 8px;
    min-width: 0;
  }

  .qc-header-badge {
    font-size: 0.6875rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    padding: 2px 7px;
    border-radius: 5px;
    background: rgba(168, 85, 247, 0.15);
    color: #c084fc;
    border: 1px solid rgba(168, 85, 247, 0.3);
    white-space: nowrap;
  }

  .qc-header-title {
    font-size: 0.875rem;
    font-weight: 600;
    color: #f8fafc;
    margin: 0;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .qc-header-ch {
    color: #94a3b8;
    margin-left: 4px;
    font-weight: 500;
  }

  /* Center Page Indicator */
  .qc-bar-center {
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .qc-page-indicator {
    display: flex;
    align-items: center;
    gap: 4px;
    background: rgba(0, 0, 0, 0.5);
    border: 1px solid rgba(255, 255, 255, 0.1);
    padding: 4px 12px;
    border-radius: 20px;
    font-size: 0.8125rem;
    font-weight: 600;
    color: #e2e8f0;
  }

  .qc-page-sep {
    color: #64748b;
  }

  .qc-page-total {
    color: #94a3b8;
  }

  /* Right Action Buttons */
  .qc-bar-right {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .qc-icon-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 34px;
    height: 34px;
    border-radius: 8px;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.1);
    color: #94a3b8;
    cursor: pointer;
    transition: all 0.15s ease;
    position: relative;
  }

  .qc-icon-btn:hover, .qc-icon-btn.active {
    background: rgba(255, 255, 255, 0.12);
    color: #f8fafc;
    border-color: rgba(255, 255, 255, 0.2);
  }

  .qc-icon-badge {
    position: absolute;
    top: -4px;
    right: -4px;
    min-width: 17px;
    height: 17px;
    border-radius: 9px;
    background: #ef4444;
    color: #ffffff;
    font-size: 0.625rem;
    font-weight: 700;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0 4px;
  }

  .qc-btn-flag {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    background: rgba(245, 158, 11, 0.15);
    border: 1px solid rgba(245, 158, 11, 0.4);
    color: #fcd34d;
    padding: 6px 13px;
    border-radius: 8px;
    font-size: 0.8125rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .qc-btn-flag:hover {
    background: rgba(245, 158, 11, 0.25);
    border-color: rgba(245, 158, 11, 0.6);
    color: #fbbf24;
  }

  .qc-btn-rework {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    background: rgba(239, 68, 68, 0.12);
    border: 1px solid rgba(239, 68, 68, 0.3);
    color: #fca5a5;
    padding: 6px 12px;
    border-radius: 8px;
    font-size: 0.8125rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .qc-btn-rework:hover {
    background: rgba(239, 68, 68, 0.22);
    color: #ffffff;
    border-color: rgba(239, 68, 68, 0.5);
  }

  .qc-btn-approve {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    background: #10b981;
    border: 1px solid #059669;
    color: #ffffff;
    padding: 6px 14px;
    border-radius: 8px;
    font-size: 0.8125rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.15s ease;
    box-shadow: 0 2px 8px rgba(16, 185, 129, 0.25);
  }

  .qc-btn-approve:hover:not(:disabled) {
    background: #059669;
    transform: translateY(-1px);
  }

  .qc-btn-approve:disabled,
  .qc-btn-approve.btn-disabled {
    opacity: 0.45 !important;
    cursor: not-allowed !important;
    background: rgba(255, 255, 255, 0.08) !important;
    border-color: rgba(255, 255, 255, 0.12) !important;
    color: #71717a !important;
    box-shadow: none !important;
    transform: none !important;
  }

  .btn-text-mobile {
    display: none;
  }

  /* ------------------------------------------------------------------------- */
  /* Main Viewport Body                                                        */
  /* ------------------------------------------------------------------------- */
  .qc-viewport-body {
    flex: 1;
    display: flex;
    overflow: hidden;
    position: relative;
  }

  .qc-reading-canvas {
    flex: 1;
    overflow-y: auto;
    overflow-x: hidden;
    background: #070709;
    display: flex;
    justify-content: center;
    padding: 16px 0 calc(80px + env(safe-area-inset-bottom, 24px)) 0;
    scroll-behavior: smooth;
  }

  .qc-scroll-strip {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 16px;
    width: 100%;
  }

  .qc-scroll-strip.fit-width {
    max-width: 820px;
  }

  .qc-scroll-strip.original-width {
    max-width: 1100px;
  }

  .qc-page-wrapper {
    display: flex;
    flex-direction: column;
    align-items: center;
    width: 100%;
  }

  .qc-page-meta-bar {
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 4px 12px;
    background: rgba(20, 20, 28, 0.85);
    border-top: 1px solid rgba(255, 255, 255, 0.08);
    border-bottom: 1px solid rgba(255, 255, 255, 0.04);
    font-size: 0.75rem;
    color: #94a3b8;
  }

  .qc-page-num-badge {
    font-weight: 600;
    color: #cbd5e1;
  }

  .qc-page-issue-badge {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    background: rgba(239, 68, 68, 0.15);
    color: #f87171;
    border: 1px solid rgba(239, 68, 68, 0.3);
    padding: 2px 7px;
    border-radius: 4px;
    font-size: 0.6875rem;
    font-weight: 600;
    cursor: pointer;
  }

  .qc-btn-flag-page {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    background: none;
    border: none;
    color: #f59e0b;
    font-size: 0.75rem;
    font-weight: 500;
    cursor: pointer;
    padding: 2px 6px;
    border-radius: 4px;
  }

  .qc-btn-flag-page:hover {
    background: rgba(245, 158, 11, 0.15);
  }

  .qc-img-container {
    width: 100%;
    min-height: 520px;
    aspect-ratio: 800 / 1200;
    display: flex;
    align-items: center;
    justify-content: center;
    background: #08090d;
    position: relative;
    overflow: hidden;
  }

  .qc-page-skeleton {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    background: #0b0d14;
    overflow: hidden;
    z-index: 1;
  }

  .skeleton-shimmer {
    position: absolute;
    inset: 0;
    background: linear-gradient(90deg, transparent 0%, rgba(255, 255, 255, 0.04) 50%, transparent 100%);
    animation: qc-shimmer 1.8s infinite;
  }

  .skeleton-label {
    font-size: 13px;
    color: #64748b;
    font-weight: 500;
    z-index: 2;
  }

  @keyframes qc-shimmer {
    0% { transform: translateX(-100%); }
    100% { transform: translateX(100%); }
  }

  .qc-manga-page {
    width: 100%;
    height: auto;
    display: block;
    user-select: none;
    opacity: 0;
    transition: opacity 0.25s ease-in;
    position: relative;
    z-index: 2;
  }

  .qc-manga-page.is-loaded {
    opacity: 1;
  }

  .qc-page-error-box {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 10px;
    padding: 32px 20px;
    text-align: center;
    background: rgba(245, 158, 11, 0.05);
    border: 1px dashed rgba(245, 158, 11, 0.3);
    border-radius: 12px;
    margin: 24px auto;
    max-width: 380px;
    width: 90%;
    z-index: 3;
  }

  .qc-error-title {
    font-size: 14.5px;
    font-weight: 700;
    color: #fbbf24;
  }

  .qc-error-sub {
    font-size: 12px;
    color: #94a3b8;
    line-height: 1.45;
  }

  .btn-retry-page {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    background: rgba(245, 158, 11, 0.16);
    border: 1px solid rgba(245, 158, 11, 0.4);
    color: #fbbf24;
    padding: 7px 16px;
    border-radius: 6px;
    font-size: 12.5px;
    font-weight: 600;
    cursor: pointer;
    margin-top: 4px;
    transition: all 0.15s ease;
  }

  .btn-retry-page:hover {
    background: rgba(245, 158, 11, 0.26);
    border-color: rgba(245, 158, 11, 0.6);
  }

  /* End Review Summary */
  .qc-end-review-card {
    width: 100%;
    max-width: 600px;
    margin: 32px auto;
    background: #111116;
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 14px;
    padding: 28px 24px;
    text-align: center;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
  }

  :global(.qc-end-icon) {
    color: #10b981;
  }

  .qc-end-title {
    font-size: 1.125rem;
    font-weight: 700;
    color: #f8fafc;
    margin: 0;
  }

  .qc-end-desc {
    font-size: 0.875rem;
    color: #94a3b8;
    line-height: 1.5;
    margin: 0;
    max-width: 460px;
  }

  .qc-end-actions {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-top: 12px;
    flex-wrap: wrap;
    justify-content: center;
  }

  .qc-btn-rework-lg {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    background: rgba(239, 68, 68, 0.15);
    border: 1px solid rgba(239, 68, 68, 0.4);
    color: #fca5a5;
    padding: 10px 18px;
    border-radius: 10px;
    font-size: 0.875rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .qc-btn-rework-lg:hover {
    background: rgba(239, 68, 68, 0.25);
    color: #ffffff;
  }

  .qc-btn-approve-lg {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    background: #10b981;
    border: 1px solid #059669;
    color: #ffffff;
    padding: 10px 20px;
    border-radius: 10px;
    font-size: 0.875rem;
    font-weight: 600;
    cursor: pointer;
    box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);
    transition: all 0.15s ease;
  }

  .qc-btn-approve-lg:hover:not(:disabled) {
    background: #059669;
    transform: translateY(-1px);
  }

  .qc-btn-approve-lg:disabled,
  .qc-btn-approve-lg.btn-disabled {
    opacity: 0.45 !important;
    cursor: not-allowed !important;
    background: rgba(255, 255, 255, 0.08) !important;
    border-color: rgba(255, 255, 255, 0.12) !important;
    color: #71717a !important;
    box-shadow: none !important;
    transform: none !important;
  }

  /* ------------------------------------------------------------------------- */
  /* Sidebar (Apontamentos e Observações)                                     */
  /* ------------------------------------------------------------------------- */
  .qc-observations-sidebar {
    width: 360px;
    background: #0d0d12;
    border-left: 1px solid rgba(255, 255, 255, 0.08);
    display: flex;
    flex-direction: column;
    z-index: 15;
    box-shadow: -4px 0 20px rgba(0, 0, 0, 0.4);
  }

  .qc-sidebar-header {
    padding: 16px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  }

  .qc-sidebar-title-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .qc-sidebar-title {
    font-size: 0.9375rem;
    font-weight: 700;
    color: #f8fafc;
    margin: 0;
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .qc-sidebar-count {
    color: #a855f7;
    font-weight: 700;
  }

  .qc-sidebar-close {
    background: none;
    border: none;
    color: #64748b;
    cursor: pointer;
    padding: 4px;
    border-radius: 6px;
  }

  .qc-sidebar-close:hover {
    color: #ffffff;
    background: rgba(255, 255, 255, 0.08);
  }

  .qc-sidebar-subtitle {
    font-size: 0.75rem;
    color: #64748b;
    margin: 4px 0 0 0;
  }

  .qc-sidebar-actions-bar {
    padding: 10px 16px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  }

  .qc-btn-add-issue {
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    background: rgba(168, 85, 247, 0.12);
    border: 1px dashed rgba(168, 85, 247, 0.35);
    color: #c084fc;
    padding: 8px 12px;
    border-radius: 8px;
    font-size: 0.8125rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .qc-btn-add-issue:hover {
    background: rgba(168, 85, 247, 0.2);
    border-color: rgba(168, 85, 247, 0.5);
    color: #e9d5ff;
  }

  .qc-sidebar-list {
    flex: 1;
    overflow-y: auto;
    padding: 12px 16px;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .qc-sidebar-empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    padding: 36px 12px;
    color: #64748b;
  }

  :global(.qc-empty-icon) {
    color: #334155;
    margin-bottom: 8px;
  }

  .qc-empty-title {
    font-size: 0.875rem;
    font-weight: 600;
    color: #94a3b8;
    margin: 0;
  }

  .qc-empty-desc {
    font-size: 0.75rem;
    line-height: 1.4;
    margin: 4px 0 0 0;
    max-width: 220px;
  }

  /* Issue Cards in Sidebar */
  .qc-issue-card {
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 10px;
    padding: 10px 12px;
    display: flex;
    flex-direction: column;
    gap: 6px;
    transition: border-color 0.15s ease;
  }

  .qc-issue-card.status-open {
    border-left: 3px solid #f59e0b;
  }

  .qc-issue-card.status-resolved {
    border-left: 3px solid #10b981;
    opacity: 0.65;
  }

  .qc-issue-top {
    display: flex;
    align-items: center;
    gap: 6px;
    flex-wrap: wrap;
  }

  .qc-issue-page-btn {
    background: rgba(255, 255, 255, 0.08);
    border: 1px solid rgba(255, 255, 255, 0.12);
    color: #f1f5f9;
    padding: 2px 7px;
    border-radius: 5px;
    font-size: 0.6875rem;
    font-weight: 700;
    cursor: pointer;
  }

  .qc-issue-page-btn:hover {
    background: #a855f7;
    border-color: #a855f7;
    color: #ffffff;
  }

  .qc-issue-region-tag {
    font-size: 0.6875rem;
    color: #94a3b8;
    background: rgba(0, 0, 0, 0.3);
    padding: 2px 6px;
    border-radius: 4px;
  }

  .qc-issue-type-badge {
    font-size: 0.6875rem;
    font-weight: 600;
    padding: 2px 6px;
    border-radius: 4px;
    margin-left: auto;
  }

  .qc-issue-type-badge.type-translation {
    background: rgba(59, 130, 246, 0.15);
    color: #60a5fa;
  }

  .qc-issue-type-badge.type-clean {
    background: rgba(236, 72, 153, 0.15);
    color: #f472b6;
  }

  .qc-issue-type-badge.type-type {
    background: rgba(234, 179, 8, 0.15);
    color: #facc15;
  }

  .qc-issue-desc {
    font-size: 0.8125rem;
    color: #cbd5e1;
    line-height: 1.4;
    margin: 2px 0;
    word-break: break-word;
  }

  .qc-issue-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-top: 4px;
    padding-top: 4px;
    border-top: 1px solid rgba(255, 255, 255, 0.04);
  }

  .qc-issue-status-badge {
    font-size: 0.6875rem;
    font-weight: 600;
    color: #94a3b8;
  }

  .qc-issue-status-badge.open {
    color: #f59e0b;
  }

  .qc-issue-card-actions {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .btn-toggle-resolve {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    background: rgba(255, 255, 255, 0.06);
    border: 1px solid rgba(255, 255, 255, 0.1);
    color: #cbd5e1;
    padding: 3px 8px;
    border-radius: 5px;
    font-size: 0.6875rem;
    font-weight: 600;
    cursor: pointer;
  }

  .btn-toggle-resolve:hover {
    background: rgba(16, 185, 129, 0.2);
    color: #34d399;
    border-color: rgba(16, 185, 129, 0.4);
  }

  .btn-delete-issue {
    background: none;
    border: none;
    color: #64748b;
    padding: 3px 6px;
    border-radius: 4px;
    cursor: pointer;
  }

  .btn-delete-issue:hover {
    color: #ef4444;
    background: rgba(239, 68, 68, 0.1);
  }

  .desktop-actions {
    display: flex;
  }

  .mobile-actions {
    display: none;
  }

  /* Page indicator loading state */
  .qc-page-indicator.is-loading {
    display: flex;
    align-items: center;
    gap: 6px;
    background: rgba(168, 85, 247, 0.12);
    border: 1px solid rgba(168, 85, 247, 0.3);
    color: #c084fc;
    font-size: 11.5px;
  }

  .loading-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: #c084fc;
    animation: qc-pulse 1s ease-in-out infinite alternate;
  }

  @keyframes qc-pulse {
    from { opacity: 0.3; transform: scale(0.8); }
    to { opacity: 1; transform: scale(1.2); }
  }

  /* ------------------------------------------------------------------------- */
  /* Mobile Floating Bar                                                       */
  /* ------------------------------------------------------------------------- */
  .qc-mobile-floating-bar {
    display: none;
  }

  @media (max-width: 900px) {
    .btn-text-desktop {
      display: none;
    }

    .btn-text-mobile {
      display: inline;
    }

    .qc-btn-rework, .qc-btn-approve {
      padding: 6px 10px;
    }

    .qc-observations-sidebar {
      position: fixed;
      right: 0;
      top: 58px;
      bottom: 0;
      width: 100%;
      max-width: 360px;
      z-index: 40;
      padding-bottom: calc(80px + env(safe-area-inset-bottom, 12px));
    }

    .qc-mobile-floating-bar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      position: fixed;
      bottom: calc(16px + env(safe-area-inset-bottom, 12px));
      left: 16px;
      right: 16px;
      background: rgba(15, 15, 22, 0.92);
      backdrop-filter: blur(14px);
      border: 1px solid rgba(255, 255, 255, 0.14);
      border-radius: 28px;
      padding: 6px 14px;
      z-index: 100;
      box-shadow: 0 8px 30px rgba(0, 0, 0, 0.6);
    }

    .qc-mob-btn-action {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      background: #f59e0b;
      color: #000000;
      border: none;
      padding: 8px 14px;
      border-radius: 20px;
      font-size: 0.8125rem;
      font-weight: 700;
      cursor: pointer;
    }

    .qc-mob-page-chip {
      font-size: 0.8125rem;
      font-weight: 700;
      color: #e2e8f0;
      background: rgba(255, 255, 255, 0.08);
      padding: 4px 10px;
      border-radius: 12px;
    }

    .qc-mob-btn-sidebar {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      background: rgba(255, 255, 255, 0.1);
      color: #ffffff;
      border: none;
      padding: 8px 12px;
      border-radius: 20px;
      font-size: 0.8125rem;
      font-weight: 600;
      cursor: pointer;
    }
  }

  @media (max-width: 768px) {
    .desktop-actions {
      display: none !important;
    }

    .mobile-actions {
      display: flex !important;
      align-items: center;
      gap: 6px;
    }

    .qc-top-bar {
      padding: 0 10px;
      height: 52px;
      gap: 6px;
    }

    .qc-header-info {
      display: none !important;
    }

    .qc-btn-back {
      padding: 5px 9px;
      font-size: 11.5px;
    }

    .qc-bar-center {
      flex: 1;
      justify-content: center;
    }

    .qc-page-indicator {
      font-size: 11.5px;
      padding: 3px 9px;
      white-space: nowrap;
    }

    .qc-mob-quick-approve {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      background: #10b981;
      border: 1px solid #059669;
      color: #ffffff;
      padding: 6px 10px;
      border-radius: 8px;
      font-size: 11.5px;
      font-weight: 600;
      cursor: pointer;
      white-space: nowrap;
    }

    .qc-mob-quick-approve:disabled,
    .qc-mob-quick-approve.btn-disabled {
      opacity: 0.45 !important;
      cursor: not-allowed !important;
      background: rgba(255, 255, 255, 0.08) !important;
      border-color: rgba(255, 255, 255, 0.12) !important;
      color: #71717a !important;
      box-shadow: none !important;
      transform: none !important;
    }

    .qc-mob-menu-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 32px;
      height: 32px;
      border-radius: 8px;
      background: rgba(255, 255, 255, 0.08);
      border: 1px solid rgba(255, 255, 255, 0.14);
      color: #cbd5e1;
      cursor: pointer;
      transition: all 0.15s ease;
    }

    .qc-mob-menu-btn:hover,
    .qc-mob-menu-btn.active {
      background: rgba(255, 255, 255, 0.16);
      color: #ffffff;
      border-color: rgba(255, 255, 255, 0.25);
    }

    /* Generous bottom padding to ensure floating bar NEVER blocks canvas or end card */
    .qc-reading-canvas {
      padding-bottom: calc(120px + env(safe-area-inset-bottom, 32px)) !important;
    }

    .qc-end-review-card {
      margin-bottom: calc(48px + env(safe-area-inset-bottom, 24px)) !important;
    }
  }

  /* Mobile Actions Sheet Styles */
  .qc-mob-menu-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.7);
    backdrop-filter: blur(8px);
    z-index: 120;
    display: flex;
    align-items: flex-end;
  }

  .qc-mob-menu-sheet {
    width: 100%;
    background: #12131a;
    border-top: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 20px 20px 0 0;
    padding: 16px 16px calc(24px + env(safe-area-inset-bottom, 16px)) 16px;
    box-shadow: 0 -10px 40px rgba(0, 0, 0, 0.7);
    animation: qc-sheet-slide 0.2s cubic-bezier(0.16, 1, 0.3, 1);
  }

  @keyframes qc-sheet-slide {
    from { transform: translateY(100%); }
    to { transform: translateY(0); }
  }

  .qc-mob-menu-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding-bottom: 12px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
    margin-bottom: 8px;
  }

  .qc-mob-menu-title {
    font-size: 13.5px;
    font-weight: 700;
    color: #f1f5f9;
  }

  .qc-mob-menu-close {
    background: none;
    border: none;
    color: #94a3b8;
    padding: 4px;
    cursor: pointer;
  }

  .qc-mob-menu-items {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .qc-sheet-item {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 14px;
    border-radius: 10px;
    background: transparent;
    border: none;
    color: #e2e8f0;
    font-size: 13.5px;
    font-weight: 500;
    text-align: left;
    width: 100%;
    cursor: pointer;
    transition: background 0.12s ease;
  }

  .qc-sheet-item:hover:not(:disabled), .qc-sheet-item:active:not(:disabled) {
    background: rgba(255, 255, 255, 0.06);
  }

  .qc-sheet-item:disabled,
  .qc-sheet-item.is-disabled {
    opacity: 0.45 !important;
    cursor: not-allowed !important;
    pointer-events: none !important;
  }

  /* ------------------------------------------------------------------------- */
  /* Loading & Error States                                                    */
  /* ------------------------------------------------------------------------- */
  .qc-loading-state, .qc-error-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    text-align: center;
    padding: 60px 24px;
    width: 100%;
    margin: auto;
  }

  .qc-spinner {
    width: 44px;
    height: 44px;
    border: 3px solid rgba(168, 85, 247, 0.2);
    border-top-color: #c084fc;
    border-radius: 50%;
    animation: qc-spin 0.8s linear infinite;
    margin-bottom: 20px;
  }

  @keyframes qc-spin {
    to { transform: rotate(360deg); }
  }

  .qc-loading-title {
    font-size: 1.125rem;
    font-weight: 700;
    color: #f8fafc;
    margin: 0;
  }

  .qc-loading-desc {
    font-size: 0.875rem;
    color: #94a3b8;
    margin: 8px 0 0 0;
    max-width: 400px;
  }

  :global(.qc-error-icon) {
    color: #ef4444;
    margin-bottom: 12px;
  }

  .qc-error-title {
    font-size: 1.125rem;
    font-weight: 700;
    color: #f8fafc;
    margin: 0;
  }

  .qc-error-desc {
    font-size: 0.875rem;
    color: #94a3b8;
    margin: 8px 0 20px 0;
    max-width: 460px;
  }

  .qc-error-actions {
    display: flex;
    gap: 12px;
  }

  .btn-retry, .btn-back-qc {
    padding: 8px 16px;
    border-radius: 8px;
    font-size: 0.8125rem;
    font-weight: 600;
    cursor: pointer;
  }

  .btn-retry {
    background: #a855f7;
    color: #ffffff;
    border: none;
  }

  .btn-back-qc {
    background: rgba(255, 255, 255, 0.08);
    color: #cbd5e1;
    border: 1px solid rgba(255, 255, 255, 0.12);
  }

  /* ------------------------------------------------------------------------- */
  /* Modals                                                                    */
  /* ------------------------------------------------------------------------- */
  .qc-modal-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.75);
    backdrop-filter: blur(6px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 100;
    padding: 16px;
  }

  .qc-modal-card {
    background: #111118;
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 14px;
    width: 100%;
    max-width: 500px;
    max-height: 90vh;
    overflow-y: auto;
    box-shadow: 0 20px 40px rgba(0, 0, 0, 0.6);
    display: flex;
    flex-direction: column;
  }

  .qc-modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px 20px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  }

  .qc-modal-title-cluster {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .qc-modal-icon-flag {
    width: 36px;
    height: 36px;
    border-radius: 9px;
    background: rgba(245, 158, 11, 0.15);
    color: #f59e0b;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .qc-modal-icon-rework {
    width: 38px;
    height: 38px;
    border-radius: 9px;
    background: rgba(239, 68, 68, 0.15);
    color: #ef4444;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .qc-modal-icon-approve {
    width: 40px;
    height: 40px;
    border-radius: 10px;
    background: rgba(16, 185, 129, 0.15);
    color: #10b981;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .qc-modal-title {
    font-size: 1rem;
    font-weight: 700;
    color: #f8fafc;
    margin: 0;
  }

  .qc-modal-subtitle {
    font-size: 0.75rem;
    color: #94a3b8;
    margin: 2px 0 0 0;
  }

  .btn-close-modal {
    background: none;
    border: none;
    color: #64748b;
    cursor: pointer;
    padding: 6px;
    border-radius: 6px;
  }

  .btn-close-modal:hover {
    color: #ffffff;
    background: rgba(255, 255, 255, 0.08);
  }

  /* Form Elements */
  .qc-issue-form, .qc-rework-form, .qc-approve-form {
    padding: 20px;
    display: flex;
    flex-direction: column;
    gap: 14px;
  }

  .form-row-2 {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
  }

  .form-group {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .form-label {
    font-size: 0.75rem;
    font-weight: 600;
    color: #cbd5e1;
    text-transform: uppercase;
    letter-spacing: 0.03em;
  }

  .form-input, .form-select, .form-textarea {
    background: #0a0a0f;
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 8px;
    color: #f8fafc;
    padding: 8px 12px;
    font-size: 0.875rem;
    font-family: inherit;
    transition: border-color 0.15s ease;
  }

  .form-input:focus, .form-select:focus, .form-textarea:focus {
    outline: none;
    border-color: #a855f7;
    box-shadow: 0 0 0 2px rgba(168, 85, 247, 0.2);
  }

  .form-textarea {
    resize: vertical;
  }

  /* Issue Type Buttons */
  .issue-type-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
  }

  .type-choice-btn {
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.1);
    color: #cbd5e1;
    padding: 8px 10px;
    border-radius: 8px;
    font-size: 0.8125rem;
    font-weight: 600;
    cursor: pointer;
    text-align: center;
    transition: all 0.15s ease;
  }

  .type-choice-btn:hover {
    background: rgba(255, 255, 255, 0.08);
    color: #ffffff;
  }

  .type-choice-btn.selected {
    background: rgba(168, 85, 247, 0.2);
    border-color: #a855f7;
    color: #e9d5ff;
  }

  .qc-modal-footer {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 10px;
    margin-top: 10px;
    padding-top: 14px;
    border-top: 1px solid rgba(255, 255, 255, 0.08);
  }

  .btn-cancel {
    background: rgba(255, 255, 255, 0.06);
    border: 1px solid rgba(255, 255, 255, 0.1);
    color: #cbd5e1;
    padding: 8px 16px;
    border-radius: 8px;
    font-size: 0.8125rem;
    font-weight: 600;
    cursor: pointer;
  }

  .btn-cancel:hover {
    background: rgba(255, 255, 255, 0.1);
    color: #ffffff;
  }

  .btn-save-issue {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    background: #f59e0b;
    border: 1px solid #d97706;
    color: #000000;
    padding: 8px 18px;
    border-radius: 8px;
    font-size: 0.8125rem;
    font-weight: 700;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .btn-save-issue:hover:not(:disabled) {
    background: #d97706;
  }

  .btn-save-issue:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  /* Rework Modal Specifics */
  .qc-rework-summary-box {
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 10px;
    padding: 14px;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .summary-box-title {
    font-size: 0.8125rem;
    font-weight: 700;
    color: #f1f5f9;
    margin: 0;
  }

  .summary-metrics {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 8px;
    text-align: center;
  }

  .metric-item {
    background: rgba(0, 0, 0, 0.3);
    border-radius: 6px;
    padding: 8px 4px;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .metric-num {
    font-size: 1.125rem;
    font-weight: 800;
    color: #f87171;
  }

  .metric-lbl {
    font-size: 0.6875rem;
    color: #94a3b8;
  }

  .affected-stages-list {
    display: flex;
    flex-direction: column;
    gap: 6px;
    font-size: 0.75rem;
  }

  .stages-label {
    color: #94a3b8;
  }

  .stage-tags-row {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
  }

  .stage-tag {
    background: rgba(239, 68, 68, 0.15);
    border: 1px solid rgba(239, 68, 68, 0.3);
    color: #fca5a5;
    padding: 3px 8px;
    border-radius: 5px;
    font-weight: 600;
    font-size: 0.75rem;
  }

  .qc-alert-preserve {
    display: flex;
    align-items: flex-start;
    gap: 8px;
    background: rgba(245, 158, 11, 0.1);
    border: 1px solid rgba(245, 158, 11, 0.25);
    border-radius: 8px;
    padding: 10px 12px;
    font-size: 0.75rem;
    color: #fcd34d;
    line-height: 1.4;
  }

  .btn-confirm-rework {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    background: #ef4444;
    border: 1px solid #dc2626;
    color: #ffffff;
    padding: 8px 18px;
    border-radius: 8px;
    font-size: 0.8125rem;
    font-weight: 700;
    cursor: pointer;
  }

  .btn-confirm-rework:hover:not(:disabled) {
    background: #dc2626;
  }

  /* Approve Modal Specifics */
  .qc-approve-text {
    font-size: 0.9375rem;
    color: #e2e8f0;
    margin: 0;
    line-height: 1.5;
  }

  .qc-approve-warning {
    display: flex;
    align-items: flex-start;
    gap: 8px;
    background: rgba(245, 158, 11, 0.12);
    border: 1px solid rgba(245, 158, 11, 0.3);
    border-radius: 8px;
    padding: 10px 12px;
    font-size: 0.8125rem;
    color: #fbbf24;
    line-height: 1.4;
  }

  .qc-approve-warning.error {
    background: rgba(239, 68, 68, 0.12);
    border-color: rgba(239, 68, 68, 0.3);
    color: #f87171;
  }

  .qc-reader-incomplete-banner {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    background: rgba(245, 158, 11, 0.12);
    border-bottom: 1px solid rgba(245, 158, 11, 0.3);
    padding: 8px 16px;
    font-size: 12px;
    font-weight: 500;
    color: #fbbf24;
    text-align: center;
    width: 100%;
    box-sizing: border-box;
    z-index: 45;
  }

  .qc-approve-check-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
    background: rgba(255, 255, 255, 0.02);
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: 8px;
    padding: 12px;
  }

  .check-row {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 0.8125rem;
    color: #cbd5e1;
  }

  .check-row.is-fail {
    color: #f87171;
  }

  :global(.check-icon) {
    color: #10b981;
    flex-shrink: 0;
  }

  :global(.check-icon.fail) {
    color: #f87171;
  }

  .btn-confirm-approve {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    background: #10b981;
    border: 1px solid #059669;
    color: #ffffff;
    padding: 8px 18px;
    border-radius: 8px;
    font-size: 0.8125rem;
    font-weight: 700;
    cursor: pointer;
  }

  .btn-confirm-approve:disabled {
    opacity: 0.45;
    cursor: not-allowed;
    background: rgba(255, 255, 255, 0.08);
    border-color: rgba(255, 255, 255, 0.12);
    color: #71717a;
    box-shadow: none;
  }

  .btn-confirm-approve:hover:not(:disabled) {
    background: #059669;
  }

  /* Toast Notification */
  .qc-toast {
    position: fixed;
    bottom: 24px;
    left: 50%;
    transform: translateX(-50%);
    background: #1e1e28;
    border: 1px solid #a855f7;
    color: #ffffff;
    padding: 10px 18px;
    border-radius: 24px;
    font-size: 0.875rem;
    font-weight: 600;
    display: flex;
    align-items: center;
    gap: 8px;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.6);
    z-index: 200;
    animation: qc-toast-in 0.2s ease-out;
  }

  :global(.toast-icon) {
    color: #10b981;
  }

  @keyframes qc-toast-in {
    from {
      opacity: 0;
      transform: translate(-50%, 12px);
    }
    to {
      opacity: 1;
      transform: translate(-50%, 0);
    }
  }
</style>
