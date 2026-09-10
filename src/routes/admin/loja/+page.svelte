<script lang="ts">
  import { invalidateAll } from '$app/navigation';
  import { action } from '$lib/actions';
  import {
    ShoppingBag,
    Plus,
    Search,
    Edit3,
    Trash2,
    Copy,
    Archive,
    RotateCcw,
    CheckCircle2,
    X,
    Loader2,
    Sparkles,
    Shield,
    Palette,
    Tag,
    Image as ImageIcon,
    Users,
    Crown,
    Upload,
    MessageSquare,
    Award,
    Layers
  } from '@lucide/svelte';
  import UserAvatar from '$lib/components/UserAvatar.svelte';

  let { data } = $props();

  let search = $state('');
  let kindFilter = $state<string>('ALL');
  let statusFilter = $state<'ALL' | 'ACTIVE' | 'ARCHIVED'>('ALL');
  let notice = $state('');
  let noticeType = $state<'info' | 'success' | 'error'>('info');
  let busy = $state(false);

  // Modal state
  let showModal = $state(false);
  let editingItem = $state<any>(null);

  // Form fields
  let formId = $state('');
  let formName = $state('');
  let formDescription = $state('');
  let formKind = $state<'AVATAR_FRAME' | 'COMMENT_BANNER' | 'NAME_COLOR' | 'TITLE' | 'BADGE'>('AVATAR_FRAME');
  let formRarity = $state<'COMUM' | 'INCOMUM' | 'RARA' | 'EPICA' | 'LENDARIA' | 'MITICA'>('COMUM');
  let formPriceXp = $state(500);
  let formMinLevel = $state(1);
  let formIsAnimated = $state(false);
  let formStatus = $state('ACTIVE');
  let formOrderIndex = $state(10);
  let formAssetUrl = $state('');
  let formStyleJson = $state('{}');

  // New helpers: auto-slug & upload state
  let slugTouched = $state(false);
  let uploading = $state(false);
  let uploadError = $state('');

  const COLOR_PRESETS = [
    { name: 'Cyber Neon', gradient: 'linear-gradient(135deg, #06b6d4, #a855f7)', color: '#06b6d4' },
    { name: 'Ouro Real', gradient: 'linear-gradient(135deg, #f59e0b, #fbbf24)', color: '#fbbf24' },
    { name: 'Void Cósmico', gradient: 'linear-gradient(135deg, #ec4899, #8b5cf6)', color: '#a855f7' },
    { name: 'Rubi Carmim', gradient: 'linear-gradient(135deg, #ef4444, #f43f5e)', color: '#ef4444' },
    { name: 'Esmeralda', gradient: 'linear-gradient(135deg, #10b981, #059669)', color: '#10b981' },
    { name: 'Gelo Eterno', gradient: 'linear-gradient(135deg, #38bdf8, #818cf8)', color: '#38bdf8' }
  ];

  function slugify(text: string): string {
    return text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '');
  }

  function handleNameChange(e: Event) {
    const val = (e.target as HTMLInputElement).value;
    formName = val;
    if (!slugTouched && !editingItem) {
      formId = slugify(val);
    }
  }

  function applyColorPreset(preset: typeof COLOR_PRESETS[0]) {
    formStyleJson = JSON.stringify(
      {
        gradient: preset.gradient,
        color: preset.color,
        textShadow: `0 0 10px ${preset.color}80`
      },
      null,
      2
    );
  }

  function applySingleColor(colorHex: string) {
    formStyleJson = JSON.stringify(
      {
        color: colorHex,
        textShadow: `0 0 8px ${colorHex}80`
      },
      null,
      2
    );
  }

  async function handleFileUpload(e: Event) {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    uploading = true;
    uploadError = '';
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('purpose', 'cosmetic');

      const res = await fetch('/api/upload', {
        method: 'POST',
        body: fd
      });

      if (!res.ok) {
        const result = await res.json().catch(() => ({}));
        throw new Error(result.message || result.error || 'Falha no upload do arquivo.');
      }

      const result = await res.json();
      formAssetUrl = `/media/${result.id}`;

      // Auto-detect animation for GIF or animated WebP
      if (result.isAnimated || file.name.toLowerCase().endsWith('.gif') || file.type === 'image/gif') {
        formIsAnimated = true;
      }

      // Auto-suggest name and slug if empty
      if (!formName.trim()) {
        const cleanName = file.name.replace(/\.[^/.]+$/, '').replace(/[_-]+/g, ' ');
        formName = cleanName.charAt(0).toUpperCase() + cleanName.slice(1);
        if (!slugTouched && !editingItem) {
          formId = slugify(formName);
        }
      }
    } catch (err: any) {
      uploadError = err.message || 'Erro ao processar o upload.';
    } finally {
      uploading = false;
      input.value = '';
    }
  }

  let filteredItems = $derived(
    (data.items || []).filter((it: any) => {
      const matchesSearch =
        it.name.toLowerCase().includes(search.toLowerCase()) ||
        it.id.toLowerCase().includes(search.toLowerCase());
      const matchesKind = kindFilter === 'ALL' || it.kind === kindFilter;
      const matchesStatus =
        statusFilter === 'ALL' ||
        (statusFilter === 'ACTIVE' && it.is_active && it.status !== 'ARCHIVED') ||
        (statusFilter === 'ARCHIVED' && (!it.is_active || it.status === 'ARCHIVED'));
      return matchesSearch && matchesKind && matchesStatus;
    })
  );

  function formatXp(n: number = 0) {
    return new Intl.NumberFormat('pt-BR').format(n);
  }

  function parseStyle(raw: string): Record<string, any> {
    try {
      return JSON.parse(raw);
    } catch {
      return {};
    }
  }

  function openCreateModal() {
    editingItem = null;
    slugTouched = false;
    formId = '';
    formName = '';
    formDescription = '';
    formKind = 'AVATAR_FRAME';
    formRarity = 'COMUM';
    formPriceXp = 300;
    formMinLevel = 1;
    formIsAnimated = false;
    formStatus = 'ACTIVE';
    formOrderIndex = (data.items?.length || 0) + 1;
    formAssetUrl = '';
    formStyleJson = '{}';
    uploadError = '';
    showModal = true;
    notice = '';
  }

  function openEditModal(it: any) {
    editingItem = it;
    slugTouched = true;
    formId = it.id;
    formName = it.name;
    formDescription = it.description || '';
    formKind = it.kind;
    formRarity = it.rarity || 'COMUM';
    formPriceXp = it.price_xp;
    formMinLevel = it.min_level;
    formIsAnimated = Boolean(it.is_animated);
    formStatus = it.status || (it.is_active ? 'ACTIVE' : 'ARCHIVED');
    formOrderIndex = it.order_index ?? 99;
    formAssetUrl = it.asset_url || '';
    formStyleJson = JSON.stringify(it.style_data || {}, null, 2);
    uploadError = '';
    showModal = true;
    notice = '';
  }

  function duplicateItem(it: any) {
    editingItem = null;
    slugTouched = true;
    formId = `${it.id}_copy`;
    formName = `${it.name} (Cópia)`;
    formDescription = it.description || '';
    formKind = it.kind;
    formRarity = it.rarity || 'COMUM';
    formPriceXp = it.price_xp;
    formMinLevel = it.min_level;
    formIsAnimated = Boolean(it.is_animated);
    formStatus = 'ACTIVE';
    formOrderIndex = (data.items?.length || 0) + 1;
    formAssetUrl = it.asset_url || '';
    formStyleJson = JSON.stringify(it.style_data || {}, null, 2);
    uploadError = '';
    showModal = true;
    notice = 'Item duplicado no formulário. Ajuste os campos e clique em Salvar.';
    noticeType = 'info';
  }

  async function handleSaveItem(e: SubmitEvent) {
    e.preventDefault();
    if (!formId.trim() || !formName.trim()) {
      notice = 'ID e Nome são obrigatórios.';
      noticeType = 'error';
      return;
    }

    let parsedStyle = {};
    try {
      parsedStyle = JSON.parse(formStyleJson);
    } catch {
      notice = 'O campo Estilo (JSON) contém formato inválido.';
      noticeType = 'error';
      return;
    }

    busy = true;
    notice = '';

    try {
      await action('editor', 'shop_item', {
        id: formId.trim(),
        name: formName.trim(),
        description: formDescription.trim(),
        kind: formKind,
        rarity: formRarity,
        price_xp: formPriceXp,
        min_level: formMinLevel,
        is_animated: formIsAnimated,
        status: formStatus,
        is_active: formStatus === 'ACTIVE',
        order_index: formOrderIndex,
        asset_url: formAssetUrl.trim(),
        style_data: parsedStyle
      });

      await invalidateAll();
      showModal = false;
      notice = `Cosmético "${formName}" salvo com sucesso!`;
      noticeType = 'success';
    } catch (err: any) {
      notice = err.message || 'Erro ao salvar item da loja.';
      noticeType = 'error';
    } finally {
      busy = false;
    }
  }

  async function toggleArchive(it: any) {
    const isNowActive = it.status === 'ARCHIVED' || !it.is_active;
    busy = true;
    try {
      await action('editor', 'shop_item', {
        ...it,
        status: isNowActive ? 'ACTIVE' : 'ARCHIVED',
        is_active: isNowActive
      });
      await invalidateAll();
      notice = isNowActive ? `Item "${it.name}" reativado!` : `Item "${it.name}" arquivado.`;
      noticeType = 'success';
    } catch (err: any) {
      notice = err.message || 'Erro ao alterar status do item.';
      noticeType = 'error';
    } finally {
      busy = false;
    }
  }

  async function handleDelete(it: any) {
    if (it.owners_count > 0) {
      const ok = confirm(
        `Este item pertence ao inventário de ${it.owners_count} usuário(s). Por segurança, ele será arquivado em vez de excluído para preservar o inventário dos leitores. Deseja arquivar?`
      );
      if (!ok) return;
    } else {
      const ok = confirm(`Deseja realmente excluir permanentemente o item "${it.name}"?`);
      if (!ok) return;
    }

    busy = true;
    try {
      const res = await action('editor', 'delete_shop_item', { id: it.id });
      await invalidateAll();
      notice = res.message || `Item "${it.name}" processado com sucesso.`;
      noticeType = 'success';
    } catch (err: any) {
      notice = err.message || 'Erro ao excluir item.';
      noticeType = 'error';
    } finally {
      busy = false;
    }
  }
</script>

<svelte:head>
  <title>Gestão da Loja de Cosméticos — Project Nox Admin</title>
</svelte:head>

<div class="admin-page">
  <header class="page-header">
    <div class="header-left">
      <span class="badge-mini">CATÁLOGO & ECONOMIA</span>
      <h1 class="page-title">Gestão da Loja de Cosméticos</h1>
      <p class="page-desc">
        Configure molduras, títulos, cores de nome e banners disponíveis para os leitores desbloquearem com XP.
      </p>
    </div>
    <div class="header-right">
      <button class="btn-primary" onclick={openCreateModal}>
        <Plus size={16} />
        <span>Novo Cosmético</span>
      </button>
    </div>
  </header>

  {#if notice}
    <div class="notice-banner" class:success={noticeType === 'success'} class:error={noticeType === 'error'}>
      <span>{notice}</span>
      <button class="btn-close-notice" onclick={() => (notice = '')}><X size={14} /></button>
    </div>
  {/if}

  <!-- Toolbar & Filters -->
  <div class="toolbar-card">
    <div class="search-box">
      <Search size={16} class="search-icon" />
      <input
        type="text"
        placeholder="Buscar cosmético por nome ou ID…"
        bind:value={search}
        class="search-input"
      />
    </div>

    <div class="filter-group">
      <button
        class="filter-chip"
        class:active={kindFilter === 'ALL'}
        onclick={() => (kindFilter = 'ALL')}
      >
        Todos ({data.items.length})
      </button>
      <button
        class="filter-chip"
        class:active={kindFilter === 'AVATAR_FRAME'}
        onclick={() => (kindFilter = 'AVATAR_FRAME')}
      >
        Molduras ({data.items.filter((i: any) => i.kind === 'AVATAR_FRAME').length})
      </button>
      <button
        class="filter-chip"
        class:active={kindFilter === 'COMMENT_BANNER'}
        onclick={() => (kindFilter = 'COMMENT_BANNER')}
      >
        Banners Comentários ({data.items.filter((i: any) => i.kind === 'COMMENT_BANNER').length})
      </button>
      <button
        class="filter-chip"
        class:active={kindFilter === 'NAME_COLOR'}
        onclick={() => (kindFilter = 'NAME_COLOR')}
      >
        Cores ({data.items.filter((i: any) => i.kind === 'NAME_COLOR').length})
      </button>
      <button
        class="filter-chip"
        class:active={kindFilter === 'TITLE'}
        onclick={() => (kindFilter = 'TITLE')}
      >
        Títulos ({data.items.filter((i: any) => i.kind === 'TITLE').length})
      </button>
      <button
        class="filter-chip"
        class:active={kindFilter === 'BADGE'}
        onclick={() => (kindFilter = 'BADGE')}
      >
        Emblemas ({data.items.filter((i: any) => i.kind === 'BADGE').length})
      </button>
    </div>
  </div>

  <!-- Items Grid -->
  <div class="items-grid">
    {#each filteredItems as item (item.id)}
      {@const style = item.style_data || {}}
      {@const isArchived = !item.is_active || item.status === 'ARCHIVED'}
      <div class="item-card" class:is-archived={isArchived}>
        <!-- Visual Preview Box -->
        <div class="item-preview-box">
          {#if item.kind === 'AVATAR_FRAME'}
            <UserAvatar
              avatarId={null}
              frameId={item.asset_url ? null : item.id}
              frameUrl={item.asset_url || null}
              displayName={item.name}
              size={64}
            />
          {:else if item.kind === 'NAME_COLOR'}
            <span
              class="preview-color-text"
              style={style.gradient
                ? `background: ${style.gradient}; -webkit-background-clip: text; -webkit-text-fill-color: transparent;`
                : `color: ${style.color || '#ffffff'}; text-shadow: ${style.textShadow || 'none'};`}
            >
              ExemploNox
            </span>
          {:else if item.kind === 'TITLE'}
            <span class="preview-title-badge" style="color: {style.color || '#dfc28d'}">
              <Crown size={12} />
              <span>{item.name}</span>
            </span>
          {:else if item.kind === 'COMMENT_BANNER'}
            <div
              class="preview-comment-banner-box"
              style={item.asset_url ? `background-image: url(${item.asset_url}); background-size: cover; background-position: center;` : style.background ? `background: ${style.background};` : 'background: #181928;'}
            >
              <MessageSquare size={13} />
              <span>{item.name}</span>
            </div>
          {:else if item.kind === 'BADGE'}
            <div class="preview-badge-chip">
              {#if item.asset_url}
                <img src={item.asset_url} alt="" class="badge-card-icon" />
              {:else}
                <Award size={20} class="badge-icon" />
              {/if}
              <span>{item.name}</span>
            </div>
          {/if}

          <div class="preview-badges-top">
            <span class="rarity-tag rarity-{item.rarity?.toLowerCase() || 'comum'}">
              {item.rarity || 'COMUM'}
            </span>
            {#if item.is_animated}
              <span class="anim-tag">Animado</span>
            {/if}
          </div>
        </div>

        <!-- Info Block -->
        <div class="item-info">
          <div class="info-top">
            <h3 class="item-name">{item.name}</h3>
            <span class="item-id">{item.id}</span>
          </div>

          <p class="item-desc">{item.description || 'Sem descrição cadastrada.'}</p>

          <div class="item-stats-row">
            <div class="stat-pill xp" title="Preço em XP">
              <Sparkles size={13} />
              <span>{formatXp(item.price_xp)} XP</span>
            </div>
            <div class="stat-pill lvl" title="Nível mínimo requerido">
              <span>Nv. {item.min_level}</span>
            </div>
            <div class="stat-pill owners" title="Usuários que possuem no inventário">
              <Users size={12} />
              <span>{item.owners_count}</span>
            </div>
          </div>
        </div>

        <!-- Footer Actions -->
        <div class="item-card-footer">
          <button class="btn-card-action edit" onclick={() => openEditModal(item)} title="Editar cosmético">
            <Edit3 size={14} />
            <span>Editar</span>
          </button>
          <button class="btn-card-action duplicate" onclick={() => duplicateItem(item)} title="Duplicar cosmético">
            <Copy size={14} />
          </button>
          <button
            class="btn-card-action archive"
            onclick={() => toggleArchive(item)}
            title={isArchived ? 'Reativar cosmético na loja' : 'Arquivar cosmético'}
          >
            {#if isArchived}
              <RotateCcw size={14} />
            {:else}
              <Archive size={14} />
            {/if}
          </button>
          <button class="btn-card-action delete" onclick={() => handleDelete(item)} title="Excluir cosmético">
            <Trash2 size={14} />
          </button>
        </div>
      </div>
    {/each}

    {#if !filteredItems.length}
      <div class="empty-state">
        <ShoppingBag size={40} class="empty-icon" />
        <p class="empty-text">Nenhum cosmético encontrado com os filtros selecionados.</p>
      </div>
    {/if}
  </div>

  <!-- Modal Editor -->
  {#if showModal}
    <div class="modal-backdrop" onclick={() => (showModal = false)}>
      <div class="modal-card" onclick={(e) => e.stopPropagation()}>
        <div class="modal-header">
          <h2 class="modal-title">{editingItem ? 'Editar Cosmético' : 'Novo Item Cosmético'}</h2>
          <button class="btn-close-modal" onclick={() => (showModal = false)}>
            <X size={18} />
          </button>
        </div>

        <form onsubmit={handleSaveItem} class="modal-form">
          <!-- Live Preview Stage in Modal -->
          <div class="modal-preview-stage">
            <div class="preview-stage-header-row">
              <span class="preview-stage-label">PRÉVIA EM TEMPO REAL</span>
              {#if formIsAnimated}
                <span class="anim-glow-badge">✨ GIF Animado Ativo</span>
              {/if}
            </div>

            {#if formKind === 'AVATAR_FRAME'}
              <div class="avatar-preview-box">
                <UserAvatar
                  avatarId={data.profile?.avatar_id}
                  frameId={formAssetUrl ? null : formId}
                  frameUrl={formAssetUrl || null}
                  displayName={formName || 'ProjetoNox'}
                  size={80}
                />
                <div class="avatar-preview-meta">
                  <span class="avatar-preview-name">{formName || 'Moldura Cósmica'}</span>
                  <span class="avatar-preview-hint">
                    {formAssetUrl ? '✓ Renderizada via asset de imagem/GIF' : 'Moldura clássica baseada em CSS'}
                  </span>
                </div>
              </div>

            {:else if formKind === 'COMMENT_BANNER'}
              <div
                class="modal-comment-banner-preview"
                style={formAssetUrl ? `background-image: url(${formAssetUrl}); background-size: cover; background-position: center;` : parseStyle(formStyleJson).background ? `background: ${parseStyle(formStyleJson).background};` : 'background: #181928;'}
              >
                <div class="comment-preview-glass">
                  <UserAvatar
                    avatarId={data.profile?.avatar_id}
                    displayName="LeitorNox"
                    size={36}
                  />
                  <div class="comment-preview-content">
                    <div class="comment-preview-user-row">
                      <strong>Leitor Nox</strong>
                      <span class="comment-tag">VIP</span>
                    </div>
                    <p class="comment-preview-text">Que capítulo incrível! Traços e efeitos sensacionais.</p>
                  </div>
                </div>
              </div>

            {:else if formKind === 'NAME_COLOR'}
              <div class="modal-color-preview-group">
                <div class="color-preview-sample">
                  <span class="sample-label">No Perfil:</span>
                  <span
                    class="preview-color-text"
                    style={parseStyle(formStyleJson).gradient
                      ? `background: ${parseStyle(formStyleJson).gradient}; -webkit-background-clip: text; -webkit-text-fill-color: transparent;`
                      : `color: ${parseStyle(formStyleJson).color || '#ffffff'}; text-shadow: ${parseStyle(formStyleJson).textShadow || 'none'};`}
                  >
                    @{data.profile?.username || 'usuario_nox'}
                  </span>
                </div>
                <div class="color-preview-sample reader">
                  <span class="sample-label">No Leitor:</span>
                  <span
                    class="preview-reader-name"
                    style={parseStyle(formStyleJson).gradient
                      ? `background: ${parseStyle(formStyleJson).gradient}; -webkit-background-clip: text; -webkit-text-fill-color: transparent;`
                      : `color: ${parseStyle(formStyleJson).color || '#ffffff'}; text-shadow: ${parseStyle(formStyleJson).textShadow || 'none'};`}
                  >
                    Cap. 01 — @{data.profile?.username || 'usuario_nox'}
                  </span>
                </div>
              </div>

            {:else if formKind === 'TITLE'}
              <div class="modal-title-preview-box">
                <span class="preview-title-badge" style="color: {parseStyle(formStyleJson).color || '#dfc28d'}">
                  <Crown size={15} />
                  <span>{formName || 'Título Cósmico'}</span>
                </span>
                <span class="title-preview-sub">Exibido com honra no perfil e comentários</span>
              </div>

            {:else if formKind === 'BADGE'}
              <div class="modal-badge-preview-box">
                {#if formAssetUrl}
                  <img src={formAssetUrl} alt="" class="modal-badge-img" />
                {:else}
                  <Award size={36} class="modal-badge-icon" />
                {/if}
                <span class="modal-badge-label">{formName || 'Emblema Cósmico'}</span>
              </div>
            {/if}
          </div>

          <!-- Basic Info -->
          <div class="form-row">
            <div class="form-group flex-1">
              <label for="item-name" class="form-label">Nome de Exibição *</label>
              <input
                id="item-name"
                type="text"
                class="form-input"
                bind:value={formName}
                oninput={handleNameChange}
                placeholder="ex: Moldura Cyber Neon"
                required
              />
            </div>
            <div class="form-group flex-1">
              <label for="item-id" class="form-label">
                ID Único (slug) *
                {#if !slugTouched && !editingItem}
                  <span class="auto-slug-badge">auto-gerado</span>
                {/if}
              </label>
              <input
                id="item-id"
                type="text"
                class="form-input font-mono"
                bind:value={formId}
                oninput={() => (slugTouched = true)}
                placeholder="ex: moldura_cyber_neon"
                disabled={Boolean(editingItem)}
                required
              />
            </div>
          </div>

          <div class="form-group">
            <label for="item-desc" class="form-label">Descrição Cosmética</label>
            <textarea
              id="item-desc"
              rows={2}
              class="form-textarea"
              bind:value={formDescription}
              placeholder="Explique o tema e efeito visual do cosmético…"
            ></textarea>
          </div>

          <div class="form-row">
            <div class="form-group flex-1">
              <label for="item-kind" class="form-label">Categoria de Slot</label>
              <select id="item-kind" class="form-select" bind:value={formKind}>
                <option value="AVATAR_FRAME">Moldura de Avatar</option>
                <option value="COMMENT_BANNER">Banner de Comentário</option>
                <option value="NAME_COLOR">Cor de Nome</option>
                <option value="TITLE">Título Cósmico</option>
                <option value="BADGE">Emblema / Medalha</option>
              </select>
            </div>

            <div class="form-group flex-1">
              <label for="item-rarity" class="form-label">Raridade</label>
              <select id="item-rarity" class="form-select" bind:value={formRarity}>
                <option value="COMUM">Comum (100–300 XP)</option>
                <option value="INCOMUM">Incomum (350–600 XP)</option>
                <option value="RARA">Rara (700–1.200 XP)</option>
                <option value="EPICA">Épica (1.300–2.200 XP)</option>
                <option value="LENDARIA">Lendária (2.500–4.000 XP)</option>
                <option value="MITICA">Mítica (5.000+ XP)</option>
              </select>
            </div>
          </div>

          <div class="form-row">
            <div class="form-group flex-1">
              <label for="item-price" class="form-label">Preço em XP</label>
              <input
                id="item-price"
                type="number"
                min="0"
                step="50"
                class="form-input"
                bind:value={formPriceXp}
                required
              />
            </div>
            <div class="form-group flex-1">
              <label for="item-min-level" class="form-label">Nível Mínimo Requerido</label>
              <input
                id="item-min-level"
                type="number"
                min="1"
                class="form-input"
                bind:value={formMinLevel}
                required
              />
            </div>
          </div>

          <!-- Direct Image / GIF Uploader Zone -->
          <div class="uploader-box">
            <div class="uploader-header">
              <label class="form-label">Upload de Imagem ou GIF (Molduras, Banners e Ícones)</label>
              {#if formAssetUrl}
                <button
                  type="button"
                  class="btn-clear-asset"
                  onclick={() => (formAssetUrl = '')}
                >
                  <Trash2 size={12} />
                  <span>Remover imagem</span>
                </button>
              {/if}
            </div>

            <div class="dropzone-wrap">
              <input
                type="file"
                id="cosmetic-upload"
                accept="image/*,.gif,.webp"
                class="sr-only"
                onchange={handleFileUpload}
                disabled={uploading}
              />
              <label for="cosmetic-upload" class="dropzone-label" class:is-uploading={uploading}>
                {#if uploading}
                  <Loader2 size={24} class="spin dropzone-icon" />
                  <div class="dropzone-text-group">
                    <strong class="dropzone-text">Enviando e validando animação…</strong>
                    <span class="dropzone-sub">Processando arquivo no servidor</span>
                  </div>
                {:else if formAssetUrl}
                  <CheckCircle2 size={24} class="dropzone-icon success" />
                  <div class="dropzone-text-group">
                    <strong class="dropzone-text file-set">Asset carregado com sucesso</strong>
                    <span class="dropzone-sub font-mono">{formAssetUrl}</span>
                  </div>
                  <span class="btn-replace-pill">Substituir</span>
                {:else}
                  <Upload size={24} class="dropzone-icon" />
                  <div class="dropzone-text-group">
                    <strong class="dropzone-text">Clique para selecionar imagem ou GIF</strong>
                    <span class="dropzone-sub">Suporta GIF animado (frames preservados), WebP, PNG e JPG (até 50MB)</span>
                  </div>
                {/if}
              </label>
            </div>

            {#if uploadError}
              <p class="upload-error-msg">{uploadError}</p>
            {/if}
          </div>

          <!-- Quick presets for NAME_COLOR -->
          {#if formKind === 'NAME_COLOR'}
            <div class="color-presets-section">
              <div class="presets-header">
                <span class="form-label">Predefinições Rápidas de Gradiente</span>
              </div>
              <div class="preset-chips-wrap">
                {#each COLOR_PRESETS as preset}
                  <button
                    type="button"
                    class="preset-chip"
                    style="background: {preset.gradient};"
                    onclick={() => applyColorPreset(preset)}
                  >
                    {preset.name}
                  </button>
                {/each}
              </div>
            </div>
          {/if}

          <!-- Collapsed Advanced Accordion -->
          <details class="advanced-accordion">
            <summary class="advanced-summary">
              <span class="summary-left">
                <Layers size={14} />
                <span>Configurações Avançadas (JSON CSS, Ordem & Status)</span>
              </span>
            </summary>
            <div class="advanced-body">
              <div class="form-row">
                <div class="form-group flex-1">
                  <label for="item-order" class="form-label">Ordem de Exibição</label>
                  <input
                    id="item-order"
                    type="number"
                    class="form-input"
                    bind:value={formOrderIndex}
                  />
                </div>
                <div class="form-group flex-1">
                  <label for="item-status" class="form-label">Status na Loja</label>
                  <select id="item-status" class="form-select" bind:value={formStatus}>
                    <option value="ACTIVE">Ativo (Visível na Loja)</option>
                    <option value="DRAFT">Rascunho (Oculto)</option>
                    <option value="ARCHIVED">Arquivado</option>
                  </select>
                </div>
              </div>

              <div class="form-group">
                <label for="item-asset" class="form-label">URL Direta do Asset</label>
                <input
                  id="item-asset"
                  type="text"
                  class="form-input font-mono"
                  bind:value={formAssetUrl}
                  placeholder="/media/uuid ou https://..."
                />
              </div>

              <div class="form-group">
                <label for="item-style" class="form-label">Estilo CSS Personalizado (JSON)</label>
                <textarea
                  id="item-style"
                  rows={3}
                  class="form-textarea font-mono"
                  bind:value={formStyleJson}
                  placeholder={'{\n  "border": "2px solid #8b5cf6"\n}'}
                ></textarea>
              </div>

              <div class="form-row items-center">
                <label class="checkbox-label">
                  <input type="checkbox" class="form-checkbox" bind:checked={formIsAnimated} />
                  <span>Sinalizar como Cosmético Animado</span>
                </label>
              </div>
            </div>
          </details>

          <div class="modal-actions">
            <button
              type="button"
              class="btn-secondary"
              onclick={() => (showModal = false)}
              disabled={busy}
            >
              Cancelar
            </button>
            <button type="submit" class="btn-primary" disabled={busy}>
              {#if busy}
                <Loader2 size={16} class="spin" />
                <span>Salvando…</span>
              {:else}
                <CheckCircle2 size={16} />
                <span>{editingItem ? 'Salvar Alterações' : 'Criar Cosmético'}</span>
              {/if}
            </button>
          </div>
        </form>
      </div>
    </div>
  {/if}
</div>

<style>
  .admin-page {
    display: flex;
    flex-direction: column;
    gap: 24px;
    padding: 32px;
    max-width: 1400px;
    margin: 0 auto;
  }

  .page-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 16px;
    flex-wrap: wrap;
  }

  .badge-mini {
    font-size: 10.5px;
    font-weight: 800;
    letter-spacing: 0.12em;
    color: #dfc28d;
    text-transform: uppercase;
  }

  .page-title {
    font-size: 26px;
    font-weight: 800;
    color: #ffffff;
    margin: 4px 0 6px;
  }

  .page-desc {
    font-size: 14px;
    color: #8c899e;
    margin: 0;
  }

  .btn-primary {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 10px 18px;
    border-radius: 10px;
    background: linear-gradient(135deg, #8b5cf6, #7c3aed);
    color: #ffffff;
    font-size: 13.5px;
    font-weight: 600;
    border: none;
    cursor: pointer;
    box-shadow: 0 4px 16px rgba(139, 92, 246, 0.35);
    transition: all 0.2s ease;
  }

  .btn-primary:hover:not(:disabled) {
    background: linear-gradient(135deg, #9333ea, #8b5cf6);
    transform: translateY(-1px);
    box-shadow: 0 6px 20px rgba(139, 92, 246, 0.45);
  }

  .btn-primary:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .btn-secondary {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 10px 18px;
    border-radius: 10px;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.1);
    color: #d1cde0;
    font-size: 13.5px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .notice-banner {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 18px;
    border-radius: 10px;
    background: rgba(59, 130, 246, 0.12);
    border: 1px solid rgba(59, 130, 246, 0.3);
    color: #93c5fd;
    font-size: 13.5px;
  }

  .notice-banner.success {
    background: rgba(16, 185, 129, 0.12);
    border-color: rgba(16, 185, 129, 0.3);
    color: #6ee7b7;
  }

  .notice-banner.error {
    background: rgba(239, 68, 68, 0.12);
    border-color: rgba(239, 68, 68, 0.3);
    color: #fca5a5;
  }

  .btn-close-notice {
    background: transparent;
    border: none;
    color: inherit;
    cursor: pointer;
    padding: 4px;
  }

  /* Toolbar */
  .toolbar-card {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    flex-wrap: wrap;
    background: rgba(13, 16, 26, 0.6);
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: 14px;
    padding: 14px 18px;
  }

  .search-box {
    display: flex;
    align-items: center;
    gap: 10px;
    background: rgba(0, 0, 0, 0.3);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 10px;
    padding: 8px 14px;
    flex: 1;
    min-width: 260px;
  }

  :global(.search-icon) {
    color: #8c899e;
  }

  .search-input {
    background: transparent;
    border: none;
    color: #ffffff;
    font-size: 13.5px;
    outline: none;
    width: 100%;
  }

  .filter-group {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }

  .filter-chip {
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.07);
    color: #9d99ab;
    padding: 6px 14px;
    border-radius: 8px;
    font-size: 12px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .filter-chip:hover {
    background: rgba(255, 255, 255, 0.06);
    color: #ffffff;
  }

  .filter-chip.active {
    background: rgba(139, 92, 246, 0.15);
    border-color: rgba(139, 92, 246, 0.4);
    color: #c4b5fd;
    font-weight: 600;
  }

  /* Items Grid */
  .items-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: 18px;
  }

  .item-card {
    display: flex;
    flex-direction: column;
    background: rgba(13, 16, 26, 0.65);
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: 14px;
    overflow: hidden;
    backdrop-filter: blur(10px);
    transition: all 0.2s ease;
  }

  .item-card:hover {
    border-color: rgba(255, 255, 255, 0.12);
    transform: translateY(-2px);
  }

  .item-card.is-archived {
    opacity: 0.5;
  }

  .item-preview-box {
    height: 120px;
    background: radial-gradient(circle, rgba(139, 92, 246, 0.08) 0%, rgba(10, 12, 20, 0.95) 100%);
    border-bottom: 1px solid rgba(255, 255, 255, 0.06);
    display: flex;
    align-items: center;
    justify-content: center;
    position: relative;
    padding: 12px;
  }

  .preview-badges-top {
    position: absolute;
    top: 8px;
    right: 8px;
    display: flex;
    gap: 6px;
    align-items: center;
  }

  .rarity-tag {
    font-size: 9px;
    font-weight: 800;
    padding: 2px 6px;
    border-radius: 4px;
    letter-spacing: 0.05em;
  }

  .rarity-comum { background: rgba(148, 163, 184, 0.2); color: #94a3b8; }
  .rarity-incomum { background: rgba(52, 211, 153, 0.2); color: #34d399; }
  .rarity-rara { background: rgba(96, 165, 250, 0.2); color: #60a5fa; }
  .rarity-epica { background: rgba(192, 132, 252, 0.2); color: #c084fc; }
  .rarity-lendaria { background: rgba(251, 191, 36, 0.2); color: #fbbf24; }
  .rarity-mitica { background: rgba(244, 63, 94, 0.2); color: #f43f5e; }

  .anim-tag {
    font-size: 9px;
    font-weight: 700;
    padding: 2px 5px;
    border-radius: 4px;
    background: rgba(139, 92, 246, 0.25);
    color: #c4b5fd;
  }

  .preview-color-text {
    font-size: 18px;
    font-weight: 800;
  }

  .preview-title-badge {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 5px 12px;
    border-radius: 20px;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.1);
    font-size: 12px;
    font-weight: 750;
  }

  .preview-banner-box {
    width: 90%;
    height: 48px;
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 11px;
    font-weight: 700;
    color: #ffffff;
    text-shadow: 0 1px 3px rgba(0, 0, 0, 0.8);
    border: 1px solid rgba(255, 255, 255, 0.1);
  }

  .item-info {
    padding: 14px;
    display: flex;
    flex-direction: column;
    gap: 8px;
    flex: 1;
  }

  .info-top {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .item-name {
    font-size: 14.5px;
    font-weight: 750;
    color: #ffffff;
    margin: 0;
  }

  .item-id {
    font-size: 10.5px;
    font-family: monospace;
    color: #8c899e;
  }

  .item-desc {
    font-size: 12px;
    color: #9d99ab;
    line-height: 1.4;
    margin: 0;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  .item-stats-row {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-top: auto;
    padding-top: 8px;
  }

  .stat-pill {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-size: 11px;
    font-weight: 700;
    padding: 2px 7px;
    border-radius: 5px;
  }

  .stat-pill.xp {
    background: rgba(201, 170, 115, 0.12);
    color: #dfc28d;
    border: 1px solid rgba(201, 170, 115, 0.3);
  }

  .stat-pill.lvl {
    background: rgba(255, 255, 255, 0.04);
    color: #cbd5e1;
    border: 1px solid rgba(255, 255, 255, 0.08);
  }

  .stat-pill.owners {
    background: rgba(139, 92, 246, 0.1);
    color: #c4b5fd;
    border: 1px solid rgba(139, 92, 246, 0.3);
  }

  .item-card-footer {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 10px 14px;
    border-top: 1px solid rgba(255, 255, 255, 0.05);
    background: rgba(0, 0, 0, 0.15);
  }

  .btn-card-action {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 5px;
    padding: 6px 10px;
    border-radius: 6px;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.08);
    color: #d1cde0;
    font-size: 11.5px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .btn-card-action.edit {
    flex: 1;
  }

  .btn-card-action.edit:hover {
    background: rgba(139, 92, 246, 0.15);
    border-color: rgba(139, 92, 246, 0.35);
    color: #c4b5fd;
  }

  .btn-card-action.delete {
    color: #f87171;
  }

  .btn-card-action.delete:hover {
    background: rgba(239, 68, 68, 0.15);
    border-color: rgba(239, 68, 68, 0.35);
    color: #fca5a5;
  }

  .btn-card-action:hover {
    background: rgba(255, 255, 255, 0.08);
    color: #ffffff;
  }

  /* Modal */
  .modal-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.75);
    backdrop-filter: blur(8px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 999;
    padding: 20px;
  }

  .modal-card {
    background: #0f121d;
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 18px;
    width: 100%;
    max-width: 620px;
    max-height: 90vh;
    overflow-y: auto;
    box-shadow: 0 20px 50px rgba(0, 0, 0, 0.8);
    padding: 24px;
  }

  .modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 16px;
  }

  .modal-title {
    font-size: 20px;
    font-weight: 800;
    color: #ffffff;
    margin: 0;
  }

  .btn-close-modal {
    background: transparent;
    border: none;
    color: #8c899e;
    cursor: pointer;
    padding: 4px;
  }

  .modal-preview-stage {
    position: relative;
    min-height: 130px;
    background: radial-gradient(circle, rgba(139, 92, 246, 0.12) 0%, rgba(5, 7, 12, 0.98) 100%);
    border: 1px dashed rgba(255, 255, 255, 0.15);
    border-radius: 14px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 24px 16px 16px;
    margin-bottom: 18px;
    overflow: hidden;
  }

  .preview-stage-header-row {
    position: absolute;
    top: 8px;
    left: 12px;
    right: 12px;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .preview-stage-label {
    font-size: 9px;
    font-weight: 800;
    letter-spacing: 0.12em;
    color: #8c899e;
  }

  .anim-glow-badge {
    font-size: 9.5px;
    font-weight: 700;
    color: #c4b5fd;
    background: rgba(139, 92, 246, 0.25);
    border: 1px solid rgba(139, 92, 246, 0.4);
    padding: 2px 7px;
    border-radius: 6px;
  }

  /* Avatar Stage */
  .avatar-preview-box {
    display: flex;
    align-items: center;
    gap: 16px;
  }

  .avatar-preview-meta {
    display: flex;
    flex-direction: column;
    gap: 3px;
  }

  .avatar-preview-name {
    font-size: 15px;
    font-weight: 800;
    color: #ffffff;
  }

  .avatar-preview-hint {
    font-size: 11px;
    color: #9d99ab;
  }

  /* Comment Banner Stage */
  .modal-comment-banner-preview {
    width: 100%;
    border-radius: 10px;
    overflow: hidden;
    border: 1px solid rgba(255, 255, 255, 0.1);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
  }

  .comment-preview-glass {
    background: rgba(10, 12, 20, 0.78);
    backdrop-filter: blur(8px);
    padding: 12px 14px;
    display: flex;
    gap: 12px;
    align-items: flex-start;
  }

  .comment-preview-content {
    display: flex;
    flex-direction: column;
    gap: 3px;
    flex: 1;
  }

  .comment-preview-user-row {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 12.5px;
    color: #ffffff;
  }

  .comment-tag {
    font-size: 9.5px;
    font-weight: 800;
    padding: 1px 5px;
    border-radius: 4px;
    background: rgba(201, 170, 115, 0.2);
    color: #dfc28d;
    border: 1px solid rgba(201, 170, 115, 0.35);
  }

  .comment-preview-text {
    font-size: 12px;
    color: #cbd5e1;
    margin: 0;
    line-height: 1.35;
  }

  /* Profile Banner Stage */
  .modal-profile-banner-preview {
    width: 100%;
    height: 85px;
    border-radius: 10px;
    overflow: hidden;
    position: relative;
    border: 1px solid rgba(255, 255, 255, 0.1);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
    display: flex;
    align-items: flex-end;
  }

  .profile-banner-glass-bar {
    width: 100%;
    background: rgba(0, 0, 0, 0.55);
    backdrop-filter: blur(6px);
    padding: 8px 14px;
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .profile-banner-title {
    font-size: 13px;
    font-weight: 750;
    color: #ffffff;
    text-shadow: 0 1px 4px rgba(0, 0, 0, 0.8);
  }

  /* Color Stage */
  .modal-color-preview-group {
    display: flex;
    flex-direction: column;
    gap: 10px;
    width: 100%;
    max-width: 440px;
  }

  .color-preview-sample {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 14px;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 8px;
  }

  .sample-label {
    font-size: 11px;
    color: #8c899e;
    font-weight: 600;
  }

  .preview-reader-name {
    font-size: 13.5px;
    font-weight: 800;
  }

  /* Title Stage */
  .modal-title-preview-box {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
  }

  .title-preview-sub {
    font-size: 11px;
    color: #8c899e;
  }

  /* Badge Stage */
  .modal-badge-preview-box {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
  }

  .modal-badge-img {
    width: 44px;
    height: 44px;
    object-fit: contain;
  }

  .modal-badge-icon {
    color: #dfc28d;
  }

  .modal-badge-label {
    font-size: 13px;
    font-weight: 750;
    color: #ffffff;
  }

  /* Auto-slug Badge */
  .auto-slug-badge {
    font-size: 9px;
    font-weight: 800;
    text-transform: uppercase;
    padding: 1px 5px;
    border-radius: 4px;
    background: rgba(16, 185, 129, 0.15);
    color: #6ee7b7;
    margin-left: 6px;
  }

  /* Uploader Box */
  .uploader-box {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .uploader-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .btn-clear-asset {
    background: transparent;
    border: none;
    color: #f87171;
    font-size: 11px;
    font-weight: 600;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 2px 4px;
  }

  .btn-clear-asset:hover {
    text-decoration: underline;
  }

  .dropzone-wrap {
    position: relative;
  }

  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    border: 0;
  }

  .dropzone-label {
    display: flex;
    align-items: center;
    gap: 14px;
    padding: 14px 18px;
    border-radius: 12px;
    background: rgba(0, 0, 0, 0.3);
    border: 1px dashed rgba(255, 255, 255, 0.15);
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .dropzone-label:hover {
    border-color: #8b5cf6;
    background: rgba(139, 92, 246, 0.05);
  }

  .dropzone-label.is-uploading {
    pointer-events: none;
    opacity: 0.75;
  }

  :global(.dropzone-icon) {
    color: #8c899e;
    flex-shrink: 0;
  }

  :global(.dropzone-icon.success) {
    color: #34d399;
  }

  .dropzone-text-group {
    display: flex;
    flex-direction: column;
    gap: 2px;
    flex: 1;
    min-width: 0;
  }

  .dropzone-text {
    font-size: 13px;
    font-weight: 700;
    color: #ffffff;
  }

  .dropzone-text.file-set {
    color: #6ee7b7;
  }

  .dropzone-sub {
    font-size: 11px;
    color: #8c899e;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .btn-replace-pill {
    font-size: 11px;
    font-weight: 700;
    color: #c4b5fd;
    background: rgba(139, 92, 246, 0.2);
    border: 1px solid rgba(139, 92, 246, 0.35);
    padding: 4px 10px;
    border-radius: 6px;
  }

  .upload-error-msg {
    font-size: 11.5px;
    color: #f87171;
    margin: 0;
  }

  /* Color presets */
  .color-presets-section {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 12px;
    border-radius: 10px;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.06);
  }

  .presets-header {
    display: flex;
    justify-content: space-between;
  }

  .preset-chips-wrap {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }

  .preset-chip {
    padding: 5px 12px;
    border-radius: 6px;
    font-size: 11.5px;
    font-weight: 700;
    color: #ffffff;
    border: none;
    cursor: pointer;
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.8);
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.3);
    transition: transform 0.15s ease;
  }

  .preset-chip:hover {
    transform: scale(1.05);
  }

  /* Advanced Accordion */
  .advanced-accordion {
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 10px;
    background: rgba(0, 0, 0, 0.2);
    overflow: hidden;
  }

  .advanced-summary {
    padding: 10px 14px;
    cursor: pointer;
    user-select: none;
    font-size: 12px;
    font-weight: 700;
    color: #8c899e;
    transition: color 0.2s ease;
  }

  .advanced-summary:hover {
    color: #ffffff;
  }

  .summary-left {
    display: inline-flex;
    align-items: center;
    gap: 8px;
  }

  .advanced-body {
    padding: 14px;
    border-top: 1px solid rgba(255, 255, 255, 0.06);
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  /* Cards in grid additional styles */
  .preview-comment-banner-box {
    width: 90%;
    height: 48px;
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    font-size: 11px;
    font-weight: 700;
    color: #ffffff;
    text-shadow: 0 1px 3px rgba(0, 0, 0, 0.8);
    border: 1px solid rgba(255, 255, 255, 0.1);
  }

  .preview-badge-chip {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 6px 12px;
    border-radius: 8px;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.1);
    font-size: 12px;
    font-weight: 700;
    color: #dfc28d;
  }

  .badge-card-icon {
    width: 20px;
    height: 20px;
    object-fit: contain;
  }

  .modal-form {
    display: flex;
    flex-direction: column;
    gap: 14px;
  }

  .form-row {
    display: flex;
    gap: 14px;
    flex-wrap: wrap;
  }

  .form-row.items-center {
    align-items: center;
  }

  .flex-1 {
    flex: 1;
    min-width: 180px;
  }

  .form-group {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .form-label {
    font-size: 12px;
    font-weight: 700;
    color: #b5b1c7;
  }

  .form-input,
  .form-textarea,
  .form-select {
    background: rgba(0, 0, 0, 0.35);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 10px;
    padding: 10px 14px;
    color: #ffffff;
    font-size: 13.5px;
    outline: none;
    transition: all 0.2s ease;
  }

  .form-input:focus,
  .form-textarea:focus,
  .form-select:focus {
    border-color: #8b5cf6;
    background: rgba(0, 0, 0, 0.5);
  }

  .font-mono {
    font-family: monospace;
  }

  .checkbox-label {
    display: inline-flex;
    align-items: center;
    gap: 10px;
    font-size: 13px;
    font-weight: 600;
    color: #dfc28d;
    cursor: pointer;
  }

  .form-checkbox {
    width: 18px;
    height: 18px;
    accent-color: #8b5cf6;
    cursor: pointer;
  }

  .modal-actions {
    display: flex;
    justify-content: flex-end;
    gap: 12px;
    margin-top: 10px;
    padding-top: 14px;
    border-top: 1px solid rgba(255, 255, 255, 0.06);
  }

  .empty-state {
    grid-column: 1 / -1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 64px 20px;
    text-align: center;
    color: #6c687e;
  }

  .empty-icon {
    margin-bottom: 12px;
    opacity: 0.5;
  }

  :global(.spin) {
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    from {
      transform: rotate(0deg);
    }
    to {
      transform: rotate(360deg);
    }
  }

  @media (max-width: 600px) {
    .admin-page {
      padding: 16px;
    }
    .items-grid {
      grid-template-columns: 1fr;
    }
  }
</style>
