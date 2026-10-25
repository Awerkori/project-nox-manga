<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import {
    BookOpen,
    ChevronLeft,
    ChevronRight,
    Info,
    Sparkles,
    AlertTriangle,
    Eye
  } from '@lucide/svelte';
  import type { Work } from '$lib/types';
  import { kindLabels } from '$lib/types';
  import { page } from '$app/state';
  import { resolveCoverUrl, resolveOriginalCoverUrl } from '$lib/covers';
  import { decodeHtmlEntities } from '$lib/html-entities';

  type Props = {
    works: Work[];
    continueReading?: Array<{
      workId: string;
      chapterId: string;
      destinationUrl: string;
    }>;
  };

  let { works = [], continueReading = [] }: Props = $props();

  let currentIndex = $state(0);
  let isPaused = $state(false);
  let touchStartX = $state(0);
  let touchEndX = $state(0);
  let autoplayTimer: ReturnType<typeof setInterval> | null = null;
  let prefersReducedMotion = $state(false);

  // 3D Card Interactive Tilt
  let cardTiltX = $state(3);
  let cardTiltY = $state(1);
  let glareOpacity = $state(0);
  let glareX = $state(50);
  let glareY = $state(50);

  // Active work
  let currentWork = $derived(works.length > 0 ? works[currentIndex % works.length] : null);

  let heroCover = $derived(
    currentWork
      ? resolveCoverUrl(currentWork.cover_id || (currentWork as any).coverId, currentWork.slug, currentWork.id, {
          size: 'hero'
        })
      : ''
  );

  let isAdult = $derived(
    Boolean((currentWork?.content_rating || (currentWork as any)?.contentRating) === 'ADULT_18')
  );
  let effectiveBlur = $derived(isAdult && (page.data?.blurNsfw ?? true));

  // Check if current featured work has reading progress
  let progressItem = $derived(
    currentWork
      ? continueReading.find(
          (c: { workId: string; destinationUrl: string }) => c.workId === currentWork.id
        )
      : null
  );

  function formatViews(n?: number): string {
    if (!n) return '0';
    if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace('.0', '') + 'M';
    if (n >= 1_000) return (n / 1_000).toFixed(1).replace('.0', '') + 'k';
    return String(n);
  }

  function fallbackCover(node: HTMLImageElement) {
    const onError = () => {
      if (node.src.includes('size=thumb') || node.src.includes('size=hero')) {
        node.src = resolveOriginalCoverUrl(node.src);
      } else if (!node.src.endsWith('/brand/nox-symbol.webp')) {
        node.src = '/brand/nox-symbol.webp';
      }
    };
    node.addEventListener('error', onError);
    return {
      destroy() {
        node.removeEventListener('error', onError);
      }
    };
  }

  function nextSlide() {
    if (works.length <= 1) return;
    currentIndex = (currentIndex + 1) % works.length;
    resetCardTilt();
  }

  function prevSlide() {
    if (works.length <= 1) return;
    currentIndex = (currentIndex - 1 + works.length) % works.length;
    resetCardTilt();
  }

  function goToSlide(index: number) {
    if (currentIndex === index) return;
    currentIndex = index;
    resetCardTilt();
  }

  function resetCardTilt() {
    cardTiltX = 3;
    cardTiltY = 1;
    glareOpacity = 0;
  }

  function handleCardMouseMove(e: MouseEvent) {
    if (prefersReducedMotion) return;
    const card = e.currentTarget as HTMLElement;
    const rect = card.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;

    // Subtle 3D tilt: max 9 degrees
    cardTiltX = -((y - centerY) / centerY) * 7;
    cardTiltY = ((x - centerX) / centerX) * 8;

    glareX = (x / rect.width) * 100;
    glareY = (y / rect.height) * 100;
    glareOpacity = 0.28;
  }

  function handleCardMouseLeave() {
    resetCardTilt();
  }

  function startAutoplay() {
    if (autoplayTimer || works.length <= 1 || prefersReducedMotion) return;
    autoplayTimer = setInterval(() => {
      if (!isPaused) {
        nextSlide();
      }
    }, 7500);
  }

  function stopAutoplay() {
    if (autoplayTimer) {
      clearInterval(autoplayTimer);
      autoplayTimer = null;
    }
  }

  function handleTouchStart(e: TouchEvent) {
    touchStartX = e.changedTouches[0].screenX;
  }

  function handleTouchEnd(e: TouchEvent) {
    touchEndX = e.changedTouches[0].screenX;
    const diff = touchStartX - touchEndX;
    if (Math.abs(diff) > 40) {
      if (diff > 0) {
        nextSlide();
      } else {
        prevSlide();
      }
    }
  }

  function handleVisibilityChange() {
    if (document.hidden) {
      isPaused = true;
    } else {
      isPaused = false;
    }
  }

  onMount(() => {
    prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    document.addEventListener('visibilitychange', handleVisibilityChange);
    startAutoplay();
  });

  onDestroy(() => {
    stopAutoplay();
    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    }
  });
</script>

<svelte:head>
  {#if heroCover}
    <link rel="preload" as="image" href={heroCover} fetchpriority="high" />
  {/if}
</svelte:head>

{#if currentWork}
  <section
    class="hero-carousel"
    aria-label="Destaques da Plataforma"
    onmouseenter={() => (isPaused = true)}
    onmouseleave={() => (isPaused = false)}
    ontouchstart={handleTouchStart}
    ontouchend={handleTouchEnd}
  >
    <!-- Subtle Atmospheric Backdrop without Blocking Canvas Particles -->
    <div class="backdrop-wrapper" aria-hidden="true">
      <img
        src={heroCover}
        alt=""
        class="backdrop-img"
        class:blurred-cover={effectiveBlur}
        loading="eager"
        fetchpriority="low"
        decoding="async"
        use:fallbackCover
      />
      <div class="backdrop-radial-glow"></div>
    </div>

    <div class="hero-container">
      <div class="hero-stage">
        <!-- LEFT: 3D Perspective Cover Card with Hover Specular Glare -->
        <div class="hero-cover-col">
          <a
            href="/obra/{currentWork.slug}"
            class="cover-perspective-frame"
            tabindex="-1"
            onmousemove={handleCardMouseMove}
            onmouseleave={handleCardMouseLeave}
            style="--tilt-x: {cardTiltX}deg; --tilt-y: {cardTiltY}deg;"
          >
            <div class="cover-3d-card">
              <img
                src={heroCover}
                alt={decodeHtmlEntities(currentWork.title)}
                class="cover-img"
                class:blurred-cover={effectiveBlur}
                width="340"
                height="485"
                loading="eager"
                fetchpriority="high"
                decoding="async"
                use:fallbackCover
              />

              <!-- Glare Overlay -->
              <div
                class="cover-glare"
                style="--glare-x: {glareX}%; --glare-y: {glareY}%; --glare-opacity: {glareOpacity};"
              ></div>

              <!-- Badges on Cover -->
              {#if isAdult}
                <span class="adult-badge-hero">+18</span>
              {/if}

              {#if effectiveBlur}
                <div class="nsfw-overlay-hero">
                  <div class="nsfw-tag-hero">
                    <AlertTriangle size={15} />
                    <span>CONTEÚDO +18</span>
                  </div>
                </div>
              {/if}

              {#if currentWork.views_total}
                <div class="cover-views-badge" title="{currentWork.views_total} visualizações">
                  <Eye size={12} />
                  <span>{formatViews(currentWork.views_total)}</span>
                </div>
              {/if}

              <div class="cover-edge-accent"></div>
              <div class="cover-gloss"></div>
            </div>
          </a>
        </div>

        <!-- RIGHT: Editorial Info, Badges, Title, Synopsis, and CTAs -->
        <div class="hero-info-col" key={currentWork.id}>
          <!-- Badges Cluster -->
          <div class="badges-row">
            <span class="badge-destaque">
              <Sparkles size={13} class="sparkle-anim" />
              <span>EM DESTAQUE</span>
            </span>

            <span class="badge-kind">
              {kindLabels[currentWork.kind] || currentWork.kind || 'Mangá'}
            </span>

            <span class="badge-status">
              <span class="status-dot"></span>
              {currentWork.status === 'ONGOING' ? 'Em andamento' : 'Completo'}
            </span>

            {#if currentWork.year}
              <span class="badge-year">{currentWork.year}</span>
            {/if}
          </div>

          <!-- Hero Title -->
          <h1 class="hero-title">
            <a href="/obra/{currentWork.slug}" title={decodeHtmlEntities(currentWork.title)}>
              {decodeHtmlEntities(currentWork.title)}
            </a>
          </h1>

          <!-- Authors / Metadata -->
          {#if currentWork.author || currentWork.artist}
            <div class="hero-authors">
              {#if currentWork.author}
                <span class="meta-item">
                  <span class="meta-label">Roteiro:</span>
                  <span class="meta-val">{decodeHtmlEntities(currentWork.author)}</span>
                </span>
              {/if}
              {#if currentWork.artist && currentWork.artist !== currentWork.author}
                <span class="meta-sep">·</span>
                <span class="meta-item">
                  <span class="meta-label">Arte:</span>
                  <span class="meta-val">{decodeHtmlEntities(currentWork.artist)}</span>
                </span>
              {/if}
            </div>
          {/if}

          <!-- Synopsis -->
          {#if currentWork.synopsis}
            <p class="hero-synopsis">
              {decodeHtmlEntities(currentWork.synopsis)}
            </p>
          {/if}

          <!-- Action CTAs -->
          <div class="hero-actions">
            {#if progressItem}
              <a href={progressItem.destinationUrl} class="btn-primary-hero">
                <BookOpen size={18} />
                <span>Continuar Leitura</span>
              </a>
            {:else}
              <a href="/obra/{currentWork.slug}" class="btn-primary-hero">
                <BookOpen size={18} />
                <span>Começar a Ler</span>
              </a>
            {/if}

            <a href="/obra/{currentWork.slug}" class="btn-secondary-hero">
              <Info size={17} />
              <span>Ver Detalhes</span>
            </a>
          </div>
        </div>
      </div>

      <!-- Cinematic Progress & Navigation Controls -->
      {#if works.length > 1}
        <div class="carousel-cinematic-bar">
          <!-- Slide Counter -->
          <div class="slide-counter">
            <span class="curr-num">{String(currentIndex + 1).padStart(2, '0')}</span>
            <span class="counter-sep">/</span>
            <span class="total-num">{String(works.length).padStart(2, '0')}</span>
          </div>

          <!-- Slide Progress Indicators -->
          <div class="slider-indicators" role="tablist" aria-label="Indicadores dos destaques">
            {#each works as item, idx (item?.id || idx)}
              {@const isSelected = idx === currentIndex}
              <button
                type="button"
                class="indicator-pill"
                class:active={isSelected}
                onclick={() => goToSlide(idx)}
                role="tab"
                aria-selected={isSelected}
                aria-label={`Ir para destaque ${idx + 1}: ${decodeHtmlEntities(item.title)}`}
              >
                {#if isSelected && !isPaused}
                  <div class="indicator-progress-fill"></div>
                {/if}
              </button>
            {/each}
          </div>

          <!-- Glass Chevron Navigation -->
          <div class="slider-nav-arrows">
            <button
              type="button"
              class="nav-arrow-btn"
              onclick={prevSlide}
              aria-label="Obra anterior em destaque"
            >
              <ChevronLeft size={18} />
            </button>
            <button
              type="button"
              class="nav-arrow-btn"
              onclick={nextSlide}
              aria-label="Próxima obra em destaque"
            >
              <ChevronRight size={18} />
            </button>
          </div>
        </div>
      {/if}
    </div>
  </section>
{/if}

<style>
  .hero-carousel {
    position: relative;
    width: 100%;
    min-height: 520px;
    padding: 2.2rem 0 2rem;
    overflow: hidden;
    background: transparent;
    display: flex;
    align-items: center;
  }

  /* Full-Bleed Atmospheric Backdrop */
  .backdrop-wrapper {
    position: absolute;
    inset: 0;
    pointer-events: none;
    z-index: 1;
    overflow: hidden;
  }

  .backdrop-img {
    position: absolute;
    top: -15%;
    left: -10%;
    width: 120%;
    height: 130%;
    object-fit: cover;
    filter: blur(80px) brightness(0.24) saturate(1.4);
    transform: scale(1.1);
    opacity: 0.35;
    mask-image: radial-gradient(ellipse at 35% 45%, rgba(0, 0, 0, 1) 20%, rgba(0, 0, 0, 0) 70%);
    -webkit-mask-image: radial-gradient(ellipse at 35% 45%, rgba(0, 0, 0, 1) 20%, rgba(0, 0, 0, 0) 70%);
    transition: opacity 0.6s ease;
  }

  .backdrop-radial-glow {
    position: absolute;
    top: 15%;
    left: 20%;
    width: 650px;
    height: 650px;
    background: radial-gradient(
      circle,
      rgba(139, 92, 246, 0.12) 0%,
      rgba(223, 194, 141, 0.05) 45%,
      transparent 70%
    );
    pointer-events: none;
  }

  /* Container */
  .hero-container {
    position: relative;
    z-index: 2;
    width: 100%;
    max-width: 1440px;
    margin: 0 auto;
    padding: 0 2rem;
    display: flex;
    flex-direction: column;
    gap: 2rem;
  }

  /* Desktop Stage Layout: 3D Cover on LEFT, Editorial Info on RIGHT */
  .hero-stage {
    display: grid;
    grid-template-columns: 340px 1fr;
    gap: 4.5rem;
    align-items: center;
    min-height: 485px;
  }

  /* Left Cover Column with Interactive 3D Perspective */
  .hero-cover-col {
    display: flex;
    justify-content: center;
    align-items: center;
  }

  .cover-perspective-frame {
    perspective: 1100px;
    text-decoration: none;
    outline: none;
    display: block;
    transform: rotateX(var(--tilt-x)) rotateY(var(--tilt-y));
    transition: transform 0.15s ease-out;
  }

  .cover-3d-card {
    position: relative;
    width: 330px;
    height: 475px;
    border-radius: 18px;
    overflow: hidden;
    transform-style: preserve-3d;
    box-shadow:
      -18px 26px 56px -8px rgba(0, 0, 0, 0.95),
      0 0 38px -4px rgba(223, 194, 141, 0.25),
      0 0 0 1px rgba(255, 255, 255, 0.1);
    transition: box-shadow 0.3s ease;
  }

  .cover-perspective-frame:hover .cover-3d-card {
    box-shadow:
      -22px 30px 65px -8px rgba(0, 0, 0, 0.98),
      0 0 48px -2px rgba(223, 194, 141, 0.38),
      0 0 0 1px rgba(223, 194, 141, 0.45);
  }

  .cover-img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }

  /* Specular Glare Effect */
  .cover-glare {
    position: absolute;
    inset: 0;
    pointer-events: none;
    background: radial-gradient(
      circle at var(--glare-x) var(--glare-y),
      rgba(255, 255, 255, 0.5) 0%,
      rgba(255, 255, 255, 0.15) 35%,
      transparent 70%
    );
    opacity: var(--glare-opacity);
    mix-blend-mode: overlay;
    transition: opacity 0.25s ease;
  }

  .cover-views-badge {
    position: absolute;
    top: 14px;
    right: 14px;
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 0.28rem 0.65rem;
    border-radius: 8px;
    background: rgba(6, 7, 12, 0.85);
    backdrop-filter: blur(10px);
    border: 1px solid rgba(255, 255, 255, 0.15);
    color: #e2e8f0;
    font-size: 0.72rem;
    font-weight: 700;
    z-index: 5;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
  }

  .adult-badge-hero {
    position: absolute;
    top: 14px;
    left: 14px;
    background: #dc2626;
    color: #ffffff;
    font-size: 0.75rem;
    font-weight: 850;
    padding: 0.25rem 0.65rem;
    border-radius: 6px;
    letter-spacing: 0.04em;
    box-shadow: 0 4px 12px rgba(220, 38, 38, 0.6);
    z-index: 5;
  }

  .nsfw-overlay-hero {
    position: absolute;
    inset: 0;
    background: rgba(6, 7, 12, 0.75);
    backdrop-filter: blur(8px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 4;
  }

  .nsfw-tag-hero {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 1rem;
    border-radius: 9999px;
    background: rgba(220, 38, 38, 0.25);
    border: 1px solid #dc2626;
    color: #fca5a5;
    font-size: 0.8rem;
    font-weight: 700;
  }

  .cover-edge-accent {
    position: absolute;
    inset: 0;
    border-radius: 18px;
    border: 1px solid rgba(223, 194, 141, 0.25);
    pointer-events: none;
  }

  .cover-gloss {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 45%;
    background: linear-gradient(180deg, rgba(255, 255, 255, 0.09) 0%, transparent 100%);
    pointer-events: none;
  }

  /* Right Editorial Column */
  .hero-info-col {
    display: flex;
    flex-direction: column;
    gap: 1.35rem;
    max-width: 880px;
    animation: heroSlideIn 0.35s cubic-bezier(0.16, 1, 0.3, 1) forwards;
  }

  @keyframes heroSlideIn {
    from {
      opacity: 0.4;
      transform: translateY(8px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  .badges-row {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    flex-wrap: wrap;
  }

  .badge-destaque {
    display: inline-flex;
    align-items: center;
    gap: 0.45rem;
    padding: 0.35rem 0.85rem;
    border-radius: 9999px;
    background: rgba(223, 194, 141, 0.15);
    border: 1px solid rgba(223, 194, 141, 0.5);
    color: #dfc28d;
    font-size: 0.74rem;
    font-weight: 800;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    box-shadow: 0 2px 14px rgba(223, 194, 141, 0.22);
  }

  .sparkle-anim {
    color: #dfc28d;
    animation: sparkleGlow 2.5s ease-in-out infinite alternate;
  }

  @keyframes sparkleGlow {
    0% { transform: scale(0.9) rotate(0deg); opacity: 0.8; }
    100% { transform: scale(1.15) rotate(15deg); opacity: 1; }
  }

  .badge-kind {
    display: inline-flex;
    align-items: center;
    padding: 0.35rem 0.8rem;
    border-radius: 9999px;
    background: rgba(181, 154, 245, 0.15);
    border: 1px solid rgba(181, 154, 245, 0.35);
    color: #d8b4fe;
    font-size: 0.74rem;
    font-weight: 800;
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }

  .badge-status {
    display: inline-flex;
    align-items: center;
    gap: 0.45rem;
    padding: 0.35rem 0.8rem;
    border-radius: 9999px;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.12);
    color: #cbd5e1;
    font-size: 0.74rem;
    font-weight: 600;
  }

  .status-dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: #10b981;
    box-shadow: 0 0 8px #10b981;
  }

  .badge-year {
    font-size: 0.74rem;
    font-weight: 600;
    color: #71717a;
  }

  /* Title */
  .hero-title {
    margin: 0;
    font-family: 'Manrope', -apple-system, BlinkMacSystemFont, sans-serif;
    font-size: clamp(2.2rem, 3.4vw, 3.2rem);
    font-weight: 850;
    line-height: 1.15;
    letter-spacing: -0.03em;
  }

  .hero-title a {
    color: #ffffff;
    text-decoration: none;
    transition: color 0.25s ease;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  .hero-title a:hover {
    color: #dfc28d;
    text-shadow: 0 0 24px rgba(223, 194, 141, 0.3);
  }

  /* Authors */
  .hero-authors {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.88rem;
    color: #94a3b8;
    flex-wrap: wrap;
  }

  .meta-item {
    display: inline-flex;
    gap: 0.35rem;
  }

  .meta-label {
    color: #64748b;
  }

  .meta-val {
    color: #e2e8f0;
    font-weight: 600;
  }

  .meta-sep {
    color: #475569;
  }

  /* Synopsis */
  .hero-synopsis {
    margin: 0;
    font-size: 0.98rem;
    line-height: 1.68;
    color: #a1a1aa;
    display: -webkit-box;
    -webkit-line-clamp: 3;
    line-clamp: 3;
    -webkit-box-orient: vertical;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 820px;
  }

  /* Action CTAs */
  .hero-actions {
    display: flex;
    align-items: center;
    gap: 1.1rem;
    margin-top: 0.5rem;
    flex-wrap: wrap;
  }

  .btn-primary-hero {
    display: inline-flex;
    align-items: center;
    gap: 0.65rem;
    padding: 0.85rem 1.85rem;
    border-radius: 12px;
    background: linear-gradient(135deg, #dfc28d 0%, #b89552 100%);
    color: #06070c;
    font-size: 0.96rem;
    font-weight: 800;
    letter-spacing: 0.02em;
    text-decoration: none;
    box-shadow:
      0 6px 20px -2px rgba(223, 194, 141, 0.4),
      0 0 0 1px rgba(255, 255, 255, 0.2) inset;
    transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
  }

  .btn-primary-hero:hover {
    transform: translateY(-2px);
    box-shadow:
      0 10px 28px -2px rgba(223, 194, 141, 0.55),
      0 0 24px rgba(223, 194, 141, 0.4);
    filter: brightness(1.08);
  }

  .btn-secondary-hero {
    display: inline-flex;
    align-items: center;
    gap: 0.6rem;
    padding: 0.85rem 1.6rem;
    border-radius: 12px;
    background: rgba(255, 255, 255, 0.06);
    border: 1px solid rgba(255, 255, 255, 0.14);
    color: #f1f5f9;
    font-size: 0.95rem;
    font-weight: 700;
    text-decoration: none;
    backdrop-filter: blur(8px);
    transition: all 0.2s ease;
  }

  .btn-secondary-hero:hover {
    background: rgba(255, 255, 255, 0.12);
    border-color: rgba(223, 194, 141, 0.45);
    color: #dfc28d;
    transform: translateY(-2px);
  }

  /* Cinematic Progress & Navigation Controls */
  .carousel-cinematic-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 2rem;
    padding-top: 1.5rem;
    margin-top: 0.5rem;
  }

  .slide-counter {
    display: flex;
    align-items: baseline;
    gap: 4px;
    font-family: 'Manrope', -apple-system, sans-serif;
    font-weight: 800;
  }

  .curr-num {
    font-size: 1.35rem;
    color: #dfc28d;
    letter-spacing: -0.02em;
  }

  .counter-sep {
    font-size: 0.9rem;
    color: rgba(255, 255, 255, 0.25);
    margin: 0 2px;
  }

  .total-num {
    font-size: 0.88rem;
    color: rgba(255, 255, 255, 0.45);
  }

  .slider-indicators {
    display: flex;
    align-items: center;
    gap: 8px;
    flex: 1;
    max-width: 440px;
  }

  .indicator-pill {
    position: relative;
    height: 4px;
    flex: 1;
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.12);
    border: none;
    padding: 0;
    cursor: pointer;
    overflow: hidden;
    transition: background 0.25s ease, transform 0.2s ease;
  }

  .indicator-pill:hover {
    background: rgba(255, 255, 255, 0.25);
    transform: scaleY(1.4);
  }

  .indicator-pill.active {
    background: rgba(223, 194, 141, 0.25);
  }

  .indicator-progress-fill {
    position: absolute;
    inset: 0;
    background: linear-gradient(90deg, #dfc28d, #fef08a);
    box-shadow: 0 0 8px rgba(223, 194, 141, 0.7);
    animation: indicatorFillAnim 7.5s linear forwards;
  }

  @keyframes indicatorFillAnim {
    from { transform: translateX(-100%); }
    to { transform: translateX(0%); }
  }

  .slider-nav-arrows {
    display: flex;
    align-items: center;
    gap: 0.6rem;
  }

  .nav-arrow-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 40px;
    height: 40px;
    border-radius: 12px;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.1);
    color: #cbd5e1;
    cursor: pointer;
    backdrop-filter: blur(8px);
    transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
  }

  .nav-arrow-btn:hover {
    background: rgba(223, 194, 141, 0.15);
    border-color: rgba(223, 194, 141, 0.45);
    color: #dfc28d;
    transform: translateY(-1px);
    box-shadow: 0 4px 14px rgba(223, 194, 141, 0.2);
  }

  /* Responsive Breakpoints */
  @media (max-width: 1024px) {
    .hero-stage {
      grid-template-columns: 280px 1fr;
      gap: 3rem;
    }

    .cover-3d-card {
      width: 270px;
      height: 390px;
    }

    .hero-title {
      font-size: 2.2rem;
    }
  }

  @media (max-width: 768px) {
    .hero-carousel {
      min-height: auto;
      padding: 1.5rem 0;
    }

    .hero-stage {
      grid-template-columns: 1fr;
      gap: 2rem;
      min-height: auto;
      text-align: center;
    }

    .hero-cover-col {
      order: 1;
    }

    .cover-3d-card {
      width: 200px;
      height: 290px;
      border-radius: 14px;
    }

    .hero-info-col {
      order: 2;
      align-items: center;
      gap: 1rem;
    }

    .badges-row {
      justify-content: center;
    }

    .hero-title {
      font-size: 1.65rem;
    }

    .hero-authors {
      justify-content: center;
    }

    .hero-synopsis {
      font-size: 0.88rem;
      -webkit-line-clamp: 2;
      line-clamp: 2;
    }

    .hero-actions {
      justify-content: center;
      width: 100%;
    }

    .btn-primary-hero,
    .btn-secondary-hero {
      width: 100%;
      justify-content: center;
    }

    .carousel-cinematic-bar {
      flex-direction: column;
      gap: 1.25rem;
      padding-top: 1rem;
    }

    .slider-indicators {
      width: 100%;
      max-width: 280px;
    }
  }

  .blurred-cover {
    filter: blur(18px) brightness(0.65);
    transform: scale(1.12);
  }
</style>