<script lang="ts">
  import {
    Sparkles,
    ShoppingBag,
    Check,
    Lock,
    Shield,
    Palette,
    Image as ImageIcon,
    Tag,
    AlertCircle,
    CheckCircle2,
    Crown,
    X,
    Eye,
    ArrowUpDown,
    Filter,
    MessageSquare,
    BookOpen
  } from '@lucide/svelte';
  import { invalidateAll } from '$app/navigation';
  import UserAvatar from '$lib/components/UserAvatar.svelte';

  let { data } = $props();

  let activeTab = $state<'ALL' | 'AVATAR_FRAME' | 'NAME_COLOR' | 'PROFILE_BANNER' | 'TITLE'>('ALL');
  let activeRarity = $state<'ALL' | 'COMUM' | 'INCOMUM' | 'RARA' | 'EPICA' | 'LENDARIA' | 'MITICA'>('ALL');
  let sortBy = $state<'relevance' | 'price_asc' | 'price_desc' | 'level'>('relevance');

  let busyItemId = $state<string | null>(null);
  let feedbackMessage = $state<{ type: 'success' | 'error'; text: string } | null>(null);
  let selectedModalItem = $state<any | null>(null);

  // Live preview states in hero
  let previewFrame = $state<string | null>(null);
  let previewColor = $state<string | null>(null);
  let previewTitle = $state<string | null>(null);

  let currentXp = $derived(data.profile?.xp ?? 0);
  let userLevel = $derived(Math.floor(Math.sqrt(1 + currentXp / 50)));

  let equippedFrame = $derived(data.profile?.frame_id ?? null);
  let equippedColor = $derived(data.profile?.name_color ?? null);
  let equippedTitle = $derived(data.profile?.title_id ?? null);
  let equippedBanner = $derived(data.profile?.equipped_banner_id ?? null);

  let inventorySet = $derived(new Set(data.inventory || []));

  const RARITY_CONFIG: Record<string, { label: string; color: string; bg: string; border: string }> = {
    COMUM: { label: 'Comum', color: '#94a3b8', bg: 'rgba(148, 163, 184, 0.12)', border: 'rgba(148, 163, 184, 0.3)' },
    INCOMUM: { label: 'Incomum', color: '#10b981', bg: 'rgba(16, 185, 129, 0.12)', border: 'rgba(16, 185, 129, 0.35)' },
    RARA: { label: 'Rara', color: '#38bdf8', bg: 'rgba(56, 189, 248, 0.12)', border: 'rgba(56, 189, 248, 0.35)' },
    EPICA: { label: 'Épica', color: '#c084fc', bg: 'rgba(192, 132, 252, 0.12)', border: 'rgba(192, 132, 252, 0.35)' },
    LENDARIA: { label: 'Lendária', color: '#fbbf24', bg: 'rgba(251, 191, 36, 0.12)', border: 'rgba(251, 191, 36, 0.35)' },
    MITICA: { label: 'Mítica', color: '#f43f5e', bg: 'rgba(244, 63, 94, 0.15)', border: 'rgba(244, 63, 94, 0.45)' }
  };

  let filteredItems = $derived(
    (data.items || [])
      .filter((item: any) => {
        if (activeTab !== 'ALL' && item.kind !== activeTab) return false;
        if (activeRarity !== 'ALL' && (item.rarity || 'COMUM') !== activeRarity) return false;
        return true;
      })
      .sort((a: any, b: any) => {
        if (sortBy === 'price_asc') return a.price_xp - b.price_xp;
        if (sortBy === 'price_desc') return b.price_xp - a.price_xp;
        if (sortBy === 'level') return (a.min_level || 1) - (b.min_level || 1);
        return (a.order_index ?? 99) - (b.order_index ?? 99);
      })
  );

  function formatXp(n: number = 0) {
    return new Intl.NumberFormat('pt-BR').format(n);
  }

  function showToast(text: string, type: 'success' | 'error' = 'success') {
    feedbackMessage = { text, type };
    setTimeout(() => {
      if (feedbackMessage?.text === text) feedbackMessage = null;
    }, 4000);
  }

  function getStyle(item: any): Record<string, any> {
    return typeof item.style_data === 'object' && item.style_data !== null
      ? (item.style_data as Record<string, any>)
      : {};
  }

  function checkEquipped(item: any): boolean {
    if (!item) return false;
    const style = getStyle(item);
    if (item.kind === 'AVATAR_FRAME') return equippedFrame === item.id;
    if (item.kind === 'NAME_COLOR') return equippedColor === (style.color || style.backgroundImage);
    if (item.kind === 'TITLE') return equippedTitle === item.name;
    if (item.kind === 'PROFILE_BANNER') return equippedBanner === item.id;
    return false;
  }

  async function handlePurchase(item: any) {
    if (!data.profile) {
      window.location.href = '/entrar';
      return;
    }
    if (currentXp < item.price_xp) {
      showToast('XP insuficiente para adquirir este cosmético.', 'error');
      return;
    }
    if (userLevel < item.min_level) {
      showToast(`Você precisa atingir o Nível ${item.min_level} para desbloquear este item.`, 'error');
      return;
    }

    busyItemId = item.id;
    try {
      const res = await fetch('/api/shop/purchase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemId: item.id })
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.message || 'Falha na compra.');

      showToast(`Você adquiriu "${item.name}" com sucesso!`, 'success');
      await invalidateAll();
    } catch (e: any) {
      showToast(e.message || 'Erro ao processar compra.', 'error');
    } finally {
      busyItemId = null;
    }
  }

  async function handleEquip(item: any, equip: boolean = true) {
    if (!data.profile) return;
    busyItemId = item.id;
    try {
      const res = await fetch('/api/shop/equip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kind: item.kind,
          itemId: equip ? item.id : ''
        })
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.message || 'Falha ao equipar cosmético.');

      showToast(equip ? `"${item.name}" equipado!` : `"${item.name}" desequipado.`, 'success');
      await invalidateAll();
    } catch (e: any) {
      showToast(e.message || 'Erro ao equipar item.', 'error');
    } finally {
      busyItemId = null;
    }
  }

  function openPreviewModal(item: any) {
    selectedModalItem = item;
  }

  function closePreviewModal() {
    selectedModalItem = null;
  }
</script>

<svelte:head>
  <title>Loja Cósmica & Cosméticos | Project Nox</title>
  <meta
    name="description"
    content="Personalize seu perfil no Project Nox com molduras animadas, cores de nome exclusivas, títulos cósmicos e banners de alta definição."
  />
</svelte:head>

<div class="shop-page">
  <div class="shop-container">
    <!-- Feedback Toast -->
    {#if feedbackMessage}
      <aside class="shop-toast {feedbackMessage.type}">
        {#if feedbackMessage.type === 'success'}
          <CheckCircle2 size={18} />
        {:else}
          <AlertCircle size={18} />
        {/if}
        <span>{feedbackMessage.text}</span>
      </aside>
    {/if}

    <!-- Shop Hero -->
    <header class="shop-hero">
      <div class="hero-left">
        <div class="hero-tag">
          <Sparkles size={14} />
          <span>Economia Unificada Nox</span>
        </div>
        <h1 class="shop-title">Loja Cósmica</h1>
        <p class="shop-desc">
          Troque o XP acumulado durante suas leituras por molduras animadas estilo Discord, banners de alta
          definição, títulos honorários e cores dinâmicas para seu perfil e comentários.
        </p>

        <!-- Balance display -->
        <div class="balance-card">
          <div class="balance-item">
            <span class="balance-label">Seu Saldo Atual</span>
            <div class="xp-val-wrap">
              <Sparkles size={20} class="xp-icon" />
              <span class="xp-amount">{formatXp(currentXp)} XP</span>
            </div>
          </div>
          <div class="balance-divider"></div>
          <div class="balance-item">
            <span class="balance-label">Nível de Leitor</span>
            <div class="lvl-val-wrap">
              <Crown size={18} class="lvl-icon" />
              <span class="lvl-amount">Nível {userLevel}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Live Identity Preview -->
      <aside class="hero-preview-box">
        <span class="preview-title">Sua Identidade Atual</span>
        <div class="preview-avatar-wrap">
          <UserAvatar
            avatarId={data.profile?.avatar_id}
            frameId={previewFrame || equippedFrame}
            displayName={data.profile?.display_name || data.profile?.username || 'Leitor'}
            size={88}
          />
        </div>
        <div class="preview-meta">
          <span
            class="preview-name"
            style={(previewColor || equippedColor) ? `color: ${previewColor || equippedColor}` : ''}
          >
            {data.profile?.display_name || data.profile?.username || 'Visitante Nox'}
          </span>
          {#if previewTitle || equippedTitle}
            <span class="preview-title-badge">{previewTitle || equippedTitle}</span>
          {/if}
        </div>
      </aside>
    </header>

    <!-- Categories Bar -->
    <nav class="categories-bar" aria-label="Categorias da Loja">
      <button
        type="button"
        class="cat-btn"
        class:active={activeTab === 'ALL'}
        onclick={() => (activeTab = 'ALL')}
      >
        <ShoppingBag size={16} />
        <span>Todos os Itens</span>
      </button>

      <button
        type="button"
        class="cat-btn"
        class:active={activeTab === 'AVATAR_FRAME'}
        onclick={() => (activeTab = 'AVATAR_FRAME')}
      >
        <Shield size={16} />
        <span>Molduras de Avatar</span>
      </button>

      <button
        type="button"
        class="cat-btn"
        class:active={activeTab === 'NAME_COLOR'}
        onclick={() => (activeTab = 'NAME_COLOR')}
      >
        <Palette size={16} />
        <span>Cores de Nome</span>
      </button>

      <button
        type="button"
        class="cat-btn"
        class:active={activeTab === 'TITLE'}
        onclick={() => (activeTab = 'TITLE')}
      >
        <Tag size={16} />
        <span>Títulos Cósmicos</span>
      </button>

      <button
        type="button"
        class="cat-btn"
        class:active={activeTab === 'PROFILE_BANNER'}
        onclick={() => (activeTab = 'PROFILE_BANNER')}
      >
        <ImageIcon size={16} />
        <span>Banners</span>
      </button>
    </nav>

    <!-- Controls Bar: Rarity Filters & Sort Order -->
    <section class="controls-bar">
      <div class="rarity-filters">
        <span class="filter-label">
          <Filter size={14} />
          <span>Raridade:</span>
        </span>
        <div class="rarity-pill-group">
          <button
            type="button"
            class="rarity-pill"
            class:active={activeRarity === 'ALL'}
            onclick={() => (activeRarity = 'ALL')}
          >
            Todas
          </button>
          {#each Object.entries(RARITY_CONFIG) as [rarityKey, conf]}
            <button
              type="button"
              class="rarity-pill"
              class:active={activeRarity === rarityKey}
              style={activeRarity === rarityKey ? `border-color: ${conf.color}; color: ${conf.color}; background: ${conf.bg};` : ''}
              onclick={() => (activeRarity = rarityKey as any)}
            >
              {conf.label}
            </button>
          {/each}
        </div>
      </div>

      <div class="sort-wrap">
        <label for="sort-select" class="sort-label">
          <ArrowUpDown size={14} />
          <span>Ordenar:</span>
        </label>
        <select id="sort-select" bind:value={sortBy} class="sort-select">
          <option value="relevance">Relevância / Padrão</option>
          <option value="price_asc">Menor Preço</option>
          <option value="price_desc">Maior Preço</option>
          <option value="level">Nível Requerido</option>
        </select>
      </div>
    </section>

    <!-- Items Grid -->
    <main class="items-grid">
      {#if filteredItems.length === 0}
        <div class="empty-shop">
          <ShoppingBag size={42} class="empty-icon" />
          <h3 class="empty-title">Nenhum cosmético encontrado</h3>
          <p class="empty-desc">Tente alterar os filtros de categoria ou raridade acima.</p>
        </div>
      {:else}
        {#each filteredItems as item (item.id)}
          {@const style = getStyle(item)}
          {@const isOwned = inventorySet.has(item.id)}
          {@const isEquipped = checkEquipped(item)}
          {@const canAfford = currentXp >= item.price_xp}
          {@const meetsLevel = userLevel >= (item.min_level || 1)}
          {@const isBusy = busyItemId === item.id}
          {@const rarityConf = RARITY_CONFIG[item.rarity || 'COMUM'] || RARITY_CONFIG.COMUM}

          <article
            class="shop-card"
            class:owned={isOwned}
            class:equipped={isEquipped}
            class:title-card={item.kind === 'TITLE'}
            style="--rarity-border: {rarityConf.border}; --rarity-color: {rarityConf.color};"
          >
            <!-- Card Visual Stage -->
            <button
              type="button"
              class="card-visual-clickable"
              onclick={() => openPreviewModal(item)}
              aria-label="Visualizar {item.name}"
            >
              <div class="card-visual" class:title-visual={item.kind === 'TITLE'}>
                <!-- Rarity Chip -->
                <span
                  class="rarity-chip"
                  style="color: {rarityConf.color}; background: {rarityConf.bg}; border-color: {rarityConf.border};"
                >
                  {rarityConf.label}
                </span>

                {#if item.kind === 'AVATAR_FRAME'}
                  <div class="frame-demo-wrap">
                    <UserAvatar
                      avatarId={data.profile?.avatar_id}
                      frameId={item.id}
                      displayName={item.name}
                      size={72}
                    />
                  </div>
                {:else if item.kind === 'NAME_COLOR'}
                  <div class="color-demo-wrap">
                    <span
                      class="color-demo-text"
                      style={style.backgroundImage
                        ? `background-image: ${style.backgroundImage}; -webkit-background-clip: text; -webkit-text-fill-color: transparent;`
                        : `color: ${style.color || '#ffffff'}; text-shadow: ${style.textShadow || 'none'};`}
                    >
                      {data.profile?.username || 'ProjetoNox'}
                    </span>
                  </div>
                {:else if item.kind === 'TITLE'}
                  <div class="title-demo-wrap">
                    <span class="title-demo-badge">
                      <Crown size={13} />
                      <span>{item.name}</span>
                    </span>
                  </div>
                {:else if item.kind === 'PROFILE_BANNER'}
                  <div
                    class="banner-demo-wrap"
                    style={style.background ? `background: ${style.background};` : 'background: #1e1b4b;'}
                  >
                    <span class="banner-label">{item.name}</span>
                  </div>
                {/if}

                {#if item.is_animated}
                  <span class="animated-chip">Animado</span>
                {/if}

                <!-- Quick preview hover overlay -->
                <div class="hover-preview-hint">
                  <Eye size={14} />
                  <span>Ver Detalhes</span>
                </div>
              </div>
            </button>

            <!-- Card Content -->
            <div class="card-content">
              <div class="item-header">
                <h3 class="item-name">{item.name}</h3>
                {#if isEquipped}
                  <span class="status-pill equipped">Equipado</span>
                {:else if isOwned}
                  <span class="status-pill owned">Adquirido</span>
                {/if}
              </div>

              <p class="item-desc">{item.description}</p>

              <div class="item-meta">
                <div class="xp-price" class:cant-afford={!isOwned && !canAfford}>
                  <Sparkles size={14} />
                  <span>{isOwned ? 'No Inventário' : `${formatXp(item.price_xp)} XP`}</span>
                </div>

                {#if item.min_level > 1}
                  <span class="lvl-req" class:locked={userLevel < item.min_level}>
                    {userLevel < item.min_level ? '🔒 ' : ''}Nv. {item.min_level}
                  </span>
                {/if}
              </div>

              <!-- Action Buttons -->
              <div class="card-actions">
                {#if isEquipped}
                  <button
                    type="button"
                    class="btn-action unequip"
                    disabled={isBusy}
                    onclick={() => handleEquip(item, false)}
                  >
                    {isBusy ? 'Salvando...' : 'Desequipar'}
                  </button>
                {:else if isOwned}
                  <button
                    type="button"
                    class="btn-action equip"
                    disabled={isBusy}
                    onclick={() => handleEquip(item, true)}
                  >
                    <Check size={14} />
                    <span>{isBusy ? 'Salvando...' : 'Equipar'}</span>
                  </button>
                {:else}
                  <button
                    type="button"
                    class="btn-action buy"
                    disabled={!canAfford || !meetsLevel || isBusy}
                    onclick={() => handlePurchase(item)}
                  >
                    {#if !meetsLevel}
                      <Lock size={14} />
                      <span>Nível {item.min_level} Necessário</span>
                    {:else if !canAfford}
                      <span>Faltam {formatXp(item.price_xp - currentXp)} XP</span>
                    {:else}
                      <Sparkles size={14} />
                      <span>{isBusy ? 'Comprando...' : `Adquirir por ${formatXp(item.price_xp)} XP`}</span>
                    {/if}
                  </button>
                {/if}
              </div>
            </div>
          </article>
        {/each}
      {/if}
    </main>

    <!-- Expanded Preview Modal -->
    {#if selectedModalItem}
      {@const item = selectedModalItem}
      {@const style = getStyle(item)}
      {@const isOwned = inventorySet.has(item.id)}
      {@const isEquipped = checkEquipped(item)}
      {@const canAfford = currentXp >= item.price_xp}
      {@const meetsLevel = userLevel >= (item.min_level || 1)}
      {@const rarityConf = RARITY_CONFIG[item.rarity || 'COMUM'] || RARITY_CONFIG.COMUM}
      {@const remainingXp = currentXp - item.price_xp}

      <div class="modal-backdrop" onclick={closePreviewModal} role="presentation">
        <!-- Stop click propagation on modal card -->
        <div class="modal-card" onclick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
          <!-- Close Button -->
          <button type="button" class="btn-modal-close" onclick={closePreviewModal} aria-label="Fechar">
            <X size={20} />
          </button>

          <!-- Modal Grid Layout -->
          <div class="modal-grid">
            <!-- Left Stage: Contextual Realistic Visuals -->
            <div class="modal-stage-col">
              <div class="stage-header">
                <span class="stage-badge">Pré-visualização em Tempo Real</span>
              </div>

              {#if item.kind === 'AVATAR_FRAME'}
                <!-- Avatar Frame Stage -->
                <div class="avatar-stage-box">
                  <div class="stage-avatar-holder">
                    <UserAvatar
                      avatarId={data.profile?.avatar_id}
                      frameId={item.id}
                      displayName={data.profile?.display_name || data.profile?.username || 'Leitor'}
                      size={110}
                    />
                  </div>
                  <div class="stage-avatar-info">
                    <span
                      class="stage-username"
                      style={equippedColor ? `color: ${equippedColor}` : ''}
                    >
                      {data.profile?.display_name || data.profile?.username || 'Seu Nome'}
                    </span>
                    {#if equippedTitle}
                      <span class="stage-title-pill">{equippedTitle}</span>
                    {/if}
                  </div>
                </div>

              {:else if item.kind === 'PROFILE_BANNER'}
                <!-- Full Profile Header Mockup Stage -->
                <div class="banner-stage-box">
                  <div
                    class="stage-banner-canvas"
                    style={style.background ? `background: ${style.background};` : 'background: #1e1b4b;'}
                  >
                    <div class="banner-gradient-shade"></div>
                  </div>
                  <div class="stage-banner-profile-strip">
                    <div class="banner-stage-avatar">
                      <UserAvatar
                        avatarId={data.profile?.avatar_id}
                        frameId={equippedFrame}
                        displayName={data.profile?.display_name || 'Leitor'}
                        size={64}
                      />
                    </div>
                    <div class="banner-stage-meta">
                      <div class="banner-stage-name-row">
                        <span class="banner-stage-name">{data.profile?.display_name || 'Seu Nome'}</span>
                        <span class="banner-stage-lvl">Nível {userLevel}</span>
                      </div>
                      <span class="banner-stage-handle">@{data.profile?.username || 'usuario'}</span>
                    </div>
                  </div>
                </div>

              {:else if item.kind === 'NAME_COLOR'}
                <!-- Multi-Context Name Color Preview -->
                <div class="color-stage-contexts">
                  <!-- Context 1: Comment Box -->
                  <div class="context-card comment-context">
                    <div class="context-tag">
                      <MessageSquare size={13} />
                      <span>Nos Comentários</span>
                    </div>
                    <div class="mock-comment">
                      <UserAvatar
                        avatarId={data.profile?.avatar_id}
                        frameId={equippedFrame}
                        displayName={data.profile?.display_name || 'Leitor'}
                        size={38}
                      />
                      <div class="mock-comment-bubble">
                        <div class="mock-comment-top">
                          <span
                            class="mock-author-name"
                            style={style.backgroundImage
                              ? `background-image: ${style.backgroundImage}; -webkit-background-clip: text; -webkit-text-fill-color: transparent;`
                              : `color: ${style.color || '#ffffff'}; text-shadow: ${style.textShadow || 'none'};`}
                          >
                            {data.profile?.display_name || data.profile?.username || 'Seu Nome'}
                          </span>
                          <span class="mock-comment-time">há 10 minutos</span>
                        </div>
                        <p class="mock-comment-body">Que capítulo incrível! Os traços e o roteiro estão impecáveis.</p>
                      </div>
                    </div>
                  </div>

                  <!-- Context 2: Reader Header Bar -->
                  <div class="context-card reader-context">
                    <div class="context-tag">
                      <BookOpen size={13} />
                      <span>No Leitor & Comunidade</span>
                    </div>
                    <div class="mock-reader-bar">
                      <span class="mock-chapter-title">Céu Distante — Capítulo 01</span>
                      <span
                        class="mock-reader-user"
                        style={style.backgroundImage
                          ? `background-image: ${style.backgroundImage}; -webkit-background-clip: text; -webkit-text-fill-color: transparent;`
                          : `color: ${style.color || '#ffffff'};`}
                      >
                        @{data.profile?.username || 'usuario'}
                      </span>
                    </div>
                  </div>
                </div>

              {:else if item.kind === 'TITLE'}
                <!-- Title Stage -->
                <div class="title-stage-box">
                  <span class="title-stage-label">Exibição Honorária no Perfil</span>
                  <div class="title-stage-badge-large">
                    <Crown size={22} class="title-stage-crown" />
                    <span class="title-stage-text">{item.name}</span>
                  </div>
                  <p class="title-stage-sub">
                    Este título aparecerá em destaque abaixo do seu nome nos rankings, comentários e perfil público.
                  </p>
                </div>
              {/if}
            </div>

            <!-- Right Details: Meta & XP Calculator -->
            <div class="modal-details-col">
              <div class="modal-item-header">
                <span
                  class="rarity-badge-modal"
                  style="color: {rarityConf.color}; background: {rarityConf.bg}; border-color: {rarityConf.border};"
                >
                  {rarityConf.label}
                </span>
                <h2 class="modal-item-name">{item.name}</h2>
                <p class="modal-item-desc">{item.description}</p>
              </div>

              <!-- Item Requisite -->
              <div class="modal-requisite-row">
                <span class="req-label">Requisito de Nível:</span>
                <span class="req-val" class:locked={userLevel < (item.min_level || 1)}>
                  {userLevel < (item.min_level || 1) ? '🔒 ' : '✓ '} Nível {item.min_level || 1}
                </span>
              </div>

              <!-- XP Balance Calculator -->
              <div class="xp-calculator-card">
                <span class="calc-title">Calculadora de Saldo Cósmico</span>

                <div class="calc-row">
                  <span class="calc-lbl">Seu Saldo Atual:</span>
                  <span class="calc-val">{formatXp(currentXp)} XP</span>
                </div>

                <div class="calc-row">
                  <span class="calc-lbl">Custo do Item:</span>
                  <span class="calc-val price">
                    {isOwned ? '0 XP (Já Adquirido)' : `- ${formatXp(item.price_xp)} XP`}
                  </span>
                </div>

                <div class="calc-divider"></div>

                <div class="calc-row result">
                  <span class="calc-lbl">Saldo Restante:</span>
                  {#if isOwned}
                    <span class="calc-val final">{formatXp(currentXp)} XP</span>
                  {:else if canAfford}
                    <span class="calc-val final">{formatXp(remainingXp)} XP</span>
                  {:else}
                    <span class="calc-val deficient">Faltam {formatXp(item.price_xp - currentXp)} XP</span>
                  {/if}
                </div>
              </div>

              <!-- Modal Actions -->
              <div class="modal-actions-wrap">
                {#if isEquipped}
                  <button
                    type="button"
                    class="btn-modal-action unequip"
                    disabled={busyItemId === item.id}
                    onclick={() => handleEquip(item, false)}
                  >
                    {busyItemId === item.id ? 'Salvando...' : 'Desequipar Cosmético'}
                  </button>
                {:else if isOwned}
                  <button
                    type="button"
                    class="btn-modal-action equip"
                    disabled={busyItemId === item.id}
                    onclick={() => handleEquip(item, true)}
                  >
                    <Check size={16} />
                    <span>{busyItemId === item.id ? 'Salvando...' : 'Equipar no Perfil'}</span>
                  </button>
                {:else}
                  <button
                    type="button"
                    class="btn-modal-action buy"
                    disabled={!canAfford || !meetsLevel || busyItemId === item.id}
                    onclick={() => handlePurchase(item)}
                  >
                    {#if !meetsLevel}
                      <Lock size={16} />
                      <span>Nível {item.min_level} Necessário</span>
                    {:else if !canAfford}
                      <span>XP Insuficiente (Faltam {formatXp(item.price_xp - currentXp)} XP)</span>
                    {:else}
                      <Sparkles size={16} />
                      <span>{busyItemId === item.id ? 'Processando...' : `Adquirir por ${formatXp(item.price_xp)} XP`}</span>
                    {/if}
                  </button>
                {/if}
              </div>
            </div>
          </div>
        </div>
      </div>
    {/if}
  </div>
</div>

<style>
  .shop-page {
    min-height: 100vh;
    padding: 2.5rem 1.5rem 5rem;
    color: #e2e8f0;
  }

  .shop-container {
    max-width: 1440px;
    margin: 0 auto;
    position: relative;
  }

  .shop-toast {
    position: fixed;
    bottom: 2rem;
    right: 2rem;
    display: flex;
    align-items: center;
    gap: 0.6rem;
    padding: 0.85rem 1.25rem;
    border-radius: 12px;
    font-size: 0.92rem;
    font-weight: 600;
    box-shadow: 0 8px 30px rgba(0, 0, 0, 0.6);
    z-index: 100;
    backdrop-filter: blur(12px);
  }

  .shop-toast.success {
    background: rgba(16, 185, 129, 0.92);
    border: 1px solid #10b981;
    color: #ffffff;
  }

  .shop-toast.error {
    background: rgba(239, 68, 68, 0.92);
    border: 1px solid #ef4444;
    color: #ffffff;
  }

  /* Shop Hero */
  .shop-hero {
    display: grid;
    grid-template-columns: 1fr 320px;
    gap: 2rem;
    align-items: center;
    background: radial-gradient(circle at top left, rgba(139, 92, 246, 0.15), transparent 70%),
      rgba(14, 17, 29, 0.85);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 20px;
    padding: 2.5rem;
    margin-bottom: 2rem;
  }

  .hero-tag {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    padding: 0.35rem 0.85rem;
    background: rgba(139, 92, 246, 0.15);
    border: 1px solid rgba(139, 92, 246, 0.3);
    border-radius: 9999px;
    color: #c4b5fd;
    font-size: 0.8rem;
    font-weight: 700;
    margin-bottom: 0.85rem;
  }

  .shop-title {
    font-family: 'Manrope', -apple-system, BlinkMacSystemFont, sans-serif;
    font-size: 2.3rem;
    font-weight: 800;
    color: #ffffff;
    margin: 0 0 0.75rem;
    letter-spacing: -0.02em;
  }

  .shop-desc {
    font-size: 0.98rem;
    color: #94a3b8;
    line-height: 1.6;
    margin: 0 0 1.75rem;
    max-width: 680px;
  }

  .balance-card {
    display: inline-flex;
    align-items: center;
    gap: 1.5rem;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 14px;
    padding: 1rem 1.5rem;
  }

  .balance-item {
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
  }

  .balance-label {
    font-size: 0.75rem;
    color: #94a3b8;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    font-weight: 600;
  }

  .xp-val-wrap,
  .lvl-val-wrap {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  :global(.xp-icon) {
    color: #dfc28d;
  }

  :global(.lvl-icon) {
    color: #c4b5fd;
  }

  .xp-amount {
    font-size: 1.35rem;
    font-weight: 800;
    color: #dfc28d;
  }

  .lvl-amount {
    font-size: 1.35rem;
    font-weight: 800;
    color: #ffffff;
  }

  .balance-divider {
    width: 1px;
    height: 38px;
    background: rgba(255, 255, 255, 0.1);
  }

  .hero-preview-box {
    background: #0e111d;
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 16px;
    padding: 1.5rem;
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
  }

  .preview-title {
    font-size: 0.75rem;
    color: #64748b;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    font-weight: 700;
    margin-bottom: 1rem;
  }

  .preview-avatar-wrap {
    margin-bottom: 0.85rem;
  }

  .preview-meta {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.35rem;
  }

  .preview-name {
    font-size: 1.05rem;
    font-weight: 800;
    color: #ffffff;
  }

  .preview-title-badge {
    padding: 0.2rem 0.6rem;
    background: rgba(223, 194, 141, 0.15);
    border: 1px solid rgba(223, 194, 141, 0.4);
    border-radius: 9999px;
    color: #dfc28d;
    font-size: 0.72rem;
    font-weight: 700;
  }

  /* Categories Bar */
  .categories-bar {
    display: flex;
    gap: 0.5rem;
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
    margin-bottom: 1.25rem;
    overflow-x: auto;
    padding-bottom: 0.5rem;
  }

  .cat-btn {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.75rem 1.25rem;
    background: none;
    border: none;
    border-bottom: 2px solid transparent;
    color: #94a3b8;
    font-size: 0.92rem;
    font-weight: 600;
    cursor: pointer;
    white-space: nowrap;
    transition: all 0.2s ease;
  }

  .cat-btn:hover {
    color: #ffffff;
  }

  .cat-btn.active {
    color: #dfc28d;
    border-bottom-color: #dfc28d;
  }

  /* Controls Bar */
  .controls-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1.25rem;
    background: rgba(14, 17, 29, 0.6);
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: 12px;
    padding: 0.75rem 1.25rem;
    margin-bottom: 2rem;
    flex-wrap: wrap;
  }

  .rarity-filters {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    flex-wrap: wrap;
  }

  .filter-label,
  .sort-label {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    font-size: 0.8rem;
    font-weight: 700;
    color: #64748b;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  .rarity-pill-group {
    display: flex;
    gap: 0.35rem;
    flex-wrap: wrap;
  }

  .rarity-pill {
    padding: 0.3rem 0.65rem;
    border-radius: 8px;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.08);
    color: #94a3b8;
    font-size: 0.78rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .rarity-pill:hover {
    background: rgba(255, 255, 255, 0.08);
    color: #ffffff;
  }

  .rarity-pill.active {
    border-color: #dfc28d;
    color: #dfc28d;
    background: rgba(223, 194, 141, 0.12);
  }

  .sort-wrap {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .sort-select {
    padding: 0.4rem 0.85rem;
    border-radius: 8px;
    background: #0e111d;
    border: 1px solid rgba(255, 255, 255, 0.1);
    color: #ffffff;
    font-size: 0.85rem;
    font-weight: 600;
    outline: none;
    cursor: pointer;
  }

  .sort-select:focus {
    border-color: #8b5cf6;
  }

  /* Items Grid */
  .items-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(310px, 1fr));
    gap: 1.5rem;
  }

  .empty-shop {
    grid-column: 1 / -1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 4rem 1rem;
    text-align: center;
    color: #64748b;
  }

  :global(.empty-icon) {
    margin-bottom: 1rem;
    opacity: 0.6;
  }

  .empty-title {
    font-size: 1.2rem;
    font-weight: 700;
    color: #ffffff;
    margin: 0 0 0.4rem;
  }

  .empty-desc {
    font-size: 0.9rem;
    margin: 0;
  }

  /* Card */
  .shop-card {
    background: #0e111d;
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 16px;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
    position: relative;
  }

  .shop-card:hover {
    border-color: var(--rarity-border, rgba(139, 92, 246, 0.4));
    box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.6);
    transform: translateY(-2px);
  }

  .shop-card.equipped {
    border-color: rgba(223, 194, 141, 0.7);
    box-shadow: 0 0 20px -2px rgba(223, 194, 141, 0.25);
  }

  .card-visual-clickable {
    background: none;
    border: none;
    padding: 0;
    margin: 0;
    text-align: inherit;
    cursor: pointer;
    width: 100%;
    display: block;
    position: relative;
  }

  .card-visual {
    height: 140px;
    background: radial-gradient(circle, rgba(139, 92, 246, 0.08) 0%, rgba(10, 12, 20, 0.9) 100%);
    border-bottom: 1px solid rgba(255, 255, 255, 0.06);
    display: flex;
    align-items: center;
    justify-content: center;
    position: relative;
    overflow: hidden;
  }

  .card-visual.title-visual {
    height: 100px;
  }

  .rarity-chip {
    position: absolute;
    top: 10px;
    left: 10px;
    padding: 0.2rem 0.55rem;
    border-radius: 6px;
    font-size: 0.68rem;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    border: 1px solid;
    z-index: 2;
  }

  .animated-chip {
    position: absolute;
    top: 10px;
    right: 10px;
    padding: 0.2rem 0.5rem;
    background: rgba(139, 92, 246, 0.25);
    border: 1px solid rgba(139, 92, 246, 0.4);
    border-radius: 6px;
    color: #c4b5fd;
    font-size: 0.7rem;
    font-weight: 700;
    z-index: 2;
  }

  .hover-preview-hint {
    position: absolute;
    bottom: 8px;
    right: 10px;
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    padding: 0.25rem 0.55rem;
    background: rgba(0, 0, 0, 0.7);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 6px;
    color: #cbd5e1;
    font-size: 0.7rem;
    font-weight: 600;
    opacity: 0;
    transition: opacity 0.2s ease;
    backdrop-filter: blur(4px);
  }

  .card-visual-clickable:hover .hover-preview-hint {
    opacity: 1;
  }

  .color-demo-text {
    font-size: 1.4rem;
    font-weight: 800;
  }

  .title-demo-badge {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    padding: 0.4rem 0.9rem;
    background: rgba(223, 194, 141, 0.15);
    border: 1px solid rgba(223, 194, 141, 0.4);
    border-radius: 9999px;
    color: #dfc28d;
    font-size: 0.85rem;
    font-weight: 800;
  }

  .banner-demo-wrap {
    width: 90%;
    aspect-ratio: 16 / 6;
    border-radius: 10px;
    display: flex;
    align-items: center;
    justify-content: center;
    border: 1px solid rgba(255, 255, 255, 0.1);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
    position: relative;
    overflow: hidden;
  }

  .banner-label {
    font-size: 0.8rem;
    font-weight: 700;
    color: #ffffff;
    text-shadow: 0 1px 4px rgba(0, 0, 0, 0.8);
    position: relative;
    z-index: 1;
  }

  .card-content {
    padding: 1.25rem;
    display: flex;
    flex-direction: column;
    flex: 1;
  }

  .item-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
    margin-bottom: 0.4rem;
  }

  .item-name {
    font-size: 1.1rem;
    font-weight: 700;
    color: #ffffff;
    margin: 0;
  }

  .status-pill {
    padding: 0.2rem 0.5rem;
    border-radius: 6px;
    font-size: 0.72rem;
    font-weight: 700;
  }

  .status-pill.equipped {
    background: rgba(223, 194, 141, 0.2);
    color: #dfc28d;
    border: 1px solid rgba(223, 194, 141, 0.4);
  }

  .status-pill.owned {
    background: rgba(16, 185, 129, 0.15);
    color: #6ee7b7;
    border: 1px solid rgba(16, 185, 129, 0.3);
  }

  .item-desc {
    font-size: 0.85rem;
    color: #94a3b8;
    line-height: 1.5;
    margin: 0 0 1.25rem;
    flex: 1;
  }

  .item-meta {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 1rem;
    padding-top: 0.75rem;
    border-top: 1px solid rgba(255, 255, 255, 0.05);
  }

  .xp-price {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    font-size: 0.95rem;
    font-weight: 700;
    color: #dfc28d;
  }

  .xp-price.cant-afford {
    color: #ef4444;
  }

  .lvl-req {
    font-size: 0.78rem;
    color: #64748b;
    font-weight: 600;
  }

  .lvl-req.locked {
    color: #f87171;
  }

  .btn-action {
    width: 100%;
    padding: 0.75rem 1rem;
    border-radius: 10px;
    font-size: 0.88rem;
    font-weight: 700;
    border: none;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    transition: all 0.2s ease;
  }

  .btn-action.buy {
    background: #8b5cf6;
    color: #ffffff;
  }

  .btn-action.buy:hover:not(:disabled) {
    background: #7c3aed;
    box-shadow: 0 4px 16px rgba(139, 92, 246, 0.4);
  }

  .btn-action.buy:disabled {
    background: rgba(255, 255, 255, 0.06);
    color: #64748b;
    cursor: not-allowed;
  }

  .btn-action.equip {
    background: rgba(223, 194, 141, 0.15);
    border: 1px solid rgba(223, 194, 141, 0.4);
    color: #dfc28d;
  }

  .btn-action.equip:hover {
    background: rgba(223, 194, 141, 0.25);
  }

  .btn-action.unequip {
    background: rgba(255, 255, 255, 0.06);
    border: 1px solid rgba(255, 255, 255, 0.1);
    color: #94a3b8;
  }

  .btn-action.unequip:hover {
    background: rgba(239, 68, 68, 0.15);
    border-color: rgba(239, 68, 68, 0.3);
    color: #fca5a5;
  }

  /* Expanded Preview Modal */
  .modal-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.82);
    backdrop-filter: blur(12px);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 1.5rem;
    z-index: 200;
  }

  .modal-card {
    background: #0f121d;
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 20px;
    width: 100%;
    max-width: 860px;
    position: relative;
    box-shadow: 0 25px 60px -15px rgba(0, 0, 0, 0.9);
    overflow: hidden;
  }

  .btn-modal-close {
    position: absolute;
    top: 1.25rem;
    right: 1.25rem;
    background: rgba(255, 255, 255, 0.06);
    border: 1px solid rgba(255, 255, 255, 0.1);
    color: #94a3b8;
    border-radius: 9999px;
    width: 36px;
    height: 36px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    z-index: 10;
    transition: all 0.2s ease;
  }

  .btn-modal-close:hover {
    background: rgba(255, 255, 255, 0.12);
    color: #ffffff;
  }

  .modal-grid {
    display: grid;
    grid-template-columns: 1.15fr 1fr;
  }

  /* Modal Left Stage */
  .modal-stage-col {
    background: radial-gradient(circle at center, rgba(139, 92, 246, 0.12), rgba(10, 12, 20, 0.95));
    border-right: 1px solid rgba(255, 255, 255, 0.08);
    padding: 2.5rem 2rem;
    display: flex;
    flex-direction: column;
    justify-content: center;
    position: relative;
  }

  .stage-header {
    margin-bottom: 1.5rem;
    text-align: center;
  }

  .stage-badge {
    font-size: 0.72rem;
    font-weight: 700;
    color: #a78bfa;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    background: rgba(139, 92, 246, 0.15);
    padding: 0.3rem 0.75rem;
    border-radius: 9999px;
    border: 1px solid rgba(139, 92, 246, 0.3);
  }

  /* Avatar Frame Stage */
  .avatar-stage-box {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
  }

  .stage-avatar-holder {
    margin-bottom: 1.25rem;
    filter: drop-shadow(0 10px 20px rgba(0, 0, 0, 0.6));
  }

  .stage-username {
    font-size: 1.25rem;
    font-weight: 800;
    color: #ffffff;
    display: block;
    margin-bottom: 0.35rem;
  }

  .stage-title-pill {
    padding: 0.25rem 0.7rem;
    background: rgba(223, 194, 141, 0.15);
    border: 1px solid rgba(223, 194, 141, 0.4);
    border-radius: 9999px;
    color: #dfc28d;
    font-size: 0.75rem;
    font-weight: 700;
  }

  /* Banner Stage */
  .banner-stage-box {
    background: #141724;
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 14px;
    overflow: hidden;
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.6);
  }

  .stage-banner-canvas {
    height: 120px;
    position: relative;
    width: 100%;
  }

  .banner-gradient-shade {
    position: absolute;
    inset: 0;
    background: linear-gradient(to top, rgba(20, 23, 36, 0.9), transparent 70%);
  }

  .stage-banner-profile-strip {
    padding: 0 1.25rem 1.25rem;
    display: flex;
    align-items: flex-end;
    gap: 1rem;
    margin-top: -30px;
    position: relative;
    z-index: 2;
  }

  .banner-stage-avatar {
    filter: drop-shadow(0 4px 10px rgba(0, 0, 0, 0.6));
  }

  .banner-stage-name-row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .banner-stage-name {
    font-size: 1.05rem;
    font-weight: 800;
    color: #ffffff;
  }

  .banner-stage-lvl {
    font-size: 0.7rem;
    font-weight: 700;
    color: #dfc28d;
    background: rgba(223, 194, 141, 0.15);
    padding: 0.15rem 0.45rem;
    border-radius: 9999px;
  }

  .banner-stage-handle {
    font-size: 0.8rem;
    color: #94a3b8;
    display: block;
  }

  /* Color Stage Contexts */
  .color-stage-contexts {
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
  }

  .context-card {
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.07);
    border-radius: 12px;
    padding: 1rem;
  }

  .context-tag {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    font-size: 0.72rem;
    font-weight: 700;
    color: #94a3b8;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    margin-bottom: 0.75rem;
  }

  .mock-comment {
    display: flex;
    align-items: flex-start;
    gap: 0.75rem;
  }

  .mock-comment-bubble {
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 10px;
    padding: 0.75rem;
    flex: 1;
  }

  .mock-comment-top {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-bottom: 0.35rem;
  }

  .mock-author-name {
    font-size: 0.92rem;
    font-weight: 800;
  }

  .mock-comment-time {
    font-size: 0.72rem;
    color: #64748b;
  }

  .mock-comment-body {
    font-size: 0.82rem;
    color: #cbd5e1;
    line-height: 1.45;
    margin: 0;
  }

  .mock-reader-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    background: #0a0c14;
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 8px;
    padding: 0.65rem 0.85rem;
  }

  .mock-chapter-title {
    font-size: 0.82rem;
    font-weight: 600;
    color: #94a3b8;
  }

  .mock-reader-user {
    font-size: 0.85rem;
    font-weight: 800;
  }

  /* Title Stage Box */
  .title-stage-box {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    padding: 1.5rem 1rem;
  }

  .title-stage-label {
    font-size: 0.75rem;
    font-weight: 700;
    color: #64748b;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    margin-bottom: 1.5rem;
  }

  .title-stage-badge-large {
    display: inline-flex;
    align-items: center;
    gap: 0.6rem;
    padding: 0.6rem 1.4rem;
    background: rgba(223, 194, 141, 0.15);
    border: 1px solid rgba(223, 194, 141, 0.4);
    border-radius: 9999px;
    box-shadow: 0 0 25px rgba(223, 194, 141, 0.25);
    margin-bottom: 1.5rem;
  }

  :global(.title-stage-crown) {
    color: #dfc28d;
  }

  .title-stage-text {
    font-size: 1.15rem;
    font-weight: 800;
    color: #dfc28d;
  }

  .title-stage-sub {
    font-size: 0.82rem;
    color: #94a3b8;
    line-height: 1.5;
    max-width: 320px;
    margin: 0;
  }

  /* Modal Right Details */
  .modal-details-col {
    padding: 2.5rem 2rem;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
  }

  .rarity-badge-modal {
    display: inline-flex;
    padding: 0.25rem 0.6rem;
    border-radius: 6px;
    font-size: 0.72rem;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    border: 1px solid;
    margin-bottom: 0.75rem;
  }

  .modal-item-name {
    font-size: 1.5rem;
    font-weight: 800;
    color: #ffffff;
    margin: 0 0 0.5rem;
    letter-spacing: -0.015em;
  }

  .modal-item-desc {
    font-size: 0.9rem;
    color: #94a3b8;
    line-height: 1.55;
    margin: 0 0 1.5rem;
  }

  .modal-requisite-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.75rem 1rem;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: 10px;
    margin-bottom: 1.5rem;
  }

  .req-label {
    font-size: 0.82rem;
    font-weight: 600;
    color: #94a3b8;
  }

  .req-val {
    font-size: 0.85rem;
    font-weight: 700;
    color: #10b981;
  }

  .req-val.locked {
    color: #f87171;
  }

  /* XP Calculator */
  .xp-calculator-card {
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 12px;
    padding: 1.25rem;
    margin-bottom: 1.75rem;
  }

  .calc-title {
    font-size: 0.75rem;
    font-weight: 700;
    color: #64748b;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    display: block;
    margin-bottom: 0.85rem;
  }

  .calc-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 0.5rem;
  }

  .calc-lbl {
    font-size: 0.84rem;
    color: #94a3b8;
  }

  .calc-val {
    font-size: 0.9rem;
    font-weight: 700;
    color: #ffffff;
  }

  .calc-val.price {
    color: #dfc28d;
  }

  .calc-divider {
    height: 1px;
    background: rgba(255, 255, 255, 0.08);
    margin: 0.75rem 0;
  }

  .calc-row.result .calc-lbl {
    font-weight: 700;
    color: #ffffff;
  }

  .calc-val.final {
    font-size: 1.05rem;
    font-weight: 800;
    color: #dfc28d;
  }

  .calc-val.deficient {
    font-size: 0.92rem;
    font-weight: 800;
    color: #ef4444;
  }

  /* Modal Actions */
  .btn-modal-action {
    width: 100%;
    padding: 0.9rem 1.25rem;
    border-radius: 12px;
    font-size: 0.95rem;
    font-weight: 700;
    border: none;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.6rem;
    transition: all 0.2s ease;
  }

  .btn-modal-action.buy {
    background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%);
    color: #ffffff;
    box-shadow: 0 4px 20px rgba(139, 92, 246, 0.4);
  }

  .btn-modal-action.buy:hover:not(:disabled) {
    background: linear-gradient(135deg, #9d6fff 0%, #8b5cf6 100%);
    transform: translateY(-1px);
  }

  .btn-modal-action.buy:disabled {
    background: rgba(255, 255, 255, 0.06);
    color: #64748b;
    cursor: not-allowed;
    box-shadow: none;
    transform: none;
  }

  .btn-modal-action.equip {
    background: rgba(223, 194, 141, 0.2);
    border: 1px solid rgba(223, 194, 141, 0.5);
    color: #dfc28d;
  }

  .btn-modal-action.equip:hover {
    background: rgba(223, 194, 141, 0.3);
  }

  .btn-modal-action.unequip {
    background: rgba(255, 255, 255, 0.06);
    border: 1px solid rgba(255, 255, 255, 0.1);
    color: #94a3b8;
  }

  .btn-modal-action.unequip:hover {
    background: rgba(239, 68, 68, 0.15);
    border-color: rgba(239, 68, 68, 0.3);
    color: #fca5a5;
  }

  @media (max-width: 900px) {
    .shop-hero {
      grid-template-columns: 1fr;
      padding: 2rem 1.5rem;
    }

    .hero-preview-box {
      width: 100%;
    }

    .modal-grid {
      grid-template-columns: 1fr;
    }

    .modal-stage-col {
      border-right: none;
      border-bottom: 1px solid rgba(255, 255, 255, 0.08);
      padding: 2rem 1.5rem;
    }

    .modal-details-col {
      padding: 2rem 1.5rem;
    }
  }
</style>

