<script lang="ts">
  import type { Work } from '$lib/types';
  import { kindLabels, statusLabels } from '$lib/types';
  import { BookOpen, Sparkles, AlertTriangle } from '@lucide/svelte';
  import { page } from '$app/state';

  let { work, index = 0, blurNsfw }: { work: Work; index?: number; blurNsfw?: boolean } = $props();

  let isAdult = $derived(work.content_rating === 'ADULT_18');
  let effectiveBlur = $derived(
    isAdult && (blurNsfw !== undefined ? blurNsfw : (page.data?.blurNsfw ?? true))
  );
</script>

<a class="editorial-card" href="/obra/{work.slug}" style="--stagger:{index * 40}ms">
  <div class="card-media">
    {#if work.cover_id}
      <img
        src="/media/{work.cover_id}"
        alt="Capa de {work.title}"
        loading="lazy"
        width="300"
        height="400"
        class="card-img"
        class:blurred-cover={effectiveBlur}
      />
    {:else}
      <div class="card-fallback">
        <span class="fallback-logo">NOX</span>
        <strong class="fallback-title">{work.title}</strong>
      </div>
    {/if}

    {#if isAdult}
      <span class="adult-badge-top-left">+18</span>
    {/if}

    <div class="card-badges-top-right">
      {#if work.featured}
        <span class="featured-chip"><Sparkles size={11} /> Destaque</span>
      {/if}
      <span class="kind-chip">{kindLabels[work.kind] || 'Mangá'}</span>
    </div>

    {#if effectiveBlur}
      <div class="nsfw-overlay">
        <div class="nsfw-tag">
          <AlertTriangle size={13} />
          <span>+18</span>
        </div>
      </div>
    {/if}

    <div class="card-gradient"></div>

    <div class="card-hover-action">
      <span class="action-pill"><BookOpen size={14} /> Ler Obra</span>
    </div>
  </div>

  <div class="card-meta">
    <h3 class="card-title" title={work.title}>{work.title}</h3>
    <div class="card-sub">
      <span class="card-status">{statusLabels[work.status] || work.status}</span>
      {#if work.year}
        <span class="meta-dot">·</span>
        <span class="card-year">{work.year}</span>
      {/if}
    </div>
  </div>
</a>

<style>
  .editorial-card {
    display: flex;
    flex-direction: column;
    position: relative;
    border-radius: 16px;
    background: #0d101a;
    border: 1px solid rgba(255, 255, 255, 0.06);
    overflow: hidden;
    transition: all 0.35s cubic-bezier(0.16, 1, 0.3, 1);
    animation: cardFadeIn 0.5s cubic-bezier(0.16, 1, 0.3, 1) both;
    animation-delay: var(--stagger, 0ms);
  }

  @keyframes cardFadeIn {
    from {
      opacity: 0;
      transform: translateY(12px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  .editorial-card:hover {
    transform: translateY(-6px);
    border-color: rgba(181, 154, 245, 0.35);
    box-shadow: 0 16px 36px -8px rgba(109, 40, 217, 0.28), 0 0 20px rgba(181, 154, 245, 0.12);
  }

  .card-media {
    position: relative;
    width: 100%;
    aspect-ratio: 3 / 4;
    overflow: hidden;
    background: #090a12;
  }

  .card-img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    object-position: center;
    transition: transform 0.5s cubic-bezier(0.16, 1, 0.3, 1);
  }

  .editorial-card:hover .card-img {
    transform: scale(1.05);
  }

  .card-fallback {
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 20px;
    text-align: center;
    background: linear-gradient(135deg, #0f1220, #191c32);
  }

  .fallback-logo {
    font-size: 14px;
    font-weight: 800;
    letter-spacing: 0.2em;
    color: #b59af5;
    margin-bottom: 8px;
  }

  .fallback-title {
    font-size: 16px;
    color: #ffffff;
  }

  .adult-badge-top-left {
    position: absolute;
    top: 9px;
    left: 9px;
    background: #dc2626;
    color: #ffffff;
    font-size: 10px;
    font-weight: 800;
    padding: 2px 7px;
    border-radius: 5px;
    letter-spacing: 0.04em;
    box-shadow: 0 2px 8px rgba(220, 38, 38, 0.55);
    z-index: 5;
    pointer-events: none;
  }

  .card-badges-top-right {
    position: absolute;
    top: 9px;
    right: 9px;
    display: flex;
    align-items: center;
    gap: 5px;
    z-index: 5;
    pointer-events: none;
  }

  .kind-chip {
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: #e5c58a;
    background: #080a12;
    padding: 3px 8px;
    border-radius: 6px;
    border: 1px solid rgba(201, 170, 115, 0.3);
  }

  .featured-chip {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-size: 10px;
    font-weight: 700;
    color: #ffffff;
    background: linear-gradient(135deg, #7c3aed, #6d28d9);
    padding: 3px 8px;
    border-radius: 6px;
    border: 1px solid rgba(181, 154, 245, 0.4);
  }

  .card-gradient {
    position: absolute;
    inset: 0;
    background: linear-gradient(
      to bottom,
      transparent 50%,
      rgba(10, 12, 20, 0.6) 80%,
      rgba(10, 12, 20, 0.95) 100%
    );
    pointer-events: none;
  }

  .card-hover-action {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(7, 8, 15, 0.5);
    opacity: 0;
    backdrop-filter: blur(4px);
    transition: opacity 0.3s ease;
    z-index: 3;
  }

  .editorial-card:hover .card-hover-action {
    opacity: 1;
  }

  .action-pill {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 8px 16px;
    border-radius: 999px;
    background: rgba(181, 154, 245, 0.9);
    color: #0d091e;
    font-size: 13px;
    font-weight: 700;
    box-shadow: 0 4px 16px rgba(181, 154, 245, 0.4);
    transform: translateY(6px);
    transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1);
  }

  .editorial-card:hover .action-pill {
    transform: translateY(0);
  }

  .card-meta {
    padding: 12px 14px 14px;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .card-title {
    font-size: 15px;
    font-weight: 700;
    color: #f2f0f7;
    margin: 0;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    line-height: 1.3;
    transition: color 0.2s ease;
  }

  .editorial-card:hover .card-title {
    color: #b59af5;
  }

  .card-sub {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 12px;
    color: #8c899a;
  }

  .card-status {
    color: #c9aa73;
    font-weight: 500;
  }

  .meta-dot {
    color: #4b4859;
  }

  .card-year {
    color: #7b788a;
  }

  .blurred-cover {
    filter: blur(18px) brightness(0.65);
    transform: scale(1.12);
  }

  .adult-badge {
    background: #dc2626;
    color: #ffffff;
    font-size: 10px;
    font-weight: 800;
    padding: 2px 6px;
    border-radius: 4px;
    letter-spacing: 0.04em;
    box-shadow: 0 2px 8px rgba(220, 38, 38, 0.5);
  }

  .nsfw-overlay {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 4;
    pointer-events: none;
  }

  .nsfw-tag {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 5px 10px;
    border-radius: 999px;
    background: rgba(15, 18, 29, 0.85);
    border: 1px solid rgba(239, 68, 68, 0.5);
    color: #fca5a5;
    font-size: 11px;
    font-weight: 800;
    letter-spacing: 0.08em;
    backdrop-filter: blur(8px);
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.6);
  }
</style>
