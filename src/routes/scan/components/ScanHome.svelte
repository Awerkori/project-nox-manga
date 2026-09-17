<script lang="ts">
  import {
    CheckSquare,
    AlertCircle,
    Layers,
    BookOpen,
    Pin,
    Calendar,
    ArrowRight,
    Clock,
    User,
    CheckCircle2,
    MessageSquare,
    ShieldAlert,
    ExternalLink
  } from '@lucide/svelte';
  import { relativeTime } from '$lib/types';
  import UserAvatar from '$lib/components/UserAvatar.svelte';

  let {
    currentScan,
    userProfile,
    userRole = 'MEMBER',
    tasks = [],
    chapters = [],
    chapterStages = [],
    works = [],
    muralPosts = [],
    notifications = [],
    stages = [],
    qcIssues = [],
    onNavigateTab,
    onOpenChapter
  } = $props();

  const CANONICAL_STAGES = [
    { slug: 'raw', name: 'Raw Provider', icon: '📦', color: '#94a3b8' },
    { slug: 'traducao', name: 'Traduo', icon: '🌐', color: '#3b82f6' },
    { slug: 'clean_redraw', name: 'Clean/Redraw', icon: '🎨', color: '#ec4899' },
    { slug: 'typeset', name: 'Typeset', icon: '✒️', color: '#eab308' },
    { slug: 'revisor_qc', name: 'Revisor (QC)', icon: '🔎', color: '#a855f7' },
    { slug: 'pre_aprovado', name: 'Pr Aprovado', icon: '✅', color: '#06b6d4' },
    { slug: 'publicado', name: 'Publicado', icon: '📚', color: '#22c55e' }
  ];

  function matchesStageSlug(sourceSlug: string | undefined, targetSlug: string): boolean {
    if (!sourceSlug) return false;
    const s = sourceSlug.toLowerCase().trim();
    const t = targetSlug.toLowerCase().trim();
    if (s === t) return true;
    if (t === 'clean' || t === 'clean_redraw' || t === 'clean/redraw') return s === 'clean' || s === 'clean_redraw' || s === 'clean/redraw';
    if (t === 'pre_aprovado' || t === 'ready' || t === 'pronto_pra_upar' || t === 'preview') return s === 'pre_aprovado' || s === 'ready' || s === 'pronto_pra_upar' || s === 'preview' || s === 'pr aprovado';
    if (t === 'traducao' || t === 'translation') return s === 'traducao' || s === 'translation';
    if (t === 'revisor_qc' || t === 'revisao' || t === 'qc') return s === 'revisor_qc' || s === 'revisao' || s === 'qc' || s === 'revisor (qc)';
    if (t === 'publicado' || t === 'published') return s === 'publicado' || s === 'published';
    return false;
  }

  // 1. Minhas Tarefas (legacy tasks assigned)
  let myTasks = $derived(
    tasks.filter((t: any) => t.assignedTo === userProfile?.id && t.status !== 'DONE')
  );

  // 1b. Meus Captulos Editoriais (chapter stages assigned to logged in user)
  let myEditorialStages = $derived.by(() => {
    if (!chapterStages || !userProfile?.id) return [];
    return chapterStages
      .filter((cs: any) => cs.assignedTo === userProfile?.id && (cs.status === 'IN_PROGRESS' || cs.status === 'REWORK'))
      .map((cs: any) => {
        const ch = chapters.find((c: any) => c.id === cs.productionChapterId);
        const work = ch?.work || works.find((w: any) => w.id === ch?.workId);
        const stage = stages.find((s: any) => s.id === cs.stageId) || cs.stage;
        return { cs, ch, work, stage };
      });
  });

  let totalMyAssignmentsCount = $derived(myTasks.length + myEditorialStages.length);

  // 2. Precisa da sua ateno
  let unreadMentions = $derived(
    notifications.filter((n: any) => !n.isRead && n.type === 'MENTION').length
  );
  let openQcCount = $derived(
    qcIssues.filter((q: any) => q.status === 'OPEN').length
  );
  let unassignedTasks = $derived(
    tasks.filter((t: any) => !t.assignedTo && t.status === 'TODO').length
  );

  // 3. Filas de Produo (7 canonical stages with real available counts)
  let stageCounts = $derived.by(() => {
    const map: Record<string, number> = {};
    for (const cSt of CANONICAL_STAGES) {
      map[cSt.slug] = 0;
    }

    if (chapterStages && chapterStages.length > 0) {
      for (const cs of chapterStages) {
        const slug = cs.stage?.slug || '';
        for (const cSt of CANONICAL_STAGES) {
          if (matchesStageSlug(slug, cSt.slug)) {
            if ((cs.status === 'AVAILABLE' || cs.status === 'REWORK') && !cs.assignedTo) {
              map[cSt.slug]++;
            }
          }
        }
      }
    }

    // Count for pre_aprovado
    map['pre_aprovado'] = chapters.filter((c: any) => ['READY', 'PREVIEW'].includes(c.status)).length;
    // Count for publicado
    map['publicado'] = chapters.filter((c: any) => c.status === 'PUBLISHED').length;

    return map;
  });

  // 4. Captulos em Andamento (active chapters)
  let activeChapters = $derived(
    chapters.slice(0, 4)
  );

  // 4b. Combined displayed assignments capped at 5
  let displayedAssignments = $derived.by(() => {
    const list: Array<{ type: 'editorial' | 'legacy'; data: any }> = [];
    for (const item of myEditorialStages) {
      list.push({ type: 'editorial', data: item });
    }
    for (const task of myTasks) {
      list.push({ type: 'legacy', data: task });
    }
    return list.slice(0, 5);
  });

  // 5. Pinned / Recent Mural posts
  let recentMural = $derived(
    muralPosts.slice(0, 3)
  );

  // 6. Prximos Prazos
  let upcomingDeadlines = $derived(
    tasks
      .filter((t: any) => (t.due_date || t.dueAt) && t.status !== 'DONE')
      .sort((a: any, b: any) => new Date(a.due_date || a.dueAt).getTime() - new Date(b.due_date || b.dueAt).getTime())
      .slice(0, 4)
  );
</script>

<div class="scan-home-layout">
  <!-- Welcome Greeting Hero -->
  <header class="home-hero">
    <div class="hero-text">
      <span class="scan-badge-label">{currentScan?.name || 'Project Nox'}</span>
      <h1 class="welcome-heading">
        Ol, {userProfile?.displayName || 'Membro'}.
      </h1>
      <p class="welcome-sub">
        O que precisa da sua ateno hoje na Scan?
      </p>
    </div>

    <!-- Quick action to jump directly into queue -->
    <div class="hero-actions">
      <button type="button" class="btn-primary-action" onclick={() => onNavigateTab('minha_fila')}>
        <CheckSquare size={16} />
        <span>Minhas Demandas ({totalMyAssignmentsCount})</span>
      </button>
      <button type="button" class="btn-secondary-action" onclick={() => onNavigateTab('pipeline')}>
        <Layers size={16} />
        <span>Abrir Pipeline</span>
      </button>
    </div>
  </header>

  <!-- Attention Alert Bar (if there are blockers, mentions or QC) -->
  {#if unreadMentions > 0 || openQcCount > 0 || unassignedTasks > 0}
    <div class="attention-banner">
      <div class="attention-header">
        <AlertCircle size={16} class="text-amber-500" />
        <strong>PRECISA DA SUA ATENO</strong>
      </div>
      <div class="attention-tags">
        {#if unreadMentions > 0}
          <button type="button" class="att-pill alert" onclick={() => onNavigateTab('inbox')}>
            <span>{unreadMentions} {unreadMentions === 1 ? 'meno no lida' : 'menes no lidas'}</span>
          </button>
        {/if}
        {#if openQcCount > 0}
          <button type="button" class="att-pill amber" onclick={() => onNavigateTab('pipeline')}>
            <span>{openQcCount} {openQcCount === 1 ? 'apontamento de QC aberto' : 'apontamentos de QC abertos'}</span>
          </button>
        {/if}
        {#if unassignedTasks > 0}
          <button type="button" class="att-pill purple" onclick={() => onNavigateTab('minha_fila')}>
            <span>{unassignedTasks} {unassignedTasks === 1 ? 'tarefa disponvel para assumir' : 'tarefas disponveis para assumir'}</span>
          </button>
        {/if}
      </div>
    </div>
  {/if}

  <!-- Production Queue Summary Bar (9 Canonical Stages) -->
  <section class="home-section">
    <div class="section-header">
      <div class="header-left">
        <Layers size={16} class="text-purple-400" />
        <h2>FILAS DE PRODUO</h2>
      </div>
      <button type="button" class="view-all-link" onclick={() => onNavigateTab('pipeline')}>
        <span>Ver Pipeline Completo</span>
        <ArrowRight size={13} />
      </button>
    </div>

    <div class="queues-strip" role="region" aria-label="Filas de Produo">
      {#each CANONICAL_STAGES as stage}
        {@const count = stageCounts[stage.slug] || 0}
        <button
          type="button"
          class="queue-chip"
          class:has-items={count > 0}
          onclick={() => onNavigateTab('pipeline', stage.slug)}
          title="Abrir fila {stage.name} no Pipeline ({count} disponvel)"
        >
          <span class="chip-stage-icon">{stage.icon}</span>
          <span class="chip-stage-name">{stage.name}:</span>
          <span class="chip-count">{count} {count === 1 ? 'disponvel' : 'disponveis'}</span>
          <ArrowRight size={11} class="chip-arrow" />
        </button>
      {/each}
    </div>
  </section>

  <!-- Two-Column Operational Layout: Minhas Tarefas + Mural & Prazos -->
  <div class="home-columns-grid">
    <!-- Left Column: Minhas Tarefas & Demandas -->
    <div class="col-left">
      <section class="home-card-panel">
        <div class="panel-header">
          <div class="header-left">
            <CheckSquare size={16} class="text-amber-400" />
            <h2>MINHAS DEMANDAS ATIVAS</h2>
          </div>
          <span class="panel-counter">{totalMyAssignmentsCount}</span>
        </div>

        {#if totalMyAssignmentsCount > 0}
          <div class="task-items-list">
            {#each displayedAssignments as item (item.type === 'editorial' ? item.data.cs.id : item.data.id)}
              {#if item.type === 'editorial'}
                {@const ed = item.data}
                <div class="task-entry-card editorial">
                  <div class="task-info">
                    <div class="task-work-title">
                      <strong class="text-slate-100">{ed.work?.title || 'Obra'}</strong>
                      <span class="ch-num">#{ed.ch?.chapterNumber}</span>
                      {#if ed.ch?.chapterLabel}
                        <span class="ch-label-sub">· {ed.ch.chapterLabel}</span>
                      {/if}
                    </div>
                    <div class="task-sub-meta">
                      <span class="stage-pill-tag" style="--stage-c: {ed.stage?.color || '#a855f7'}">
                        {ed.stage?.name || 'Etapa Editorial'}
                      </span>
                      {#if ed.cs.status === 'REWORK'}
                        <span class="priority-tag urgent">RETRABALHO</span>
                      {:else if ed.ch?.priority === 'URGENT'}
                        <span class="priority-tag urgent">URGENTE</span>
                      {:else if ed.ch?.priority === 'HIGH'}
                        <span class="priority-tag high">ALTA</span>
                      {/if}
                    </div>
                  </div>
                  <button
                    type="button"
                    class="btn-continue-task"
                    onclick={() => onNavigateTab('pipeline', ed.stage?.slug)}
                    title="Abrir etapa no Pipeline para produzir"
                  >
                    <span>Produzir</span>
                    <ArrowRight size={13} />
                  </button>
                </div>
              {:else}
                {@const task = item.data}
                <div class="task-entry-card">
                  <div class="task-info">
                    <span class="task-title">{task.title}</span>
                    <div class="task-sub-meta">
                      {#if task.priority === 'URGENT'}
                        <span class="priority-tag urgent">URGENTE</span>
                      {:else if task.priority === 'HIGH'}
                        <span class="priority-tag high">ALTA</span>
                      {/if}
                      {#if task.due_date}
                        <span class="due-tag">
                          <Clock size={12} />
                          <span>Prazo: {new Date(task.due_date).toLocaleDateString('pt-BR')}</span>
                        </span>
                      {/if}
                    </div>
                  </div>
                  <button
                    type="button"
                    class="btn-continue-task"
                    onclick={() => onNavigateTab('minha_fila')}
                  >
                    <span>Continuar</span>
                    <ArrowRight size={13} />
                  </button>
                </div>
              {/if}
            {/each}

            {#if totalMyAssignmentsCount > 5}
              <div class="more-assignments-box">
                <button
                  type="button"
                  class="btn-view-all-queue"
                  onclick={() => onNavigateTab('minha_fila')}
                >
                  <span>Ver todas as {totalMyAssignmentsCount} demandas na Minha Fila</span>
                  <ArrowRight size={13} />
                </button>
              </div>
            {/if}
          </div>
        {:else}
          <div class="empty-tasks-state">
            <CheckCircle2 size={32} class="text-emerald-500" />
            <p>Voc no possui demandas pendentes atribudas no momento.</p>
            <span class="empty-sub">Pegue um captulo disponvel no Pipeline para comear a produzir!</span>
            <button type="button" class="btn-empty-action" onclick={() => onNavigateTab('pipeline')}>
              Ver Captulos Disponveis
            </button>
          </div>
        {/if}
      </section>

      <!-- Captulos em Andamento -->
      <section class="home-card-panel mt-4">
        <div class="panel-header">
          <div class="header-left">
            <BookOpen size={16} class="text-blue-400" />
            <h2>CAPTULOS RECENTES EM ANDAMENTO</h2>
          </div>
          <button type="button" class="view-all-link" onclick={() => onNavigateTab('obras')}>
            Ver Obras
          </button>
        </div>

        {#if activeChapters.length > 0}
          <div class="chapters-quick-list">
            {#each activeChapters as ch}
              {@const chData = ch.chapters || ch}
              <div class="chapter-quick-row">
                <div class="chapter-work-meta">
                  <span class="work-name">{chData.work?.title || chData.works?.title || 'Obra'}</span>
                  <span class="chapter-num">Captulo #{chData.chapterNumber || chData.number || '—'}</span>
                </div>
                <div class="chapter-status-pill">
                  <span>Ativo</span>
                </div>
                <button
                  type="button"
                  class="btn-open-ch"
                  onclick={() => {
                    if (onOpenChapter) onOpenChapter(chData);
                    else onNavigateTab('pipeline');
                  }}
                >
                  Abrir
                </button>
              </div>
            {/each}
          </div>
        {:else}
          <div class="empty-panel-text">
            Nenhum captulo ativo registrado recentemente nesta Scan.
          </div>
        {/if}
      </section>
    </div>

    <!-- Right Column: Mural Recente + Prximos Prazos -->
    <div class="col-right">
      <!-- Mural Pinned / Recente -->
      <section class="home-card-panel">
        <div class="panel-header">
          <div class="header-left">
            <Pin size={16} class="text-rose-400" />
            <h2>MURAL DA SCAN</h2>
          </div>
          <button type="button" class="view-all-link" onclick={() => onNavigateTab('mural')}>
            Abrir Mural
          </button>
        </div>

        {#if recentMural.length > 0}
          <div class="mural-quick-feed">
            {#each recentMural as post}
              <div class="mural-quick-card" class:is-pinned={post.isPinned}>
                <div class="mural-card-top">
                  {#if post.isPinned}
                    <span class="pinned-tag">📌 FIXADO</span>
                  {/if}
                  <span class="post-type-tag">{post.postType || 'AVISO'}</span>
                  <span class="post-time">{relativeTime(post.createdAt)}</span>
                </div>
                <h3 class="mural-post-title">{post.title}</h3>
                <p class="mural-post-snippet">{post.content.slice(0, 140)}...</p>
                <div class="mural-card-footer">
                  <div class="author-meta">
                    <UserAvatar
                      avatarId={post.author?.avatarId}
                      displayName={post.author?.displayName}
                      size={20}
                    />
                    <span class="author-name">{post.author?.displayName || 'Staff'}</span>
                  </div>
                  {#if post.scan_attachments && post.scan_attachments.length > 0}
                    <span class="attachment-count-pill">
                      📎 {post.scan_attachments.length} {post.scan_attachments.length === 1 ? 'anexo' : 'anexos'}
                    </span>
                  {/if}
                </div>
              </div>
            {/each}
          </div>
        {:else}
          <div class="empty-panel-text">
            Nenhum aviso ou post no mural ainda.
          </div>
        {/if}
      </section>

      <!-- Prximos Prazos -->
      <section class="home-card-panel mt-4">
        <div class="panel-header">
          <div class="header-left">
            <Calendar size={16} class="text-emerald-400" />
            <h2>PRXIMOS PRAZOS</h2>
          </div>
          <button type="button" class="view-all-link" onclick={() => onNavigateTab('calendario')}>
            Calendrio
          </button>
        </div>

        {#if upcomingDeadlines.length > 0}
          <div class="deadlines-list">
            {#each upcomingDeadlines as d}
              {@const dDate = d.due_date || d.dueAt}
              <div class="deadline-row">
                <div class="deadline-date-box">
                  <span class="date-day">{new Date(dDate).getDate()}</span>
                  <span class="date-month">{new Date(dDate).toLocaleString('pt-BR', { month: 'short' }).toUpperCase()}</span>
                </div>
                <div class="deadline-meta">
                  <span class="deadline-title">{d.title}</span>
                  <span class="deadline-status">{d.status}</span>
                </div>
              </div>
            {/each}
          </div>
        {:else}
          <div class="empty-panel-text">
            Nenhum prazo imediato agendado nos prximos dias.
          </div>
        {/if}
      </section>
    </div>
  </div>
</div>

<style>
  .scan-home-layout {
    padding: 24px;
    max-width: 1360px;
    margin: 0 auto;
    display: flex;
    flex-direction: column;
    gap: 22px;
  }

  /* Hero */
  .home-hero {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 20px;
    padding: 24px 28px;
    background: linear-gradient(135deg, rgba(139, 92, 246, 0.12) 0%, rgba(11, 9, 20, 0.8) 100%);
    border: 1px solid rgba(139, 92, 246, 0.2);
    border-radius: 12px;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
  }

  .scan-badge-label {
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.08em;
    color: #dfc28d;
    text-transform: uppercase;
  }

  .welcome-heading {
    font-size: 26px;
    font-weight: 800;
    color: #f8fafc;
    margin: 4px 0 2px;
    letter-spacing: -0.02em;
  }

  .welcome-sub {
    font-size: 14px;
    color: #94a3b8;
    margin: 0;
  }

  .hero-actions {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .btn-primary-action {
    all: unset;
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 18px;
    background: #8b5cf6;
    color: #fff;
    font-size: 13px;
    font-weight: 600;
    border-radius: 8px;
    cursor: pointer;
    transition: background 0.15s;
  }

  .btn-primary-action:hover {
    background: #7c3aed;
  }

  .btn-secondary-action {
    all: unset;
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 18px;
    background: rgba(255, 255, 255, 0.06);
    border: 1px solid rgba(255, 255, 255, 0.12);
    color: #e2e8f0;
    font-size: 13px;
    font-weight: 600;
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.15s;
  }

  .btn-secondary-action:hover {
    background: rgba(255, 255, 255, 0.1);
  }

  /* Attention Banner */
  .attention-banner {
    background: rgba(245, 158, 11, 0.08);
    border: 1px solid rgba(245, 158, 11, 0.25);
    border-radius: 10px;
    padding: 12px 18px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    flex-wrap: wrap;
  }

  .attention-header {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 12.5px;
    font-weight: 700;
    color: #fbbf24;
    letter-spacing: 0.03em;
  }

  .attention-tags {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  }

  .att-pill {
    all: unset;
    cursor: pointer;
    font-size: 12px;
    font-weight: 600;
    padding: 4px 10px;
    border-radius: 6px;
    transition: opacity 0.15s;
  }

  .att-pill:hover {
    opacity: 0.85;
  }

  .att-pill.alert {
    background: rgba(239, 68, 68, 0.15);
    border: 1px solid rgba(239, 68, 68, 0.3);
    color: #f87171;
  }

  .att-pill.amber {
    background: rgba(245, 158, 11, 0.15);
    border: 1px solid rgba(245, 158, 11, 0.3);
    color: #fbbf24;
  }

  .att-pill.purple {
    background: rgba(139, 92, 246, 0.15);
    border: 1px solid rgba(139, 92, 246, 0.3);
    color: #c4b5fd;
  }

  /* Section Header */
  .home-section {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .section-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .section-header .header-left,
  .panel-header .header-left {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .section-header h2,
  .panel-header h2 {
    font-size: 13px;
    font-weight: 700;
    letter-spacing: 0.05em;
    color: #cbd5e1;
    margin: 0;
  }

  .view-all-link {
    all: unset;
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-size: 12px;
    font-weight: 600;
    color: #8b5cf6;
    cursor: pointer;
    transition: color 0.12s;
  }

  .view-all-link:hover {
    color: #a78bfa;
  }

  /* Queues Strip (Linear compact row) */
  .queues-strip {
    display: flex;
    align-items: center;
    gap: 8px;
    overflow-x: auto;
    padding: 2px 0 6px;
    scrollbar-width: thin;
    scrollbar-color: rgba(139, 92, 246, 0.3) transparent;
  }

  .queue-chip {
    all: unset;
    display: inline-flex;
    align-items: center;
    gap: 7px;
    padding: 7px 12px;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 7px;
    cursor: pointer;
    white-space: nowrap;
    transition: all 0.15s ease;
    flex-shrink: 0;
  }

  .queue-chip:hover {
    background: rgba(139, 92, 246, 0.12);
    border-color: rgba(139, 92, 246, 0.4);
    transform: translateY(-1px);
  }

  .queue-chip.has-items {
    background: rgba(255, 255, 255, 0.05);
    border-color: rgba(255, 255, 255, 0.14);
  }

  .chip-stage-icon {
    font-size: 13px;
    line-height: 1;
    flex-shrink: 0;
  }

  .chip-stage-name {
    font-size: 11.5px;
    font-weight: 700;
    color: #e2e8f0;
    letter-spacing: 0.02em;
  }

  .chip-count {
    font-size: 11.5px;
    color: #94a3b8;
  }

  .queue-chip.has-items .chip-count {
    color: #f1f5f9;
    font-weight: 600;
  }

  .chip-arrow {
    color: #64748b;
    transition: transform 0.15s;
    margin-left: 2px;
  }

  .queue-chip:hover .chip-arrow {
    transform: translateX(2px);
    color: #c084fc;
  }

  .more-assignments-box {
    margin-top: 6px;
    padding-top: 6px;
    border-top: 1px dashed rgba(255, 255, 255, 0.08);
  }

  .btn-view-all-queue {
    all: unset;
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: 12px;
    font-weight: 600;
    color: #a78bfa;
    cursor: pointer;
    transition: color 0.12s;
  }

  .btn-view-all-queue:hover {
    color: #c084fc;
    text-decoration: underline;
  }

  /* Columns Grid */
  .home-columns-grid {
    display: grid;
    grid-template-columns: 1.15fr 0.85fr;
    gap: 18px;
  }

  .home-card-panel {
    background: #0d0a18;
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: 10px;
    padding: 16px 18px;
    display: flex;
    flex-direction: column;
    gap: 14px;
  }

  .mt-4 {
    margin-top: 18px;
  }

  .panel-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    border-bottom: 1px solid rgba(255, 255, 255, 0.04);
    padding-bottom: 10px;
  }

  .panel-counter {
    font-size: 11px;
    font-weight: 700;
    padding: 1px 7px;
    border-radius: 10px;
    background: rgba(255, 255, 255, 0.08);
    color: #cbd5e1;
  }

  /* Tasks List */
  .task-items-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .task-entry-card {
    background: rgba(255, 255, 255, 0.02);
    border: 1px solid rgba(255, 255, 255, 0.05);
    border-radius: 8px;
    padding: 12px 14px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    transition: all 0.15s ease;
  }

  .task-entry-card:hover {
    background: rgba(255, 255, 255, 0.04);
    border-color: rgba(255, 255, 255, 0.1);
  }

  .task-entry-card.editorial {
    border-left: 3px solid #8b5cf6;
    background: rgba(139, 92, 246, 0.03);
  }

  .task-work-title {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 13.5px;
    margin-bottom: 4px;
    flex-wrap: wrap;
  }

  .task-work-title .ch-num {
    color: #c084fc;
    font-weight: 700;
  }

  .task-work-title .ch-label-sub {
    font-size: 12px;
    color: #94a3b8;
    font-weight: normal;
  }

  .stage-pill-tag {
    font-size: 11px;
    font-weight: 700;
    color: var(--stage-c, #a855f7);
    background: rgba(255, 255, 255, 0.05);
    padding: 1px 6px;
    border-radius: 4px;
    border: 1px solid rgba(255, 255, 255, 0.08);
  }

  .task-title {
    font-size: 13.5px;
    font-weight: 600;
    color: #e2e8f0;
    display: block;
    margin-bottom: 4px;
  }

  .task-sub-meta {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 11.5px;
    color: #94a3b8;
  }

  .priority-tag {
    font-size: 9.5px;
    font-weight: 800;
    padding: 1px 5px;
    border-radius: 4px;
  }

  .priority-tag.urgent { background: rgba(239, 68, 68, 0.2); color: #f87171; }
  .priority-tag.high { background: rgba(245, 158, 11, 0.2); color: #fbbf24; }

  .due-tag {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .btn-continue-task {
    all: unset;
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 6px 12px;
    background: rgba(139, 92, 246, 0.2);
    border: 1px solid rgba(139, 92, 246, 0.4);
    color: #c4b5fd;
    font-size: 12px;
    font-weight: 600;
    border-radius: 6px;
    cursor: pointer;
    transition: all 0.15s;
    flex-shrink: 0;
  }

  .btn-continue-task:hover {
    background: #8b5cf6;
    color: #fff;
  }

  .empty-tasks-state {
    text-align: center;
    padding: 28px 16px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
  }

  .empty-tasks-state p {
    font-size: 14px;
    font-weight: 600;
    color: #e2e8f0;
    margin: 0;
  }

  .empty-sub {
    font-size: 12px;
    color: #64748b;
  }

  .btn-empty-action {
    all: unset;
    margin-top: 8px;
    font-size: 12px;
    font-weight: 600;
    color: #a78bfa;
    cursor: pointer;
    text-decoration: underline;
  }

  /* Chapters Quick List */
  .chapters-quick-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .chapter-quick-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 10px;
    border-radius: 6px;
    background: rgba(255, 255, 255, 0.02);
  }

  .chapter-work-meta {
    display: flex;
    flex-direction: column;
  }

  .work-name {
    font-size: 13px;
    font-weight: 600;
    color: #f1f5f9;
  }

  .chapter-num {
    font-size: 11px;
    color: #94a3b8;
  }

  .chapter-status-pill {
    font-size: 10px;
    font-weight: 700;
    padding: 2px 7px;
    border-radius: 4px;
    background: rgba(16, 185, 129, 0.15);
    color: #34d399;
  }

  .btn-open-ch {
    all: unset;
    font-size: 12px;
    font-weight: 600;
    color: #94a3b8;
    padding: 4px 8px;
    cursor: pointer;
    border-radius: 4px;
    transition: all 0.12s;
  }

  .btn-open-ch:hover {
    background: rgba(255, 255, 255, 0.06);
    color: #fff;
  }

  /* Mural Quick Cards */
  .mural-quick-feed {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .mural-quick-card {
    background: rgba(255, 255, 255, 0.02);
    border: 1px solid rgba(255, 255, 255, 0.05);
    border-radius: 8px;
    padding: 12px 14px;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .mural-quick-card.is-pinned {
    border-color: rgba(223, 194, 141, 0.3);
    background: rgba(223, 194, 141, 0.03);
  }

  .mural-card-top {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 10px;
  }

  .pinned-tag {
    font-weight: 800;
    color: #dfc28d;
    background: rgba(223, 194, 141, 0.15);
    padding: 1px 5px;
    border-radius: 4px;
  }

  .post-type-tag {
    font-weight: 700;
    color: #94a3b8;
    background: rgba(255, 255, 255, 0.06);
    padding: 1px 5px;
    border-radius: 4px;
  }

  .post-time {
    color: #64748b;
    margin-left: auto;
  }

  .mural-post-title {
    font-size: 13.5px;
    font-weight: 700;
    color: #f1f5f9;
    margin: 0;
  }

  .mural-post-snippet {
    font-size: 12px;
    color: #94a3b8;
    margin: 0;
    line-height: 1.4;
  }

  .mural-card-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-top: 4px;
    font-size: 11px;
    color: #64748b;
  }

  .author-meta {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .attachment-count-pill {
    color: #cbd5e1;
    font-weight: 600;
  }

  /* Deadlines */
  .deadlines-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .deadline-row {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 10px;
    background: rgba(255, 255, 255, 0.02);
    border-radius: 6px;
  }

  .deadline-date-box {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    width: 38px;
    height: 38px;
    border-radius: 6px;
    background: rgba(139, 92, 246, 0.12);
    border: 1px solid rgba(139, 92, 246, 0.25);
    flex-shrink: 0;
  }

  .date-day {
    font-size: 14px;
    font-weight: 800;
    color: #c4b5fd;
    line-height: 1;
  }

  .date-month {
    font-size: 8.5px;
    font-weight: 700;
    color: #94a3b8;
    line-height: 1;
  }

  .deadline-meta {
    display: flex;
    flex-direction: column;
    min-width: 0;
  }

  .deadline-title {
    font-size: 12.5px;
    font-weight: 600;
    color: #e2e8f0;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .deadline-status {
    font-size: 10.5px;
    color: #64748b;
  }

  .empty-panel-text {
    font-size: 12px;
    color: #64748b;
    text-align: center;
    padding: 16px 8px;
  }

  /* Mobile */
  @media (max-width: 900px) {
    .scan-home-layout {
      padding: 16px;
      gap: 16px;
    }

    .home-hero {
      flex-direction: column;
      align-items: flex-start;
      padding: 18px 16px;
    }

    .hero-actions {
      width: 100%;
    }

    .btn-primary-action, .btn-secondary-action {
      flex: 1;
      justify-content: center;
    }

    .queues-grid {
      grid-template-columns: repeat(3, 1fr);
      gap: 8px;
    }

    .home-columns-grid {
      grid-template-columns: 1fr;
    }
  }

  @media (max-width: 500px) {
    .queues-grid {
      grid-template-columns: repeat(2, 1fr);
    }
  }
</style>
