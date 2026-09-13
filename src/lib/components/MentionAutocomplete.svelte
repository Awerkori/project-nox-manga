<script lang="ts">
  import { onMount, tick } from 'svelte';
  import UserAvatar from '$lib/components/UserAvatar.svelte';

  let {
    value = $bindable(''),
    textareaEl = null,
    scanId = null,
    position = 'top',
    onselect = () => {},
    ontrackedchange = () => {}
  }: {
    value?: string;
    textareaEl?: HTMLTextAreaElement | null;
    scanId?: string | null;
    position?: 'top' | 'bottom';
    onselect?: (cand: any) => void;
    ontrackedchange?: (tracked: any[]) => void;
  } = $props();

  let showMenu = $state(false);
  let query = $state('');
  let selectedIndex = $state(0);
  let candidates = $state<any[]>([]);
  let isLoading = $state(false);
  let trackedMentions = $state<any[]>([]);

  // In-memory query cache
  const queryCache = new Map<string, any[]>();
  let debounceTimer: any = null;

  export function handleKeyDown(e: KeyboardEvent): boolean {
    if (!showMenu || candidates.length === 0) return false;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      selectedIndex = (selectedIndex + 1) % candidates.length;
      return true;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      selectedIndex = (selectedIndex - 1 + candidates.length) % candidates.length;
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

  export function handleInput(text: string) {
    value = text;
    const cursor = textareaEl?.selectionStart ?? text.length;
    const textBeforeCursor = text.slice(0, cursor);
    const lastAt = textBeforeCursor.lastIndexOf('@');

    if (lastAt !== -1 && (lastAt === 0 || /[\s\n]/.test(textBeforeCursor[lastAt - 1]))) {
      const q = textBeforeCursor.slice(lastAt + 1);
      if (!/[\s\n]/.test(q)) {
        query = q;
        showMenu = true;
        selectedIndex = 0;
        fetchCandidates(q);
        return;
      }
    }
    showMenu = false;
  }

  async function fetchCandidates(q: string) {
    const cleanQ = q.toLowerCase().trim();
    const cacheKey = `${scanId || 'global'}:${cleanQ}`;

    if (queryCache.has(cacheKey)) {
      candidates = queryCache.get(cacheKey) || [];
      return;
    }

    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(async () => {
      isLoading = true;
      try {
        const url = `/api/mentions/search?q=${encodeURIComponent(cleanQ)}${scanId ? `&scan_id=${scanId}` : ''}`;
        const res = await fetch(url);
        if (res.ok) {
          const data = await res.json();
          candidates = data.candidates || [];
          queryCache.set(cacheKey, candidates);
        }
      } catch (err) {
        console.warn('Erro ao buscar menções:', err);
      } finally {
        isLoading = false;
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
      const insertText = cand.label + ' ';
      value = before + insertText + after;

      // Track structured metadata
      const existingIdx = trackedMentions.findIndex(t => t.id === cand.id);
      if (existingIdx === -1) {
        trackedMentions = [...trackedMentions, {
          type: cand.type,
          id: cand.id,
          target_user_id: cand.type === 'user' ? cand.id : null,
          target_role_id: cand.type === 'position' ? cand.id : null,
          label: cand.label,
          username: cand.username || cand.label.replace(/^@/, '')
        }];
      }
      ontrackedchange(trackedMentions);
      onselect(cand);

      tick().then(() => {
        if (textareaEl) {
          const newPos = lastAt + insertText.length;
          textareaEl.focus();
          textareaEl.setSelectionRange(newPos, newPos);
        }
      });
    }
    showMenu = false;
  }

  export function getTrackedMentions() {
    return trackedMentions;
  }

  export function clearTrackedMentions() {
    trackedMentions = [];
  }
</script>

{#if showMenu && candidates.length > 0}
  <div class="mention-autocomplete-menu" class:position-bottom={position === 'bottom'}>
    <div class="mention-menu-header">
      <span>{scanId ? 'MENCIONAR NA SCAN:' : 'MENCIONAR MEMBRO:'}</span>
    </div>
    <div class="mention-candidates-list" role="listbox">
      {#each candidates as cand, idx}
        <button
          type="button"
          class="mention-candidate-item"
          class:selected={idx === selectedIndex}
          onclick={() => selectCandidate(cand)}
          ontouchstart={() => selectCandidate(cand)}
        >
          {#if cand.type === 'user'}
            <UserAvatar
              avatarId={cand.avatar_id}
              displayName={cand.display_name || cand.username || cand.label}
              size={30}
            />
          {:else}
            <span class="mention-type-dot">
              {cand.type === 'all' ? '★' : '#'}
            </span>
          {/if}
          <div class="cand-info">
            <span class="cand-label">{cand.label}</span>
            <span class="cand-sub">{cand.sub}</span>
          </div>
        </button>
      {/each}
    </div>
  </div>
{/if}

<style>
  .mention-autocomplete-menu {
    position: absolute;
    bottom: calc(100% + 6px);
    left: 0;
    right: 0;
    max-width: 380px;
    background: #18181b;
    border: 1px solid #27272a;
    border-radius: 10px;
    box-shadow: 0 12px 30px rgba(0, 0, 0, 0.6);
    z-index: 100;
    overflow: hidden;
    animation: fadeIn 0.15s ease-out;
  }

  .mention-autocomplete-menu.position-bottom {
    bottom: auto;
    top: calc(100% + 6px);
  }

  @keyframes fadeIn {
    from { opacity: 0; transform: translateY(4px); }
    to { opacity: 1; transform: translateY(0); }
  }

  .mention-menu-header {
    padding: 0.4rem 0.75rem;
    font-size: 0.65rem;
    font-weight: 700;
    letter-spacing: 0.05em;
    color: #71717a;
    border-bottom: 1px solid #27272a;
    background: #141416;
  }

  .mention-candidates-list {
    max-height: 210px;
    overflow-y: auto;
    padding: 0.25rem;
    -webkit-overflow-scrolling: touch;
  }

  .mention-candidate-item {
    display: flex;
    flex-direction: row;
    align-items: center;
    gap: 0.6rem;
    padding: 0.45rem 0.65rem;
    border: none;
    border-radius: 6px;
    background: transparent;
    width: 100%;
    text-align: left;
    cursor: pointer;
    transition: background 0.12s ease;
  }

  .mention-candidate-item:hover,
  .mention-candidate-item.selected {
    background: #27272a;
  }

  .mention-avatar-img {
    width: 28px;
    height: 28px;
    border-radius: 50%;
    object-fit: cover;
    flex-shrink: 0;
    border: 1px solid #3f3f46;
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

  .cand-info {
    display: flex;
    flex-direction: column;
    min-width: 0;
  }

  .cand-label {
    font-size: 0.8125rem;
    font-weight: 600;
    color: #f4f4f5;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .cand-sub {
    font-size: 0.7rem;
    color: #a1a1aa;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  @media (max-width: 480px) {
    .mention-autocomplete-menu {
      max-width: calc(100vw - 2rem);
      left: 0;
      right: 0;
    }
  }
</style>
