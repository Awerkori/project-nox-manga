<script lang="ts">
  /* eslint-disable */
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
    Layers,
    Eye,
    Check,
    ChevronDown,
    Sliders,
    ToggleLeft,
    ToggleRight
  } from '@lucide/svelte';
  import { page } from '$app/state';
  import UserAvatar from '$lib/components/UserAvatar.svelte';
  import { getNameColorInfo } from '$lib/name-colors';
  import { CURATED_BANNER_BACKGROUNDS } from '$lib/cosmetic-banners';

  let { data } = $props();

  let currentTab = $derived(page.url.searchParams.get('tab') || '');
  let search = $state('');
  let kindFilter = $state<string>('ALL');
  let statusFilter = $state<'ALL' | 'ACTIVE' | 'ARCHIVED'>('ALL');
  let notice = $state('');
  let noticeType = $state<'info' | 'success' | 'error'>('info');
  let busy = $state(false);

  $effect(() => {
    if (currentTab === 'cores') {
      kindFilter = 'NAME_COLOR';
    } else if (currentTab === 'titulos') {
      kindFilter = 'TITLE';
    } else if (currentTab === 'molduras') {
      kindFilter = 'AVATAR_FRAME';
    } else if (currentTab === 'banners') {
      kindFilter = 'COMMENT_BANNER';
    } else if (!currentTab || currentTab === 'resumo' || currentTab === 'todos') {
      kindFilter = 'ALL';
    }
  });

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

  // Color Variants state for Avatar Frames
  let formColorVariants = $state<Array<{ id: string; label: string; color: string }>>([]);
  let selectedPreviewVariantColor = $state<string | null>(null);

  // Name Color Engine state
  let formAnimEngine = $state<string>('nox-color-static');
  let formColorHex = $state<string>('#c084fc');
  let formGradientStops = $state<string>('#a855f7, #ec4899, #3b82f6, #a855f7');

  // Auto-slug & upload state
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

  function parseStyle(raw: string): Record<string, any> {
    try {
      return JSON.parse(raw);
    } catch {
      return {};
    }
  }

  // Real-time Preview Color info for Name Color modal preview
  let previewColorInfo = $derived.by(() => {
    if (formKind !== 'NAME_COLOR') return { className: '', style: '' };
    try {
      const parsed = JSON.parse(formStyleJson || '{}');
      const animClass = parsed.animationClass || formAnimEngine;
      const style =
        parsed.style ||
        (parsed.gradient
          ? `background-image: ${parsed.gradient};`
          : `color: ${parsed.color || formColorHex}; text-shadow: 0 0 8px ${parsed.color || formColorHex}66;`);
      return { className: animClass, style };
    } catch {
      return { className: formAnimEngine, style: `color: ${formColorHex};` };
    }
  });

  function syncVariantsJson() {
    try {
      const parsed = JSON.parse(formStyleJson || '{}');
      parsed.color_variants = formColorVariants;
      formStyleJson = JSON.stringify(parsed, null, 2);
    } catch {}
  }

  function addColorVariant() {
    const nextIdx = formColorVariants.length + 1;
    formColorVariants = [
      ...formColorVariants,
      {
        id: `variant_${nextIdx}`,
        label: `Variante ${nextIdx}`,
        color: '#38bdf8'
      }
    ];
    syncVariantsJson();
  }

  function removeColorVariant(idx: number) {
    formColorVariants = formColorVariants.filter((_, i) => i !== idx);
    syncVariantsJson();
  }

  function handleAnimEngineChange() {
    formIsAnimated = formAnimEngine !== 'nox-color-static';
    if (!formIsAnimated) {
      formStyleJson = JSON.stringify(
        {
          animationClass: 'nox-color-static',
          color: formColorHex,
          style: `color: ${formColorHex}; text-shadow: 0 0 8px ${formColorHex}66;`,
          isGradient: false
        },
        null,
        2
      );
    } else {
      let gradAngle = '90deg';
      if (formAnimEngine === 'nox-anim-grad-shift') gradAngle = '45deg';
      if (formAnimEngine === 'nox-anim-grad-flow') gradAngle = '135deg';

      formStyleJson = JSON.stringify(
        {
          animationClass: formAnimEngine,
          style: `background-image: linear-gradient(${gradAngle}, ${formGradientStops});`,
          isGradient: true
        },
        null,
        2
      );
    }
  }

  function handleStaticColorChange() {
    formIsAnimated = false;
    formStyleJson = JSON.stringify(
      {
        animationClass: 'nox-color-static',
        color: formColorHex,
        style: `color: ${formColorHex}; text-shadow: 0 0 8px ${formColorHex}66;`,
        isGradient: false
      },
      null,
      2
    );
  }

  function handleGradientStopsChange() {
    formIsAnimated = true;
    let gradAngle = '90deg';
    if (formAnimEngine === 'nox-anim-grad-shift') gradAngle = '45deg';
    if (formAnimEngine === 'nox-anim-grad-flow') gradAngle = '135deg';

    formStyleJson = JSON.stringify(
      {
        animationClass: formAnimEngine,
        style: `background-image: linear-gradient(${gradAngle}, ${formGradientStops});`,
        isGradient: true
      },
      null,
      2
    );
  }

  function applyColorPreset(preset: typeof COLOR_PRESETS[0]) {
    formAnimEngine = 'nox-anim-grad-flow';
    formIsAnimated = true;
    formStyleJson = JSON.stringify(
      {
        animationClass: 'nox-anim-grad-flow',
        gradient: preset.gradient,
        style: `background-image: ${preset.gradient};`,
        color: preset.color,
        isGradient: true
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

      if (result.isAnimated || file.name.toLowerCase().endsWith('.gif') || file.type === 'image/gif') {
        formIsAnimated = true;
      }

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
      const matchesKind =
        kindFilter === 'ALL' ||
        it.kind === kindFilter ||
        (kindFilter === 'COMMENT_BANNER' && it.kind === 'PROFILE_BANNER') ||
        (kindFilter === 'PROFILE_BANNER' && it.kind === 'COMMENT_BANNER');
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

  function openCreateModal() {
    editingItem = null;
    slugTouched = false;
    formId = '';
    formName = '';
    formDescription = '';
    formKind = kindFilter !== 'ALL' ? (kindFilter as any) : 'AVATAR_FRAME';
    formRarity = 'COMUM';
    formPriceXp = 300;
    formMinLevel = 1;
    formIsAnimated = formKind === 'AVATAR_FRAME';
    formStatus = 'ACTIVE';
    formOrderIndex = (data.items?.length || 0) + 1;
    formAssetUrl = '';
    formStyleJson = '{}';
    formColorVariants = formKind === 'AVATAR_FRAME' ? [
      { id: 'default', label: 'Padrão', color: '#a78bfa' }
    ] : [];
    selectedPreviewVariantColor = null;
    formAnimEngine = 'nox-color-static';
    formColorHex = '#a78bfa';
    formGradientStops = '#a78bfa, #38bdf8, #fbbf24';
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
    formKind = it.kind === 'PROFILE_BANNER' ? 'COMMENT_BANNER' : it.kind;
    formRarity = it.rarity || 'COMUM';
    formPriceXp = it.price_xp;
    formMinLevel = it.min_level;
    formIsAnimated = Boolean(it.is_animated);
    formStatus = it.status || (it.is_active ? 'ACTIVE' : 'ARCHIVED');
    formOrderIndex = it.order_index ?? 99;
    formAssetUrl = it.asset_url || '';
    formStyleJson = JSON.stringify(it.style_data || {}, null, 2);
    uploadError = '';
    selectedPreviewVariantColor = null;

    // Load color variants if frame
    const variants = it.color_variants || it.style_data?.color_variants || [];
    formColorVariants = Array.isArray(variants) ? variants.map((v: any) => ({ ...v })) : [];

    // Load animation engine if name color
    if (formKind === 'NAME_COLOR') {
      const parsed = it.style_data || {};
      const regInfo = getNameColorInfo(it.id);
      formAnimEngine = parsed.animationClass || regInfo.className || (it.is_animated ? 'nox-anim-grad-flow' : 'nox-color-static');
      formColorHex = parsed.color || regInfo.rawColor || '#c084fc';
      formIsAnimated = formAnimEngine !== 'nox-color-static';
    }

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
    const variants = it.color_variants || it.style_data?.color_variants || [];
    formColorVariants = Array.isArray(variants) ? variants.map((v: any) => ({ ...v })) : [];
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

    let parsedStyle: Record<string, any> = {};
    try {
      parsedStyle = JSON.parse(formStyleJson);
    } catch {
      notice = 'O campo Estilo (JSON) contém formato inválido.';
      noticeType = 'error';
      return;
    }

    // Attach color variants if Avatar Frame
    if (formKind === 'AVATAR_FRAME') {
      parsedStyle.color_variants = formColorVariants;
    } else if (formKind === 'NAME_COLOR') {
      parsedStyle.animationClass = formAnimEngine;
      if (!formIsAnimated) {
        parsedStyle.color = formColorHex;
        parsedStyle.style = `color: ${formColorHex}; text-shadow: 0 0 8px ${formColorHex}66;`;
        parsedStyle.isGradient = false;
      }
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
      notice = isNowActive ? `Item "${it.name}" reativado na Loja!` : `Item "${it.name}" desativado/arquivado da Loja.`;
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
        `Este item pertence ao inventário de ${it.owners_count} usuário(s). Por segurança de inventário, ele será arquivado e desativado da loja em vez de excluído para preservar os cosméticos dos leitores. Deseja arquivar?`
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

  <!-- Category Navigation Tabs -->
  <nav class="loja-tabs-nav" aria-label="Abas da Loja">
    <a href="/admin/loja" class="loja-tab-link" class:active={!currentTab || currentTab === 'resumo'}>
      <ShoppingBag size={15} />
      <span>Resumo</span>
    </a>
    <a href="/admin/loja?tab=molduras" class="loja-tab-link" class:active={currentTab === 'molduras'}>
      <Crown size={15} />
      <span>Molduras</span>
    </a>
    <a href="/admin/loja?tab=cores" class="loja-tab-link" class:active={currentTab === 'cores'}>
      <Palette size={15} />
      <span>Cores</span>
    </a>
    <a href="/admin/loja?tab=titulos" class="loja-tab-link" class:active={currentTab === 'titulos'}>
      <Tag size={15} />
      <span>Títulos</span>
    </a>
    <a href="/admin/loja?tab=banners" class="loja-tab-link" class:active={currentTab === 'banners'}>
      <ImageIcon size={15} />
      <span>Banners</span>
    </a>
  </nav>

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
        class:active={kindFilter === 'COMMENT_BANNER'}
        onclick={() => (kindFilter = 'COMMENT_BANNER')}
      >
        Banners ({data.items.filter((i: any) => i.kind === 'COMMENT_BANNER' || i.kind === 'PROFILE_BANNER').length})
      </button>
    </div>
  </div>

  <!-- Items Grid -->
  <div class="items-grid">
    {#each filteredItems as item (item.id)}
      {@const style = item.style_data || {}}
      {@const isArchived = !item.is_active || item.status === 'ARCHIVED'}
      {@const colorInfo = item.kind === 'NAME_COLOR' ? getNameColorInfo(item.id) : null}
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
              class="preview-color-text {colorInfo?.className || ''}"
              style={colorInfo?.style || (style.gradient ? `background: ${style.gradient}; -webkit-background-clip: text; -webkit-text-fill-color: transparent;` : `color: ${style.color || '#ffffff'}; text-shadow: ${style.textShadow || 'none'};`)}
            >
              ProjetoNox
            </span>
          {:else if item.kind === 'TITLE'}
            <span class="preview-title-badge" style="color: {style.color || '#dfc28d'}">
              <Crown size={12} />
              <span>{item.name}</span>
            </span>
          {:else if item.kind === 'COMMENT_BANNER' || item.kind === 'PROFILE_BANNER'}
            <div
              class="preview-comment-banner-box"
              style={item.asset_url ? `background-image: url(${item.asset_url}); background-size: cover; background-position: center;` : (CURATED_BANNER_BACKGROUNDS[item.id] ? `background: ${CURATED_BANNER_BACKGROUNDS[item.id]}; background-size: cover;` : (style.background ? `background: ${style.background};` : 'background: #181928;'))}
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
            {#if isArchived}
              <span class="status-badge-mini archived">Inativo</span>
            {:else}
              <span class="status-badge-mini active">Disponível</span>
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
            class:is-active-btn={!isArchived}
            onclick={() => toggleArchive(item)}
            title={isArchived ? 'Reativar cosmético na loja' : 'Desativar cosmético da loja'}
          >
            {#if isArchived}
              <RotateCcw size={14} />
              <span>Ativar</span>
            {:else}
              <Archive size={14} />
              <span>Desativar</span>
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
          <!-- 10. Live Preview Stage in Modal -->
          <div class="modal-preview-stage">
            <div class="preview-stage-header-row">
              <span class="preview-stage-label">PRÉVIA EM TEMPO REAL</span>
              {#if formIsAnimated}
                <span class="anim-glow-badge">✨ Efeito Animado Ativo</span>
              {:else}
                <span class="static-luxury-badge">💎 Estilo Estático Nobre</span>
              {/if}
            </div>

            {#if formKind === 'AVATAR_FRAME'}
              <div class="avatar-preview-box">
                <UserAvatar
                  avatarId={data.profile?.avatar_id}
                  frameId={formAssetUrl ? null : formId}
                  frameColor={selectedPreviewVariantColor}
                  frameUrl={formAssetUrl || null}
                  displayName={formName || 'ProjetoNox'}
                  size={84}
                />
                <div class="avatar-preview-meta">
                  <span class="avatar-preview-name">{formName || 'Moldura Cósmica'}</span>
                  <span class="avatar-preview-hint">
                    {formAssetUrl ? '✓ Renderizada via asset de imagem/GIF' : 'Moldura procedural com vetor SVG e keyframes'}
                  </span>
                  {#if formColorVariants.length > 0}
                    <div class="modal-preview-swatches">
                      <span class="swatch-label">Testar cor:</span>
                      {#each formColorVariants as variant}
                        <button
                          type="button"
                          class="preview-swatch-btn"
                          class:active={selectedPreviewVariantColor === variant.color || (!selectedPreviewVariantColor && variant.id === 'default')}
                          style="background-color: {variant.color};"
                          onclick={() => (selectedPreviewVariantColor = variant.color === 'default' ? null : variant.color)}
                          title="{variant.label} ({variant.color})"
                        ></button>
                      {/each}
                    </div>
                  {/if}
                </div>
              </div>

            {:else if formKind === 'COMMENT_BANNER'}
              <div
                class="modal-comment-banner-preview"
                style={formAssetUrl ? `background-image: url(${formAssetUrl}); background-size: cover; background-position: center;` : (CURATED_BANNER_BACKGROUNDS[formId] ? `background: ${CURATED_BANNER_BACKGROUNDS[formId]}; background-size: cover;` : (parseStyle(formStyleJson).background ? `background: ${parseStyle(formStyleJson).background};` : 'background: #181928;'))}
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
                  <span class="sample-label">Visualização na Loja / Perfil:</span>
                  <span
                    class="preview-color-text {previewColorInfo.className}"
                    style={previewColorInfo.style}
                  >
                    @{data.profile?.username || 'ProjetoNox'}
                  </span>
                </div>
                <div class="color-preview-sample reader">
                  <span class="sample-label">Visualização no Leitor / Comentários:</span>
                  <span
                    class="preview-reader-name {previewColorInfo.className}"
                    style={previewColorInfo.style}
                  >
                    Cap. 01 — @{data.profile?.username || 'ProjetoNox'}
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

          <!-- 5. Disponibilidade na Loja Switch -->
          <div class="availability-switch-card">
            <div class="switch-info">
              <span class="switch-title">Disponibilidade na Loja</span>
              <span class="switch-sub">
                {formStatus === 'ACTIVE' ? '✓ Ativo e visível para compra por leitores na Loja Cósmica' : '✗ Desativado / Oculto na Loja (inventários de compradores continuam protegidos)'}
              </span>
            </div>
            <button
              type="button"
              class="switch-toggle-btn"
              class:is-active={formStatus === 'ACTIVE'}
              onclick={() => (formStatus = formStatus === 'ACTIVE' ? 'ARCHIVED' : 'ACTIVE')}
            >
              {#if formStatus === 'ACTIVE'}
                <ToggleRight size={32} class="toggle-icon on" />
                <span class="toggle-text">Disponível</span>
              {:else}
                <ToggleLeft size={32} class="toggle-icon off" />
                <span class="toggle-text">Inativo</span>
              {/if}
            </button>
          </div>

          <!-- 1. Alterar Nome & ID -->
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

          <!-- 2. Alterar Descrição -->
          <div class="form-group">
            <label for="item-desc" class="form-label">Descrição Cosmética</label>
            <textarea
              id="item-desc"
              rows={2}
              class="form-textarea"
              bind:value={formDescription}
              placeholder="Explique o tema, lore e efeito visual do cosmético…"
            ></textarea>
          </div>

          <!-- Slot Kind & 4. Modificar Raridade -->
          <div class="form-row">
            <div class="form-group flex-1">
              <label for="item-kind" class="form-label">Categoria de Slot</label>
              <select id="item-kind" class="form-select" bind:value={formKind}>
                <option value="AVATAR_FRAME">Moldura de Avatar</option>
                <option value="NAME_COLOR">Cor de Nome</option>
                <option value="TITLE">Título Cósmico</option>
                <option value="COMMENT_BANNER">Banner de Comentário</option>
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

          <!-- 3. Modificar Preço em XP & Nível Mínimo -->
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

          <!-- 8. Modificar Variantes de Cor nas Molduras (color_variants) -->
          {#if formKind === 'AVATAR_FRAME'}
            <div class="color-variants-editor-section">
              <div class="section-header-row">
                <div>
                  <h4 class="section-title">Variantes de Cor da Moldura ({formColorVariants.length})</h4>
                  <p class="section-subtitle">Adicione ou ajuste paletas de cor para que o leitor personalize a moldura.</p>
                </div>
                <button type="button" class="btn-add-variant" onclick={addColorVariant}>
                  <Plus size={14} />
                  <span>Adicionar Cor</span>
                </button>
              </div>

              {#if formColorVariants.length === 0}
                <p class="empty-variants-note">Nenhuma variante configurada. A moldura usará sua paleta nativa.</p>
              {:else}
                <div class="variants-list">
                  {#each formColorVariants as variant, idx}
                    <div class="variant-item-row">
                      <input
                        type="color"
                        class="variant-color-picker"
                        bind:value={variant.color}
                        oninput={() => {
                          selectedPreviewVariantColor = variant.color;
                          syncVariantsJson();
                        }}
                        title="Seletor de cor"
                      />
                      <input
                        type="text"
                        class="form-input variant-color-hex font-mono"
                        bind:value={variant.color}
                        placeholder="#hex"
                        oninput={() => {
                          selectedPreviewVariantColor = variant.color;
                          syncVariantsJson();
                        }}
                      />
                      <input
                        type="text"
                        class="form-input variant-label"
                        bind:value={variant.label}
                        placeholder="Nome da variante (ex: Ouro Solar)"
                        oninput={syncVariantsJson}
                      />
                      <input
                        type="text"
                        class="form-input variant-id font-mono"
                        bind:value={variant.id}
                        placeholder="slug_id"
                        oninput={syncVariantsJson}
                      />
                      <button
                        type="button"
                        class="btn-remove-variant"
                        onclick={() => removeColorVariant(idx)}
                        title="Remover variante"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  {/each}
                </div>
              {/if}
            </div>
          {/if}

          <!-- 9. Selecionar Animações/Efeitos Suportados por Dropdown (NAME_COLOR) -->
          {#if formKind === 'NAME_COLOR'}
            <div class="name-color-editor-section">
              <div class="section-header-row">
                <div>
                  <h4 class="section-title">Motor Visual & Animação</h4>
                  <p class="section-subtitle">Selecione o efeito estético verificado sem código arbitrário.</p>
                </div>
              </div>

              <div class="form-row">
                <div class="form-group flex-1">
                  <label for="color-anim-engine" class="form-label">
                    Efeito / Motor Suportado
                  </label>
                  <select
                    id="color-anim-engine"
                    class="form-select"
                    bind:value={formAnimEngine}
                    onchange={handleAnimEngineChange}
                  >
                    <option value="nox-color-static">Estático (Sem animação - Luxo Nobre)</option>
                    <option value="nox-anim-grad-flow">Deslizamento Suave de Gradiente (Nebulosa / Fluxo Cósmico)</option>
                    <option value="nox-anim-shimmer">Reflexo Metálico Shimmer (Varredura de Luz Líquida)</option>
                    <option value="nox-anim-hologram">Iridescência Holográfica (Refração Perolada)</option>
                    <option value="nox-anim-glint">Glint Estelar Localizado (Ponto de Brilho Viajante)</option>
                    <option value="nox-anim-grad-shift">Deslocamento Angular Diagonal (Ondas 45°)</option>
                  </select>
                </div>

                {#if formAnimEngine === 'nox-color-static'}
                  <div class="form-group flex-1">
                    <label for="color-picker-static" class="form-label">Cor Sólida Nobre</label>
                    <div class="color-picker-input-wrap">
                      <input
                        type="color"
                        id="color-picker-static"
                        class="form-color-picker"
                        bind:value={formColorHex}
                        oninput={handleStaticColorChange}
                      />
                      <input
                        type="text"
                        class="form-input font-mono"
                        bind:value={formColorHex}
                        placeholder="#c084fc"
                        oninput={handleStaticColorChange}
                      />
                    </div>
                  </div>
                {:else}
                  <div class="form-group flex-1">
                    <label for="color-stops-input" class="form-label">Cores do Gradiente (Stops)</label>
                    <input
                      id="color-stops-input"
                      type="text"
                      class="form-input font-mono"
                      bind:value={formGradientStops}
                      placeholder="#a855f7, #ec4899, #3b82f6"
                      oninput={handleGradientStopsChange}
                    />
                  </div>
                {/if}
              </div>

              <!-- Presets Rápidos -->
              <div class="color-presets-section">
                <span class="presets-label">Gradientes Pré-configurados Rápidos:</span>
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
            </div>
          {/if}

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
                    <strong class="dropzone-text">Enviando e validando asset…</strong>
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
                    <span class="dropzone-sub">Suporta GIF animado, WebP, PNG e SVG</span>
                  </div>
                {/if}
              </label>
            </div>

            {#if uploadError}
              <p class="upload-error-msg">{uploadError}</p>
            {/if}
          </div>

          <!-- Collapsed Advanced Accordion -->
          <details class="advanced-accordion">
            <summary class="advanced-summary">
              <span class="summary-left">
                <Layers size={14} />
                <span>Configurações Técnicas Avançadas (JSON CSS & Ordem)</span>
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
                  <label for="item-asset" class="form-label">URL Direta do Asset</label>
                  <input
                    id="item-asset"
                    type="text"
                    class="form-input font-mono"
                    bind:value={formAssetUrl}
                    placeholder="/media/uuid ou https://..."
                  />
                </div>
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

  .loja-tabs-nav {
    display: flex;
    align-items: center;
    gap: 8px;
    padding-bottom: 14px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
    overflow-x: auto;
    scrollbar-width: thin;
  }

  .loja-tab-link {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 8px 14px;
    border-radius: 8px;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.06);
    color: #94a3b8;
    font-size: 13px;
    font-weight: 600;
    text-decoration: none;
    transition: all 0.15s ease;
    white-space: nowrap;
  }

  .loja-tab-link:hover {
    color: #f1f5f9;
    background: rgba(255, 255, 255, 0.06);
  }

  .loja-tab-link.active {
    color: #dfc28d;
    background: rgba(223, 194, 141, 0.12);
    border-color: rgba(223, 194, 141, 0.3);
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
    padding: 10px 16px;
    border-radius: 10px;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.1);
    color: #cbd5e1;
    font-size: 13.5px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .btn-secondary:hover:not(:disabled) {
    background: rgba(255, 255, 255, 0.08);
    color: #ffffff;
  }

  .notice-banner {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px 16px;
    border-radius: 8px;
    background: rgba(59, 130, 246, 0.15);
    border: 1px solid rgba(59, 130, 246, 0.3);
    color: #93c5fd;
    font-size: 13.5px;
  }

  .notice-banner.success {
    background: rgba(16, 185, 129, 0.15);
    border-color: rgba(16, 185, 129, 0.35);
    color: #6ee7b7;
  }

  .notice-banner.error {
    background: rgba(239, 68, 68, 0.15);
    border-color: rgba(239, 68, 68, 0.35);
    color: #fca5a5;
  }

  .btn-close-notice {
    background: none;
    border: none;
    color: currentColor;
    cursor: pointer;
    padding: 2px;
    opacity: 0.8;
  }

  .toolbar-card {
    display: flex;
    gap: 16px;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
    padding: 16px;
    border-radius: 12px;
    background: rgba(255, 255, 255, 0.02);
    border: 1px solid rgba(255, 255, 255, 0.06);
  }

  .search-box {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 14px;
    border-radius: 8px;
    background: rgba(0, 0, 0, 0.3);
    border: 1px solid rgba(255, 255, 255, 0.08);
    min-width: 280px;
  }

  .search-input {
    background: transparent;
    border: none;
    color: #ffffff;
    font-size: 13.5px;
    outline: none;
    width: 100%;
  }

  .search-icon {
    color: #64748b;
  }

  .filter-group {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }

  .filter-chip {
    padding: 6px 12px;
    border-radius: 8px;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.06);
    color: #94a3b8;
    font-size: 12.5px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .filter-chip:hover {
    color: #f1f5f9;
    background: rgba(255, 255, 255, 0.06);
  }

  .filter-chip.active {
    color: #dfc28d;
    background: rgba(223, 194, 141, 0.12);
    border-color: rgba(223, 194, 141, 0.3);
  }

  /* Grid */
  .items-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(290px, 1fr));
    gap: 16px;
  }

  .item-card {
    display: flex;
    flex-direction: column;
    border-radius: 14px;
    background: #0f1019;
    border: 1px solid rgba(255, 255, 255, 0.08);
    overflow: hidden;
    transition: all 0.2s ease;
  }

  .item-card:hover {
    border-color: rgba(223, 194, 141, 0.25);
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
  }

  .item-card.is-archived {
    opacity: 0.65;
    border-style: dashed;
    border-color: rgba(255, 255, 255, 0.15);
  }

  .item-preview-box {
    position: relative;
    height: 120px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: radial-gradient(circle at center, rgba(139, 92, 246, 0.08) 0%, rgba(9, 10, 15, 0.95) 100%);
    border-bottom: 1px solid rgba(255, 255, 255, 0.05);
    overflow: hidden;
  }

  .preview-badges-top {
    position: absolute;
    top: 8px;
    left: 8px;
    right: 8px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 4px;
    pointer-events: none;
  }

  .rarity-tag {
    font-size: 10px;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    padding: 2px 7px;
    border-radius: 4px;
  }

  .rarity-comum { background: rgba(148, 163, 184, 0.2); color: #cbd5e1; }
  .rarity-incomum { background: rgba(52, 211, 153, 0.2); color: #34d399; }
  .rarity-rara { background: rgba(56, 189, 248, 0.2); color: #38bdf8; }
  .rarity-epica { background: rgba(168, 85, 247, 0.2); color: #c084fc; }
  .rarity-lendaria { background: rgba(251, 191, 36, 0.2); color: #fbbf24; }
  .rarity-mitica { background: rgba(244, 63, 94, 0.2); color: #f43f5e; }

  .anim-tag {
    font-size: 9.5px;
    font-weight: 700;
    padding: 2px 6px;
    border-radius: 4px;
    background: rgba(168, 85, 247, 0.25);
    color: #e9d5ff;
    border: 1px solid rgba(168, 85, 247, 0.4);
  }

  .status-badge-mini {
    font-size: 9.5px;
    font-weight: 700;
    padding: 2px 6px;
    border-radius: 4px;
  }

  .status-badge-mini.active {
    background: rgba(16, 185, 129, 0.2);
    color: #6ee7b7;
    border: 1px solid rgba(16, 185, 129, 0.35);
  }

  .status-badge-mini.archived {
    background: rgba(148, 163, 184, 0.2);
    color: #94a3b8;
    border: 1px solid rgba(148, 163, 184, 0.35);
  }

  .preview-color-text {
    font-size: 16px;
    font-weight: 800;
    letter-spacing: -0.01em;
  }

  .preview-title-badge {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 4px 10px;
    border-radius: 6px;
    font-size: 12px;
    font-weight: 700;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.1);
  }

  .preview-comment-banner-box {
    width: 90%;
    height: 70px;
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    font-size: 11px;
    font-weight: 700;
    color: #ffffff;
    text-shadow: 0 1px 4px rgba(0,0,0,0.8);
    box-shadow: inset 0 0 12px rgba(0,0,0,0.5);
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
    justify-content: space-between;
    align-items: baseline;
    gap: 8px;
  }

  .item-name {
    font-size: 14.5px;
    font-weight: 700;
    color: #ffffff;
    margin: 0;
  }

  .item-id {
    font-size: 10.5px;
    color: #64748b;
    font-family: monospace;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 100px;
  }

  .item-desc {
    font-size: 12px;
    color: #8c899e;
    line-height: 1.4;
    margin: 0;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  .item-stats-row {
    display: flex;
    gap: 8px;
    margin-top: auto;
    padding-top: 6px;
  }

  .stat-pill {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 3px 8px;
    border-radius: 6px;
    font-size: 11px;
    font-weight: 600;
    background: rgba(255, 255, 255, 0.04);
    color: #cbd5e1;
  }

  .stat-pill.xp {
    color: #fbbf24;
    background: rgba(251, 191, 36, 0.1);
  }

  .stat-pill.lvl {
    color: #38bdf8;
    background: rgba(56, 189, 248, 0.1);
  }

  .stat-pill.owners {
    color: #94a3b8;
  }

  .item-card-footer {
    display: flex;
    align-items: center;
    padding: 8px 12px;
    background: rgba(0, 0, 0, 0.2);
    border-top: 1px solid rgba(255, 255, 255, 0.05);
    gap: 6px;
  }

  .btn-card-action {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 6px 10px;
    border-radius: 6px;
    font-size: 11.5px;
    font-weight: 600;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.08);
    color: #cbd5e1;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .btn-card-action:hover {
    background: rgba(255, 255, 255, 0.08);
    color: #ffffff;
  }

  .btn-card-action.edit {
    flex: 1;
    justify-content: center;
    background: rgba(139, 92, 246, 0.12);
    border-color: rgba(139, 92, 246, 0.3);
    color: #c084fc;
  }

  .btn-card-action.edit:hover {
    background: rgba(139, 92, 246, 0.22);
    color: #ffffff;
  }

  .btn-card-action.archive.is-active-btn {
    color: #94a3b8;
  }

  .btn-card-action.archive:hover {
    color: #fbbf24;
    border-color: rgba(251, 191, 36, 0.3);
  }

  .btn-card-action.delete:hover {
    color: #ef4444;
    border-color: rgba(239, 68, 68, 0.3);
  }

  .empty-state {
    grid-column: 1 / -1;
    text-align: center;
    padding: 48px;
    background: rgba(255, 255, 255, 0.02);
    border-radius: 12px;
    border: 1px dashed rgba(255, 255, 255, 0.1);
  }

  .empty-icon {
    color: #64748b;
    margin-bottom: 12px;
  }

  .empty-text {
    font-size: 14px;
    color: #94a3b8;
    margin: 0;
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
    z-index: 1000;
    padding: 20px;
    overflow-y: auto;
  }

  .modal-card {
    background: #0f1019;
    border: 1px solid rgba(223, 194, 141, 0.25);
    border-radius: 16px;
    width: 100%;
    max-width: 680px;
    max-height: 90vh;
    overflow-y: auto;
    box-shadow: 0 16px 48px rgba(0, 0, 0, 0.7);
    display: flex;
    flex-direction: column;
  }

  .modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 20px 24px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  }

  .modal-title {
    font-size: 18px;
    font-weight: 700;
    color: #ffffff;
    margin: 0;
  }

  .btn-close-modal {
    background: none;
    border: none;
    color: #94a3b8;
    cursor: pointer;
    padding: 4px;
    border-radius: 6px;
    transition: all 0.15s ease;
  }

  .btn-close-modal:hover {
    color: #ffffff;
    background: rgba(255, 255, 255, 0.06);
  }

  .modal-form {
    padding: 24px;
    display: flex;
    flex-direction: column;
    gap: 18px;
  }

  /* Live Preview Stage */
  .modal-preview-stage {
    padding: 18px;
    border-radius: 12px;
    background: radial-gradient(circle at center, rgba(139, 92, 246, 0.12) 0%, rgba(15, 16, 25, 0.95) 100%);
    border: 1px solid rgba(139, 92, 246, 0.25);
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .preview-stage-header-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .preview-stage-label {
    font-size: 10.5px;
    font-weight: 800;
    letter-spacing: 0.1em;
    color: #dfc28d;
    text-transform: uppercase;
  }

  .anim-glow-badge {
    font-size: 10.5px;
    font-weight: 700;
    padding: 3px 8px;
    border-radius: 6px;
    background: rgba(168, 85, 247, 0.2);
    color: #d8b4fe;
    border: 1px solid rgba(168, 85, 247, 0.35);
  }

  .static-luxury-badge {
    font-size: 10.5px;
    font-weight: 700;
    padding: 3px 8px;
    border-radius: 6px;
    background: rgba(56, 189, 248, 0.15);
    color: #7dd3fc;
    border: 1px solid rgba(56, 189, 248, 0.3);
  }

  .avatar-preview-box {
    display: flex;
    align-items: center;
    gap: 18px;
    padding: 10px 0;
  }

  .avatar-preview-meta {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .avatar-preview-name {
    font-size: 15px;
    font-weight: 700;
    color: #ffffff;
  }

  .avatar-preview-hint {
    font-size: 11.5px;
    color: #94a3b8;
  }

  .modal-preview-swatches {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-top: 6px;
  }

  .swatch-label {
    font-size: 11px;
    color: #cbd5e1;
    font-weight: 600;
  }

  .preview-swatch-btn {
    width: 20px;
    height: 20px;
    border-radius: 50%;
    border: 2px solid transparent;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .preview-swatch-btn.active {
    border-color: #ffffff;
    transform: scale(1.15);
    box-shadow: 0 0 8px rgba(255, 255, 255, 0.5);
  }

  .modal-color-preview-group {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 8px 0;
  }

  .color-preview-sample {
    display: flex;
    align-items: baseline;
    gap: 12px;
  }

  .sample-label {
    font-size: 11px;
    font-weight: 600;
    color: #94a3b8;
    min-width: 175px;
  }

  .modal-comment-banner-preview {
    border-radius: 10px;
    overflow: hidden;
    padding: 14px;
  }

  .comment-preview-glass {
    display: flex;
    gap: 10px;
    background: rgba(15, 16, 25, 0.85);
    backdrop-filter: blur(8px);
    border-radius: 8px;
    padding: 10px 14px;
    border: 1px solid rgba(255, 255, 255, 0.08);
  }

  .comment-preview-content {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .comment-preview-user-row {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 12.5px;
    color: #ffffff;
  }

  .comment-tag {
    font-size: 9px;
    font-weight: 800;
    padding: 1px 5px;
    border-radius: 4px;
    background: #eab308;
    color: #000;
  }

  .comment-preview-text {
    font-size: 12px;
    color: #cbd5e1;
    margin: 0;
  }

  .modal-title-preview-box {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    padding: 12px;
  }

  .title-preview-sub {
    font-size: 11.5px;
    color: #94a3b8;
  }

  /* Availability Switch Card */
  .availability-switch-card {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px 16px;
    border-radius: 10px;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.08);
  }

  .switch-info {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .switch-title {
    font-size: 13.5px;
    font-weight: 700;
    color: #ffffff;
  }

  .switch-sub {
    font-size: 11.5px;
    color: #94a3b8;
  }

  .switch-toggle-btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 6px 12px;
    border-radius: 8px;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.1);
    color: #94a3b8;
    cursor: pointer;
    font-size: 12.5px;
    font-weight: 700;
    transition: all 0.2s ease;
  }

  .switch-toggle-btn.is-active {
    background: rgba(16, 185, 129, 0.15);
    border-color: rgba(16, 185, 129, 0.4);
    color: #6ee7b7;
  }

  .toggle-icon.on {
    color: #10b981;
  }

  .toggle-icon.off {
    color: #64748b;
  }

  /* Form Elements */
  .form-row {
    display: flex;
    gap: 14px;
    flex-wrap: wrap;
  }

  .form-group {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .flex-1 {
    flex: 1;
    min-width: 200px;
  }

  .form-label {
    font-size: 12px;
    font-weight: 600;
    color: #cbd5e1;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .auto-slug-badge {
    font-size: 10px;
    color: #38bdf8;
    font-weight: 700;
  }

  .form-input,
  .form-select,
  .form-textarea {
    padding: 9px 12px;
    border-radius: 8px;
    background: rgba(0, 0, 0, 0.35);
    border: 1px solid rgba(255, 255, 255, 0.1);
    color: #ffffff;
    font-size: 13.5px;
    outline: none;
    transition: border-color 0.15s ease;
  }

  .form-input:focus,
  .form-select:focus,
  .form-textarea:focus {
    border-color: #8b5cf6;
  }

  .form-textarea {
    resize: vertical;
  }

  .font-mono {
    font-family: monospace;
    font-size: 12.5px;
  }

  /* Color Variants Editor */
  .color-variants-editor-section {
    padding: 14px;
    border-radius: 10px;
    background: rgba(255, 255, 255, 0.02);
    border: 1px solid rgba(255, 255, 255, 0.08);
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .section-header-row {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 10px;
  }

  .section-title {
    font-size: 13.5px;
    font-weight: 700;
    color: #ffffff;
    margin: 0;
  }

  .section-subtitle {
    font-size: 11.5px;
    color: #94a3b8;
    margin: 2px 0 0;
  }

  .btn-add-variant {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 6px 10px;
    border-radius: 6px;
    background: rgba(139, 92, 246, 0.15);
    border: 1px solid rgba(139, 92, 246, 0.35);
    color: #c084fc;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.15s ease;
    white-space: nowrap;
  }

  .btn-add-variant:hover {
    background: rgba(139, 92, 246, 0.25);
    color: #ffffff;
  }

  .variants-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .variant-item-row {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .variant-color-picker {
    width: 34px;
    height: 34px;
    border-radius: 6px;
    border: none;
    cursor: pointer;
    background: transparent;
    padding: 0;
  }

  .variant-color-hex {
    width: 85px;
  }

  .variant-label {
    flex: 2;
  }

  .variant-id {
    flex: 1;
  }

  .btn-remove-variant {
    background: rgba(239, 68, 68, 0.1);
    border: 1px solid rgba(239, 68, 68, 0.25);
    color: #f87171;
    border-radius: 6px;
    padding: 7px;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .btn-remove-variant:hover {
    background: rgba(239, 68, 68, 0.25);
    color: #ffffff;
  }

  .empty-variants-note {
    font-size: 12px;
    color: #64748b;
    margin: 4px 0;
    font-style: italic;
  }

  /* Name Color Editor Section */
  .name-color-editor-section {
    padding: 14px;
    border-radius: 10px;
    background: rgba(255, 255, 255, 0.02);
    border: 1px solid rgba(255, 255, 255, 0.08);
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .color-picker-input-wrap {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .form-color-picker {
    width: 36px;
    height: 36px;
    border-radius: 6px;
    border: none;
    cursor: pointer;
    background: transparent;
    padding: 0;
  }

  .color-presets-section {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .presets-label {
    font-size: 11px;
    color: #94a3b8;
    font-weight: 600;
  }

  .preset-chips-wrap {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
  }

  .preset-chip {
    padding: 4px 10px;
    border-radius: 6px;
    border: none;
    color: #ffffff;
    font-size: 11px;
    font-weight: 700;
    text-shadow: 0 1px 3px rgba(0,0,0,0.8);
    cursor: pointer;
    transition: transform 0.15s ease;
  }

  .preset-chip:hover {
    transform: translateY(-1px);
    box-shadow: 0 3px 8px rgba(0,0,0,0.4);
  }

  /* Uploader */
  .uploader-box {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .uploader-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .btn-clear-asset {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    background: none;
    border: none;
    color: #ef4444;
    font-size: 11px;
    cursor: pointer;
  }

  .dropzone-label {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 16px;
    border-radius: 8px;
    border: 1px dashed rgba(255, 255, 255, 0.2);
    background: rgba(0, 0, 0, 0.25);
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .dropzone-label:hover {
    border-color: #8b5cf6;
    background: rgba(139, 92, 246, 0.05);
  }

  .dropzone-icon {
    color: #8b5cf6;
  }

  .dropzone-icon.success {
    color: #10b981;
  }

  .dropzone-text-group {
    display: flex;
    flex-direction: column;
    gap: 1px;
  }

  .dropzone-text {
    font-size: 12.5px;
    color: #ffffff;
  }

  .dropzone-sub {
    font-size: 11px;
    color: #64748b;
  }

  .btn-replace-pill {
    margin-left: auto;
    font-size: 11px;
    padding: 3px 8px;
    border-radius: 4px;
    background: rgba(255, 255, 255, 0.1);
    color: #ffffff;
  }

  .upload-error-msg {
    font-size: 11.5px;
    color: #ef4444;
    margin: 2px 0 0;
  }

  /* Accordion */
  .advanced-accordion {
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: 8px;
    overflow: hidden;
  }

  .advanced-summary {
    padding: 10px 14px;
    background: rgba(255, 255, 255, 0.02);
    cursor: pointer;
    font-size: 12px;
    font-weight: 600;
    color: #94a3b8;
  }

  .summary-left {
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }

  .advanced-body {
    padding: 14px;
    display: flex;
    flex-direction: column;
    gap: 12px;
    border-top: 1px solid rgba(255, 255, 255, 0.06);
  }

  .checkbox-label {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    font-size: 12.5px;
    color: #cbd5e1;
    cursor: pointer;
  }

  .form-checkbox {
    width: 15px;
    height: 15px;
    accent-color: #8b5cf6;
  }

  .modal-actions {
    display: flex;
    justify-content: flex-end;
    gap: 10px;
    padding-top: 10px;
    border-top: 1px solid rgba(255, 255, 255, 0.06);
  }

  .spin {
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
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
</style>
