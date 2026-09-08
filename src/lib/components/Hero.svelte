<script lang="ts">
  import { ArrowRight, BookOpen, Compass, Sparkles } from '@lucide/svelte';
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
          width="130"
          height="130"
          class="official-symbol"
          loading="eager"
        />
      </div>

      <div class="hero-badge">
        <Sparkles size={14} class="badge-icon" />
        <span>PLATAFORMA OFICIAL · MANGÁS & MANHWAS</span>
      </div>

      <h1 class="hero-title">
        PROJECT <span class="gradient-text">NOX</span>
      </h1>

      <p class="hero-tagline">
        Histórias que nascem nas sombras e conquistam a noite.
      </p>

      <div class="hero-cta-group">
        <a href="/catalogo" class="btn-primary" aria-label="Encontrar minha próxima leitura">
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
                width="280"
                height="390"
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
            <span class="spotlight-kind">{kindLabels[featuredWork.kind] || 'Mangá'}</span>
            <h2 class="spotlight-title">{featuredWork.title}</h2>
            <p class="spotlight-synopsis">{featuredWork.synopsis}</p>
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
    padding: 48px 0 64px;
    z-index: 2;
    overflow: hidden;
  }

  .hero-container {
    max-width: 1320px;
    margin: 0 auto;
    padding: 0 32px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 48px;
  }

  .hero-brand-column {
    flex: 1;
    max-width: 620px;
  }

  .brand-emblem-wrap {
    position: relative;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 24px;
  }

  .emblem-halo {
    position: absolute;
    width: 170px;
    height: 170px;
    border-radius: 50%;
    background: radial-gradient(
      circle,
      rgba(181, 154, 245, 0.42) 0%,
      rgba(201, 170, 115, 0.22) 50%,
      transparent 75%
    );
    filter: blur(28px);
    pointer-events: none;
    animation: breathingGlow 5s ease-in-out infinite alternate;
  }

  @keyframes breathingGlow {
    0% {
      opacity: 0.65;
      transform: scale(0.95);
    }
    100% {
      opacity: 1;
      transform: scale(1.1);
    }
  }

  .official-symbol {
    position: relative;
    z-index: 1;
    filter: drop-shadow(0 0 20px rgba(181, 154, 245, 0.35));
    transition: transform 0.4s cubic-bezier(0.16, 1, 0.3, 1);
  }

  .official-symbol:hover {
    transform: scale(1.04) rotate(1deg);
  }

  .hero-badge {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 6px 14px;
    border-radius: 999px;
    background: rgba(181, 154, 245, 0.08);
    border: 1px solid rgba(181, 154, 245, 0.22);
    backdrop-filter: blur(12px);
    margin-bottom: 18px;
  }

  .hero-badge span {
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.14em;
    color: #d8cefa;
  }

  :global(.hero-badge .badge-icon) {
    color: #c9aa73;
  }

  .hero-title {
    font-size: clamp(38px, 5.5vw, 68px);
    font-weight: 800;
    line-height: 1.05;
    letter-spacing: -0.04em;
    margin: 0 0 16px;
    color: #ffffff;
  }

  .gradient-text {
    background: linear-gradient(135deg, #ffffff 25%, #b59af5 70%, #c9aa73 100%);
    -webkit-background-clip: text;
    background-clip: text;
    -webkit-text-fill-color: transparent;
    display: inline-block;
  }

  .hero-tagline {
    font-size: clamp(16px, 1.8vw, 20px);
    line-height: 1.55;
    color: #a6a3b8;
    margin: 0 0 36px;
    max-width: 520px;
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
    padding: 14px 28px;
    border-radius: 12px;
    font-weight: 600;
    font-size: 15px;
    background: linear-gradient(135deg, #8b5cf6, #6d28d9);
    color: #ffffff;
    box-shadow: 0 4px 24px rgba(109, 40, 217, 0.4), inset 0 1px 1px rgba(255, 255, 255, 0.25);
    border: 1px solid rgba(255, 255, 255, 0.15);
    transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
  }

  .btn-primary:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 32px rgba(139, 92, 246, 0.55), inset 0 1px 1px rgba(255, 255, 255, 0.35);
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
    padding: 14px 24px;
    border-radius: 12px;
    font-weight: 500;
    font-size: 15px;
    background: rgba(18, 22, 36, 0.55);
    color: #d1cde0;
    border: 1px solid rgba(255, 255, 255, 0.08);
    backdrop-filter: blur(16px);
    transition: all 0.25s ease;
  }

  .btn-glass:hover {
    background: rgba(28, 33, 54, 0.7);
    color: #ffffff;
    border-color: rgba(181, 154, 245, 0.25);
    transform: translateY(-2px);
  }

  /* Spotlight Column */
  .hero-spotlight-column {
    flex-shrink: 0;
    width: 380px;
  }

  .spotlight-card {
    position: relative;
    display: flex;
    flex-direction: column;
    background: rgba(13, 16, 26, 0.7);
    border: 1px solid rgba(181, 154, 245, 0.18);
    border-radius: 20px;
    overflow: hidden;
    backdrop-filter: blur(20px);
    box-shadow: 0 20px 48px -12px rgba(0, 0, 0, 0.7), 0 0 0 1px rgba(255, 255, 255, 0.04);
    transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
  }

  .spotlight-card:hover {
    transform: translateY(-6px);
    border-color: rgba(181, 154, 245, 0.4);
    box-shadow: 0 28px 60px -12px rgba(109, 40, 217, 0.3), 0 0 30px rgba(181, 154, 245, 0.15);
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
    background: rgba(9, 11, 18, 0.85);
    border: 1px solid rgba(201, 170, 115, 0.4);
    backdrop-filter: blur(10px);
  }

  .spotlight-badge span {
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.1em;
    color: #c9aa73;
  }

  .pulse-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: #c9aa73;
    box-shadow: 0 0 8px #c9aa73;
    animation: dotPulse 2s infinite;
  }

  @keyframes dotPulse {
    0%, 100% { opacity: 1; transform: scale(1); }
    50% { opacity: 0.4; transform: scale(0.8); }
  }

  .spotlight-media {
    position: relative;
    width: 100%;
    height: 280px;
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
    padding: 16px 20px 20px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .spotlight-kind {
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.1em;
    color: #b59af5;
    text-transform: uppercase;
  }

  .spotlight-title {
    font-size: 20px;
    font-weight: 700;
    margin: 0;
    color: #ffffff;
    line-height: 1.25;
  }

  .spotlight-synopsis {
    font-size: 13px;
    line-height: 1.5;
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
    font-size: 13px;
    font-weight: 600;
    color: #c9aa73;
    transition: gap 0.2s ease;
  }

  .spotlight-card:hover .spotlight-action {
    gap: 10px;
    color: #e5c58a;
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
      padding: 28px 0 44px;
    }

    .official-symbol {
      width: 100px;
      height: 100px;
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
