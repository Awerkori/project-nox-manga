<script lang="ts">
  import {
    Search,
    BookOpen,
    FileText,
    CheckSquare,
    GraduationCap,
    Users,
    Hash,
    Layers,
    ArrowRight,
    X,
    CornerDownLeft
  } from '@lucide/svelte';

  let {
    isOpen = false,
    works = [],
    chapters = [],
    tasks = [],
    tutorials = [],
    wikiPages = [],
    channels = [],
    team = [],
    onSelect = (type: string, id: string) => {},
    onClose = () => {}
  } = $props();

  let query = $state('');
  let selectedIndex = $state(0);

  let searchResults = $derived(() => {
    if (!query.trim()) {
      return [
        { type: 'action', id: 'tab-inbox', label: 'Abrir Inbox da Scan', icon: CheckSquare, cat: 'Navegao Rpida' },
        { type: 'action', id: 'tab-chat', label: 'Ir para Canais de Chat', icon: Hash, cat: 'Navegao Rpida' },
        { type: 'action', id: 'tab-pipeline', label: 'Ver Pipeline Editorial', icon: Layers, cat: 'Navegao Rpida' },
        { type: 'action', id: 'tab-academia', label: 'Consultar Tutoriais da Academia', icon: GraduationCap, cat: 'Navegao Rpida' }
      ];
    }

    const q = query.toLowerCase();
    const results: Array<{ type: string; id: string; label: string; icon: any; cat: string }> = [];

    // Works
    for (const w of works) {
      if (w.title.toLowerCase().includes(q)) {
        results.push({ type: 'work', id: w.id, label: w.title, icon: BookOpen, cat: 'Obras da Scan' });
      }
    }

    // Chapters
    for (const c of chapters) {
      if (String(c.number).includes(q) || (c.title || '').toLowerCase().includes(q)) {
        results.push({ type: 'chapter', id: c.id, label: `Captulo #${c.number} ${c.title ? `— ${c.title}` : ''}`, icon: FileText, cat: 'Captulos' });
      }
    }

    // Tasks
    for (const t of tasks) {
      if (t.title.toLowerCase().includes(q)) {
        results.push({ type: 'task', id: t.id, label: t.title, icon: CheckSquare, cat: 'Tarefas' });
      }
    }

    // Tutorials
    for (const tut of tutorials) {
      if (tut.title.toLowerCase().includes(q) || tut.category.toLowerCase().includes(q)) {
        results.push({ type: 'tutorial', id: tut.id, label: tut.title, icon: GraduationCap, cat: 'Academia' });
      }
    }

    // Channels
    for (const ch of channels) {
      if (ch.name.toLowerCase().includes(q)) {
        results.push({ type: 'channel', id: ch.id, label: `#${ch.name}`, icon: Hash, cat: 'Canais' });
      }
    }

    // Team
    for (const m of team) {
      const name = m.member?.displayName || m.member?.username || '';
      if (name.toLowerCase().includes(q)) {
        results.push({ type: 'member', id: m.userId, label: name, icon: Users, cat: 'Equipe' });
      }
    }

    return results.slice(0, 8);
  });

  function handleKeyDown(e: KeyboardEvent) {
    const list = searchResults();
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      selectedIndex = (selectedIndex + 1) % list.length;
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      selectedIndex = (selectedIndex - 1 + list.length) % list.length;
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (list[selectedIndex]) {
        onSelect(list[selectedIndex].type, list[selectedIndex].id);
        onClose();
      }
    } else if (e.key === 'Escape') {
      onClose();
    }
  }
</script>

<svelte:window onkeydown={(e) => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
    e.preventDefault();
    if (isOpen) onClose();
    else {
      query = '';
      selectedIndex = 0;
      onSelect('OPEN_PALETTE', '');
    }
  }
}} />

{#if isOpen}
  <div class="palette-backdrop" onclick={() => onClose()}>
    <div class="palette-modal-card" onclick={(e) => e.stopPropagation()}>
      <div class="palette-input-bar">
        <Search size={18} class="palette-search-icon" />
        <input
          type="text"
          class="palette-input"
          placeholder="Buscar obras, captulos, tarefas, canais ou membros... (Esc para fechar)"
          bind:value={query}
          onkeydown={handleKeyDown}
          autofocus
        />
        <button type="button" class="btn-palette-close" onclick={() => onClose()}>
          <X size={16} />
        </button>
      </div>

      <div class="palette-results-list">
        {#if searchResults().length === 0}
          <p class="palette-empty-txt">Nenhum resultado encontrado para "{query}".</p>
        {:else}
          {#each searchResults() as res, idx}
            {@const IconComponent = res.icon}
            <button
              type="button"
              class="palette-item"
              class:selected={idx === selectedIndex}
              onclick={() => {
                onSelect(res.type, res.id);
                onClose();
              }}
            >
              <div class="item-left">
                <IconComponent size={16} class="item-icon" />
                <span class="item-title">{res.label}</span>
              </div>
              <div class="item-right">
                <span class="item-cat">{res.cat}</span>
                <CornerDownLeft size={12} class="enter-icon" />
              </div>
            </button>
          {/each}
        {/if}
      </div>

      <div class="palette-footer">
        <div class="kbd-shortcuts-tip">
          <span class="kbd-chip">↑</span>
          <span class="kbd-chip">↓</span>
          <span>para navegar</span>
          <span class="kbd-chip">Enter</span>
          <span>para selecionar</span>
          <span class="kbd-chip">Esc</span>
          <span>para fechar</span>
        </div>
      </div>
    </div>
  </div>
{/if}

<style>
  .palette-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.75);
    display: flex;
    align-items: flex-start;
    justify-content: center;
    padding-top: 15vh;
    z-index: 200;
    backdrop-filter: blur(4px);
  }

  .palette-modal-card {
    background: #111115;
    border: 1px solid #27272a;
    border-radius: 12px;
    width: 100%;
    max-width: 580px;
    overflow: hidden;
    box-shadow: 0 25px 50px rgba(0, 0, 0, 0.6);
  }

  .palette-input-bar {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.875rem 1.25rem;
    border-bottom: 1px solid #27272a;
    background: #09090b;
  }

  .palette-search-icon {
    color: #818cf8;
  }

  .palette-input {
    flex: 1;
    background: transparent;
    border: none;
    outline: none;
    color: #f4f4f5;
    font-size: 0.9375rem;
  }

  .btn-palette-close {
    background: transparent;
    border: none;
    color: #71717a;
    cursor: pointer;
  }

  .palette-results-list {
    max-height: 340px;
    overflow-y: auto;
    padding: 0.5rem;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .palette-empty-txt {
    padding: 2rem;
    text-align: center;
    color: #71717a;
    font-size: 0.875rem;
  }

  .palette-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
    padding: 0.6rem 0.75rem;
    background: transparent;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    text-align: left;
    transition: background 0.1s ease;
  }

  .palette-item:hover,
  .palette-item.selected {
    background: #27272a;
  }

  .item-left {
    display: flex;
    align-items: center;
    gap: 0.65rem;
  }

  .item-icon {
    color: #a1a1aa;
  }

  .palette-item.selected .item-icon {
    color: #818cf8;
  }

  .item-title {
    font-size: 0.875rem;
    font-weight: 500;
    color: #f4f4f5;
  }

  .item-right {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .item-cat {
    font-size: 0.6875rem;
    color: #71717a;
    text-transform: uppercase;
    font-weight: 600;
  }

  .enter-icon {
    color: #71717a;
    opacity: 0;
  }

  .palette-item.selected .enter-icon {
    opacity: 1;
    color: #a1a1aa;
  }

  .palette-footer {
    padding: 0.5rem 1.25rem;
    background: #09090b;
    border-top: 1px solid #1f1f23;
  }

  .kbd-shortcuts-tip {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    font-size: 0.6875rem;
    color: #71717a;
  }

  .kbd-chip {
    background: #18181b;
    border: 1px solid #27272a;
    color: #a1a1aa;
    padding: 0.1rem 0.35rem;
    border-radius: 4px;
    font-family: monospace;
    font-size: 0.625rem;
  }
</style>
