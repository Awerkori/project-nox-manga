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
    BookOpen,
    ChevronLeft,
    ChevronRight,
    User,
    Bookmark,
    Star,
    ThumbsUp,
    MessageCircle,
    Info,
    HelpCircle,
    TrendingUp,
    Zap
  } from '@lucide/svelte';
  import { invalidateAll } from '$app/navigation';
  import UserAvatar from '$lib/components/UserAvatar.svelte';
  import { CURATED_BANNER_BACKGROUNDS } from '$lib/cosmetic-banners';
  import { getNameColorInfo } from '$lib/name-colors';
  import { registerDynamicFrame } from '$lib/cosmetics-catalog';

  let { data } = $props();

  let activeTab = $state<'ALL' | 'AVATAR_FRAME' | 'NAME_COLOR' | 'PROFILE_BANNER' | 'TITLE'>('ALL');
  let activeRarity = $state<'ALL' | 'COMUM' | 'INCOMUM' | 'RARA' | 'EPICA' | 'LENDARIA' | 'MITICA'>('ALL');
  let sortBy = $state<'relevance' | 'price_asc' | 'price_desc' | 'level'>('relevance');

  let busyItemId = $state<string | null>(null);
  let feedbackMessage = $state<{ type: 'success' | 'error'; text: string } | null>(null);
  let selectedModalItem = $state<any | null>(null);

  // Live preview states in hero
  let previewFrame = $state<string | null>(null);
  let previewFrameColor = $state<string | null>(null);
  let previewColor = $state<string | null>(null);
  let previewTitle = $state<string | null>(null);
  let previewBanner = $state<string | null>(null);
  let selectedCardVariants = $state<Record<string, string>>({});
  let showDetailedRules = $state(false);

  let isTestDriving = $derived(
    previewFrame !== null || previewColor !== null || previewTitle !== null || previewBanner !== null
  );

  function selectVariant(itemId: string, variantId: string) {
    selectedCardVariants[itemId] = variantId;
    if (previewFrame === itemId) {
      previewFrameColor = variantId === 'default' ? null : variantId;
    }
  }

  function applyToLivePreview(item: any) {
    if (item.kind === 'AVATAR_FRAME') {
      previewFrame = item.id;
      const v = selectedCardVariants[item.id];
      previewFrameColor = v && v !== 'default' ? v : null;
    } else if (item.kind === 'NAME_COLOR') {
      previewColor = item.id;
    } else if (item.kind === 'TITLE') {
      previewTitle = item.name;
    } else if (item.kind === 'PROFILE_BANNER') {
      previewBanner = item.id;
    }
    showToast(`Testando "${item.name}" no provador do topo!`, 'success');
  }

  function resetLivePreview() {
    previewFrame = null;
    previewFrameColor = null;
    previewColor = null;
    previewTitle = null;
    previewBanner = null;
    showToast('Provador restaurado para o seu perfil original.', 'success');
  }

  let currentXp = $derived(data.profile?.xp ?? 0);
  let userLevel = $derived(Math.floor(Math.sqrt(1 + currentXp / 50)));

  let equippedFrame = $derived(data.profile?.avatar_frame_id ?? data.profile?.frame_id ?? null);
  let equippedColor = $derived(data.profile?.name_color ?? null);
  let heroColorInfo = $derived(getNameColorInfo(previewColor || equippedColor));
  let equippedColorInfo = $derived(getNameColorInfo(equippedColor));
  let equippedTitle = $derived(data.profile?.title_id ?? null);
  let equippedBanner = $derived(data.profile?.equipped_banner_id ?? null);

  $effect(() => {
    if (equippedFrame && equippedFrame.includes(':')) {
      const [baseId, variant] = equippedFrame.split(':');
      if (baseId && variant && !selectedCardVariants[baseId]) {
        selectedCardVariants[baseId] = variant;
      }
    }
  });

  let inventorySet = $derived(new Set(data.inventory || []));

  $effect(() => {
    if (data.items) {
      for (const it of data.items) {
        if (it.kind === 'AVATAR_FRAME' && it.asset_url) {
          registerDynamicFrame(it.id, {
            asset_url: it.asset_url,
            style_data: it.style_data || {}
          });
        }
      }
    }
  });

  let categoryCounts = $derived({
    ALL: (data.items || []).length,
    AVATAR_FRAME: (data.items || []).filter((i: any) => i.kind === 'AVATAR_FRAME').length,
    NAME_COLOR: (data.items || []).filter((i: any) => i.kind === 'NAME_COLOR').length,
    TITLE: (data.items || []).filter((i: any) => i.kind === 'TITLE').length,
    PROFILE_BANNER: (data.items || []).filter((i: any) => i.kind === 'PROFILE_BANNER').length
  });

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
    if (item.kind === 'AVATAR_FRAME') {
      return equippedFrame === item.id || equippedFrame?.split(':')[0] === item.id;
    }
    if (item.kind === 'NAME_COLOR') return equippedColor === item.id || equippedColor === (style.color || style.backgroundImage);
    if (item.kind === 'TITLE') return equippedTitle === item.id || equippedTitle === item.name;
    if (item.kind === 'PROFILE_BANNER') return equippedBanner === item.id;
    return false;
  }

  function isExactVariantEquipped(item: any): boolean {
    if (!checkEquipped(item)) return false;
    if (item.kind !== 'AVATAR_FRAME') return true;
    if (!equippedFrame) return false;
    const currentVar = equippedFrame.includes(':') ? equippedFrame.split(':')[1] : 'default';
    const selectedVar = selectedCardVariants[item.id] || 'default';
    return currentVar === selectedVar;
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
      const selectedVariant = selectedCardVariants[item.id];
      const equipItemId = equip
        ? (item.kind === 'AVATAR_FRAME' && selectedVariant && selectedVariant !== 'default'
            ? `${item.id}:${selectedVariant}`
            : item.id)
        : '';
      const res = await fetch('/api/shop/equip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kind: item.kind,
          itemId: equipItemId
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

  // Mobile & responsive categories scrolling
  let categoriesNavEl = $state<HTMLElement | null>(null);
  let canScrollLeft = $state(false);
  let canScrollRight = $state(false);

  function updateScrollState() {
    if (!categoriesNavEl) return;
    const { scrollLeft, scrollWidth, clientWidth } = categoriesNavEl;
    canScrollLeft = scrollLeft > 6;
    canScrollRight = scrollLeft + clientWidth < scrollWidth - 6;
  }

  function scrollCategories(direction: 'left' | 'right') {
    if (!categoriesNavEl) return;
    const amount = direction === 'left' ? -200 : 200;
    categoriesNavEl.scrollBy({ left: amount, behavior: 'smooth' });
  }

  function handleTabClick(tabKey: typeof activeTab, el?: HTMLElement) {
    activeTab = tabKey;
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }
    setTimeout(updateScrollState, 350);
  }

  // Lock background body scroll when preview modal is open
  $effect(() => {
    if (selectedModalItem) {
      const prevOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = prevOverflow;
      };
    }
  });

  // Track nav scroll state on resize & init
  $effect(() => {
    updateScrollState();
    const onResize = () => updateScrollState();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  });
</script>

<svelte:window
  onkeydown={(e) => {
    if (e.key === 'Escape' && selectedModalItem) {
      closePreviewModal();
    }
  }}
/>

<svelte:head>
  <title>Loja Cósmica & Cosméticos | Project Nox</title>
  <meta
    name="description"
    content="Personalize seu perfil e comentários no Project Nox com molduras animadas, cores de nome animadas, títulos cósmicos e banners de comentário."
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
          Troque o XP acumulado durante suas leituras por molduras animadas exclusivas, banners de comentário astrais em alta
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

      <!-- Live Identity Preview / Provador ao Vivo -->
      <aside
        class="hero-preview-box"
        style={previewBanner && CURATED_BANNER_BACKGROUNDS[previewBanner] ? `background: ${CURATED_BANNER_BACKGROUNDS[previewBanner]}; background-size: cover;` : ''}
      >
        <div class="preview-box-header">
          <span class="preview-title">{isTestDriving ? 'Provador Ativo' : 'Sua Identidade'}</span>
          {#if isTestDriving}
            <button
              type="button"
              class="btn-reset-preview"
              onclick={resetLivePreview}
              title="Restaurar visual original do perfil"
            >
              <X size={12} />
              <span>Restaurar</span>
            </button>
          {/if}
        </div>

        <div class="preview-avatar-wrap">
          <UserAvatar
            user={data.profile}
            avatarId={data.profile?.avatar_id}
            crop={data.profile?.avatar_crop}
            frameId={previewFrame || equippedFrame}
            frameColor={previewFrame ? previewFrameColor : (equippedFrame?.includes(':') ? equippedFrame.split(':')[1] : null)}
            displayName={data.profile?.display_name || data.profile?.username || 'Leitor'}
            size={88}
          />
        </div>
        <div class="preview-meta">
          <span
            class="preview-name {heroColorInfo.className}"
            style={heroColorInfo.style}
          >
            {data.profile?.display_name || data.profile?.username || 'Visitante Nox'}
          </span>
          {#if previewTitle || equippedTitle}
            <span class="preview-title-badge">{previewTitle || equippedTitle}</span>
          {/if}
        </div>

        {#if isTestDriving}
          <div class="test-drive-indicator">
            <span class="pulse-dot"></span>
            <span>Pré-visualização provisória</span>
          </div>
        {/if}
      </aside>
    </header>

    <!-- ETAPA 4: Seção "✦ Como ganhar XP" -->
    <section class="how-to-earn-xp-section" aria-labelledby="xp-guide-title">
      <div class="xp-section-header">
        <div class="xp-header-title-wrap">
          <div class="xp-badge-icon">
            <Zap size={18} />
          </div>
          <h2 id="xp-guide-title" class="xp-section-title">✦ Como ganhar XP</h2>
        </div>
        <button
          type="button"
          class="btn-toggle-xp-rules"
          onclick={() => (showDetailedRules = !showDetailedRules)}
          aria-expanded={showDetailedRules}
        >
          <HelpCircle size={15} />
          <span>{showDetailedRules ? 'Ocultar Detalhes das Regras' : 'Entenda Cooldowns e Limites'}</span>
        </button>
      </div>

      <!-- 6 Activity Cards Grid -->
      <div class="xp-activities-grid">
        <!-- 1. Ler Capítulos -->
        <div class="xp-activity-card featured">
          <div class="activity-top">
            <div class="activity-icon-wrap read">
              <BookOpen size={20} />
            </div>
            <div class="activity-reward-badge">
              <span>+150 XP</span>
            </div>
          </div>
          <h3 class="activity-name">Ler Capítulos</h3>
          <p class="activity-desc">Conclua a leitura de qualquer capítulo publicado pela primeira vez.</p>
          <div class="activity-footer">
            <span class="activity-tag">Cooldown: 90s</span>
            <span class="activity-tag">Até 40/dia</span>
          </div>
        </div>

        <!-- 2. Favoritar Obras -->
        <div class="xp-activity-card">
          <div class="activity-top">
            <div class="activity-icon-wrap fav">
              <Bookmark size={20} />
            </div>
            <div class="activity-reward-badge">
              <span>+75 XP</span>
            </div>
          </div>
          <h3 class="activity-name">Favoritar Obras</h3>
          <p class="activity-desc">Adicione obras à sua biblioteca pessoal para acompanhar lançamentos.</p>
          <div class="activity-footer">
            <span class="activity-tag">Única por obra</span>
            <span class="activity-tag">Até 10/dia</span>
          </div>
        </div>

        <!-- 3. Avaliar Obras -->
        <div class="xp-activity-card">
          <div class="activity-top">
            <div class="activity-icon-wrap rate">
              <Star size={20} />
            </div>
            <div class="activity-reward-badge">
              <span>+50 XP</span>
            </div>
          </div>
          <h3 class="activity-name">Avaliar Obras</h3>
          <p class="activity-desc">Dê sua nota de 1 a 5 estrelas em suas obras preferidas.</p>
          <div class="activity-footer">
            <span class="activity-tag">Única por obra</span>
            <span class="activity-tag">Até 10/dia</span>
          </div>
        </div>

        <!-- 4. Comentar -->
        <div class="xp-activity-card">
          <div class="activity-top">
            <div class="activity-icon-wrap comment">
              <MessageSquare size={20} />
            </div>
            <div class="activity-reward-badge">
              <span>+30 XP</span>
            </div>
          </div>
          <h3 class="activity-name">Comentar</h3>
          <p class="activity-desc">Compartilhe teorias e opiniões em comentários de pelo menos 15 caracteres.</p>
          <div class="activity-footer">
            <span class="activity-tag">Cooldown: 60s</span>
            <span class="activity-tag">Até 5/dia</span>
          </div>
        </div>

        <!-- 5. Responder a Comentários -->
        <div class="xp-activity-card">
          <div class="activity-top">
            <div class="activity-icon-wrap reply">
              <MessageCircle size={20} />
            </div>
            <div class="activity-reward-badge">
              <span>+20 XP</span>
            </div>
          </div>
          <h3 class="activity-name">Responder</h3>
          <p class="activity-desc">Participe de conversas respondendo a mensagens de outros leitores.</p>
          <div class="activity-footer">
            <span class="activity-tag">Cooldown: 60s</span>
            <span class="activity-tag">Até 5/dia</span>
          </div>
        </div>

        <!-- 6. Curtir Comentários -->
        <div class="xp-activity-card">
          <div class="activity-top">
            <div class="activity-icon-wrap like">
              <ThumbsUp size={20} />
            </div>
            <div class="activity-reward-badge">
              <span>+5 XP</span>
            </div>
          </div>
          <h3 class="activity-name">Curtir Comentários</h3>
          <p class="activity-desc">Destaque os comentários mais inspiradores e divertidos da comunidade.</p>
          <div class="activity-footer">
            <span class="activity-tag">Cooldown: 10s</span>
            <span class="activity-tag">Até 10/dia</span>
          </div>
        </div>
      </div>

      <!-- Expandable Explanations / Transparency Panel -->
      {#if showDetailedRules}
        <div class="xp-detailed-rules-panel">
          <div class="rules-grid">
            <div class="rule-box">
              <h4 class="rule-title">
                <Info size={16} class="rule-icon" />
                <span>O que significa o XP e como usar?</span>
              </h4>
              <p>
                O XP é a energia cósmica conquistada por sua atividade legítima no site. Seu saldo atual é de
                <strong>{formatXp(currentXp)} XP</strong> (Nível {userLevel}). Cada cosmético na loja possui um preço em XP e uma exigência mínima de nível. Ao adquirir um item, o valor é debitado e o cosmético é adicionado ao seu inventário para sempre.
              </p>
            </div>

            <div class="rule-box season-reset-rule">
              <h4 class="rule-title">
                <Sparkles size={16} class="rule-icon" />
                <span>Ciclo Sazonal de XP: Gaste antes do reset!</span>
              </h4>
              <p>
                As temporadas do Project Nox duram 90 dias. Ao final de cada ciclo, o saldo de XP e o nível de temporada são zerados para iniciar uma nova disputa justa. <strong>Gaste seu XP acumulado na Loja Cósmica antes do fim da temporada!</strong> Todos os cosméticos comprados (molduras, banners, cores de nome e títulos de loja) permanecem no seu inventário para sempre.
              </p>
            </div>

            <div class="rule-box">
              <h4 class="rule-title">
                <CheckCircle2 size={16} class="rule-icon" />
                <span>Diferença entre Concluir Leitura e Ganhar XP</span>
              </h4>
              <p>
                <strong>Seu histórico e progresso de leitura são sempre salvos instantaneamente</strong> em sua conta, independentemente de qualquer cooldown. O cooldown de 90 segundos aplica-se unicamente ao crédito de bônus de XP, garantindo que leituras em maratona rápida continuem marcadas como lidas sem prejudicar seu histórico.
              </p>
            </div>

            <div class="rule-box">
              <h4 class="rule-title">
                <Shield size={16} class="rule-icon" />
                <span>Por que algumas ações não concedem XP novamente?</span>
              </h4>
              <p>
                Para preservar a economia e o valor das conquistas dos leitores dedicados, ações únicas (como reler o mesmo capítulo, favoritar e desfavoritar repetidamente ou reavaliar uma obra) são registradas normalmente pelo site, mas não concedem XP duplicado.
              </p>
            </div>

            <div class="rule-box">
              <h4 class="rule-title">
                <TrendingUp size={16} class="rule-icon" />
                <span>Proteção e Transparência do Livro-Razão</span>
              </h4>
              <p>
                Todas as entradas e saídas de XP são registradas em um livro-razão atômico com validação estrita no servidor. Nenhuma alteração no navegador consegue burlar os saldos ou fabricar créditos falsos.
              </p>
            </div>
          </div>
        </div>
      {/if}
    </section>

    <!-- Categories Navigation Section with Mobile Indicators -->
    <div class="categories-nav-wrapper">
      <button
        type="button"
        class="cat-scroll-arrow left"
        class:visible={canScrollLeft}
        onclick={() => scrollCategories('left')}
        aria-label="Ver categorias anteriores"
        tabindex="-1"
      >
        <ChevronLeft size={18} />
      </button>

      <div class="cat-edge-fade left" class:visible={canScrollLeft}></div>
      <div class="cat-edge-fade right" class:visible={canScrollRight}></div>

      <nav
        bind:this={categoriesNavEl}
        onscroll={updateScrollState}
        class="categories-bar"
        aria-label="Categorias da Loja"
      >
        <button
          type="button"
          class="cat-btn"
          class:active={activeTab === 'ALL'}
          onclick={(e) => handleTabClick('ALL', e.currentTarget)}
        >
          <ShoppingBag size={16} />
          <span>Todos os Itens</span>
          <span class="cat-count">{categoryCounts.ALL}</span>
        </button>

        <button
          type="button"
          class="cat-btn"
          class:active={activeTab === 'AVATAR_FRAME'}
          onclick={(e) => handleTabClick('AVATAR_FRAME', e.currentTarget)}
        >
          <Shield size={16} />
          <span>Molduras</span>
          <span class="cat-count">{categoryCounts.AVATAR_FRAME}</span>
        </button>

        <button
          type="button"
          class="cat-btn"
          class:active={activeTab === 'NAME_COLOR'}
          onclick={(e) => handleTabClick('NAME_COLOR', e.currentTarget)}
        >
          <Palette size={16} />
          <span>Cores de Nome</span>
          <span class="cat-count">{categoryCounts.NAME_COLOR}</span>
        </button>

        <button
          type="button"
          class="cat-btn"
          class:active={activeTab === 'TITLE'}
          onclick={(e) => handleTabClick('TITLE', e.currentTarget)}
        >
          <Tag size={16} />
          <span>Títulos</span>
          <span class="cat-count">{categoryCounts.TITLE}</span>
        </button>

        <button
          type="button"
          class="cat-btn"
          class:active={activeTab === 'PROFILE_BANNER'}
          onclick={(e) => handleTabClick('PROFILE_BANNER', e.currentTarget)}
        >
          <ImageIcon size={16} />
          <span>Banners de Comentário</span>
          <span class="cat-count">{categoryCounts.PROFILE_BANNER}</span>
        </button>
      </nav>

      <button
        type="button"
        class="cat-scroll-arrow right"
        class:visible={canScrollRight}
        onclick={() => scrollCategories('right')}
        aria-label="Ver próximas categorias"
        tabindex="-1"
      >
        <ChevronRight size={18} />
      </button>
    </div>

    <!-- Mobile contextual swipe indicator -->
    <div class="mobile-swipe-hint" aria-hidden="true">
      <span class="swipe-arrow">‹</span>
      <span>Deslize para ver mais categorias</span>
      <span class="swipe-arrow">›</span>
    </div>

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
                      user={data.profile}
                      avatarId={data.profile?.avatar_id}
                      crop={data.profile?.avatar_crop}
                      frameId={item.asset_url ? null : item.id}
                      frameUrl={item.asset_url || null}
                      frameScale={item.style_data?.frame_scale}
                      frameOffsetX={item.style_data?.frame_offset_x}
                      frameOffsetY={item.style_data?.frame_offset_y}
                      frameFit={item.style_data?.frame_fit}
                      frameColor={selectedCardVariants[item.id] === 'default' ? null : selectedCardVariants[item.id]}
                      displayName={item.name}
                      size={72}
                    />
                  </div>
                {:else if item.kind === 'NAME_COLOR'}
                  {@const cardColorInfo = getNameColorInfo(item.id)}
                  <div class="color-demo-wrap">
                    <span
                      class="color-demo-text {cardColorInfo.className}"
                      style={cardColorInfo.style}
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

              {#if item.color_variants && item.color_variants.length > 0}
                <div class="card-color-swatches" role="group" aria-label="Variações de cor para {item.name}">
                  <span class="swatches-label">Cor:</span>
                  <div class="swatches-list">
                    {#each item.color_variants as variant}
                      <button
                        type="button"
                        class="swatch-btn"
                        class:active={(selectedCardVariants[item.id] || 'default') === variant.id}
                        style="background-color: {variant.color};"
                        title={variant.label}
                        aria-label="{variant.label} para {item.name}"
                        onclick={(e) => {
                          e.stopPropagation();
                          selectVariant(item.id, variant.id);
                        }}
                      ></button>
                    {/each}
                  </div>
                </div>
              {/if}

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
                <button
                  type="button"
                  class="btn-action-test btn-action-view"
                  onclick={() => openPreviewModal(item)}
                  title="Visualizar este cosmético no seu perfil"
                >
                  <Eye size={14} />
                  <span>Visualizar</span>
                </button>

                {#if isEquipped && isExactVariantEquipped(item)}
                  <button
                    type="button"
                    class="btn-action unequip"
                    disabled={isBusy}
                    onclick={() => handleEquip(item, false)}
                  >
                    {isBusy ? 'Salvando...' : 'Desequipar'}
                  </button>
                {:else if isEquipped && !isExactVariantEquipped(item)}
                  <button
                    type="button"
                    class="btn-action equip"
                    disabled={isBusy}
                    onclick={() => handleEquip(item, true)}
                    title="Aplicar a variante de cor selecionada"
                  >
                    <Check size={14} />
                    <span>{isBusy ? 'Salvando...' : 'Trocar Cor'}</span>
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
                      <span>Nível {item.min_level}</span>
                    {:else if !canAfford}
                      <span>Faltam {formatXp(item.price_xp - currentXp)} XP</span>
                    {:else}
                      <Sparkles size={14} />
                      <span>{isBusy ? 'Comprando...' : 'Adquirir'}</span>
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
        <div class="modal-card" onclick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="modal-item-title">
          <!-- Close Button -->
          <button type="button" class="btn-modal-close" onclick={closePreviewModal} aria-label="Fechar visualização">
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
                      user={data.profile}
                      avatarId={data.profile?.avatar_id}
                      crop={data.profile?.avatar_crop}
                      frameId={item.asset_url ? null : item.id}
                      frameUrl={item.asset_url || null}
                      frameScale={item.style_data?.frame_scale}
                      frameOffsetX={item.style_data?.frame_offset_x}
                      frameOffsetY={item.style_data?.frame_offset_y}
                      frameFit={item.style_data?.frame_fit}
                      frameColor={selectedCardVariants[item.id] === 'default' ? null : selectedCardVariants[item.id]}
                      displayName={data.profile?.display_name || data.profile?.username || 'Leitor'}
                      size={128}
                    />
                  </div>
                  <div class="stage-avatar-info">
                    <span
                      class="stage-username {equippedColorInfo.className}"
                      style={equippedColorInfo.style}
                    >
                      {data.profile?.display_name || data.profile?.username || 'Seu Nome'}
                    </span>
                    {#if equippedTitle}
                      <span class="stage-title-pill">{equippedTitle}</span>
                    {/if}
                    <span class="stage-handle-sub">@{data.profile?.username || 'usuario'} · Nível {userLevel}</span>
                  </div>
                </div>

              {:else if item.kind === 'PROFILE_BANNER'}
                {@const bannerBg = CURATED_BANNER_BACKGROUNDS[item.id] || item.asset_url || style.background || '#1e1b4b'}
                <!-- Realistic Comment Simulation with Full Card Banner Background -->
                <div class="comment-simulation-stage">
                  <span class="comment-simulation-label">Simulação Realista em Comentários (Plano de Fundo Completo)</span>
                  <div class="simulated-comment-card has-comment-banner">
                    <!-- Full Card Animated Background -->
                    <div
                      class="comment-banner-background"
                      style="background: {bannerBg};"
                      aria-hidden="true"
                    ></div>

                    <!-- Legibility Protective Contrast Overlay -->
                    <div class="comment-banner-overlay" aria-hidden="true"></div>

                    <!-- Comment Content Layer (in foreground) -->
                    <div class="comment-content-layer">
                      <div class="simulated-comment-content">
                        <div class="simulated-avatar-col">
                          <UserAvatar
                            user={data.profile}
                            avatarId={data.profile?.avatar_id}
                            crop={data.profile?.avatar_crop}
                            frameId={equippedFrame}
                            displayName={data.profile?.display_name || 'Leitor'}
                            size={42}
                          />
                        </div>
                        <div class="simulated-text-col">
                          <div class="simulated-header-line">
                            <span
                              class="simulated-author-name {equippedColorInfo.className}"
                              style={equippedColorInfo.style}
                            >
                              {data.profile?.display_name || data.profile?.username || 'Seu Nome'}
                            </span>
                            {#if equippedTitle}
                              <span class="simulated-title-tag">{equippedTitle}</span>
                            {/if}
                            <span class="simulated-timestamp">há 5 minutos</span>
                          </div>
                          <p class="simulated-comment-text">
                            Essa obra está cada vez mais incrível! Mal posso esperar pelo próximo capítulo... 🔥
                          </p>
                          <div class="simulated-footer-actions">
                            <span class="simulated-like-pill">❤️ 14 curtidas</span>
                            <span class="simulated-reply-btn">Responder</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  <p class="comment-simulation-subnote">
                    O banner personalizado preenche todo o fundo do seu comentário, destacando sua identidade em todas as obras e capítulos.
                  </p>
                </div>

              {:else if item.kind === 'NAME_COLOR'}
                {@const modalColorInfo = getNameColorInfo(item.id)}
                <!-- Multi-Context Name Color Preview -->
                <div class="color-stage-contexts">
                  <!-- Context 1: Identity Plate (Profile & Header) -->
                  <div class="context-card identity-context">
                    <div class="context-tag">
                      <User size={13} />
                      <span>No Perfil e Cabeçalho</span>
                    </div>
                    <div class="mock-identity-plate">
                      <UserAvatar
                        user={data.profile}
                        avatarId={data.profile?.avatar_id}
                        crop={data.profile?.avatar_crop}
                        frameId={equippedFrame}
                        displayName={data.profile?.display_name || 'Leitor'}
                        size={54}
                      />
                      <div class="mock-identity-text">
                        <span
                          class="mock-author-name-large {modalColorInfo.className}"
                          style={modalColorInfo.style}
                        >
                          {data.profile?.display_name || data.profile?.username || 'Seu Nome'}
                        </span>
                        {#if equippedTitle}
                          <span class="mock-title-sub">{equippedTitle}</span>
                        {/if}
                        <span class="mock-handle">@{data.profile?.username || 'usuario'} · Nível {userLevel}</span>
                      </div>
                    </div>
                  </div>

                  <!-- Context 2: Comment Preview -->
                  <div class="context-card comment-context">
                    <div class="context-tag">
                      <MessageSquare size={13} />
                      <span>Nos Comentários da Obra</span>
                    </div>
                    <div class="mock-comment">
                      <UserAvatar
                        user={data.profile}
                        avatarId={data.profile?.avatar_id}
                        crop={data.profile?.avatar_crop}
                        frameId={equippedFrame}
                        displayName={data.profile?.display_name || 'Leitor'}
                        size={40}
                      />
                      <div class="mock-comment-bubble">
                        <div class="mock-comment-top">
                          <span
                            class="mock-author-name {modalColorInfo.className}"
                            style={modalColorInfo.style}
                          >
                            {data.profile?.display_name || data.profile?.username || 'Seu Nome'}
                          </span>
                          <span class="mock-comment-time">há 10 minutos</span>
                        </div>
                        <p class="mock-comment-body">Que capítulo incrível! Os traços e o roteiro estão impecáveis.</p>
                      </div>
                    </div>
                  </div>
                </div>

              {:else if item.kind === 'TITLE'}
                <!-- Title Stage -->
                <div class="title-stage-box">
                  <span class="title-stage-label">Exibição Honorária do Título</span>
                  <div class="title-stage-identity-card">
                    <UserAvatar
                      user={data.profile}
                      avatarId={data.profile?.avatar_id}
                      crop={data.profile?.avatar_crop}
                      frameId={equippedFrame}
                      displayName={data.profile?.display_name || 'Leitor'}
                      size={66}
                    />
                    <div class="title-stage-user-details">
                      <span
                        class="stage-username-with-title {equippedColorInfo.className}"
                        style={equippedColorInfo.style}
                      >
                        {data.profile?.display_name || data.profile?.username || 'Seu Nome'}
                      </span>
                      <div class="title-stage-badge-large">
                        <Crown size={18} class="title-stage-crown" />
                        <span class="title-stage-text">{item.name}</span>
                      </div>
                      <span class="title-stage-sub">
                        @{data.profile?.username || 'usuario'} · Nível {userLevel}
                      </span>
                    </div>
                  </div>
                  <p class="title-stage-footer-note">
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
                <h2 id="modal-item-title" class="modal-item-name">{item.name}</h2>
                <p class="modal-item-desc">{item.description}</p>

                {#if item.color_variants && item.color_variants.length > 0}
                  <div class="modal-variants-block">
                    <div class="variants-title-row">
                      <Palette size={14} />
                      <span class="variants-heading">Variações de Cor da Moldura:</span>
                    </div>
                    <div class="modal-swatches-grid">
                      {#each item.color_variants as variant}
                        <button
                          type="button"
                          class="modal-swatch-chip"
                          class:active={(selectedCardVariants[item.id] || 'default') === variant.id}
                          onclick={() => selectVariant(item.id, variant.id)}
                        >
                          <span class="chip-color-dot" style="background-color: {variant.color};"></span>
                          <span class="chip-label">{variant.label}</span>
                        </button>
                      {/each}
                    </div>
                  </div>
                {/if}
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
                {#if isEquipped && isExactVariantEquipped(item)}
                  <button
                    type="button"
                    class="btn-modal-action unequip"
                    disabled={busyItemId === item.id}
                    onclick={() => handleEquip(item, false)}
                  >
                    {busyItemId === item.id ? 'Salvando...' : 'Desequipar Cosmético'}
                  </button>
                {:else if isEquipped && !isExactVariantEquipped(item)}
                  <button
                    type="button"
                    class="btn-modal-action equip"
                    disabled={busyItemId === item.id}
                    onclick={() => handleEquip(item, true)}
                  >
                    <Check size={16} />
                    <span>{busyItemId === item.id ? 'Salvando...' : 'Aplicar Nova Cor'}</span>
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

                <button
                  type="button"
                  class="btn-modal-secondary-close"
                  onclick={closePreviewModal}
                >
                  <span>Fechar</span>
                </button>
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
    max-width: 1280px;
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
    color: #fbbf24;
  }

  :global(.lvl-icon) {
    color: #c4b5fd;
  }

  .xp-amount {
    font-size: 1.35rem;
    font-weight: 800;
    color: #fbbf24;
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
    position: relative;
  }

  .preview-box-header {
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 0.85rem;
  }

  .preview-title {
    font-size: 0.75rem;
    color: #64748b;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    font-weight: 700;
    margin: 0;
  }

  .btn-reset-preview {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    background: rgba(239, 68, 68, 0.15);
    border: 1px solid rgba(239, 68, 68, 0.35);
    color: #fca5a5;
    border-radius: 9999px;
    padding: 0.2rem 0.55rem;
    font-size: 0.7rem;
    font-weight: 700;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .btn-reset-preview:hover {
    background: rgba(239, 68, 68, 0.3);
    color: #ffffff;
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
    background: rgba(167, 139, 250, 0.15);
    border: 1px solid rgba(167, 139, 250, 0.4);
    border-radius: 9999px;
    color: #c4b5fd;
    font-size: 0.72rem;
    font-weight: 700;
  }

  .test-drive-indicator {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    margin-top: 0.75rem;
    font-size: 0.7rem;
    font-weight: 700;
    color: #38bdf8;
    background: rgba(56, 189, 248, 0.1);
    border: 1px solid rgba(56, 189, 248, 0.25);
    padding: 0.2rem 0.6rem;
    border-radius: 9999px;
  }

  .pulse-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: #38bdf8;
    box-shadow: 0 0 8px #38bdf8;
    animation: pulseDot 1.5s infinite;
  }

  @keyframes pulseDot {
    0%, 100% { opacity: 1; transform: scale(1); }
    50% { opacity: 0.4; transform: scale(0.75); }
  }

  /* ==============================================================================
     ETAPA 4: Seção "✦ Como ganhar XP"
     ============================================================================== */
  .how-to-earn-xp-section {
    background: linear-gradient(135deg, rgba(20, 12, 38, 0.7), rgba(30, 16, 56, 0.75));
    border: 1px solid rgba(168, 85, 247, 0.25);
    border-radius: 16px;
    padding: 1.5rem;
    margin-bottom: 2rem;
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.35), inset 0 0 20px rgba(168, 85, 247, 0.05);
    backdrop-filter: blur(12px);
  }

  .xp-section-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 1rem;
    margin-bottom: 1.25rem;
    padding-bottom: 0.85rem;
    border-bottom: 1px solid rgba(255, 255, 255, 0.07);
  }

  .xp-header-title-wrap {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .xp-badge-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    border-radius: 10px;
    background: linear-gradient(135deg, #a855f7, #f59e0b);
    color: #ffffff;
    box-shadow: 0 0 12px rgba(168, 85, 247, 0.4);
  }

  .xp-section-title {
    font-size: 1.35rem;
    font-weight: 800;
    letter-spacing: -0.02em;
    color: #ffffff;
    margin: 0;
    text-shadow: 0 2px 8px rgba(0, 0, 0, 0.5);
  }

  .btn-toggle-xp-rules {
    display: inline-flex;
    align-items: center;
    gap: 0.45rem;
    background: rgba(168, 85, 247, 0.12);
    border: 1px solid rgba(168, 85, 247, 0.3);
    color: #c4b5fd;
    padding: 0.45rem 0.85rem;
    border-radius: 9999px;
    font-size: 0.82rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .btn-toggle-xp-rules:hover {
    background: rgba(168, 85, 247, 0.25);
    color: #ffffff;
    border-color: rgba(168, 85, 247, 0.6);
  }

  .xp-activities-grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 1.15rem;
  }

  @media (max-width: 1024px) {
    .xp-activities-grid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 1rem;
    }
  }

  .xp-activity-card {
    background: rgba(15, 12, 28, 0.6);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 12px;
    padding: 1.15rem;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    transition: transform 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease;
  }

  .xp-activity-card:hover {
    transform: translateY(-2px);
    border-color: rgba(168, 85, 247, 0.4);
    box-shadow: 0 6px 20px rgba(0, 0, 0, 0.4), 0 0 15px rgba(168, 85, 247, 0.15);
  }

  .xp-activity-card.featured {
    border-color: rgba(245, 158, 11, 0.35);
    background: linear-gradient(135deg, rgba(25, 16, 42, 0.8), rgba(35, 18, 55, 0.75));
  }

  .activity-top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 0.25rem;
  }

  .activity-icon-wrap {
    width: 36px;
    height: 36px;
    border-radius: 10px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #ffffff;
  }

  .activity-icon-wrap.read {
    background: rgba(168, 85, 247, 0.2);
    border: 1px solid rgba(168, 85, 247, 0.4);
    color: #c4b5fd;
  }

  .activity-icon-wrap.fav {
    background: rgba(244, 63, 94, 0.2);
    border: 1px solid rgba(244, 63, 94, 0.4);
    color: #fda4af;
  }

  .activity-icon-wrap.rate {
    background: rgba(245, 158, 11, 0.2);
    border: 1px solid rgba(245, 158, 11, 0.4);
    color: #fde68a;
  }

  .activity-icon-wrap.comment {
    background: rgba(56, 189, 248, 0.2);
    border: 1px solid rgba(56, 189, 248, 0.4);
    color: #bae6fd;
  }

  .activity-icon-wrap.reply {
    background: rgba(99, 102, 241, 0.2);
    border: 1px solid rgba(99, 102, 241, 0.4);
    color: #c7d2fe;
  }

  .activity-icon-wrap.like {
    background: rgba(16, 185, 129, 0.2);
    border: 1px solid rgba(16, 185, 129, 0.4);
    color: #a7f3d0;
  }

  .activity-reward-badge {
    padding: 0.25rem 0.65rem;
    border-radius: 9999px;
    background: rgba(245, 158, 11, 0.15);
    border: 1px solid rgba(245, 158, 11, 0.45);
    color: #fbbf24;
    font-size: 0.85rem;
    font-weight: 800;
    text-shadow: 0 0 8px rgba(251, 191, 36, 0.4);
  }

  .activity-name {
    font-size: 1rem;
    font-weight: 700;
    color: #f8fafc;
    margin: 0;
  }

  .activity-desc {
    font-size: 0.84rem;
    color: #94a3b8;
    line-height: 1.45;
    margin: 0;
    flex-grow: 1;
  }

  .activity-footer {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem;
    margin-top: 0.35rem;
  }

  .activity-tag {
    font-size: 0.72rem;
    font-weight: 600;
    color: #cbd5e1;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.08);
    padding: 0.18rem 0.5rem;
    border-radius: 6px;
  }

  .xp-detailed-rules-panel {
    margin-top: 1.5rem;
    padding-top: 1.25rem;
    border-top: 1px solid rgba(255, 255, 255, 0.08);
    animation: fadeInRules 0.25s ease forwards;
  }

  @keyframes fadeInRules {
    from { opacity: 0; transform: translateY(-4px); }
    to { opacity: 1; transform: translateY(0); }
  }

  .rules-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
    gap: 1rem;
  }

  .rule-box {
    background: rgba(12, 10, 22, 0.7);
    border: 1px solid rgba(168, 85, 247, 0.2);
    border-radius: 10px;
    padding: 1rem;
  }

  .rule-title {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.92rem;
    font-weight: 700;
    color: #e2e8f0;
    margin: 0 0 0.5rem 0;
  }

  :global(.rule-icon) {
    color: #a855f7;
    flex-shrink: 0;
  }

  .rule-box p {
    font-size: 0.82rem;
    color: #94a3b8;
    line-height: 1.5;
    margin: 0;
  }

  .rule-box p strong {
    color: #f1f5f9;
  }

  @media (max-width: 640px) {
    .how-to-earn-xp-section {
      padding: 1.15rem;
      margin-bottom: 1.5rem;
    }
    .xp-section-title {
      font-size: 1.18rem;
    }
    .xp-activities-grid {
      grid-template-columns: 1fr;
      gap: 0.75rem;
    }
    .btn-toggle-xp-rules {
      width: 100%;
      justify-content: center;
    }
  }

  /* Categories Navigation Bar with Mobile Indicators */
  .categories-nav-wrapper {
    position: relative;
    width: 100%;
    margin-bottom: 0.5rem;
    overflow: hidden;
  }

  .categories-bar {
    display: flex;
    gap: 0.5rem;
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
    overflow-x: auto;
    padding-bottom: 0.5rem;
    scroll-behavior: smooth;
    -webkit-overflow-scrolling: touch;
    scrollbar-width: none;
  }

  .categories-bar::-webkit-scrollbar {
    display: none;
  }

  .cat-scroll-arrow {
    display: none;
    position: absolute;
    top: calc(50% - 4px);
    transform: translateY(-50%);
    width: 32px;
    height: 32px;
    border-radius: 50%;
    background: rgba(15, 18, 29, 0.95);
    border: 1px solid rgba(139, 92, 246, 0.45);
    color: #c4b5fd;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    z-index: 10;
    box-shadow: 0 4px 14px rgba(0, 0, 0, 0.7);
    opacity: 0;
    pointer-events: none;
    transition: opacity 0.2s ease, transform 0.15s ease, background 0.2s ease;
  }

  .cat-scroll-arrow.left {
    left: 4px;
  }

  .cat-scroll-arrow.right {
    right: 4px;
  }

  .cat-scroll-arrow.visible {
    opacity: 1;
    pointer-events: auto;
  }

  .cat-scroll-arrow:active {
    transform: translateY(-50%) scale(0.92);
  }

  .cat-scroll-arrow:hover {
    background: rgba(139, 92, 246, 0.25);
    color: #ffffff;
  }

  .cat-edge-fade {
    display: none;
    position: absolute;
    top: 0;
    bottom: 0;
    width: 36px;
    pointer-events: none;
    z-index: 5;
    opacity: 0;
    transition: opacity 0.2s ease;
  }

  .cat-edge-fade.left {
    left: 0;
    background: linear-gradient(to right, #0b0e17 30%, transparent);
  }

  .cat-edge-fade.right {
    right: 0;
    background: linear-gradient(to left, #0b0e17 30%, transparent);
  }

  .cat-edge-fade.visible {
    opacity: 1;
  }

  .mobile-swipe-hint {
    display: none;
    align-items: center;
    justify-content: center;
    gap: 8px;
    font-size: 0.73rem;
    font-weight: 600;
    color: #a78bfa;
    margin: 0 0 1.25rem;
    opacity: 0.9;
    letter-spacing: 0.02em;
  }

  .mobile-swipe-hint .swipe-arrow {
    font-size: 0.95rem;
    color: #c4b5fd;
    animation: hintNudge 1.8s ease-in-out infinite;
  }

  @keyframes hintNudge {
    0%, 100% { transform: translateX(0); }
    50% { transform: translateX(3px); }
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
    color: #c4b5fd;
    border-bottom-color: #a78bfa;
  }

  .cat-count {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 0.15rem 0.55rem;
    border-radius: 9999px;
    background: rgba(255, 255, 255, 0.08);
    font-size: 0.72rem;
    font-weight: 700;
    color: #94a3b8;
  }

  .cat-btn.active .cat-count {
    background: rgba(167, 139, 250, 0.25);
    color: #e9d5ff;
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
    border-color: #a78bfa;
    color: #a78bfa;
    background: rgba(167, 139, 250, 0.15);
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
    grid-template-columns: repeat(4, 1fr);
    gap: 1.25rem;
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

  @keyframes gradientFlow {
    0% { background-position: 0% 50%; }
    50% { background-position: 100% 50%; }
    100% { background-position: 0% 50%; }
  }

  @keyframes glowPulse {
    0%, 100% { filter: brightness(1) drop-shadow(0 0 2px currentColor); transform: scale(1); }
    50% { filter: brightness(1.22) drop-shadow(0 0 8px currentColor); transform: scale(1.02); }
  }

  .color-demo-text {
    font-size: 1.4rem;
    font-weight: 800;
    display: inline-block;
    transition: transform 0.2s ease;
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
    background: rgba(16, 185, 129, 0.2);
    color: #6ee7b7;
    border: 1px solid rgba(16, 185, 129, 0.45);
  }

  .status-pill.owned {
    background: rgba(56, 189, 248, 0.15);
    color: #7dd3fc;
    border: 1px solid rgba(56, 189, 248, 0.35);
  }

  .item-desc {
    font-size: 0.85rem;
    color: #94a3b8;
    line-height: 1.5;
    margin: 0 0 1.25rem;
    flex: 1;
  }

  /* Card Color Variants */
  .card-color-swatches {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin: -0.5rem 0 0.85rem;
    padding: 0.35rem 0.6rem;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.07);
    border-radius: 8px;
  }

  .swatches-label {
    font-size: 0.72rem;
    color: #94a3b8;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  .swatches-list {
    display: flex;
    align-items: center;
    gap: 0.4rem;
  }

  .swatch-btn {
    width: 17px;
    height: 17px;
    border-radius: 50%;
    border: 2px solid rgba(255, 255, 255, 0.25);
    padding: 0;
    cursor: pointer;
    transition: all 0.15s ease;
    box-sizing: border-box;
  }

  .swatch-btn:hover {
    transform: scale(1.25);
    border-color: #ffffff;
  }

  .swatch-btn.active {
    transform: scale(1.3);
    border-color: #ffffff;
    box-shadow: 0 0 8px rgba(255, 255, 255, 0.6);
  }

  /* Modal Color Variants */
  .modal-variants-block {
    margin-bottom: 1.25rem;
    padding: 0.85rem 1rem;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 12px;
  }

  .variants-title-row {
    display: flex;
    align-items: center;
    gap: 0.45rem;
    margin-bottom: 0.75rem;
    color: #c4b5fd;
  }

  .variants-heading {
    font-size: 0.8rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  .modal-swatches-grid {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
  }

  .modal-swatch-chip {
    display: inline-flex;
    align-items: center;
    gap: 0.45rem;
    padding: 0.35rem 0.65rem;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 8px;
    color: #cbd5e1;
    font-size: 0.76rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .modal-swatch-chip:hover {
    background: rgba(255, 255, 255, 0.08);
    border-color: rgba(255, 255, 255, 0.3);
    color: #ffffff;
  }

  .modal-swatch-chip.active {
    background: rgba(139, 92, 246, 0.2);
    border-color: #a78bfa;
    color: #ffffff;
    box-shadow: 0 0 10px rgba(167, 139, 250, 0.3);
  }

  .chip-color-dot {
    width: 12px;
    height: 12px;
    border-radius: 50%;
    flex-shrink: 0;
    border: 1px solid rgba(255, 255, 255, 0.3);
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
    color: #fbbf24;
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

  .card-actions {
    display: flex;
    gap: 0.45rem;
    margin-top: auto;
  }

  .btn-action-test {
    padding: 0.7rem 0.85rem;
    border-radius: 10px;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.1);
    color: #c4b5fd;
    font-size: 0.82rem;
    font-weight: 700;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.35rem;
    transition: all 0.2s ease;
    flex-shrink: 0;
  }

  .btn-action-test:hover {
    background: rgba(139, 92, 246, 0.2);
    border-color: rgba(139, 92, 246, 0.4);
    color: #ffffff;
  }

  .btn-action {
    flex: 1;
    min-width: 0;
    padding: 0.7rem 0.85rem;
    border-radius: 10px;
    font-size: 0.82rem;
    font-weight: 700;
    border: none;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.35rem;
    transition: all 0.2s ease;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
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
    background: rgba(16, 185, 129, 0.18);
    border: 1px solid rgba(16, 185, 129, 0.45);
    color: #6ee7b7;
  }

  .btn-action.equip:hover {
    background: rgba(16, 185, 129, 0.28);
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
    background: rgba(0, 0, 0, 0.85);
    backdrop-filter: blur(14px);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 1.5rem;
    z-index: 200;
    animation: modalFadeIn 0.2s ease-out;
  }

  .modal-card {
    background: #0f121d;
    border: 1px solid rgba(139, 92, 246, 0.3);
    border-radius: 20px;
    width: 100%;
    max-width: 880px;
    position: relative;
    box-shadow: 0 25px 60px -15px rgba(0, 0, 0, 0.95), 0 0 40px rgba(139, 92, 246, 0.12);
    overflow: hidden;
    animation: modalScaleUp 0.25s cubic-bezier(0.16, 1, 0.3, 1);
  }

  @keyframes modalFadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  @keyframes modalScaleUp {
    from {
      opacity: 0;
      transform: scale(0.95) translateY(12px);
    }
    to {
      opacity: 1;
      transform: scale(1) translateY(0);
    }
  }

  .btn-modal-close {
    position: absolute;
    top: 1.25rem;
    right: 1.25rem;
    background: rgba(255, 255, 255, 0.06);
    border: 1px solid rgba(255, 255, 255, 0.12);
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
    background: rgba(255, 255, 255, 0.15);
    color: #ffffff;
    transform: scale(1.05);
  }

  .modal-grid {
    display: grid;
    grid-template-columns: 1.15fr 1fr;
  }

  /* Modal Left Stage */
  .modal-stage-col {
    background: radial-gradient(circle at center, rgba(139, 92, 246, 0.14), rgba(10, 12, 20, 0.96));
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
    filter: drop-shadow(0 12px 24px rgba(0, 0, 0, 0.7));
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

  .stage-handle-sub {
    font-size: 0.78rem;
    color: #94a3b8;
    margin-top: 0.35rem;
    display: block;
  }

  /* Comment Simulation Stage */
  .comment-simulation-stage {
    display: flex;
    flex-direction: column;
    width: 100%;
  }

  .comment-simulation-label {
    font-size: 0.72rem;
    font-weight: 700;
    color: #a78bfa;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    margin-bottom: 1rem;
    text-align: center;
  }

  .simulated-comment-card {
    position: relative;
    overflow: hidden;
    background: rgba(18, 22, 35, 0.85);
    border: 1px solid rgba(255, 255, 255, 0.14);
    border-radius: 14px;
    padding: 16px 18px;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.5);
    width: 100%;
    min-height: 120px;
  }

  .simulated-comment-card.has-comment-banner {
    border-color: rgba(168, 85, 247, 0.3);
    box-shadow: 0 10px 28px rgba(0, 0, 0, 0.6), 0 0 20px rgba(168, 85, 247, 0.15);
  }

  .comment-banner-background {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    background-size: cover !important;
    background-position: center !important;
    background-repeat: no-repeat !important;
    z-index: 0;
    pointer-events: none;
  }

  .comment-banner-overlay {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    z-index: 1;
    pointer-events: none;
    background: linear-gradient(
      180deg,
      rgba(10, 14, 26, 0.76) 0%,
      rgba(10, 14, 26, 0.86) 100%
    );
    backdrop-filter: blur(0.5px);
  }

  .comment-content-layer {
    position: relative;
    z-index: 2;
    width: 100%;
  }

  .simulated-comment-content {
    display: flex;
    align-items: flex-start;
    gap: 12px;
  }

  .simulated-avatar-col {
    flex-shrink: 0;
  }

  .simulated-text-col {
    flex: 1;
    min-width: 0;
  }

  .simulated-header-line {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px;
    margin-bottom: 4px;
  }

  .simulated-author-name {
    font-size: 0.95rem;
    font-weight: 800;
    text-shadow: 0 1px 3px rgba(0, 0, 0, 0.9), 0 0 8px rgba(0, 0, 0, 0.6);
  }

  .simulated-title-tag {
    font-size: 0.7rem;
    font-weight: 700;
    padding: 0.15rem 0.5rem;
    border-radius: 9999px;
    background: rgba(223, 194, 141, 0.15);
    color: #dfc28d;
    border: 1px solid rgba(223, 194, 141, 0.35);
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.8);
  }

  .simulated-timestamp {
    font-size: 0.72rem;
    color: #94a3b8;
    margin-left: auto;
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.8);
  }

  .simulated-comment-text {
    font-size: 0.88rem;
    color: #f1f5f9;
    line-height: 1.5;
    margin: 0 0 10px;
    text-shadow: 0 1px 3px rgba(0, 0, 0, 0.85);
  }

  .simulated-footer-actions {
    display: flex;
    align-items: center;
    gap: 12px;
    font-size: 0.74rem;
    color: #cbd5e1;
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.8);
  }

  .simulated-like-pill {
    background: rgba(255, 255, 255, 0.05);
    padding: 2px 8px;
    border-radius: 9999px;
    border: 1px solid rgba(255, 255, 255, 0.08);
  }

  .simulated-reply-btn {
    cursor: default;
    color: #a78bfa;
  }

  .comment-simulation-subnote {
    font-size: 0.75rem;
    color: #94a3b8;
    text-align: center;
    margin-top: 10px;
    line-height: 1.4;
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

  .mock-identity-plate {
    display: flex;
    align-items: center;
    gap: 14px;
    background: rgba(0, 0, 0, 0.35);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 12px;
    padding: 12px 16px;
  }

  .mock-identity-text {
    display: flex;
    flex-direction: column;
    gap: 3px;
  }

  .mock-author-name-large {
    font-size: 1.15rem;
    font-weight: 800;
  }

  .mock-title-sub {
    font-size: 0.72rem;
    color: #dfc28d;
    font-weight: 700;
  }

  .mock-handle {
    font-size: 0.75rem;
    color: #64748b;
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

  .title-stage-identity-card {
    display: flex;
    align-items: center;
    gap: 16px;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 14px;
    padding: 16px 20px;
    margin-bottom: 1rem;
    width: 100%;
    max-width: 380px;
  }

  .title-stage-user-details {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 4px;
  }

  .stage-username-with-title {
    font-size: 1.05rem;
    font-weight: 800;
  }

  .title-stage-badge-large {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.4rem 1rem;
    background: rgba(223, 194, 141, 0.15);
    border: 1px solid rgba(223, 194, 141, 0.4);
    border-radius: 9999px;
    box-shadow: 0 0 20px rgba(223, 194, 141, 0.25);
    margin: 4px 0;
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
    font-size: 0.78rem;
    color: #94a3b8;
  }

  .title-stage-footer-note {
    font-size: 0.78rem;
    color: #94a3b8;
    line-height: 1.45;
    max-width: 340px;
    margin: 0 auto;
    text-align: center;
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
    color: #fbbf24;
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
    color: #fbbf24;
  }

  .calc-val.deficient {
    font-size: 0.92rem;
    font-weight: 800;
    color: #ef4444;
  }

  /* Modal Actions */
  .modal-actions-wrap {
    display: flex;
    flex-direction: column;
    gap: 0.65rem;
  }

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

  .btn-modal-secondary-close {
    width: 100%;
    padding: 0.75rem 1.25rem;
    border-radius: 10px;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.08);
    color: #94a3b8;
    font-size: 0.85rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .btn-modal-secondary-close:hover {
    background: rgba(255, 255, 255, 0.08);
    color: #ffffff;
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
    background: rgba(16, 185, 129, 0.2);
    border: 1px solid rgba(16, 185, 129, 0.5);
    color: #6ee7b7;
  }

  .btn-modal-action.equip:hover {
    background: rgba(16, 185, 129, 0.3);
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

  @media (max-width: 1200px) {
    .items-grid {
      grid-template-columns: repeat(3, 1fr);
    }
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

  @media (max-width: 768px) {
    .cat-scroll-arrow {
      display: flex;
    }

    .cat-edge-fade {
      display: block;
    }

    .mobile-swipe-hint {
      display: flex;
    }

    .categories-bar {
      padding-left: 14px;
      padding-right: 14px;
      scroll-padding: 0 36px;
    }

    .cat-btn {
      padding: 0.65rem 1rem;
      font-size: 0.85rem;
    }

    .shop-page {
      padding: 1.5rem 1rem 4rem;
    }

    .items-grid {
      grid-template-columns: repeat(2, 1fr);
      gap: 1rem;
    }

    .controls-bar {
      flex-direction: column;
      align-items: flex-start;
      gap: 0.85rem;
      padding: 0.75rem 1rem;
    }

    .rarity-filters {
      width: 100%;
      overflow-x: auto;
      padding-bottom: 0.35rem;
      flex-wrap: nowrap;
    }

    .rarity-pill-group {
      flex-wrap: nowrap;
    }

    .sort-wrap {
      width: 100%;
      justify-content: space-between;
    }

    .sort-select {
      flex: 1;
      max-width: 200px;
    }
  }

  @media (max-width: 520px) {
    .items-grid {
      grid-template-columns: 1fr;
      gap: 1rem;
    }

    .balance-card {
      width: 100%;
      justify-content: space-between;
      gap: 1rem;
      padding: 0.85rem 1rem;
    }

    .shop-title {
      font-size: 1.85rem;
    }

    .modal-backdrop {
      padding: 0.75rem;
    }

    .modal-card {
      max-height: 90vh;
      overflow-y: auto;
    }

    .modal-stage-col,
    .modal-details-col {
      padding: 1.5rem 1rem;
    }
  }
</style>

