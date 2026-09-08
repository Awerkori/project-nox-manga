<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { BookOpen, ChevronLeft, ChevronRight, Info, Sparkles } from '@lucide/svelte';
  import type { Work } from '$lib/types';

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

  // Guard index if works length changes
  let currentWork = $derived(works.length > 0 ? works[currentIndex % works.length] : null);

  // Check if current featured work has reading progress
  let progressItem = $derived(
    currentWork ? continueReading.find((c: { workId: string; destinationUrl: string }) => c.workId === currentWork.id) : null
  );

  function nextSlide() {
    if (works.length <= 1) return;
    currentIndex = (currentIndex + 1) % works.length;
  }

  function prevSlide() {
    if (works.length <= 1) return;
    currentIndex = (currentIndex - 1 + works.length) % works.length;
  }

  function goToSlide(index: number) {
    currentIndex = index;
  }

  function startAutoplay() {
    if (autoplayTimer || works.length <= 1 || prefersReducedMotion) return;
    autoplayTimer = setInterval(() => {
      if (!isPaused) {
        nextSlide();
      }
    }, 8000);
  }

  function stopAutoplay() {
    if (autoplayTimer) {
      clearInterval(autoplayTimer);
      autoplayTimer = null;
    }
  }

  function handleMouseEnter() {
    isPaused = true;
  }

  function handleMouseLeave() {
    isPaused = false;
  }

  function handleTouchStart(e: TouchEvent) {
    touchStartX = e.changedTouches[0].screenX;
  }

  function handleTouchEnd(e: TouchEvent) {
    touchEndX = e.changedTouches[0].screenX;
    const diff = touchStartX - touchEndX;
    if (Math.abs(diff) > 45) {
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

{#if currentWork}
  <section
    class="hero-carousel"
    aria-label="Destaques da Plataforma"
    onmouseenter={handleMouseEnter}
    onmouseleave={handleMouseLeave}
    ontouchstart={handleTouchStart}
    ontouchend={handleTouchEnd}
  >
    <!-- Atmospheric Blurred Backdrop -->
    <div class="backdrop-wrapper" aria-hidden="true">
      {#if currentWork.cover_id}
        <img
          src="/media/{currentWork.cover_id}"
          alt=""
          class="backdrop-img"
          loading="eager"
          decoding="async"
        />
      {/if}
      <div class="backdrop-gradient-v"></div>
      <div class="backdrop-gradient-h"></div>
      <div class="backdrop-noise"></div>
    </div>

    <div class="container hero-content-container">
      <div class="hero-slide-grid">
        <!-- Left: Work Metadata and CTAs -->
        <div class="hero-info-col">
          <div class="badges-row">
            <span class="badge-destaque">
              <Sparkles size={13} class="icon-sparkle" />
              <span>EM DESTAQUE</span>
            </span>
            <span class="badge-kind">{currentWork.kind}</span>
            <span class="badge-status">
              <span class="status-dot"></span>
              {currentWork.status === 'ONGOING' ? 'Em andamento' : 'Completo'}
            </span>
          </div>

          <h1 class="hero-title">
            <a href="/obra/{currentWork.slug}">{currentWork.title}</a>
          </h1>

          <!-- Real Author / Artist metadata -->
          {#if currentWork.author || currentWork.artist}
            <div class="hero-authors">
              {#if currentWork.author}
                <span class="meta-item">
                  <span class="meta-label">Roteiro</span>
                  <span class="meta-val">{currentWork.author}</span>
                </span>
              {/if}
              {#if currentWork.artist && currentWork.artist !== currentWork.author}
                <span class="meta-sep">·</span>
                <span class="meta-item">
                  <span class="meta-label">Arte</span>
                  <span class="meta-val">{currentWork.artist}</span>
                </span>
              {/if}
            </div>
          {/if}

          <!-- Synopsis clamped -->
          {#if currentWork.synopsis}
            <p class="hero-synopsis">
              {currentWork.synopsis}
            </p>
          {/if}

          <!-- Action Buttons -->
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

        <!-- Right: Subtle 3D Protagonist Cover -->
        <div class="hero-cover-col">
          <a href="/obra/{currentWork.slug}" class="cover-perspective-frame" tabindex="-1">
            <div class="cover-3d-card">
              {#if currentWork.cover_id}
                <img
                  src="/media/{currentWork.cover_id}"
                  alt={currentWork.title}
                  class="cover-img"
                  width="280"
                  height="390"
                  loading="eager"
                  decoding="async"
                />
              {:else}
                <div class="cover-placeholder">
                  <span>NOX</span>
                </div>
              {/if}
              <!-- Subtle Gold Seal Edge -->
              <div class="cover-edge-accent"></div>
              <div class="cover-gloss"></div>
            </div>
          </a>
        </div>
      </div>

      <!-- Navigation Arrows and Indicators (if multiple works) -->
      {#if works.length > 1}
        <div class="carousel-controls">
          <button
            class="arrow-btn arrow-prev"
            onclick={prevSlide}
            aria-label="Obra anterior em destaque"
          >
            <ChevronLeft size={20} />
          </button>

          <div class="indicators-track" role="tablist" aria-label="Navegação dos destaques">
            {#each works as _, idx}
              <button
                class="indicator-pill"
                class:active={idx === currentIndex}
                onclick={() => goToSlide(idx)}
                role="tab"
                aria-selected={idx === currentIndex}
                aria-label={`Ir para destaque ${idx + 1}`}
              ></button>
            {/each}
          </div>

          <button
            class="arrow-btn arrow-next"
            onclick={nextSlide}
            aria-label="Próxima obra em destaque"
          >
            <ChevronRight size={20} />
          </button>
        </div>
      {/if}
    </div>
  </section>
{/if}

<style>
  .hero-carousel {
    position: relative;
    min-height: 480px;
    padding: 2.5rem 0 3.5rem;
    overflow: hidden;
    background: #06070c;
    border-bottom: 1px solid rgba(255, 255, 255, 0.06);
    display: flex;
    align-items: center;
  }

  /* Atmospheric Backdrop */
  .backdrop-wrapper {
    position: absolute;
    inset: 0;
    pointer-events: none;
    z-index: 1;
    overflow: hidden;
  }

  .backdrop-img {
    position: absolute;
    top: -20%;
    right: -10%;
    width: 80%;
    height: 140%;
    object-fit: cover;
    filter: blur(54px) brightness(0.28) saturate(1.3);
    transform: scale(1.1);
    opacity: 0.75;
    transition: opacity 0.8s ease;
  }

  .backdrop-gradient-v {
    position: absolute;
    inset: 0;
    background: linear-gradient(
      180deg,
      rgba(6, 7, 12, 0.6) 0%,
      rgba(6, 7, 12, 0.85) 60%,
      #06070c 100%
    );
  }

  .backdrop-gradient-h {
    position: absolute;
    inset: 0;
    background: linear-gradient(
      90deg,
      #06070c 0%,
      rgba(6, 7, 12, 0.75) 45%,
      rgba(6, 7, 12, 0.35) 100%
    );
  }

  .backdrop-noise {
    position: absolute;
    inset: 0;
    background-image: radial-gradient(rgba(223, 194, 141, 0.04) 1px, transparent 0);
    background-size: 24px 24px;
    opacity: 0.4;
  }

  /* Content Layout */
  .hero-content-container {
    position: relative;
    z-index: 2;
    width: 100%;
    max-width: 1400px;
    margin: 0 auto;
    padding: 0 1.5rem;
  }

  .hero-slide-grid {
    display: grid;
    grid-template-columns: 1fr 320px;
    gap: 3.5rem;
    align-items: center;
    min-height: 410px;
  }

  /* Info Column */
  .hero-info-col {
    display: flex;
    flex-direction: column;
    gap: 1.15rem;
    max-width: 800px;
  }

  .badges-row {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    flex-wrap: wrap;
  }

  .badge-destaque {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    padding: 0.28rem 0.75rem;
    border-radius: 9999px;
    background: rgba(223, 194, 141, 0.12);
    border: 1px solid rgba(223, 194, 141, 0.4);
    color: #dfc28d;
    font-size: 0.72rem;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    box-shadow: 0 2px 10px rgba(223, 194, 141, 0.15);
  }

  .badge-kind {
    display: inline-flex;
    align-items: center;
    padding: 0.28rem 0.65rem;
    border-radius: 9999px;
    background: rgba(181, 154, 245, 0.12);
    border: 1px solid rgba(181, 154, 245, 0.35);
    color: #cbb4ff;
    font-size: 0.72rem;
    font-weight: 600;
    letter-spacing: 0.05em;
    text-transform: uppercase;
  }

  .badge-status {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    padding: 0.28rem 0.65rem;
    border-radius: 9999px;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.08);
    color: #9da4b6;
    font-size: 0.72rem;
    font-weight: 500;
  }

  .status-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: #34d399;
    box-shadow: 0 0 8px #34d399;
  }

  .hero-title {
    margin: 0;
    font-family: 'Cinzel', serif;
    font-size: clamp(2.1rem, 3.8vw, 3.2rem);
    font-weight: 800;
    line-height: 1.15;
    letter-spacing: -0.02em;
  }

  .hero-title a {
    color: #ffffff;
    text-decoration: none;
    transition: color 0.2s ease;
  }

  .hero-title a:hover {
    color: #dfc28d;
  }

  .hero-authors {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    font-size: 0.85rem;
    color: #8c93a8;
  }

  .meta-label {
    color: #656d82;
    margin-right: 0.25rem;
  }

  .meta-val {
    color: #c5cbd8;
    font-weight: 500;
  }

  .meta-sep {
    color: #4b5263;
  }

  .hero-synopsis {
    margin: 0;
    color: #9da5b8;
    font-size: 0.95rem;
    line-height: 1.6;
    display: -webkit-box;
    -webkit-line-clamp: 3;
    line-clamp: 3;
    -webkit-box-orient: vertical;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 720px;
  }

  .hero-actions {
    display: flex;
    align-items: center;
    gap: 0.9rem;
    margin-top: 0.5rem;
    flex-wrap: wrap;
  }

  .btn-primary-hero {
    display: inline-flex;
    align-items: center;
    gap: 0.6rem;
    padding: 0.8rem 1.6rem;
    border-radius: 10px;
    background: linear-gradient(135deg, #dfc28d 0%, #c49c5e 100%);
    color: #0d0c14;
    font-weight: 700;
    font-size: 0.92rem;
    text-decoration: none;
    box-shadow: 0 6px 20px -4px rgba(223, 194, 141, 0.45);
    transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
  }

  .btn-primary-hero:hover {
    transform: translateY(-2px);
    box-shadow: 0 10px 26px -4px rgba(223, 194, 141, 0.65);
    filter: brightness(1.05);
  }

  .btn-secondary-hero {
    display: inline-flex;
    align-items: center;
    gap: 0.55rem;
    padding: 0.8rem 1.4rem;
    border-radius: 10px;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.12);
    color: #e4e7ee;
    font-weight: 600;
    font-size: 0.92rem;
    text-decoration: none;
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    transition: all 0.25s ease;
  }

  .btn-secondary-hero:hover {
    background: rgba(255, 255, 255, 0.1);
    border-color: rgba(255, 255, 255, 0.25);
    color: #ffffff;
    transform: translateY(-2px);
  }

  /* Cover Column: Subtle & Premium 3D */
  .hero-cover-col {
    display: flex;
    justify-content: center;
    align-items: center;
  }

  .cover-perspective-frame {
    perspective: 1000px;
    text-decoration: none;
    outline: none;
    display: block;
  }

  .cover-3d-card {
    position: relative;
    width: 290px;
    height: 410px;
    border-radius: 14px;
    overflow: hidden;
    transform: rotateY(-5deg) rotateX(2deg);
    transform-style: preserve-3d;
    transition: transform 0.4s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.4s ease;
    box-shadow:
      -12px 18px 40px -8px rgba(0, 0, 0, 0.85),
      0 0 28px -4px rgba(181, 154, 245, 0.2),
      0 0 0 1px rgba(255, 255, 255, 0.08);
  }

  .cover-perspective-frame:hover .cover-3d-card {
    transform: rotateY(-1deg) rotateX(0deg) translateY(-4px);
    box-shadow:
      -8px 24px 48px -6px rgba(0, 0, 0, 0.9),
      0 0 34px -2px rgba(223, 194, 141, 0.28),
      0 0 0 1px rgba(223, 194, 141, 0.3);
  }

  .cover-img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }

  .cover-placeholder {
    width: 100%;
    height: 100%;
    background: linear-gradient(135deg, #161826 0%, #0d0e17 100%);
    display: flex;
    align-items: center;
    justify-content: center;
    font-family: 'Cinzel', serif;
    font-size: 2rem;
    font-weight: 800;
    color: #dfc28d;
    letter-spacing: 0.1em;
  }

  .cover-edge-accent {
    position: absolute;
    inset: 0;
    border-radius: 14px;
    border: 1px solid rgba(223, 194, 141, 0.18);
    pointer-events: none;
  }

  .cover-gloss {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 50%;
    background: linear-gradient(180deg, rgba(255, 255, 255, 0.08) 0%, transparent 100%);
    pointer-events: none;
  }

  /* Carousel Controls */
  .carousel-controls {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 1.2rem;
    margin-top: 2rem;
  }

  .arrow-btn {
    width: 36px;
    height: 36px;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.1);
    color: #c5cbd8;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
    transition: all 0.2s ease;
  }

  .arrow-btn:hover {
    background: rgba(255, 255, 255, 0.12);
    border-color: rgba(223, 194, 141, 0.4);
    color: #dfc28d;
    transform: scale(1.06);
  }

  .indicators-track {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .indicator-pill {
    height: 6px;
    width: 12px;
    border-radius: 3px;
    background: rgba(255, 255, 255, 0.16);
    border: none;
    padding: 0;
    cursor: pointer;
    transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
  }

  .indicator-pill.active {
    width: 28px;
    background: linear-gradient(90deg, #dfc28d, #b59af5);
    box-shadow: 0 0 10px rgba(223, 194, 141, 0.5);
  }

  /* Responsive Rules */
  @media (max-width: 980px) and (min-width: 769px) {
    .hero-slide-grid {
      grid-template-columns: 1fr 260px;
      gap: 2rem;
    }

    .cover-3d-card {
      width: 250px;
      height: 350px;
    }
  }

  @media (max-width: 768px) {
    .hero-carousel {
      min-height: auto;
      padding: 1.5rem 0 2rem;
    }

    .hero-slide-grid {
      grid-template-columns: 1fr;
      gap: 1.5rem;
    }

    .hero-cover-col {
      order: -1;
      justify-content: center;
    }

    .cover-3d-card {
      width: 160px;
      height: 226px;
      border-radius: 10px;
      transform: none;
      box-shadow: 0 10px 28px rgba(0, 0, 0, 0.75);
    }

    .cover-perspective-frame:hover .cover-3d-card {
      transform: translateY(-2px);
    }

    .hero-info-col {
      align-items: center;
      text-align: center;
      gap: 0.85rem;
    }

    .badges-row {
      justify-content: center;
    }

    .hero-title {
      font-size: clamp(1.6rem, 5vw, 2.2rem);
    }

    .hero-authors {
      justify-content: center;
    }

    .hero-synopsis {
      font-size: 0.88rem;
      -webkit-line-clamp: 2;
      line-clamp: 2;
      text-align: center;
    }

    .hero-actions {
      justify-content: center;
      width: 100%;
    }

    .btn-primary-hero,
    .btn-secondary-hero {
      flex: 1;
      justify-content: center;
      min-width: 135px;
      padding: 0.75rem 1rem;
      font-size: 0.88rem;
    }

    .carousel-controls {
      margin-top: 1.2rem;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .cover-3d-card {
      transform: none !important;
      transition: none !important;
    }

    .btn-primary-hero,
    .btn-secondary-hero,
    .indicator-pill {
      transition: none !important;
      transform: none !important;
    }
  }
</style>
