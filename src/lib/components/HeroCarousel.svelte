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
  let prefersReducedMotion = $state(false);

  // Smooth continuous progress & auto-advance (3.8s per slide: 3.5 - 4.0s target)
  const SLIDE_DURATION_MS = 3800;
  let progressRatio = 0; // Pure animation variable (zero Svelte reactivity tick thrashing)
  let progressFillEl: HTMLElement | null = $state(null);
  let animFrameId: number | null = null;
  let carouselSection: HTMLElement | null = $state(null);
  let isIntersecting = $state(true);
  let lastTimestamp = 0;

  // 3D Card Interactive Tilt
  let cardTiltX = $state(3);
  let cardTiltY = $state(1);
  let glareOpacity = $state(0);
  let glareX = $state(50);
  let glareY = $state(50);

  // Active work & adjacent works for multi-depth 3D stage
  let currentWork = $derived(works.length > 0 ? works[currentIndex % works.length] : null);
  let prevWork = $derived(
    works.length > 1 ? works[(currentIndex - 1 + works.length) % works.length] : null
  );
  let nextWork = $derived(
    works.length > 1 ? works[(currentIndex + 1) % works.length] : null
  );

  let heroCover = $derived(
    currentWork
      ? resolveCoverUrl(currentWork.cover_id || (currentWork as any).coverId, currentWork.slug, currentWork.id, {
          size: 'hero'
        })
      : ''
  );

  let prevCover = $derived(
    prevWork
      ? resolveCoverUrl(prevWork.cover_id || (prevWork as any).coverId, prevWork.slug, prevWork.id, {
          size: 'hero'
        })
      : ''
  );

  let nextCover = $derived(
    nextWork
      ? resolveCoverUrl(nextWork.cover_id || (nextWork as any).coverId, nextWork.slug, nextWork.id, {
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

  const preloadedCovers = new Set<string>();

  function preloadCover(work: Work | null | undefined) {
    if (!work || typeof window === 'undefined') return;
    const url = resolveCoverUrl(work.cover_id || (work as any).coverId, work.slug, work.id, { size: 'hero' });
    if (url && !preloadedCovers.has(url) && typeof Image !== 'undefined') {
      preloadedCovers.add(url);
      const img = new Image();
      img.src = url;
    }
  }

  function preloadWindow(index: number) {
    if (!works || works.length === 0) return;
    // 1. Preload active work
    preloadCover(works[index % works.length]);
    // 2. Preload upcoming work in sequence
    preloadCover(works[(index + 1) % works.length]);
    // 3. On desktop, preload previous work in 3D deck
    if (typeof window !== 'undefined' && window.innerWidth >= 768 && works.length > 2) {
      preloadCover(works[(index - 1 + works.length) % works.length]);
    }
  }

  function nextSlide(userTriggered = true) {
    if (works.length <= 1) return;
    currentIndex = (currentIndex + 1) % works.length;
    resetCardTilt();
    progressRatio = 0;
    if (progressFillEl) progressFillEl.style.transform = 'scaleX(0)';
    preloadWindow(currentIndex);
    if (userTriggered && typeof performance !== 'undefined') {
      lastTimestamp = performance.now();
    }
  }

  function prevSlide(userTriggered = true) {
    if (works.length <= 1) return;
    currentIndex = (currentIndex - 1 + works.length) % works.length;
    resetCardTilt();
    progressRatio = 0;
    if (progressFillEl) progressFillEl.style.transform = 'scaleX(0)';
    preloadWindow(currentIndex);
    if (userTriggered && typeof performance !== 'undefined') {
      lastTimestamp = performance.now();
    }
  }

  function goToSlide(index: number) {
    if (currentIndex === index) return;
    currentIndex = index;
    resetCardTilt();
    progressRatio = 0;
    if (progressFillEl) progressFillEl.style.transform = 'scaleX(0)';
    preloadWindow(currentIndex);
    if (typeof performance !== 'undefined') {
      lastTimestamp = performance.now();
    }
  }

  function handleKeyDown(e: KeyboardEvent) {
    if (e.key === 'ArrowLeft') {
      prevSlide(true);
    } else if (e.key === 'ArrowRight') {
      nextSlide(true);
    }
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

  function pauseAutoplay() {
    isPaused = true;
  }

  function resumeAutoplay() {
    isPaused = false;
    if (typeof performance !== 'undefined') {
      lastTimestamp = performance.now();
    }
  }

  function animationLoop(timestamp: number) {
    if (!lastTimestamp) lastTimestamp = timestamp;
    const delta = timestamp - lastTimestamp;
    lastTimestamp = timestamp;

    if (!isPaused && isIntersecting && !prefersReducedMotion && works.length > 1 && typeof document !== 'undefined' && !document.hidden) {
      progressRatio = Math.min(1, progressRatio + delta / SLIDE_DURATION_MS);
      if (progressFillEl) {
        progressFillEl.style.transform = `scaleX(${progressRatio})`;
      }
      if (progressRatio >= 1) {
        progressRatio = 0;
        if (progressFillEl) {
          progressFillEl.style.transform = 'scaleX(0)';
        }
        nextSlide(false);
      }
    }

    animFrameId = requestAnimationFrame(animationLoop);
  }

  function handleTouchStart(e: TouchEvent) {
    touchStartX = e.changedTouches[0].screenX;
    pauseAutoplay();
  }

  function handleTouchEnd(e: TouchEvent) {
    touchEndX = e.changedTouches[0].screenX;
    const diff = touchStartX - touchEndX;
    if (Math.abs(diff) > 40) {
      if (diff > 0) {
        nextSlide(true);
      } else {
        prevSlide(true);
      }
    }
    resumeAutoplay();
  }

  function handleVisibilityChange() {
    if (document.hidden) {
      isPaused = true;
    } else {
      resumeAutoplay();
    }
  }

  let carouselObserver: IntersectionObserver | null = null;

  onMount(() => {
    preloadWindow(currentIndex);
    prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    document.addEventListener('visibilitychange', handleVisibilityChange);

    if (typeof IntersectionObserver !== 'undefined' && carouselSection) {
      carouselObserver = new IntersectionObserver(
        (entries) => {
          isIntersecting = entries[0].isIntersecting;
        },
        { threshold: 0.05 }
      );
      carouselObserver.observe(carouselSection);
    }

    if (!prefersReducedMotion && works.length > 1) {
      lastTimestamp = performance.now();
      animFrameId = requestAnimationFrame(animationLoop);
    }
  });

  onDestroy(() => {
    if (carouselObserver) {
      carouselObserver.disconnect();
      carouselObserver = null;
    }
    if (animFrameId !== null && typeof cancelAnimationFrame !== 'undefined') {
      cancelAnimationFrame(animFrameId);
      animFrameId = null;
    }
    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    }
  });
</script>

<svelte:head>
  {#if heroCover}
    <link rel="preload" as="image" href={heroCover} fetchpriority="high" />
  {/if}
  {#if nextCover}
    <link rel="preload" as="image" href={nextCover} />
  {/if}
</svelte:head>

{#if currentWork}
  <section
    class="hero-carousel"
    bind:this={carouselSection}
    aria-label="Destaques da Plataforma"
    tabindex="0"
    role="region"
    aria-roledescription="carousel"
    onkeydown={handleKeyDown}
    onmouseenter={pauseAutoplay}
    onmouseleave={resumeAutoplay}
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
        <!-- LEFT: 3D Spatial Deck (Previous, Active, Next in 3D Depth) -->
        <div class="hero-cover-stage" aria-label="Apresentação em profundidade 3D">
          {#if prevWork && works.length > 2}
            <!-- PREVIOUS COVER (Background Left) -->
            <button
              type="button"
              class="deck-card deck-prev"
              onclick={prevSlide}
              aria-label={`Ver obra anterior: ${decodeHtmlEntities(prevWork.title)}`}
            >
              <img
                src={prevCover}
                alt={decodeHtmlEntities(prevWork.title)}
                class="deck-img"
                loading="eager"
                decoding="sync"
                use:fallbackCover
              />
              <div class="deck-shadow-veil"></div>
            </button>
          {/if}

          <!-- ACTIVE FEATURED COVER (Foreground Center) -->
          {#key currentWork.id}
            <div
              class="deck-card deck-active hero-active-card"
              onmousemove={handleCardMouseMove}
              onmouseleave={handleCardMouseLeave}
              style="--tilt-x: {cardTiltX}deg; --tilt-y: {cardTiltY}deg;"
            >
              <a
                href="/obra/{currentWork.slug}"
                class="active-card-inner"
                tabindex="-1"
                aria-label={`Ler obra em destaque: ${decodeHtmlEntities(currentWork.title)}`}
              >
                <img
                  src={heroCover}
                  alt={decodeHtmlEntities(currentWork.title)}
                  class="cover-img"
                  class:blurred-cover={effectiveBlur}
                  width="325"
                  height="465"
                  loading="eager"
                  fetchpriority="high"
                  decoding="sync"
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
              </a>
            </div>
          {/key}

          {#if nextWork && works.length > 1}
            <!-- NEXT COVER (Background Right) -->
            <button
              type="button"
              class="deck-card deck-next"
              onclick={nextSlide}
              aria-label={`Ver próxima obra: ${decodeHtmlEntities(nextWork.title)}`}
            >
              <img
                src={nextCover}
                alt={decodeHtmlEntities(nextWork.title)}
                class="deck-img"
                loading="eager"
                decoding="sync"
                use:fallbackCover
              />
              <div class="deck-shadow-veil"></div>
            </button>
          {/if}
        </div>

        <!-- RIGHT: Editorial Info, Badges, Title, Synopsis, and CTAs (Atomically Keyed to Work) -->
        {#key currentWork.id}
          <div class="hero-info-col">
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

            <!-- Synopsis (Directly below title, authors removed) -->
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
        {/key}
      </div>

      <!-- Cinematic Minimalist Progress & Navigation Controls -->
      {#if works.length > 1}
        <div class="carousel-cinematic-bar">
          <!-- Sleek Single Ambient Progress Track (Zero Number Clutter) -->
          <div
            class="progress-track-wrapper"
            role="progressbar"
            aria-label="Tempo restante da obra atual"
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <div class="progress-track">
              <div
                bind:this={progressFillEl}
                class="progress-fill"
                class:paused={isPaused}
              ></div>
            </div>
          </div>

          <!-- Glass Chevron Navigation -->
          <div class="slider-nav-arrows">
            <button
              type="button"
              class="nav-arrow-btn"
              onclick={() => prevSlide(true)}
              aria-label="Obra anterior em destaque"
            >
              <ChevronLeft size={18} />
            </button>
            <button
              type="button"
              class="nav-arrow-btn"
              onclick={() => nextSlide(true)}
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
    contain: layout style;
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
    filter: blur(80px) brightness(0.15) saturate(1.1);
    transform: scale(1.1);
    opacity: 0.16;
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
      rgba(139, 92, 246, 0.08) 0%,
      rgba(99, 102, 241, 0.04) 45%,
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

  /* Desktop Stage Layout: 3D Spatial Deck on LEFT, Editorial Info on RIGHT */
  .hero-stage {
    display: grid;
    grid-template-columns: 460px 1fr;
    gap: 3.5rem;
    align-items: center;
    min-height: 485px;
  }

  /* 3D Multi-Depth Cover Stage */
  .hero-cover-stage {
    position: relative;
    width: 460px;
    height: 485px;
    display: flex;
    align-items: center;
    justify-content: center;
    perspective: 1200px;
    perspective-origin: 50% 50%;
  }

  .deck-card {
    position: absolute;
    border-radius: 18px;
    overflow: hidden;
    transition: transform 0.45s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.45s ease, box-shadow 0.3s ease;
    transform-style: preserve-3d;
    backface-visibility: hidden;
    will-change: transform, opacity;
  }

  /* PREVIOUS CARD (Tilted Left in 3D Depth) */
  .deck-prev {
    left: 10px;
    width: 250px;
    height: 365px;
    transform: translateX(-40px) translateZ(-160px) rotateY(30deg);
    opacity: 0.42;
    z-index: 1;
    cursor: pointer;
    border: 1px solid rgba(139, 92, 246, 0.25);
    box-shadow: -12px 18px 40px rgba(0, 0, 0, 0.85);
    background: #090a14;
    padding: 0;
  }

  .deck-prev:hover {
    opacity: 0.78;
    transform: translateX(-30px) translateZ(-110px) rotateY(22deg) scale(1.04);
    border-color: rgba(168, 85, 247, 0.5);
    box-shadow: -15px 22px 45px rgba(124, 58, 237, 0.35);
  }

  /* NEXT CARD (Tilted Right in 3D Depth) */
  .deck-next {
    right: 10px;
    width: 250px;
    height: 365px;
    transform: translateX(40px) translateZ(-160px) rotateY(-30deg);
    opacity: 0.42;
    z-index: 1;
    cursor: pointer;
    border: 1px solid rgba(139, 92, 246, 0.25);
    box-shadow: 12px 18px 40px rgba(0, 0, 0, 0.85);
    background: #090a14;
    padding: 0;
  }

  .deck-next:hover {
    opacity: 0.78;
    transform: translateX(30px) translateZ(-110px) rotateY(-22deg) scale(1.04);
    border-color: rgba(168, 85, 247, 0.5);
    box-shadow: 15px 22px 45px rgba(124, 58, 237, 0.35);
  }

  .deck-img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }

  .deck-shadow-veil {
    position: absolute;
    inset: 0;
    background: linear-gradient(180deg, rgba(6, 7, 12, 0.15) 0%, rgba(6, 7, 12, 0.75) 100%);
    pointer-events: none;
    transition: opacity 0.3s ease;
  }

  .deck-card:hover .deck-shadow-veil {
    opacity: 0.3;
  }

  /* ACTIVE CARD (Center Foreground) */
  .deck-active {
    width: 325px;
    height: 465px;
    z-index: 10;
    transform: translateZ(40px) rotateX(var(--tilt-x)) rotateY(var(--tilt-y));
    transition: transform 0.15s ease-out, box-shadow 0.3s ease;
    box-shadow:
      -10px 24px 55px -6px rgba(0, 0, 0, 0.95),
      0 0 45px -4px rgba(139, 92, 246, 0.28),
      0 0 25px -2px rgba(99, 102, 241, 0.2),
      0 0 0 1px rgba(255, 255, 255, 0.12);
  }

  .deck-active:hover {
    box-shadow:
      -14px 28px 65px -6px rgba(0, 0, 0, 0.98),
      0 0 55px 0px rgba(168, 85, 247, 0.38),
      0 0 35px 2px rgba(99, 102, 241, 0.28),
      0 0 0 1px rgba(181, 154, 245, 0.45);
  }

  .active-card-inner {
    position: relative;
    width: 100%;
    height: 100%;
    display: block;
    text-decoration: none;
    outline: none;
    border-radius: 18px;
    overflow: hidden;
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
    border: 1px solid rgba(168, 85, 247, 0.35);
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
    background: rgba(139, 92, 246, 0.18);
    border: 1px solid rgba(168, 85, 247, 0.45);
    color: #c084fc;
    font-size: 0.74rem;
    font-weight: 800;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    box-shadow: 0 2px 14px rgba(139, 92, 246, 0.25);
  }

  .sparkle-anim {
    color: #c084fc;
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
    color: #c084fc;
    text-shadow: 0 0 24px rgba(168, 85, 247, 0.4);
  }

  .hero-active-card {
    animation: activeCoverIn 0.28s cubic-bezier(0.16, 1, 0.3, 1) forwards;
  }

  @keyframes activeCoverIn {
    from {
      opacity: 0.75;
      transform: translateZ(30px) scale(0.98);
    }
    to {
      opacity: 1;
      transform: translateZ(40px) scale(1);
    }
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
    background: linear-gradient(135deg, #7c3aed 0%, #6366f1 100%);
    color: #ffffff;
    font-size: 0.96rem;
    font-weight: 800;
    letter-spacing: 0.02em;
    text-decoration: none;
    box-shadow:
      0 6px 20px -2px rgba(124, 58, 237, 0.45),
      0 0 0 1px rgba(255, 255, 255, 0.2) inset;
    transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
  }

  .btn-primary-hero:hover {
    transform: translateY(-2px);
    box-shadow:
      0 10px 28px -2px rgba(124, 58, 237, 0.65),
      0 0 24px rgba(168, 85, 247, 0.5);
    filter: brightness(1.12);
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
    border-color: rgba(168, 85, 247, 0.5);
    color: #c084fc;
    transform: translateY(-2px);
  }

  /* Cinematic Minimalist Progress & Navigation Controls */
  .carousel-cinematic-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 2rem;
    padding-top: 1.25rem;
    margin-top: 0.25rem;
  }

  .progress-track-wrapper {
    flex: 1;
    max-width: 440px;
    height: 24px;
    display: flex;
    align-items: center;
  }

  .progress-track {
    position: relative;
    width: 100%;
    height: 3px;
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.08);
    overflow: hidden;
    box-shadow: 0 0 10px rgba(0, 0, 0, 0.5) inset;
  }

  .progress-fill {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    transform-origin: 0% 50%;
    background: linear-gradient(90deg, #6366f1, #a855f7, #c084fc);
    box-shadow: 0 0 10px rgba(168, 85, 247, 0.6);
    border-radius: 999px;
    will-change: transform;
    transition: opacity 0.2s ease;
  }

  .progress-fill.paused {
    opacity: 0.85;
    box-shadow: 0 0 14px rgba(168, 85, 247, 0.85);
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
    background: rgba(139, 92, 246, 0.2);
    border-color: rgba(168, 85, 247, 0.5);
    color: #c084fc;
    transform: translateY(-1px);
    box-shadow: 0 4px 14px rgba(139, 92, 246, 0.3);
  }

  /* Responsive Breakpoints */
  @media (max-width: 1024px) {
    .hero-stage {
      grid-template-columns: 360px 1fr;
      gap: 2.5rem;
    }

    .hero-cover-stage {
      width: 360px;
      height: 420px;
      perspective: 1000px;
    }

    .deck-active {
      width: 260px;
      height: 380px;
    }

    .deck-prev {
      left: 0;
      width: 200px;
      height: 295px;
      transform: translateX(-25px) translateZ(-120px) rotateY(26deg);
    }

    .deck-next {
      right: 0;
      width: 200px;
      height: 295px;
      transform: translateX(25px) translateZ(-120px) rotateY(-26deg);
    }

    .hero-title {
      font-size: 2.2rem;
    }
  }

  @media (max-width: 768px) {
    .backdrop-img {
      display: none; /* CRITICAL GECKO PERF: Disables heavy 80px Gaussian blur layer on mobile */
    }

    .hero-carousel {
      min-height: auto;
      padding: 1.25rem 0 0.85rem;
      overflow: hidden;
    }

    .hero-container {
      padding: 0 1rem;
      gap: 1.15rem;
    }

    .hero-stage {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 1.25rem;
      min-height: auto;
      text-align: center;
      width: 100%;
    }

    .hero-cover-stage {
      width: 100%;
      max-width: 260px;
      height: 315px;
      perspective: none;
      margin: 0 auto;
      position: relative;
    }

    .deck-card {
      transform-style: flat;
      will-change: auto;
    }

    .deck-prev,
    .deck-next {
      display: none; /* Removes compressed side peeks on narrow mobile screens */
    }

    .deck-active {
      position: relative;
      width: 215px;
      height: 310px;
      transform: none !important;
      margin: 0 auto;
      border-radius: 14px;
      box-shadow:
        0 14px 34px -4px rgba(0, 0, 0, 0.85),
        0 0 24px rgba(139, 92, 246, 0.28),
        0 0 0 1px rgba(255, 255, 255, 0.12);
    }

    .hero-info-col {
      align-items: center;
      gap: 0.75rem;
      max-width: 100%;
      width: 100%;
    }

    .badges-row {
      justify-content: center;
      gap: 0.4rem;
      flex-wrap: wrap;
    }

    .hero-active-card {
      animation: activeCoverInMobile 0.25s cubic-bezier(0.16, 1, 0.3, 1) forwards;
    }

    @keyframes activeCoverInMobile {
      from {
        opacity: 0.8;
        transform: scale(0.97);
      }
      to {
        opacity: 1;
        transform: scale(1);
      }
    }

    .hero-title {
      font-size: 1.48rem;
      line-height: 1.25;
      font-weight: 850;
      margin: 0.1rem 0;
      max-width: 95%;
    }

    .hero-synopsis {
      font-size: 0.86rem;
      line-height: 1.55;
      -webkit-line-clamp: 2;
      line-clamp: 2;
      color: #94a3b8;
      max-width: 94%;
      margin: 0;
    }

    .hero-actions {
      display: flex;
      flex-direction: column;
      gap: 0.65rem;
      width: 100%;
      max-width: 320px;
      margin-top: 0.35rem;
    }

    .btn-primary-hero {
      width: 100%;
      justify-content: center;
      padding: 0.8rem 1.4rem;
      min-height: 44px;
      font-size: 0.94rem;
      font-weight: 750;
      box-sizing: border-box;
    }

    .btn-secondary-hero {
      width: 100%;
      justify-content: center;
      padding: 0.75rem 1.4rem;
      min-height: 42px;
      font-size: 0.9rem;
      box-sizing: border-box;
    }

    .carousel-cinematic-bar {
      flex-direction: row;
      justify-content: space-between;
      align-items: center;
      gap: 1rem;
      padding-top: 0.5rem;
      width: 100%;
      max-width: 320px;
      margin: 0 auto;
    }

    .progress-track-wrapper {
      flex: 1;
      max-width: 200px;
    }

    .nav-arrow-btn {
      width: 38px;
      height: 38px;
      border-radius: 10px;
    }
  }

  .blurred-cover {
    filter: blur(18px) brightness(0.65);
    transform: scale(1.12);
  }
</style>