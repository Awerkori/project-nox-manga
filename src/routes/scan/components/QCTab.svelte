<script lang="ts">
  import {
    CheckCircle2,
    AlertCircle,
    Plus,
    Filter,
    MessageSquare,
    Check,
    RotateCcw,
    X,
    Layers,
    User,
    Clock,
    Tag,
    Image as ImageIcon
  } from '@lucide/svelte';
  import { enhance } from '$app/forms';
  import UserAvatar from '$lib/components/UserAvatar.svelte';

  let {
    qcIssues = [],
    chapters = [],
    works = [],
    team = [],
    currentUserId = '',
    isOwnerOrAdmin = false
  } = $props();

  let selectedStatus = $state<string>('ALL');
  let selectedType = $state<string>('ALL');
  let selectedChapterId = $state<string>('ALL');

  let showCreateIssueModal = $state(false);
  let newIssuePage = $state(1);
  let newIssueType = $state('TYPE');
  let newIssueDesc = $state('');
  let newIssueChapterId = $state(chapters[0]?.id || '');
  let newIssueAssignee = $state('');

  let activeIssueDetail = $state<any>(null);
  let newCommentText = $state('');

  let filteredIssues = $derived(
    qcIssues.filter((issue: any) => {
      if (selectedStatus !== 'ALL' && issue.status !== selectedStatus) return false;
      if (selectedType !== 'ALL' && issue.issueType !== selectedType) return false;
      if (selectedChapterId !== 'ALL' && issue.chapterId !== selectedChapterId) return false;
      return true;
    })
  );

  const ISSUE_TYPES = [
    { code: 'TYPE', label: 'Typeset / Letreiramento', color: '#eab308' },
    { code: 'CLEAN', label: 'Clean / Limpeza', color: '#ec4899' },
    { code: 'TRANSLATION', label: 'Tradução / Gramática', color: '#3b82f6' },
    { code: 'REDRAW', label: 'Redesenho de Arte', color: '#8b5cf6' },
    { code: 'MISSING', label: 'Página Ausente / Danificada', color: '#ef4444' },
    { code: 'OTHER', label: 'Outro Ajuste', color: '#64748b' }
  ];

  function getIssueTypeMeta(type: string) {
    return ISSUE_TYPES.find((t) => t.code === type) || ISSUE_TYPES[5];
  }
</script>

<div class="qc-module-root">
  <!-- Header Bar -->
  <div class="qc-header-bar">
    <div class="qc-title-cluster">
      <div class="qc-icon-wrap">
        <CheckCircle2 size={20} />
      </div>
      <div>
        <h2 class="qc-main-title">Quality Control (QC) & Auditoria de Páginas</h2>
        <p class="qc-subtitle">Aponte falhas visuais, erros de letreiramento ou tradução página a página antes da publicação.</p>
      </div>
    </div>

    <div class="qc-header-actions">
      <button type="button" class="btn-primary-sm" onclick={() => (showCreateIssueModal = true)}>
        <Plus size={14} />
        <span>Nova Issue de QC</span>
      </button>
    </div>
  </div>

  <!-- Filters Row -->
  <div class="qc-filters-card">
    <div class="filter-selects-row">
      <div class="filter-col">
        <label for="qc-chap" class="sr-only">Capítulo</label>
        <select id="qc-chap" bind:value={selectedChapterId} class="form-select-sm">
          <option value="ALL">Todos os Capítulos ({chapters.length})</option>
          {#each chapters as chap}
            <option value={chap.id}>Capítulo #{chap.number} {chap.title ? `— ${chap.title}` : ''}</option>
          {/each}
        </select>
      </div>

      <div class="filter-col">
        <label for="qc-status" class="sr-only">Status</label>
        <select id="qc-status" bind:value={selectedStatus} class="form-select-sm">
          <option value="ALL">Status: Todos</option>
          <option value="OPEN">Abertas (Pendentes)</option>
          <option value="IN_PROGRESS">Em Correção</option>
          <option value="RESOLVED">Resolvidas</option>
          <option value="WONT_FIX">Ignoradas (Won't Fix)</option>
        </select>
      </div>

      <div class="filter-col">
        <label for="qc-type" class="sr-only">Tipo de Issue</label>
        <select id="qc-type" bind:value={selectedType} class="form-select-sm">
          <option value="ALL">Tipo de Problema: Todos</option>
          {#each ISSUE_TYPES as t}
            <option value={t.code}>{t.label}</option>
          {/each}
        </select>
      </div>
    </div>
  </div>

  <!-- Issues Grid -->
  <div class="qc-issues-container">
    {#if filteredIssues.length === 0}
      <div class="empty-qc-state">
        <CheckCircle2 size={40} class="empty-icon" />
        <p class="empty-title">Nenhuma issue de QC pendente</p>
        <p class="empty-sub">Capítulos auditados e sem problemas aprovam direto para o checklist de publicação.</p>
      </div>
    {:else}
      <div class="qc-cards-grid">
        {#each filteredIssues as issue (issue.id)}
          {@const meta = getIssueTypeMeta(issue.issueType)}
          <div class="qc-issue-card" class:resolved={issue.status === 'RESOLVED'}>
            <div class="issue-header-row">
              <div class="page-badge-wrap">
                <span class="page-num-pill">Pág. {issue.pageNumber}</span>
                <span class="type-pill" style="--tag-color: {meta.color}">
                  {meta.label}
                </span>
              </div>

              <!-- Status Dropdown Form -->
              <form method="POST" action="?/updateQcStatus" use:enhance class="status-form">
                <input type="hidden" name="issueId" value={issue.id} />
                <select
                  name="status"
                  class="qc-status-select"
                  class:status-open={issue.status === 'OPEN'}
                  class:status-resolved={issue.status === 'RESOLVED'}
                  onchange={(e) => (e.target as HTMLSelectElement).form?.requestSubmit()}
                >
                  <option value="OPEN" selected={issue.status === 'OPEN'}>Aberta</option>
                  <option value="IN_PROGRESS" selected={issue.status === 'IN_PROGRESS'}>Em Correção</option>
                  <option value="RESOLVED" selected={issue.status === 'RESOLVED'}>Resolvida</option>
                  <option value="WONT_FIX" selected={issue.status === 'WONT_FIX'}>Won't Fix</option>
                </select>
              </form>
            </div>

            <p class="issue-desc-text">{issue.description}</p>

            <div class="issue-footer-row">
              <div class="issue-assignee-cluster">
                {#if issue.assignee}
                  <UserAvatar
                    displayName={issue.assignee.displayName || issue.assignee.username}
                    avatarId={issue.assignee.avatarId}
                    size={20}
                  />
                  <span class="assignee-txt">{issue.assignee.displayName || issue.assignee.username}</span>
                {:else}
                  <span class="unassigned-txt">Sem responsável</span>
                {/if}
              </div>

              <div class="issue-meta-info">
                <span class="created-time">{new Date(issue.createdAt).toLocaleDateString('pt-BR')}</span>
              </div>
            </div>
          </div>
        {/each}
      </div>
    {/if}
  </div>
</div>

<!-- Modal: Criar Issue de QC -->
{#if showCreateIssueModal}
  <div class="modal-backdrop" onclick={() => (showCreateIssueModal = false)}>
    <div class="modal-card" onclick={(e) => e.stopPropagation()}>
      <div class="modal-header">
        <h3 class="modal-title">Apontar Issue de Qualidade (QC)</h3>
        <button type="button" class="btn-icon-xs" onclick={() => (showCreateIssueModal = false)}>
          <X size={16} />
        </button>
      </div>

      <form
        method="POST"
        action="?/createQcIssue"
        use:enhance={() => {
          return async ({ update }) => {
            showCreateIssueModal = false;
            newIssueDesc = '';
            await update();
          };
        }}
        class="modal-body-form"
      >
        <div class="form-row-2">
          <div class="form-group">
            <label for="qc-modal-chap" class="form-label">Capítulo</label>
            <select id="qc-modal-chap" name="chapterId" class="form-select" bind:value={newIssueChapterId} required>
              {#each chapters as chap}
                <option value={chap.id}>Capítulo #{chap.number} {chap.title ? `— ${chap.title}` : ''}</option>
              {/each}
            </select>
          </div>

          <div class="form-group">
            <label for="qc-modal-page" class="form-label">Número da Página</label>
            <input
              id="qc-modal-page"
              type="number"
              name="pageNumber"
              min="1"
              required
              class="form-input"
              bind:value={newIssuePage}
            />
          </div>
        </div>

        <div class="form-row-2">
          <div class="form-group">
            <label for="qc-modal-type" class="form-label">Tipo do Problema</label>
            <select id="qc-modal-type" name="issueType" class="form-select" bind:value={newIssueType}>
              {#each ISSUE_TYPES as t}
                <option value={t.code}>{t.label}</option>
              {/each}
            </select>
          </div>

          <div class="form-group">
            <label for="qc-modal-assignee" class="form-label">Atribuir a (Opcional)</label>
            <select id="qc-modal-assignee" name="assignedTo" class="form-select" bind:value={newIssueAssignee}>
              <option value="">Ninguém (Fila Geral)</option>
              {#each team as m}
                <option value={m.userId}>{m.member?.displayName || m.member?.username || m.userId}</option>
              {/each}
            </select>
          </div>
        </div>

        <div class="form-group">
          <label for="qc-modal-desc" class="form-label">Descrição do Ajuste Necessário</label>
          <textarea
            id="qc-modal-desc"
            name="description"
            rows="3"
            required
            class="form-textarea"
            placeholder="ex: Texto do segundo balão está desalinhado ou cortando na borda direita."
            bind:value={newIssueDesc}
          ></textarea>
        </div>

        <div class="modal-footer-actions">
          <button type="button" class="btn-secondary" onclick={() => (showCreateIssueModal = false)}>
            Cancelar
          </button>
          <button type="submit" class="btn-primary" disabled={!newIssueDesc.trim()}>
            Registrar Issue
          </button>
        </div>
      </form>
    </div>
  </div>
{/if}

<style>
  .qc-module-root {
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
  }

  .qc-header-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 1rem;
    padding: 1.25rem;
    background: #111115;
    border: 1px solid #27272a;
    border-radius: 12px;
  }

  .qc-title-cluster {
    display: flex;
    align-items: center;
    gap: 0.875rem;
  }

  .qc-icon-wrap {
    width: 42px;
    height: 42px;
    border-radius: 10px;
    background: rgba(6, 182, 212, 0.15);
    color: #06b6d4;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .qc-main-title {
    font-size: 1.125rem;
    font-weight: 700;
    color: #f4f4f5;
  }

  .qc-subtitle {
    font-size: 0.8125rem;
    color: #a1a1aa;
    margin-top: 0.15rem;
  }

  .qc-filters-card {
    padding: 0.75rem 1rem;
    background: #111115;
    border: 1px solid #27272a;
    border-radius: 8px;
  }

  .filter-selects-row {
    display: flex;
    flex-wrap: wrap;
    gap: 0.75rem;
  }

  .form-select-sm {
    background: #18181b;
    border: 1px solid #27272a;
    border-radius: 6px;
    padding: 0.35rem 0.65rem;
    color: #f4f4f5;
    font-size: 0.75rem;
  }

  .empty-qc-state {
    padding: 3rem 1.5rem;
    text-align: center;
    background: #09090b;
    border: 1px dashed #27272a;
    border-radius: 10px;
  }

  .empty-icon {
    color: #10b981;
    margin-bottom: 0.5rem;
  }

  .empty-title {
    font-size: 0.9375rem;
    font-weight: 600;
    color: #e4e4e7;
  }

  .empty-sub {
    font-size: 0.8125rem;
    color: #71717a;
    margin-top: 0.2rem;
  }

  .qc-cards-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(min(100%, 340px), 1fr));
    gap: 1rem;
  }

  .qc-issue-card {
    background: #111115;
    border: 1px solid #27272a;
    border-radius: 10px;
    padding: 1rem;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    transition: border-color 0.15s ease;
  }

  .qc-issue-card:hover {
    border-color: #3f3f46;
  }

  .qc-issue-card.resolved {
    opacity: 0.65;
    border-color: #1f2937;
  }

  .issue-header-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 0.65rem;
  }

  .page-badge-wrap {
    display: flex;
    align-items: center;
    gap: 0.4rem;
  }

  .page-num-pill {
    background: #27272a;
    color: #f4f4f5;
    font-size: 0.6875rem;
    font-weight: 700;
    padding: 0.15rem 0.45rem;
    border-radius: 4px;
  }

  .type-pill {
    background: rgba(255, 255, 255, 0.06);
    color: var(--tag-color, #a1a1aa);
    border: 1px solid var(--tag-color, #a1a1aa);
    font-size: 0.6875rem;
    font-weight: 600;
    padding: 0.1rem 0.4rem;
    border-radius: 4px;
  }

  .qc-status-select {
    background: #18181b;
    border: 1px solid #27272a;
    border-radius: 6px;
    padding: 0.2rem 0.45rem;
    font-size: 0.6875rem;
    font-weight: 600;
    color: #f4f4f5;
  }

  .qc-status-select.status-open {
    border-color: #f59e0b;
    color: #f59e0b;
  }

  .qc-status-select.status-resolved {
    border-color: #10b981;
    color: #10b981;
  }

  .issue-desc-text {
    font-size: 0.8125rem;
    color: #d4d4d8;
    line-height: 1.45;
    margin-bottom: 0.875rem;
  }

  .issue-footer-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding-top: 0.5rem;
    border-top: 1px solid #1f1f23;
  }

  .issue-assignee-cluster {
    display: flex;
    align-items: center;
    gap: 0.35rem;
  }

  .assignee-txt {
    font-size: 0.75rem;
    color: #a1a1aa;
    font-weight: 500;
  }

  .unassigned-txt {
    font-size: 0.6875rem;
    color: #71717a;
    font-style: italic;
  }

  .created-time {
    font-size: 0.6875rem;
    color: #71717a;
  }

  /* Modals */
  .modal-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.75);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 100;
    backdrop-filter: blur(4px);
    padding: 1rem;
  }

  .modal-card {
    background: #18181b;
    border: 1px solid #27272a;
    border-radius: 12px;
    width: 100%;
    max-width: 520px;
    padding: 1.25rem;
  }

  .modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 1rem;
  }

  .modal-title {
    font-size: 1rem;
    font-weight: 700;
    color: #f4f4f5;
  }

  .modal-body-form {
    display: flex;
    flex-direction: column;
    gap: 0.875rem;
  }

  .form-row-2 {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.75rem;
  }

  .form-group {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
  }

  .form-label {
    font-size: 0.8125rem;
    font-weight: 600;
    color: #a1a1aa;
  }

  .form-input, .form-select, .form-textarea {
    background: #09090b;
    border: 1px solid #27272a;
    border-radius: 6px;
    padding: 0.5rem 0.75rem;
    color: #f4f4f5;
    font-size: 0.875rem;
  }

  .modal-footer-actions {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 0.5rem;
    margin-top: 0.5rem;
  }

  .btn-primary, .btn-secondary, .btn-primary-sm {
    border-radius: 6px;
    font-size: 0.8125rem;
    font-weight: 600;
    cursor: pointer;
    padding: 0.45rem 0.875rem;
    transition: all 0.15s ease;
  }

  .btn-primary, .btn-primary-sm {
    background: #4f46e5;
    border: 1px solid #6366f1;
    color: #ffffff;
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
  }

  .btn-secondary {
    background: #27272a;
    border: 1px solid #3f3f46;
    color: #e4e4e7;
  }

  .btn-icon-xs {
    background: transparent;
    border: none;
    color: #a1a1aa;
    cursor: pointer;
  }
</style>
