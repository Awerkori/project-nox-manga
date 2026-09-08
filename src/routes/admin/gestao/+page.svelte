<script lang="ts">
  import { action } from '$lib/actions';
  import { invalidateAll } from '$app/navigation';
  import {
    Users,
    Shield,
    Mail,
    UserCheck,
    Search,
    X,
    MessageSquare,
    CheckCircle2,
    AlertCircle,
    UserPlus,
    Building2,
    RefreshCw,
    ShieldAlert,
    Trash2,
    RotateCcw
  } from '@lucide/svelte';

  let { data } = $props();

  let staff = $state<{ user_id: string; display_name: string; github_login: string }[]>([]);
  let staffLoaded = $state(false);
  let notice = $state(''),
    busy = $state(false),
    search = $state('');

  let members = $derived(
    (data.members || []).filter((m) =>
      ((m.username || '') + ' ' + (m.display_name || '')).toLowerCase().includes(search.toLowerCase())
    )
  );

  let adminCount = $derived(
    (data.members || []).filter((m) => m.access_roles?.role === 'ADMIN').length
  );
  let editorCount = $derived(
    (data.members || []).filter((m) => m.access_roles?.role === 'EDITOR').length
  );
  let suspendedCount = $derived(
    (data.members || []).filter((m) => Boolean(m.access_roles?.suspended)).length
  );

  async function staffAccess(id?: string) {
    busy = true;
    try {
      const response = await fetch(
        '/api/staff-access',
        id
          ? {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ id })
            }
          : {}
      );
      const result = await response.json();
      if (!response.ok) throw new Error(result.message);
      if (id) {
        notice = result.message;
        await invalidateAll();
      } else {
        staff = result.members;
        staffLoaded = true;
      }
    } catch (e) {
      notice = (e as Error).message;
    } finally {
      busy = false;
    }
  }

  async function update(name: string, details: Record<string, unknown>) {
    busy = true;
    try {
      await action('owner', name, details);
      notice = 'Alteração registrada com sucesso.';
      await invalidateAll();
      setTimeout(() => {
        if (notice === 'Alteração registrada com sucesso.') notice = '';
      }, 3500);
    } catch (e) {
      notice = (e as Error).message;
    } finally {
      busy = false;
    }
  }

  async function invite(event: SubmitEvent) {
    event.preventDefault();
    busy = true;
    try {
      const form = event.currentTarget as HTMLFormElement;
      const f = new FormData(form);
      const response = await fetch('/api/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: f.get('email') })
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message);
      notice = result.message;
      form.reset();
      await invalidateAll();
    } catch (e) {
      notice = (e as Error).message;
    } finally {
      busy = false;
    }
  }

  async function revoke(email: string) {
    busy = true;
    try {
      const response = await fetch('/api/invite', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message);
      notice = result.message;
      await invalidateAll();
    } catch (e) {
      notice = (e as Error).message;
    } finally {
      busy = false;
    }
  }
</script>

<svelte:head>
  <title>Usuários e Moderação — Nox Admin</title>
</svelte:head>

<div class="gestao-view">
  <!-- Header -->
  <header class="page-header">
    <div class="header-left">
      <span class="eyebrow">ADMINISTRAÇÃO DO SISTEMA</span>
      <h1>Pessoas & Comunidade</h1>
      <p class="subtitle">
        Gerencie permissões de acesso, convites da equipe editorial e moderação dos comentários dos leitores.
      </p>
    </div>

    <!-- Quick Stats -->
    <div class="stats-pills">
      <div class="stat-item">
        <span class="stat-num">{data.members.length}</span>
        <span class="stat-label">Usuários</span>
      </div>
      <div class="stat-item">
        <span class="stat-num">{editorCount + adminCount}</span>
        <span class="stat-label">Equipe</span>
      </div>
      <div class="stat-item">
        <span class="stat-num">{data.invites.length}</span>
        <span class="stat-label">Convites</span>
      </div>
      {#if suspendedCount > 0}
        <div class="stat-item warning">
          <span class="stat-num">{suspendedCount}</span>
          <span class="stat-label">Suspensos</span>
        </div>
      {/if}
    </div>
  </header>

  {#if notice}
    <div class="notice-banner" role="status">
      <span>{notice}</span>
      <button type="button" class="close-notice" onclick={() => (notice = '')}>
        <X size={14} />
      </button>
    </div>
  {/if}

  <!-- Section 1: Members Management -->
  <section class="panel members-section">
    <div class="section-header">
      <div class="title-with-icon">
        <Users size={18} class="section-icon" />
        <h2>Membros Registrados</h2>
      </div>

      <!-- Search Bar -->
      <div class="search-input-wrap">
        <Search size={15} class="search-icon" />
        <input
          class="control search-control"
          bind:value={search}
          aria-label="Buscar usuário"
          placeholder="Buscar por nome ou username…"
        />
        {#if search}
          <button type="button" class="clear-search-btn" onclick={() => (search = '')}>
            <X size={13} />
          </button>
        {/if}
      </div>
    </div>

    <!-- Desktop Table View -->
    <div class="table-container desktop-only">
      <table>
        <thead>
          <tr>
            <th>Usuário</th>
            <th>Cargo</th>
            <th>Situação</th>
            <th class="actions-th">Ações</th>
          </tr>
        </thead>
        <tbody>
          {#each members as m (m.id)}
            <tr class:suspended-row={m.access_roles?.suspended}>
              <td class="user-cell">
                <div class="avatar-circle">
                  {m.display_name?.charAt(0)?.toUpperCase() || m.username?.charAt(0)?.toUpperCase() || '?'}
                </div>
                <div class="user-info">
                  <strong>{m.display_name}</strong>
                  <span class="username-tag">@{m.username}</span>
                </div>
              </td>
              <td>
                <select
                  class="role-select"
                  class:role-admin={m.access_roles?.role === 'ADMIN'}
                  class:role-editor={m.access_roles?.role === 'EDITOR'}
                  value={m.access_roles?.role || 'USER'}
                  aria-label="Cargo de {m.display_name}"
                  disabled={busy}
                  onchange={(e) => update('role', { id: m.id, role: e.currentTarget.value })}
                >
                  <option value="USER">Leitor</option>
                  <option value="EDITOR">Editor</option>
                  <option value="ADMIN">Administrador</option>
                </select>
              </td>
              <td>
                {#if m.access_roles?.suspended}
                  <span class="status-pill suspended">
                    <span class="dot-suspended"></span>
                    Suspenso
                  </span>
                {:else}
                  <span class="status-pill active">
                    <span class="dot-active"></span>
                    Ativo
                  </span>
                {/if}
              </td>
              <td class="actions-cell">
                <button
                  class="button secondary compact"
                  class:danger-btn={!m.access_roles?.suspended}
                  disabled={busy}
                  onclick={() => update('suspend', { id: m.id, suspended: !m.access_roles?.suspended })}
                >
                  {m.access_roles?.suspended ? 'Reativar' : 'Suspender'}
                </button>
              </td>
            </tr>
          {/each}
          {#if members.length === 0}
            <tr>
              <td colspan="4" class="empty-table-cell">
                Nenhum usuário encontrado para "{search}".
              </td>
            </tr>
          {/if}
        </tbody>
      </table>
    </div>

    <!-- Mobile Cards View -->
    <div class="mobile-only mobile-cards-stack">
      {#each members as m (m.id)}
        <div class="mobile-user-card" class:suspended-card={m.access_roles?.suspended}>
          <div class="card-top">
            <div class="avatar-circle">
              {m.display_name?.charAt(0)?.toUpperCase() || m.username?.charAt(0)?.toUpperCase() || '?'}
            </div>
            <div class="user-info">
              <strong>{m.display_name}</strong>
              <span class="username-tag">@{m.username}</span>
            </div>
            <span class="status-pill {m.access_roles?.suspended ? 'suspended' : 'active'}">
              {m.access_roles?.suspended ? 'Suspenso' : 'Ativo'}
            </span>
          </div>

          <div class="card-controls">
            <label class="mobile-role-label">
              <span>Cargo:</span>
              <select
                class="role-select"
                class:role-admin={m.access_roles?.role === 'ADMIN'}
                class:role-editor={m.access_roles?.role === 'EDITOR'}
                value={m.access_roles?.role || 'USER'}
                aria-label="Cargo de {m.display_name}"
                disabled={busy}
                onchange={(e) => update('role', { id: m.id, role: e.currentTarget.value })}
              >
                <option value="USER">Leitor</option>
                <option value="EDITOR">Editor</option>
                <option value="ADMIN">Administrador</option>
              </select>
            </label>

            <button
              class="button secondary compact"
              class:danger-btn={!m.access_roles?.suspended}
              disabled={busy}
              onclick={() => update('suspend', { id: m.id, suspended: !m.access_roles?.suspended })}
            >
              {m.access_roles?.suspended ? 'Reativar' : 'Suspender'}
            </button>
          </div>
        </div>
      {/each}
    </div>
  </section>

  <!-- Section 2: Invites & Staff Bridge (2 Columns) -->
  <div class="two-col-grid">
    <!-- Email Invites Card -->
    <section class="panel invites-panel">
      <div class="panel-heading">
        <div class="title-with-icon">
          <Mail size={18} class="section-icon" />
          <h2>Convidar Editor por E-mail</h2>
        </div>
        <p class="small muted">
          A pessoa receberá a permissão de EDITOR ao fazer login com o e-mail informado. Não concede privilégios de Administrador.
        </p>
      </div>

      <form class="invite-form" onsubmit={invite}>
        <div class="invite-input-row">
          <input
            class="control"
            type="email"
            name="email"
            placeholder="editor@exemplo.com"
            aria-label="E-mail do editor"
            required
            maxlength="254"
          />
          <button class="button primary" disabled={busy}>
            <UserPlus size={15} />
            <span>Registrar convite</span>
          </button>
        </div>
      </form>

      {#if data.invites.length}
        <div class="pending-invites-block">
          <h3>Convites Pendentes ({data.invites.length})</h3>
          <div class="invites-list">
            {#each data.invites as invitation (invitation.email)}
              <div class="invite-row">
                <span class="invite-email">{invitation.email}</span>
                <button
                  type="button"
                  class="button secondary compact danger-text"
                  disabled={busy}
                  onclick={() => revoke(invitation.email)}
                >
                  Revogar convite
                </button>
              </div>
            {/each}
          </div>
        </div>
      {/if}
    </section>

    <!-- Staff Bridge Card -->
    <section class="panel staff-panel">
      <div class="panel-heading">
        <div class="title-with-icon">
          <Building2 size={18} class="section-icon" />
          <h2>Equipe Central da Staff</h2>
        </div>
        <p class="small muted">
          Sincronização estritamente unidirecional (leitura). Autorize membros ativos da Central da Staff para operar capítulos e obras no Manga.
        </p>
      </div>

      <div class="staff-action-bar">
        <button class="button secondary" disabled={busy} onclick={() => staffAccess()}>
          <RefreshCw size={14} class={busy ? 'spin' : ''} />
          <span>Consultar membros ativos</span>
        </button>
      </div>

      {#if staffLoaded}
        <div class="staff-members-list">
          {#each staff as person (person.user_id)}
            <div class="staff-row">
              <div class="staff-info">
                <strong>{person.display_name}</strong>
                <span class="small muted">@{person.github_login}</span>
              </div>
              <button
                class="button secondary compact"
                disabled={busy}
                onclick={() => staffAccess(person.user_id)}
              >
                Autorizar acesso editorial
              </button>
            </div>
          {:else}
            <p class="small muted empty-staff">Nenhum membro ativo retornado pela Central.</p>
          {/each}
        </div>
      {/if}
    </section>
  </div>

  <!-- Section 3: Comments Moderation -->
  <section class="panel comments-section">
    <div class="panel-heading">
      <div class="title-with-icon">
        <MessageSquare size={18} class="section-icon" />
        <h2>Moderação de Comentários ({data.comments.length})</h2>
      </div>
      <p class="small muted">
        Supervisione os comentários deixados pelos leitores nas obras e capítulos. Ocultações são imediatas.
      </p>
    </div>

    {#if data.comments.length === 0}
      <p class="small muted empty-comments">Nenhum comentário registrado na plataforma ainda.</p>
    {:else}
      <div class="comments-grid">
        {#each data.comments as comment (comment.id)}
          <article class="comment-card" class:comment-removed={comment.removed}>
            <div class="comment-card-top">
              <div class="comment-meta">
                <strong>{comment.members?.display_name || 'Leitor Anônimo'}</strong>
                <span class="work-link-text">em {comment.works?.title || 'Obra'}</span>
              </div>
              <span class="chip {comment.removed ? 'chip-danger' : 'chip-success'}">
                {comment.removed ? 'Removido' : 'Visível'}
              </span>
            </div>

            <p class="comment-body">{comment.body}</p>

            <div class="comment-actions">
              <button
                class="button secondary compact"
                disabled={busy}
                onclick={() => update('moderate', { id: comment.id, removed: !comment.removed })}
              >
                {#if comment.removed}
                  <RotateCcw size={13} />
                  <span>Restaurar</span>
                {:else}
                  <Trash2 size={13} />
                  <span>Remover comentário</span>
                {/if}
              </button>
            </div>
          </article>
        {/each}
      </div>
    {/if}
  </section>
</div>

<style>
  .gestao-view {
    display: flex;
    flex-direction: column;
    gap: 24px;
  }

  .page-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 20px;
    flex-wrap: wrap;
  }

  .header-left h1 {
    font-size: 28px;
    font-weight: 700;
    margin: 0 0 4px;
    color: #f8fafc;
    letter-spacing: -0.02em;
  }

  .subtitle {
    font-size: 13px;
    color: var(--muted);
    margin: 0;
  }

  .stats-pills {
    display: flex;
    gap: 12px;
    flex-wrap: wrap;
  }

  .stat-item {
    background: #110d1a;
    border: 1px solid #231b31;
    border-radius: 10px;
    padding: 8px 16px;
    display: flex;
    flex-direction: column;
    align-items: center;
    min-width: 60px;
  }

  .stat-item.warning {
    border-color: rgba(239, 68, 68, 0.4);
    background: rgba(239, 68, 68, 0.08);
  }

  .stat-num {
    font-size: 16px;
    font-weight: 700;
    color: #f8fafc;
  }

  .stat-item.warning .stat-num {
    color: #f87171;
  }

  .stat-label {
    font-size: 10px;
    color: var(--muted);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .notice-banner {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 12px 18px;
    border-radius: 10px;
    background: rgba(168, 85, 247, 0.12);
    border: 1px solid rgba(168, 85, 247, 0.28);
    color: #e2e8f0;
    font-size: 13px;
  }

  .close-notice {
    background: transparent;
    border: 0;
    color: #94a3b8;
    cursor: pointer;
    display: flex;
    align-items: center;
    padding: 2px;
  }

  .panel {
    background: #110d1a;
    border: 1px solid #231b31;
    border-radius: 14px;
    padding: 22px;
  }

  .section-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    margin-bottom: 18px;
    flex-wrap: wrap;
  }

  .title-with-icon {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  :global(.section-icon) {
    color: var(--purple, #a78bfa);
  }

  .section-header h2,
  .panel-heading h2 {
    font-size: 18px;
    font-weight: 600;
    margin: 0;
    color: #f8fafc;
  }

  .panel-heading {
    display: flex;
    flex-direction: column;
    gap: 6px;
    margin-bottom: 18px;
  }

  /* Search */
  .search-input-wrap {
    position: relative;
    display: flex;
    align-items: center;
    min-width: 260px;
  }

  @media (max-width: 600px) {
    .search-input-wrap {
      width: 100%;
    }
  }

  :global(.search-icon) {
    position: absolute;
    left: 12px;
    color: #64748b;
    pointer-events: none;
  }

  .search-control {
    width: 100%;
    background: #090610;
    border: 1px solid #231b31;
    border-radius: 8px;
    padding: 9px 36px 9px 34px;
    color: #f8fafc;
    font-size: 13px;
    box-sizing: border-box;
  }

  .search-control:focus {
    outline: none;
    border-color: #9333ea;
  }

  .clear-search-btn {
    position: absolute;
    right: 10px;
    background: transparent;
    border: 0;
    color: #64748b;
    cursor: pointer;
    display: flex;
    align-items: center;
    padding: 2px;
  }

  /* Table */
  .desktop-only {
    display: block;
  }

  .mobile-only {
    display: none;
  }

  @media (max-width: 768px) {
    .desktop-only {
      display: none;
    }
    .mobile-only {
      display: flex;
    }
  }

  .table-container {
    overflow-x: auto;
    border-radius: 8px;
    border: 1px solid #1c1527;
  }

  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 13px;
    text-align: left;
  }

  th {
    padding: 12px 16px;
    background: #0d0915;
    color: #94a3b8;
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    border-bottom: 1px solid #1c1527;
  }

  td {
    padding: 12px 16px;
    border-bottom: 1px solid #171120;
    color: #cbd5e1;
    vertical-align: middle;
  }

  tr:last-child td {
    border-bottom: 0;
  }

  tr:hover td {
    background: rgba(255, 255, 255, 0.015);
  }

  .suspended-row td {
    opacity: 0.7;
  }

  .user-cell {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .avatar-circle {
    width: 34px;
    height: 34px;
    border-radius: 50%;
    background: linear-gradient(135deg, #4c1d95, #7c3aed);
    color: #ffffff;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 700;
    font-size: 13px;
    border: 1px solid rgba(255, 255, 255, 0.15);
    flex-shrink: 0;
  }

  .user-info {
    display: flex;
    flex-direction: column;
  }

  .user-info strong {
    color: #f1f5f9;
  }

  .username-tag {
    font-size: 11px;
    color: var(--muted);
  }

  .role-select {
    background: #0a0612;
    border: 1px solid #2d1f42;
    color: #cbd5e1;
    padding: 6px 10px;
    border-radius: 6px;
    font-size: 12px;
    font-weight: 500;
    cursor: pointer;
    outline: none;
    transition: all 0.15s ease;
  }

  .role-select.role-admin {
    border-color: rgba(234, 179, 8, 0.5);
    color: #fde047;
    background: #1a1505;
  }

  .role-select.role-editor {
    border-color: rgba(168, 85, 247, 0.5);
    color: #d8b4fe;
    background: #180c29;
  }

  .status-pill {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: 12px;
    font-weight: 500;
  }

  .status-pill.active {
    color: #34d399;
  }

  .status-pill.suspended {
    color: #f87171;
  }

  .dot-active {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: #10b981;
    box-shadow: 0 0 6px rgba(16, 185, 129, 0.6);
  }

  .dot-suspended {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: #ef4444;
  }

  .actions-cell {
    text-align: right;
  }

  .actions-th {
    text-align: right;
  }

  .danger-btn:hover:not(:disabled) {
    border-color: rgba(239, 68, 68, 0.4);
    color: #f87171;
  }

  .danger-text {
    color: #f87171 !important;
  }

  .empty-table-cell {
    text-align: center;
    padding: 24px;
    color: var(--muted);
  }

  /* Mobile cards */
  .mobile-cards-stack {
    flex-direction: column;
    gap: 12px;
  }

  .mobile-user-card {
    background: #0c0816;
    border: 1px solid #231b31;
    border-radius: 10px;
    padding: 14px;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .mobile-user-card.suspended-card {
    opacity: 0.7;
    border-color: rgba(239, 68, 68, 0.3);
  }

  .card-top {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .card-top .status-pill {
    margin-left: auto;
  }

  .card-controls {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    padding-top: 10px;
    border-top: 1px solid #1a1326;
  }

  .mobile-role-label {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 12px;
    color: var(--muted);
  }

  /* 2-col Grid */
  .two-col-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 24px;
  }

  @media (max-width: 860px) {
    .two-col-grid {
      grid-template-columns: 1fr;
    }
  }

  /* Invites */
  .invite-form {
    margin-bottom: 16px;
  }

  .invite-input-row {
    display: flex;
    gap: 10px;
  }

  @media (max-width: 500px) {
    .invite-input-row {
      flex-direction: column;
    }
  }

  .pending-invites-block {
    margin-top: 16px;
    padding-top: 16px;
    border-top: 1px solid #1c1527;
  }

  .pending-invites-block h3 {
    font-size: 13px;
    font-weight: 600;
    color: #cbd5e1;
    margin: 0 0 10px;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  .invites-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .invite-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    background: #090610;
    border: 1px solid #1e152d;
    padding: 8px 12px;
    border-radius: 8px;
  }

  .invite-email {
    font-size: 12px;
    color: #e2e8f0;
  }

  /* Staff bridge */
  .staff-action-bar {
    margin-bottom: 16px;
  }

  .staff-members-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .staff-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    background: #090610;
    border: 1px solid #1e152d;
    padding: 10px 14px;
    border-radius: 8px;
  }

  .staff-info {
    display: flex;
    flex-direction: column;
  }

  .staff-info strong {
    font-size: 13px;
    color: #f1f5f9;
  }

  .empty-staff,
  .empty-comments {
    padding: 16px 0;
  }

  /* Comments Moderation */
  .comments-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 14px;
  }

  @media (max-width: 800px) {
    .comments-grid {
      grid-template-columns: 1fr;
    }
  }

  .comment-card {
    background: #0c0816;
    border: 1px solid #231b31;
    border-radius: 10px;
    padding: 14px;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .comment-card.comment-removed {
    opacity: 0.6;
    border-style: dashed;
  }

  .comment-card-top {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 10px;
  }

  .comment-meta strong {
    font-size: 13px;
    color: #f1f5f9;
    display: block;
  }

  .work-link-text {
    font-size: 11px;
    color: var(--purple, #a78bfa);
  }

  .chip-success {
    background: rgba(16, 185, 129, 0.15);
    color: #34d399;
    border: 1px solid rgba(16, 185, 129, 0.3);
  }

  .chip-danger {
    background: rgba(239, 68, 68, 0.15);
    color: #f87171;
    border: 1px solid rgba(239, 68, 68, 0.3);
  }

  .comment-body {
    font-size: 12px;
    color: #cbd5e1;
    line-height: 1.5;
    margin: 0;
    white-space: pre-wrap;
    overflow-wrap: anywhere;
  }

  .comment-actions {
    margin-top: auto;
    padding-top: 8px;
    border-top: 1px solid #1a1326;
  }
</style>
