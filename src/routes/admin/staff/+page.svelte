<script lang="ts">
  import {
    Users,
    Shield,
    FileEdit,
    Plus,
    Search,
    X,
    CheckCircle2,
    AlertTriangle,
    Crown,
    UserCheck,
    UserX,
    Clock,
    ArrowRight
  } from '@lucide/svelte';
  import { enhance } from '$app/forms';
  import { relativeTime } from '$lib/types';

  let { data, form } = $props();

  let filterRole = $state<'ALL' | 'ADMIN' | 'EDITOR'>('ALL');
  let searchQuery = $state('');

  // Modals state
  let showAddModal = $state(false);
  let showRoleModal = $state<any | null>(null);
  let showRemoveModal = $state<any | null>(null);

  // User Picker search state
  let userSearchInput = $state('');
  let userSearchResults = $state<any[]>([]);
  let userSearchLoading = $state(false);
  let userSearchError = $state('');
  let selectedUser = $state<any | null>(null);
  let selectedNewRole = $state<'EDITOR' | 'ADMIN'>('EDITOR');
  let searchDebounceTimeout: any = null;

  let filteredStaff = $derived(
    (data.staff || []).filter((member: any) => {
      if (filterRole !== 'ALL' && member.role !== filterRole) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          member.displayName.toLowerCase().includes(q) ||
          member.username.toLowerCase().includes(q)
        );
      }
      return true;
    })
  );

  function handleUserSearchInput(e: Event) {
    const val = (e.target as HTMLInputElement).value;
    userSearchInput = val;
    clearTimeout(searchDebounceTimeout);
    if (val.trim().length < 2) {
      userSearchResults = [];
      userSearchLoading = false;
      return;
    }

    userSearchLoading = true;
    userSearchError = '';
    searchDebounceTimeout = setTimeout(async () => {
      try {
        const res = await fetch(`/api/internal/users/search?q=${encodeURIComponent(val.trim())}`);
        const json = await res.json();
        if (!res.ok) throw new Error(json.message || 'Falha ao buscar usuários.');
        userSearchResults = json.users || [];
      } catch (err: any) {
        userSearchError = err.message || 'Erro de conexão na busca.';
      } finally {
        userSearchLoading = false;
      }
    }, 280);
  }

  function openAddStaffModal() {
    selectedUser = null;
    selectedNewRole = 'EDITOR';
    userSearchInput = '';
    userSearchResults = [];
    userSearchError = '';
    showAddModal = true;
  }

  function closeAllModals() {
    showAddModal = false;
    showRoleModal = null;
    showRemoveModal = null;
    selectedUser = null;
  }
</script>

<svelte:head>
  <title>Gestão da Staff — Painel de Controle Project Nox</title>
</svelte:head>

<div class="staff-workspace">
  <!-- Header -->
  <header class="workspace-header">
    <div class="header-text-block">
      <div class="eyebrow-line">
        <span class="eyebrow-tag">EQUIPE</span>
        <span class="eyebrow-sep">·</span>
        <span class="eyebrow-date">GESTÃO DA STAFF</span>
      </div>
      <h1 class="heading">Equipe Editorial & Administradores</h1>
      <p class="subheading">
        Gerencie permissões da equipe, atribua cargos de Editor ou Administrador e controle o acesso operacional ao Project Nox.
      </p>
    </div>

    {#if data.isAdmin}
      <div class="header-actions">
        <button type="button" class="btn-primary-add" onclick={openAddStaffModal}>
          <Plus size={16} />
          <span>Adicionar Membro à Staff</span>
        </button>
      </div>
    {/if}
  </header>

  <!-- Feedback Banner -->
  {#if form?.error}
    <div class="feedback-banner error">
      <AlertTriangle size={16} />
      <span>{form.error}</span>
    </div>
  {:else if form?.success}
    <div class="feedback-banner success">
      <CheckCircle2 size={16} />
      <span>Operação realizada com sucesso na equipe.</span>
    </div>
  {/if}

  <!-- Operational Stats Summary -->
  <section class="stats-bar" aria-label="Métricas da Staff">
    <div class="stat-pill">
      <div class="stat-icon-circle blue">
        <Users size={16} />
      </div>
      <div class="stat-pill-info">
        <span class="stat-pill-label">Equipe Total:</span>
        <strong class="stat-pill-value">{data.counts.total}</strong>
      </div>
    </div>

    <div class="stat-pill">
      <div class="stat-icon-circle gold">
        <Crown size={16} />
      </div>
      <div class="stat-pill-info">
        <span class="stat-pill-label">Administradores:</span>
        <strong class="stat-pill-value">{data.counts.admins}</strong>
      </div>
    </div>

    <div class="stat-pill">
      <div class="stat-icon-circle purple">
        <FileEdit size={16} />
      </div>
      <div class="stat-pill-info">
        <span class="stat-pill-label">Editores:</span>
        <strong class="stat-pill-value">{data.counts.editors}</strong>
      </div>
    </div>
  </section>

  <!-- Filter & Search Toolbar -->
  <div class="toolbar">
    <div class="filter-tabs">
      <button
        type="button"
        class="filter-tab"
        class:active={filterRole === 'ALL'}
        onclick={() => (filterRole = 'ALL')}
      >
        <span>Todos</span>
        <span class="tab-badge">{data.counts.total}</span>
      </button>

      <button
        type="button"
        class="filter-tab"
        class:active={filterRole === 'ADMIN'}
        onclick={() => (filterRole = 'ADMIN')}
      >
        <span>Administradores</span>
        <span class="tab-badge">{data.counts.admins}</span>
      </button>

      <button
        type="button"
        class="filter-tab"
        class:active={filterRole === 'EDITOR'}
        onclick={() => (filterRole = 'EDITOR')}
      >
        <span>Editores</span>
        <span class="tab-badge">{data.counts.editors}</span>
      </button>
    </div>

    <div class="search-input-wrap">
      <span class="search-icon"><Search size={14} /></span>
      <input
        type="text"
        placeholder="Filtrar por nome ou @usuário..."
        bind:value={searchQuery}
        class="search-field"
      />
      {#if searchQuery}
        <button type="button" class="btn-clear-search" onclick={() => (searchQuery = '')}>
          <X size={13} />
        </button>
      {/if}
    </div>
  </div>

  <!-- Staff Members Grid -->
  {#if filteredStaff.length > 0}
    <div class="staff-grid">
      {#each filteredStaff as member (member.userId)}
        {@const isSelf = member.userId === data.currentUserId}
        <div class="staff-card" class:role-admin={member.role === 'ADMIN'}>
          <div class="card-top">
            <div class="avatar-wrap" class:admin-glow={member.role === 'ADMIN'}>
              {#if member.avatarId}
                <img src="/media/{member.avatarId}" alt="" class="avatar-img" />
              {:else}
                <div class="avatar-initial">
                  {member.displayName.charAt(0).toUpperCase()}
                </div>
              {/if}
            </div>

            <div class="member-meta">
              <div class="name-row">
                <strong class="member-display-name">{member.displayName}</strong>
                {#if isSelf}
                  <span class="self-tag">Você</span>
                {/if}
              </div>
              <span class="member-handle">@{member.username}</span>
            </div>

            <div class="role-badge" class:gold={member.role === 'ADMIN'} class:purple={member.role === 'EDITOR'}>
              {#if member.role === 'ADMIN'}
                <Crown size={12} />
                <span>Administrador</span>
              {:else}
                <FileEdit size={12} />
                <span>Editor</span>
              {/if}
            </div>
          </div>

          <div class="capabilities-box">
            {#if member.role === 'ADMIN'}
              <p class="cap-text">
                <strong>Acesso Total:</strong> Configurações globais, banco de dados, gestão da equipe e auditoria do sistema.
              </p>
            {:else}
              <p class="cap-text">
                <strong>Editorial:</strong> Criação e edição de obras, envio de capítulos, upload e moderação de denúncias.
              </p>
            {/if}
          </div>

          <div class="card-footer">
            <div class="joined-meta">
              <Clock size={12} />
              <span>Na equipe {relativeTime(member.updatedAt)}</span>
            </div>

            {#if data.isAdmin && !isSelf}
              <div class="card-actions">
                <button
                  type="button"
                  class="btn-card-action edit"
                  onclick={() => (showRoleModal = member)}
                >
                  <span>Alterar Cargo</span>
                </button>

                <button
                  type="button"
                  class="btn-card-action remove"
                  onclick={() => (showRemoveModal = member)}
                >
                  <UserX size={13} />
                  <span>Remover</span>
                </button>
              </div>
            {/if}
          </div>
        </div>
      {/each}
    </div>
  {:else}
    <div class="empty-state">
      <span class="empty-icon"><Users size={36} /></span>
      <h3 class="empty-title">Nenhum membro encontrado</h3>
      <p class="empty-desc">
        {searchQuery ? 'Nenhum membro da equipe corresponde à busca realizada.' : 'Nenhum membro nesta categoria de cargo.'}
      </p>
    </div>
  {/if}
</div>

<!-- MODAL 1: Adicionar Membro com User Picker -->
{#if showAddModal}
  <div class="modal-backdrop" onclick={closeAllModals} onkeydown={(e) => { if (e.key === 'Escape') closeAllModals(); }} role="presentation">
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
    <div class="modal-box" onclick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" tabindex="-1">
      <header class="modal-header">
        <div class="modal-header-info">
          <h3 class="modal-title">Adicionar Membro à Staff</h3>
          <p class="modal-subtitle">Pesquise pelo leitor cadastrado na comunidade e atribua o cargo.</p>
        </div>
        <button type="button" class="btn-close-modal" onclick={closeAllModals}>
          <X size={18} />
        </button>
      </header>

      <div class="modal-content">
        <!-- Step 1: User Picker Search -->
        <div class="form-field">
          <label for="picker-search" class="field-label">1. Buscar leitor da comunidade:</label>
          <div class="picker-search-input-wrap">
            <span class="picker-icon"><Search size={15} /></span>
            <input
              id="picker-search"
              type="text"
              class="picker-input"
              placeholder="Digite o @username ou nome de exibição..."
              value={userSearchInput}
              oninput={handleUserSearchInput}
              autocomplete="off"
            />
            {#if userSearchLoading}
              <span class="picker-spinner"></span>
            {/if}
          </div>

          {#if userSearchError}
            <span class="field-error">{userSearchError}</span>
          {/if}
        </div>

        <!-- Search Results Dropdown/List -->
        {#if userSearchResults.length > 0 && !selectedUser}
          <div class="user-picker-results">
            {#each userSearchResults as user}
              <button
                type="button"
                class="user-result-row"
                class:is-already-staff={user.isStaff}
                onclick={() => {
                  if (!user.isStaff) {
                    selectedUser = user;
                  }
                }}
              >
                <div class="user-result-avatar">
                  {#if user.avatar_id}
                    <img src="/media/{user.avatar_id}" alt="" class="avatar-img" />
                  {:else}
                    <span>{user.display_name.charAt(0).toUpperCase()}</span>
                  {/if}
                </div>
                <div class="user-result-meta">
                  <strong class="user-result-name">{user.display_name}</strong>
                  <span class="user-result-handle">@{user.username}</span>
                </div>
                {#if user.isStaff}
                  <span class="already-staff-tag">Já é {user.role}</span>
                {:else}
                  <span class="btn-select-user">Selecionar</span>
                {/if}
              </button>
            {/each}
          </div>
        {:else if userSearchInput.length >= 2 && !userSearchLoading && userSearchResults.length === 0 && !selectedUser}
          <div class="picker-no-results">
            <span>Nenhum membro encontrado com este termo.</span>
          </div>
        {/if}

        <!-- Step 2: Selected User Card -->
        {#if selectedUser}
          <div class="selected-user-card">
            <div class="selected-user-avatar">
              {#if selectedUser.avatar_id}
                <img src="/media/{selectedUser.avatar_id}" alt="" class="avatar-img" />
              {:else}
                <span>{selectedUser.display_name.charAt(0).toUpperCase()}</span>
              {/if}
            </div>
            <div class="selected-user-info">
              <strong class="selected-name">{selectedUser.display_name}</strong>
              <span class="selected-handle">@{selectedUser.username}</span>
            </div>
            <button
              type="button"
              class="btn-change-selection"
              onclick={() => (selectedUser = null)}
            >
              Trocar
            </button>
          </div>

          <!-- Step 3: Role Assignment Choice -->
          <form method="POST" action="?/promoteUser" use:enhance={() => {
            return async ({ result }) => {
              if (result.type === 'success') closeAllModals();
            };
          }}>
            <input type="hidden" name="userId" value={selectedUser.id} />
            <input type="hidden" name="role" value={selectedNewRole} />

            <div class="role-selector-section">
              <span class="field-label">2. Escolha o cargo a ser concedido:</span>

              <div class="role-cards-choice">
                <label class="role-choice-card" class:active={selectedNewRole === 'EDITOR'}>
                  <input
                    type="radio"
                    name="roleOption"
                    value="EDITOR"
                    checked={selectedNewRole === 'EDITOR'}
                    onchange={() => (selectedNewRole = 'EDITOR')}
                    class="role-radio-native"
                  />
                  <div class="role-choice-content">
                    <div class="role-choice-header">
                      <span class="role-choice-icon purple"><FileEdit size={16} /></span>
                      <strong>Editor Nox</strong>
                      <span class="role-choice-tag">Recomendado</span>
                    </div>
                    <p class="role-choice-desc">
                      Pode criar e editar obras, enviar capítulos, revisar mesa de edição e moderar denúncias de conteúdo.
                    </p>
                  </div>
                </label>

                <label class="role-choice-card" class:active={selectedNewRole === 'ADMIN'}>
                  <input
                    type="radio"
                    name="roleOption"
                    value="ADMIN"
                    checked={selectedNewRole === 'ADMIN'}
                    onchange={() => (selectedNewRole = 'ADMIN')}
                    class="role-radio-native"
                  />
                  <div class="role-choice-content">
                    <div class="role-choice-header">
                      <span class="role-choice-icon gold"><Crown size={16} /></span>
                      <strong>Administrador</strong>
                    </div>
                    <p class="role-choice-desc">
                      Acesso irrestrito a configurações sensíveis, gestão da equipe, suspensão de usuários e auditoria.
                    </p>
                  </div>
                </label>
              </div>
            </div>

            <footer class="modal-footer">
              <button type="button" class="btn-secondary-modal" onclick={closeAllModals}>
                Cancelar
              </button>
              <button type="submit" class="btn-primary-modal">
                <UserCheck size={15} />
                <span>Confirmar Adição à Equipe</span>
              </button>
            </footer>
          </form>
        {/if}
      </div>
    </div>
  </div>
{/if}

<!-- MODAL 2: Alterar Cargo de Membro Existente -->
{#if showRoleModal}
  <div class="modal-backdrop" onclick={closeAllModals} onkeydown={(e) => { if (e.key === 'Escape') closeAllModals(); }} role="presentation">
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
    <div class="modal-box small" onclick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" tabindex="-1">
      <header class="modal-header">
        <h3 class="modal-title">Alterar Cargo de {showRoleModal.displayName}</h3>
        <button type="button" class="btn-close-modal" onclick={closeAllModals}>
          <X size={18} />
        </button>
      </header>

      <form method="POST" action="?/updateRole" use:enhance={() => {
        return async ({ result }) => {
          if (result.type === 'success') closeAllModals();
        };
      }}>
        <input type="hidden" name="userId" value={showRoleModal.userId} />

        <div class="modal-content">
          <p class="modal-dialog-text">
            Selecione o novo nível de acesso para <strong>@{showRoleModal.username}</strong>:
          </p>

          <div class="role-switch-options">
            <label class="switch-option-label" class:selected={showRoleModal.role === 'EDITOR'}>
              <input type="radio" name="role" value="EDITOR" checked={showRoleModal.role === 'EDITOR'} />
              <div>
                <strong>Editor Nox</strong>
                <span>Criação, edição e publicação de capítulos</span>
              </div>
            </label>

            <label class="switch-option-label" class:selected={showRoleModal.role === 'ADMIN'}>
              <input type="radio" name="role" value="ADMIN" checked={showRoleModal.role === 'ADMIN'} />
              <div>
                <strong>Administrador</strong>
                <span>Acesso administrativo global ao painel</span>
              </div>
            </label>
          </div>
        </div>

        <footer class="modal-footer">
          <button type="button" class="btn-secondary-modal" onclick={closeAllModals}>
            Cancelar
          </button>
          <button type="submit" class="btn-primary-modal">
            Salvar Alteração
          </button>
        </footer>
      </form>
    </div>
  </div>
{/if}

<!-- MODAL 3: Remover Membro da Staff -->
{#if showRemoveModal}
  <div class="modal-backdrop" onclick={closeAllModals} onkeydown={(e) => { if (e.key === 'Escape') closeAllModals(); }} role="presentation">
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
    <div class="modal-box small" onclick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" tabindex="-1">
      <header class="modal-header">
        <div class="remove-header-cluster">
          <div class="remove-icon-wrap">
            <UserX size={20} />
          </div>
          <h3 class="modal-title">Remover da Equipe</h3>
        </div>
        <button type="button" class="btn-close-modal" onclick={closeAllModals}>
          <X size={18} />
        </button>
      </header>

      <form method="POST" action="?/updateRole" use:enhance={() => {
        return async ({ result }) => {
          if (result.type === 'success') closeAllModals();
        };
      }}>
        <input type="hidden" name="userId" value={showRemoveModal.userId} />
        <input type="hidden" name="role" value="USER" />

        <div class="modal-content">
          <p class="remove-warning-text">
            Tem certeza de que deseja remover <strong>{showRemoveModal.displayName}</strong> (@{showRemoveModal.username}) da equipe?
          </p>

          <div class="safety-reassurance-box">
            <span class="safety-icon"><CheckCircle2 size={15} /></span>
            <p class="safety-text">
              A conta de leitor, histórico de leitura, XP e biblioteca do usuário <strong>permanecerão totalmente intactos</strong>. Ele apenas perderá o acesso ao Painel de Controle.
            </p>
          </div>
        </div>

        <footer class="modal-footer">
          <button type="button" class="btn-secondary-modal" onclick={closeAllModals}>
            Cancelar
          </button>
          <button type="submit" class="btn-danger-confirm">
            Confirmar Remoção
          </button>
        </footer>
      </form>
    </div>
  </div>
{/if}

<style>
  .staff-workspace {
    display: flex;
    flex-direction: column;
    gap: 24px;
    width: 100%;
    max-width: 1360px;
    margin: 0 auto;
    min-width: 0;
    box-sizing: border-box;
  }

  /* Header */
  .workspace-header {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    gap: 20px;
    padding-bottom: 20px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.06);
    flex-wrap: wrap;
  }

  .header-text-block {
    display: flex;
    flex-direction: column;
    gap: 6px;
    min-width: 0;
  }

  .eyebrow-line {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.1em;
    color: #dfc28d;
    text-transform: uppercase;
  }

  .eyebrow-sep {
    color: #4b5266;
  }

  .eyebrow-date {
    color: #7b8396;
    font-weight: 500;
  }

  .heading {
    margin: 0;
    font-family: var(--font-heading, 'Manrope', sans-serif);
    font-size: clamp(1.6rem, 2.8vw, 2.1rem);
    font-weight: 800;
    color: #ffffff;
    letter-spacing: -0.02em;
    line-height: 1.15;
  }

  .subheading {
    margin: 0;
    color: #8c93a8;
    font-size: 0.92rem;
    max-width: 680px;
    line-height: 1.5;
  }

  .btn-primary-add {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 10px 18px;
    border-radius: 9px;
    background: linear-gradient(135deg, #dfc28d 0%, #c49c5e 100%);
    color: #0c0d14;
    font-size: 13px;
    font-weight: 750;
    border: none;
    cursor: pointer;
    box-shadow: 0 4px 18px rgba(223, 194, 141, 0.25);
    transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
    white-space: nowrap;
  }

  .btn-primary-add:hover {
    transform: translateY(-2px);
    box-shadow: 0 6px 24px rgba(223, 194, 141, 0.4);
  }

  /* Feedback banner */
  .feedback-banner {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 12px 16px;
    border-radius: 10px;
    font-size: 13px;
    font-weight: 600;
  }
  .feedback-banner.error {
    background: rgba(239, 68, 68, 0.12);
    border: 1px solid rgba(239, 68, 68, 0.3);
    color: #fca5a5;
  }
  .feedback-banner.success {
    background: rgba(16, 185, 129, 0.12);
    border: 1px solid rgba(16, 185, 129, 0.3);
    color: #6ee7b7;
  }

  /* Stats Bar */
  .stats-bar {
    display: flex;
    align-items: center;
    gap: 14px;
    flex-wrap: wrap;
  }

  .stat-pill {
    display: inline-flex;
    align-items: center;
    gap: 12px;
    padding: 10px 18px;
    border-radius: 12px;
    background: rgba(255, 255, 255, 0.02);
    border: 1px solid rgba(255, 255, 255, 0.06);
    flex: 1 1 200px;
  }

  .stat-icon-circle {
    display: grid;
    place-items: center;
    width: 32px;
    height: 32px;
    border-radius: 8px;
  }
  .stat-icon-circle.blue { background: rgba(59, 130, 246, 0.15); color: #93c5fd; }
  .stat-icon-circle.gold { background: rgba(223, 194, 141, 0.15); color: #dfc28d; }
  .stat-icon-circle.purple { background: rgba(167, 139, 250, 0.15); color: #a78bfa; }

  .stat-pill-info {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .stat-pill-label {
    font-size: 11px;
    color: #8c93a8;
    font-weight: 600;
  }

  .stat-pill-value {
    font-size: 1.25rem;
    font-weight: 800;
    color: #ffffff;
    line-height: 1;
  }

  /* Toolbar */
  .toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    flex-wrap: wrap;
    background: rgba(255, 255, 255, 0.015);
    border: 1px solid rgba(255, 255, 255, 0.05);
    padding: 10px 14px;
    border-radius: 12px;
  }

  .filter-tabs {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
  }

  .filter-tab {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    padding: 7px 14px;
    border-radius: 8px;
    background: transparent;
    border: 1px solid transparent;
    color: #8c93a8;
    font-size: 12.5px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .filter-tab:hover {
    color: #ffffff;
    background: rgba(255, 255, 255, 0.04);
  }

  .filter-tab.active {
    background: rgba(223, 194, 141, 0.12);
    border-color: rgba(223, 194, 141, 0.3);
    color: #dfc28d;
  }

  .tab-badge {
    font-size: 10.5px;
    font-weight: 750;
    padding: 1px 6px;
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.08);
    color: inherit;
  }

  .search-input-wrap {
    display: flex;
    align-items: center;
    gap: 8px;
    background: rgba(0, 0, 0, 0.3);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 8px;
    padding: 7px 12px;
    width: 280px;
    max-width: 100%;
    box-sizing: border-box;
  }

  .search-icon {
    color: #656d82;
  }

  .search-field {
    background: transparent;
    border: none;
    color: #ffffff;
    font-size: 12.5px;
    width: 100%;
    outline: none;
  }

  .btn-clear-search {
    background: transparent;
    border: none;
    color: #656d82;
    cursor: pointer;
    padding: 0;
    display: grid;
    place-items: center;
  }

  /* Staff Grid */
  .staff-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
    gap: 16px;
  }

  .staff-card {
    display: flex;
    flex-direction: column;
    gap: 14px;
    padding: 18px;
    border-radius: 14px;
    background: rgba(18, 22, 34, 0.65);
    border: 1px solid rgba(255, 255, 255, 0.06);
    transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
  }

  .staff-card.role-admin {
    border-top: 3px solid #dfc28d;
  }

  .card-top {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .avatar-wrap {
    width: 44px;
    height: 44px;
    border-radius: 12px;
    overflow: hidden;
    background: #101420;
    display: grid;
    place-items: center;
    border: 1px solid rgba(255, 255, 255, 0.1);
    flex-shrink: 0;
  }

  .avatar-wrap.admin-glow {
    border-color: rgba(223, 194, 141, 0.5);
    box-shadow: 0 0 12px rgba(223, 194, 141, 0.15);
  }

  .avatar-img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .avatar-initial {
    font-size: 16px;
    font-weight: 800;
    color: #dfc28d;
  }

  .member-meta {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }

  .name-row {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .member-display-name {
    font-size: 14px;
    font-weight: 750;
    color: #ffffff;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .self-tag {
    font-size: 10px;
    font-weight: 700;
    padding: 1px 6px;
    border-radius: 4px;
    background: rgba(16, 185, 129, 0.15);
    color: #6ee7b7;
    border: 1px solid rgba(16, 185, 129, 0.3);
  }

  .member-handle {
    font-size: 12px;
    color: #7b8396;
  }

  .role-badge {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    font-size: 11px;
    font-weight: 750;
    padding: 3px 8px;
    border-radius: 6px;
    white-space: nowrap;
  }

  .role-badge.gold {
    background: rgba(223, 194, 141, 0.14);
    color: #dfc28d;
    border: 1px solid rgba(223, 194, 141, 0.3);
  }

  .role-badge.purple {
    background: rgba(167, 139, 250, 0.14);
    color: #c4b5fd;
    border: 1px solid rgba(167, 139, 250, 0.3);
  }

  .capabilities-box {
    background: rgba(0, 0, 0, 0.25);
    border: 1px solid rgba(255, 255, 255, 0.04);
    border-radius: 8px;
    padding: 10px 12px;
  }

  .cap-text {
    margin: 0;
    font-size: 12px;
    color: #8c93a8;
    line-height: 1.4;
  }

  .cap-text strong {
    color: #cbd5e1;
  }

  .card-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    padding-top: 10px;
    border-top: 1px solid rgba(255, 255, 255, 0.05);
    flex-wrap: wrap;
  }

  .joined-meta {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    font-size: 11px;
    color: #656d82;
  }

  .card-actions {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .btn-card-action {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 5px 10px;
    border-radius: 6px;
    font-size: 11.5px;
    font-weight: 650;
    cursor: pointer;
    transition: all 0.15s ease;
    border: 1px solid transparent;
  }

  .btn-card-action.edit {
    background: rgba(255, 255, 255, 0.04);
    border-color: rgba(255, 255, 255, 0.08);
    color: #cbd5e1;
  }
  .btn-card-action.edit:hover {
    background: rgba(255, 255, 255, 0.08);
    color: #ffffff;
  }

  .btn-card-action.remove {
    background: rgba(239, 68, 68, 0.08);
    border-color: rgba(239, 68, 68, 0.2);
    color: #fca5a5;
  }
  .btn-card-action.remove:hover {
    background: rgba(239, 68, 68, 0.18);
  }

  /* Empty state */
  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 60px 20px;
    text-align: center;
    background: rgba(255, 255, 255, 0.015);
    border: 1px dashed rgba(255, 255, 255, 0.08);
    border-radius: 14px;
  }

  .empty-icon {
    color: #4b5266;
    margin-bottom: 12px;
  }

  .empty-title {
    margin: 0 0 6px;
    font-size: 16px;
    font-weight: 750;
    color: #ffffff;
  }

  .empty-desc {
    margin: 0;
    font-size: 13px;
    color: #7b8396;
  }

  /* Modals */
  .modal-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.75);
    backdrop-filter: blur(4px);
    z-index: 9999;
    display: grid;
    place-items: center;
    padding: 16px;
  }

  .modal-box {
    background: #111420;
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 16px;
    width: 100%;
    max-width: 520px;
    box-shadow: 0 24px 48px rgba(0, 0, 0, 0.6);
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }

  .modal-box.small {
    max-width: 440px;
  }

  .modal-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    padding: 18px 20px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.07);
    gap: 12px;
  }

  .modal-title {
    margin: 0;
    font-size: 16px;
    font-weight: 750;
    color: #ffffff;
  }

  .modal-subtitle {
    margin: 4px 0 0;
    font-size: 12px;
    color: #7b8396;
    line-height: 1.4;
  }

  .btn-close-modal {
    background: transparent;
    border: none;
    color: #656d82;
    cursor: pointer;
    padding: 4px;
    border-radius: 6px;
    transition: color 0.15s;
  }

  .btn-close-modal:hover {
    color: #ffffff;
  }

  .modal-content {
    padding: 20px;
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .form-field {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .field-label {
    font-size: 12px;
    font-weight: 750;
    color: #cbd5e1;
  }

  .picker-search-input-wrap {
    display: flex;
    align-items: center;
    gap: 10px;
    background: rgba(0, 0, 0, 0.35);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 8px;
    padding: 9px 12px;
  }

  .picker-icon {
    color: #656d82;
  }

  .picker-input {
    background: transparent;
    border: none;
    color: #ffffff;
    font-size: 13px;
    width: 100%;
    outline: none;
  }

  .picker-spinner {
    width: 14px;
    height: 14px;
    border: 2px solid rgba(223, 194, 141, 0.2);
    border-top-color: #dfc28d;
    border-radius: 50%;
    animation: spin 0.6s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  .field-error {
    font-size: 11.5px;
    color: #fca5a5;
  }

  .user-picker-results {
    display: flex;
    flex-direction: column;
    gap: 4px;
    max-height: 220px;
    overflow-y: auto;
    background: rgba(0, 0, 0, 0.3);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 8px;
    padding: 6px;
  }

  .user-result-row {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 10px;
    border-radius: 6px;
    background: transparent;
    border: none;
    cursor: pointer;
    text-align: left;
    transition: background 0.15s;
    width: 100%;
  }

  .user-result-row:hover:not(.is-already-staff) {
    background: rgba(255, 255, 255, 0.06);
  }

  .user-result-row.is-already-staff {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .user-result-avatar {
    width: 32px;
    height: 32px;
    border-radius: 8px;
    overflow: hidden;
    background: #181d2c;
    display: grid;
    place-items: center;
    font-size: 13px;
    font-weight: 750;
    color: #dfc28d;
    flex-shrink: 0;
  }

  .user-result-meta {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 1px;
    min-width: 0;
  }

  .user-result-name {
    font-size: 13px;
    color: #ffffff;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .user-result-handle {
    font-size: 11px;
    color: #7b8396;
  }

  .btn-select-user {
    font-size: 11px;
    font-weight: 700;
    color: #dfc28d;
    padding: 3px 8px;
    border-radius: 5px;
    background: rgba(223, 194, 141, 0.1);
  }

  .already-staff-tag {
    font-size: 10.5px;
    font-weight: 700;
    color: #94a3b8;
    background: rgba(255, 255, 255, 0.06);
    padding: 2px 6px;
    border-radius: 4px;
  }

  .picker-no-results {
    padding: 16px;
    text-align: center;
    font-size: 12.5px;
    color: #656d82;
  }

  /* Selected User Card */
  .selected-user-card {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 14px;
    border-radius: 10px;
    background: rgba(223, 194, 141, 0.08);
    border: 1px solid rgba(223, 194, 141, 0.25);
  }

  .selected-user-avatar {
    width: 38px;
    height: 38px;
    border-radius: 9px;
    overflow: hidden;
    background: #101420;
    display: grid;
    place-items: center;
    color: #dfc28d;
    font-weight: 800;
    flex-shrink: 0;
  }

  .selected-user-info {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }

  .selected-name {
    font-size: 13.5px;
    color: #ffffff;
  }

  .selected-handle {
    font-size: 11.5px;
    color: #dfc28d;
  }

  .btn-change-selection {
    font-size: 11.5px;
    font-weight: 650;
    color: #8c93a8;
    background: transparent;
    border: 1px solid rgba(255, 255, 255, 0.1);
    padding: 4px 10px;
    border-radius: 6px;
    cursor: pointer;
  }

  .btn-change-selection:hover {
    color: #ffffff;
    border-color: rgba(255, 255, 255, 0.2);
  }

  /* Role selector cards */
  .role-selector-section {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .role-cards-choice {
    display: grid;
    grid-template-columns: 1fr;
    gap: 8px;
  }

  .role-choice-card {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    padding: 12px 14px;
    border-radius: 10px;
    background: rgba(255, 255, 255, 0.02);
    border: 1px solid rgba(255, 255, 255, 0.06);
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .role-choice-card:hover {
    background: rgba(255, 255, 255, 0.04);
  }

  .role-choice-card.active {
    background: rgba(223, 194, 141, 0.08);
    border-color: rgba(223, 194, 141, 0.35);
  }

  .role-radio-native {
    margin-top: 4px;
    accent-color: #dfc28d;
  }

  .role-choice-content {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .role-choice-header {
    display: flex;
    align-items: center;
    gap: 7px;
  }

  .role-choice-header strong {
    font-size: 13.5px;
    color: #ffffff;
  }

  .role-choice-icon.purple { color: #a78bfa; }
  .role-choice-icon.gold { color: #dfc28d; }

  .role-choice-tag {
    font-size: 9.5px;
    font-weight: 750;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    padding: 1px 6px;
    border-radius: 4px;
    background: rgba(167, 139, 250, 0.18);
    color: #c4b5fd;
  }

  .role-choice-desc {
    margin: 0;
    font-size: 11.5px;
    color: #8c93a8;
    line-height: 1.4;
  }

  /* Role switch in modal 2 */
  .modal-dialog-text {
    margin: 0;
    font-size: 13px;
    color: #94a3b8;
  }

  .modal-dialog-text strong {
    color: #ffffff;
  }

  .role-switch-options {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-top: 6px;
  }

  .switch-option-label {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 14px;
    border-radius: 8px;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.06);
    cursor: pointer;
  }

  .switch-option-label.selected {
    background: rgba(223, 194, 141, 0.1);
    border-color: rgba(223, 194, 141, 0.3);
  }

  .switch-option-label div {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .switch-option-label strong {
    font-size: 13px;
    color: #ffffff;
  }

  .switch-option-label span {
    font-size: 11px;
    color: #7b8396;
  }

  /* Remove modal */
  .remove-header-cluster {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .remove-icon-wrap {
    display: grid;
    place-items: center;
    width: 36px;
    height: 36px;
    border-radius: 9px;
    background: rgba(239, 68, 68, 0.15);
    color: #fca5a5;
  }

  .remove-warning-text {
    margin: 0;
    font-size: 13.5px;
    color: #cbd5e1;
    line-height: 1.5;
  }

  .remove-warning-text strong {
    color: #ffffff;
  }

  .safety-reassurance-box {
    display: flex;
    align-items: flex-start;
    gap: 10px;
    padding: 12px;
    border-radius: 8px;
    background: rgba(16, 185, 129, 0.08);
    border: 1px solid rgba(16, 185, 129, 0.2);
  }

  .safety-icon {
    color: #10b981;
    flex-shrink: 0;
    margin-top: 2px;
  }

  .safety-text {
    margin: 0;
    font-size: 12px;
    color: #94a3b8;
    line-height: 1.4;
  }

  .safety-text strong {
    color: #6ee7b7;
  }

  .btn-danger-confirm {
    padding: 9px 18px;
    border-radius: 8px;
    background: #ef4444;
    border: none;
    color: #ffffff;
    font-size: 13px;
    font-weight: 750;
    cursor: pointer;
    transition: background 0.15s;
  }

  .btn-danger-confirm:hover {
    background: #dc2626;
  }

  /* Modal Footer */
  .modal-footer {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 10px;
    padding: 16px 20px;
    border-top: 1px solid rgba(255, 255, 255, 0.06);
    background: rgba(0, 0, 0, 0.2);
  }

  .btn-secondary-modal {
    padding: 9px 16px;
    border-radius: 8px;
    background: transparent;
    border: 1px solid rgba(255, 255, 255, 0.1);
    color: #8c93a8;
    font-size: 12.5px;
    font-weight: 650;
    cursor: pointer;
  }

  .btn-secondary-modal:hover {
    color: #ffffff;
    border-color: rgba(255, 255, 255, 0.2);
  }

  .btn-primary-modal {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    padding: 9px 18px;
    border-radius: 8px;
    background: linear-gradient(135deg, #dfc28d 0%, #c49c5e 100%);
    color: #0c0d14;
    font-size: 13px;
    font-weight: 750;
    border: none;
    cursor: pointer;
    transition: opacity 0.15s;
  }

  .btn-primary-modal:hover {
    opacity: 0.92;
  }

  @media (max-width: 680px) {
    .workspace-header {
      flex-direction: column;
      align-items: stretch;
      gap: 16px;
    }

    .btn-primary-add {
      width: 100%;
      justify-content: center;
      box-sizing: border-box;
    }

    .toolbar {
      flex-direction: column;
      align-items: stretch;
      gap: 12px;
    }

    .search-input-wrap {
      width: 100%;
    }

    .staff-grid {
      grid-template-columns: 1fr;
    }
  }
</style>
