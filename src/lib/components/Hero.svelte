<script lang="ts">
  import { ArrowRight, BookOpen, Compass } from '@lucide/svelte';
  import type { Work } from '$lib/types';
  import { kindLabels } from '$lib/types';

  let { featuredWork }: { featuredWork?: Work | null } = $props();
</script>

<section class="hero-cinematic">
  <div class="hero-container">
    <div class="hero-brand-column">
      <div class="brand-emblem-wrap">
        <div class="emblem-halo"></div>
        <img
          src="/brand/nox-symbol-256.webp"
          alt="Símbolo Oficial Project Nox"
          width="136"
          height="136"
          class="official-symbol"
          loading="eager"
        />
      </div>

      <h1 class="hero-title">
        <span class="word-project">PROJECT</span>
        <span class="word-nox">NOX</span>
      </h1>

      <p class="hero-tagline">
        Histórias que nascem nas sombras e conquistam a noite.
      </p>

      <div class="hero-cta-group">
        <a href="/catalogo" class="btn-primary" aria-label="Explorar Catálogo">
          <BookOpen size={18} />
          <span>Explorar Catálogo</span>
          <ArrowRight size={16} class="arrow-icon" />
        </a>
        <a href="#lancamentos" class="btn-glass">
          <Compass size={18} />
          <span>Lançamentos</span>
        </a>
      </div>
    </div>

    {#if featuredWork}
      <div class="hero-spotlight-column">
        <a href="/obra/{featuredWork.slug}" class="spotlight-card">
          <div class="spotlight-badge">
            <span class="pulse-dot"></span>
            <span>EM DESTAQUE</span>
          </div>
          <div class="spotlight-media">
            {#if featuredWork.cover_id}
              <img
                src="/media/{featuredWork.cover_id}"
                alt="Capa de {featuredWork.title}"
                width="320"
                height="440"
                class="spotlight-cover"
              />
            {:else}
              <div class="spotlight-placeholder">
                <span>{featuredWork.title}</span>
              </div>
            {/if}
            <div class="spotlight-overlay"></div>
          </div>
          <div class="spotlight-info">
            <div class="spotlight-meta-row">
              <span class="spotlight-kind">{kindLabels[featuredWork.kind] || 'Mangá'}</span>
              {#if featuredWork.year}
                <span class="spotlight-year">{featuredWork.year}</span>
              {/if}
            </div>
            <h2 class="spotlight-title">{featuredWork.title}</h2>
            {#if featuredWork.synopsis}
              <p class="spotlight-synopsis">{featuredWork.synopsis}</p>
            {/if}
            <div class="spotlight-action">
              <span>Começar a ler</span>
              <ArrowRight size={16} />
            </div>
          </div>
        </a>
      </div>
    {/if}
  </div>
</section>

<style>
  .hero-cinematic {
    position: relative;
    padding: 44px 0 48px;
    z-index: 2;
    overflow: hidden;
  }

  .hero-container {
    max-width: 1440px;
    margin: 0 auto;
    padding: 0 36px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 56px;
  }

  @media (min-width: 1600px) {
    .hero-container {
      max-width: 1520px;
      padding: 0 48px;
      gap: 72px;
    }
  }

  .hero-brand-column {
    flex: 1;
    max-width: 680px;
  }

  .brand-emblem-wrap {
    position: relative;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 28px;
  }

  .emblem-halo {
    position: absolute;
    width: 180px;
    height: 180px;
    border-radius: 50%;
    background: radial-gradient(
      circle,
      rgba(181, 154, 245, 0.45) 0%,
      rgba(201, 170, 115, 0.25) 50%,
      transparent 75%
    );
    filter: blur(32px);
    pointer-events: none;
    animation: breathingGlow 5s ease-in-out infinite alternate;
  }

  @keyframes breathingGlow {
    0% {
      opacity: 0.6;
      transform: scale(0.95);
    }
    100% {
      opacity: 1;
      transform: scale(1.12);
    }
  }

  .official-symbol {
    position: relative;
    z-index: 1;
    filter: drop-shadow(0 0 24px rgba(181, 154, 245, 0.4));
    transition: transform 0.4s cubic-bezier(0.16, 1, 0.3, 1);
  }

  .official-symbol:hover {
    transform: scale(1.05) rotate(1deg);
  }

  .hero-title {
    font-size: clamp(42px, 6vw, 80px);
    font-weight: 900;
    line-height: 1.02;
    letter-spacing: -0.035em;
    margin: 0 0 20px;
    display: flex;
    align-items: center;
    gap: 16px;
    flex-wrap: wrap;
  }

  .word-project {
    background: linear-gradient(135deg, #ffffff 5%, #f4e3c3 35%, #c9aa73 75%, #9b7f46 100%);
    -webkit-background-clip: text;
    background-clip: text;
    -webkit-text-fill-color: transparent;
    filter: drop-shadow(0 2px 20px rgba(201, 170, 115, 0.3));
  }

  .word-nox {
    background: linear-gradient(135deg, #ffffff 5%, #e0d5fc 35%, #b59af5 75%, #8b5cf6 100%);
    -webkit-background-clip: text;
    background-clip: text;
    -webkit-text-fill-color: transparent;
    filter: drop-shadow(0 2px 20px rgba(181, 154, 245, 0.4));
  }

  .hero-tagline {
    font-size: clamp(17px, 1.9vw, 21px);
    line-height: 1.55;
    color: #a6a3b8;
    margin: 0 0 38px;
    max-width: 560px;
  }

  .hero-cta-group {
    display: flex;
    align-items: center;
    gap: 16px;
    flex-wrap: wrap;
  }

  .btn-primary {
    display: inline-flex;
    align-items: center;
    gap: 10px;
    padding: 15px 30px;
    border-radius: 14px;
    font-weight: 650;
    font-size: 15px;
    background: linear-gradient(135deg, #8b5cf6, #6d28d9);
    color: #ffffff;
    box-shadow: 0 4px 24px rgba(109, 40, 217, 0.42), inset 0 1px 1px rgba(255, 255, 255, 0.25);
    border: 1px solid rgba(255, 255, 255, 0.15);
    transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
  }

  .btn-primary:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 32px rgba(139, 92, 246, 0.6), inset 0 1px 1px rgba(255, 255, 255, 0.35);
    background: linear-gradient(135deg, #9333ea, #7c3aed);
  }

  .btn-primary:hover :global(.arrow-icon) {
    transform: translateX(4px);
  }

  :global(.arrow-icon) {
    transition: transform 0.25s ease;
  }

  .btn-glass {
    display: inline-flex;
    align-items: center;
    gap: 10px;
    padding: 15px 26px;
    border-radius: 14px;
    font-weight: 550;
    font-size: 15px;
    background: rgba(18, 22, 36, 0.6);
    color: #d1cde0;
    border: 1px solid rgba(255, 255, 255, 0.1);
    backdrop-filter: blur(16px);
    transition: all 0.25s ease;
  }

  .btn-glass:hover {
    background: rgba(28, 33, 54, 0.8);
    color: #ffffff;
    border-color: rgba(181, 154, 245, 0.3);
    transform: translateY(-2px);
  }

  /* Spotlight Column */
  .hero-spotlight-column {
    flex-shrink: 0;
    width: min(400px, 42vw);
  }

  .spotlight-card {
    position: relative;
    display: flex;
    flex-direction: column;
    background: rgba(13, 16, 26, 0.75);
    border: 1px solid rgba(181, 154, 245, 0.22);
    border-radius: 22px;
    overflow: hidden;
    backdrop-filter: blur(24px);
    box-shadow: 0 24px 54px -12px rgba(0, 0, 0, 0.75), 0 0 0 1px rgba(255, 255, 255, 0.05);
    transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
  }

  .spotlight-card:hover {
    transform: translateY(-6px);
    border-color: rgba(181, 154, 245, 0.45);
    box-shadow: 0 32px 68px -12px rgba(109, 40, 217, 0.35), 0 0 32px rgba(181, 154, 245, 0.18);
  }

  .spotlight-badge {
    position: absolute;
    top: 14px;
    left: 14px;
    z-index: 3;
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 4px 10px;
    border-radius: 999px;
    background: rgba(9, 11, 18, 0.88);
    border: 1px solid rgba(201, 170, 115, 0.45);
    backdrop-filter: blur(10px);
  }

  .spotlight-badge span {
    font-size: 10px;
    font-weight: 750;
    letter-spacing: 0.1em;
    color: #dfc28d;
  }

  .pulse-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: #dfc28d;
    box-shadow: 0 0 8px #dfc28d;
    animation: dotPulse 2s infinite;
  }

  @keyframes dotPulse {
    0%, 100% { opacity: 1; transform: scale(1); }
    50% { opacity: 0.4; transform: scale(0.8); }
  }

  .spotlight-media {
    position: relative;
    width: 100%;
    height: 300px;
    overflow: hidden;
    background: #080910;
  }

  .spotlight-cover {
    width: 100%;
    height: 100%;
    object-fit: cover;
    object-position: center top;
    transition: transform 0.6s cubic-bezier(0.16, 1, 0.3, 1);
  }

  .spotlight-card:hover .spotlight-cover {
    transform: scale(1.05);
  }

  .spotlight-placeholder {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    background: #111422;
    color: #a6a3b8;
    font-weight: 600;
  }

  .spotlight-overlay {
    position: absolute;
    inset: 0;
    background: linear-gradient(
      to bottom,
      transparent 40%,
      rgba(13, 16, 26, 0.95) 100%
    );
  }

  .spotlight-info {
    padding: 18px 22px 22px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .spotlight-meta-row {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .spotlight-kind {
    font-size: 11px;
    font-weight: 750;
    letter-spacing: 0.1em;
    color: #b59af5;
    text-transform: uppercase;
  }

  .spotlight-year {
    font-size: 11px;
    font-weight: 600;
    color: #7b788a;
  }

  .spotlight-title {
    font-size: 22px;
    font-weight: 750;
    margin: 0;
    color: #ffffff;
    line-height: 1.25;
  }

  .spotlight-synopsis {
    font-size: 13.5px;
    line-height: 1.55;
    color: #9d99ab;
    margin: 0;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  .spotlight-action {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-top: 8px;
    font-size: 13.5px;
    font-weight: 650;
    color: #dfc28d;
    transition: gap 0.2s ease, color 0.2s ease;
  }

  .spotlight-card:hover .spotlight-action {
    gap: 10px;
    color: #f0daae;
  }

  @media (max-width: 960px) {
    .hero-container {
      flex-direction: column;
      text-align: center;
      padding: 0 20px;
      gap: 36px;
    }

    .hero-brand-column {
      max-width: 100%;
      display: flex;
      flex-direction: column;
      align-items: center;
    }

    .hero-title {
      justify-content: center;
    }

    .hero-tagline {
      margin-left: auto;
      margin-right: auto;
    }

    .hero-cta-group {
      justify-content: center;
    }

    .hero-spotlight-column {
      width: 100%;
      max-width: 360px;
    }
  }

  @media (max-width: 480px) {
    .hero-cinematic {
      padding: 32px 0 48px;
    }

    .official-symbol {
      width: 100px;
      height: 100px;
    }

    .hero-title {
      font-size: clamp(34px, 10vw, 46px);
      gap: 10px;
    }

    .hero-cta-group {
      flex-direction: column;
      width: 100%;
    }

    .btn-primary, .btn-glass {
      width: 100%;
      justify-content: center;
    }
  }
</style>
