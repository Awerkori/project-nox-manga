<script lang="ts">
  import { invalidateAll } from '$app/navigation';
  import { action } from '$lib/actions';
  import { slugify } from '$lib/types';
  import {
    Users,
    Plus,
    Search,
    Edit3,
    Trash2,
    Shield,
    ShieldCheck,
    ExternalLink,
    CheckCircle2,
    X,
    Loader2,
    BookOpen,
    Layers,
    Globe,
    MessageCircle,
    Sparkles,
    Clock,
    AlertTriangle,
    Check,
    Ban
  } from '@lucide/svelte';
  import UserAvatar from '$lib/components/UserAvatar.svelte';
  import { enhance } from '$app/forms';

  let { data, form } = $props();

  // Navigation sections: Scans, Partner Requests, Project Requests
  let activeSection = $state<'scans' | 'partner_requests' | 'project_requests'>('scans');

  let search = $state('');
  let statusFilter = $state<'ALL' | 'ACTIVE' | 'INACTIVE' | 'ENDED'>('ALL');
  let partnerFilter = $state<'ALL' | 'PENDING' | 'APPROVED' | 'REJECTED'>('ALL');
  let projectFilter = $state<'ALL' | 'PENDING' | 'APPROVED' | 'REJECTED'>('ALL');

  let notice = $state('');
  let noticeType = $state<'info' | 'success' | 'error'>('info');
  let busy = $state(false);

  // Review modal state
  let rejectModalId = $state<string | null>(null);
  let rejectModalType = $state<'partner' | 'project' | null>(null);
  let rejectReason = $state('');
  let reviewLoading = $state(false);

  // Counters
  let pendingPartnersCount = $derived(
    (data.partnerRequests || []).filter((r: any) => r.status === 'PENDING').length
  );
  let pendingProjectsCount = $derived(
    (data.projectRequests || []).filter((r: any) => r.status === 'PENDING').length
  );

  // Filtered lists
  let filteredPartners = $derived(
    (data.partnerRequests || []).filter((r: any) => {
      const q = search.toLowerCase();
      const matchesSearch =
        r.scan_name.toLowerCase().includes(q) ||
        r.scan_slug.toLowerCase().includes(q) ||
        (r.members?.username || '').toLowerCase().includes(q) ||
        (r.members?.display_name || '').toLowerCase().includes(q);
      const matchesStatus = partnerFilter === 'ALL' || r.status === partnerFilter;
      return matchesSearch && matchesStatus;
    })
  );

  let filteredProjects = $derived(
    (data.projectRequests || []).filter((r: any) => {
      const q = search.toLowerCase();
      const matchesSearch =
        (r.works?.title || '').toLowerCase().includes(q) ||
        (r.scans?.name || '').toLowerCase().includes(q) ||
        (r.members?.username || '').toLowerCase().includes(q);
      const matchesStatus = projectFilter === 'ALL' || r.status === projectFilter;
      return matchesSearch && matchesStatus;
    })
  );

  // Modal / Editor State
  let editingScan = $state<any>(null);
  let showModal = $state(false);

  // Form Fields
  let formId = $state('');
  let formName = $state('');
  let formSlug = $state('');
  let formDescription = $state('');
  let formWebsite = $state('');
  let formDiscord = $state('');
  let formStatus = $state('ACTIVE');
  let formIsOfficial = $state(false);

  let filteredScans = $derived(
    (data.scans || []).filter((s: any) => {
      const matchesSearch =
        s.name.toLowerCase().includes(search.toLowerCase()) ||
        s.slug.toLowerCase().includes(search.toLowerCase());
      const matchesStatus = statusFilter === 'ALL' || s.status === statusFilter;
      return matchesSearch && matchesStatus;
    })
  );

  function openCreateModal() {
    editingScan = null;
    formId = '';
    formName = '';
    formSlug = '';
    formDescription = '';
    formWebsite = '';
    formDiscord = '';
    formStatus = 'ACTIVE';
    formIsOfficial = false;
    showModal = true;
    notice = '';
  }

  function openEditModal(scan: any) {
    editingScan = scan;
    formId = scan.id;
    formName = scan.name;
    formSlug = scan.slug;
    formDescription = scan.description || '';
    formWebsite = scan.website || '';
    formDiscord = scan.discord || '';
    formStatus = scan.status || 'ACTIVE';
    formIsOfficial = Boolean(scan.is_official);
    showModal = true;
    notice = '';
  }

  function handleNameChange(val: string) {
    formName = val;
    if (!editingScan) {
      formSlug = slugify(val);
    }
  }

  async function handleSaveScan(e: SubmitEvent) {
    e.preventDefault();
    if (!formName.trim() || !formSlug.trim()) {
      notice = 'Nome e slug são obrigatórios.';
      noticeType = 'error';
      return;
    }

    busy = true;
    notice = '';

    try {
      await action('editor', 'scan', {
        id: formId || undefined,
        name: formName.trim(),
        slug: formSlug.trim(),
        description: formDescription.trim(),
        website: formWebsite.trim(),
        discord: formDiscord.trim(),
        status: formStatus,
        is_official: formIsOfficial
      });

      await invalidateAll();
      showModal = false;
      notice = `Scan "${formName}" salva com sucesso.`;
      noticeType = 'success';
    } catch (err: any) {
      notice = err.message || 'Erro ao salvar scan.';
      noticeType = 'error';
    } finally {
      busy = false;
    }
  }

  async function handleDeleteScan(scan: any) {
    if (scan.is_official) {
      alert('A scan oficial Project Nox não pode ser excluída.');
      return;
    }

    const confirmPrompt = confirm(
      `Tem certeza que deseja excluir a scan "${scan.name}"? As obras e capítulos associados não serão apagados, mas perderão a atribuição a esta scan.`
    );
    if (!confirmPrompt) return;

    busy = true;
    try {
      await action('editor', 'delete_scan', { id: scan.id });
      await invalidateAll();
      notice = `Scan "${scan.name}" removida com sucesso.`;
      noticeType = 'success';
    } catch (err: any) {
      notice = err.message || 'Erro ao remover scan.';
      noticeType = 'error';
    } finally {
      busy = false;
    }
  }
</script>

<svelte:head>
  <title>Gestão de Scans & Parceiros — Project Nox Admin</title>
</svelte:head>

<div class="admin-page">
  <header class="page-header">
    <div class="header-left">
      <span class="badge-mini">EDITORIAL & PARCERIAS</span>
      <h1 class="page-title">Gestão de Scans & Parceiros</h1>
      <p class="page-desc">
        Cadastre, edite e gerencie grupos de tradução parceiros e a scan oficial Project Nox.
      </p>
    </div>
    <div class="header-right">
      <button class="btn-primary" onclick={openCreateModal}>
        <Plus size={16} />
        <span>Nova Scan</span>
      </button>
    </div>
  </header>

  {#if notice}
    <div class="notice-banner" class:success={noticeType === 'success'} class:error={noticeType === 'error'}>
      <span>{notice}</span>
      <button class="btn-close-notice" onclick={() => (notice = '')}><X size={14} /></button>
    </div>
  {/if}

  <!-- Admin Tabs Bar -->
  <div class="admin-tabs-bar">
    <button
      type="button"
      class="admin-tab-btn"
      class:active={activeSection === 'scans'}
      onclick={() => (activeSection = 'scans')}
    >
      <Users size={16} />
      <span>Scans Cadastradas ({data.scans.length})</span>
    </button>

    <button
      type="button"
      class="admin-tab-btn"
      class:active={activeSection === 'partner_requests'}
      onclick={() => (activeSection = 'partner_requests')}
    >
      <Sparkles size={16} />
      <span>Pedidos de Parceria</span>
      {#if pendingPartnersCount > 0}
        <span class="count-badge-glow">{pendingPartnersCount}</span>
      {/if}
    </button>

    <button
      type="button"
      class="admin-tab-btn"
      class:active={activeSection === 'project_requests'}
      onclick={() => (activeSection = 'project_requests')}
    >
      <BookOpen size={16} />
      <span>Solicitações de Projetos</span>
      {#if pendingProjectsCount > 0}
        <span class="count-badge-glow">{pendingProjectsCount}</span>
      {/if}
    </button>
  </div>

  {#if activeSection === 'scans'}
    <!-- Toolbar & Filters -->
    <div class="toolbar-card">
      <div class="search-box">
        <Search size={16} class="search-icon" />
        <input
          type="text"
          placeholder="Buscar scan por nome ou slug…"
          bind:value={search}
          class="search-input"
        />
      </div>

      <div class="filter-group">
        <button
          class="filter-chip"
          class:active={statusFilter === 'ALL'}
          onclick={() => (statusFilter = 'ALL')}
        >
          Todas ({data.scans.length})
        </button>
        <button
          class="filter-chip"
          class:active={statusFilter === 'ACTIVE'}
          onclick={() => (statusFilter = 'ACTIVE')}
        >
          Ativas ({data.scans.filter((s: any) => s.status === 'ACTIVE').length})
        </button>
        <button
          class="filter-chip"
          class:active={statusFilter === 'INACTIVE'}
          onclick={() => (statusFilter = 'INACTIVE')}
        >
          Inativas ({data.scans.filter((s: any) => s.status === 'INACTIVE').length})
        </button>
        <button
          class="filter-chip"
          class:active={statusFilter === 'ENDED'}
          onclick={() => (statusFilter = 'ENDED')}
        >
          Encerradas ({data.scans.filter((s: any) => s.status === 'ENDED').length})
        </button>
      </div>
    </div>

    <!-- Scans List Grid -->
    <div class="scans-grid">
      {#each filteredScans as scan (scan.id)}
        <div class="scan-card" class:is-official={scan.is_official}>
          <div class="scan-card-header">
            <div class="scan-title-group">
              <h3 class="scan-name">{scan.name}</h3>
              <span class="scan-slug">/{scan.slug}</span>
            </div>

            <div class="scan-badges">
              {#if scan.is_official}
                <span class="badge-official">
                  <Shield size={12} />
                  <span>OFICIAL NOX</span>
                </span>
              {/if}
              <span class="status-pill status-{scan.status.toLowerCase()}">
                {scan.status === 'ACTIVE' ? 'Ativa' : scan.status === 'INACTIVE' ? 'Inativa' : 'Encerrada'}
              </span>
            </div>
          </div>

          {#if scan.description}
            <p class="scan-description">{scan.description}</p>
          {:else}
            <p class="scan-description muted">Nenhuma descrição cadastrada.</p>
          {/if}

          <!-- Metrics -->
          <div class="scan-metrics-row">
            <div class="metric-item" title="Obras atribuídas a esta scan">
              <BookOpen size={14} />
              <span class="metric-val">{scan.works_count}</span>
              <span class="metric-lbl">obras</span>
            </div>
            <div class="metric-item" title="Capítulos atribuídos">
              <Layers size={14} />
              <span class="metric-val">{scan.chapters_count}</span>
              <span class="metric-lbl">capítulos</span>
            </div>
            <div class="metric-item" title="Membros cadastrados na scan">
              <Users size={14} />
              <span class="metric-val">{scan.members_count}</span>
              <span class="metric-lbl">membros</span>
            </div>
          </div>

          <!-- Links & Actions -->
          <div class="scan-card-footer">
            <div class="footer-links">
              {#if scan.website}
                <a href={scan.website} target="_blank" rel="noopener noreferrer" class="link-btn" title="Website oficial">
                  <Globe size={14} />
                </a>
              {/if}
              {#if scan.discord}
                <a href={scan.discord} target="_blank" rel="noopener noreferrer" class="link-btn" title="Servidor do Discord">
                  <MessageCircle size={14} />
                </a>
              {/if}
              <a href="/scans/{scan.slug}" target="_blank" rel="noopener noreferrer" class="link-btn" title="Página pública no site">
                <ExternalLink size={14} />
              </a>
            </div>

            <div class="footer-actions">
              <button class="btn-icon edit" onclick={() => openEditModal(scan)} title="Editar scan">
                <Edit3 size={15} />
                <span>Editar</span>
              </button>
              {#if !scan.is_official}
                <button
                  class="btn-icon delete"
                  onclick={() => handleDeleteScan(scan)}
                  title="Excluir scan"
                  disabled={busy}
                >
                  <Trash2 size={15} />
                </button>
              {/if}
            </div>
          </div>
        </div>
      {/each}

      {#if !filteredScans.length}
        <div class="empty-state">
          <Users size={40} class="empty-icon" />
          <p class="empty-text">Nenhuma scan encontrada com os filtros atuais.</p>
        </div>
      {/if}
    </div>

  {:else if activeSection === 'partner_requests'}
    <!-- Partner Requests Toolbar -->
    <div class="toolbar-card">
      <div class="search-box">
        <Search size={16} class="search-icon" />
        <input
          type="text"
          placeholder="Buscar pedido por scan ou solicitante…"
          bind:value={search}
          class="search-input"
        />
      </div>

      <div class="filter-group">
        <button
          class="filter-chip"
          class:active={partnerFilter === 'ALL'}
          onclick={() => (partnerFilter = 'ALL')}
        >
          Todos ({data.partnerRequests.length})
        </button>
        <button
          class="filter-chip"
          class:active={partnerFilter === 'PENDING'}
          onclick={() => (partnerFilter = 'PENDING')}
        >
          Pendentes ({pendingPartnersCount})
        </button>
        <button
          class="filter-chip"
          class:active={partnerFilter === 'APPROVED'}
          onclick={() => (partnerFilter = 'APPROVED')}
        >
          Aprovados ({data.partnerRequests.filter((r: any) => r.status === 'APPROVED').length})
        </button>
        <button
          class="filter-chip"
          class:active={partnerFilter === 'REJECTED'}
          onclick={() => (partnerFilter = 'REJECTED')}
        >
          Rejeitados ({data.partnerRequests.filter((r: any) => r.status === 'REJECTED').length})
        </button>
      </div>
    </div>

    <!-- Partner Requests Grid -->
    <div class="requests-grid">
      {#each filteredPartners as req (req.id)}
        <div class="request-card status-{req.status.toLowerCase()}">
          <div class="request-header">
            <div class="request-user">
              <UserAvatar
                avatarId={req.members?.avatar_id}
                displayName={req.members?.display_name || req.members?.username || 'Usuário'}
                size={40}
              />
              <div class="request-user-meta">
                <span class="request-user-name">{req.members?.display_name || req.members?.username}</span>
                <span class="request-user-sub">@{req.members?.username}</span>
              </div>
            </div>

            <span class="status-pill status-{req.status.toLowerCase()}">
              {req.status === 'PENDING' ? 'Pendente' : req.status === 'APPROVED' ? 'Aprovado' : 'Rejeitado'}
            </span>
          </div>

          <div class="request-body">
            <div class="request-target-box">
              <span class="req-target-label">Scan Proposta:</span>
              <strong class="req-target-name">{req.scan_name}</strong>
              <span class="req-target-slug font-mono">/{req.scan_slug}</span>
            </div>

            {#if req.description}
              <p class="request-desc">{req.description}</p>
            {/if}

            <div class="request-links-row">
              {#if req.discord}
                <a href={req.discord} target="_blank" rel="noopener noreferrer" class="link-chip">
                  <MessageCircle size={13} />
                  <span>Discord</span>
                </a>
              {/if}
              {#if req.fluxer}
                <span class="link-chip">Fluxer: {req.fluxer}</span>
              {/if}
              {#if req.website}
                <a href={req.website} target="_blank" rel="noopener noreferrer" class="link-chip">
                  <Globe size={13} />
                  <span>Website</span>
                </a>
              {/if}
            </div>

            {#if req.sample_links}
              <div class="sample-links-box">
                <span class="sample-lbl">Amostras / Trabalhos:</span>
                <p class="sample-txt">{req.sample_links}</p>
              </div>
            {/if}

            {#if req.status === 'REJECTED' && req.rejection_reason}
              <div class="rejection-box">
                <AlertTriangle size={14} />
                <span>Motivo da recusa: {req.rejection_reason}</span>
              </div>
            {/if}
          </div>

          {#if req.status === 'PENDING'}
            <div class="request-actions-row">
              <form method="POST" action="?/reviewPartner" use:enhance>
                <input type="hidden" name="request_id" value={req.id} />
                <input type="hidden" name="action" value="APPROVE" />
                <button type="submit" class="btn-action-approve">
                  <Check size={14} />
                  <span>Aprovar Scan e Nomear Líder</span>
                </button>
              </form>

              <button
                type="button"
                class="btn-action-reject"
                onclick={() => {
                  rejectModalId = req.id;
                  rejectModalType = 'partner';
                  rejectReason = '';
                }}
              >
                <Ban size={14} />
                <span>Rejeitar</span>
              </button>
            </div>
          {/if}
        </div>
      {/each}

      {#if !filteredPartners.length}
        <div class="empty-state">
          <Sparkles size={40} class="empty-icon" />
          <p class="empty-text">Nenhum pedido de parceria encontrado com os filtros atuais.</p>
        </div>
      {/if}
    </div>

  {:else if activeSection === 'project_requests'}
    <!-- Project Requests Toolbar -->
    <div class="toolbar-card">
      <div class="search-box">
        <Search size={16} class="search-icon" />
        <input
          type="text"
          placeholder="Buscar projeto por obra ou scan…"
          bind:value={search}
          class="search-input"
        />
      </div>

      <div class="filter-group">
        <button
          class="filter-chip"
          class:active={projectFilter === 'ALL'}
          onclick={() => (projectFilter = 'ALL')}
        >
          Todos ({data.projectRequests.length})
        </button>
        <button
          class="filter-chip"
          class:active={projectFilter === 'PENDING'}
          onclick={() => (projectFilter = 'PENDING')}
        >
          Pendentes ({pendingProjectsCount})
        </button>
        <button
          class="filter-chip"
          class:active={projectFilter === 'APPROVED'}
          onclick={() => (projectFilter = 'APPROVED')}
        >
          Aprovados ({data.projectRequests.filter((r: any) => r.status === 'APPROVED').length})
        </button>
        <button
          class="filter-chip"
          class:active={projectFilter === 'REJECTED'}
          onclick={() => (projectFilter = 'REJECTED')}
        >
          Rejeitados ({data.projectRequests.filter((r: any) => r.status === 'REJECTED').length})
        </button>
      </div>
    </div>

    <!-- Project Requests Grid -->
    <div class="requests-grid">
      {#each filteredProjects as req (req.id)}
        <div class="request-card status-{req.status.toLowerCase()}">
          <div class="request-header">
            <div class="request-user">
              {#if req.scans?.logo_id}
                <img src="/media/{req.scans.logo_id}" alt="" class="scan-mini-logo" />
              {:else}
                <div class="scan-mini-fallback"><Users size={16} /></div>
              {/if}
              <div class="request-user-meta">
                <span class="request-user-name">{req.scans?.name}</span>
                <span class="request-user-sub">Solicitado por @{req.members?.username}</span>
              </div>
            </div>

            <span class="status-pill status-{req.status.toLowerCase()}">
              {req.status === 'PENDING' ? 'Pendente' : req.status === 'APPROVED' ? 'Aprovado' : 'Rejeitado'}
            </span>
          </div>

          <div class="request-body">
            <div class="obra-target-card">
              {#if req.works?.cover_id}
                <img src="/media/{req.works.cover_id}" alt="" class="obra-mini-cover" />
              {:else}
                <div class="obra-mini-placeholder">NOX</div>
              {/if}
              <div class="obra-target-info">
                <span class="obra-target-label">Obra Solicitada:</span>
                <strong class="obra-target-title">{req.works?.title}</strong>
                <a href="/obra/{req.works?.slug}" target="_blank" class="obra-link">Ver no catálogo ↗</a>
              </div>
            </div>

            {#if req.message}
              <p class="request-desc">"{req.message}"</p>
            {/if}

            {#if req.status === 'REJECTED' && req.rejection_reason}
              <div class="rejection-box">
                <AlertTriangle size={14} />
                <span>Motivo da recusa: {req.rejection_reason}</span>
              </div>
            {/if}
          </div>

          {#if req.status === 'PENDING'}
            <div class="request-actions-row">
              <form method="POST" action="?/reviewProject" use:enhance>
                <input type="hidden" name="request_id" value={req.id} />
                <input type="hidden" name="action" value="APPROVE" />
                <button type="submit" class="btn-action-approve">
                  <Check size={14} />
                  <span>Vincular Obra à Scan</span>
                </button>
              </form>

              <button
                type="button"
                class="btn-action-reject"
                onclick={() => {
                  rejectModalId = req.id;
                  rejectModalType = 'project';
                  rejectReason = '';
                }}
              >
                <Ban size={14} />
                <span>Rejeitar</span>
              </button>
            </div>
          {/if}
        </div>
      {/each}

      {#if !filteredProjects.length}
        <div class="empty-state">
          <BookOpen size={40} class="empty-icon" />
          <p class="empty-text">Nenhuma solicitação de projeto encontrada com os filtros atuais.</p>
        </div>
      {/if}
    </div>
  {/if}

  <!-- Rejection Modal -->
  {#if rejectModalId}
    <div class="modal-backdrop" onclick={() => (rejectModalId = null)}>
      <div class="modal-card mini-reject-modal" onclick={(e) => e.stopPropagation()}>
        <div class="modal-header">
          <h2 class="modal-title">Recusar Solicitação</h2>
          <button class="btn-close-modal" onclick={() => (rejectModalId = null)}>
            <X size={18} />
          </button>
        </div>

        <form
          method="POST"
          action={rejectModalType === 'partner' ? '?/reviewPartner' : '?/reviewProject'}
          use:enhance={() => {
            reviewLoading = true;
            return async ({ update }) => {
              reviewLoading = false;
              rejectModalId = null;
              await update();
            };
          }}
          class="modal-form"
        >
          <input type="hidden" name="request_id" value={rejectModalId} />
          <input type="hidden" name="action" value="REJECT" />

          <div class="form-group">
            <label for="reject-reason" class="form-label">Motivo da Recusa (Opcional — exibido para o solicitante)</label>
            <textarea
              id="reject-reason"
              name="reason"
              rows={3}
              class="form-textarea"
              bind:value={rejectReason}
              placeholder="Ex: Já existe equipe ativa responsável por este projeto..."
            ></textarea>
          </div>

          <div class="modal-actions">
            <button type="button" class="btn-secondary" onclick={() => (rejectModalId = null)}>
              Cancelar
            </button>
            <button type="submit" class="btn-danger-confirm" disabled={reviewLoading}>
              <Ban size={15} />
              <span>Confirmar Recusa</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  {/if}

  <!-- Create / Edit Modal -->
  {#if showModal}
    <div class="modal-backdrop" onclick={() => (showModal = false)}>
      <div class="modal-card" onclick={(e) => e.stopPropagation()}>
        <div class="modal-header">
          <h2 class="modal-title">{editingScan ? 'Editar Scan' : 'Nova Scan'}</h2>
          <button class="btn-close-modal" onclick={() => (showModal = false)}>
            <X size={18} />
          </button>
        </div>

        <form onsubmit={handleSaveScan} class="modal-form">
          <div class="form-row">
            <div class="form-group flex-1">
              <label for="scan-name" class="form-label">Nome da Scan *</label>
              <input
                id="scan-name"
                type="text"
                class="form-input"
                value={formName}
                oninput={(e) => handleNameChange((e.currentTarget as HTMLInputElement).value)}
                placeholder="Ex: Project Nox, Hanami Scans"
                required
              />
            </div>
            <div class="form-group flex-1">
              <label for="scan-slug" class="form-label">Slug URL *</label>
              <input
                id="scan-slug"
                type="text"
                class="form-input font-mono"
                bind:value={formSlug}
                placeholder="ex: project-nox"
                required
              />
            </div>
          </div>

          <div class="form-group">
            <label for="scan-desc" class="form-label">Descrição Editorial</label>
            <textarea
              id="scan-desc"
              rows={3}
              class="form-textarea"
              bind:value={formDescription}
              placeholder="Apresentação do grupo, especialidades, créditos…"
            ></textarea>
          </div>

          <div class="form-row">
            <div class="form-group flex-1">
              <label for="scan-website" class="form-label">Website Oficial</label>
              <input
                id="scan-website"
                type="url"
                class="form-input"
                bind:value={formWebsite}
                placeholder="https://exemplo.com"
              />
            </div>
            <div class="form-group flex-1">
              <label for="scan-discord" class="form-label">Convite Discord</label>
              <input
                id="scan-discord"
                type="url"
                class="form-input"
                bind:value={formDiscord}
                placeholder="https://discord.gg/convite"
              />
            </div>
          </div>

          <div class="form-row items-center">
            <div class="form-group flex-1">
              <label for="scan-status" class="form-label">Status</label>
              <select id="scan-status" class="form-select" bind:value={formStatus}>
                <option value="ACTIVE">Ativa (Em operação)</option>
                <option value="INACTIVE">Inativa (Pausada)</option>
                <option value="ENDED">Encerrada (Histórica)</option>
              </select>
            </div>

            <div class="form-group flex-1 pt-4">
              <label class="checkbox-label">
                <input
                  type="checkbox"
                  class="form-checkbox"
                  bind:checked={formIsOfficial}
                  disabled={editingScan?.is_official && editingScan.slug === 'project-nox'}
                />
                <span>Scan Oficial Project Nox</span>
              </label>
            </div>
          </div>

          <div class="modal-actions">
            <button
              type="button"
              class="btn-secondary"
              onclick={() => (showModal = false)}
              disabled={busy}
            >
              Cancelar
            </button>
            <button type="submit" class="btn-primary" disabled={busy}>
              {#if busy}
                <Loader2 size={16} class="spin" />
                <span>Salvando…</span>
              {:else}
                <CheckCircle2 size={16} />
                <span>{editingScan ? 'Salvar Alterações' : 'Criar Scan'}</span>
              {/if}
            </button>
          </div>
        </form>
      </div>
    </div>
  {/if}
</div>

<style>
  .admin-page {
    display: flex;
    flex-direction: column;
    gap: 24px;
    padding: 32px;
    max-width: 1400px;
    margin: 0 auto;
  }

  .page-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 16px;
    flex-wrap: wrap;
  }

  .badge-mini {
    font-size: 10.5px;
    font-weight: 800;
    letter-spacing: 0.12em;
    color: #dfc28d;
    text-transform: uppercase;
  }

  .page-title {
    font-size: 26px;
    font-weight: 800;
    color: #ffffff;
    margin: 4px 0 6px;
  }

  .page-desc {
    font-size: 14px;
    color: #8c899e;
    margin: 0;
  }

  .btn-primary {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 10px 18px;
    border-radius: 10px;
    background: linear-gradient(135deg, #8b5cf6, #7c3aed);
    color: #ffffff;
    font-size: 13.5px;
    font-weight: 600;
    border: none;
    cursor: pointer;
    box-shadow: 0 4px 16px rgba(139, 92, 246, 0.35);
    transition: all 0.2s ease;
  }

  .btn-primary:hover:not(:disabled) {
    background: linear-gradient(135deg, #9333ea, #8b5cf6);
    transform: translateY(-1px);
    box-shadow: 0 6px 20px rgba(139, 92, 246, 0.45);
  }

  .btn-primary:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .btn-secondary {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 10px 18px;
    border-radius: 10px;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.1);
    color: #d1cde0;
    font-size: 13.5px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .btn-secondary:hover:not(:disabled) {
    background: rgba(255, 255, 255, 0.08);
    color: #ffffff;
  }

  .notice-banner {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 18px;
    border-radius: 10px;
    background: rgba(59, 130, 246, 0.12);
    border: 1px solid rgba(59, 130, 246, 0.3);
    color: #93c5fd;
    font-size: 13.5px;
  }

  .notice-banner.success {
    background: rgba(16, 185, 129, 0.12);
    border-color: rgba(16, 185, 129, 0.3);
    color: #6ee7b7;
  }

  .notice-banner.error {
    background: rgba(239, 68, 68, 0.12);
    border-color: rgba(239, 68, 68, 0.3);
    color: #fca5a5;
  }

  .btn-close-notice {
    background: transparent;
    border: none;
    color: inherit;
    cursor: pointer;
    display: flex;
    align-items: center;
    padding: 4px;
  }

  /* Toolbar */
  .toolbar-card {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    flex-wrap: wrap;
    background: rgba(13, 16, 26, 0.6);
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: 14px;
    padding: 14px 18px;
  }

  .search-box {
    display: flex;
    align-items: center;
    gap: 10px;
    background: rgba(0, 0, 0, 0.3);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 10px;
    padding: 8px 14px;
    flex: 1;
    min-width: 260px;
  }

  :global(.search-icon) {
    color: #8c899e;
  }

  .search-input {
    background: transparent;
    border: none;
    color: #ffffff;
    font-size: 13.5px;
    outline: none;
    width: 100%;
  }

  .filter-group {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }

  .filter-chip {
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.07);
    color: #9d99ab;
    padding: 6px 14px;
    border-radius: 8px;
    font-size: 12px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .filter-chip:hover {
    background: rgba(255, 255, 255, 0.06);
    color: #ffffff;
  }

  .filter-chip.active {
    background: rgba(139, 92, 246, 0.15);
    border-color: rgba(139, 92, 246, 0.4);
    color: #c4b5fd;
    font-weight: 600;
  }

  /* Scans Grid */
  .scans-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(360px, 1fr));
    gap: 18px;
  }

  .scan-card {
    display: flex;
    flex-direction: column;
    background: rgba(13, 16, 26, 0.65);
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: 14px;
    padding: 20px;
    backdrop-filter: blur(10px);
    transition: all 0.2s ease;
  }

  .scan-card:hover {
    border-color: rgba(255, 255, 255, 0.12);
    transform: translateY(-2px);
  }

  .scan-card.is-official {
    border-color: rgba(201, 170, 115, 0.35);
    background: linear-gradient(180deg, rgba(201, 170, 115, 0.04) 0%, rgba(13, 16, 26, 0.65) 100%);
  }

  .scan-card-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 12px;
    margin-bottom: 12px;
  }

  .scan-name {
    font-size: 17px;
    font-weight: 700;
    color: #ffffff;
    margin: 0 0 2px;
  }

  .scan-slug {
    font-size: 12px;
    font-family: monospace;
    color: #8c899e;
  }

  .scan-badges {
    display: flex;
    align-items: center;
    gap: 6px;
    flex-wrap: wrap;
  }

  .badge-official {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-size: 10px;
    font-weight: 800;
    letter-spacing: 0.08em;
    color: #dfc28d;
    background: rgba(201, 170, 115, 0.15);
    border: 1px solid rgba(201, 170, 115, 0.4);
    padding: 3px 7px;
    border-radius: 5px;
  }

  .status-pill {
    font-size: 10.5px;
    font-weight: 700;
    padding: 2px 8px;
    border-radius: 4px;
  }

  .status-pill.status-active {
    background: rgba(16, 185, 129, 0.15);
    color: #34d399;
    border: 1px solid rgba(16, 185, 129, 0.3);
  }

  .status-pill.status-inactive {
    background: rgba(245, 158, 11, 0.15);
    color: #fbbf24;
    border: 1px solid rgba(245, 158, 11, 0.3);
  }

  .status-pill.status-ended {
    background: rgba(239, 68, 68, 0.15);
    color: #f87171;
    border: 1px solid rgba(239, 68, 68, 0.3);
  }

  .scan-description {
    font-size: 13px;
    line-height: 1.5;
    color: #b5b1c7;
    margin: 0 0 16px;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  .scan-description.muted {
    color: #635f72;
    font-style: italic;
  }

  .scan-metrics-row {
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 10px 14px;
    background: rgba(255, 255, 255, 0.025);
    border: 1px solid rgba(255, 255, 255, 0.05);
    border-radius: 10px;
    margin-bottom: 16px;
  }

  .metric-item {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: 12px;
    color: #8c899e;
  }

  .metric-val {
    font-weight: 700;
    color: #ffffff;
  }

  .scan-card-footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 12px;
    margin-top: auto;
    padding-top: 12px;
    border-top: 1px solid rgba(255, 255, 255, 0.05);
  }

  .footer-links {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .link-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    border-radius: 8px;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.08);
    color: #8c899e;
    transition: all 0.2s ease;
  }

  .link-btn:hover {
    background: rgba(255, 255, 255, 0.08);
    color: #ffffff;
  }

  .footer-actions {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .btn-icon {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 6px 12px;
    border-radius: 8px;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.08);
    color: #d1cde0;
    transition: all 0.2s ease;
  }

  .btn-icon.edit:hover {
    background: rgba(139, 92, 246, 0.15);
    border-color: rgba(139, 92, 246, 0.35);
    color: #c4b5fd;
  }

  .btn-icon.delete {
    padding: 6px 9px;
    color: #f87171;
  }

  .btn-icon.delete:hover:not(:disabled) {
    background: rgba(239, 68, 68, 0.15);
    border-color: rgba(239, 68, 68, 0.35);
    color: #fca5a5;
  }

  .empty-state {
    grid-column: 1 / -1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 64px 20px;
    text-align: center;
    color: #6c687e;
  }

  .empty-icon {
    margin-bottom: 12px;
    opacity: 0.5;
  }

  /* Modal */
  .modal-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.75);
    backdrop-filter: blur(8px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 999;
    padding: 20px;
  }

  .modal-card {
    background: #0f121d;
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 18px;
    width: 100%;
    max-width: 600px;
    max-height: 90vh;
    overflow-y: auto;
    box-shadow: 0 20px 50px rgba(0, 0, 0, 0.8);
    padding: 24px;
  }

  .modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 20px;
  }

  .modal-title {
    font-size: 20px;
    font-weight: 800;
    color: #ffffff;
    margin: 0;
  }

  .btn-close-modal {
    background: transparent;
    border: none;
    color: #8c899e;
    cursor: pointer;
    padding: 4px;
  }

  .btn-close-modal:hover {
    color: #ffffff;
  }

  .modal-form {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .form-row {
    display: flex;
    gap: 14px;
    flex-wrap: wrap;
  }

  .form-row.items-center {
    align-items: center;
  }

  .flex-1 {
    flex: 1;
    min-width: 220px;
  }

  .form-group {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .form-label {
    font-size: 12px;
    font-weight: 700;
    color: #b5b1c7;
  }

  .form-input,
  .form-textarea,
  .form-select {
    background: rgba(0, 0, 0, 0.35);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 10px;
    padding: 10px 14px;
    color: #ffffff;
    font-size: 13.5px;
    outline: none;
    transition: all 0.2s ease;
  }

  .form-input:focus,
  .form-textarea:focus,
  .form-select:focus {
    border-color: #8b5cf6;
    background: rgba(0, 0, 0, 0.5);
  }

  .form-textarea {
    resize: vertical;
  }

  .font-mono {
    font-family: monospace;
  }

  .checkbox-label {
    display: inline-flex;
    align-items: center;
    gap: 10px;
    font-size: 13px;
    font-weight: 600;
    color: #dfc28d;
    cursor: pointer;
  }

  .form-checkbox {
    width: 18px;
    height: 18px;
    accent-color: #8b5cf6;
    cursor: pointer;
  }

  .pt-4 {
    padding-top: 16px;
  }

  .modal-actions {
    display: flex;
    justify-content: flex-end;
    gap: 12px;
    margin-top: 12px;
    padding-top: 16px;
    border-top: 1px solid rgba(255, 255, 255, 0.06);
  }

  :global(.spin) {
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    from {
      transform: rotate(0deg);
    }
    to {
      transform: rotate(360deg);
    }
  }

  /* Tabs Bar */
  .admin-tabs-bar {
    display: flex;
    align-items: center;
    gap: 12px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
    padding-bottom: 12px;
    margin-bottom: 8px;
    flex-wrap: wrap;
  }

  .admin-tab-btn {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 10px 18px;
    border-radius: 10px;
    background: transparent;
    border: 1px solid transparent;
    color: #8c899e;
    font-size: 13.5px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .admin-tab-btn:hover {
    background: rgba(255, 255, 255, 0.04);
    color: #ffffff;
  }

  .admin-tab-btn.active {
    background: rgba(139, 92, 246, 0.15);
    border-color: rgba(139, 92, 246, 0.35);
    color: #c4b5fd;
  }

  .count-badge-glow {
    font-size: 11px;
    font-weight: 800;
    padding: 2px 7px;
    border-radius: 999px;
    background: #8b5cf6;
    color: #ffffff;
    box-shadow: 0 0 10px rgba(139, 92, 246, 0.6);
  }

  /* Requests Grid */
  .requests-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(380px, 1fr));
    gap: 18px;
  }

  .request-card {
    display: flex;
    flex-direction: column;
    background: rgba(13, 16, 26, 0.7);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 16px;
    padding: 20px;
    backdrop-filter: blur(12px);
    transition: all 0.2s ease;
  }

  .request-card.status-pending {
    border-color: rgba(139, 92, 246, 0.3);
  }

  .request-card.status-approved {
    border-color: rgba(16, 185, 129, 0.25);
  }

  .request-card.status-rejected {
    border-color: rgba(239, 68, 68, 0.2);
    opacity: 0.85;
  }

  .request-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 12px;
    margin-bottom: 16px;
  }

  .request-user {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .request-user-meta {
    display: flex;
    flex-direction: column;
  }

  .request-user-name {
    font-size: 14px;
    font-weight: 700;
    color: #ffffff;
  }

  .request-user-sub {
    font-size: 12px;
    color: #8c899e;
  }

  .request-body {
    display: flex;
    flex-direction: column;
    gap: 12px;
    margin-bottom: 16px;
    flex: 1;
  }

  .request-target-box {
    display: flex;
    flex-direction: column;
    padding: 10px 14px;
    background: rgba(255, 255, 255, 0.025);
    border: 1px solid rgba(255, 255, 255, 0.05);
    border-radius: 10px;
  }

  .req-target-label {
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: #8c899e;
    font-weight: 700;
  }

  .req-target-name {
    font-size: 16px;
    font-weight: 800;
    color: #ffffff;
    margin-top: 2px;
  }

  .req-target-slug {
    font-size: 12px;
    color: #c4b5fd;
  }

  .request-desc {
    font-size: 13px;
    color: #b5b1c7;
    line-height: 1.5;
    margin: 0;
  }

  .request-links-row {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  .link-chip {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    font-size: 12px;
    padding: 4px 10px;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 8px;
    color: #cbd5e1;
    text-decoration: none;
    transition: all 0.15s ease;
  }

  .link-chip:hover {
    color: #ffffff;
    background: rgba(255, 255, 255, 0.08);
  }

  .sample-links-box {
    padding: 10px 12px;
    background: rgba(0, 0, 0, 0.25);
    border: 1px solid rgba(255, 255, 255, 0.04);
    border-radius: 8px;
  }

  .sample-lbl {
    font-size: 11px;
    font-weight: 700;
    color: #8c899e;
    display: block;
    margin-bottom: 4px;
  }

  .sample-txt {
    font-size: 12px;
    color: #cbd5e1;
    margin: 0;
    word-break: break-all;
    white-space: pre-wrap;
  }

  .rejection-box {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    background: rgba(239, 68, 68, 0.1);
    border: 1px solid rgba(239, 68, 68, 0.25);
    border-radius: 8px;
    color: #fca5a5;
    font-size: 12.5px;
  }

  .request-actions-row {
    display: flex;
    gap: 10px;
    margin-top: auto;
    padding-top: 14px;
    border-top: 1px solid rgba(255, 255, 255, 0.06);
  }

  .btn-action-approve {
    flex: 1;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    padding: 8px 14px;
    border-radius: 8px;
    background: rgba(16, 185, 129, 0.15);
    border: 1px solid rgba(16, 185, 129, 0.35);
    color: #34d399;
    font-size: 12.5px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .btn-action-approve:hover {
    background: rgba(16, 185, 129, 0.25);
    color: #6ee7b7;
  }

  .btn-action-reject {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    padding: 8px 14px;
    border-radius: 8px;
    background: rgba(239, 68, 68, 0.12);
    border: 1px solid rgba(239, 68, 68, 0.3);
    color: #f87171;
    font-size: 12.5px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .btn-action-reject:hover {
    background: rgba(239, 68, 68, 0.22);
    color: #fca5a5;
  }

  .scan-mini-logo {
    width: 38px;
    height: 38px;
    border-radius: 8px;
    object-fit: cover;
  }

  .scan-mini-fallback {
    width: 38px;
    height: 38px;
    border-radius: 8px;
    background: rgba(139, 92, 246, 0.15);
    border: 1px solid rgba(139, 92, 246, 0.3);
    display: flex;
    align-items: center;
    justify-content: center;
    color: #c4b5fd;
  }

  .obra-target-card {
    display: flex;
    gap: 12px;
    align-items: center;
    padding: 10px 12px;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: 10px;
  }

  .obra-mini-cover {
    width: 48px;
    height: 68px;
    object-fit: cover;
    border-radius: 6px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.5);
  }

  .obra-mini-placeholder {
    width: 48px;
    height: 68px;
    background: #1a1d2e;
    border-radius: 6px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 10px;
    font-weight: 800;
    color: #8c899e;
  }

  .obra-target-info {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .obra-target-label {
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: #8c899e;
    font-weight: 700;
  }

  .obra-target-title {
    font-size: 14px;
    font-weight: 700;
    color: #ffffff;
  }

  .obra-link {
    font-size: 12px;
    color: #8b5cf6;
    text-decoration: none;
  }

  .obra-link:hover {
    text-decoration: underline;
  }

  .mini-reject-modal {
    max-width: 480px;
  }

  .btn-danger-confirm {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 10px 18px;
    border-radius: 10px;
    background: #ef4444;
    color: #ffffff;
    border: none;
    font-size: 13.5px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .btn-danger-confirm:hover {
    background: #dc2626;
  }

  @media (max-width: 600px) {
    .admin-page {
      padding: 16px;
    }
    .scans-grid,
    .requests-grid {
      grid-template-columns: 1fr;
    }
  }
</style>
