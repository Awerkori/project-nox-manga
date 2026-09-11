<script lang="ts">
  import AdminPreviewHarness from './AdminPreviewHarness.svelte';
  import PublicProfile from '../../src/routes/u/[username]/+page.svelte';
  import Layout from '../../src/routes/+layout.svelte';
  import { ZoomIn, Move, X, Check, Loader2 } from '@lucide/svelte';

  let { view = 'storage' } = $props<{ view?: string }>();

  // Profile data with animated GIF avatar and banner
  const profileData: any = {
    pathname: '/u/awerkori',
    config: {},
    role: 'ADMIN',
    ageStatus: 'ADULT',
    unread: 0,
    viewerAuthenticated: true,
    isFollowing: false,
    followersCount: 142,
    followingCount: 38,
    isSelf: true,
    canViewAchievements: true,
    canViewCosmetics: true,
    canViewFavorites: true,
    canViewReadingHistory: true,
    member: {
      id: '732fbe87-5040-41fb-9983-0aedb2af44c8',
      username: 'awerkori',
      display_name: 'Awerkori',
      bio: 'Fundador e arquiteto de infraestrutura do Project Nox Manga. Monitorando os 7 pools físicos e o Fair Scheduler.',
      xp: 450,
      avatar_id: 'avatar-anim',
      banner_id: 'banner-anim',
      equipped_banner_id: null,
      avatar_frame_id: null,
      name_color: '#a855f7',
      equipped_title_id: 'Arquiteto Cósmico',
      equipped_badge_id: 'nox-supremo',
      featured_achievement_id: null,
      privacy_show_achievements: true,
      privacy_show_cosmetics: true,
      privacy_show_favorites: true,
      privacy_show_reading_history: true,
      avatar_crop: { x: 50, y: 50, zoom: 1.15 },
      banner_crop: { x: 50, y: 40, zoom: 1.0 },
      created_at: '2026-01-01T00:00:00Z'
    },
    stats: {
      chapters_read: 312,
      favorites: 1,
      achievements_unlocked: 18,
      achievements_total: 45
    },
    staffRole: 'ADMIN',
    scanRoles: [],
    cosmetics: [
      { id: 'c-1', name: 'Arquiteto Cósmico', kind: 'TITLE', description: 'Título exclusivo de staff' },
      { id: 'c-2', name: 'Moldura de Nebulosa', kind: 'AVATAR_FRAME', description: 'Moldura de energia cósmica' }
    ],
    achievements: [
      { id: 'a-1', title: 'Explorador da Nebulosa', description: 'Leu mais de 100 capítulos', rarity: 'RARA', unlocked: true, unlocked_at: '2026-08-01' },
      { id: 'a-2', title: 'Guardião dos Shards', description: 'Conectou aos 17 shards com sucesso', rarity: 'LENDARIA', unlocked: true, unlocked_at: '2026-09-11' }
    ],
    favorites: [
      {
        id: 'fav-1',
        slug: 'solo-leveling-ragnarok',
        title: 'Solo Leveling: Ragnarok',
        kind: 'MANHWA',
        status: 'ONGOING',
        cover_id: null,
        total_chapters: 48
      }
    ],
    reading: [], recentReadings: []
  };

  // Crop states
  let cropType = $state<'avatar' | 'banner'>(view === 'banner-crop' ? 'banner' : 'avatar');
  let cropZoom = $state(view === 'avatar-crop' ? 1.85 : 1.40);
  let cropX = $state(view === 'avatar-crop' ? 28 : 65);
  let cropY = $state(view === 'avatar-crop' ? 72 : 35);
  let cropPreviewUrl = $derived(cropType === 'avatar' ? '/media/avatar-anim' : '/media/banner-anim');
</script>

{#if view === 'storage'}
  <AdminPreviewHarness page="configuracoes" role="ADMIN" />
{:else if view === 'profile'}
  <Layout data={profileData}>
    <PublicProfile data={profileData} />
  </Layout>
{:else if view === 'avatar-crop' || view === 'banner-crop'}
  <div class="crop-preview-page">
    <div class="crop-modal-backdrop" role="dialog" aria-modal="true">
      <div class="crop-modal-content">
        <div class="crop-modal-header">
          <div class="header-titles">
            <h3>{cropType === 'avatar' ? 'Ajustar Foto de Perfil' : 'Ajustar Banner de Perfil'}</h3>
            <p>Ajuste o zoom e posição. GIFs animados permanecem com todos os frames.</p>
          </div>
          <button type="button" class="btn-close-modal" aria-label="Fechar">
            <X size={18} />
          </button>
        </div>

        <div class="crop-modal-notice">
          <span>Arquivo GIF animado detectado (3 frames preservados)</span>
        </div>

        <div class="crop-viewport-wrap">
          <div class="crop-viewport {cropType === 'avatar' ? 'viewport-circle' : 'viewport-banner'}">
            <img
              src={cropPreviewUrl}
              alt="Preview de enquadramento"
              class="crop-img-preview"
              style="object-position: {cropX}% {cropY}%; transform: scale({cropZoom});"
            />
          </div>
        </div>

        <div class="crop-controls">
          <div class="control-row">
            <label for="crop-zoom"><ZoomIn size={14} /> Zoom ({cropZoom.toFixed(2)}x)</label>
            <input
              id="crop-zoom"
              type="range"
              min="1"
              max="3"
              step="0.05"
              bind:value={cropZoom}
              class="range-slider"
            />
          </div>

          <div class="control-row">
            <label for="crop-x"><Move size={14} /> Posição Horizontal ({cropX}%)</label>
            <input
              id="crop-x"
              type="range"
              min="0"
              max="100"
              step="1"
              bind:value={cropX}
              class="range-slider"
            />
          </div>

          <div class="control-row">
            <label for="crop-y"><Move size={14} /> Posição Vertical ({cropY}%)</label>
            <input
              id="crop-y"
              type="range"
              min="0"
              max="100"
              step="1"
              bind:value={cropY}
              class="range-slider"
            />
          </div>
        </div>

        <div class="crop-modal-footer">
          <button type="button" class="btn-cancel">
            Cancelar
          </button>
          <button type="button" class="btn-confirm">
            <Check size={16} />
            <span>Confirmar e Salvar</span>
          </button>
        </div>
      </div>
    </div>
  </div>
{/if}

<style>
  .crop-preview-page {
    min-height: 100vh;
    background: #07040d;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .crop-modal-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(4, 7, 18, 0.88);
    backdrop-filter: blur(10px);
    z-index: 99999;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 1.5rem;
  }
  .crop-modal-content {
    background: #0d111d;
    border: 1px solid rgba(139, 92, 246, 0.3);
    border-radius: 16px;
    width: 100%;
    max-width: 540px;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.7), 0 0 30px rgba(139, 92, 246, 0.15);
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }
  .crop-modal-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    padding: 1.25rem 1.5rem;
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  }
  .crop-modal-header h3 {
    margin: 0 0 0.25rem;
    font-size: 1.15rem;
    font-weight: 700;
    color: #f3f4f6;
  }
  .crop-modal-header p {
    margin: 0;
    font-size: 0.82rem;
    color: #9ca3af;
  }
  .crop-modal-notice {
    margin: 1rem 1.5rem 0;
    padding: 0.65rem 1rem;
    background: rgba(139, 92, 246, 0.15);
    border: 1px solid rgba(139, 92, 246, 0.4);
    border-radius: 8px;
    font-size: 0.85rem;
    color: #c4b5fd;
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }
  .btn-close-modal {
    background: transparent;
    border: none;
    color: #9ca3af;
    cursor: pointer;
    padding: 4px;
    border-radius: 6px;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .crop-viewport-wrap {
    padding: 1.5rem;
    background: #080b14;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .crop-viewport {
    background: #111422;
    overflow: hidden;
    position: relative;
    box-shadow: 0 0 25px rgba(139, 92, 246, 0.2);
  }
  .viewport-circle {
    width: 200px;
    height: 200px;
    border-radius: 50%;
    border: 3px solid #8b5cf6;
  }
  .viewport-banner {
    width: 100%;
    aspect-ratio: 16 / 6;
    border-radius: 12px;
    border: 2px solid #8b5cf6;
  }
  .crop-img-preview {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
    user-select: none;
    pointer-events: none;
    transition: transform 0.05s ease-out, object-position 0.05s ease-out;
  }
  .crop-controls {
    padding: 1.25rem 1.5rem;
    display: flex;
    flex-direction: column;
    gap: 0.85rem;
    background: #0d111d;
  }
  .control-row {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
  }
  .control-row label {
    font-size: 0.8rem;
    font-weight: 600;
    color: #d1d5db;
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .range-slider {
    width: 100%;
    accent-color: #8b5cf6;
    cursor: pointer;
  }
  .crop-modal-footer {
    padding: 1.25rem 1.5rem;
    background: #0a0e18;
    border-top: 1px solid rgba(255, 255, 255, 0.08);
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 0.75rem;
  }
  .btn-cancel {
    padding: 0.6rem 1.2rem;
    border-radius: 8px;
    font-size: 0.88rem;
    font-weight: 600;
    cursor: pointer;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.12);
    color: #d1d5db;
  }
  .btn-confirm {
    padding: 0.6rem 1.2rem;
    border-radius: 8px;
    font-size: 0.88rem;
    font-weight: 600;
    cursor: pointer;
    background: linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%);
    border: 1px solid #8b5cf6;
    color: #ffffff;
    display: flex;
    align-items: center;
    gap: 6px;
  }
</style>
