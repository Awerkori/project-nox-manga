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
    Crown
  } from '@lucide/svelte';
  import { invalidateAll } from '$app/navigation';
  import UserAvatar from '$lib/components/UserAvatar.svelte';

  let { data } = $props();

  let activeTab = $state<'ALL' | 'AVATAR_FRAME' | 'NAME_COLOR' | 'PROFILE_BANNER' | 'TITLE'>('ALL');
  let busyItemId = $state<string | null>(null);
  let feedbackMessage = $state<{ type: 'success' | 'error'; text: string } | null>(null);

  // Live preview states
  let previewFrame = $state<string | null>(null);
  let previewColor = $state<string | null>(null);
  let previewTitle = $state<string | null>(null);

  let currentXp = $derived(data.profile?.xp ?? 0);
  let userLevel = $derived(Math.floor(Math.sqrt(1 + currentXp / 50)));

  let equippedFrame = $derived(data.profile?.frame_id ?? null);
  let equippedColor = $derived(data.profile?.name_color ?? null);
  let equippedTitle = $derived(data.profile?.title_id ?? null);

  let inventorySet = $derived(new Set(data.inventory || []));

  let filteredItems = $derived(
    (data.items || []).filter((item: any) => {
      if (activeTab === 'ALL') return true;
      return item.kind === activeTab;
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
</script>

<svelte:head>
  <title>Loja Nox & Cosméticos | Project Nox</title>
  <meta
    name="description"
    content="Personalize seu perfil no Project Nox com molduras animadas, cores de nome exclusivas, títulos cósmicos e banners."
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
          Troque o XP conquistado durante suas leituras por molduras de avatar animadas estilo Discord, títulos
          honorários e cores dinâmicas para o seu perfil.
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
    <nav class="categories-bar">
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

    <!-- Items Grid -->
    <main class="items-grid">
      {#each filteredItems as item (item.id)}
        {@const style = getStyle(item)}
        {@const isOwned = inventorySet.has(item.id)}
        {@const isEquipped =
          (item.kind === 'AVATAR_FRAME' && equippedFrame === item.id) ||
          (item.kind === 'NAME_COLOR' && equippedColor === style.color) ||
          (item.kind === 'TITLE' && equippedTitle === item.name)}
        {@const canAfford = currentXp >= item.price_xp}
        {@const meetsLevel = userLevel >= item.min_level}
        {@const isBusy = busyItemId === item.id}

        <article class="shop-card" class:owned={isOwned} class:equipped={isEquipped}>
          <!-- Card Visual Display -->
          <div class="card-visual">
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
          </div>

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
                <span>{isOwned ? 'Adquirido' : `${formatXp(item.price_xp)} XP`}</span>
              </div>

              {#if item.min_level > 1}
                <span class="lvl-req" class:locked={userLevel < item.min_level}>
                  {userLevel < item.min_level ? '🔒 ' : ''}Nv. {item.min_level}
                </span>
              {/if}
            </div>

            <!-- Action Button -->
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
    </main>
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
    background: rgba(16, 185, 129, 0.9);
    border: 1px solid #10b981;
    color: #ffffff;
  }

  .shop-toast.error {
    background: rgba(239, 68, 68, 0.9);
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
    margin-bottom: 2.5rem;
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
    margin-bottom: 2rem;
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

  /* Items Grid */
  .items-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(310px, 1fr));
    gap: 1.5rem;
  }

  .shop-card {
    background: #0e111d;
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 16px;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
  }

  .shop-card:hover {
    border-color: rgba(139, 92, 246, 0.4);
    box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.6);
    transform: translateY(-2px);
  }

  .shop-card.equipped {
    border-color: rgba(223, 194, 141, 0.6);
    box-shadow: 0 0 20px -2px rgba(223, 194, 141, 0.2);
  }

  .card-visual {
    height: 140px;
    background: radial-gradient(circle, rgba(139, 92, 246, 0.08) 0%, rgba(10, 12, 20, 0.9) 100%);
    border-bottom: 1px solid rgba(255, 255, 255, 0.06);
    display: flex;
    align-items: center;
    justify-content: center;
    position: relative;
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
    height: 60px;
    border-radius: 10px;
    display: flex;
    align-items: center;
    justify-content: center;
    border: 1px solid rgba(255, 255, 255, 0.1);
  }

  .banner-label {
    font-size: 0.8rem;
    font-weight: 700;
    color: #ffffff;
    text-shadow: 0 1px 4px rgba(0, 0, 0, 0.8);
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

  @media (max-width: 900px) {
    .shop-hero {
      grid-template-columns: 1fr;
      padding: 2rem 1.5rem;
    }

    .hero-preview-box {
      width: 100%;
    }
  }
</style>
