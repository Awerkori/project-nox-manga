<script lang="ts">
  import {
    Calendar as CalendarIcon,
    Clock,
    AlertCircle,
    CheckCircle2,
    User,
    ChevronLeft,
    ChevronRight,
    Sparkles
  } from '@lucide/svelte';

  let { tasks = [], chapters = [], team = [] } = $props();

  let today = new Date();
  let currentMonth = $state(today.getMonth());
  let currentYear = $state(today.getFullYear());

  const MONTH_NAMES = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ];

  function prevMonth() {
    if (currentMonth === 0) {
      currentMonth = 11;
      currentYear--;
    } else {
      currentMonth--;
    }
  }

  function nextMonth() {
    if (currentMonth === 11) {
      currentMonth = 0;
      currentYear++;
    } else {
      currentMonth++;
    }
  }

  // Upcoming items with deadlines
  let tasksWithDeadlines = $derived(
    tasks
      .filter((t: any) => t.dueAt && t.status !== 'DONE' && t.status !== 'CANCELLED')
      .sort((a: any, b: any) => new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime())
  );

  let recentChapters = $derived(
    chapters
      .filter((c: any) => c.publishedAt)
      .slice(0, 10)
  );
</script>

<div class="calendar-tab">
  <div class="tab-header">
    <div>
      <h2 class="title">Calendário & Prazos da Equipe</h2>
      <p class="subtitle">Acompanhamento de entregas de capítulos, etapas de produção e datas-limite.</p>
    </div>
  </div>

  <div class="calendar-layout">
    <!-- Main Column: Upcoming Deliveries & Deadlines -->
    <div class="deadlines-col">
      <div class="section-card">
        <div class="card-header">
          <Clock size={18} class="header-icon warning" />
          <h3>Próximos Prazos de Tarefas ({tasksWithDeadlines.length})</h3>
        </div>

        {#if tasksWithDeadlines.length === 0}
          <div class="empty-box">
            <CheckCircle2 size={36} class="check-empty" />
            <p>Nenhuma tarefa com prazo pendente para os próximos dias.</p>
          </div>
        {:else}
          <div class="deadline-list">
            {#each tasksWithDeadlines as task}
              {@const assignee = team.find((m: any) => m.id === task.assignedTo)}
              {@const isOverdue = new Date(task.dueAt) < new Date()}
              <div class="deadline-item {isOverdue ? 'overdue' : ''}">
                <div class="item-date">
                  <span class="day">{new Date(task.dueAt).getDate()}</span>
                  <span class="month">{MONTH_NAMES[new Date(task.dueAt).getMonth()].substring(0, 3)}</span>
                </div>
                <div class="item-details">
                  <span class="item-title">{task.title}</span>
                  <div class="item-meta">
                    <span class="prio-tag {task.priority.toLowerCase()}">{task.priority}</span>
                    {#if assignee}
                      <span class="assignee-tag">
                        <User size={12} /> {assignee.displayName || assignee.username}
                      </span>
                    {/if}
                    {#if isOverdue}
                      <span class="overdue-tag">Atrasado</span>
                    {/if}
                  </div>
                </div>
              </div>
            {/each}
          </div>
        {/if}
      </div>

      <!-- Recent Publications History -->
      <div class="section-card mt">
        <div class="card-header">
          <Sparkles size={18} class="header-icon cyan" />
          <h3>Últimas Publicações Realizadas</h3>
        </div>

        <div class="deadline-list">
          {#each recentChapters as chapter}
            <div class="deadline-item done">
              <div class="item-date">
                <span class="day">{new Date(chapter.publishedAt).getDate()}</span>
                <span class="month">{MONTH_NAMES[new Date(chapter.publishedAt).getMonth()].substring(0, 3)}</span>
              </div>
              <div class="item-details">
                <span class="item-title">{chapter.works?.title} - Cap. #{chapter.number}</span>
                <div class="item-meta">
                  <span class="item-subtitle">{chapter.title || 'Lançado no site'}</span>
                  <span class="views-tag">{chapter.viewsTotal || 0} visualizações</span>
                </div>
              </div>
            </div>
          {/each}
        </div>
      </div>
    </div>

    <!-- Right Column: Month View & Availability -->
    <div class="sidebar-col">
      <!-- Calendar Navigator -->
      <div class="section-card">
        <div class="month-navigator">
          <h4>{MONTH_NAMES[currentMonth]} {currentYear}</h4>
          <div class="nav-btns">
            <button class="nav-btn" onclick={prevMonth}><ChevronLeft size={16} /></button>
            <button class="nav-btn" onclick={nextMonth}><ChevronRight size={16} /></button>
          </div>
        </div>

        <div class="mini-calendar">
          <div class="day-names">
            <span>D</span><span>S</span><span>T</span><span>Q</span><span>Q</span><span>S</span><span>S</span>
          </div>
          <!-- Visual month grid placeholder -->
          <div class="days-grid">
            {#each Array(31) as _, i}
              {@const isToday = i + 1 === today.getDate() && currentMonth === today.getMonth() && currentYear === today.getFullYear()}
              <div class="day-cell {isToday ? 'is-today' : ''}">
                {i + 1}
              </div>
            {/each}
          </div>
        </div>
      </div>

      <!-- Member Availability Status -->
      <div class="section-card mt">
        <div class="card-header">
          <User size={18} class="header-icon indigo" />
          <h3>Status de Disponibilidade</h3>
        </div>

        <div class="availability-list">
          {#each team as member}
            <div class="avail-row">
              <div class="avail-user">
                <span class="status-dot {member.availabilityStatus?.toLowerCase() || 'active'}"></span>
                <span class="avail-name">{member.displayName || member.username}</span>
              </div>
              <span class="status-label {member.availabilityStatus?.toLowerCase() || 'active'}">
                {member.availabilityStatus === 'BUSY' ? 'Ocupado' :
                 member.availabilityStatus === 'AWAY' ? 'Ausente' :
                 member.availabilityStatus === 'HIATUS' ? 'Em Hiato' : 'Disponível'}
              </span>
            </div>
          {/each}
        </div>
      </div>
    </div>
  </div>
</div>

<style>
  .calendar-tab {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }

  .tab-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
  }

  .title {
    font-size: 1.25rem;
    font-weight: 700;
    color: #f8fafc;
    margin: 0;
  }

  .subtitle {
    font-size: 0.875rem;
    color: #94a3b8;
    margin: 0.25rem 0 0;
  }

  .calendar-layout {
    display: grid;
    grid-template-columns: 1fr;
    gap: 1.5rem;
  }

  @media (min-width: 900px) {
    .calendar-layout {
      grid-template-columns: 1.6fr 1fr;
    }
  }

  .section-card {
    background: rgba(15, 23, 42, 0.5);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 1rem;
    padding: 1.25rem;
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .section-card.mt {
    margin-top: 1.5rem;
  }

  .card-header {
    display: flex;
    align-items: center;
    gap: 0.6rem;
  }

  :global(.header-icon.warning) { color: #f59e0b; }
  :global(.header-icon.cyan) { color: #06b6d4; }
  :global(.header-icon.indigo) { color: #818cf8; }

  .card-header h3 {
    font-size: 1rem;
    font-weight: 600;
    color: #f1f5f9;
    margin: 0;
  }

  .empty-box {
    text-align: center;
    padding: 2.5rem 1rem;
    color: #94a3b8;
    font-size: 0.875rem;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.75rem;
  }

  :global(.check-empty) {
    color: #10b981;
  }

  .deadline-list {
    display: flex;
    flex-direction: column;
    gap: 0.6rem;
  }

  .deadline-item {
    display: flex;
    align-items: center;
    gap: 1rem;
    background: rgba(0, 0, 0, 0.25);
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: 0.75rem;
    padding: 0.75rem 1rem;
  }

  .deadline-item.overdue {
    border-color: rgba(239, 68, 68, 0.3);
    background: rgba(239, 68, 68, 0.05);
  }

  .item-date {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    width: 44px;
    height: 44px;
    background: rgba(255, 255, 255, 0.06);
    border-radius: 0.5rem;
    flex-shrink: 0;
  }

  .item-date .day {
    font-size: 1rem;
    font-weight: 700;
    color: #f8fafc;
    line-height: 1;
  }

  .item-date .month {
    font-size: 0.65rem;
    color: #94a3b8;
    text-transform: uppercase;
  }

  .item-details {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    flex: 1;
  }

  .item-title {
    font-size: 0.875rem;
    font-weight: 600;
    color: #f1f5f9;
  }

  .item-meta {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex-wrap: wrap;
  }

  .prio-tag {
    font-size: 0.65rem;
    font-weight: 700;
    padding: 0.1rem 0.35rem;
    border-radius: 0.25rem;
    text-transform: uppercase;
  }

  .prio-tag.urgent { background: rgba(239, 68, 68, 0.2); color: #f87171; }
  .prio-tag.high { background: rgba(245, 158, 11, 0.2); color: #fbbf24; }
  .prio-tag.normal { background: rgba(99, 102, 241, 0.2); color: #818cf8; }
  .prio-tag.low { background: rgba(100, 116, 139, 0.2); color: #94a3b8; }

  .assignee-tag {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    font-size: 0.75rem;
    color: #cbd5e1;
  }

  .overdue-tag {
    font-size: 0.65rem;
    font-weight: 700;
    color: #ef4444;
    background: rgba(239, 68, 68, 0.15);
    padding: 0.1rem 0.35rem;
    border-radius: 0.25rem;
  }

  .item-subtitle {
    font-size: 0.75rem;
    color: #94a3b8;
  }

  .views-tag {
    font-size: 0.75rem;
    color: #06b6d4;
  }

  /* Month Navigator */
  .month-navigator {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .month-navigator h4 {
    font-size: 1rem;
    color: #f1f5f9;
    margin: 0;
  }

  .nav-btns {
    display: flex;
    gap: 0.25rem;
  }

  .nav-btn {
    background: rgba(255, 255, 255, 0.08);
    border: none;
    color: #cbd5e1;
    border-radius: 0.375rem;
    padding: 0.35rem;
    cursor: pointer;
  }

  .mini-calendar {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .day-names {
    display: grid;
    grid-template-columns: repeat(7, 1fr);
    text-align: center;
    font-size: 0.75rem;
    font-weight: 700;
    color: #64748b;
  }

  .days-grid {
    display: grid;
    grid-template-columns: repeat(7, 1fr);
    gap: 0.25rem;
  }

  .day-cell {
    aspect-ratio: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.8125rem;
    color: #94a3b8;
    border-radius: 0.375rem;
  }

  .day-cell.is-today {
    background: #6366f1;
    color: #fff;
    font-weight: 700;
  }

  /* Availability List */
  .availability-list {
    display: flex;
    flex-direction: column;
    gap: 0.6rem;
  }

  .avail-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    font-size: 0.875rem;
  }

  .avail-user {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .status-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
  }

  .status-dot.active { background: #10b981; }
  .status-dot.busy { background: #f59e0b; }
  .status-dot.away { background: #64748b; }
  .status-dot.hiatus { background: #ef4444; }

  .avail-name {
    color: #e2e8f0;
  }

  .status-label {
    font-size: 0.75rem;
  }

  .status-label.active { color: #10b981; }
  .status-label.busy { color: #f59e0b; }
  .status-label.away { color: #64748b; }
  .status-label.hiatus { color: #ef4444; }
</style>
