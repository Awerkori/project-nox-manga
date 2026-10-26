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
    // Round 3 frames
    if (parsedFrameId === 'frame_lightning_storm') return 'lightning';
    if (parsedFrameId === 'frame_crystal_shards') return 'crystal';
    if (parsedFrameId === 'frame_void_vortex') return 'vortex';
    if (parsedFrameId === 'frame_astral_thorn_crown') return 'thorn';
    // Round 4 new frames
    if (parsedFrameId === 'frame_angelic_seraph') return 'angelic';
    if (parsedFrameId === 'frame_abyssal_infernal') return 'infernal';
    if (parsedFrameId === 'frame_oceanic_tide') return 'oceanic';
    if (parsedFrameId === 'frame_runic_monolith') return 'monolith';
    if (parsedFrameId === 'frame_blossom_astral') return 'blossom';
    if (parsedFrameId === 'frame_cyber_glitch_v2' || parsedFrameId === 'frame_cyber_glitch') return 'glitch';
    return 'legacy';
  });

  $effect(() => {
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
  class:frame-angelic={resolvedFrameKey === 'angelic'}
  class:frame-infernal={resolvedFrameKey === 'infernal'}
  class:frame-oceanic={resolvedFrameKey === 'oceanic'}
  class:frame-monolith={resolvedFrameKey === 'monolith'}
  class:frame-blossom={resolvedFrameKey === 'blossom'}
  class:frame-glitch={resolvedFrameKey === 'glitch'}
  class:tint-blue={parsedFrameColor === 'blue' || parsedFrameColor === 'sapphire'}
  class:tint-crimson={parsedFrameColor === 'crimson' || parsedFrameColor === 'red' || parsedFrameColor === 'ruby'}
  class:tint-violet={parsedFrameColor === 'violet' || parsedFrameColor === 'purple' || parsedFrameColor === 'amethyst'}
  class:tint-emerald={parsedFrameColor === 'emerald' || parsedFrameColor === 'green'}
  class:tint-gold={parsedFrameColor === 'gold' || parsedFrameColor === 'amber'}
  class:tint-cyan={parsedFrameColor === 'cyan' || parsedFrameColor === 'turquoise' || parsedFrameColor === 'holo'}
  class:tint-magenta={parsedFrameColor === 'magenta' || parsedFrameColor === 'pink'}
  class:tint-green={parsedFrameColor === 'green'}
  class:tint-orange={parsedFrameColor === 'orange' || parsedFrameColor === 'hazard'}
  class:tint-silver={parsedFrameColor === 'silver' || parsedFrameColor === 'alva'}
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
      class:tint-blue={parsedFrameColor === 'blue' || parsedFrameColor === 'sapphire'}
      class:tint-crimson={parsedFrameColor === 'crimson' || parsedFrameColor === 'red' || parsedFrameColor === 'ruby'}
      class:tint-violet={parsedFrameColor === 'violet' || parsedFrameColor === 'purple' || parsedFrameColor === 'amethyst'}
      class:tint-emerald={parsedFrameColor === 'emerald' || parsedFrameColor === 'green'}
      class:tint-gold={parsedFrameColor === 'gold' || parsedFrameColor === 'amber'}
      class:tint-cyan={parsedFrameColor === 'cyan' || parsedFrameColor === 'turquoise' || parsedFrameColor === 'holo'}
      class:tint-magenta={parsedFrameColor === 'magenta' || parsedFrameColor === 'pink'}
      class:tint-green={parsedFrameColor === 'green'}
      class:tint-orange={parsedFrameColor === 'orange' || parsedFrameColor === 'hazard'}
      class:tint-silver={parsedFrameColor === 'silver' || parsedFrameColor === 'alva'}
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

      {:else if resolvedFrameKey === 'lightning'}
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

      <!-- ROUND 4 NEW FRAMES -->
      {:else if resolvedFrameKey === 'angelic'}
        <!-- 13. Asas do Serafim (Angelic Seraph) -->
        <svg viewBox="0 0 100 100" class="frame-svg" aria-hidden="true">
          <ellipse cx="50" cy="8" rx="22" ry="5" class="seraph-halo" />
          <path d="M18,50 C6,30 2,14 20,8 C14,22 18,38 30,48 Z" class="seraph-wing wing-left" />
          <path d="M82,50 C94,30 98,14 80,8 C86,22 82,38 70,48 Z" class="seraph-wing wing-right" />
          <circle cx="50" cy="50" r="38.5" class="ring-seraph-base" />
          <circle cx="50" cy="50" r="41.5" class="ring-seraph-orbit" />
          <g class="seraph-feathers">
            <circle cx="16" cy="68" r="2.2" class="seraph-mote mote-1" />
            <circle cx="84" cy="68" r="2.2" class="seraph-mote mote-2" />
            <circle cx="50" cy="94" r="2.5" class="seraph-mote mote-3" />
          </g>
        </svg>

      {:else if resolvedFrameKey === 'infernal'}
        <!-- 14. Chifres do Abismo (Abyssal Infernal) -->
        <svg viewBox="0 0 100 100" class="frame-svg" aria-hidden="true">
          <path d="M25,28 Q10,12 3,2 Q16,8 29,18 Z" class="infernal-horn horn-left" />
          <path d="M75,28 Q90,12 97,2 Q84,8 71,18 Z" class="infernal-horn horn-right" />
          <circle cx="50" cy="50" r="38.5" class="ring-infernal-magma" />
          <circle cx="50" cy="50" r="42" class="ring-infernal-flames" />
          <polygon points="50,97 45,86 55,86" class="infernal-fang fang-bottom" />
          <g class="infernal-embers">
            <circle cx="20" cy="45" r="2" class="ember-dot ember-1" />
            <circle cx="80" cy="45" r="2" class="ember-dot ember-2" />
          </g>
        </svg>

      {:else if resolvedFrameKey === 'oceanic'}
        <!-- 15. Maremoto Astral (Oceanic Tide) -->
        <svg viewBox="0 0 100 100" class="frame-svg" aria-hidden="true">
          <circle cx="50" cy="50" r="38.5" class="ring-ocean-depth" />
          <circle cx="50" cy="50" r="41.5" class="ring-ocean-foam" />
          <g class="ocean-wave-arms">
            <path d="M50,8 Q70,12 78,30 Q68,26 50,14 Z" class="ocean-wave wave-1" />
            <path d="M88,50 Q86,72 68,82 Q72,68 84,52 Z" class="ocean-wave wave-2" />
            <path d="M50,92 Q28,88 20,68 Q30,74 48,86 Z" class="ocean-wave wave-3" />
            <path d="M12,50 Q16,28 34,18 Q28,32 16,48 Z" class="ocean-wave wave-4" />
          </g>
          <g class="ocean-pearls">
            <circle cx="50" cy="7" r="3.2" class="ocean-pearl pearl-n" />
            <circle cx="93" cy="50" r="3.2" class="ocean-pearl pearl-e" />
            <circle cx="50" cy="93" r="3.2" class="ocean-pearl pearl-s" />
            <circle cx="7" cy="50" r="3.2" class="ocean-pearl pearl-w" />
          </g>
        </svg>

      {:else if resolvedFrameKey === 'monolith'}
        <!-- 16. Relicário Rúnico (Runic Monolith) -->
        <svg viewBox="0 0 100 100" class="frame-svg" aria-hidden="true">
          <circle cx="50" cy="50" r="39" class="ring-monolith-base" />
          <circle cx="50" cy="50" r="41.5" class="ring-monolith-orbit" />
          <g class="monolith-keystones">
            <polygon points="50,2 62,8 60,16 40,16 38,8" class="monolith-plate plate-top" />
            <polygon points="50,98 62,92 60,84 40,84 38,92" class="monolith-plate plate-bottom" />
            <polygon points="2,50 8,38 16,40 16,60 8,62" class="monolith-plate plate-left" />
            <polygon points="98,50 92,38 84,40 84,60 92,62" class="monolith-plate plate-right" />
          </g>
          <g class="monolith-glyphs">
            <circle cx="50" cy="11" r="2.2" class="glyph-node" />
            <circle cx="50" cy="89" r="2.2" class="glyph-node" />
            <circle cx="11" cy="50" r="2.2" class="glyph-node" />
            <circle cx="89" cy="50" r="2.2" class="glyph-node" />
          </g>
        </svg>

      {:else if resolvedFrameKey === 'blossom'}
        <!-- 17. Lótus Astral (Astral Blossom) -->
        <svg viewBox="0 0 100 100" class="frame-svg" aria-hidden="true">
          <circle cx="50" cy="50" r="38.5" class="ring-blossom-vine" />
          <circle cx="50" cy="50" r="41.5" class="ring-blossom-orbit" />
          <g class="blossom-petals">
            <path d="M50,4 Q40,16 50,22 Q60,16 50,4 Z" class="lotus-petal petal-top" />
            <path d="M34,10 Q24,20 34,25 Z" class="lotus-petal-side petal-tl" />
            <path d="M66,10 Q76,20 66,25 Z" class="lotus-petal-side petal-tr" />
            <path d="M50,96 Q40,84 50,78 Q60,84 50,96 Z" class="lotus-petal petal-bottom" />
            <path d="M34,90 Q24,80 34,75 Z" class="lotus-petal-side petal-bl" />
            <path d="M66,90 Q76,80 66,75 Z" class="lotus-petal-side petal-br" />
          </g>
          <g class="dew-drops">
            <circle cx="50" cy="14" r="2.5" class="dew-orb" />
            <circle cx="50" cy="86" r="2.5" class="dew-orb" />
          </g>
        </svg>

      {:else if resolvedFrameKey === 'glitch'}
        <!-- 18. Sobrecarga Quântica (Cyber Glitch V2) -->
        <svg viewBox="0 0 100 100" class="frame-svg" aria-hidden="true">
          <circle cx="50" cy="50" r="38.5" class="ring-glitch-core" />
          <circle cx="50" cy="50" r="41.5" class="ring-glitch-scan" />
          <g class="glitch-brackets">
            <path d="M16,32 L16,16 L32,16" class="hud-bracket" />
            <path d="M84,32 L84,16 L68,16" class="hud-bracket" />
            <path d="M16,68 L16,84 L32,84" class="hud-bracket" />
            <path d="M84,68 L84,84 L68,84" class="hud-bracket" />
          </g>
          <g class="glitch-bits">
            <rect x="42" y="6" width="16" height="3" class="glitch-bit" />
            <rect x="42" y="91" width="16" height="3" class="glitch-bit" />
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
     1. COSMIC NOX
     ========================================================================= */
  .ring-cosmic-base { fill: none; stroke: #a78bfa; stroke-width: 2.2; filter: drop-shadow(0 0 6px rgba(167, 139, 250, 0.85)); }
  .ring-cosmic-orbit { fill: none; stroke: rgba(192, 132, 252, 0.65); stroke-width: 1.2; stroke-dasharray: 8 5; animation: rotateCw 8s linear infinite; transform-origin: 50px 50px; }
  .cardinal-gems polygon { fill: #c084fc; stroke: #ffffff; stroke-width: 0.8; filter: drop-shadow(0 0 6px #c084fc); animation: gemBreathe 2.6s ease-in-out infinite; transform-origin: 50px 50px; }
  .corner-stars path { fill: #ffffff; filter: drop-shadow(0 0 4px #e9d5ff); animation: starTwinkle 2s ease-in-out infinite; transform-origin: 50px 50px; }
  .star-twinkle-2 { animation-delay: 0.5s !important; }
  .star-twinkle-3 { animation-delay: 1s !important; }

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
     2. CYBER NEON
     ========================================================================= */
  .ring-cyber-track { fill: none; stroke: rgba(6, 182, 212, 0.45); stroke-width: 2; }
  .ring-cyber-pulse { fill: none; stroke: #06b6d4; stroke-width: 2.2; stroke-dasharray: 18 10; animation: rotateCw 4s linear infinite; transform-origin: 50px 50px; filter: drop-shadow(0 0 6px #06b6d4); }
  .cyber-bracket { fill: none; stroke: #22d3ee; stroke-width: 2.2; stroke-linecap: square; filter: drop-shadow(0 0 6px #06b6d4); animation: cyberBlink 3.2s infinite; }
  .cyber-node-top, .cyber-node-bottom { fill: #67e8f9; filter: drop-shadow(0 0 6px #22d3ee); }
  .cyber-node-line { stroke: #0891b2; stroke-width: 1.5; }

  .frame-cyber.tint-magenta .ring-cyber-track { stroke: rgba(244, 63, 94, 0.45); }
  .frame-cyber.tint-magenta .ring-cyber-pulse { stroke: #f43f5e; filter: drop-shadow(0 0 6px #f43f5e); }
  .frame-cyber.tint-magenta .cyber-bracket { stroke: #fb7185; filter: drop-shadow(0 0 6px #f43f5e); }
  .frame-cyber.tint-magenta .cyber-node-top, .frame-cyber.tint-magenta .cyber-node-bottom { fill: #fecdd3; filter: drop-shadow(0 0 6px #fb7185); }
  .frame-cyber.tint-magenta .cyber-node-line { stroke: #e11d48; }

  .frame-cyber.tint-green .ring-cyber-track { stroke: rgba(34, 197, 94, 0.45); }
  .frame-cyber.tint-green .ring-cyber-pulse { stroke: #22c55e; filter: drop-shadow(0 0 6px #22c55e); }
  .frame-cyber.tint-green .cyber-bracket { stroke: #4ade80; filter: drop-shadow(0 0 6px #22c55e); }
  .frame-cyber.tint-green .cyber-node-top, .frame-cyber.tint-green .cyber-node-bottom { fill: #bbf7d0; filter: drop-shadow(0 0 6px #4ade80); }
  .frame-cyber.tint-green .cyber-node-line { stroke: #16a34a; }

  .frame-cyber.tint-purple .ring-cyber-track { stroke: rgba(168, 85, 247, 0.45); }
  .frame-cyber.tint-purple .ring-cyber-pulse { stroke: #a855f7; filter: drop-shadow(0 0 6px #a855f7); }
  .frame-cyber.tint-purple .cyber-bracket { stroke: #c084fc; filter: drop-shadow(0 0 6px #a855f7); }
  .frame-cyber.tint-purple .cyber-node-top, .frame-cyber.tint-purple .cyber-node-bottom { fill: #f3e8ff; filter: drop-shadow(0 0 6px #c084fc); }
  .frame-cyber.tint-purple .cyber-node-line { stroke: #9333ea; }

  .frame-cyber.tint-orange .ring-cyber-track { stroke: rgba(249, 115, 22, 0.45); }
  .frame-cyber.tint-orange .ring-cyber-pulse { stroke: #f97316; filter: drop-shadow(0 0 6px #f97316); }
  .frame-cyber.tint-orange .cyber-bracket { stroke: #fb923c; filter: drop-shadow(0 0 6px #f97316); }
  .frame-cyber.tint-orange .cyber-node-top, .frame-cyber.tint-orange .cyber-node-bottom { fill: #ffedd5; filter: drop-shadow(0 0 6px #fb923c); }
  .frame-cyber.tint-orange .cyber-node-line { stroke: #c2410c; }

  /* =========================================================================
     3. EMERALD ARCANA
     ========================================================================= */
  .ring-emerald-inner { fill: none; stroke: #10b981; stroke-width: 2.2; filter: drop-shadow(0 0 6px rgba(16, 185, 129, 0.85)); }
  .ring-emerald-vines { fill: none; stroke: #34d399; stroke-width: 1.6; stroke-dasharray: 14 8; animation: rotateCcw 9s linear infinite; transform-origin: 50px 50px; }
  .emerald-top-gem, .emerald-bottom-gem { fill: #34d399; stroke: #a7f3d0; stroke-width: 0.8; filter: drop-shadow(0 0 8px #10b981); animation: gemBreathe 3s ease-in-out infinite; transform-origin: 50px 50px; }
  .spore-orb-1, .spore-orb-2, .spore-orb-3 { fill: #6ee7b7; filter: drop-shadow(0 0 4px #34d399); animation: sporePulse 2.8s ease-in-out infinite; }
  .spore-orb-2 { animation-delay: 0.8s; }
  .spore-orb-3 { animation-delay: 1.5s; }

  /* =========================================================================
     4. SOLAR FLARE
     ========================================================================= */
  .solar-corona-spin { animation: rotateCw 6s linear infinite; transform-origin: 50px 50px; }
  .solar-ray { fill: #f59e0b; filter: drop-shadow(0 0 6px #f59e0b); }
  .ring-solar-base { fill: none; stroke: #f59e0b; stroke-width: 2.5; filter: drop-shadow(0 0 8px #f59e0b); }
  .ring-solar-halo { fill: none; stroke: #fbbf24; stroke-width: 1.6; stroke-dasharray: 12 7; animation: rotateCcw 5s linear infinite; transform-origin: 50px 50px; }
  .solar-crown-crest { fill: #fef08a; stroke: #f59e0b; stroke-width: 1; filter: drop-shadow(0 0 10px #fbbf24); animation: flamePulse 2s ease-in-out infinite; transform-origin: 50px 8px; }

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
     5. PARTICLE STARDUST
     ========================================================================= */
  .gyro-ring-1 { fill: none; stroke: rgba(129, 140, 248, 0.75); stroke-width: 1.5; stroke-dasharray: 7 4; animation: rotateCw 8s linear infinite; transform-origin: 50px 50px; }
  .gyro-ring-2 { fill: none; stroke: rgba(192, 132, 252, 0.75); stroke-width: 1.5; stroke-dasharray: 9 5; animation: rotateCcw 8s linear infinite; transform-origin: 50px 50px; }
  .ring-stardust-center { fill: none; stroke: #818cf8; stroke-width: 2.2; filter: drop-shadow(0 0 7px rgba(129, 140, 248, 0.85)); }
  .stardust-spark-group circle { fill: #ffffff; filter: drop-shadow(0 0 5px #c084fc); animation: starTwinkle 2.2s ease-in-out infinite; transform-origin: 50px 50px; }
  .star-particle-2 { animation-delay: 0.6s; }
  .star-particle-3 { animation-delay: 1.2s; }
  .star-particle-4 { animation-delay: 1.8s; }

  .frame-stardust.tint-gold .ring-stardust-center { stroke: #fbbf24; }
  .frame-stardust.tint-gold .gyro-ring-1 { stroke: rgba(251, 191, 36, 0.75); }
  .frame-stardust.tint-cyan .ring-stardust-center { stroke: #38bdf8; }
  .frame-stardust.tint-cyan .gyro-ring-1 { stroke: rgba(56, 189, 248, 0.75); }
  .frame-stardust.tint-crimson .ring-stardust-center { stroke: #ef4444; }
  .frame-stardust.tint-crimson .gyro-ring-1 { stroke: rgba(239, 68, 68, 0.75); }
  .frame-stardust.tint-emerald .ring-stardust-center { stroke: #10b981; }
  .frame-stardust.tint-emerald .gyro-ring-1 { stroke: rgba(16, 185, 129, 0.75); }

  /* =========================================================================
     6. AURORA MYSTIC
     ========================================================================= */
  .ring-aurora-1 { fill: none; stroke: #8b5cf6; stroke-width: 2.4; filter: drop-shadow(0 0 8px #8b5cf6); animation: auroraShift 4s ease-in-out infinite; }
  .ring-aurora-2 { fill: none; stroke: #06b6d4; stroke-width: 1.6; stroke-dasharray: 16 8; animation: rotateCw 7s linear infinite; transform-origin: 50px 50px; filter: drop-shadow(0 0 6px #06b6d4); }
  .ring-aurora-3 { fill: none; stroke: #10b981; stroke-width: 1.2; stroke-dasharray: 10 6; animation: rotateCcw 9s linear infinite; transform-origin: 50px 50px; }
  .aurora-crest-center, .aurora-crest-flank-l, .aurora-crest-flank-r { fill: #a5f3fc; stroke: #8b5cf6; stroke-width: 0.8; filter: drop-shadow(0 0 8px #06b6d4); animation: gemBreathe 2.8s ease-in-out infinite; transform-origin: 50px 50px; }

  /* =========================================================================
     7. CRIMSON ECLIPSE
     ========================================================================= */
  .ring-crimson-core { fill: none; stroke: #ef4444; stroke-width: 2.6; filter: drop-shadow(0 0 8px #ef4444); }
  .ring-crimson-corona { fill: none; stroke: #dc2626; stroke-width: 1.8; stroke-dasharray: 12 6; animation: rotateCw 5s linear infinite; transform-origin: 50px 50px; filter: drop-shadow(0 0 12px #b91c1c); }
  .crimson-abyss-crescent { fill: #7f1d1d; stroke: #ef4444; stroke-width: 1.2; filter: drop-shadow(0 0 6px #ef4444); }
  .crimson-spike-center, .crimson-spike-l, .crimson-spike-r { fill: #ef4444; stroke: #fca5a5; stroke-width: 0.8; filter: drop-shadow(0 0 8px #ef4444); animation: flamePulse 2.2s ease-in-out infinite; transform-origin: 50px 10px; }

  /* =========================================================================
     8. CELESTIAL SOVEREIGN
     ========================================================================= */
  .ring-celestial-core { fill: none; stroke: #fbbf24; stroke-width: 2.6; filter: drop-shadow(0 0 10px #fbbf24); }
  .ring-celestial-corona { fill: none; stroke: #c084fc; stroke-width: 1.8; stroke-dasharray: 10 5; animation: rotateCw 6s linear infinite; transform-origin: 50px 50px; filter: drop-shadow(0 0 8px #c084fc); }
  .crown-filigree { fill: #f59e0b; stroke: #fbbf24; stroke-width: 1.2; filter: drop-shadow(0 0 12px #fbbf24); }
  .crown-gem-core { fill: #ffffff; stroke: #c084fc; stroke-width: 1; filter: drop-shadow(0 0 8px #ffffff); }
  .crown-gem-side { fill: #c084fc; stroke: #fbbf24; stroke-width: 0.8; filter: drop-shadow(0 0 6px #c084fc); }
  .celestial-crown-group { animation: crownFloat 3s ease-in-out infinite; transform-origin: 50px 10px; }
  .celestial-gem-bottom, .celestial-gem-left, .celestial-gem-right { fill: #fbbf24; filter: drop-shadow(0 0 6px #fbbf24); animation: gemBreathe 3s ease-in-out infinite; transform-origin: 50px 50px; }

  .frame-celestial.tint-silver .ring-celestial-core { stroke: #e2e8f0; filter: drop-shadow(0 0 10px #cbd5e1); }
  .frame-celestial.tint-silver .crown-filigree { fill: #cbd5e1; stroke: #f8fafc; }
  .frame-celestial.tint-crimson .ring-celestial-core { stroke: #ef4444; filter: drop-shadow(0 0 10px #ef4444); }
  .frame-celestial.tint-crimson .crown-filigree { fill: #dc2626; stroke: #f87171; }
  .frame-celestial.tint-blue .ring-celestial-core { stroke: #38bdf8; filter: drop-shadow(0 0 10px #38bdf8); }
  .frame-celestial.tint-blue .crown-filigree { fill: #0284c7; stroke: #7dd3fc; }

  /* =========================================================================
     9. LIGHTNING STORM
     ========================================================================= */
  .ring-lightning-base { fill: none; stroke: #8b5cf6; stroke-width: 2.4; filter: drop-shadow(0 0 8px #a855f7); }
  .ring-lightning-orbit { fill: none; stroke: #38bdf8; stroke-width: 1.4; stroke-dasharray: 10 6; animation: rotateCw 3.5s linear infinite; transform-origin: 50px 50px; filter: drop-shadow(0 0 6px #38bdf8); }
  .lightning-bolt { fill: none; stroke: #38bdf8; stroke-width: 2.2; stroke-linecap: round; stroke-linejoin: bevel; filter: drop-shadow(0 0 8px #06b6d4); animation: lightningCrack 1.8s infinite; }
  .bolt-2 { animation-delay: 0.45s; stroke: #c084fc; filter: drop-shadow(0 0 8px #a855f7); }
  .bolt-3 { animation-delay: 0.9s; }
  .bolt-4 { animation-delay: 1.35s; stroke: #c084fc; filter: drop-shadow(0 0 8px #a855f7); }
  .spark-node { fill: #ffffff; stroke: #38bdf8; stroke-width: 1; filter: drop-shadow(0 0 6px #67e8f9); animation: sparkFlicker 1.4s infinite alternate; }
  .spark-s { animation-delay: 0.35s; }
  .spark-w { animation-delay: 0.7s; stroke: #c084fc; }
  .spark-e { animation-delay: 1.05s; stroke: #c084fc; }

  .frame-lightning.tint-cyan .ring-lightning-base { stroke: #06b6d4; }
  .frame-lightning.tint-cyan .lightning-bolt { stroke: #67e8f9; }
  .frame-lightning.tint-crimson .ring-lightning-base { stroke: #ef4444; }
  .frame-lightning.tint-crimson .lightning-bolt { stroke: #f87171; }
  .frame-lightning.tint-gold .ring-lightning-base { stroke: #fbbf24; }
  .frame-lightning.tint-gold .lightning-bolt { stroke: #fde047; }
  .frame-lightning.tint-green .ring-lightning-base { stroke: #22c55e; }
  .frame-lightning.tint-green .lightning-bolt { stroke: #4ade80; }

  /* =========================================================================
     10. CRYSTAL SHARDS
     ========================================================================= */
  .ring-crystal-octa { fill: none; stroke: #2dd4bf; stroke-width: 2; filter: drop-shadow(0 0 8px rgba(45, 212, 191, 0.8)); animation: rotateCw 20s linear infinite; transform-origin: 50px 50px; }
  .ring-crystal-orbit { fill: none; stroke: #e879f9; stroke-width: 1.2; stroke-dasharray: 6 5; animation: rotateCcw 12s linear infinite; transform-origin: 50px 50px; }
  .crystal-shard { fill: #2dd4bf; stroke: #fdf4ff; stroke-width: 0.8; filter: drop-shadow(0 0 8px #2dd4bf); animation: crystalFloat 3.2s ease-in-out infinite; transform-origin: 50px 50px; }
  .crystal-shard-mini { fill: #e879f9; stroke: #ffffff; stroke-width: 0.6; filter: drop-shadow(0 0 6px #e879f9); animation: crystalFloat 2.6s ease-in-out infinite reverse; transform-origin: 50px 50px; }
  .shard-e { animation-delay: 0.8s; }
  .shard-s { animation-delay: 1.6s; }
  .shard-w { animation-delay: 2.4s; }
  .shard-ne { animation-delay: 0.6s; }
  .shard-se { animation-delay: 1.2s; }
  .shard-sw { animation-delay: 1.8s; }

  .frame-crystal.tint-magenta .crystal-shard { fill: #ec4899; }
  .frame-crystal.tint-blue .crystal-shard { fill: #3b82f6; }
  .frame-crystal.tint-emerald .crystal-shard { fill: #10b981; }
  .frame-crystal.tint-gold .crystal-shard { fill: #fbbf24; }

  /* =========================================================================
     11. VOID VORTEX
     ========================================================================= */
  .ring-vortex-horizon { fill: none; stroke: #7c3aed; stroke-width: 2.6; filter: drop-shadow(0 0 8px #a855f7); animation: singularityBreathe 3s ease-in-out infinite; transform-origin: 50px 50px; }
  .vortex-arms-spin { animation: rotateCw 6s linear infinite; transform-origin: 50px 50px; }
  .vortex-arm { fill: none; stroke-linecap: round; }
  .vortex-arm.arm-1 { stroke: #c084fc; stroke-width: 2.2; filter: drop-shadow(0 0 6px #a855f7); }
  .vortex-arm.arm-2 { stroke: #818cf8; stroke-width: 2; filter: drop-shadow(0 0 6px #6366f1); }
  .vortex-arm.arm-3 { stroke: #d946ef; stroke-width: 1.8; filter: drop-shadow(0 0 6px #d946ef); }
  .ring-vortex-lens { fill: none; stroke: rgba(192, 132, 252, 0.45); stroke-width: 1.4; stroke-dasharray: 12 6; animation: rotateCcw 10s linear infinite; transform-origin: 50px 50px; }
  .vortex-dot { fill: #ffffff; filter: drop-shadow(0 0 6px #c084fc); animation: starTwinkle 2s ease-in-out infinite; transform-origin: 50px 50px; }
  .dot-2 { animation-delay: 0.5s; fill: #67e8f9; }
  .dot-3 { animation-delay: 1s; fill: #f0abfc; }
  .dot-4 { animation-delay: 1.5s; fill: #818cf8; }

  .frame-vortex.tint-crimson .ring-vortex-horizon { stroke: #ef4444; }
  .frame-vortex.tint-crimson .vortex-arm.arm-1 { stroke: #f87171; }
  .frame-vortex.tint-cyan .ring-vortex-horizon { stroke: #06b6d4; }
  .frame-vortex.tint-cyan .vortex-arm.arm-1 { stroke: #38bdf8; }
  .frame-vortex.tint-gold .ring-vortex-horizon { stroke: #fbbf24; }
  .frame-vortex.tint-gold .vortex-arm.arm-1 { stroke: #fde047; }

  /* =========================================================================
     12. ASTRAL THORN CROWN
     ========================================================================= */
  .ring-thorn-aura { fill: none; stroke: #7f1d1d; stroke-width: 2.4; filter: drop-shadow(0 0 8px #f43f5e); animation: thornAuraPulse 3.5s ease-in-out infinite; }
  .thorn-vine-upper, .thorn-vine-lower { fill: #180d2b; stroke: #8b5cf6; stroke-width: 1.5; filter: drop-shadow(0 0 6px #6d28d9); }
  .thorn-spike { fill: #8b5cf6; stroke: #f43f5e; stroke-width: 1; filter: drop-shadow(0 0 8px #f43f5e); animation: thornSpikeGleam 2.8s ease-in-out infinite; transform-origin: 50px 50px; }
  .spike-center-bottom, .spike-flank-bl, .spike-flank-br { animation-delay: 1.4s; }
  .thorn-gem-core { fill: #f43f5e; stroke: #ffffff; stroke-width: 0.8; filter: drop-shadow(0 0 8px #f43f5e); animation: gemBreathe 2.4s ease-in-out infinite; transform-origin: 50px 50px; }
  .thorn-gem-flank { fill: #c084fc; stroke: #f43f5e; stroke-width: 0.6; filter: drop-shadow(0 0 5px #c084fc); animation: gemBreathe 3s ease-in-out infinite reverse; transform-origin: 50px 50px; }

  .frame-thorn.tint-gold .thorn-spike { fill: #f59e0b; stroke: #fbbf24; }
  .frame-thorn.tint-cyan .thorn-spike { fill: #0284c7; stroke: #38bdf8; }
  .frame-thorn.tint-violet .thorn-spike { fill: #7c3aed; stroke: #c084fc; }

  /* =========================================================================
     ROUND 4 NEW: 13. ANGELIC SERAPH
     ========================================================================= */
  .seraph-halo { fill: none; stroke: #fbbf24; stroke-width: 2.2; filter: drop-shadow(0 0 10px #fde047); animation: haloFloat 2.6s ease-in-out infinite; transform-origin: 50px 8px; }
  .seraph-wing { fill: rgba(254, 240, 138, 0.4); stroke: #fbbf24; stroke-width: 1.6; filter: drop-shadow(0 0 8px rgba(251, 191, 36, 0.85)); animation: wingFlap 3s ease-in-out infinite; transform-origin: 50px 50px; }
  .wing-right { animation-delay: 0.2s; }
  .ring-seraph-base { fill: none; stroke: #fbbf24; stroke-width: 2.4; filter: drop-shadow(0 0 8px #f59e0b); }
  .ring-seraph-orbit { fill: none; stroke: #ffffff; stroke-width: 1.2; stroke-dasharray: 8 6; animation: rotateCw 7s linear infinite; transform-origin: 50px 50px; }
  .seraph-mote { fill: #ffffff; filter: drop-shadow(0 0 6px #fde047); animation: starTwinkle 2s ease-in-out infinite; }
  .mote-2 { animation-delay: 0.7s; }
  .mote-3 { animation-delay: 1.4s; }

  .frame-angelic.tint-silver .seraph-halo { stroke: #f8fafc; filter: drop-shadow(0 0 10px #e2e8f0); }
  .frame-angelic.tint-silver .seraph-wing { stroke: #e2e8f0; fill: rgba(241, 245, 249, 0.4); }
  .frame-angelic.tint-magenta .seraph-halo { stroke: #ec4899; filter: drop-shadow(0 0 10px #f472b6); }
  .frame-angelic.tint-magenta .seraph-wing { stroke: #f472b6; fill: rgba(244, 114, 182, 0.35); }
  .frame-angelic.tint-blue .seraph-halo { stroke: #38bdf8; filter: drop-shadow(0 0 10px #7dd3fc); }
  .frame-angelic.tint-blue .seraph-wing { stroke: #60a5fa; fill: rgba(96, 165, 250, 0.35); }

  /* =========================================================================
     ROUND 4 NEW: 14. ABYSSAL INFERNAL
     ========================================================================= */
  .infernal-horn { fill: #1c080e; stroke: #ef4444; stroke-width: 1.8; filter: drop-shadow(0 0 10px #dc2626); animation: hornGlow 2.8s ease-in-out infinite; transform-origin: 50px 50px; }
  .ring-infernal-magma { fill: none; stroke: #ef4444; stroke-width: 2.5; filter: drop-shadow(0 0 10px #b91c1c); }
  .ring-infernal-flames { fill: none; stroke: #f97316; stroke-width: 1.8; stroke-dasharray: 12 6; animation: rotateCw 5s linear infinite; transform-origin: 50px 50px; }
  .infernal-fang { fill: #ef4444; stroke: #fca5a5; stroke-width: 1; filter: drop-shadow(0 0 8px #ef4444); }
  .ember-dot { fill: #fbbf24; filter: drop-shadow(0 0 5px #f97316); animation: sparkFlicker 1.5s infinite; }
  .ember-2 { animation-delay: 0.8s; }

  .frame-infernal.tint-green .infernal-horn { stroke: #22c55e; filter: drop-shadow(0 0 10px #16a34a); }
  .frame-infernal.tint-green .ring-infernal-magma { stroke: #22c55e; }
  .frame-infernal.tint-green .ring-infernal-flames { stroke: #4ade80; }
  .frame-infernal.tint-blue .infernal-horn { stroke: #3b82f6; filter: drop-shadow(0 0 10px #2563eb); }
  .frame-infernal.tint-blue .ring-infernal-magma { stroke: #3b82f6; }
  .frame-infernal.tint-blue .ring-infernal-flames { stroke: #60a5fa; }
  .frame-infernal.tint-violet .infernal-horn { stroke: #a855f7; filter: drop-shadow(0 0 10px #9333ea); }
  .frame-infernal.tint-violet .ring-infernal-magma { stroke: #a855f7; }
  .frame-infernal.tint-violet .ring-infernal-flames { stroke: #c084fc; }

  /* =========================================================================
     ROUND 4 NEW: 15. OCEANIC TIDE
     ========================================================================= */
  .ring-ocean-depth { fill: none; stroke: #0284c7; stroke-width: 2.5; filter: drop-shadow(0 0 8px #0284c7); }
  .ring-ocean-foam { fill: none; stroke: #38bdf8; stroke-width: 1.6; stroke-dasharray: 14 7; animation: rotateCcw 6s linear infinite; transform-origin: 50px 50px; }
  .ocean-wave { fill: none; stroke: #38bdf8; stroke-width: 2; stroke-linecap: round; filter: drop-shadow(0 0 6px #0ea5e9); animation: waveSwell 3s ease-in-out infinite; }
  .wave-2 { animation-delay: 0.75s; }
  .wave-3 { animation-delay: 1.5s; }
  .wave-4 { animation-delay: 2.25s; }
  .ocean-pearl { fill: #f0fdf4; stroke: #38bdf8; stroke-width: 1; filter: drop-shadow(0 0 6px #67e8f9); animation: pearlPulse 2.5s ease-in-out infinite; }
  .pearl-e { animation-delay: 0.6s; }
  .pearl-s { animation-delay: 1.2s; }
  .pearl-w { animation-delay: 1.8s; }

  .frame-oceanic.tint-cyan .ring-ocean-depth { stroke: #06b6d4; }
  .frame-oceanic.tint-magenta .ring-ocean-depth { stroke: #f43f5e; }
  .frame-oceanic.tint-magenta .ocean-wave { stroke: #fb7185; }
  .frame-oceanic.tint-violet .ring-ocean-depth { stroke: #8b5cf6; }
  .frame-oceanic.tint-violet .ocean-wave { stroke: #c084fc; }

  /* =========================================================================
     ROUND 4 NEW: 16. RUNIC MONOLITH
     ========================================================================= */
  .ring-monolith-base { fill: none; stroke: #d97706; stroke-width: 2.4; filter: drop-shadow(0 0 8px #f59e0b); }
  .ring-monolith-orbit { fill: none; stroke: #fbbf24; stroke-width: 1.4; stroke-dasharray: 8 5; animation: rotateCw 9s linear infinite; transform-origin: 50px 50px; }
  .monolith-plate { fill: #1c1408; stroke: #fbbf24; stroke-width: 1.5; filter: drop-shadow(0 0 8px #f59e0b); animation: monolithShift 3.5s ease-in-out infinite; transform-origin: 50px 50px; }
  .plate-bottom { animation-delay: 1.75s; }
  .glyph-node { fill: #fef08a; filter: drop-shadow(0 0 6px #fbbf24); animation: sparkFlicker 1.8s infinite; }

  .frame-monolith.tint-cyan .ring-monolith-base { stroke: #0284c7; }
  .frame-monolith.tint-cyan .monolith-plate { stroke: #38bdf8; }
  .frame-monolith.tint-crimson .ring-monolith-base { stroke: #b91c1c; }
  .frame-monolith.tint-crimson .monolith-plate { stroke: #ef4444; }
  .frame-monolith.tint-emerald .ring-monolith-base { stroke: #047857; }
  .frame-monolith.tint-emerald .monolith-plate { stroke: #10b981; }

  /* =========================================================================
     ROUND 4 NEW: 17. ASTRAL BLOSSOM
     ========================================================================= */
  .ring-blossom-vine { fill: none; stroke: #db2777; stroke-width: 2.2; filter: drop-shadow(0 0 8px #f472b6); }
  .ring-blossom-orbit { fill: none; stroke: #f472b6; stroke-width: 1.4; stroke-dasharray: 10 6; animation: rotateCcw 8s linear infinite; transform-origin: 50px 50px; }
  .lotus-petal { fill: #fdf2f8; stroke: #ec4899; stroke-width: 1.2; filter: drop-shadow(0 0 8px #f472b6); animation: petalPulse 3s ease-in-out infinite; transform-origin: 50px 50px; }
  .lotus-petal-side { fill: #fce7f3; stroke: #f472b6; stroke-width: 1; animation: petalPulse 3s ease-in-out infinite 0.5s; transform-origin: 50px 50px; }
  .dew-orb { fill: #ffffff; filter: drop-shadow(0 0 6px #f472b6); animation: sparkFlicker 2s infinite; }

  .frame-blossom.tint-cyan .ring-blossom-vine { stroke: #06b6d4; }
  .frame-blossom.tint-cyan .lotus-petal { stroke: #22d3ee; }
  .frame-blossom.tint-gold .ring-blossom-vine { stroke: #d97706; }
  .frame-blossom.tint-gold .lotus-petal { stroke: #fbbf24; }
  .frame-blossom.tint-violet .ring-blossom-vine { stroke: #7c3aed; }
  .frame-blossom.tint-violet .lotus-petal { stroke: #c084fc; }

  /* =========================================================================
     ROUND 4 NEW: 18. CYBER GLITCH V2
     ========================================================================= */
  .ring-glitch-core { fill: none; stroke: #10b981; stroke-width: 2.2; filter: drop-shadow(0 0 8px #34d399); }
  .ring-glitch-scan { fill: none; stroke: #34d399; stroke-width: 1.8; stroke-dasharray: 18 8; animation: rotateCw 3s linear infinite; transform-origin: 50px 50px; }
  .hud-bracket { fill: none; stroke: #6ee7b7; stroke-width: 2.2; filter: drop-shadow(0 0 6px #10b981); animation: cyberBlink 2.5s infinite; }
  .glitch-bit { fill: #a7f3d0; filter: drop-shadow(0 0 6px #34d399); animation: glitchJitter 1.2s infinite; }

  .frame-glitch.tint-cyan .ring-glitch-core { stroke: #06b6d4; }
  .frame-glitch.tint-cyan .hud-bracket { stroke: #38bdf8; }
  .frame-glitch.tint-magenta .ring-glitch-core { stroke: #f43f5e; }
  .frame-glitch.tint-magenta .hud-bracket { stroke: #fb7185; }
  .frame-glitch.tint-gold .ring-glitch-core { stroke: #f59e0b; }
  .frame-glitch.tint-gold .hud-bracket { stroke: #fbbf24; }

  /* =========================================================================
     GLOBAL KEYFRAME ANIMATIONS
     ========================================================================= */
  @keyframes rotateCw { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
  @keyframes rotateCcw { from { transform: rotate(360deg); } to { transform: rotate(0deg); } }
  @keyframes gemBreathe { 0%, 100% { transform: scale(1); opacity: 0.9; } 50% { transform: scale(1.12); opacity: 1; } }
  @keyframes crownFloat { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-2.5px); } }
  @keyframes flamePulse { 0%, 100% { transform: scale(1); filter: drop-shadow(0 0 6px #f59e0b); } 50% { transform: scale(1.08); filter: drop-shadow(0 0 14px #fbbf24); } }
  @keyframes starTwinkle { 0%, 100% { opacity: 0.35; transform: scale(0.75); } 50% { opacity: 1; transform: scale(1.25); } }
  @keyframes sporePulse { 0%, 100% { opacity: 0.6; transform: scale(0.85); } 50% { opacity: 1; transform: scale(1.15); } }
  @keyframes auroraShift { 0%, 100% { stroke: #8b5cf6; filter: drop-shadow(0 0 8px #8b5cf6); } 33% { stroke: #06b6d4; filter: drop-shadow(0 0 10px #06b6d4); } 66% { stroke: #10b981; filter: drop-shadow(0 0 8px #10b981); } }
  @keyframes cyberBlink { 0%, 100% { opacity: 0.85; } 45% { opacity: 1; } 50% { opacity: 0.35; } 55% { opacity: 1; } }
  @keyframes lightningCrack { 0%, 100% { opacity: 0.3; stroke-width: 1.8px; } 20% { opacity: 1; stroke-width: 2.8px; } 25% { opacity: 0.4; } 30% { opacity: 1; stroke-width: 2.5px; } 60% { opacity: 0.2; } }
  @keyframes sparkFlicker { 0%, 100% { transform: scale(0.8); opacity: 0.6; } 50% { transform: scale(1.3); opacity: 1; } }
  @keyframes crystalFloat { 0%, 100% { transform: scale(1) translateY(0); } 50% { transform: scale(1.1) translateY(-2px); } }
  @keyframes singularityBreathe { 0%, 100% { transform: scale(1); stroke-width: 2.6px; } 50% { transform: scale(1.05); stroke-width: 3.2px; } }
  @keyframes thornAuraPulse { 0%, 100% { stroke: #7f1d1d; filter: drop-shadow(0 0 6px #f43f5e); } 50% { stroke: #991b1b; filter: drop-shadow(0 0 14px #ef4444); } }
  @keyframes thornSpikeGleam { 0%, 100% { opacity: 0.85; transform: scale(1); } 50% { opacity: 1; transform: scale(1.06); } }
  @keyframes wingFlap { 0%, 100% { transform: scale(1) rotate(0deg); } 50% { transform: scale(1.08) rotate(3deg); } }
  @keyframes haloFloat { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-3px); } }
  @keyframes hornGlow { 0%, 100% { filter: drop-shadow(0 0 8px #dc2626); } 50% { filter: drop-shadow(0 0 16px #f97316); } }
  @keyframes waveSwell { 0%, 100% { opacity: 0.7; transform: scale(1); } 50% { opacity: 1; transform: scale(1.05); } }
  @keyframes pearlPulse { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.2); } }
  @keyframes monolithShift { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.06); } }
  @keyframes petalPulse { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.08); } }
  @keyframes glitchJitter { 0%, 100% { transform: translateX(0); opacity: 0.8; } 50% { transform: translateX(2px); opacity: 1; } }
</style>
