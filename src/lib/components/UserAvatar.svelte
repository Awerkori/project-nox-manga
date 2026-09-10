<script lang="ts">
  type Props = {
    avatarId?: string | null;
    avatarUrl?: string | null;
    displayName: string;
    size?: number;
    frameId?: string | null;
    frameUrl?: string | null;
    class?: string;
  };

  let {
    avatarId = null,
    avatarUrl = null,
    displayName,
    size = 40,
    frameId = null,
    frameUrl = null,
    class: className = ''
  }: Props = $props();

  let resolvedSrc = $derived(avatarUrl || (avatarId ? `/media/${avatarId}` : null));
  let initial = $derived((displayName?.[0] || 'N').toUpperCase());
</script>

<div
  class="user-avatar-root {className}"
  class:has-frame={!!frameId || !!frameUrl}
  class:frame-aurora={frameId === 'frame_aurora_mystic'}
  class:frame-cyber={frameId === 'frame_cyber_neon'}
  class:frame-void={frameId === 'frame_void_nebula'}
  class:frame-crimson={frameId === 'frame_crimson_eclipse'}
  class:frame-celestial={frameId === 'frame_celestial_gold'}
  style="--avatar-size: {size}px;"
>
  <div class="avatar-inner">
    {#if resolvedSrc}
      <img
        src={resolvedSrc}
        alt="Avatar de {displayName}"
        width={size}
        height={size}
        class="avatar-image"
        loading="lazy"
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

  /* Frames Styling (Discord-inspired) */
  .frame-aurora .avatar-frame-overlay {
    border: 2px solid #8b5cf6;
    box-shadow: 0 0 14px rgba(139, 92, 246, 0.75);
    animation: framePulse 3s ease-in-out infinite;
  }

  .frame-cyber .avatar-frame-overlay {
    border: 2px dashed #06b6d4;
    border-radius: 28%;
    box-shadow: 0 0 12px rgba(6, 182, 212, 0.7);
  }

  .frame-void .avatar-frame-overlay {
    border: 3px solid #a855f7;
    box-shadow: 0 0 18px rgba(168, 85, 247, 0.85), inset 0 0 10px rgba(59, 130, 246, 0.4);
    animation: voidRotate 6s linear infinite;
  }

  .frame-crimson .avatar-frame-overlay {
    border: 3px solid #ef4444;
    box-shadow: 0 0 20px rgba(239, 68, 68, 0.9);
    animation: crimsonFlicker 2s ease-in-out infinite;
  }

  .frame-celestial .avatar-frame-overlay {
    border: 3px solid #f59e0b;
    box-shadow: 0 0 22px rgba(245, 158, 11, 0.95), inset 0 0 8px rgba(253, 224, 71, 0.5);
    animation: celestialShine 4s ease-in-out infinite;
  }

  @keyframes framePulse {
    0%, 100% {
      opacity: 0.85;
      transform: scale(1);
    }
    50% {
      opacity: 1;
      transform: scale(1.04);
      filter: drop-shadow(0 0 8px rgba(139, 92, 246, 0.9));
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

  @keyframes crimsonFlicker {
    0%, 100% {
      filter: drop-shadow(0 0 6px #ef4444);
    }
    50% {
      filter: drop-shadow(0 0 16px #dc2626);
    }
  }

  @keyframes celestialShine {
    0%, 100% {
      filter: drop-shadow(0 0 8px #f59e0b);
    }
    50% {
      filter: drop-shadow(0 0 20px #fbbf24);
    }
  }
</style>
