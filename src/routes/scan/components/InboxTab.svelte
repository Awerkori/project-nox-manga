<script lang="ts">
  import {
    Inbox,
    AlertTriangle,
    Bell,
    CheckCircle2,
    Clock,
    UserPlus,
    FileText,
    ArrowRight,
    Check,
    Archive,
    ShieldAlert,
    ExternalLink,
    Filter,
    Layers,
    MessageSquare,
    AlertCircle
  } from '@lucide/svelte';
  import { enhance } from '$app/forms';

  let {
    notifications = [],
    tasks = [],
    applications = [],
    qcIssues = [],
    currentUserId = '',
    isOwnerOrAdmin = false
  } = $props();

  let selectedFilter = $state<'ALL' | 'ATTENTION' | 'UPDATES'>('ALL');

  // Derive Attention items:
  // 1. Unassigned tasks
  // 2. Pending applications
  // 3. Open QC issues
  // 4. Unread notifications of type MENTION / ROLE_MENTION / TASK_ASSIGNED
  let attentionItems = $derived(() => {
    const list: any[] = [];

    // Pending applications for owner/admin
    if (isOwnerOrAdmin) {
      for (const app of applications.filter((a: any) => ['PENDING', 'UNDER_REVIEW'].includes(a.status))) {
        list.push({
          id: `app-${app.id}`,
          type: 'APPLICATION',
          priority: 'HIGH',
          title: `Nova Candidatura: ${app.applicant?.displayName || app.applicant?.username || 'Candidato'}`,
          desc: `Candidatou-se para a vaga de ${app.opening?.title || 'Staff'}.`,
          date: app.createdAt,
          actionLabel: 'Ver Candidatura',
          actionTab: 'applications',
          badge: 'Recrutamento'
        });
      }
    }

    // Unassigned tasks
    for (const task of tasks.filter((t: any) => !t.assignedTo && t.status !== 'DONE')) {
      list.push({
        id: `task-unassigned-${task.id}`,
        type: 'TASK_UNASSIGNED',
        priority: task.priority === 'URGENT' ? 'URGENT' : 'NORMAL',
        title: `Tarefa sem Responsvel: ${task.title}`,
        desc: task.description || 'Nenhum membro assumiu esta tarefa ainda.',
        date: task.createdAt,
        actionLabel: 'Assumir Tarefa',
        actionTab: 'tasks',
        taskId: task.id,
        badge: 'Tarefa'
      });
    }

    // Open QC Issues
    for (const qc of qcIssues.filter((q: any) => q.status === 'OPEN')) {
      list.push({
        id: `qc-${qc.id}`,
        type: 'QC_OPEN',
        priority: 'HIGH',
        title: `QC Pendente — Pg. ${qc.pageNumber} (${qc.issueType})`,
        desc: qc.description,
        date: qc.createdAt,
        actionLabel: 'Inspecionar QC',
        actionTab: 'qc',
        badge: 'Qualidade'
      });
    }

    // Direct & Role Mentions in Notifications
    for (const notif of notifications.filter((n: any) => !n.isRead && ['MENTION', 'ROLE_MENTION', 'TASK_ASSIGNED'].includes(n.type))) {
      list.push({
        id: `notif-${notif.id}`,
        type: notif.type,
        priority: 'NORMAL',
        title: notif.title,
        desc: notif.body,
        date: notif.createdAt,
        actionLabel: 'Abrir',
        deepLink: notif.deepLink,
        badge: notif.type === 'ROLE_MENTION' ? 'Cargo' : 'Meno'
      });
    }

    return list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  });

  // Other updates: completed tasks, read notices
  let updateItems = $derived(() => {
    const list: any[] = [];
    for (const notif of notifications.filter((n: any) => n.isRead || !['MENTION', 'ROLE_MENTION', 'TASK_ASSIGNED'].includes(n.type))) {
      list.push({
        id: `notif-update-${notif.id}`,
        title: notif.title,
        desc: notif.body,
        date: notif.createdAt,
        badge: 'Informativo'
      });
    }

    for (const task of tasks.filter((t: any) => t.status === 'DONE').slice(0, 8)) {
      list.push({
        id: `task-done-${task.id}`,
        title: `Tarefa Concluda: ${task.title}`,
        desc: `Finalizada por ${task.assignee?.displayName || 'Membro'}.`,
        date: task.completedAt || task.updatedAt,
        badge: 'Produo'
      });
    }

    return list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 15);
  });
</script>

<div class="inbox-module-root">
  <div class="inbox-header-bar">
    <div class="inbox-title-cluster">
      <div class="inbox-icon-wrap">
        <Inbox size={20} />
      </div>
      <div>
        <h2 class="inbox-main-title">Inbox da Scan & Triagem</h2>
        <p class="inbox-subtitle">Demandas urgentes, menes  sua funo e itens que exigem ao direta da equipe.</p>
      </div>
    </div>

    <div class="inbox-filter-strip">
      <button
        type="button"
        class="filter-tab-btn"
        class:active={selectedFilter === 'ALL'}
        onclick={() => (selectedFilter = 'ALL')}
      >
        Tudo ({attentionItems().length + updateItems().length})
      </button>
      <button
        type="button"
        class="filter-tab-btn"
        class:active={selectedFilter === 'ATTENTION'}
        onclick={() => (selectedFilter = 'ATTENTION')}
      >
        Ateno Requerida ({attentionItems().length})
      </button>
      <button
        type="button"
        class="filter-tab-btn"
        class:active={selectedFilter === 'UPDATES'}
        onclick={() => (selectedFilter = 'UPDATES')}
      >
        Atualizaes Gerais ({updateItems().length})
      </button>
    </div>
  </div>

  <div class="inbox-sections-scroll">
    <!-- SECTION: PRECISA DA SUA ATENO -->
    {#if selectedFilter === 'ALL' || selectedFilter === 'ATTENTION'}
      <section class="inbox-section">
        <div class="section-title-strip attention">
          <AlertCircle size={16} />
          <h3 class="section-label">PRECISA DA SUA ATENO ({attentionItems().length})</h3>
        </div>

        {#if attentionItems().length === 0}
          <div class="inbox-zero-state">
            <CheckCircle2 size={32} class="zero-icon" />
            <p class="zero-text">Tudo em dia! Nenhuma pendncia crtica requerendo ao agora.</p>
          </div>
        {:else}
          <div class="inbox-cards-grid">
            {#each attentionItems() as item (item.id)}
              <div class="inbox-item-card" class:prio-urgent={item.priority === 'URGENT'}>
                <div class="item-badge-row">
                  <span class="item-type-badge">{item.badge}</span>
                  <span class="item-time">{new Date(item.date).toLocaleDateString('pt-BR')} {new Date(item.date).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
                </div>

                <h4 class="item-title">{item.title}</h4>
                <p class="item-desc">{item.desc}</p>

                <div class="item-actions-row">
                  {#if item.taskId}
                    <!-- Claim Task Form -->
                    <form method="POST" action="?/claimTask" use:enhance>
                      <input type="hidden" name="taskId" value={item.taskId} />
                      <button type="submit" class="btn-action-primary">
                        <Check size={13} />
                        <span>Assumir Tarefa</span>
                      </button>
                    </form>
                  {:else if item.deepLink}
                    <a href={item.deepLink} class="btn-action-primary">
                      <span>{item.actionLabel}</span>
                      <ArrowRight size={13} />
                    </a>
                  {/if}
                </div>
              </div>
            {/each}
          </div>
        {/if}
      </section>
    {/if}

    <!-- SECTION: OUTRAS ATUALIZAES -->
    {#if selectedFilter === 'ALL' || selectedFilter === 'UPDATES'}
      <section class="inbox-section">
        <div class="section-title-strip">
          <Clock size={16} />
          <h3 class="section-label">OUTRAS ATUALIZAES & HISTRICO ({updateItems().length})</h3>
        </div>

        {#if updateItems().length === 0}
          <div class="inbox-zero-state">
            <p class="zero-text">Nenhuma outra atualizao recente.</p>
          </div>
        {:else}
          <div class="updates-timeline">
            {#each updateItems() as item (item.id)}
              <div class="update-timeline-row">
                <div class="timeline-dot"></div>
                <div class="update-content">
                  <div class="update-header">
                    <span class="update-title">{item.title}</span>
                    <span class="update-time">{new Date(item.date).toLocaleDateString('pt-BR')}</span>
                  </div>
                  <p class="update-desc">{item.desc}</p>
                </div>
              </div>
            {/each}
          </div>
        {/if}
      </section>
    {/if}
  </div>
</div>

<style>
  .inbox-module-root {
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
  }

  .inbox-header-bar {
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

  .inbox-title-cluster {
    display: flex;
    align-items: center;
    gap: 0.875rem;
  }

  .inbox-icon-wrap {
    width: 42px;
    height: 42px;
    border-radius: 10px;
    background: rgba(99, 102, 241, 0.15);
    color: #818cf8;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .inbox-main-title {
    font-size: 1.125rem;
    font-weight: 700;
    color: #f4f4f5;
  }

  .inbox-subtitle {
    font-size: 0.8125rem;
    color: #a1a1aa;
    margin-top: 0.15rem;
  }

  .inbox-filter-strip {
    display: flex;
    gap: 0.5rem;
    background: #18181b;
    padding: 0.25rem;
    border-radius: 8px;
    border: 1px solid #27272a;
  }

  .filter-tab-btn {
    background: transparent;
    border: none;
    color: #a1a1aa;
    padding: 0.4rem 0.75rem;
    border-radius: 6px;
    font-size: 0.75rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .filter-tab-btn:hover {
    color: #ffffff;
  }

  .filter-tab-btn.active {
    background: #27272a;
    color: #ffffff;
  }

  .inbox-sections-scroll {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }

  .inbox-section {
    display: flex;
    flex-direction: column;
    gap: 0.875rem;
  }

  .section-title-strip {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    color: #a1a1aa;
  }

  .section-title-strip.attention {
    color: #f59e0b;
  }

  .section-label {
    font-size: 0.75rem;
    font-weight: 700;
    letter-spacing: 0.05em;
    text-transform: uppercase;
  }

  .inbox-zero-state {
    padding: 2.5rem;
    text-align: center;
    background: #09090b;
    border: 1px dashed #27272a;
    border-radius: 10px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.5rem;
  }

  .zero-icon {
    color: #10b981;
  }

  .zero-text {
    font-size: 0.875rem;
    color: #71717a;
  }

  .inbox-cards-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(min(100%, 340px), 1fr));
    gap: 0.875rem;
  }

  .inbox-item-card {
    background: #111115;
    border: 1px solid #27272a;
    border-radius: 10px;
    padding: 1rem;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    transition: border-color 0.15s ease;
  }

  .inbox-item-card:hover {
    border-color: #3f3f46;
  }

  .inbox-item-card.prio-urgent {
    border-left: 3px solid #ef4444;
  }

  .item-badge-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 0.5rem;
  }

  .item-type-badge {
    font-size: 0.6875rem;
    font-weight: 700;
    text-transform: uppercase;
    background: #18181b;
    color: #818cf8;
    padding: 0.15rem 0.45rem;
    border-radius: 4px;
  }

  .item-time {
    font-size: 0.6875rem;
    color: #71717a;
  }

  .item-title {
    font-size: 0.9375rem;
    font-weight: 600;
    color: #f4f4f5;
    margin-bottom: 0.35rem;
  }

  .item-desc {
    font-size: 0.8125rem;
    color: #a1a1aa;
    line-height: 1.45;
    margin-bottom: 1rem;
  }

  .item-actions-row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .btn-action-primary {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    background: #4f46e5;
    border: none;
    border-radius: 6px;
    color: #ffffff;
    padding: 0.35rem 0.75rem;
    font-size: 0.75rem;
    font-weight: 600;
    cursor: pointer;
    text-decoration: none;
    transition: background 0.15s ease;
  }

  .btn-action-primary:hover {
    background: #4338ca;
  }

  /* Timeline */
  .updates-timeline {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    border-left: 2px solid #27272a;
    padding-left: 1.25rem;
    margin-left: 0.5rem;
  }

  .update-timeline-row {
    position: relative;
    display: flex;
    flex-direction: column;
  }

  .timeline-dot {
    position: absolute;
    left: -1.5rem;
    top: 0.35rem;
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: #6366f1;
  }

  .update-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .update-title {
    font-size: 0.8125rem;
    font-weight: 600;
    color: #e4e4e7;
  }

  .update-time {
    font-size: 0.6875rem;
    color: #71717a;
  }

  .update-desc {
    font-size: 0.75rem;
    color: #a1a1aa;
    margin-top: 0.15rem;
  }
</style>
