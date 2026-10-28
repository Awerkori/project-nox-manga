<script lang="ts">
  import { onMount } from 'svelte';
  import { SvelteSet } from 'svelte/reactivity';
  import { goto, invalidateAll } from '$app/navigation';
  import { page } from '$app/state';
  import UserAvatar from '$lib/components/UserAvatar.svelte';
  import {
    Bell,
    Check,
    CheckCheck,
    BookOpen,
    MessageSquare,
    AtSign,
    Trophy,
    ShieldAlert,
    Users,
    ArrowRight,
    Clock,
    Inbox,
    Compass,
    Layers
  } from '@lucide/svelte';
  import type { PageData } from './$types';

  let { data } = $props<{ data: PageData }>();

  // Filter tab: 'todas' | 'nao-lidas' | 'lidas'
  let activeTab = $state<'todas' | 'nao-lidas' | 'lidas'>('todas');
  let busyAll = $state(false);
  let busyIds = new SvelteSet<string>();

  // Optimistic local state
  // eslint-disable-next-line svelte/prefer-writable-derived
  let localNotifications = $state([...data.notifications]);
  let toastMessage = $state<string | null>(null);
  let toastTimer: any = null;

  $effect(() => {
    localNotifications = [...data.notifications];
  });

  let notifsBc: BroadcastChannel | null = null;

  onMount(() => {
    const filterParam = page.url.searchParams.get('filtro') || page.url.searchParams.get('filter');
    if (filterParam === 'nao-lidas' || filterParam === 'unread') {
      activeTab = 'nao-lidas';
    } else if (filterParam === 'lidas' || filterParam === 'read') {
      activeTab = 'lidas';
    }

    if (typeof BroadcastChannel !== 'undefined') {
      try {
        notifsBc = new BroadcastChannel('nox_notifications');
        notifsBc.onmessage = (ev) => {
          if (ev.data?.type === 'ALL_READ') {
            localNotifications = localNotifications.map((n) => ({
              ...n,
              isRead: true,
              readAt: n.readAt || new Date().toISOString()
            }));
          } else if (ev.data?.type === 'ONE_READ' && ev.data?.id) {
            const t = localNotifications.find((n) => n.id === ev.data.id);
            if (t && !t.isRead) {
              t.isRead = true;
              t.readAt = new Date().toISOString();
              localNotifications = [...localNotifications];
            }
          }
        };
      } catch {
        // BroadcastChannel unavailable
      }
    }

    return () => {
      notifsBc?.close();
    };
  });

  function setFilterTab(tab: 'todas' | 'nao-lidas' | 'lidas') {
    activeTab = tab;
    const url = new URL(window.location.href);
    if (tab === 'nao-lidas') {
      url.searchParams.set('filtro', 'nao-lidas');
    } else if (tab === 'lidas') {
      url.searchParams.set('filtro', 'lidas');
    } else {
      url.searchParams.delete('filtro');
      url.searchParams.delete('filter');
    }
    window.history.replaceState({}, '', url.toString());
  }

  function showToast(msg: string) {
    if (toastTimer) clearTimeout(toastTimer);
    toastMessage = msg;
    toastTimer = setTimeout(() => {
      toastMessage = null;
    }, 3500);
  }

  // Derived counts
  const totalCount = $derived(localNotifications.length);
  const unreadCount = $derived(localNotifications.filter((n) => !n.isRead).length);
  const readCount = $derived(localNotifications.filter((n) => n.isRead).length);

  // Filtered notifications
  const filteredNotifications = $derived.by(() => {
    if (activeTab === 'nao-lidas') {
      return localNotifications.filter((n) => !n.isRead);
    }
    if (activeTab === 'lidas') {
      return localNotifications.filter((n) => n.isRead);
    }
    return localNotifications;
  });

  // Timeframe grouping
  interface TimeframeGroup {
    key: 'hoje' | 'ontem' | 'estaSemana' | 'anteriores';
    label: string;
    items: typeof data.notifications;
  }

  const groupedNotifications = $derived.by(() => {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const startOfYesterday = startOfToday - 86400000;
    const startOfWeek = startOfToday - 6 * 86400000;

    const groups: Record<'hoje' | 'ontem' | 'estaSemana' | 'anteriores', typeof data.notifications> = {
      hoje: [],
      ontem: [],
      estaSemana: [],
      anteriores: []
    };

    for (const notif of filteredNotifications) {
      const t = new Date(notif.createdAt).getTime();
      if (t >= startOfToday) {
        groups.hoje.push(notif);
      } else if (t >= startOfYesterday) {
        groups.ontem.push(notif);
      } else if (t >= startOfWeek) {
        groups.estaSemana.push(notif);
      } else {
        groups.anteriores.push(notif);
      }
    }

    const result: TimeframeGroup[] = [];
    if (groups.hoje.length > 0) {
      result.push({ key: 'hoje', label: 'Hoje', items: groups.hoje });
    }
    if (groups.ontem.length > 0) {
      result.push({ key: 'ontem', label: 'Ontem', items: groups.ontem });
    }
    if (groups.estaSemana.length > 0) {
      result.push({ key: 'estaSemana', label: 'Esta Semana', items: groups.estaSemana });
    }
    if (groups.anteriores.length > 0) {
      result.push({ key: 'anteriores', label: 'Anteriores', items: groups.anteriores });
    }

    return result;
  });

  // Mark single as read
  async function markAsRead(id: string, e?: Event) {
    if (e) e.stopPropagation();
    const target = localNotifications.find((n) => n.id === id);
    if (!target || target.isRead) return;

    // Snapshot for rollback on failure
    const prevIsRead = target.isRead;
    const prevReadAt = target.readAt;
    const prevUnreadCount = unreadCount;

    // Optimistic update
    target.isRead = true;
    target.readAt = new Date().toISOString();
    localNotifications = [...localNotifications];

    // Notify header bell
    window.dispatchEvent(
      new CustomEvent('nox:notifications-updated', {
        detail: { unread: unreadCount }
      })
    );

    busyIds.add(id);

    let persisted = false;

    try {
      const res = await fetch('/api/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scope: 'member',
          action: 'read_notification',
          data: { id }
        })
      });

      if (res.ok) {
        const body = await res.json().catch(() => ({}));
        if (body.ok && body.markedReadId === id) {
          persisted = true;
        }
      }

      if (!persisted) {
        // Fallback to form action
        const form = new FormData();
        form.set('id', id);
        const fbRes = await fetch('?/markRead', { method: 'POST', body: form });
        if (fbRes.ok) {
          const fbBody = await fbRes.json().catch(() => ({}));
          const successData = fbBody?.data ? (typeof fbBody.data === 'string' ? JSON.parse(fbBody.data) : fbBody.data) : fbBody;
          if (fbBody.type === 'success' || successData?.success) {
            persisted = true;
          }
        }
      }
    } catch (err) {
      console.warn('[NOTIF] Erro ao marcar como lida:', err);
    } finally {
      if (!persisted) {
        // Rollback optimistic state on failure
        target.isRead = prevIsRead;
        target.readAt = prevReadAt;
        localNotifications = [...localNotifications];
        window.dispatchEvent(
          new CustomEvent('nox:notifications-updated', {
            detail: { unread: prevUnreadCount }
          })
        );
        showToast('Não foi possível marcar a notificação como lida. Tente novamente.');
      } else {
        try {
          notifsBc?.postMessage({ type: 'ONE_READ', id });
        } catch {
          // ignore
        }
      }
      busyIds.delete(id);
    }
  }

  // Mark all as read
  async function markAllAsRead() {
    if (unreadCount === 0 || busyAll) return;
    busyAll = true;

    // Snapshot for rollback on failure
    const prevNotifications = localNotifications.map((n) => ({ ...n }));
    const prevUnreadCount = unreadCount;

    // Optimistic update
    localNotifications = localNotifications.map((n) => ({
      ...n,
      isRead: true,
      readAt: n.readAt || new Date().toISOString()
    }));

    // Notify header bell immediately
    window.dispatchEvent(
      new CustomEvent('nox:notifications-updated', {
        detail: { unread: 0 }
      })
    );

    let persisted = false;

    try {
      const res = await fetch('/api/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scope: 'member',
          action: 'read_all_notifications',
          data: {}
        })
      });

      if (res.ok) {
        const body = await res.json().catch(() => ({}));
        if (body.ok) {
          persisted = true;
        }
      }

      if (!persisted) {
        const fbRes = await fetch('?/markAllRead', { method: 'POST' });
        if (fbRes.ok) {
          const fbBody = await fbRes.json().catch(() => ({}));
          const successData = fbBody?.data ? (typeof fbBody.data === 'string' ? JSON.parse(fbBody.data) : fbBody.data) : fbBody;
          if (fbBody.type === 'success' || successData?.success) {
            persisted = true;
          }
        }
      }

      if (persisted) {
        showToast('Todas as notificações foram marcadas como lidas.');
        try {
          notifsBc?.postMessage({ type: 'ALL_READ' });
        } catch {
          // ignore
        }
        await invalidateAll();
      } else {
        throw new Error('Falha na persistência');
      }
    } catch (err) {
      console.warn('[NOTIF] Erro ao marcar todas como lidas:', err);
      // Rollback optimistic state
      localNotifications = prevNotifications;
      window.dispatchEvent(
        new CustomEvent('nox:notifications-updated', {
          detail: { unread: prevUnreadCount }
        })
      );
      showToast('Não foi possível marcar todas as notificações como lidas. Tente novamente.');
    } finally {
      busyAll = false;
    }
  }

  // Handle card click (mark as read + navigate)
  async function handleNotificationClick(notif: (typeof data.notifications)[0], e: MouseEvent) {
    if (!notif.isRead) {
      markAsRead(notif.id);
    }
    if (notif.href && notif.href !== '#') {
      if (e.metaKey || e.ctrlKey) {
        window.open(notif.href, '_blank');
      } else {
        goto(notif.href);
      }
    }
  }

  // Format relative timestamp
  function formatRelativeTime(dateStr: string): string {
    const d = new Date(dateStr);
    const now = new Date();
    const diffSec = Math.floor((now.getTime() - d.getTime()) / 1000);

    if (diffSec < 60) return 'Agora mesmo';
    if (diffSec < 3600) {
      const mins = Math.floor(diffSec / 60);
      return `Há ${mins} ${mins === 1 ? 'minuto' : 'minutos'}`;
    }
    if (diffSec < 86400) {
      const hours = Math.floor(diffSec / 3600);
      return `Há ${hours} ${hours === 1 ? 'hora' : 'horas'}`;
    }

    const day = String(d.getDate()).padStart(2, '0');
    const monthNames = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    const month = monthNames[d.getMonth()];
    const hours = String(d.getHours()).padStart(2, '0');
    const mins = String(d.getMinutes()).padStart(2, '0');

    if (d.getFullYear() === now.getFullYear()) {
      return `${day} de ${month} às ${hours}:${mins}`;
    }
    return `${day}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
  }

  // Type-specific icon and style resolver
  function getTypeMetadata(type: string, kind: string) {
    const t = (type || kind || '').toUpperCase();

    if (t.includes('CHAPTER')) {
      return {
        icon: BookOpen,
        label: 'Novo Capítulo',
        colorClass: 'type-chapter',
        badgeBg: 'rgba(99, 102, 241, 0.2)',
        badgeColor: '#a5b4fc'
      };
    }
    if (t.includes('REPLY') || t.includes('COMMENT') || t.includes('CHAT')) {
      return {
        icon: MessageSquare,
        label: 'Comentário',
        colorClass: 'type-comment',
        badgeBg: 'rgba(56, 189, 248, 0.2)',
        badgeColor: '#7dd3fc'
      };
    }
    if (t.includes('MENTION')) {
      return {
        icon: AtSign,
        label: 'Menção',
        colorClass: 'type-mention',
        badgeBg: 'rgba(168, 85, 247, 0.2)',
        badgeColor: '#d8b4fe'
      };
    }
    if (t.includes('ACHIEVEMENT') || t.includes('LEVEL') || t.includes('XP')) {
      return {
        icon: Trophy,
        label: 'Conquista',
        colorClass: 'type-achievement',
        badgeBg: 'rgba(245, 158, 11, 0.2)',
        badgeColor: '#fde68a'
      };
    }
    if (t.includes('APPLICATION') || t.includes('RECRUIT') || t.includes('SCAN') || t.includes('PIPELINE') || t.includes('STAGE') || t.includes('TASK')) {
      return {
        icon: Users,
        label: t.includes('PIPELINE') || t.includes('STAGE') || t.includes('TASK') ? 'Produção da Scan' : 'Scan Parceira',
        colorClass: 'type-scan',
        badgeBg: 'rgba(16, 185, 129, 0.2)',
        badgeColor: '#6ee7b7'
      };
    }
    if (t.includes('REPORT') || t.includes('MODERAT') || t.includes('QC')) {
      return {
        icon: ShieldAlert,
        label: 'Moderação / Ticket',
        colorClass: 'type-ticket',
        badgeBg: 'rgba(239, 68, 68, 0.2)',
        badgeColor: '#fca5a5'
      };
    }

    return {
      icon: Bell,
      label: 'Notificação',
      colorClass: 'type-generic',
      badgeBg: 'rgba(148, 163, 184, 0.2)',
      badgeColor: '#cbd5e1'
    };
  }
</script>

<svelte:head>
  <title>Central de Notificações — Project Nox</title>
  <meta name="description" content="Acompanhe lançamentos, respostas, menções e conquistas na Project Nox." />
</svelte:head>

<div class="notifications-page-wrap">
  <!-- Top Toast Notification -->
  {#if toastMessage}
    <div class="notif-toast" role="status" aria-live="polite">
      <CheckCheck size={16} />
      <span>{toastMessage}</span>
    </div>
  {/if}

  <div class="notifications-container">
    <!-- Header Hero -->
    <header class="notifications-header">
      <div class="header-text-group">
        <div class="header-badge-row">
          <span class="hub-pill">
            <Bell size={13} />
            <span>CENTRAL PESSOAL</span>
          </span>
          {#if unreadCount > 0}
            <span class="unread-counter-pill">
              {unreadCount} {unreadCount === 1 ? 'pendência' : 'pendências'}
            </span>
          {/if}
        </div>
        <h1 class="page-title">Notificações</h1>
        <p class="page-subtitle">
          Fique por dentro de novos capítulos, respostas aos seus comentários, menções e conquistas desbloqueadas.
        </p>
      </div>

      <!-- Mark All Read Action -->
      <div class="header-actions">
        <button
          type="button"
          class="btn-mark-all"
          disabled={unreadCount === 0 || busyAll}
          onclick={markAllAsRead}
          title="Marcar todas as notificações como lidas"
        >
          <CheckCheck size={16} />
          <span>{busyAll ? 'Marcando…' : 'Marcar todas como lidas'}</span>
        </button>
      </div>
    </header>

    <!-- Navigation / Filter Tabs -->
    <nav class="notif-tabs-nav" aria-label="Filtro de notificações">
      <button
        type="button"
        class="tab-btn"
        class:active={activeTab === 'todas'}
        onclick={() => setFilterTab('todas')}
      >
        <span>Todas</span>
        <span class="tab-count">{totalCount}</span>
      </button>

      <button
        type="button"
        class="tab-btn"
        class:active={activeTab === 'nao-lidas'}
        onclick={() => setFilterTab('nao-lidas')}
      >
        <span class="tab-label-wrap">
          <span>Não Lidas</span>
          {#if unreadCount > 0}
            <span class="tab-unread-dot"></span>
          {/if}
        </span>
        <span class="tab-count highlight-unread">{unreadCount}</span>
      </button>

      <button
        type="button"
        class="tab-btn"
        class:active={activeTab === 'lidas'}
        onclick={() => setFilterTab('lidas')}
      >
        <span>Lidas</span>
        <span class="tab-count">{readCount}</span>
      </button>
    </nav>

    <!-- Content Stage -->
    <div class="notifications-stage">
      {#if filteredNotifications.length === 0}
        <!-- Empty State -->
        <div class="empty-notif-box">
          <div class="empty-icon-wrap">
            <Inbox size={48} />
            <div class="empty-glow"></div>
          </div>
          <h2 class="empty-title">
            {#if activeTab === 'nao-lidas'}
              Tudo em dia por aqui!
            {:else if activeTab === 'lidas'}
              Nenhuma notificação arquivada
            {:else}
              Sua central de notificações está vazia
            {/if}
          </h2>
          <p class="empty-description">
            {#if activeTab === 'nao-lidas'}
              Você leu todas as suas notificações pendentes. Novas atualizações de obras acompanhadas, respostas e conquistas aparecerão aqui assim que ocorrerem.
            {:else if activeTab === 'lidas'}
              Você ainda não marcou nenhuma notificação como lida.
            {:else}
              Quando obras da sua biblioteca forem atualizadas ou outros leitores interagirem com você, suas notificações ficarão organizadas nesta página.
            {/if}
          </p>

          <div class="empty-actions">
            {#if activeTab !== 'todas' && totalCount > 0}
              <button
                type="button"
                class="btn-empty-action secondary"
                onclick={() => setFilterTab('todas')}
              >
                <Layers size={16} />
                <span>Ver todas as notificações ({totalCount})</span>
              </button>
            {/if}
            <a href="/catalogo" class="btn-empty-action primary">
              <Compass size={16} />
              <span>Explorar Catálogo</span>
            </a>
          </div>
        </div>
      {:else}
        <!-- Grouped Notifications List -->
        <div class="notif-timeline">
          {#each groupedNotifications as group (group.key)}
            <section class="timeline-group" aria-labelledby="heading-{group.key}">
              <div class="group-header">
                <span class="group-title" id="heading-{group.key}">{group.label}</span>
                <span class="group-badge">{group.items.length}</span>
                <div class="group-rule"></div>
              </div>

              <div class="group-cards-stack">
                {#each group.items as item (item.id)}
                  {@const meta = getTypeMetadata(item.type, item.kind)}
                  <article
                    class="notif-card"
                    class:is-unread={!item.isRead}
                    class:is-read={item.isRead}
                    role="button"
                    tabindex="0"
                    onclick={(e) => handleNotificationClick(item, e)}
                    onkeydown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        handleNotificationClick(item, e as any);
                      }
                    }}
                  >
                    <!-- Left: Unread Beacon & Type Icon / Actor Avatar -->
                    <div class="notif-media-col">
                      {#if !item.isRead}
                        <span class="unread-beacon" title="Notificação não lida"></span>
                      {/if}

                      <div class="avatar-or-icon-wrap {meta.colorClass}">
                        {#if item.actor}
                          <UserAvatar
                            avatarId={item.actor.avatarId}
                            displayName={item.actor.displayName}
                            frameId={item.actor.frameId}
                            crop={item.actor.avatarCrop}
                            size={42}
                          />
                          <span class="mini-type-badge {meta.colorClass}">
                            <svelte:component this={meta.icon} size={11} />
                          </span>
                        {:else}
                          <div class="icon-bubble {meta.colorClass}">
                            <svelte:component this={meta.icon} size={20} />
                          </div>
                        {/if}
                      </div>
                    </div>

                    <!-- Middle: Main Information Body -->
                    <div class="notif-content-col">
                      <div class="notif-top-meta">
                        <span class="type-pill" style="background: {meta.badgeBg}; color: {meta.badgeColor};">
                          {meta.label}
                        </span>

                        {#if item.context}
                          <span class="context-pill" title={item.context}>
                            {item.context}
                          </span>
                        {/if}

                        <span class="time-stamp">
                          <Clock size={12} />
                          <span>{formatRelativeTime(item.createdAt)}</span>
                        </span>
                      </div>

                      <h2 class="notif-title">
                        {item.title}
                      </h2>

                      {#if item.body && item.body !== item.title}
                        <p class="notif-body">
                          {item.body}
                        </p>
                      {/if}

                      {#if item.href && item.href !== '#'}
                        <div class="notif-footer-link">
                          <span class="link-label">Acessar conteúdo</span>
                          <ArrowRight size={13} />
                        </div>
                      {/if}
                    </div>

                    <!-- Right: Quick Action Controls -->
                    <div class="notif-actions-col">
                      {#if !item.isRead}
                        <button
                          type="button"
                          class="btn-mark-single"
                          title="Marcar como lida"
                          aria-label="Marcar notificação como lida"
                          disabled={busyIds.has(item.id)}
                          onclick={(e) => markAsRead(item.id, e)}
                        >
                          <Check size={16} />
                        </button>
                      {:else}
                        <span class="read-indicator-icon" title="Lida">
                          <CheckCheck size={16} />
                        </span>
                      {/if}
                    </div>
                  </article>
                {/each}
              </div>
            </section>
          {/each}
        </div>
      {/if}
    </div>
  </div>
</div>

<style>
  .notifications-page-wrap {
    min-height: calc(100vh - 120px);
    background: radial-gradient(circle at 50% 0%, rgba(99, 102, 241, 0.08) 0%, rgba(8, 10, 18, 0) 65%),
                linear-gradient(180deg, #090a10 0%, #06070a 100%);
    color: #e2e8f0;
    padding: 3rem 1.25rem 5rem;
  }

  .notifications-container {
    max-width: 900px;
    margin: 0 auto;
  }

  /* Toast Notification */
  .notif-toast {
    position: fixed;
    top: 84px;
    right: 24px;
    z-index: 1000;
    display: inline-flex;
    align-items: center;
    gap: 0.6rem;
    background: rgba(16, 185, 129, 0.95);
    color: #ffffff;
    font-size: 0.88rem;
    font-weight: 600;
    padding: 0.75rem 1.25rem;
    border-radius: 12px;
    box-shadow: 0 10px 25px rgba(16, 185, 129, 0.4);
    backdrop-filter: blur(12px);
    animation: toastSlideIn 0.3s cubic-bezier(0.16, 1, 0.3, 1);
  }

  @keyframes toastSlideIn {
    from {
      opacity: 0;
      transform: translateY(-12px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  /* Header Section */
  .notifications-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 1.5rem;
    margin-bottom: 2.25rem;
    padding-bottom: 2rem;
    border-bottom: 1px solid rgba(255, 255, 255, 0.07);
  }

  .header-text-group {
    flex: 1;
    min-width: 0;
  }

  .header-badge-row {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    margin-bottom: 0.75rem;
    flex-wrap: wrap;
  }

  .hub-pill {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    background: rgba(99, 102, 241, 0.15);
    border: 1px solid rgba(99, 102, 241, 0.35);
    color: #a5b4fc;
    font-size: 0.72rem;
    font-weight: 800;
    letter-spacing: 0.06em;
    padding: 0.3rem 0.65rem;
    border-radius: 9999px;
  }

  .unread-counter-pill {
    display: inline-flex;
    align-items: center;
    background: rgba(245, 158, 11, 0.15);
    border: 1px solid rgba(245, 158, 11, 0.35);
    color: #fde68a;
    font-size: 0.72rem;
    font-weight: 700;
    padding: 0.3rem 0.65rem;
    border-radius: 9999px;
  }

  .page-title {
    font-size: 2.25rem;
    font-weight: 800;
    color: #f8fafc;
    margin: 0 0 0.5rem;
    letter-spacing: -0.03em;
  }

  .page-subtitle {
    font-size: 0.95rem;
    color: #94a3b8;
    margin: 0;
    line-height: 1.6;
    max-width: 620px;
  }

  .header-actions {
    flex-shrink: 0;
    margin-top: 0.5rem;
  }

  .btn-mark-all {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 12px;
    padding: 0.65rem 1.15rem;
    color: #e2e8f0;
    font-size: 0.86rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;
    white-space: nowrap;
  }

  .btn-mark-all:hover:not(:disabled) {
    background: rgba(99, 102, 241, 0.2);
    border-color: rgba(99, 102, 241, 0.45);
    color: #ffffff;
    box-shadow: 0 4px 16px rgba(99, 102, 241, 0.25);
    transform: translateY(-1px);
  }

  .btn-mark-all:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }

  /* Navigation Tabs */
  .notif-tabs-nav {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    margin-bottom: 2rem;
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
    padding-bottom: 0.5rem;
    overflow-x: auto;
  }

  .tab-btn {
    display: inline-flex;
    align-items: center;
    gap: 0.55rem;
    background: transparent;
    border: none;
    border-bottom: 2px solid transparent;
    padding: 0.65rem 1rem;
    color: #94a3b8;
    font-size: 0.92rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;
    white-space: nowrap;
  }

  .tab-btn:hover {
    color: #e2e8f0;
  }

  .tab-btn.active {
    color: #f8fafc;
    border-bottom-color: #8b5cf6;
  }

  .tab-label-wrap {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
  }

  .tab-unread-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: #f59e0b;
    box-shadow: 0 0 8px #f59e0b;
  }

  .tab-count {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    background: rgba(255, 255, 255, 0.07);
    color: #cbd5e1;
    font-size: 0.76rem;
    font-weight: 700;
    min-width: 22px;
    height: 20px;
    padding: 0 6px;
    border-radius: 9999px;
  }

  .tab-btn.active .tab-count {
    background: rgba(139, 92, 246, 0.2);
    color: #ddd6fe;
  }

  .tab-count.highlight-unread {
    background: rgba(245, 158, 11, 0.2);
    color: #fde68a;
  }

  /* Timeline Groups */
  .notif-timeline {
    display: flex;
    flex-direction: column;
    gap: 2.25rem;
  }

  .timeline-group {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .group-header {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .group-title {
    font-size: 0.85rem;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: #818cf8;
  }

  .group-badge {
    font-size: 0.72rem;
    font-weight: 700;
    background: rgba(99, 102, 241, 0.15);
    color: #a5b4fc;
    padding: 0.15rem 0.5rem;
    border-radius: 9999px;
  }

  .group-rule {
    flex: 1;
    height: 1px;
    background: linear-gradient(90deg, rgba(99, 102, 241, 0.25) 0%, rgba(255, 255, 255, 0.04) 100%);
  }

  .group-cards-stack {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  /* Notification Card */
  .notif-card {
    position: relative;
    display: flex;
    align-items: flex-start;
    gap: 1.15rem;
    padding: 1.15rem 1.35rem;
    border-radius: 16px;
    background: rgba(18, 20, 32, 0.65);
    border: 1px solid rgba(255, 255, 255, 0.07);
    backdrop-filter: blur(14px);
    cursor: pointer;
    transition: all 0.22s cubic-bezier(0.16, 1, 0.3, 1);
    outline: none;
    text-align: left;
  }

  .notif-card:hover {
    transform: translateY(-2px);
    background: rgba(24, 28, 44, 0.8);
    border-color: rgba(139, 92, 246, 0.35);
    box-shadow: 0 8px 24px -4px rgba(0, 0, 0, 0.45);
  }

  .notif-card:focus-visible {
    border-color: #8b5cf6;
    box-shadow: 0 0 0 3px rgba(139, 92, 246, 0.3);
  }

  /* Unread Card Styling */
  .notif-card.is-unread {
    background: linear-gradient(135deg, rgba(99, 102, 241, 0.1) 0%, rgba(18, 22, 38, 0.8) 100%);
    border-color: rgba(99, 102, 241, 0.42);
    box-shadow: 0 6px 20px -2px rgba(99, 102, 241, 0.15);
  }

  .notif-card.is-unread:hover {
    border-color: rgba(139, 92, 246, 0.65);
    background: linear-gradient(135deg, rgba(99, 102, 241, 0.16) 0%, rgba(22, 27, 46, 0.9) 100%);
    box-shadow: 0 10px 28px -4px rgba(99, 102, 241, 0.28);
  }

  /* Read Card Styling */
  .notif-card.is-read {
    opacity: 0.85;
  }

  .notif-card.is-read:hover {
    opacity: 1;
  }

  /* Media Col */
  .notif-media-col {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    margin-top: 2px;
  }

  .unread-beacon {
    position: absolute;
    top: -4px;
    left: -4px;
    width: 9px;
    height: 9px;
    border-radius: 50%;
    background: #6366f1;
    border: 2px solid #0d0f18;
    box-shadow: 0 0 10px #6366f1;
    z-index: 3;
    animation: beaconPulse 2s infinite;
  }

  @keyframes beaconPulse {
    0%, 100% {
      transform: scale(1);
      box-shadow: 0 0 8px #6366f1;
    }
    50% {
      transform: scale(1.2);
      box-shadow: 0 0 14px #818cf8;
    }
  }

  .avatar-or-icon-wrap {
    position: relative;
    width: 44px;
    height: 44px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .mini-type-badge {
    position: absolute;
    bottom: -2px;
    right: -2px;
    width: 18px;
    height: 18px;
    border-radius: 50%;
    background: #0f121e;
    border: 1.5px solid rgba(255, 255, 255, 0.2);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 2;
  }

  .mini-type-badge.type-chapter { color: #818cf8; }
  .mini-type-badge.type-comment { color: #38bdf8; }
  .mini-type-badge.type-mention { color: #c084fc; }
  .mini-type-badge.type-achievement { color: #fbbf24; }
  .mini-type-badge.type-scan { color: #34d399; }
  .mini-type-badge.type-ticket { color: #f87171; }

  .icon-bubble {
    width: 42px;
    height: 42px;
    border-radius: 12px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.08);
  }

  .icon-bubble.type-chapter {
    background: rgba(99, 102, 241, 0.16);
    border-color: rgba(99, 102, 241, 0.35);
    color: #a5b4fc;
  }

  .icon-bubble.type-comment {
    background: rgba(56, 189, 248, 0.16);
    border-color: rgba(56, 189, 248, 0.35);
    color: #7dd3fc;
  }

  .icon-bubble.type-mention {
    background: rgba(168, 85, 247, 0.16);
    border-color: rgba(168, 85, 247, 0.35);
    color: #d8b4fe;
  }

  .icon-bubble.type-achievement {
    background: rgba(245, 158, 11, 0.16);
    border-color: rgba(245, 158, 11, 0.35);
    color: #fde68a;
  }

  .icon-bubble.type-scan {
    background: rgba(16, 185, 129, 0.16);
    border-color: rgba(16, 185, 129, 0.35);
    color: #6ee7b7;
  }

  .icon-bubble.type-ticket {
    background: rgba(239, 68, 68, 0.16);
    border-color: rgba(239, 68, 68, 0.35);
    color: #fca5a5;
  }

  /* Content Col */
  .notif-content-col {
    flex: 1;
    min-width: 0;
  }

  .notif-top-meta {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    margin-bottom: 0.35rem;
    flex-wrap: wrap;
  }

  .type-pill {
    font-size: 0.7rem;
    font-weight: 700;
    padding: 0.15rem 0.55rem;
    border-radius: 6px;
    letter-spacing: 0.02em;
  }

  .context-pill {
    font-size: 0.72rem;
    font-weight: 600;
    background: rgba(255, 255, 255, 0.06);
    color: #cbd5e1;
    padding: 0.15rem 0.55rem;
    border-radius: 6px;
    max-width: 240px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .time-stamp {
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
    font-size: 0.72rem;
    color: #64748b;
    margin-left: auto;
  }

  .notif-title {
    font-size: 0.98rem;
    font-weight: 600;
    color: #f1f5f9;
    margin: 0 0 0.3rem;
    line-height: 1.45;
  }

  .notif-card.is-unread .notif-title {
    font-weight: 700;
    color: #ffffff;
  }

  .notif-body {
    font-size: 0.88rem;
    color: #94a3b8;
    margin: 0 0 0.5rem;
    line-height: 1.5;
    word-break: break-word;
  }

  .notif-footer-link {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    font-size: 0.8rem;
    font-weight: 600;
    color: #818cf8;
    margin-top: 0.2rem;
    transition: gap 0.15s ease;
  }

  .notif-card:hover .notif-footer-link {
    gap: 0.55rem;
    color: #a5b4fc;
  }

  /* Actions Col */
  .notif-actions-col {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-left: 0.5rem;
    margin-top: 2px;
  }

  .btn-mark-single {
    width: 34px;
    height: 34px;
    border-radius: 10px;
    background: rgba(99, 102, 241, 0.15);
    border: 1px solid rgba(99, 102, 241, 0.35);
    color: #a5b4fc;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: all 0.18s ease;
  }

  .btn-mark-single:hover:not(:disabled) {
    background: #6366f1;
    border-color: #6366f1;
    color: #ffffff;
    box-shadow: 0 4px 12px rgba(99, 102, 241, 0.4);
    transform: scale(1.08);
  }

  .btn-mark-single:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .read-indicator-icon {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    color: #475569;
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }

  /* Empty State */
  .empty-notif-box {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    text-align: center;
    padding: 4.5rem 2rem;
    background: rgba(14, 16, 26, 0.5);
    border: 1px dashed rgba(255, 255, 255, 0.1);
    border-radius: 24px;
  }

  .empty-icon-wrap {
    position: relative;
    width: 88px;
    height: 88px;
    border-radius: 24px;
    background: rgba(99, 102, 241, 0.1);
    border: 1px solid rgba(99, 102, 241, 0.25);
    display: flex;
    align-items: center;
    justify-content: center;
    color: #818cf8;
    margin-bottom: 1.5rem;
  }

  .empty-glow {
    position: absolute;
    width: 100%;
    height: 100%;
    border-radius: 24px;
    background: radial-gradient(circle, rgba(99, 102, 241, 0.3) 0%, transparent 70%);
    filter: blur(14px);
    z-index: -1;
  }

  .empty-title {
    font-size: 1.35rem;
    font-weight: 700;
    color: #f1f5f9;
    margin: 0 0 0.6rem;
  }

  .empty-description {
    font-size: 0.92rem;
    color: #94a3b8;
    max-width: 480px;
    line-height: 1.6;
    margin: 0 0 1.75rem;
  }

  .empty-actions {
    display: flex;
    align-items: center;
    gap: 0.85rem;
    flex-wrap: wrap;
    justify-content: center;
  }

  .btn-empty-action {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.65rem 1.25rem;
    border-radius: 12px;
    font-size: 0.88rem;
    font-weight: 600;
    text-decoration: none;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .btn-empty-action.primary {
    background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
    color: #ffffff;
    box-shadow: 0 4px 16px rgba(99, 102, 241, 0.35);
    border: none;
  }

  .btn-empty-action.primary:hover {
    box-shadow: 0 6px 22px rgba(99, 102, 241, 0.5);
    transform: translateY(-1px);
  }

  .btn-empty-action.secondary {
    background: rgba(255, 255, 255, 0.06);
    border: 1px solid rgba(255, 255, 255, 0.12);
    color: #e2e8f0;
  }

  .btn-empty-action.secondary:hover {
    background: rgba(255, 255, 255, 0.12);
    color: #ffffff;
  }

  /* Responsive Rules */
  @media (max-width: 768px) {
    .notifications-page-wrap {
      padding: 1.5rem 1rem 4rem;
    }

    .notifications-header {
      flex-direction: column;
      align-items: stretch;
      gap: 1.25rem;
      margin-bottom: 1.5rem;
      padding-bottom: 1.5rem;
    }

    .header-actions {
      margin-top: 0;
    }

    .btn-mark-all {
      width: 100%;
      justify-content: center;
    }

    .page-title {
      font-size: 1.75rem;
    }

    .notif-card {
      padding: 1rem;
      gap: 0.85rem;
    }

    .notif-title {
      font-size: 0.92rem;
    }

    .notif-body {
      font-size: 0.84rem;
    }

    .context-pill {
      max-width: 150px;
    }
  }

  @media (max-width: 480px) {
    .notif-top-meta {
      gap: 0.4rem;
    }

    .time-stamp {
      width: 100%;
      margin-left: 0;
      margin-top: 0.15rem;
    }

    .notif-card {
      flex-direction: column;
      align-items: stretch;
    }

    .notif-media-col {
      align-self: flex-start;
    }

    .notif-actions-col {
      align-self: flex-end;
      margin-top: -30px;
    }
  }
</style>
