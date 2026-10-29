<script lang="ts">
  import { tick } from 'svelte';
  import { SvelteMap } from 'svelte/reactivity';
  import { AtSign, UserX, Loader2, Sparkles } from '@lucide/svelte';
  import UserAvatar from '$lib/components/UserAvatar.svelte';

  let {
    value = $bindable(''),
    textareaEl = null,
    scanId = null,
    position = 'auto',
    onselect = () => {},
    ontrackedchange = () => {}
  }: {
    value?: string;
    textareaEl?: HTMLTextAreaElement | null;
    scanId?: string | null;
    position?: 'top' | 'bottom' | 'auto';
    onselect?: (cand: any) => void;
    ontrackedchange?: (tracked: any[]) => void;
  } = $props();

  let showMenu = $state(false);
  let loading = $state(false);
  let selectedIndex = $state(0);
  let currentQuery = $state('');
  let candidates = $state<any[]>([]);
  let trackedMentions = $state<any[]>([]);
  let computedPosition = $state<'top' | 'bottom'>('top');

  // Query cache & debounce
  const queryCache = new SvelteMap<string, any[]>();
  let debounceTimer: any = null;
  let activeAbortController: AbortController | null = null;

  // Accent-folding helper for highlighting
  function foldAccents(str: string): string {
    return (str || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();
  }

  // Highlight query match in text
  function getHighlightedParts(text: string, query: string): Array<{ text: string; isMatch: boolean }> {
    if (!text) return [];
    if (!query) return [{ text, isMatch: false }];

    const foldedText = foldAccents(text);
    const foldedQuery = foldAccents(query);
    const startIdx = foldedText.indexOf(foldedQuery);

    if (startIdx === -1) {
      return [{ text, isMatch: false }];
    }

    const endIdx = startIdx + query.length;
    const parts: Array<{ text: string; isMatch: boolean }> = [];

    if (startIdx > 0) {
      parts.push({ text: text.slice(0, startIdx), isMatch: false });
    }
    parts.push({ text: text.slice(startIdx, endIdx), isMatch: true });
    if (endIdx < text.length) {
      parts.push({ text: text.slice(endIdx), isMatch: false });
    }

    return parts;
  }

  function updateMenuPosition() {
    if (position === 'top' || position === 'bottom') {
      computedPosition = position;
      return;
    }
    if (textareaEl && typeof window !== 'undefined') {
      const rect = textareaEl.getBoundingClientRect();
      // If less than 240px from top of screen, position below
      if (rect.top < 240) {
        computedPosition = 'bottom';
      } else {
        computedPosition = 'top';
      }
    }
  }

  export function handleKeyDown(e: KeyboardEvent): boolean {
    if (!showMenu) return false;

    if (candidates.length === 0) {
      if (e.key === 'Escape') {
        e.preventDefault();
        showMenu = false;
        return true;
      }
      return false;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      selectedIndex = (selectedIndex + 1) % candidates.length;
      scrollActiveIntoView();
      return true;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      selectedIndex = (selectedIndex - 1 + candidates.length) % candidates.length;
      scrollActiveIntoView();
      return true;
    }
    if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault();
      selectCandidate(candidates[selectedIndex]);
      return true;
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      showMenu = false;
      return true;
    }
    return false;
  }

  function scrollActiveIntoView() {
    tick().then(() => {
      const activeEl = document.querySelector('.mention-candidate-item.selected');
      if (activeEl && typeof activeEl.scrollIntoView === 'function') {
        activeEl.scrollIntoView({ block: 'nearest' });
      }
    });
  }

  export function handleInput(text: string) {
    value = text;
    const cursor = textareaEl?.selectionStart ?? text.length;
    const textBeforeCursor = text.slice(0, cursor);

    // Find the last @ in the text before the cursor
    const lastAt = textBeforeCursor.lastIndexOf('@');

    // Trigger condition:
    // 1. @ exists before cursor
    // 2. @ is preceded by start of string, whitespace, newline, or opening bracket/quote
    // 3. Query string between @ and cursor doesn't contain spaces or newlines and is < 30 chars
    if (lastAt !== -1) {
      const prevChar = lastAt > 0 ? textBeforeCursor[lastAt - 1] : '';
      const isValidTrigger = lastAt === 0 || /[\s\n([{"':,;!?]/.test(prevChar);

      if (isValidTrigger) {
        const q = textBeforeCursor.slice(lastAt + 1);
        if (!/[\s\n]/.test(q) && q.length <= 30) {
          currentQuery = q;
          showMenu = true;
          selectedIndex = 0;
          updateMenuPosition();
          fetchCandidates(q);
          return;
        }
      }
    }

    showMenu = false;
    currentQuery = '';
  }

  async function fetchCandidates(q: string) {
    const cleanQ = q.trim();
    const cacheKey = `${scanId || 'global'}:${foldAccents(cleanQ)}`;

    if (queryCache.has(cacheKey)) {
      candidates = queryCache.get(cacheKey) || [];
      loading = false;
      return;
    }

    if (debounceTimer) clearTimeout(debounceTimer);
    if (activeAbortController) activeAbortController.abort();

    loading = true;
    activeAbortController = new AbortController();

    debounceTimer = setTimeout(async () => {
      try {
        const url = `/api/mentions/search?q=${encodeURIComponent(cleanQ)}${scanId ? `&scan_id=${scanId}` : ''}`;
        const res = await fetch(url, { signal: activeAbortController?.signal });
        if (res.ok) {
          const data = await res.json();
          candidates = data.candidates || [];
          queryCache.set(cacheKey, candidates);
        }
      } catch (err: any) {
        if (err.name !== 'AbortError') {
          console.warn('Erro ao buscar menções:', err);
        }
      } finally {
        loading = false;
      }
    }, 120);
  }

  export function selectCandidate(cand: any) {
    if (!cand) return;
    const text = value;
    const cursor = textareaEl?.selectionStart ?? text.length;
    const textBeforeCursor = text.slice(0, cursor);
    const lastAt = textBeforeCursor.lastIndexOf('@');

    if (lastAt !== -1) {
      const before = text.slice(0, lastAt);
      const after = text.slice(cursor);
      const username = cand.username || cand.label.replace(/^@/, '');
      const insertText = `@${username} `;
      value = before + insertText + after;

      // Track structured metadata
      const existingIdx = trackedMentions.findIndex(t => t.id === cand.id);
      if (existingIdx === -1) {
        trackedMentions = [...trackedMentions, {
          type: cand.type,
          id: cand.id,
          target_user_id: cand.type === 'user' ? cand.id : null,
          target_role_id: cand.type === 'position' ? cand.id : null,
          label: `@${username}`,
          username
        }];
      }
      ontrackedchange(trackedMentions);
      onselect(cand);

      tick().then(() => {
        if (textareaEl) {
          const newPos = before.length + insertText.length;
          textareaEl.focus();
          textareaEl.setSelectionRange(newPos, newPos);
        }
      });
    }

    showMenu = false;
    currentQuery = '';
  }

  export function getTrackedMentions() {
    return trackedMentions;
  }

  export function clearTrackedMentions() {
    trackedMentions = [];
  }

  export function closeMenu() {
    showMenu = false;
    currentQuery = '';
  }
</script>

{#if showMenu}
  <div
    class="mention-autocomplete-menu"
    class:position-bottom={computedPosition === 'bottom'}
    class:position-top={computedPosition === 'top'}
    role="region"
    aria-label="Sugestões de menções"
  >
    <div class="mention-menu-header">
      <div class="header-left">
        <AtSign size={12} class="text-purple-400" />
        <span>{scanId ? 'MENCIONAR NA SCAN' : 'MENCIONAR USUÁRIO'}</span>
      </div>
      {#if currentQuery}
        <span class="header-query-tag">@{currentQuery}</span>
      {/if}
      {#if loading}
        <Loader2 size={12} class="spin-icon text-purple-400 ml-auto" />
      {/if}
    </div>

    <div class="mention-candidates-list" role="listbox">
      {#if candidates.length > 0}
        {#each candidates as cand, idx (cand.type + ':' + cand.id)}
          <button
            type="button"
            class="mention-candidate-item"
            class:selected={idx === selectedIndex}
            onpointerdown={(e) => {
              // Previne perda de foco do textarea antes de inserir
              e.preventDefault();
              selectCandidate(cand);
            }}
            onclick={() => selectCandidate(cand)}
            role="option"
            aria-selected={idx === selectedIndex}
          >
            <div class="avatar-wrap">
              {#if cand.type === 'user'}
                <UserAvatar
                  avatarId={cand.avatar_id}
                  crop={cand.avatar_crop}
                  displayName={cand.display_name || cand.username || cand.label}
                  size={32}
                />
              {:else}
                <span class="mention-type-dot">
                  {cand.type === 'all' ? '★' : '#'}
                </span>
              {/if}
            </div>

            <div class="cand-info">
              <div class="cand-display-row">
                <span class="cand-display-name">
                  {#each getHighlightedParts(cand.display_name || cand.username || '', currentQuery) as part}
                    {#if part.isMatch}
                      <mark class="mention-query-highlight">{part.text}</mark>
                    {:else}
                      {part.text}
                    {/if}
                  {/each}
                </span>
              </div>
              <div class="cand-handle-row">
                <span class="cand-username">
                  {#each getHighlightedParts('@' + (cand.username || cand.label.replace(/^@/, '')), currentQuery) as part}
                    {#if part.isMatch}
                      <mark class="mention-query-highlight">{part.text}</mark>
                    {:else}
                      {part.text}
                    {/if}
                  {/each}
                </span>
              </div>
            </div>

            <div class="cand-arrow-hint">
              <Sparkles size={11} class="sparkle-hint" />
            </div>
          </button>
        {/each}
      {:else if !loading && currentQuery}
        <div class="mention-empty-notice">
          <UserX size={14} class="text-zinc-500" />
          <span>Nenhum usuário encontrado para "<strong>@{currentQuery}</strong>"</span>
        </div>
      {/if}
    </div>
  </div>
{/if}

<style>
  .mention-autocomplete-menu {
    position: absolute;
    left: 0;
    right: 0;
    max-width: 360px;
    background: rgba(18, 18, 22, 0.98);
    backdrop-filter: blur(14px);
    -webkit-backdrop-filter: blur(14px);
    border: 1px solid rgba(168, 85, 247, 0.28);
    border-radius: 12px;
    box-shadow: 0 14px 40px rgba(0, 0, 0, 0.75), 0 0 20px rgba(168, 85, 247, 0.12);
    z-index: 200;
    overflow: hidden;
    animation: menuFadeIn 0.15s cubic-bezier(0.16, 1, 0.3, 1);
  }

  .mention-autocomplete-menu.position-top {
    bottom: calc(100% + 8px);
    top: auto;
  }

  .mention-autocomplete-menu.position-bottom {
    top: calc(100% + 8px);
    bottom: auto;
  }

  @keyframes menuFadeIn {
    from {
      opacity: 0;
      transform: translateY(6px) scale(0.98);
    }
    to {
      opacity: 1;
      transform: translateY(0) scale(1);
    }
  }

  .mention-menu-header {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 7px 12px;
    font-size: 10.5px;
    font-weight: 700;
    letter-spacing: 0.06em;
    color: #94a3b8;
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
    background: rgba(12, 12, 15, 0.85);
  }

  .header-left {
    display: inline-flex;
    align-items: center;
    gap: 5px;
  }

  .header-query-tag {
    font-size: 10px;
    font-weight: 600;
    color: #c084fc;
    background: rgba(168, 85, 247, 0.15);
    border: 1px solid rgba(168, 85, 247, 0.25);
    border-radius: 4px;
    padding: 1px 5px;
  }

  .spin-icon {
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  .mention-candidates-list {
    max-height: 220px;
    overflow-y: auto;
    padding: 4px;
    -webkit-overflow-scrolling: touch;
    scrollbar-width: thin;
    scrollbar-color: rgba(168, 85, 247, 0.3) transparent;
  }

  .mention-candidate-item {
    display: flex;
    flex-direction: row;
    align-items: center;
    gap: 10px;
    padding: 7px 10px;
    border: 1px solid transparent;
    border-radius: 8px;
    background: transparent;
    width: 100%;
    min-height: 44px;
    text-align: left;
    cursor: pointer;
    transition: all 0.12s ease;
    user-select: none;
    -webkit-user-select: none;
    touch-action: manipulation;
  }

  .mention-candidate-item:hover,
  .mention-candidate-item.selected {
    background: rgba(168, 85, 247, 0.14);
    border-color: rgba(168, 85, 247, 0.3);
  }

  .avatar-wrap {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .mention-type-dot {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    background: rgba(168, 85, 247, 0.18);
    border: 1px solid rgba(168, 85, 247, 0.35);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 13px;
    color: #c084fc;
    font-weight: 800;
  }

  .cand-info {
    display: flex;
    flex-direction: column;
    gap: 1px;
    min-width: 0;
    flex: 1;
  }

  .cand-display-name {
    font-size: 13px;
    font-weight: 700;
    color: #f8fafc;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    line-height: 1.25;
  }

  .cand-username {
    font-size: 11.5px;
    font-weight: 500;
    color: #94a3b8;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    line-height: 1.25;
  }

  .mention-query-highlight {
    background: rgba(168, 85, 247, 0.28);
    color: #f1f5f9;
    font-weight: 800;
    border-radius: 2px;
    padding: 0 1px;
    box-shadow: 0 0 6px rgba(168, 85, 247, 0.35);
  }

  .cand-arrow-hint {
    margin-left: auto;
    opacity: 0;
    color: #c084fc;
    transition: opacity 0.15s ease;
    flex-shrink: 0;
  }

  .mention-candidate-item:hover .cand-arrow-hint,
  .mention-candidate-item.selected .cand-arrow-hint {
    opacity: 1;
  }

  .mention-empty-notice {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 12px 14px;
    font-size: 12px;
    color: #94a3b8;
    font-weight: 500;
  }

  .mention-empty-notice strong {
    color: #e2e8f0;
    font-weight: 600;
  }

  @media (max-width: 640px) {
    .mention-autocomplete-menu {
      max-width: 100%;
      left: 4px;
      right: 4px;
    }

    .mention-candidate-item {
      min-height: 48px;
      padding: 8px 12px;
    }

    .cand-display-name {
      font-size: 13.5px;
    }

    .cand-username {
      font-size: 12px;
    }
  }
</style>
