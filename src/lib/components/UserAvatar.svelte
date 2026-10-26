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
    avatar_frame_id?: string | null;
  };
  type Props = {
    /** Supports the compact member objects used by staff/social views. */
    user?: AvatarUser | null;
    avatarId?: string | null;
    avatarUrl?: string | null;
    displayName?: string;
    size?: number;
    frameId?: string | null;
    frameColor?: string | null;
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
    frameColor = null,
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

  let rawFrameId = $derived(frameId || user?.avatar_frame_id || null);
  let parsedFrameId = $derived(rawFrameId ? rawFrameId.split(':')[0] : null);
  let parsedFrameColor = $derived(
    frameColor || (rawFrameId && rawFrameId.includes(':') ? rawFrameId.split(':')[1] : null)
  );

  let resolvedFrameKey = $derived.by(() => {
    if (!parsedFrameId) return null;
    if (parsedFrameId === 'frame_cosmic_nox') return 'cosmic';
    if (parsedFrameId === 'frame_cyber_neon') return 'cyber';
    if (parsedFrameId === 'frame_emerald_veil') return 'emerald';
    if (parsedFrameId === 'frame_solar_flare') return 'solar';
    if (parsedFrameId === 'frame_particle_stardust') return 'stardust';
    if (parsedFrameId === 'frame_aurora_mystic') return 'aurora';
    if (parsedFrameId === 'frame_crimson_eclipse') return 'crimson';
    if (parsedFrameId === 'frame_celestial_sovereign' || parsedFrameId === 'frame_celestial_gold') return 'celestial';
    // Round 3 new frames
    if (parsedFrameId === 'frame_lightning_storm') return 'lightning';
    if (parsedFrameId === 'frame_crystal_shards') return 'crystal';
    if (parsedFrameId === 'frame_void_vortex') return 'vortex';
    if (parsedFrameId === 'frame_astral_thorn_crown') return 'thorn';
    return 'legacy';
  });

  $effect(() => {
    // A new media id is immutable and canonical. Reset a prior definitive
    // load failure only when that id changes; never fall back to an old asset.
    if (failedSrc && failedSrc !== resolvedSrc) failedSrc = null;
  });
</script>

<div
  class="user-avatar-root {className}"
  class:has-frame={!!parsedFrameId || !!frameUrl}
  class:frame-cosmic={resolvedFrameKey === 'cosmic'}
  class:frame-cyber={resolvedFrameKey === 'cyber'}
  class:frame-emerald={resolvedFrameKey === 'emerald'}
  class:frame-solar={resolvedFrameKey === 'solar'}
  class:frame-stardust={resolvedFrameKey === 'stardust'}
  class:frame-aurora={resolvedFrameKey === 'aurora'}
  class:frame-crimson={resolvedFrameKey === 'crimson'}
  class:frame-celestial={resolvedFrameKey === 'celestial'}
  class:frame-lightning={resolvedFrameKey === 'lightning'}
  class:frame-crystal={resolvedFrameKey === 'crystal'}
  class:frame-vortex={resolvedFrameKey === 'vortex'}
  class:frame-thorn={resolvedFrameKey === 'thorn'}
  class:tint-blue={parsedFrameColor === 'blue'}
  class:tint-crimson={parsedFrameColor === 'crimson' || parsedFrameColor === 'red'}
  class:tint-violet={parsedFrameColor === 'violet' || parsedFrameColor === 'purple'}
  class:tint-emerald={parsedFrameColor === 'emerald' || parsedFrameColor === 'green'}
  class:tint-gold={parsedFrameColor === 'gold'}
  class:tint-cyan={parsedFrameColor === 'cyan'}
  class:tint-magenta={parsedFrameColor === 'magenta'}
  class:tint-green={parsedFrameColor === 'green'}
  class:tint-orange={parsedFrameColor === 'orange'}
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
  {:else if parsedFrameId}
    <div
      class="avatar-frame-overlay frame-{resolvedFrameKey}"
      class:tint-blue={parsedFrameColor === 'blue'}
      class:tint-crimson={parsedFrameColor === 'crimson' || parsedFrameColor === 'red'}
      class:tint-violet={parsedFrameColor === 'violet' || parsedFrameColor === 'purple'}
      class:tint-emerald={parsedFrameColor === 'emerald' || parsedFrameColor === 'green'}
      class:tint-gold={parsedFrameColor === 'gold'}
      class:tint-cyan={parsedFrameColor === 'cyan'}
      class:tint-magenta={parsedFrameColor === 'magenta'}
      class:tint-green={parsedFrameColor === 'green'}
      class:tint-orange={parsedFrameColor === 'orange'}
      aria-hidden="true"
    >
      {#if resolvedFrameKey === 'cosmic'}
        <svg viewBox="0 0 100 100" class="frame-svg" aria-hidden="true">
          <circle cx="50" cy="50" r="38" class="ring-cosmic-base" />
          <circle cx="50" cy="50" r="41.5" class="ring-cosmic-orbit" />
          <g class="cardinal-gems">
            <polygon points="50,5 53,10 50,15 47,10" class="gem-north" />
            <polygon points="50,85 53,90 50,95 47,90" class="gem-south" />
            <polygon points="5,50 10,53 15,50 10,47" class="gem-west" />
            <polygon points="85,50 90,53 95,50 90,47" class="gem-east" />
          </g>
          <g class="corner-stars">
            <path d="M22,22 L23.5,19 L25,22 L23.5,25 Z" class="star-twinkle-1" />
            <path d="M78,22 L79.5,19 L81,22 L79.5,25 Z" class="star-twinkle-2" />
            <path d="M22,78 L23.5,75 L25,78 L23.5,81 Z" class="star-twinkle-3" />
            <path d="M78,78 L79.5,75 L81,78 L79.5,81 Z" class="star-twinkle-1" />
          </g>
        </svg>

      {:else if resolvedFrameKey === 'cyber'}
        <svg viewBox="0 0 100 100" class="frame-svg" aria-hidden="true">
          <circle cx="50" cy="50" r="39" class="ring-cyber-track" />
          <circle cx="50" cy="50" r="41" class="ring-cyber-pulse" />
          <path d="M19,30 L19,19 L30,19" class="cyber-bracket" />
          <path d="M81,30 L81,19 L70,19" class="cyber-bracket" />
          <path d="M19,70 L19,81 L30,81" class="cyber-bracket" />
          <path d="M81,70 L81,81 L70,81" class="cyber-bracket" />
          <circle cx="50" cy="9" r="2.5" class="cyber-node-top" />
          <circle cx="50" cy="91" r="2.5" class="cyber-node-bottom" />
          <line x1="42" y1="9" x2="58" y2="9" class="cyber-node-line" />
          <line x1="42" y1="91" x2="58" y2="91" class="cyber-node-line" />
        </svg>

      {:else if resolvedFrameKey === 'emerald'}
        <svg viewBox="0 0 100 100" class="frame-svg" aria-hidden="true">
          <circle cx="50" cy="50" r="38.5" class="ring-emerald-inner" />
          <circle cx="50" cy="50" r="41" class="ring-emerald-vines" />
          <polygon points="50,5 54,9 50,14 46,9" class="emerald-top-gem" />
          <polygon points="50,86 54,91 50,95 46,91" class="emerald-bottom-gem" />
          <circle cx="16" cy="32" r="2" class="spore-orb-1" />
          <circle cx="84" cy="32" r="2" class="spore-orb-2" />
          <circle cx="14" cy="68" r="2.2" class="spore-orb-3" />
          <circle cx="86" cy="68" r="2.2" class="spore-orb-1" />
        </svg>

      {:else if resolvedFrameKey === 'solar'}
        <svg viewBox="0 0 100 100" class="frame-svg" aria-hidden="true">
          <g class="solar-corona-spin">
            <path d="M50,4 L53,10 L47,10 Z" class="solar-ray" />
            <path d="M73,11 L73,18 L68,14 Z" class="solar-ray" />
            <path d="M89,27 L85,33 L83,28 Z" class="solar-ray" />
            <path d="M96,50 L90,53 L90,47 Z" class="solar-ray" />
            <path d="M89,73 L83,72 L85,67 Z" class="solar-ray" />
            <path d="M73,89 L68,86 L73,82 Z" class="solar-ray" />
            <path d="M50,96 L47,90 L53,90 Z" class="solar-ray" />
            <path d="M27,89 L27,82 L32,86 Z" class="solar-ray" />
            <path d="M11,73 L17,67 L15,72 Z" class="solar-ray" />
            <path d="M4,50 L10,47 L10,53 Z" class="solar-ray" />
            <path d="M11,27 L15,28 L17,33 Z" class="solar-ray" />
            <path d="M27,11 L32,14 L27,18 Z" class="solar-ray" />
          </g>
          <circle cx="50" cy="50" r="39" class="ring-solar-base" />
          <circle cx="50" cy="50" r="41" class="ring-solar-halo" />
          <polygon points="50,2 54,8 50,13 46,8" class="solar-crown-crest" />
        </svg>

      {:else if resolvedFrameKey === 'stardust'}
        <svg viewBox="0 0 100 100" class="frame-svg" aria-hidden="true">
          <ellipse cx="50" cy="50" rx="44" ry="22" transform="rotate(-30 50 50)" class="gyro-ring-1" />
          <ellipse cx="50" cy="50" rx="44" ry="22" transform="rotate(35 50 50)" class="gyro-ring-2" />
          <circle cx="50" cy="50" r="39" class="ring-stardust-center" />
          <g class="stardust-spark-group">
            <circle cx="28" cy="18" r="2.5" class="star-particle-1" />
            <circle cx="78" cy="24" r="2.2" class="star-particle-2" />
            <circle cx="88" cy="60" r="2.8" class="star-particle-3" />
            <circle cx="20" cy="74" r="2" class="star-particle-4" />
            <circle cx="62" cy="88" r="2.5" class="star-particle-1" />
          </g>
        </svg>

      {:else if resolvedFrameKey === 'aurora'}
        <svg viewBox="0 0 100 100" class="frame-svg" aria-hidden="true">
          <circle cx="50" cy="50" r="38.5" class="ring-aurora-1" />
          <circle cx="50" cy="50" r="41" class="ring-aurora-2" />
          <circle cx="50" cy="50" r="43.5" class="ring-aurora-3" />
          <g class="aurora-gem-group">
            <polygon points="50,4 53,9 50,14 47,9" class="aurora-crest-center" />
            <polygon points="30,12 33,16 30,20 27,16" class="aurora-crest-flank-l" />
            <polygon points="70,12 73,16 70,20 67,16" class="aurora-crest-flank-r" />
          </g>
        </svg>

      {:else if resolvedFrameKey === 'crimson'}
        <svg viewBox="0 0 100 100" class="frame-svg" aria-hidden="true">
          <circle cx="50" cy="50" r="38.5" class="ring-crimson-core" />
          <circle cx="50" cy="50" r="42" class="ring-crimson-corona" />
          <path d="M24,80 Q50,96 76,80 Q50,89 24,80 Z" class="crimson-abyss-crescent" />
          <polygon points="50,3 55,10 50,15 45,10" class="crimson-spike-center" />
          <polygon points="34,10 38,15 34,19 30,14" class="crimson-spike-l" />
          <polygon points="66,10 70,14 66,19 62,15" class="crimson-spike-r" />
        </svg>

      {:else if resolvedFrameKey === 'celestial'}
        <svg viewBox="0 0 100 100" class="frame-svg" aria-hidden="true">
          <circle cx="50" cy="50" r="38.5" class="ring-celestial-core" />
          <circle cx="50" cy="50" r="42" class="ring-celestial-corona" />
          <g class="celestial-crown-group">
            <path d="M30,17 L38,11 L50,3 L62,11 L70,17 L64,19 L50,15 L36,19 Z" class="crown-filigree" />
            <circle cx="50" cy="3" r="3" class="crown-gem-core" />
            <circle cx="38" cy="11" r="2.2" class="crown-gem-side" />
            <circle cx="62" cy="11" r="2.2" class="crown-gem-side" />
          </g>
          <polygon points="50,86 52,90 50,94 48,90" class="celestial-gem-bottom" />
          <polygon points="8,50 12,52 16,50 12,48" class="celestial-gem-left" />
          <polygon points="92,50 88,48 84,50 88,52" class="celestial-gem-right" />
        </svg>

      <!-- ROUND 3 NEW FRAMES -->
      {:else if resolvedFrameKey === 'lightning'}
        <!-- 9. Tempestade Cósmica (Lightning Storm) -->
        <svg viewBox="0 0 100 100" class="frame-svg" aria-hidden="true">
          <circle cx="50" cy="50" r="38.5" class="ring-lightning-base" />
          <circle cx="50" cy="50" r="41.5" class="ring-lightning-orbit" />
          <g class="lightning-bolts-group">
            <path d="M26,14 L34,26 L29,28 L38,40" class="lightning-bolt bolt-1" />
            <path d="M74,14 L66,26 L71,28 L62,40" class="lightning-bolt bolt-2" />
            <path d="M26,86 L34,74 L29,72 L38,60" class="lightning-bolt bolt-3" />
            <path d="M74,86 L66,74 L71,72 L62,60" class="lightning-bolt bolt-4" />
          </g>
          <g class="lightning-sparks">
            <circle cx="50" cy="7" r="2.8" class="spark-node spark-n" />
            <circle cx="50" cy="93" r="2.8" class="spark-node spark-s" />
            <circle cx="7" cy="50" r="2.8" class="spark-node spark-w" />
            <circle cx="93" cy="50" r="2.8" class="spark-node spark-e" />
          </g>
        </svg>

      {:else if resolvedFrameKey === 'crystal'}
        <!-- 10. Fragmentos de Prisma (Crystal Shards) -->
        <svg viewBox="0 0 100 100" class="frame-svg" aria-hidden="true">
          <polygon points="50,11 77,22 89,50 77,78 50,89 23,78 11,50 23,22" class="ring-crystal-octa" />
          <circle cx="50" cy="50" r="41.5" class="ring-crystal-orbit" />
          <g class="crystal-shards-cluster">
            <polygon points="50,2 55,10 50,17 45,10" class="crystal-shard shard-n" />
            <polygon points="98,50 90,55 83,50 90,45" class="crystal-shard shard-e" />
            <polygon points="50,98 45,90 50,83 55,90" class="crystal-shard shard-s" />
            <polygon points="2,50 10,45 17,50 10,55" class="crystal-shard shard-w" />
            <polygon points="81,19 85,24 81,28 77,23" class="crystal-shard-mini shard-ne" />
            <polygon points="19,19 23,24 19,28 15,23" class="crystal-shard-mini shard-nw" />
            <polygon points="81,81 85,76 81,72 77,77" class="crystal-shard-mini shard-se" />
            <polygon points="19,81 23,76 19,72 15,77" class="crystal-shard-mini shard-sw" />
          </g>
        </svg>

      {:else if resolvedFrameKey === 'vortex'}
        <!-- 11. Vórtice do Vazio (Void Vortex) -->
        <svg viewBox="0 0 100 100" class="frame-svg" aria-hidden="true">
          <circle cx="50" cy="50" r="39" class="ring-vortex-horizon" />
          <g class="vortex-arms-spin">
            <path d="M50,7 Q76,14 85,38 Q90,62 76,82 Q62,94 40,88" class="vortex-arm arm-1" />
            <path d="M93,50 Q86,76 62,85 Q38,90 18,76 Q6,62 12,40" class="vortex-arm arm-2" />
            <path d="M50,93 Q24,86 15,62 Q10,38 24,18 Q38,6 60,12" class="vortex-arm arm-3" />
          </g>
          <circle cx="50" cy="50" r="43" class="ring-vortex-lens" />
          <g class="vortex-dust">
            <circle cx="48" cy="11" r="2.2" class="vortex-dot dot-1" />
            <circle cx="89" cy="46" r="2.5" class="vortex-dot dot-2" />
            <circle cx="52" cy="89" r="2.2" class="vortex-dot dot-3" />
            <circle cx="11" cy="54" r="2.4" class="vortex-dot dot-4" />
          </g>
        </svg>

      {:else if resolvedFrameKey === 'thorn'}
        <!-- 12. Coroa de Espinhos da Noite (Astral Thorn Crown) -->
        <svg viewBox="0 0 100 100" class="frame-svg" aria-hidden="true">
          <circle cx="50" cy="50" r="39" class="ring-thorn-aura" />
          <path d="M14,40 Q25,18 50,15 Q75,18 86,40 Q76,28 50,25 Q24,28 14,40 Z" class="thorn-vine-upper" />
          <path d="M14,60 Q25,82 50,85 Q75,82 86,60 Q76,72 50,75 Q24,72 14,60 Z" class="thorn-vine-lower" />
          <g class="thorn-spikes-group">
            <polygon points="50,2 54,16 50,19 46,16" class="thorn-spike spike-center-top" />
            <polygon points="26,12 34,22 29,24 23,17" class="thorn-spike spike-flank-tl" />
            <polygon points="74,12 77,17 71,24 66,22" class="thorn-spike spike-flank-tr" />
            <polygon points="50,98 46,84 50,81 54,84" class="thorn-spike spike-center-bottom" />
            <polygon points="26,88 23,83 29,76 34,78" class="thorn-spike spike-flank-bl" />
            <polygon points="74,88 66,78 71,76 77,83" class="thorn-spike spike-flank-br" />
          </g>
          <g class="thorn-rubies">
            <circle cx="50" cy="16" r="3.2" class="thorn-gem-core" />
            <circle cx="50" cy="84" r="3.2" class="thorn-gem-core" />
            <circle cx="28" cy="20" r="2.4" class="thorn-gem-flank" />
            <circle cx="72" cy="20" r="2.4" class="thorn-gem-flank" />
            <circle cx="28" cy="80" r="2.4" class="thorn-gem-flank" />
            <circle cx="72" cy="80" r="2.4" class="thorn-gem-flank" />
          </g>
        </svg>

      {:else}
        <div class="avatar-frame-overlay-legacy"></div>
      {/if}
    </div>
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
  }

  .avatar-fallback {
    font-weight: 800;
    color: #e6dcfe;
    letter-spacing: 0.05em;
    user-select: none;
  }

  .avatar-frame-overlay {
    position: absolute;
    inset: -22%;
    width: 144%;
    height: 144%;
    pointer-events: none;
    z-index: 2;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .frame-svg {
    width: 100%;
    height: 100%;
    overflow: visible;
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

  .avatar-frame-overlay-legacy {
    position: absolute;
    inset: 0;
    border-radius: 50%;
    border: 2px solid #a78bfa;
  }

  /* =========================================================================
     1. COSMIC NOX FRAME & TINT VARIANTS
     ========================================================================= */
  .ring-cosmic-base {
    fill: none;
    stroke: #a78bfa;
    stroke-width: 2.2;
    filter: drop-shadow(0 0 6px rgba(167, 139, 250, 0.85));
  }

  .ring-cosmic-orbit {
    fill: none;
    stroke: rgba(192, 132, 252, 0.65);
    stroke-width: 1.2;
    stroke-dasharray: 8 5;
    animation: rotateCw 8s linear infinite;
    transform-origin: 50px 50px;
  }

  .cardinal-gems polygon {
    fill: #c084fc;
    stroke: #ffffff;
    stroke-width: 0.8;
    filter: drop-shadow(0 0 6px #c084fc);
    animation: gemBreathe 2.6s ease-in-out infinite;
    transform-origin: 50px 50px;
  }

  .corner-stars path {
    fill: #ffffff;
    filter: drop-shadow(0 0 4px #e9d5ff);
    animation: starTwinkle 2s ease-in-out infinite;
    transform-origin: 50px 50px;
  }
  .star-twinkle-2 { animation-delay: 0.5s !important; }
  .star-twinkle-3 { animation-delay: 1s !important; }

  /* Cosmic Nox Tints */
  .frame-cosmic.tint-gold .ring-cosmic-base { stroke: #fbbf24; filter: drop-shadow(0 0 6px rgba(251, 191, 36, 0.9)); }
  .frame-cosmic.tint-gold .ring-cosmic-orbit { stroke: rgba(251, 191, 36, 0.65); }
  .frame-cosmic.tint-gold .cardinal-gems polygon { fill: #fef08a; stroke: #f59e0b; filter: drop-shadow(0 0 6px #fbbf24); }

  .frame-cosmic.tint-cyan .ring-cosmic-base { stroke: #38bdf8; filter: drop-shadow(0 0 6px rgba(56, 189, 248, 0.9)); }
  .frame-cosmic.tint-cyan .ring-cosmic-orbit { stroke: rgba(56, 189, 248, 0.65); }
  .frame-cosmic.tint-cyan .cardinal-gems polygon { fill: #e0f2fe; stroke: #0284c7; filter: drop-shadow(0 0 6px #38bdf8); }

  .frame-cosmic.tint-crimson .ring-cosmic-base { stroke: #ef4444; filter: drop-shadow(0 0 6px rgba(239, 68, 68, 0.9)); }
  .frame-cosmic.tint-crimson .ring-cosmic-orbit { stroke: rgba(239, 68, 68, 0.65); }
  .frame-cosmic.tint-crimson .cardinal-gems polygon { fill: #fecaca; stroke: #b91c1c; filter: drop-shadow(0 0 6px #ef4444); }

  .frame-cosmic.tint-emerald .ring-cosmic-base { stroke: #10b981; filter: drop-shadow(0 0 6px rgba(16, 185, 129, 0.9)); }
  .frame-cosmic.tint-emerald .ring-cosmic-orbit { stroke: rgba(16, 185, 129, 0.65); }
  .frame-cosmic.tint-emerald .cardinal-gems polygon { fill: #d1fae5; stroke: #047857; filter: drop-shadow(0 0 6px #10b981); }

  /* =========================================================================
     2. CYBER NEON FRAME & TINT VARIANTS
     ========================================================================= */
  .ring-cyber-track {
    fill: none;
    stroke: rgba(6, 182, 212, 0.45);
    stroke-width: 2;
  }

  .ring-cyber-pulse {
    fill: none;
    stroke: #06b6d4;
    stroke-width: 2.2;
    stroke-dasharray: 18 10;
    animation: rotateCw 4s linear infinite;
    transform-origin: 50px 50px;
    filter: drop-shadow(0 0 6px #06b6d4);
  }

  .cyber-bracket {
    fill: none;
    stroke: #22d3ee;
    stroke-width: 2.2;
    stroke-linecap: square;
    filter: drop-shadow(0 0 6px #06b6d4);
    animation: cyberBlink 3.2s infinite;
  }

  .cyber-node-top,
  .cyber-node-bottom {
    fill: #67e8f9;
    filter: drop-shadow(0 0 6px #22d3ee);
  }

  .cyber-node-line {
    stroke: #0891b2;
    stroke-width: 1.5;
  }

  /* Cyber Neon Tints */
  .frame-cyber.tint-magenta .ring-cyber-track { stroke: rgba(244, 63, 94, 0.45); }
  .frame-cyber.tint-magenta .ring-cyber-pulse { stroke: #f43f5e; filter: drop-shadow(0 0 6px #f43f5e); }
  .frame-cyber.tint-magenta .cyber-bracket { stroke: #fb7185; filter: drop-shadow(0 0 6px #f43f5e); }
  .frame-cyber.tint-magenta .cyber-node-top,
  .frame-cyber.tint-magenta .cyber-node-bottom { fill: #fecdd3; filter: drop-shadow(0 0 6px #fb7185); }
  .frame-cyber.tint-magenta .cyber-node-line { stroke: #e11d48; }

  .frame-cyber.tint-green .ring-cyber-track { stroke: rgba(34, 197, 94, 0.45); }
  .frame-cyber.tint-green .ring-cyber-pulse { stroke: #22c55e; filter: drop-shadow(0 0 6px #22c55e); }
  .frame-cyber.tint-green .cyber-bracket { stroke: #4ade80; filter: drop-shadow(0 0 6px #22c55e); }
  .frame-cyber.tint-green .cyber-node-top,
  .frame-cyber.tint-green .cyber-node-bottom { fill: #bbf7d0; filter: drop-shadow(0 0 6px #4ade80); }
  .frame-cyber.tint-green .cyber-node-line { stroke: #16a34a; }

  .frame-cyber.tint-purple .ring-cyber-track { stroke: rgba(168, 85, 247, 0.45); }
  .frame-cyber.tint-purple .ring-cyber-pulse { stroke: #a855f7; filter: drop-shadow(0 0 6px #a855f7); }
  .frame-cyber.tint-purple .cyber-bracket { stroke: #c084fc; filter: drop-shadow(0 0 6px #a855f7); }
  .frame-cyber.tint-purple .cyber-node-top,
  .frame-cyber.tint-purple .cyber-node-bottom { fill: #f3e8ff; filter: drop-shadow(0 0 6px #c084fc); }
  .frame-cyber.tint-purple .cyber-node-line { stroke: #9333ea; }

  .frame-cyber.tint-orange .ring-cyber-track { stroke: rgba(249, 115, 22, 0.45); }
  .frame-cyber.tint-orange .ring-cyber-pulse { stroke: #f97316; filter: drop-shadow(0 0 6px #f97316); }
  .frame-cyber.tint-orange .cyber-bracket { stroke: #fb923c; filter: drop-shadow(0 0 6px #f97316); }
  .frame-cyber.tint-orange .cyber-node-top,
  .frame-cyber.tint-orange .cyber-node-bottom { fill: #ffedd5; filter: drop-shadow(0 0 6px #fb923c); }
  .frame-cyber.tint-orange .cyber-node-line { stroke: #c2410c; }

  /* =========================================================================
     3. EMERALD ARCANA FRAME
     ========================================================================= */
  .ring-emerald-inner {
    fill: none;
    stroke: #10b981;
    stroke-width: 2.2;
    filter: drop-shadow(0 0 6px rgba(16, 185, 129, 0.85));
  }
  .ring-emerald-vines {
    fill: none;
    stroke: #34d399;
    stroke-width: 1.6;
    stroke-dasharray: 14 8;
    animation: rotateCcw 9s linear infinite;
    transform-origin: 50px 50px;
  }
  .emerald-top-gem,
  .emerald-bottom-gem {
    fill: #34d399;
    stroke: #a7f3d0;
    stroke-width: 0.8;
    filter: drop-shadow(0 0 8px #10b981);
    animation: gemBreathe 3s ease-in-out infinite;
    transform-origin: 50px 50px;
  }
  .spore-orb-1,
  .spore-orb-2,
  .spore-orb-3 {
    fill: #6ee7b7;
    filter: drop-shadow(0 0 4px #34d399);
    animation: sporePulse 2.8s ease-in-out infinite;
  }
  .spore-orb-2 { animation-delay: 0.8s; }
  .spore-orb-3 { animation-delay: 1.5s; }

  /* =========================================================================
     4. SOLAR FLARE FRAME & TINT VARIANTS
     ========================================================================= */
  .solar-corona-spin {
    animation: rotateCw 6s linear infinite;
    transform-origin: 50px 50px;
  }
  .solar-ray {
    fill: #f59e0b;
    filter: drop-shadow(0 0 6px #f59e0b);
  }
  .ring-solar-base {
    fill: none;
    stroke: #f59e0b;
    stroke-width: 2.5;
    filter: drop-shadow(0 0 8px #f59e0b);
  }
  .ring-solar-halo {
    fill: none;
    stroke: #fbbf24;
    stroke-width: 1.6;
    stroke-dasharray: 12 7;
    animation: rotateCcw 5s linear infinite;
    transform-origin: 50px 50px;
  }
  .solar-crown-crest {
    fill: #fef08a;
    stroke: #f59e0b;
    stroke-width: 1;
    filter: drop-shadow(0 0 10px #fbbf24);
    animation: flamePulse 2s ease-in-out infinite;
    transform-origin: 50px 8px;
  }

  /* Solar Flare Tints */
  .frame-solar.tint-blue .solar-ray { fill: #3b82f6; filter: drop-shadow(0 0 6px #3b82f6); }
  .frame-solar.tint-blue .ring-solar-base { stroke: #3b82f6; filter: drop-shadow(0 0 8px #3b82f6); }
  .frame-solar.tint-blue .ring-solar-halo { stroke: #60a5fa; }
  .frame-solar.tint-blue .solar-crown-crest { fill: #dbeafe; stroke: #2563eb; filter: drop-shadow(0 0 10px #60a5fa); }

  .frame-solar.tint-crimson .solar-ray { fill: #ef4444; filter: drop-shadow(0 0 6px #ef4444); }
  .frame-solar.tint-crimson .ring-solar-base { stroke: #ef4444; filter: drop-shadow(0 0 8px #ef4444); }
  .frame-solar.tint-crimson .ring-solar-halo { stroke: #f87171; }
  .frame-solar.tint-crimson .solar-crown-crest { fill: #fee2e2; stroke: #dc2626; filter: drop-shadow(0 0 10px #f87171); }

  .frame-solar.tint-violet .solar-ray { fill: #a855f7; filter: drop-shadow(0 0 6px #a855f7); }
  .frame-solar.tint-violet .ring-solar-base { stroke: #a855f7; filter: drop-shadow(0 0 8px #a855f7); }
  .frame-solar.tint-violet .ring-solar-halo { stroke: #c084fc; }
  .frame-solar.tint-violet .solar-crown-crest { fill: #f3e8ff; stroke: #9333ea; filter: drop-shadow(0 0 10px #c084fc); }

  .frame-solar.tint-emerald .solar-ray { fill: #10b981; filter: drop-shadow(0 0 6px #10b981); }
  .frame-solar.tint-emerald .ring-solar-base { stroke: #10b981; filter: drop-shadow(0 0 8px #10b981); }
  .frame-solar.tint-emerald .ring-solar-halo { stroke: #34d399; }
  .frame-solar.tint-emerald .solar-crown-crest { fill: #d1fae5; stroke: #059669; filter: drop-shadow(0 0 10px #34d399); }

  /* =========================================================================
     5. PARTICLE STARDUST FRAME
     ========================================================================= */
  .gyro-ring-1 {
    fill: none;
    stroke: rgba(129, 140, 248, 0.75);
    stroke-width: 1.5;
    stroke-dasharray: 7 4;
    animation: rotateCw 8s linear infinite;
    transform-origin: 50px 50px;
  }
  .gyro-ring-2 {
    fill: none;
    stroke: rgba(192, 132, 252, 0.75);
    stroke-width: 1.5;
    stroke-dasharray: 9 5;
    animation: rotateCcw 8s linear infinite;
    transform-origin: 50px 50px;
  }
  .ring-stardust-center {
    fill: none;
    stroke: #818cf8;
    stroke-width: 2.2;
    filter: drop-shadow(0 0 7px rgba(129, 140, 248, 0.85));
  }
  .stardust-spark-group circle {
    fill: #ffffff;
    filter: drop-shadow(0 0 5px #c084fc);
    animation: starTwinkle 2.2s ease-in-out infinite;
    transform-origin: 50px 50px;
  }
  .star-particle-2 { animation-delay: 0.6s; }
  .star-particle-3 { animation-delay: 1.2s; }
  .star-particle-4 { animation-delay: 1.8s; }

  /* =========================================================================
     6. AURORA MYSTIC FRAME
     ========================================================================= */
  .ring-aurora-1 {
    fill: none;
    stroke: #8b5cf6;
    stroke-width: 2.4;
    filter: drop-shadow(0 0 8px #8b5cf6);
    animation: auroraShift 4s ease-in-out infinite;
  }
  .ring-aurora-2 {
    fill: none;
    stroke: #06b6d4;
    stroke-width: 1.6;
    stroke-dasharray: 16 8;
    animation: rotateCw 7s linear infinite;
    transform-origin: 50px 50px;
    filter: drop-shadow(0 0 6px #06b6d4);
  }
  .ring-aurora-3 {
    fill: none;
    stroke: #10b981;
    stroke-width: 1.2;
    stroke-dasharray: 10 6;
    animation: rotateCcw 9s linear infinite;
    transform-origin: 50px 50px;
  }
  .aurora-crest-center,
  .aurora-crest-flank-l,
  .aurora-crest-flank-r {
    fill: #a5f3fc;
    stroke: #8b5cf6;
    stroke-width: 0.8;
    filter: drop-shadow(0 0 8px #06b6d4);
    animation: gemBreathe 2.8s ease-in-out infinite;
    transform-origin: 50px 50px;
  }

  /* =========================================================================
     7. CRIMSON ECLIPSE FRAME
     ========================================================================= */
  .ring-crimson-core {
    fill: none;
    stroke: #ef4444;
    stroke-width: 2.6;
    filter: drop-shadow(0 0 8px #ef4444);
  }
  .ring-crimson-corona {
    fill: none;
    stroke: #dc2626;
    stroke-width: 1.8;
    stroke-dasharray: 12 6;
    animation: rotateCw 5s linear infinite;
    transform-origin: 50px 50px;
    filter: drop-shadow(0 0 12px #b91c1c);
  }
  .crimson-abyss-crescent {
    fill: #7f1d1d;
    stroke: #ef4444;
    stroke-width: 1.2;
    filter: drop-shadow(0 0 6px #ef4444);
  }
  .crimson-spike-center,
  .crimson-spike-l,
  .crimson-spike-r {
    fill: #ef4444;
    stroke: #fca5a5;
    stroke-width: 0.8;
    filter: drop-shadow(0 0 8px #ef4444);
    animation: flamePulse 2.2s ease-in-out infinite;
    transform-origin: 50px 10px;
  }

  /* =========================================================================
     8. CELESTIAL SOVEREIGN FRAME
     ========================================================================= */
  .ring-celestial-core {
    fill: none;
    stroke: #fbbf24;
    stroke-width: 2.6;
    filter: drop-shadow(0 0 10px #fbbf24);
  }
  .ring-celestial-corona {
    fill: none;
    stroke: #c084fc;
    stroke-width: 1.8;
    stroke-dasharray: 10 5;
    animation: rotateCw 6s linear infinite;
    transform-origin: 50px 50px;
    filter: drop-shadow(0 0 8px #c084fc);
  }
  .crown-filigree {
    fill: #f59e0b;
    stroke: #fbbf24;
    stroke-width: 1.2;
    filter: drop-shadow(0 0 12px #fbbf24);
  }
  .crown-gem-core {
    fill: #ffffff;
    stroke: #c084fc;
    stroke-width: 1;
    filter: drop-shadow(0 0 8px #ffffff);
  }
  .crown-gem-side {
    fill: #c084fc;
    stroke: #fbbf24;
    stroke-width: 0.8;
    filter: drop-shadow(0 0 6px #c084fc);
  }
  .celestial-crown-group {
    animation: crownFloat 3s ease-in-out infinite;
    transform-origin: 50px 10px;
  }
  .celestial-gem-bottom,
  .celestial-gem-left,
  .celestial-gem-right {
    fill: #fbbf24;
    filter: drop-shadow(0 0 6px #fbbf24);
    animation: gemBreathe 3s ease-in-out infinite;
    transform-origin: 50px 50px;
  }

  /* =========================================================================
     ROUND 3 NEW FRAMES:
     9. LIGHTNING STORM (Tempestade Cósmica)
     ========================================================================= */
  .ring-lightning-base {
    fill: none;
    stroke: #8b5cf6;
    stroke-width: 2.4;
    filter: drop-shadow(0 0 8px #a855f7);
  }
  .ring-lightning-orbit {
    fill: none;
    stroke: #38bdf8;
    stroke-width: 1.4;
    stroke-dasharray: 10 6;
    animation: rotateCw 3.5s linear infinite;
    transform-origin: 50px 50px;
    filter: drop-shadow(0 0 6px #38bdf8);
  }
  .lightning-bolt {
    fill: none;
    stroke: #38bdf8;
    stroke-width: 2.2;
    stroke-linecap: round;
    stroke-linejoin: bevel;
    filter: drop-shadow(0 0 8px #06b6d4);
    animation: lightningCrack 1.8s infinite;
  }
  .bolt-2 { animation-delay: 0.45s; stroke: #c084fc; filter: drop-shadow(0 0 8px #a855f7); }
  .bolt-3 { animation-delay: 0.9s; }
  .bolt-4 { animation-delay: 1.35s; stroke: #c084fc; filter: drop-shadow(0 0 8px #a855f7); }

  .spark-node {
    fill: #ffffff;
    stroke: #38bdf8;
    stroke-width: 1;
    filter: drop-shadow(0 0 6px #67e8f9);
    animation: sparkFlicker 1.4s infinite alternate;
  }
  .spark-s { animation-delay: 0.35s; }
  .spark-w { animation-delay: 0.7s; stroke: #c084fc; }
  .spark-e { animation-delay: 1.05s; stroke: #c084fc; }

  /* =========================================================================
     10. CRYSTAL SHARDS (Fragmentos de Prisma)
     ========================================================================= */
  .ring-crystal-octa {
    fill: none;
    stroke: #2dd4bf;
    stroke-width: 2;
    filter: drop-shadow(0 0 8px rgba(45, 212, 191, 0.8));
    animation: rotateCw 20s linear infinite;
    transform-origin: 50px 50px;
  }
  .ring-crystal-orbit {
    fill: none;
    stroke: #e879f9;
    stroke-width: 1.2;
    stroke-dasharray: 6 5;
    animation: rotateCcw 12s linear infinite;
    transform-origin: 50px 50px;
  }
  .crystal-shard {
    fill: #2dd4bf;
    stroke: #fdf4ff;
    stroke-width: 0.8;
    filter: drop-shadow(0 0 8px #2dd4bf);
    animation: crystalFloat 3.2s ease-in-out infinite;
    transform-origin: 50px 50px;
  }
  .crystal-shard-mini {
    fill: #e879f9;
    stroke: #ffffff;
    stroke-width: 0.6;
    filter: drop-shadow(0 0 6px #e879f9);
    animation: crystalFloat 2.6s ease-in-out infinite reverse;
    transform-origin: 50px 50px;
  }
  .shard-e { animation-delay: 0.8s; }
  .shard-s { animation-delay: 1.6s; }
  .shard-w { animation-delay: 2.4s; }
  .shard-ne { animation-delay: 0.6s; }
  .shard-se { animation-delay: 1.2s; }
  .shard-sw { animation-delay: 1.8s; }

  /* =========================================================================
     11. VOID VORTEX (Vórtice do Vazio)
     ========================================================================= */
  .ring-vortex-horizon {
    fill: none;
    stroke: #7c3aed;
    stroke-width: 2.6;
    filter: drop-shadow(0 0 8px #a855f7);
    animation: singularityBreathe 3s ease-in-out infinite;
    transform-origin: 50px 50px;
  }
  .vortex-arms-spin {
    animation: rotateCw 6s linear infinite;
    transform-origin: 50px 50px;
  }
  .vortex-arm {
    fill: none;
    stroke-linecap: round;
  }
  .vortex-arm.arm-1 { stroke: #c084fc; stroke-width: 2.2; filter: drop-shadow(0 0 6px #a855f7); }
  .vortex-arm.arm-2 { stroke: #818cf8; stroke-width: 2; filter: drop-shadow(0 0 6px #6366f1); }
  .vortex-arm.arm-3 { stroke: #d946ef; stroke-width: 1.8; filter: drop-shadow(0 0 6px #d946ef); }

  .ring-vortex-lens {
    fill: none;
    stroke: rgba(192, 132, 252, 0.45);
    stroke-width: 1.4;
    stroke-dasharray: 12 6;
    animation: rotateCcw 10s linear infinite;
    transform-origin: 50px 50px;
  }
  .vortex-dot {
    fill: #ffffff;
    filter: drop-shadow(0 0 6px #c084fc);
    animation: starTwinkle 2s ease-in-out infinite;
    transform-origin: 50px 50px;
  }
  .dot-2 { animation-delay: 0.5s; fill: #67e8f9; }
  .dot-3 { animation-delay: 1s; fill: #f0abfc; }
  .dot-4 { animation-delay: 1.5s; fill: #818cf8; }

  /* =========================================================================
     12. ASTRAL THORN CROWN (Coroa de Espinhos da Noite)
     ========================================================================= */
  .ring-thorn-aura {
    fill: none;
    stroke: #7f1d1d;
    stroke-width: 2.4;
    filter: drop-shadow(0 0 8px #f43f5e);
    animation: thornAuraPulse 3.5s ease-in-out infinite;
  }
  .thorn-vine-upper,
  .thorn-vine-lower {
    fill: #180d2b;
    stroke: #8b5cf6;
    stroke-width: 1.5;
    filter: drop-shadow(0 0 6px #6d28d9);
  }
  .thorn-spike {
    fill: #8b5cf6;
    stroke: #f43f5e;
    stroke-width: 1;
    filter: drop-shadow(0 0 8px #f43f5e);
    animation: thornSpikeGleam 2.8s ease-in-out infinite;
    transform-origin: 50px 50px;
  }
  .spike-center-bottom,
  .spike-flank-bl,
  .spike-flank-br {
    animation-delay: 1.4s;
  }
  .thorn-gem-core {
    fill: #f43f5e;
    stroke: #ffffff;
    stroke-width: 0.8;
    filter: drop-shadow(0 0 8px #f43f5e);
    animation: gemBreathe 2.4s ease-in-out infinite;
    transform-origin: 50px 50px;
  }
  .thorn-gem-flank {
    fill: #c084fc;
    stroke: #f43f5e;
    stroke-width: 0.6;
    filter: drop-shadow(0 0 5px #c084fc);
    animation: gemBreathe 3s ease-in-out infinite reverse;
    transform-origin: 50px 50px;
  }

  /* =========================================================================
     GLOBAL KEYFRAME ANIMATIONS
     ========================================================================= */
  @keyframes rotateCw {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }

  @keyframes rotateCcw {
    from { transform: rotate(360deg); }
    to { transform: rotate(0deg); }
  }

  @keyframes gemBreathe {
    0%, 100% { transform: scale(1); opacity: 0.9; }
    50% { transform: scale(1.12); opacity: 1; }
  }

  @keyframes crownFloat {
    0%, 100% { transform: translateY(0); }
    50% { transform: translateY(-2.5px); }
  }

  @keyframes flamePulse {
    0%, 100% { transform: scale(1); filter: drop-shadow(0 0 6px #f59e0b); }
    50% { transform: scale(1.08); filter: drop-shadow(0 0 14px #fbbf24); }
  }

  @keyframes starTwinkle {
    0%, 100% { opacity: 0.35; transform: scale(0.75); }
    50% { opacity: 1; transform: scale(1.25); }
  }

  @keyframes sporePulse {
    0%, 100% { opacity: 0.6; transform: scale(0.85); }
    50% { opacity: 1; transform: scale(1.15); }
  }

  @keyframes auroraShift {
    0%, 100% { stroke: #8b5cf6; filter: drop-shadow(0 0 8px #8b5cf6); }
    33% { stroke: #06b6d4; filter: drop-shadow(0 0 10px #06b6d4); }
    66% { stroke: #10b981; filter: drop-shadow(0 0 8px #10b981); }
  }

  @keyframes cyberBlink {
    0%, 100% { opacity: 0.85; }
    45% { opacity: 1; }
    50% { opacity: 0.35; }
    55% { opacity: 1; }
  }

  @keyframes lightningCrack {
    0%, 100% { opacity: 0.3; stroke-width: 1.8px; }
    20% { opacity: 1; stroke-width: 2.8px; }
    25% { opacity: 0.4; }
    30% { opacity: 1; stroke-width: 2.5px; }
    60% { opacity: 0.2; }
  }

  @keyframes sparkFlicker {
    0%, 100% { transform: scale(0.8); opacity: 0.6; }
    50% { transform: scale(1.3); opacity: 1; }
  }

  @keyframes crystalFloat {
    0%, 100% { transform: scale(1) translateY(0); }
    50% { transform: scale(1.1) translateY(-2px); }
  }

  @keyframes singularityBreathe {
    0%, 100% { transform: scale(1); stroke-width: 2.6px; }
    50% { transform: scale(1.05); stroke-width: 3.2px; }
  }

  @keyframes thornAuraPulse {
    0%, 100% { stroke: #7f1d1d; filter: drop-shadow(0 0 6px #f43f5e); }
    50% { stroke: #991b1b; filter: drop-shadow(0 0 14px #ef4444); }
  }

  @keyframes thornSpikeGleam {
    0%, 100% { opacity: 0.85; transform: scale(1); }
    50% { opacity: 1; transform: scale(1.06); }
  }
</style>
