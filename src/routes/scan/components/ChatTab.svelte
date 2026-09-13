<script lang="ts">
  import {
    MessageSquare,
    Hash,
    Megaphone,
    Plus,
    Send,
    Smile,
    Pin,
    Check,
    CheckCheck,
    CornerDownRight,
    AtSign,
    Users,
    Bell,
    BellOff,
    MoreVertical,
    X,
    Filter,
    Shield,
    Sparkles,
    FileText,
    ExternalLink,
    Paperclip,
    GripVertical,
    Edit2,
    Trash2,
    Copy
  } from '@lucide/svelte';
  import { onMount, onDestroy } from 'svelte';
  import { invalidateAll } from '$app/navigation';
  import { getSupabaseBrowserClient } from '$lib/supabase';
  import type { RealtimeChannel } from '@supabase/supabase-js';
  import { enhance } from '$app/forms';
  import UserAvatar from '$lib/components/UserAvatar.svelte';

  let {
    channels = [],
    messages = [],
    team = [],
    positions = [],
    channelReadStates = [],
    currentUserId = '',
    currentScanId = '',
    isOwnerOrAdmin: isOwnerOrAdminProp = false,
    userRole = 'MEMBER',
    initialChannelId = ''
  } = $props();

  let isOwnerOrAdmin = $derived(isOwnerOrAdminProp || userRole === 'OWNER' || userRole === 'ADMIN');

  let myMemberInfo = $derived(team.find((m: any) => m.id === currentUserId || m.user_id === currentUserId));
  let myDisplayName = $derived(myMemberInfo?.display_name || myMemberInfo?.username || 'Membro');

  let localChannels = $state<any[]>([]);

  $effect(() => {
    localChannels = [...channels].sort((a: any, b: any) => (a.display_order ?? 0) - (b.display_order ?? 0));
  });

  let activeChannelId = $state<string>('');

  $effect(() => {
    if (!activeChannelId && localChannels.length > 0) {
      if (initialChannelId && localChannels.some((c: any) => c.id === initialChannelId)) {
        activeChannelId = initialChannelId;
      } else {
        const preferred = !isOwnerOrAdmin ? localChannels.find((c: any) => c.type !== 'ANNOUNCEMENT') : null;
        activeChannelId = preferred ? preferred.id : localChannels[0].id;
      }
    }
  });

  let activeChannel = $derived(localChannels.find((c: any) => c.id === activeChannelId) || localChannels[0]);

  let channelMessages = $derived(
    messages.filter((m: any) => m.channel_id === activeChannelId)
  );

  let messageInput = $state('');
  let isSubmitting = $state(false);
  let isUploadingChatFile = $state(false);
  let textareaEl = $state<HTMLTextAreaElement | null>(null);

  // Reply state
  let replyingTo = $state<any | null>(null);

  // Edit message state
  let editingMessageId = $state<string | null>(null);
  let editingContent = $state('');

  // Dropdown & Picker states
  let activeMenuMsgId = $state<string | null>(null);
  let activeEmojiPickerMsgId = $state<string | null>(null);

  // Mobile long-press context menu
  let mobileLongPressMsg = $state<any | null>(null);
  let longPressTimer: any = null;

  function startLongPress(msg: any) {
    longPressTimer = setTimeout(() => {
      mobileLongPressMsg = msg;
    }, 500);
  }

  function cancelLongPress() {
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      longPressTimer = null;
    }
  }

  function closeMobileMsgMenu() {
    mobileLongPressMsg = null;
  }

  // Drag and drop / Reordering channels state
  let draggedChannelId = $state<string | null>(null);
  let dragOverChannelId = $state<string | null>(null);
  let isReordering = $state(false);

  async function handleDropChannel(targetId: string) {
    if (!draggedChannelId || draggedChannelId === targetId || !isOwnerOrAdmin) {
      draggedChannelId = null;
      dragOverChannelId = null;
      return;
    }

    const items = [...localChannels];
    const fromIdx = items.findIndex((c) => c.id === draggedChannelId);
    const toIdx = items.findIndex((c) => c.id === targetId);
    if (fromIdx === -1 || toIdx === -1) {
      draggedChannelId = null;
      dragOverChannelId = null;
      return;
    }

    const [moved] = items.splice(fromIdx, 1);
    items.splice(toIdx, 0, moved);

    const updated = items.map((ch, idx) => ({ ...ch, display_order: idx * 10 }));
    localChannels = updated;
    draggedChannelId = null;
    dragOverChannelId = null;

    try {
      isReordering = true;
      const payload = updated.map((ch) => ({ id: ch.id, display_order: ch.display_order }));
      const fd = new FormData();
      fd.set('scan_id', currentScanId);
      fd.set('orders', JSON.stringify(payload));
      await fetch('?/reorderChannels', { method: 'POST', body: fd });
    } catch (e) {
      console.error('Failed to persist channel order:', e);
    } finally {
      isReordering = false;
    }
  }

  async function moveChannel(channelId: string, direction: 'up' | 'down') {
    if (!isOwnerOrAdmin) return;
    const items = [...localChannels];
    const idx = items.findIndex((c) => c.id === channelId);
    if (idx === -1) return;
    const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= items.length) return;

    const [moved] = items.splice(idx, 1);
    items.splice(targetIdx, 0, moved);

    const updated = items.map((ch, i) => ({ ...ch, display_order: i * 10 }));
    localChannels = updated;

    try {
      isReordering = true;
      const payload = updated.map((ch) => ({ id: ch.id, display_order: ch.display_order }));
      const fd = new FormData();
      fd.set('scan_id', currentScanId);
      fd.set('orders', JSON.stringify(payload));
      await fetch('?/reorderChannels', { method: 'POST', body: fd });
    } catch (e) {
      console.error('Failed to move channel:', e);
    } finally {
      isReordering = false;
    }
  }

  // Realtime Supabase Channel Subscription & Typing Broadcast
  let realtimeChannel: RealtimeChannel | null = null;
  let typingUsers = $state<Record<string, { username: string; timer: any }>>({});
  let lastTypingBroadcast = 0;

  function broadcastTyping() {
    const now = Date.now();
    if (now - lastTypingBroadcast > 2000 && realtimeChannel) {
      lastTypingBroadcast = now;
      realtimeChannel.send({
        type: 'broadcast',
        event: 'typing',
        payload: { userId: currentUserId, username: myDisplayName }
      });
    }
  }

  let typingText = $derived.by(() => {
    const names = Object.values(typingUsers).map((u) => u.username);
    if (names.length === 0) return '';
    if (names.length === 1) return names[0] + ' está digitando...';
    if (names.length === 2) return names[0] + ' e ' + names[1] + ' estão digitando...';
    return names[0] + ' e outros estão digitando...';
  });

  onMount(() => {
    const client = getSupabaseBrowserClient();
    if (!client || !currentScanId) return;

    realtimeChannel = client
      .channel('scan_chat:' + currentScanId, {
        config: { broadcast: { self: false } }
      })
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'scan_messages',
          filter: 'scan_id=eq.' + currentScanId
        },
        async () => {
          await invalidateAll();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'scan_message_reactions'
        },
        async () => {
          await invalidateAll();
        }
      )
      .on('broadcast', { event: 'typing' }, ({ payload }: any) => {
        if (!payload || payload.userId === currentUserId) return;
        const uid = payload.userId;
        if (typingUsers[uid]?.timer) {
          clearTimeout(typingUsers[uid].timer);
        }
        const timer = setTimeout(() => {
          const copy = { ...typingUsers };
          delete copy[uid];
          typingUsers = copy;
        }, 3000);
        typingUsers = {
          ...typingUsers,
          [uid]: { username: payload.username || 'Membro', timer }
        };
      })
      .subscribe();

    // Deep link hash handling (#msg-<id>)
    if (typeof window !== 'undefined' && window.location.hash?.startsWith('#msg-')) {
      const targetMsgId = window.location.hash.replace('#msg-', '');
      const foundMsg = messages.find((m: any) => m.id === targetMsgId);
      if (foundMsg) {
        if (foundMsg.channel_id && foundMsg.channel_id !== activeChannelId) {
          activeChannelId = foundMsg.channel_id;
        }
        setTimeout(() => {
          scrollToMessage(targetMsgId);
        }, 400);
      }
    }
  });

  onDestroy(() => {
    if (realtimeChannel) {
      realtimeChannel.unsubscribe();
    }
    for (const item of Object.values(typingUsers)) {
      if (item.timer) clearTimeout(item.timer);
    }
  });

  // Grouped reactions helper
  function getGroupedReactions(reactions: any[] = []) {
    const map = new Map<string, { emoji: string; count: number; reactedByMe: boolean }>();
    for (const r of reactions) {
      if (!map.has(r.emoji)) {
        map.set(r.emoji, { emoji: r.emoji, count: 0, reactedByMe: false });
      }
      const item = map.get(r.emoji)!;
      item.count++;
      if (r.user_id === currentUserId) item.reactedByMe = true;
    }
    return Array.from(map.values());
  }

  // Toggle Reaction Action
  async function toggleReaction(messageId: string, emoji: string) {
    activeEmojiPickerMsgId = null;
    try {
      const fd = new FormData();
      fd.set('messageId', messageId);
      fd.set('emoji', emoji);
      await fetch('?/toggleReaction', { method: 'POST', body: fd });
      await invalidateAll();
    } catch (e) {
      console.error('Failed to toggle reaction:', e);
    }
  }

  // Edit Message Action
  async function saveEditedMessage(messageId: string) {
    if (!editingContent.trim()) return;
    try {
      const fd = new FormData();
      fd.set('messageId', messageId);
      fd.set('content', editingContent.trim());
      await fetch('?/editMessage', { method: 'POST', body: fd });
      editingMessageId = null;
      await invalidateAll();
    } catch (e) {
      console.error('Failed to edit message:', e);
    }
  }

  // Delete message confirmation modal state
  let messageToDelete = $state<any | null>(null);
  let isDeletingMessage = $state(false);

  function openDeleteModal(msg: any) {
    activeMenuMsgId = null;
    closeMobileMsgMenu();
    messageToDelete = msg;
  }

  async function confirmDeleteMessage() {
    if (!messageToDelete) return;
    isDeletingMessage = true;
    try {
      const fd = new FormData();
      fd.set('messageId', messageToDelete.id);
      await fetch('?/deleteMessage&id=' + currentScanId + '&tab=chat', {
        method: 'POST',
        body: fd
      });
      messageToDelete = null;
      await invalidateAll();
    } catch (e) {
      console.error('Failed to delete message:', e);
    } finally {
      isDeletingMessage = false;
    }
  }

  // Deep Link Notice state
  let deepLinkNotice = $state<string | null>(null);
  function showDeepLinkNotice(text: string) {
    deepLinkNotice = text;
    setTimeout(() => {
      if (deepLinkNotice === text) deepLinkNotice = null;
    }, 4500);
  }

  // Scroll to quoted message with deep link support
  function scrollToMessage(id: string) {
    const el = document.getElementById('msg-' + id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.classList.add('highlight-pulse');
      setTimeout(() => el.classList.remove('highlight-pulse'), 2500);

      const msgObj = messages.find((m: any) => m.id === id);
      if (msgObj?.deleted_at) {
        showDeepLinkNotice('Esta mensagem não está mais disponível.');
      }
    } else {
      showDeepLinkNotice('Esta mensagem não está mais disponível.');
    }
  }

  // Tracked mentions for structured submission
  let trackedMentions = $state<Array<{ type: string; id: string; label: string }>>([]);
  let validMentions = $derived(
    trackedMentions.filter(m => messageInput.includes(m.label))
  );

  // Channel Unread Divider State
  let activeChannelReadState = $derived(
    channelReadStates.find((s: any) => s.channel_id === activeChannelId)
  );

  let firstUnreadMsgId = $derived.by(() => {
    if (!activeChannelReadState || !activeChannelReadState.last_read_at) return null;
    const readAt = new Date(activeChannelReadState.last_read_at).getTime();
    const unread = displayedMessages.find(
      (m: any) => new Date(m.created_at).getTime() > readAt && m.user_id !== currentUserId
    );
    return unread ? unread.id : null;
  });

  async function markCurrentChannelRead() {
    if (!activeChannelId || displayedMessages.length === 0) return;
    const latest = displayedMessages[displayedMessages.length - 1];
    if (!latest) return;
    try {
      const fd = new FormData();
      fd.set('scanId', currentScanId);
      fd.set('channelId', activeChannelId);
      fd.set('messageId', latest.id);
      await fetch('?/markChannelRead', { method: 'POST', body: fd });
    } catch (e) {
      // ignore
    }
  }

  $effect(() => {
    if (activeChannelId && displayedMessages.length > 0) {
      markCurrentChannelRead();
    }
  });

  async function handleChatFileUpload(e: Event) {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    isUploadingChatFile = true;
    try {
      const formData = new FormData();
      formData.append('scan_id', currentScanId);
      formData.append('context_type', 'SCAN_CHAT');
      formData.append('context_id', activeChannelId);
      formData.append('file', file);

      const res = await fetch('/api/scan/attachments/upload', {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || 'Falha ao anexar arquivo');

      const fileLink = '📎 [' + data.attachment.original_filename + '](/api/scan/attachments/' + data.attachment.id + '?download=1) (' + Math.round(data.attachment.size / 1024) + ' KB)';
      messageInput = (messageInput ? messageInput + '\n' : '') + fileLink;
      if (textareaEl) textareaEl.focus();
    } catch (err: any) {
      alert(err.message || 'Erro ao enviar anexo');
    } finally {
      isUploadingChatFile = false;
      input.value = '';
    }
  }

  function formatMessageText(text: string) {
    if (!text) return '';
    const escaped = text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');

    const withLinks = escaped.replace(
      /\[([^\]]+)\]\(([^)]+)\)/g,
      '<a href="$2" target="_blank" rel="noopener noreferrer" class="chat-file-link">$1</a>'
    );

    return withLinks.replace(
      /(^|[^a-zA-Z0-9_])(@[a-zA-Z0-9_À-ÿ]+)/g,
      '$1<span class="mention-tag">$2</span>'
    );
  }

  // Mention autocomplete popup state
  let showMentionMenu = $state(false);
  let mentionQuery = $state('');
  let mentionIndex = $state(0);

  // Thread sidebar panel state
  let activeThreadMessage = $state<any>(null);
  let threadReplyInput = $state('');
  let isSendingThread = $state(false);

  // Create Channel Modal state
  let showCreateChannelModal = $state(false);
  let newChannelName = $state('');
  let newChannelCategory = $state('GERAL');
  let newChannelType = $state<'CHAT' | 'ANNOUNCEMENT'>('CHAT');
  let newChannelDesc = $state('');

  // Pinned message filter
  let showOnlyPinned = $state(false);
  let displayedMessages = $derived(
    showOnlyPinned
      ? channelMessages.filter((m: any) => m.pinned)
      : channelMessages
  );

  // Categories grouping
  let channelCategories = $derived.by(() => {
    const cats: Record<string, any[]> = {};
    for (const c of localChannels) {
      const cat = c.category || 'GERAL';
      if (!cats[cat]) cats[cat] = [];
      cats[cat].push(c);
    }
    return cats;
  });

  // Autocomplete candidate list
  let mentionCandidates = $derived.by(() => {
    if (!showMentionMenu) return [];
    const q = mentionQuery.toLowerCase();
    const res: Array<{ type: 'user' | 'position' | 'all'; id: string; label: string; sub: string }> = [];

    if (isOwnerOrAdmin && ('todos'.includes(q) || 'everyone'.includes(q))) {
      res.push({ type: 'all', id: 'all', label: '@todos', sub: 'Notifica todos os membros da Scan' });
    }

    for (const p of positions) {
      if (p.name.toLowerCase().includes(q)) {
        res.push({ type: 'position', id: p.id, label: '@' + p.name, sub: 'Notifica todos os ' + p.name + 's da Scan' });
      }
    }

    for (const m of team) {
      // team items are flat: id, username, display_name, role are direct properties
      // (server spreads ...r.members into the object)
      const username = m.username || m.members?.username || m.member?.username;
      const displayName = m.display_name || m.members?.display_name || m.member?.display_name;
      const memberId = m.id || m.members?.id || m.member?.id;
      const avatarId = m.avatar_id || m.members?.avatar_id || m.member?.avatar_id;
      if (username) {
        const matchName = (displayName || '').toLowerCase().includes(q) || username.toLowerCase().includes(q);
        if (matchName) {
          res.push({
            type: 'user',
            id: memberId,
            label: '@' + username,
            sub: displayName || m.role || '',
            avatar_id: avatarId,
            display_name: displayName,
            username: username
          });
        }
      }
    }

    return res.slice(0, 6);
  });

  function handleInputKeyDown(e: KeyboardEvent) {
    if (showMentionMenu && mentionCandidates.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        mentionIndex = (mentionIndex + 1) % mentionCandidates.length;
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        mentionIndex = (mentionIndex - 1 + mentionCandidates.length) % mentionCandidates.length;
        return;
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        selectMention(mentionCandidates[mentionIndex]);
        return;
      }
      if (e.key === 'Escape') {
        showMentionMenu = false;
        return;
      }
    }

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      const form = (e.target as HTMLElement).closest('form');
      if (form && messageInput.trim()) form.requestSubmit();
    }
  }

  function handleInputChange(val: string) {
    messageInput = val;
    broadcastTyping();
    const lastAt = val.lastIndexOf('@');
    if (lastAt !== -1 && (lastAt === 0 || /\s/.test(val[lastAt - 1]))) {
      const query = val.slice(lastAt + 1);
      if (!/\s/.test(query)) {
        showMentionMenu = true;
        mentionQuery = query;
        mentionIndex = 0;
        return;
      }
    }
    showMentionMenu = false;
  }

  function selectMention(item: { type: string; id: string; label: string }) {
    const lastAt = messageInput.lastIndexOf('@');
    if (lastAt !== -1) {
      messageInput = messageInput.slice(0, lastAt) + item.label + ' ';
    }
    if (!trackedMentions.some((m) => m.label === item.label)) {
      trackedMentions = [...trackedMentions, item];
    }
    showMentionMenu = false;
  }
</script>

<div class="chat-module-root">
  <!-- Left Sidebar: Channels & Categories -->
  <aside class="chat-channels-sidebar">
    <div class="channels-sidebar-header">
      <span class="channels-header-title">CANAIS DA SCAN</span>
      {#if isOwnerOrAdmin}
        <button
          type="button"
          class="btn-icon-xs"
          title="Criar novo canal"
          onclick={() => (showCreateChannelModal = true)}
        >
          <Plus size={14} />
        </button>
      {/if}
    </div>

    <div class="channels-list-scroll">
      {#each Object.entries(channelCategories) as [category, chList]}
        <div class="category-block">
          <span class="category-name">{category}</span>
          <div class="category-channels">
            {#each chList as ch, chIdx (ch.id)}
              <div
                class="channel-nav-item-wrapper"
                class:is-dragged={draggedChannelId === ch.id}
                class:drag-over={dragOverChannelId === ch.id}
                draggable={isOwnerOrAdmin}
                ondragstart={(e) => {
                  if (!isOwnerOrAdmin) return;
                  draggedChannelId = ch.id;
                  e.dataTransfer?.setData('text/plain', ch.id);
                }}
                ondragover={(e) => {
                  if (!isOwnerOrAdmin) return;
                  e.preventDefault();
                  dragOverChannelId = ch.id;
                }}
                ondragleave={() => {
                  if (dragOverChannelId === ch.id) dragOverChannelId = null;
                }}
                ondrop={(e) => {
                  e.preventDefault();
                  handleDropChannel(ch.id);
                }}
              >
                {#if isOwnerOrAdmin}
                  <span class="drag-handle" title="Arraste para reordenar canal">
                    <GripVertical size={13} />
                  </span>
                {/if}

                <button
                  type="button"
                  class="channel-nav-item"
                  class:active={ch.id === activeChannelId}
                  onclick={() => {
                    activeChannelId = ch.id;
                    showOnlyPinned = false;
                    activeThreadMessage = null;
                    replyingTo = null;
                    editingMessageId = null;
                  }}
                >
                  {#if ch.type === 'ANNOUNCEMENT'}
                    <Megaphone size={14} class="channel-icon icon-announcement" />
                  {:else}
                    <Hash size={14} class="channel-icon" />
                  {/if}
                  <span class="channel-label">{ch.name}</span>
                  {#if ch.is_private}
                    <Shield size={11} class="private-badge" title="Canal Privado" />
                  {/if}
                </button>

                {#if isOwnerOrAdmin}
                  <div class="channel-order-controls">
                    <button
                      type="button"
                      class="btn-order-arrow"
                      title="Mover canal para cima"
                      disabled={chIdx === 0 || isReordering}
                      onclick={(e) => { e.stopPropagation(); moveChannel(ch.id, 'up'); }}
                    >
                      ▲
                    </button>
                    <button
                      type="button"
                      class="btn-order-arrow"
                      title="Mover canal para baixo"
                      disabled={chIdx === chList.length - 1 || isReordering}
                      onclick={(e) => { e.stopPropagation(); moveChannel(ch.id, 'down'); }}
                    >
                      ▼
                    </button>
                  </div>
                {/if}
              </div>
            {/each}
          </div>
        </div>
      {/each}
    </div>
  </aside>

  <!-- Central Chat Area -->
  <main class="chat-main-area">
    <!-- Channel Header -->
    <header class="channel-header-bar">
      <div class="channel-header-info">
        <div class="channel-title-row">
          {#if activeChannel?.type === 'ANNOUNCEMENT'}
            <Megaphone size={18} class="title-icon icon-announcement" />
          {:else}
            <Hash size={18} class="title-icon" />
          {/if}
          <h2 class="channel-heading">{activeChannel?.name || 'geral'}</h2>
        </div>
        {#if activeChannel?.description}
          <p class="channel-subdesc">{activeChannel.description}</p>
        {/if}
      </div>

      <div class="channel-header-controls">
        <button
          type="button"
          class="btn-control-pill"
          class:active={showOnlyPinned}
          title="Ver mensagens fixadas"
          onclick={() => (showOnlyPinned = !showOnlyPinned)}
        >
          <Pin size={13} />
          <span>Fixadas</span>
        </button>
      </div>
    </header>

    <!-- Messages Scroll Feed -->
    <div class="messages-feed-viewport">
      {#if deepLinkNotice}
        <div class="deep-link-notice-banner">
          <Shield size={14} />
          <span>{deepLinkNotice}</span>
          <button type="button" class="btn-dismiss-notice" onclick={() => (deepLinkNotice = null)}>
            <X size={13} />
          </button>
        </div>
      {/if}

      {#if displayedMessages.length === 0}
        <div class="empty-feed">
          <MessageSquare size={36} class="empty-feed-icon" />
          <p class="empty-feed-title">Nenhuma mensagem neste canal ainda</p>
          <p class="empty-feed-sub">
            {#if activeChannel?.type === 'ANNOUNCEMENT'}
              Avisos oficiais da administração serão exibidos aqui.
            {:else}
              Envie a primeira mensagem para iniciar a conversa da equipe!
            {/if}
          </p>
        </div>
      {:else}
        <div class="messages-list">
          {#each displayedMessages as msg (msg.id)}
            {@const grouped = getGroupedReactions(msg.reactions || [])}
            {#if msg.id === firstUnreadMsgId}
              <div class="unread-divider-line">
                <div class="divider-rule"></div>
                <span class="divider-pill">Novas mensagens</span>
                <div class="divider-rule"></div>
              </div>
            {/if}

            {#if msg.deleted_at}
              <div class="message-card deleted-msg-card" id="msg-{msg.id}">
                <div class="deleted-msg-inner">
                  <span class="deleted-msg-icon"><Trash2 size={13} /></span>
                  <span class="deleted-msg-text">Mensagem excluída</span>
                  <span class="deleted-msg-time">{new Date(msg.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
              </div>
            {:else}
              <div class="message-card" id="msg-{msg.id}" class:pinned={msg.pinned}>
                {#if msg.reply_to_id}
                  <button
                    type="button"
                    class="reply-quote-row"
                    onclick={() => scrollToMessage(msg.reply_to_id)}
                    title="Ir para a mensagem original"
                  >
                    <CornerDownRight size={12} class="reply-curve" />
                    {#if msg.reply_to?.deleted_at || !msg.reply_to}
                      <span class="reply-content-preview reply-unavailable">Mensagem original indisponível</span>
                    {:else}
                      <span class="reply-author">@{msg.reply_to?.user?.display_name || msg.reply_to?.user?.username || 'Membro'}:</span>
                      <span class="reply-content-preview">{msg.reply_to?.content ? (msg.reply_to.content.slice(0, 75) + (msg.reply_to.content.length > 75 ? '...' : '')) : 'Mensagem original indisponível'}</span>
                    {/if}
                  </button>
                {/if}

              <div
                class="message-card-inner"
                ontouchstart={() => startLongPress(msg)}
                ontouchend={cancelLongPress}
                ontouchmove={cancelLongPress}
              >
                <div class="message-avatar-col">
                  <UserAvatar
                    displayName={msg.user?.display_name || msg.user?.username || 'Membro'}
                    avatarId={msg.user?.avatar_id}
                    size={36}
                  />
                </div>

                <div class="message-body-col">
                  <div class="message-meta-row">
                    <span class="author-name">{msg.user?.display_name || msg.user?.username || 'Membro'}</span>
                    <span class="msg-timestamp">{new Date(msg.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
                    {#if msg.is_edited}
                      <span class="edited-tag" title="Editada">(editado)</span>
                    {/if}
                    {#if msg.pinned}
                      <span class="pin-tag" title="Mensagem Fixada">
                        <Pin size={11} />
                        <span>Fixada</span>
                      </span>
                    {/if}
                  </div>

                  {#if editingMessageId === msg.id}
                    <div class="inline-msg-editor">
                      <textarea
                        bind:value={editingContent}
                        class="edit-msg-textarea"
                        rows={2}
                      ></textarea>
                      <div class="edit-actions-row">
                        <span class="edit-hint">Enter para salvar • Cancelar para sair</span>
                        <div class="edit-btns">
                          <button
                            type="button"
                            class="btn-edit-cancel"
                            onclick={() => (editingMessageId = null)}
                          >
                            Cancelar
                          </button>
                          <button
                            type="button"
                            class="btn-edit-save"
                            onclick={() => saveEditedMessage(msg.id)}
                          >
                            Salvar
                          </button>
                        </div>
                      </div>
                    </div>
                  {:else}
                    <div class="message-content-text">
                      {@html formatMessageText(msg.content)}
                    </div>
                  {/if}

                  <!-- Grouped reactions strip -->
                  {#if grouped.length > 0}
                    <div class="grouped-reactions-strip">
                      {#each grouped as g}
                        <button
                          type="button"
                          class="reaction-pill"
                          class:reacted-by-me={g.reactedByMe}
                          title="{g.reactedByMe ? 'Você reagiu' : 'Reagir'} com {g.emoji}"
                          onclick={() => toggleReaction(msg.id, g.emoji)}
                        >
                          <span class="rx-emoji">{g.emoji}</span>
                          <span class="rx-count">{g.count}</span>
                        </button>
                      {/each}
                      <button
                        type="button"
                        class="btn-add-reaction-pill"
                        title="Adicionar reação"
                        onclick={() => (activeEmojiPickerMsgId = activeEmojiPickerMsgId === msg.id ? null : msg.id)}
                      >
                        <Smile size={12} />
                        <span>+</span>
                      </button>
                    </div>
                  {/if}
                </div>

                <!-- Floating Hover Action Bar -->
                <div class="message-hover-action-bar">
                  <button
                    type="button"
                    class="hover-action-btn"
                    title="Reagir"
                    onclick={() => (activeEmojiPickerMsgId = activeEmojiPickerMsgId === msg.id ? null : msg.id)}
                  >
                    <Smile size={14} />
                  </button>

                  <button
                    type="button"
                    class="hover-action-btn"
                    title="Responder"
                    onclick={() => {
                      replyingTo = msg;
                      if (textareaEl) textareaEl.focus();
                    }}
                  >
                    <CornerDownRight size={14} />
                  </button>

                  <button
                    type="button"
                    class="hover-action-btn"
                    title="Responder em Thread separada"
                    onclick={() => (activeThreadMessage = msg)}
                  >
                    <MessageSquare size={14} />
                  </button>

                  {#if isOwnerOrAdmin}
                    <form method="POST" action="?/togglePinMessage" use:enhance class="inline-form">
                      <input type="hidden" name="messageId" value={msg.id} />
                      <input type="hidden" name="pinned" value={String(!msg.pinned)} />
                      <button
                        type="submit"
                        class="hover-action-btn"
                        class:is-pinned={msg.pinned}
                        title={msg.pinned ? 'Desafixar mensagem' : 'Fixar mensagem'}
                      >
                        <Pin size={14} />
                      </button>
                    </form>
                  {/if}

                  <div class="hover-menu-container">
                    <button
                      type="button"
                      class="hover-action-btn"
                      title="Mais opções"
                      onclick={() => (activeMenuMsgId = activeMenuMsgId === msg.id ? null : msg.id)}
                    >
                      <MoreVertical size={14} />
                    </button>

                    {#if activeMenuMsgId === msg.id}
                      <div class="hover-dropdown-menu">
                        {#if msg.user_id === currentUserId}
                          <button
                            type="button"
                            class="dropdown-item"
                            onclick={() => {
                              editingMessageId = msg.id;
                              editingContent = msg.content;
                              activeMenuMsgId = null;
                            }}
                          >
                            <Edit2 size={13} />
                            <span>Editar mensagem</span>
                          </button>
                        {/if}
                        {#if msg.user_id === currentUserId || isOwnerOrAdmin}
                          <button
                            type="button"
                            class="dropdown-item danger"
                            onclick={() => openDeleteModal(msg)}
                          >
                            <Trash2 size={13} />
                            <span>Excluir mensagem</span>
                          </button>
                        {/if}
                        <button
                          type="button"
                          class="dropdown-item"
                          onclick={() => {
                            navigator.clipboard.writeText(msg.content);
                            activeMenuMsgId = null;
                          }}
                        >
                          <Copy size={13} />
                          <span>Copiar texto</span>
                        </button>
                      </div>
                    {/if}
                  </div>
                </div>

                <!-- Emoji Picker Popover -->
                {#if activeEmojiPickerMsgId === msg.id}
                  <div class="emoji-picker-popover">
                    <div class="emoji-picker-grid">
                      {#each ['👍', '❤️', '🎉', '😂', '🔥', '🚀', '👀', '✨', '👏', '🙏', '💯', '🤔'] as em}
                        <button
                          type="button"
                          class="emoji-picker-btn"
                          onclick={() => toggleReaction(msg.id, em)}
                        >
                          {em}
                        </button>
                      {/each}
                    </div>
                  </div>
                {/if}
              </div>
            </div>
            {/if}
          {/each}
        </div>
      {/if}
    </div>

    <!-- Message Composer Bar -->
    <div class="composer-container">
      {#if activeChannel?.type === 'ANNOUNCEMENT' && !isOwnerOrAdmin}
        <div class="announcement-readonly-banner">
          <Megaphone size={14} />
          <span>Apenas Administradores e Donos da Scan podem postar neste canal de avisos.</span>
        </div>
      {:else}
        {#if typingText}
          <div class="chat-typing-bar">
            <div class="typing-dots">
              <span></span><span></span><span></span>
            </div>
            <span class="typing-name">{typingText}</span>
          </div>
        {/if}

        {#if replyingTo}
          <div class="composer-reply-banner">
            <div class="reply-banner-left">
              <CornerDownRight size={13} class="text-indigo-400" />
              <span class="replying-to-text">Respondendo a <strong>@{replyingTo.user?.display_name || replyingTo.user?.username || 'Membro'}</strong>:</span>
              <span class="replying-preview">"{replyingTo.content.slice(0, 50)}..."</span>
            </div>
            <button type="button" class="btn-cancel-reply" onclick={() => (replyingTo = null)} title="Cancelar resposta">
              <X size={14} />
            </button>
          </div>
        {/if}

        <!-- Autocomplete Dropdown Popup -->
        {#if showMentionMenu && mentionCandidates.length > 0}
          <div class="mention-autocomplete-menu" role="listbox">
            <div class="mention-menu-header">Mencionar na Scan:</div>
            {#each mentionCandidates as cand, idx}
              <button
                type="button"
                class="mention-candidate-item"
                class:selected={idx === mentionIndex}
                onclick={() => selectMention(cand)}
              >
                {#if cand.type === 'user'}
                  <UserAvatar
                    avatarId={cand.avatar_id}
                    displayName={cand.display_name || cand.label.replace(/^@/, '')}
                    size={28}
                  />
                {:else}
                  <span class="mention-type-dot">{cand.type === 'all' ? '★' : '#'}</span>
                {/if}
                <span class="cand-info">
                  <span class="cand-label">{cand.label}</span>
                  <span class="cand-sub">{cand.sub}</span>
                </span>
              </button>
            {/each}
          </div>
        {/if}

        <form
          method="POST"
          action="?/postMessage&id={currentScanId}&tab=chat"
          use:enhance={() => {
            isSubmitting = true;
            return async ({ result }) => {
              isSubmitting = false;
              if (result.type === 'success') {
                messageInput = '';
                replyingTo = null;
                trackedMentions = [];
              }
              await invalidateAll();
            };
          }}
          class="composer-form"
        >
          <input type="hidden" name="channelId" value={activeChannelId} />
          <input type="hidden" name="replyToId" value={replyingTo?.id || ''} />
          <input type="hidden" name="mentionsData" value={JSON.stringify(validMentions)} />
          <div class="composer-container-card">
            <textarea
              bind:this={textareaEl}
              name="content"
              class="composer-textarea"
              placeholder="Conversar em #{activeChannel?.name || 'geral'}... (Shift+Enter para nova linha, @ para mencionar)"
              bind:value={messageInput}
              onkeydown={handleInputKeyDown}
              oninput={(e) => handleInputChange((e.target as HTMLTextAreaElement).value)}
              disabled={isSubmitting}
              rows={2}
            ></textarea>

            <div class="composer-toolbar-bottom">
              <div class="composer-tools-left">
                <label class="btn-composer-tool" class:disabled={isUploadingChatFile} title="Anexar arquivo">
                  <Paperclip size={14} />
                  <span class="tool-label">{isUploadingChatFile ? 'Enviando...' : 'Anexar'}</span>
                  <input
                    type="file"
                    class="hidden-file-input"
                    onchange={handleChatFileUpload}
                    disabled={isUploadingChatFile}
                  />
                </label>

                <button
                  type="button"
                  class="btn-composer-tool"
                  title="Mencionar membro ou cargo (@)"
                  onclick={() => {
                    messageInput += (messageInput.endsWith(' ') || messageInput === '' ? '' : ' ') + '@';
                    showMentionMenu = true;
                    mentionQuery = '';
                    mentionIndex = 0;
                    if (textareaEl) textareaEl.focus();
                  }}
                >
                  <AtSign size={14} />
                  <span class="tool-label">Mencionar</span>
                </button>
              </div>

              <div class="composer-tools-right">
                <span class="shortcut-tip">Enter envia • Shift+Enter nova linha</span>
                <button
                  type="submit"
                  class="btn-composer-send-rich"
                  disabled={!messageInput.trim() || isSubmitting}
                  title="Enviar mensagem (Enter)"
                >
                  <Send size={14} />
                  <span>Enviar</span>
                </button>
              </div>
            </div>
          </div>
        </form>
      {/if}
    </div>
  </main>

  <!-- Mobile long-press context menu -->
  {#if mobileLongPressMsg}
    <div class="mobile-msg-menu-backdrop" onclick={closeMobileMsgMenu}>
      <div class="mobile-msg-menu" onclick={(e) => e.stopPropagation()}>
        <div class="mobile-msg-menu-header">
          <span class="mobile-menu-author">{mobileLongPressMsg.user?.display_name || mobileLongPressMsg.user?.username || 'Membro'}</span>
          <span class="mobile-menu-preview">{mobileLongPressMsg.content?.slice(0, 60)}{mobileLongPressMsg.content?.length > 60 ? '...' : ''}</span>
        </div>
        <button type="button" class="mobile-menu-item" onclick={() => { replyingTo = mobileLongPressMsg; closeMobileMsgMenu(); if (textareaEl) textareaEl.focus(); }}>
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 17 4 12 9 7"/><path d="M20 18v-2a4 4 0 0 0-4-4H4"/></svg>
          <span>Responder</span>
        </button>
        <button type="button" class="mobile-menu-item" onclick={() => { activeEmojiPickerMsgId = mobileLongPressMsg.id; closeMobileMsgMenu(); }}>
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg>
          <span>Reagir</span>
        </button>
        {#if mobileLongPressMsg.user_id === currentUserId}
          <button type="button" class="mobile-menu-item" onclick={() => { editingMessageId = mobileLongPressMsg.id; editingContent = mobileLongPressMsg.content; closeMobileMsgMenu(); }}>
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            <span>Editar</span>
          </button>
        {/if}
        <button type="button" class="mobile-menu-item" onclick={() => { navigator.clipboard.writeText(mobileLongPressMsg.content); closeMobileMsgMenu(); }}>
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
          <span>Copiar texto</span>
        </button>
        {#if mobileLongPressMsg.user_id === currentUserId || isOwnerOrAdmin}
          <button type="button" class="mobile-menu-item danger" onclick={() => { openDeleteModal(mobileLongPressMsg); }}>
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
            <span>Excluir</span>
          </button>
        {/if}
      </div>
    </div>
  {/if}

  <!-- Delete Confirmation Modal (Requirement 17: Excluir esta mensagem?) -->
  {#if messageToDelete}
    <div class="delete-modal-backdrop" onclick={() => (messageToDelete = null)}>
      <div class="delete-modal-card" onclick={(e) => e.stopPropagation()}>
        <div class="delete-modal-header">
          <div class="delete-modal-title-row">
            <Trash2 size={18} class="delete-modal-icon" />
            <h3 class="delete-modal-title">Excluir esta mensagem?</h3>
          </div>
          <button type="button" class="btn-close-modal" onclick={() => (messageToDelete = null)}>
            <X size={16} />
          </button>
        </div>
        <div class="delete-modal-body">
          <p class="delete-modal-desc">
            Tem certeza de que deseja excluir esta mensagem? Ela não estará mais visível para os membros.
          </p>
          {#if messageToDelete.content}
            <div class="delete-modal-preview">
              "{messageToDelete.content.slice(0, 100)}{messageToDelete.content.length > 100 ? '...' : ''}"
            </div>
          {/if}
        </div>
        <div class="delete-modal-footer">
          <button
            type="button"
            class="btn-modal-cancel"
            onclick={() => (messageToDelete = null)}
            disabled={isDeletingMessage}
          >
            Cancelar
          </button>
          <button
            type="button"
            class="btn-modal-delete"
            onclick={confirmDeleteMessage}
            disabled={isDeletingMessage}
          >
            {isDeletingMessage ? 'Excluindo...' : 'Excluir mensagem'}
          </button>
        </div>
      </div>
    </div>
  {/if}

  <!-- Right Drawer: Thread View (if active) -->
  {#if activeThreadMessage}
    <aside class="chat-thread-drawer">
      <div class="thread-header">
        <div class="thread-header-title">
          <CornerDownRight size={16} />
          <h3>Thread da Mensagem</h3>
        </div>
        <button
          type="button"
          class="btn-icon-xs"
          title="Fechar Thread"
          onclick={() => (activeThreadMessage = null)}
        >
          <X size={16} />
        </button>
      </div>

      <div class="thread-parent-card">
        <UserAvatar
          displayName={activeThreadMessage.user?.display_name || 'Membro'}
          avatarId={activeThreadMessage.user?.avatar_id}
          size={30}
        />
        <div class="thread-parent-body">
          <span class="thread-author">{activeThreadMessage.user?.display_name || 'Membro'}</span>
          <p class="thread-parent-text">{activeThreadMessage.content}</p>
        </div>
      </div>

      <div class="thread-replies-viewport">
        <p class="thread-empty-sub">Responda diretamente a este tópico para manter a organização da equipe.</p>
      </div>

      <form
        method="POST"
        action="?/postThreadReply"
        use:enhance={() => {
          isSendingThread = true;
          return async ({ update }) => {
            threadReplyInput = '';
            isSendingThread = false;
            await update();
          };
        }}
        class="thread-composer-form"
      >
        <input type="hidden" name="parentMessageId" value={activeThreadMessage.id} />
        <input
          type="text"
          name="content"
          class="form-input-sm"
          placeholder="Responder nesta thread..."
          bind:value={threadReplyInput}
        />
        <button type="submit" class="btn-primary-xs" disabled={!threadReplyInput.trim() || isSendingThread}>
          Responder
        </button>
      </form>
    </aside>
  {/if}
</div>

<!-- Modal: Criar Novo Canal -->
{#if showCreateChannelModal}
  <div class="modal-backdrop" onclick={() => (showCreateChannelModal = false)}>
    <div class="modal-card-sm" onclick={(e) => e.stopPropagation()}>
      <div class="modal-header">
        <h3 class="modal-title">Novo Canal de Equipe</h3>
        <button type="button" class="btn-icon-xs" onclick={() => (showCreateChannelModal = false)}>
          <X size={16} />
        </button>
      </div>

      <form
        method="POST"
        action="?/createChannel"
        use:enhance={() => {
          return async ({ update }) => {
            showCreateChannelModal = false;
            await update();
          };
        }}
        class="modal-body-form"
      >
        <div class="form-group">
          <label for="ch-name" class="form-label">Nome do Canal</label>
          <input
            id="ch-name"
            type="text"
            name="name"
            required
            class="form-input"
            placeholder="ex: revisao-urgente"
            bind:value={newChannelName}
          />
        </div>

        <div class="form-group">
          <label for="ch-type" class="form-label">Tipo de Canal</label>
          <select id="ch-type" name="type" class="form-select" bind:value={newChannelType}>
            <option value="CHAT">Chat de Equipe (Todos podem conversar)</option>
            <option value="ANNOUNCEMENT">Canal de Avisos (Apenas Líderes postam)</option>
          </select>
        </div>

        <div class="form-group">
          <label for="ch-cat" class="form-label">Categoria</label>
          <select id="ch-cat" name="category" class="form-select" bind:value={newChannelCategory}>
            <option value="GERAL">GERAL</option>
            <option value="PRODUÇÃO">PRODUÇÃO</option>
            <option value="EDITORIAL">EDITORIAL</option>
            <option value="RECRUTAMENTO">RECRUTAMENTO</option>
          </select>
        </div>

        <div class="form-group">
          <label for="ch-desc" class="form-label">Descrição (Opcional)</label>
          <input
            id="ch-desc"
            type="text"
            name="description"
            class="form-input"
            placeholder="Objetivo deste canal..."
            bind:value={newChannelDesc}
          />
        </div>

        <div class="modal-footer-actions">
          <button type="button" class="btn-secondary" onclick={() => (showCreateChannelModal = false)}>
            Cancelar
          </button>
          <button type="submit" class="btn-primary" disabled={!newChannelName.trim()}>
            Criar Canal
          </button>
        </div>
      </form>
    </div>
  </div>
{/if}

<style>
  .chat-module-root {
    display: flex;
    height: 720px;
    max-height: 80vh;
    background: #09090b;
    border: 1px solid #27272a;
    border-radius: 12px;
    overflow: hidden;
    position: relative;
  }

  /* Left Channels Sidebar */
  .chat-channels-sidebar {
    width: 240px;
    background: #111115;
    border-right: 1px solid #27272a;
    display: flex;
    flex-direction: column;
    flex-shrink: 0;
  }

  .channels-sidebar-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 1rem;
    border-bottom: 1px solid #1f1f23;
  }

  .channels-header-title {
    font-size: 0.75rem;
    font-weight: 700;
    letter-spacing: 0.05em;
    color: #a1a1aa;
  }

  .channels-list-scroll {
    flex: 1;
    overflow-y: auto;
    padding: 0.75rem 0.5rem;
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .category-block {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .category-name {
    font-size: 0.6875rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: #71717a;
    padding: 0 0.5rem 0.25rem;
  }

  .category-channels {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .channel-nav-item-wrapper {
    display: flex;
    align-items: center;
    border-radius: 6px;
    transition: background 0.15s ease, border 0.15s ease;
    position: relative;
  }

  .channel-nav-item-wrapper.drag-over {
    border-top: 2px solid #6366f1;
    background: rgba(99, 102, 241, 0.15);
  }

  .channel-nav-item-wrapper.is-dragged {
    opacity: 0.35;
  }

  .drag-handle {
    display: flex;
    align-items: center;
    color: #52525b;
    cursor: grab;
    padding: 0 4px;
  }

  .drag-handle:hover {
    color: #a1a1aa;
  }

  .channel-nav-item {
    flex: 1;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.4rem 0.5rem;
    border-radius: 6px;
    border: none;
    background: transparent;
    color: #a1a1aa;
    font-size: 0.8125rem;
    text-align: left;
    cursor: pointer;
    min-width: 0;
  }

  .channel-nav-item:hover {
    background: #18181b;
    color: #e4e4e7;
  }

  .channel-nav-item.active {
    background: #27272a;
    color: #ffffff;
    font-weight: 600;
  }

  .channel-icon {
    color: #71717a;
    flex-shrink: 0;
  }

  .channel-nav-item.active .channel-icon {
    color: #818cf8;
  }

  .icon-announcement {
    color: #f59e0b !important;
  }

  .channel-label {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .channel-order-controls {
    display: flex;
    gap: 1px;
    padding-right: 4px;
    opacity: 0.4;
  }

  .channel-nav-item-wrapper:hover .channel-order-controls {
    opacity: 1;
  }

  .btn-order-arrow {
    background: transparent;
    border: none;
    color: #71717a;
    font-size: 9px;
    cursor: pointer;
    padding: 2px;
  }

  .btn-order-arrow:hover:not(:disabled) {
    color: #f4f4f5;
  }

  .btn-order-arrow:disabled {
    opacity: 0.2;
    cursor: default;
  }

  /* Central Main Area */
  .chat-main-area {
    flex: 1;
    display: flex;
    flex-direction: column;
    background: #09090b;
    min-width: 0;
    position: relative;
    height: 100%;
    min-height: 0;
    overflow: hidden;
  }

  .channel-header-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.875rem 1.25rem;
    border-bottom: 1px solid #27272a;
    background: #0c0c0e;
  }

  .channel-title-row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .title-icon {
    color: #818cf8;
  }

  .channel-heading {
    font-size: 1rem;
    font-weight: 700;
    color: #f4f4f5;
  }

  .channel-subdesc {
    font-size: 0.75rem;
    color: #71717a;
    margin-top: 2px;
  }

  .btn-control-pill {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    padding: 0.35rem 0.65rem;
    border-radius: 9999px;
    border: 1px solid #27272a;
    background: #18181b;
    color: #a1a1aa;
    font-size: 0.75rem;
    cursor: pointer;
  }

  .btn-control-pill.active {
    background: #4f46e5;
    border-color: #6366f1;
    color: #ffffff;
  }

  /* Messages Viewport */
  .messages-feed-viewport {
    flex: 1 1 auto;
    min-height: 0;
    overflow-y: auto;
    padding: 1rem 1.25rem;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .empty-feed {
    margin: auto;
    text-align: center;
    padding: 2rem;
  }

  .empty-feed-icon {
    color: #3f3f46;
    margin-bottom: 0.75rem;
  }

  .empty-feed-title {
    font-size: 0.9375rem;
    font-weight: 600;
    color: #e4e4e7;
  }

  .empty-feed-sub {
    font-size: 0.8125rem;
    color: #71717a;
    margin-top: 0.25rem;
  }

  /* Unread Divider */
  .unread-divider-line {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    margin: 0.75rem 0 0.25rem;
  }

  .divider-rule {
    flex: 1;
    height: 1px;
    background: #ef4444;
  }

  .divider-pill {
    font-size: 0.6875rem;
    font-weight: 700;
    text-transform: uppercase;
    color: #ef4444;
    letter-spacing: 0.05em;
    background: rgba(239, 68, 68, 0.12);
    padding: 2px 10px;
    border-radius: 9999px;
    border: 1px solid rgba(239, 68, 68, 0.35);
  }

  /* Message Card */
  .message-card {
    position: relative;
    display: flex;
    flex-direction: column;
    padding: 0.35rem 0.65rem;
    border-radius: 8px;
    transition: background 0.15s ease;
    user-select: text;
    -webkit-user-select: text;
  }

  .message-card:hover {
    background: #111115;
  }

  .message-card.pinned {
    background: rgba(99, 102, 241, 0.08);
    border-left: 3px solid #6366f1;
  }

  @keyframes highlightPulse {
    0% { background: rgba(99, 102, 241, 0.4); }
    70% { background: rgba(99, 102, 241, 0.18); }
    100% { background: transparent; }
  }

  .message-card.highlight-pulse {
    animation: highlightPulse 2.2s ease-out;
  }

  /* Quoted Reply Row */
  .reply-quote-row {
    display: flex;
    align-items: center;
    gap: 0.45rem;
    margin-left: 32px;
    margin-bottom: 3px;
    padding: 2px 6px;
    border: none;
    background: transparent;
    cursor: pointer;
    border-radius: 4px;
    color: #94a3b8;
    font-size: 0.75rem;
    text-align: left;
    max-width: 85%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .reply-quote-row:hover {
    color: #f1f5f9;
    background: rgba(255, 255, 255, 0.04);
  }

  .reply-curve {
    color: #6366f1;
    flex-shrink: 0;
  }

  .reply-author {
    font-weight: 600;
    color: #818cf8;
    flex-shrink: 0;
  }

  .reply-content-preview {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    color: #64748b;
  }

  .message-card-inner {
    display: flex;
    gap: 0.875rem;
    width: 100%;
    position: relative;
  }

  .message-avatar-col {
    flex-shrink: 0;
  }

  .message-body-col {
    flex: 1;
    min-width: 0;
  }

  .message-meta-row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-bottom: 0.2rem;
  }

  .author-name {
    font-size: 0.875rem;
    font-weight: 600;
    color: #f4f4f5;
  }

  .msg-timestamp {
    font-size: 0.6875rem;
    color: #71717a;
  }

  .edited-tag {
    font-size: 0.6875rem;
    color: #71717a;
    font-style: italic;
  }

  .pin-tag {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    font-size: 0.6875rem;
    color: #818cf8;
    background: rgba(99, 102, 241, 0.15);
    padding: 1px 6px;
    border-radius: 4px;
  }

  .message-content-text {
    font-size: 0.875rem;
    line-height: 1.45;
    color: #d4d4d8;
    word-break: break-word;
    user-select: text;
    -webkit-user-select: text;
    cursor: text;
  }

  /* Inline Message Editor */
  .inline-msg-editor {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    background: #18181b;
    border: 1px solid #3b82f6;
    border-radius: 6px;
    padding: 0.5rem;
    margin-top: 0.25rem;
  }

  .edit-msg-textarea {
    width: 100%;
    background: transparent;
    border: none;
    outline: none;
    color: #f4f4f5;
    font-size: 0.875rem;
    resize: vertical;
  }

  .edit-actions-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .edit-hint {
    font-size: 0.6875rem;
    color: #71717a;
  }

  .edit-btns {
    display: flex;
    gap: 0.5rem;
  }

  .btn-edit-cancel {
    padding: 0.25rem 0.65rem;
    background: transparent;
    border: 1px solid #3f3f46;
    border-radius: 4px;
    color: #a1a1aa;
    font-size: 0.75rem;
    cursor: pointer;
  }

  .btn-edit-save {
    padding: 0.25rem 0.65rem;
    background: #4f46e5;
    border: none;
    border-radius: 4px;
    color: #ffffff;
    font-size: 0.75rem;
    font-weight: 600;
    cursor: pointer;
  }

  /* Grouped Reactions Strip */
  .grouped-reactions-strip {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.35rem;
    margin-top: 0.35rem;
  }

  .reaction-pill {
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
    padding: 2px 8px;
    background: #18181b;
    border: 1px solid #27272a;
    border-radius: 9999px;
    font-size: 0.75rem;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .reaction-pill:hover {
    border-color: #3f3f46;
    background: #27272a;
  }

  .reaction-pill.reacted-by-me {
    background: rgba(99, 102, 241, 0.15);
    border-color: #6366f1;
  }

  .rx-emoji {
    line-height: 1;
  }

  .rx-count {
    font-size: 0.7rem;
    font-weight: 600;
    color: #a1a1aa;
  }

  .reaction-pill.reacted-by-me .rx-count {
    color: #818cf8;
  }

  .btn-add-reaction-pill {
    display: inline-flex;
    align-items: center;
    gap: 2px;
    padding: 2px 6px;
    background: transparent;
    border: 1px dashed #3f3f46;
    border-radius: 9999px;
    color: #71717a;
    font-size: 0.75rem;
    cursor: pointer;
  }

  .btn-add-reaction-pill:hover {
    border-color: #a1a1aa;
    color: #f4f4f5;
  }

  /* Floating Hover Action Bar */
  .message-hover-action-bar {
    position: absolute;
    top: -12px;
    right: 8px;
    display: none;
    align-items: center;
    background: #18181b;
    border: 1px solid #27272a;
    border-radius: 6px;
    padding: 2px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
    z-index: 10;
  }

  .message-card:hover .message-hover-action-bar,
  .message-card:focus-within .message-hover-action-bar {
    display: flex;
  }

  .hover-action-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    border-radius: 4px;
    border: none;
    background: transparent;
    color: #a1a1aa;
    cursor: pointer;
  }

  .hover-action-btn:hover {
    background: #27272a;
    color: #f4f4f5;
  }

  .hover-action-btn.is-pinned {
    color: #818cf8;
  }

  /* More menu dropdown */
  .hover-menu-container {
    position: relative;
  }

  .hover-dropdown-menu {
    position: absolute;
    top: 32px;
    right: 0;
    width: 170px;
    background: #18181b;
    border: 1px solid #27272a;
    border-radius: 6px;
    padding: 4px;
    box-shadow: 0 6px 16px rgba(0, 0, 0, 0.5);
    z-index: 30;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .dropdown-item {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.45rem 0.65rem;
    background: transparent;
    border: none;
    border-radius: 4px;
    color: #d4d4d8;
    font-size: 0.75rem;
    text-align: left;
    cursor: pointer;
    width: 100%;
  }

  .dropdown-item:hover {
    background: #27272a;
    color: #ffffff;
  }

  .dropdown-item.danger {
    color: #f87171;
  }

  .dropdown-item.danger:hover {
    background: rgba(239, 68, 68, 0.15);
    color: #fca5a5;
  }

  /* Emoji Picker Popover */
  .emoji-picker-popover {
    position: absolute;
    top: 24px;
    right: 8px;
    background: #18181b;
    border: 1px solid #27272a;
    border-radius: 8px;
    padding: 6px;
    box-shadow: 0 6px 18px rgba(0, 0, 0, 0.5);
    z-index: 25;
  }

  .emoji-picker-grid {
    display: grid;
    grid-template-columns: repeat(6, 1fr);
    gap: 4px;
  }

  .emoji-picker-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    border: none;
    background: transparent;
    border-radius: 4px;
    font-size: 1.1rem;
    cursor: pointer;
    transition: transform 0.1s ease;
  }

  .emoji-picker-btn:hover {
    background: #27272a;
    transform: scale(1.15);
  }

  /* Composer Area */
  .composer-container {
    padding: 0.75rem 1.25rem 1rem;
    background: #0c0c0e;
    border-top: 1px solid #1f1f23;
    position: relative;
  }

  /* Typing Indicator */
  .chat-typing-bar {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.2rem 0.5rem 0.4rem;
    font-size: 0.75rem;
    color: #a1a1aa;
    font-style: italic;
  }

  .typing-dots {
    display: flex;
    gap: 3px;
  }

  .typing-dots span {
    width: 4px;
    height: 4px;
    background: #818cf8;
    border-radius: 50%;
    animation: typingBounce 1.2s infinite ease-in-out;
  }

  .typing-dots span:nth-child(2) { animation-delay: 0.2s; }
  .typing-dots span:nth-child(3) { animation-delay: 0.4s; }

  @keyframes typingBounce {
    0%, 60%, 100% { transform: translateY(0); }
    30% { transform: translateY(-4px); }
  }

  /* Reply Banner */
  .composer-reply-banner {
    display: flex;
    align-items: center;
    justify-content: space-between;
    background: #18181b;
    border: 1px solid #27272a;
    border-bottom: none;
    border-radius: 8px 8px 0 0;
    padding: 0.4rem 0.75rem;
    font-size: 0.75rem;
  }

  .reply-banner-left {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .replying-to-text {
    color: #818cf8;
  }

  .replying-preview {
    color: #71717a;
    font-style: italic;
  }

  .btn-cancel-reply {
    background: transparent;
    border: none;
    color: #71717a;
    cursor: pointer;
  }

  .btn-cancel-reply:hover {
    color: #f4f4f5;
  }

  .composer-container-card {
    background: #141417;
    border: 1px solid #27272a;
    border-radius: 8px;
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }

  .composer-textarea {
    width: 100%;
    background: transparent;
    border: none;
    padding: 0.75rem;
    color: #f4f4f5;
    font-size: 0.875rem;
    resize: none;
    outline: none;
    font-family: inherit;
  }

  .composer-toolbar-bottom {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.4rem 0.75rem;
    border-top: 1px solid #1f1f23;
  }

  .composer-tools-left,
  .composer-tools-right {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .btn-composer-tool {
    display: flex;
    align-items: center;
    gap: 0.35rem;
    padding: 0.3rem 0.5rem;
    border-radius: 4px;
    border: none;
    background: transparent;
    color: #71717a;
    font-size: 0.75rem;
    cursor: pointer;
  }

  .btn-composer-tool:hover {
    background: #1f1f23;
    color: #e4e4e7;
  }

  .hidden-file-input {
    display: none;
  }

  .shortcut-tip {
    font-size: 0.6875rem;
    color: #52525b;
  }

  .btn-composer-send-rich {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    padding: 0.35rem 0.75rem;
    border-radius: 6px;
    border: none;
    background: #4f46e5;
    color: #ffffff;
    font-size: 0.8125rem;
    font-weight: 600;
    cursor: pointer;
  }

  .btn-composer-send-rich:hover:not(:disabled) {
    background: #4338ca;
  }

  .btn-composer-send-rich:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  /* Mention Tags */
  :global(.mention-tag) {
    color: #818cf8;
    background: rgba(99, 102, 241, 0.15);
    padding: 1px 4px;
    border-radius: 4px;
    font-weight: 500;
  }

  :global(.chat-file-link) {
    color: #38bdf8;
    text-decoration: underline;
  }

  /* Mention Autocomplete */
  .mention-autocomplete-menu {
    position: absolute;
    bottom: calc(100% + 4px);
    left: 1.25rem;
    width: 280px;
    background: #141417;
    border: 1px solid #27272a;
    border-radius: 8px;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.5);
    z-index: 40;
    overflow: hidden;
  }

  .mention-menu-header {
    font-size: 0.6875rem;
    font-weight: 700;
    text-transform: uppercase;
    color: #71717a;
    padding: 0.5rem 0.75rem 0.25rem;
  }

  .mention-candidate-item {
    display: flex;
    flex-direction: row;
    align-items: center;
    gap: 0.5rem;
    padding: 0.4rem 0.75rem;
    border: none;
    background: transparent;
    width: 100%;
    text-align: left;
    cursor: pointer;
  }

  .mention-candidate-item .cand-info {
    display: flex;
    flex-direction: column;
    min-width: 0;
  }

  .mention-type-dot {
    width: 28px;
    height: 28px;
    border-radius: 50%;
    background: #27272a;
    border: 1px solid #3f3f46;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.8rem;
    flex-shrink: 0;
    color: #818cf8;
    font-weight: 700;
  }

  .mention-candidate-item:hover,
  .mention-candidate-item.selected {
    background: #1f1f23;
  }

  .cand-label {
    font-size: 0.8125rem;
    font-weight: 600;
    color: #f4f4f5;
  }

  .cand-sub {
    font-size: 0.6875rem;
    color: #71717a;
  }

  /* Thread Drawer */
  .chat-thread-drawer {
    width: 320px;
    background: #111115;
    border-left: 1px solid #27272a;
    display: flex;
    flex-direction: column;
    flex-shrink: 0;
  }

  .thread-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 1rem;
    border-bottom: 1px solid #1f1f23;
  }

  .thread-header-title {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.875rem;
    font-weight: 600;
    color: #f4f4f5;
  }

  .thread-parent-card {
    display: flex;
    gap: 0.65rem;
    padding: 0.875rem;
    background: #18181b;
    border-bottom: 1px solid #1f1f23;
  }

  .thread-author {
    font-size: 0.8125rem;
    font-weight: 600;
    color: #e4e4e7;
  }

  .thread-parent-text {
    font-size: 0.8125rem;
    color: #a1a1aa;
    margin-top: 2px;
  }

  .thread-replies-viewport {
    flex: 1;
    overflow-y: auto;
    padding: 1rem;
  }

  .thread-empty-sub {
    font-size: 0.75rem;
    color: #71717a;
    text-align: center;
    padding: 1rem 0;
  }

  .thread-composer-form {
    padding: 0.75rem;
    border-top: 1px solid #1f1f23;
    display: flex;
    gap: 0.5rem;
  }

  .form-input-sm {
    flex: 1;
    background: #18181b;
    border: 1px solid #27272a;
    border-radius: 4px;
    padding: 0.35rem 0.5rem;
    color: #f4f4f5;
    font-size: 0.75rem;
  }

  .btn-primary-xs {
    background: #4f46e5;
    border: none;
    border-radius: 4px;
    color: white;
    font-size: 0.75rem;
    font-weight: 600;
    padding: 0.35rem 0.65rem;
    cursor: pointer;
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
  }

  .modal-card-sm {
    width: 400px;
    background: #141417;
    border: 1px solid #27272a;
    border-radius: 10px;
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

  .form-group {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
  }

  .form-label {
    font-size: 0.75rem;
    font-weight: 600;
    color: #a1a1aa;
  }

  .form-input,
  .form-select {
    background: #18181b;
    border: 1px solid #27272a;
    border-radius: 6px;
    padding: 0.5rem;
    color: #f4f4f5;
    font-size: 0.8125rem;
  }

  .modal-footer-actions {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 0.5rem;
    margin-top: 0.5rem;
  }

  .btn-secondary {
    background: #27272a;
    border: none;
    border-radius: 6px;
    padding: 0.45rem 0.85rem;
    color: #f4f4f5;
    font-size: 0.8125rem;
    cursor: pointer;
  }

  .btn-primary {
    background: #4f46e5;
    border: none;
    border-radius: 6px;
    padding: 0.45rem 0.85rem;
    color: #ffffff;
    font-size: 0.8125rem;
    font-weight: 600;
    cursor: pointer;
  }

  .btn-icon-xs {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    border-radius: 4px;
    border: none;
    background: transparent;
    color: #71717a;
    cursor: pointer;
  }

  .btn-icon-xs:hover {
    color: #f4f4f5;
    background: #27272a;
  }

  .inline-form {
    display: inline-flex;
  }

  /* Mobile long-press context menu */
  .mobile-msg-menu-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.7);
    z-index: 200;
    display: flex;
    align-items: flex-end;
  }

  .mobile-msg-menu {
    width: 100%;
    background: #18181b;
    border-top: 1px solid #27272a;
    border-radius: 16px 16px 0 0;
    padding: 0.5rem 0 1.5rem;
    animation: slideUp 0.2s ease-out;
  }

  @keyframes slideUp {
    from { transform: translateY(100%); }
    to { transform: translateY(0); }
  }

  .mobile-msg-menu-header {
    padding: 0.75rem 1.25rem;
    border-bottom: 1px solid #27272a;
    margin-bottom: 0.5rem;
  }

  .mobile-menu-author {
    display: block;
    font-size: 0.8125rem;
    font-weight: 600;
    color: #f4f4f5;
    margin-bottom: 2px;
  }

  .mobile-menu-preview {
    display: block;
    font-size: 0.75rem;
    color: #71717a;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .mobile-menu-item {
    display: flex;
    align-items: center;
    gap: 0.875rem;
    width: 100%;
    padding: 0.875rem 1.25rem;
    border: none;
    background: transparent;
    color: #e4e4e7;
    font-size: 0.9375rem;
    text-align: left;
    cursor: pointer;
  }

  .mobile-menu-item:active {
    background: #27272a;
  }

  .mobile-menu-item.danger {
    color: #f87171;
  }

  /* Soft-deleted Message Styling */
  .deleted-msg-card {
    padding: 0.4rem 0.75rem;
    opacity: 0.7;
    background: rgba(24, 24, 27, 0.4);
    border-radius: 6px;
    margin: 0.15rem 0;
  }

  .deleted-msg-inner {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    color: #71717a;
    font-size: 0.8125rem;
    font-style: italic;
  }

  .deleted-msg-icon {
    display: flex;
    align-items: center;
    color: #71717a;
  }

  .deleted-msg-time {
    font-size: 0.6875rem;
    color: #52525b;
    margin-left: auto;
    font-style: normal;
  }

  .reply-unavailable {
    font-style: italic;
    color: #71717a !important;
  }

  /* Deep Link Notice Banner */
  .deep-link-notice-banner {
    background: #27272a;
    border: 1px solid #3f3f46;
    color: #f4f4f5;
    font-size: 0.8125rem;
    border-radius: 8px;
    padding: 0.5rem 0.75rem;
    margin: 0.5rem 1rem;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    animation: fadeIn 0.2s ease;
  }

  .btn-dismiss-notice {
    margin-left: auto;
    background: transparent;
    border: none;
    color: #a1a1aa;
    cursor: pointer;
    display: flex;
    align-items: center;
  }

  .btn-dismiss-notice:hover {
    color: #ffffff;
  }

  /* Delete Confirmation Modal (Requirement 17) */
  .delete-modal-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.75);
    z-index: 350;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 1rem;
    backdrop-filter: blur(2px);
    animation: fadeIn 0.15s ease-out;
  }

  .delete-modal-card {
    background: #18181b;
    border: 1px solid #27272a;
    border-radius: 12px;
    width: 100%;
    max-width: 440px;
    padding: 1.25rem;
    box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5), 0 8px 10px -6px rgba(0, 0, 0, 0.5);
  }

  .delete-modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 0.75rem;
  }

  .delete-modal-title-row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .delete-modal-icon {
    color: #ef4444;
  }

  .delete-modal-title {
    font-size: 1rem;
    font-weight: 700;
    color: #f4f4f5;
    margin: 0;
  }

  .btn-close-modal {
    background: transparent;
    border: none;
    color: #71717a;
    cursor: pointer;
    display: flex;
    align-items: center;
    padding: 4px;
    border-radius: 4px;
  }

  .btn-close-modal:hover {
    color: #ffffff;
    background: #27272a;
  }

  .delete-modal-body {
    margin-bottom: 1.25rem;
  }

  .delete-modal-desc {
    font-size: 0.875rem;
    color: #a1a1aa;
    line-height: 1.5;
    margin: 0 0 0.75rem 0;
  }

  .delete-modal-preview {
    font-size: 0.8125rem;
    color: #71717a;
    background: #121214;
    border-left: 2px solid #ef4444;
    padding: 0.5rem 0.75rem;
    border-radius: 4px;
    font-style: italic;
    word-break: break-word;
  }

  .delete-modal-footer {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 0.75rem;
  }

  .btn-modal-cancel {
    padding: 0.5rem 1rem;
    border-radius: 6px;
    border: 1px solid #3f3f46;
    background: #27272a;
    color: #e4e4e7;
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    transition: background 0.15s;
  }

  .btn-modal-cancel:hover {
    background: #3f3f46;
  }

  .btn-modal-delete {
    padding: 0.5rem 1rem;
    border-radius: 6px;
    border: 1px solid #ef4444;
    background: #dc2626;
    color: #ffffff;
    font-size: 0.875rem;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.15s;
  }

  .btn-modal-delete:hover {
    background: #b91c1c;
  }

  .btn-modal-delete:disabled,
  .btn-modal-cancel:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  @media (max-width: 768px) {
    .chat-module-root {
      flex-direction: column;
      height: 100%;
      min-height: 500px;
    }
    .chat-channels-sidebar {
      width: 100%;
      height: auto;
      max-height: 120px;
      border-right: none;
      border-bottom: 1px solid #1f1f23;
      flex-direction: row;
      overflow-x: auto;
    }
    .channels-sidebar-header {
      display: none;
    }
    .channels-list-scroll {
      flex-direction: row;
      overflow-x: auto;
      padding: 0.5rem;
    }
    .category-block {
      display: flex;
      flex-direction: row;
      align-items: center;
      flex-shrink: 0;
    }
    .category-name {
      display: none;
    }
    .category-channels {
      display: flex;
      flex-direction: row;
      gap: 0.25rem;
    }
    .channel-nav-item-wrapper {
      flex-shrink: 0;
    }
    .drag-handle {
      display: none;
    }
    .channel-order-controls {
      display: none;
    }
    /* On mobile: hover action bar NEVER shows permanently — use long-press JS instead */
    .message-hover-action-bar {
      display: none !important;
    }
    /* Mobile: message text must be selectable */
    .message-content-text {
      user-select: text;
      -webkit-user-select: text;
    }
    .composer-container {
      padding: 0.5rem;
    }
    .shortcut-tip {
      display: none;
    }
    .chat-thread-drawer {
      display: none;
    }
  }
</style>