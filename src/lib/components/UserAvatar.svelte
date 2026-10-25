<script lang="ts">
  import { avatarCropStyle } from '$lib/avatar';
  type AvatarUser = {
    avatar_id?: string | null;
    avatarId?: string | null;
    avatar_url?: string | null;
    avatarUrl?: string | null;
    avatar_crop?: unknown;
    avatarCrop?: unknown;
    display_name?: string | null;
    displayName?: string | null;
    username?: string | null;
  };
  type Props = {
    /** Supports the compact member objects used by staff/social views. */
    user?: AvatarUser | null;
    avatarId?: string | null;
    avatarUrl?: string | null;
    displayName?: string;
    size?: number;
    frameId?: string | null;
    frameUrl?: string | null;
    crop?: { x?: number; y?: number; zoom?: number } | any | null;
    loading?: 'eager' | 'lazy';
    class?: string;
  };

  let {
    user = null,
    avatarId = null,
    avatarUrl = null,
    displayName = '',
    size = 40,
    frameId = null,
    frameUrl = null,
    crop = null,
    loading = 'lazy',
    class: className = ''
  }: Props = $props();

  let resolvedAvatarId = $derived(avatarId || user?.avatar_id || user?.avatarId || null);
  let resolvedAvatarUrl = $derived(avatarUrl || user?.avatar_url || user?.avatarUrl || null);
  let resolvedDisplayName = $derived(displayName || user?.display_name || user?.displayName || user?.username || 'Leitor');
  let resolvedSrc = $derived(resolvedAvatarUrl || (resolvedAvatarId ? `/media/${resolvedAvatarId}` : null));
  let initial = $derived((resolvedDisplayName?.[0] || 'N').toUpperCase());
  let cropStyle = $derived(avatarCropStyle(crop ?? user?.avatar_crop ?? user?.avatarCrop));
  let failedSrc = $state<string | null>(null);
  $effect(() => {
    // A new media id is immutable and canonical. Reset a prior definitive
    // load failure only when that id changes; never fall back to an old asset.
    if (failedSrc && failedSrc !== resolvedSrc) failedSrc = null;
  });
</script>

<div
  class="user-avatar-root {className}"
  class:has-frame={!!frameId || !!frameUrl}
  class:frame-cosmic={frameId === 'frame_cosmic_nox'}
  class:frame-cyber={frameId === 'frame_cyber_neon'}
  class:frame-emerald={frameId === 'frame_emerald_veil'}
  class:frame-solar={frameId === 'frame_solar_flare'}
  class:frame-stardust={frameId === 'frame_particle_stardust'}
  class:frame-aurora={frameId === 'frame_aurora_mystic'}
  class:frame-void={frameId === 'frame_void_nebula'}
  class:frame-crimson={frameId === 'frame_crimson_eclipse'}
  class:frame-celestial={frameId === 'frame_celestial_sovereign' || frameId === 'frame_celestial_gold'}
  style="--avatar-size: {size}px;"
>
  <div class="avatar-inner">
    {#if resolvedSrc && failedSrc !== resolvedSrc}
      <img
        src={resolvedSrc}
        alt="Avatar de {resolvedDisplayName}"
        width={size}
        height={size}
        class="avatar-image"
        style={cropStyle}
        loading={loading}
        onerror={() => (failedSrc = resolvedSrc)}
      />
    {:else}
      <span class="avatar-fallback" style="font-size: {Math.max(12, Math.round(size * 0.42))}px;">
        {initial}
      </span>
    {/if}
  </div>

  {#if frameUrl}
    <img src={frameUrl} alt="" class="avatar-frame-image" aria-hidden="true" />
  {:else if frameId}
    <div class="avatar-frame-overlay" aria-hidden="true"></div>
  {/if}
</div>

<style>
  .user-avatar-root {
    position: relative;
    width: var(--avatar-size, 40px);
    height: var(--avatar-size, 40px);
    border-radius: 50%;
    flex-shrink: 0;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    box-sizing: border-box;
  }

  .avatar-inner {
    width: 100%;
    height: 100%;
    border-radius: 50%;
    overflow: hidden;
    position: relative;
    background: #111422;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .avatar-image {
    width: 100%;
    height: 100%;
    object-fit: cover;
    object-position: center;
    display: block;
    /* GIF animations run natively without freezing */
  }

  .avatar-fallback {
    font-weight: 800;
    color: #e6dcfe;
    letter-spacing: 0.05em;
    user-select: none;
  }

  .avatar-frame-overlay {
    position: absolute;
    inset: -3px;
    border-radius: 50%;
    pointer-events: none;
    z-index: 2;
  }

  .avatar-frame-image {
    position: absolute;
    inset: -14%;
    width: 128%;
    height: 128%;
    object-fit: contain;
    pointer-events: none;
    z-index: 2;
  }

  /* Curated Premium Cosmic Frames */
  .frame-cosmic .avatar-frame-overlay {
    border: 2px solid #a78bfa;
    box-shadow: 0 0 10px rgba(167, 139, 250, 0.65), inset 0 0 4px rgba(139, 92, 246, 0.4);
    transition: transform 0.2s ease;
  }

  .frame-cyber .avatar-frame-overlay {
    border: 2px solid #06b6d4;
    box-shadow: 0 0 12px rgba(6, 182, 212, 0.75), inset 0 0 6px rgba(8, 145, 178, 0.45);
    animation: cyberPulse 2.8s ease-in-out infinite;
  }

  .frame-emerald .avatar-frame-overlay {
    border: 2.5px solid #10b981;
    box-shadow: 0 0 14px rgba(16, 185, 129, 0.7), inset 0 0 6px rgba(52, 211, 153, 0.4);
    animation: emeraldBreathe 3.5s ease-in-out infinite;
  }

  .frame-solar .avatar-frame-overlay {
    border: 2.5px solid #f59e0b;
    box-shadow: 0 0 16px rgba(245, 158, 11, 0.85), inset 0 0 8px rgba(251, 191, 36, 0.5);
    animation: solarRotate 4s linear infinite;
  }

  .frame-stardust .avatar-frame-overlay {
    border: 2px dashed #818cf8;
    box-shadow: 0 0 16px rgba(129, 140, 248, 0.8), inset 0 0 8px rgba(192, 132, 252, 0.5);
    animation: stardustSpin 6s linear infinite;
  }

  .frame-aurora .avatar-frame-overlay {
    border: 3px solid #8b5cf6;
    box-shadow: 0 0 20px rgba(139, 92, 246, 0.85), inset 0 0 10px rgba(6, 182, 212, 0.6);
    animation: auroraWave 3.5s ease-in-out infinite;
  }

  .frame-void .avatar-frame-overlay {
    border: 3px solid #a855f7;
    box-shadow: 0 0 18px rgba(168, 85, 247, 0.85), inset 0 0 10px rgba(59, 130, 246, 0.4);
    animation: voidRotate 6s linear infinite;
  }

  .frame-crimson .avatar-frame-overlay {
    border: 3.5px solid #ef4444;
    box-shadow: 0 0 24px rgba(239, 68, 68, 0.9), inset 0 0 10px rgba(220, 38, 38, 0.6);
    animation: crimsonPulse 2.2s ease-in-out infinite;
  }

  .frame-celestial .avatar-frame-overlay {
    border: 3.5px solid #fbbf24;
    box-shadow: 0 0 28px rgba(251, 191, 36, 0.95), 0 0 14px rgba(192, 132, 252, 0.7), inset 0 0 10px rgba(255, 255, 255, 0.8);
    animation: celestialShimmer 4s ease-in-out infinite;
  }

  @keyframes cyberPulse {
    0%, 100% {
      filter: drop-shadow(0 0 4px #06b6d4);
      opacity: 0.9;
    }
    50% {
      filter: drop-shadow(0 0 12px #22d3ee);
      opacity: 1;
    }
  }

  @keyframes emeraldBreathe {
    0%, 100% {
      opacity: 0.85;
      transform: scale(1);
    }
    50% {
      opacity: 1;
      transform: scale(1.02);
      filter: drop-shadow(0 0 8px rgba(16, 185, 129, 0.8));
    }
  }

  @keyframes solarRotate {
    0% {
      transform: rotate(0deg);
      filter: drop-shadow(0 0 6px #f59e0b);
    }
    50% {
      filter: drop-shadow(0 0 14px #fbbf24);
    }
    100% {
      transform: rotate(360deg);
      filter: drop-shadow(0 0 6px #f59e0b);
    }
  }

  @keyframes stardustSpin {
    0% {
      transform: rotate(0deg);
    }
    100% {
      transform: rotate(360deg);
    }
  }

  @keyframes auroraWave {
    0%, 100% {
      opacity: 0.9;
      transform: scale(1);
      border-color: #8b5cf6;
      box-shadow: 0 0 18px rgba(139, 92, 246, 0.85);
    }
    33% {
      border-color: #06b6d4;
      box-shadow: 0 0 22px rgba(6, 182, 212, 0.85);
    }
    66% {
      border-color: #10b981;
      box-shadow: 0 0 20px rgba(16, 185, 129, 0.85);
    }
  }

  @keyframes voidRotate {
    0% {
      transform: rotate(0deg);
    }
    100% {
      transform: rotate(360deg);
    }
  }

  @keyframes crimsonPulse {
    0%, 100% {
      filter: drop-shadow(0 0 8px #ef4444);
      transform: scale(1);
    }
    50% {
      filter: drop-shadow(0 0 20px #dc2626);
      transform: scale(1.03);
    }
  }

  @keyframes celestialShimmer {
    0%, 100% {
      filter: drop-shadow(0 0 10px #fbbf24);
      transform: scale(1);
    }
    50% {
      filter: drop-shadow(0 0 24px #fef08a) drop-shadow(0 0 14px #c084fc);
      transform: scale(1.03);
    }
  }
</style>
