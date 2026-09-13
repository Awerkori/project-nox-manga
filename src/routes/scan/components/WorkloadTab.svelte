<script lang="ts">
  import {
    Activity,
    Users,
    CheckCircle2,
    Clock,
    AlertCircle,
    UserCheck,
    Briefcase,
    Shield,
    Sparkles,
    Calendar
  } from '@lucide/svelte';
  import UserAvatar from '$lib/components/UserAvatar.svelte';

  let {
    team = [],
    tasks = [],
    memberPositions = [],
    currentUserId = '',
    isOwnerOrAdmin = false
  } = $props();

  // Availability statuses definition
  const AVAILABILITY_META: Record<string, { label: string; color: string; bg: string }> = {
    ACTIVE: { label: 'Disponível / Ativo', color: '#10b981', bg: 'rgba(16, 185, 129, 0.15)' },
    BUSY: { label: 'Ocupado', color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.15)' },
    AWAY: { label: 'Ausente', color: '#64748b', bg: 'rgba(100, 116, 139, 0.15)' },
    HIATUS: { label: 'Em Hiato', color: '#ef4444', bg: 'rgba(239, 68, 68, 0.15)' }
  };

  // Compile member workload data
  let memberWorkload = $derived.by(() => {
    return (team || []).map((m: any, idx: number) => {
      const u = m.members || m.member;
      const uid = m.user_id || u?.id || m.id || `member-${idx}`;
      const mTasks = tasks.filter((t: any) => t.assigned_to === uid || t.assigned_to === m.user_id);
      const activeTasks = mTasks.filter((t: any) => ['TODO', 'IN_PROGRESS', 'BLOCKED'].includes(t.status));
      const urgentTasks = activeTasks.filter((t: any) => t.priority === 'URGENT');
      const completedTasks = mTasks.filter((t: any) => t.status === 'DONE');

      // Member positions
      const mPositions = (memberPositions || [])
        .filter((mp: any) => mp.user_id === uid || mp.user_id === m.user_id)
        .map((mp: any) => mp.positions?.name)
        .filter(Boolean);

      const avail = m.availability_status || 'ACTIVE';

      return {
        id: uid,
        displayName: u?.display_name || u?.username || 'Membro',
        username: u?.username || '',
        avatarId: u?.avatar_id,
        role: m.role,
        positions: mPositions,
        availability: avail,
        availabilityMsg: m.availability_message,
        activeTasksCount: activeTasks.length,
        urgentTasksCount: urgentTasks.length,
        completedTasksCount: completedTasks.length,
        isOverloaded: activeTasks.length >= 6
      };
    });
  });

  let totalActive = $derived(team.filter((m: any) => (m.availability_status || 'ACTIVE') === 'ACTIVE').length);
  let totalHiatus = $derived(team.filter((m: any) => m.availability_status === 'HIATUS').length);
  let totalTasksInProgress = $derived(tasks.filter((t: any) => ['TODO', 'IN_PROGRESS'].includes(t.status)).length);
</script>

<div class="workload-module-root">
  <!-- Header Bar -->
  <div class="workload-header-bar">
    <div class="workload-title-cluster">
      <div class="workload-icon-wrap">
        <Activity size={22} />
      </div>
      <div>
        <h2 class="workload-main-title">Carga da Equipe & Disponibilidade</h2>
        <p class="workload-subtitle">Visão transparente da distribuição de tarefas para evitar sobrecarga e identificar disponibilidade.</p>
      </div>
    </div>

    <!-- Quick Stats Cluster -->
    <div class="workload-stats-cluster">
      <div class="stat-pill">
        <span class="stat-num">{totalActive}</span>
        <span class="stat-lbl">Membros Ativos</span>
      </div>
      <div class="stat-pill">
        <span class="stat-num">{totalTasksInProgress}</span>
        <span class="stat-lbl">Tarefas em Fila</span>
      </div>
      {#if totalHiatus > 0}
        <div class="stat-pill hiatus">
          <span class="stat-num">{totalHiatus}</span>
          <span class="stat-lbl">Em Hiato</span>
        </div>
      {/if}
    </div>
  </div>

  <!-- Workload Cards Grid -->
  <div class="workload-members-grid">
    {#each memberWorkload as member (member.id)}
      {@const meta = AVAILABILITY_META[member.availability] || AVAILABILITY_META.ACTIVE}
      <div class="workload-card" class:overloaded={member.isOverloaded} class:hiatus={member.availability === 'HIATUS'}>
        <div class="card-header-cluster">
          <div class="avatar-wrap">
            <UserAvatar
              displayName={member.displayName}
              avatarId={member.avatarId}
              size={42}
            />
            <span class="avail-dot" style="background: {meta.color}" title={meta.label}></span>
          </div>

          <div class="member-info-col">
            <div class="name-role-row">
              <h4 class="member-display-name">{member.displayName}</h4>
              <span class="role-badge" class:owner={member.role === 'OWNER'} class:admin={member.role === 'ADMIN'}>
                {member.role}
              </span>
            </div>

            {#if member.positions.length > 0}
              <div class="member-positions-tags">
                {#each member.positions as pos}
                  <span class="pos-tag">{pos}</span>
                {/each}
              </div>
            {/if}
          </div>
        </div>

        <!-- Availability Status Bar -->
        <div class="availability-bar" style="background: {meta.bg}; color: {meta.color}">
          <span class="avail-text">{meta.label}</span>
          {#if member.availabilityMsg}
            <span class="avail-msg">“{member.availabilityMsg}”</span>
          {/if}
        </div>

        <!-- Task Metrics -->
        <div class="task-metrics-row">
          <div class="metric-col">
            <span class="metric-val" class:high-load={member.activeTasksCount >= 5}>{member.activeTasksCount}</span>
            <span class="metric-desc">Em Andamento</span>
          </div>

          {#if member.urgentTasksCount > 0}
            <div class="metric-col urgent">
              <span class="metric-val urgent">{member.urgentTasksCount}</span>
              <span class="metric-desc">Urgentes</span>
            </div>
          {/if}

          <div class="metric-col">
            <span class="metric-val done">{member.completedTasksCount}</span>
            <span class="metric-desc">Concluídas</span>
          </div>
        </div>

        {#if member.isOverloaded}
          <div class="overload-warning-banner">
            <AlertCircle size={13} />
            <span>Atenção: Membro com alta demanda atribuída ({member.activeTasksCount} tarefas).</span>
          </div>
        {/if}
      </div>
    {/each}
  </div>
</div>

<style>
  .workload-module-root {
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
  }

  .workload-header-bar {
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

  .workload-title-cluster {
    display: flex;
    align-items: center;
    gap: 0.875rem;
  }

  .workload-icon-wrap {
    width: 42px;
    height: 42px;
    border-radius: 10px;
    background: rgba(234, 179, 8, 0.15);
    color: #eab308;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .workload-main-title {
    font-size: 1.125rem;
    font-weight: 700;
    color: #f4f4f5;
  }

  .workload-subtitle {
    font-size: 0.8125rem;
    color: #a1a1aa;
    margin-top: 0.15rem;
  }

  .workload-stats-cluster {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .stat-pill {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 0.35rem 0.75rem;
    background: #18181b;
    border: 1px solid #27272a;
    border-radius: 8px;
  }

  .stat-pill.hiatus {
    border-color: rgba(239, 68, 68, 0.3);
  }

  .stat-num {
    font-size: 1rem;
    font-weight: 700;
    color: #f4f4f5;
  }

  .stat-lbl {
    font-size: 0.6875rem;
    color: #71717a;
    text-transform: uppercase;
  }

  .workload-members-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(min(100%, 320px), 1fr));
    gap: 1rem;
  }

  .workload-card {
    background: #111115;
    border: 1px solid #27272a;
    border-radius: 12px;
    padding: 1.25rem;
    display: flex;
    flex-direction: column;
    gap: 1rem;
    position: relative;
    transition: all 0.15s ease;
  }

  .workload-card:hover {
    border-color: #3f3f46;
  }

  .workload-card.overloaded {
    border-color: rgba(239, 68, 68, 0.4);
    background: rgba(239, 68, 68, 0.03);
  }

  .workload-card.hiatus {
    opacity: 0.75;
  }

  .card-header-cluster {
    display: flex;
    align-items: center;
    gap: 0.875rem;
  }

  .avatar-wrap {
    position: relative;
  }

  .avail-dot {
    position: absolute;
    bottom: -1px;
    right: -1px;
    width: 11px;
    height: 11px;
    border-radius: 50%;
    border: 2px solid #111115;
  }

  .member-info-col {
    flex: 1;
    min-width: 0;
  }

  .name-role-row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex-wrap: wrap;
  }

  .member-display-name {
    font-size: 0.9375rem;
    font-weight: 600;
    color: #f4f4f5;
    margin: 0;
  }

  .role-badge {
    font-size: 0.625rem;
    font-weight: 700;
    text-transform: uppercase;
    padding: 0.1rem 0.35rem;
    border-radius: 4px;
    background: #27272a;
    color: #a1a1aa;
  }

  .role-badge.owner {
    background: rgba(234, 179, 8, 0.2);
    color: #fde047;
  }

  .role-badge.admin {
    background: rgba(99, 102, 241, 0.2);
    color: #818cf8;
  }

  .member-positions-tags {
    display: flex;
    flex-wrap: wrap;
    gap: 0.25rem;
    margin-top: 0.25rem;
  }

  .pos-tag {
    font-size: 0.6875rem;
    background: #18181b;
    border: 1px solid #27272a;
    color: #818cf8;
    padding: 0.05rem 0.4rem;
    border-radius: 4px;
  }

  .availability-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.35rem 0.65rem;
    border-radius: 6px;
    font-size: 0.75rem;
    font-weight: 600;
  }

  .avail-msg {
    font-weight: 400;
    font-style: italic;
    opacity: 0.85;
    font-size: 0.6875rem;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    max-width: 150px;
  }

  .task-metrics-row {
    display: flex;
    align-items: center;
    justify-content: space-around;
    padding-top: 0.75rem;
    border-top: 1px solid #1f1f23;
  }

  .metric-col {
    display: flex;
    flex-direction: column;
    align-items: center;
  }

  .metric-val {
    font-size: 1.125rem;
    font-weight: 700;
    color: #f4f4f5;
  }

  .metric-val.high-load {
    color: #ef4444;
  }

  .metric-val.urgent {
    color: #f59e0b;
  }

  .metric-val.done {
    color: #10b981;
  }

  .metric-desc {
    font-size: 0.6875rem;
    color: #71717a;
    margin-top: 0.1rem;
  }

  .overload-warning-banner {
    display: flex;
    align-items: center;
    gap: 0.35rem;
    background: rgba(239, 68, 68, 0.1);
    color: #ef4444;
    padding: 0.35rem 0.5rem;
    border-radius: 6px;
    font-size: 0.6875rem;
    font-weight: 500;
  }
</style>
