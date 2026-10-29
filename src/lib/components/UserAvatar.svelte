<script lang="ts">
  import { avatarCropStyle } from '$lib/avatar';
  import { getFrameConfig } from '$lib/cosmetics-catalog';
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
    frameScale?: number | string | null;
    frameOffsetX?: number | string | null;
    frameOffsetY?: number | string | null;
    frameFit?: 'contain' | 'cover' | null;
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
    frameScale = null,
    frameOffsetX = null,
    frameOffsetY = null,
    frameFit = null,
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

  let resolvedFrameConfig = $derived(getFrameConfig(parsedFrameId));
  let resolvedFrameUrl = $derived(frameUrl || resolvedFrameConfig?.asset_url || null);
  let resolvedFrameScale = $derived(
    Number(frameScale ?? resolvedFrameConfig?.style_data?.frame_scale ?? 1.25)
  );
  let resolvedFrameOffsetX = $derived(
    Number(frameOffsetX ?? resolvedFrameConfig?.style_data?.frame_offset_x ?? 0)
  );
  let resolvedFrameOffsetY = $derived(
    Number(frameOffsetY ?? resolvedFrameConfig?.style_data?.frame_offset_y ?? 0)
  );
  let resolvedFrameFit = $derived(
    (frameFit ?? resolvedFrameConfig?.style_data?.frame_fit ?? 'contain') as 'contain' | 'cover'
  );

    let resolvedFrameKey = $derived.by(() => {
    if (!parsedFrameId) return null;
    if (parsedFrameId === 'frame_cosmic_nox') return 'cosmic';
    if (parsedFrameId === 'frame_cyber_neon') return 'cyber';
    if (parsedFrameId === 'frame_emerald_veil') return 'emerald';
    if (parsedFrameId === 'frame_solar_flare') return 'solar';
    if (parsedFrameId === 'frame_particle_stardust') return 'stardust';
    if (parsedFrameId === 'frame_crystal_shards') return 'crystal';
    if (parsedFrameId === 'frame_lightning_storm') return 'lightning';
    if (parsedFrameId === 'frame_aurora_mystic') return 'aurora';
    if (parsedFrameId === 'frame_crimson_eclipse') return 'crimson';
    if (parsedFrameId === 'frame_void_vortex') return 'vortex';
    if (parsedFrameId === 'frame_astral_thorn_crown') return 'thorn';
    if (parsedFrameId === 'frame_celestial_sovereign' || parsedFrameId === 'frame_celestial_gold') return 'celestial';
    if (parsedFrameId === 'frame_angelic_seraph') return 'angelic';
    if (parsedFrameId === 'frame_abyssal_infernal') return 'infernal';
    if (parsedFrameId === 'frame_oceanic_tide') return 'oceanic';
    if (parsedFrameId === 'frame_runic_monolith') return 'monolith';
    if (parsedFrameId === 'frame_blossom_astral') return 'blossom';
    if (parsedFrameId === 'frame_cyber_glitch_v2' || parsedFrameId === 'frame_cyber_glitch') return 'glitch';
    if (parsedFrameId === 'frame_phoenix_rebirth') return 'phoenix';
    if (parsedFrameId === 'frame_dragon_scale') return 'dragon';
    if (parsedFrameId === 'frame_chrono_gear') return 'chrono';
    if (parsedFrameId === 'frame_chaos_orb') return 'chaos';
    if (parsedFrameId === 'frame_sacred_valkyrie') return 'valkyrie';
    if (parsedFrameId === 'frame_astral_eye') return 'eye';
    if (parsedFrameId === 'frame_quantum_shield') return 'shield';
    if (parsedFrameId === 'frame_spectral_wraith') return 'wraith';
    if (parsedFrameId === 'frame_diamond_sovereign') return 'diamond';
    if (parsedFrameId === 'frame_astral_blade') return 'blade';
    if (parsedFrameId === 'frame_alchemy_circle') return 'alchemy';
    if (parsedFrameId === 'frame_spider_fate') return 'spider';
    if (parsedFrameId === 'frame_moon_phases') return 'moon';
    if (parsedFrameId === 'frame_supernova_burst') return 'supernova';
    if (parsedFrameId === 'frame_holy_grail') return 'grail';
    if (parsedFrameId === 'frame_deep_kraken') return 'kraken';
    if (parsedFrameId === 'frame_sakura_storm') return 'sakura';
    if (parsedFrameId === 'frame_cyber_matrix') return 'matrix';
    if (parsedFrameId === 'frame_demonic_gargoyle') return 'gargoyle';
    if (parsedFrameId === 'frame_celestial_harp') return 'harp';
    if (parsedFrameId === 'frame_arcane_portal') return 'portal';
    if (parsedFrameId === 'frame_volcanic_core') return 'volcanic';
    if (parsedFrameId === 'frame_frozen_glacier') return 'glacier';
    if (parsedFrameId === 'frame_serpent_ouroboros') return 'ouroboros';
    if (parsedFrameId === 'frame_black_hole_horizon') return 'blackhole';
    if (parsedFrameId === 'frame_divine_mandala') return 'mandala';
    if (parsedFrameId === 'frame_steampunk_chronos') return 'steampunk';
    if (parsedFrameId === 'frame_plasma_discharge') return 'plasma';
    if (parsedFrameId === 'frame_shadow_assassin') return 'shadow';
    if (parsedFrameId === 'frame_cosmic_compass') return 'compass';
    if (parsedFrameId === 'frame_fairy_dust') return 'fairy';
    if (parsedFrameId === 'frame_god_emperor') return 'emperor';
    if (parsedFrameId === 'frame_katana_bushido') return 'katana';
    if (parsedFrameId === 'frame_infernal_dragon') return 'infdragon';
    if (parsedFrameId === 'frame_clockwork_automaton') return 'clockwork';
    if (parsedFrameId === 'frame_deepsea_leviathan') return 'leviathan';
    if (parsedFrameId === 'frame_ouroboros_alchemical') return 'alchemouroboros';
    if (parsedFrameId === 'frame_halo_divinus') return 'halodivinus';
    if (parsedFrameId === 'frame_gothic_black_rose') return 'blackrose';
    if (parsedFrameId === 'frame_nanotech_shield') return 'nanotech';
    if (parsedFrameId === 'frame_storm_conductor') return 'stormconductor';
    if (parsedFrameId === 'frame_amethyst_cluster') return 'amethystcluster';
    if (parsedFrameId === 'frame_vampire_lord') return 'vampirelord';
    if (parsedFrameId === 'frame_solar_phoenix') return 'solarphoenix';
    if (parsedFrameId === 'frame_cyber_overdrive') return 'cyberoverdrive';
    if (parsedFrameId === 'frame_runic_ring_ancient') return 'runicring';
    if (parsedFrameId === 'frame_frost_bite_glacier') return 'frostglacier';
    if (parsedFrameId === 'frame_tribal_shaman') return 'tribalshaman';
    if (parsedFrameId === 'frame_andromeda_spiral') return 'andromeda';
    if (parsedFrameId === 'frame_six_winged_seraph') return 'sixseraph';
    if (parsedFrameId === 'frame_valkyrie_spear') return 'valkspear';
    if (parsedFrameId === 'frame_navigators_astrolabe') return 'astrolabe';
    if (parsedFrameId === 'frame_ouroboros_dragon') return 'dragonouroboros';
    if (parsedFrameId === 'frame_black_sun_eclipse') return 'blacksun';
    if (parsedFrameId === 'frame_toxic_hazard') return 'toxichazard';
    if (parsedFrameId === 'frame_eldritch_horror') return 'eldritch';
    if (parsedFrameId === 'frame_imperial_monarch') return 'imperialmonarch';
    if (parsedFrameId === 'frame_enchanted_flora') return 'enchantedflora';
    if (parsedFrameId === 'frame_meteor_ring') return 'meteorring';
    if (parsedFrameId === 'frame_binding_chains') return 'bindingchains';
    if (parsedFrameId === 'frame_stargate_portal') return 'stargate';
    if (parsedFrameId === 'frame_prism_refraction') return 'prismrefraction';
    if (parsedFrameId === 'frame_dark_matter_core') return 'darkmatter';
    if (parsedFrameId === 'frame_spartan_aegis') return 'spartanaegis';
    if (parsedFrameId === 'frame_blood_moon_curse') return 'bloodmoon';
    if (parsedFrameId === 'frame_grail_light') return 'graillight';
    if (parsedFrameId === 'frame_sentinel_drone') return 'sentineldone';
    if (parsedFrameId === 'frame_zen_lotus') return 'zenlotus';
    if (parsedFrameId === 'frame_arachne_web') return 'arachneweb';
    if (parsedFrameId === 'frame_chains_of_hell') return 'hellchains';
    if (parsedFrameId === 'frame_supernova_ring') return 'supernovaring';
    if (parsedFrameId === 'frame_time_weaver') return 'timeweaver';
    if (parsedFrameId === 'frame_desert_mirage') return 'desertmirage';
    if (parsedFrameId === 'frame_kraken_abyss') return 'krakenabyss';
    if (parsedFrameId === 'frame_tesla_globe') return 'teslaglobe';
    if (parsedFrameId === 'frame_archangel_feather') return 'archangelfeather';
    if (parsedFrameId === 'frame_demon_lord_horns') return 'demonhorns';
    if (parsedFrameId === 'frame_cyber_motherboard') return 'motherboard';
    if (parsedFrameId === 'frame_galaxy_vortex') return 'galaxyvortex';
    if (parsedFrameId === 'frame_fairy_wings') return 'fairywings';
    if (parsedFrameId === 'frame_sovereign_wyrm') return 'sovereignwyrm';
    if (parsedFrameId === 'frame_nox_singularity') return 'noxsingularity';

    return null;
  });

  $effect(() => {
    if (failedSrc && failedSrc !== resolvedSrc) failedSrc = null;
  });

  function handleImgError(node: HTMLImageElement) {
    const fn = () => { failedSrc = resolvedSrc; };
    node.addEventListener('error', fn);
    return {
      destroy() {
        node.removeEventListener('error', fn);
      }
    };
  }
</script>

<div
  class="user-avatar-root {className}"
  class:has-frame={!!parsedFrameId || !!resolvedFrameUrl}
    class:frame-cosmic={resolvedFrameKey === 'cosmic'}
  class:frame-cyber={resolvedFrameKey === 'cyber'}
  class:frame-emerald={resolvedFrameKey === 'emerald'}
  class:frame-solar={resolvedFrameKey === 'solar'}
  class:frame-stardust={resolvedFrameKey === 'stardust'}
  class:frame-crystal={resolvedFrameKey === 'crystal'}
  class:frame-lightning={resolvedFrameKey === 'lightning'}
  class:frame-aurora={resolvedFrameKey === 'aurora'}
  class:frame-crimson={resolvedFrameKey === 'crimson'}
  class:frame-vortex={resolvedFrameKey === 'vortex'}
  class:frame-thorn={resolvedFrameKey === 'thorn'}
  class:frame-celestial={resolvedFrameKey === 'celestial'}
  class:frame-angelic={resolvedFrameKey === 'angelic'}
  class:frame-infernal={resolvedFrameKey === 'infernal'}
  class:frame-oceanic={resolvedFrameKey === 'oceanic'}
  class:frame-monolith={resolvedFrameKey === 'monolith'}
  class:frame-blossom={resolvedFrameKey === 'blossom'}
  class:frame-glitch={resolvedFrameKey === 'glitch'}
  class:frame-phoenix={resolvedFrameKey === 'phoenix'}
  class:frame-dragon={resolvedFrameKey === 'dragon'}
  class:frame-chrono={resolvedFrameKey === 'chrono'}
  class:frame-chaos={resolvedFrameKey === 'chaos'}
  class:frame-valkyrie={resolvedFrameKey === 'valkyrie'}
  class:frame-eye={resolvedFrameKey === 'eye'}
  class:frame-shield={resolvedFrameKey === 'shield'}
  class:frame-wraith={resolvedFrameKey === 'wraith'}
  class:frame-diamond={resolvedFrameKey === 'diamond'}
  class:frame-blade={resolvedFrameKey === 'blade'}
  class:frame-alchemy={resolvedFrameKey === 'alchemy'}
  class:frame-spider={resolvedFrameKey === 'spider'}
  class:frame-moon={resolvedFrameKey === 'moon'}
  class:frame-supernova={resolvedFrameKey === 'supernova'}
  class:frame-grail={resolvedFrameKey === 'grail'}
  class:frame-kraken={resolvedFrameKey === 'kraken'}
  class:frame-sakura={resolvedFrameKey === 'sakura'}
  class:frame-matrix={resolvedFrameKey === 'matrix'}
  class:frame-gargoyle={resolvedFrameKey === 'gargoyle'}
  class:frame-harp={resolvedFrameKey === 'harp'}
  class:frame-portal={resolvedFrameKey === 'portal'}
  class:frame-volcanic={resolvedFrameKey === 'volcanic'}
  class:frame-glacier={resolvedFrameKey === 'glacier'}
  class:frame-ouroboros={resolvedFrameKey === 'ouroboros'}
  class:frame-blackhole={resolvedFrameKey === 'blackhole'}
  class:frame-mandala={resolvedFrameKey === 'mandala'}
  class:frame-steampunk={resolvedFrameKey === 'steampunk'}
  class:frame-plasma={resolvedFrameKey === 'plasma'}
  class:frame-shadow={resolvedFrameKey === 'shadow'}
  class:frame-compass={resolvedFrameKey === 'compass'}
  class:frame-fairy={resolvedFrameKey === 'fairy'}
  class:frame-emperor={resolvedFrameKey === 'emperor'}
  class:frame-katana={resolvedFrameKey === 'katana'}
  class:frame-infdragon={resolvedFrameKey === 'infdragon'}
  class:frame-clockwork={resolvedFrameKey === 'clockwork'}
  class:frame-leviathan={resolvedFrameKey === 'leviathan'}
  class:frame-alchemouroboros={resolvedFrameKey === 'alchemouroboros'}
  class:frame-halodivinus={resolvedFrameKey === 'halodivinus'}
  class:frame-blackrose={resolvedFrameKey === 'blackrose'}
  class:frame-nanotech={resolvedFrameKey === 'nanotech'}
  class:frame-stormconductor={resolvedFrameKey === 'stormconductor'}
  class:frame-amethystcluster={resolvedFrameKey === 'amethystcluster'}
  class:frame-vampirelord={resolvedFrameKey === 'vampirelord'}
  class:frame-solarphoenix={resolvedFrameKey === 'solarphoenix'}
  class:frame-cyberoverdrive={resolvedFrameKey === 'cyberoverdrive'}
  class:frame-runicring={resolvedFrameKey === 'runicring'}
  class:frame-frostglacier={resolvedFrameKey === 'frostglacier'}
  class:frame-tribalshaman={resolvedFrameKey === 'tribalshaman'}
  class:frame-andromeda={resolvedFrameKey === 'andromeda'}
  class:frame-sixseraph={resolvedFrameKey === 'sixseraph'}
  class:frame-valkspear={resolvedFrameKey === 'valkspear'}
  class:frame-astrolabe={resolvedFrameKey === 'astrolabe'}
  class:frame-dragonouroboros={resolvedFrameKey === 'dragonouroboros'}
  class:frame-blacksun={resolvedFrameKey === 'blacksun'}
  class:frame-toxichazard={resolvedFrameKey === 'toxichazard'}
  class:frame-eldritch={resolvedFrameKey === 'eldritch'}
  class:frame-imperialmonarch={resolvedFrameKey === 'imperialmonarch'}
  class:frame-enchantedflora={resolvedFrameKey === 'enchantedflora'}
  class:frame-meteorring={resolvedFrameKey === 'meteorring'}
  class:frame-bindingchains={resolvedFrameKey === 'bindingchains'}
  class:frame-stargate={resolvedFrameKey === 'stargate'}
  class:frame-prismrefraction={resolvedFrameKey === 'prismrefraction'}
  class:frame-darkmatter={resolvedFrameKey === 'darkmatter'}
  class:frame-spartanaegis={resolvedFrameKey === 'spartanaegis'}
  class:frame-bloodmoon={resolvedFrameKey === 'bloodmoon'}
  class:frame-graillight={resolvedFrameKey === 'graillight'}
  class:frame-sentineldone={resolvedFrameKey === 'sentineldone'}
  class:frame-zenlotus={resolvedFrameKey === 'zenlotus'}
  class:frame-arachneweb={resolvedFrameKey === 'arachneweb'}
  class:frame-hellchains={resolvedFrameKey === 'hellchains'}
  class:frame-supernovaring={resolvedFrameKey === 'supernovaring'}
  class:frame-timeweaver={resolvedFrameKey === 'timeweaver'}
  class:frame-desertmirage={resolvedFrameKey === 'desertmirage'}
  class:frame-krakenabyss={resolvedFrameKey === 'krakenabyss'}
  class:frame-teslaglobe={resolvedFrameKey === 'teslaglobe'}
  class:frame-archangelfeather={resolvedFrameKey === 'archangelfeather'}
  class:frame-demonhorns={resolvedFrameKey === 'demonhorns'}
  class:frame-motherboard={resolvedFrameKey === 'motherboard'}
  class:frame-galaxyvortex={resolvedFrameKey === 'galaxyvortex'}
  class:frame-fairywings={resolvedFrameKey === 'fairywings'}
  class:frame-sovereignwyrm={resolvedFrameKey === 'sovereignwyrm'}
  class:frame-noxsingularity={resolvedFrameKey === 'noxsingularity'}

  class:tint-blue={parsedFrameColor === 'blue' || parsedFrameColor === 'sapphire'}
  class:tint-crimson={parsedFrameColor === 'crimson' || parsedFrameColor === 'red' || parsedFrameColor === 'ruby'}
  class:tint-violet={parsedFrameColor === 'violet' || parsedFrameColor === 'purple' || parsedFrameColor === 'amethyst'}
  class:tint-emerald={parsedFrameColor === 'emerald' || parsedFrameColor === 'green'}
  class:tint-gold={parsedFrameColor === 'gold' || parsedFrameColor === 'amber'}
  class:tint-cyan={parsedFrameColor === 'cyan' || parsedFrameColor === 'turquoise' || parsedFrameColor === 'holo'}
  class:tint-magenta={parsedFrameColor === 'magenta' || parsedFrameColor === 'pink'}
  class:tint-green={parsedFrameColor === 'green'}
  class:tint-orange={parsedFrameColor === 'orange' || parsedFrameColor === 'hazard'}
  class:tint-silver={parsedFrameColor === 'silver' || parsedFrameColor === 'alva' || parsedFrameColor === 'steel'}
  class:tint-white={parsedFrameColor === 'white' || parsedFrameColor === 'pure' || parsedFrameColor === 'light'}
  class:tint-rose={parsedFrameColor === 'rose' || parsedFrameColor === 'sakura'}
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
        use:handleImgError
      />
    {:else}
      <span class="avatar-fallback" style="font-size: {Math.max(12, Math.round(size * 0.42))}px;">
        {initial}
      </span>
    {/if}
  </div>

  {#if resolvedFrameUrl}
    <div
      class="avatar-custom-frame-overlay"
      style="
        --frame-scale: {resolvedFrameScale};
        --frame-offset-x: {resolvedFrameOffsetX}%;
        --frame-offset-y: {resolvedFrameOffsetY}%;
      "
      aria-hidden="true"
    >
      <img
        src={resolvedFrameUrl}
        alt=""
        class="avatar-custom-frame-asset"
        style="object-fit: {resolvedFrameFit};"
      />
    </div>
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
      {:else if resolvedFrameKey === 'katana'}
        <svg viewBox="0 0 100 100" class="frame-svg frame-svg-katana" aria-hidden="true">
          <circle cx="50" cy="50" r="39" class="ring-katana-base" stroke="#e2e8f0" stroke-width="2.5" fill="none" opacity="0.85" filter="drop-shadow(0 0 6px #e2e8f0)"/>
          <circle cx="50" cy="50" r="42" class="ring-katana-pulse" stroke="#dc2626" stroke-width="1.2" stroke-dasharray="6,4" fill="none" opacity="0.9"/>
          <path d="M50,4 Q70,25 96,50" stroke="#e2e8f0" stroke-width="2.5" fill="none"/>
          <path d="M50,96 Q30,75 4,50" stroke="#e2e8f0" stroke-width="2.5" fill="none"/>
          <polygon points="50,2 54,8 50,14 46,8" fill="#dc2626"/>
        </svg>

      {:else if resolvedFrameKey === 'infdragon'}
        <svg viewBox="0 0 100 100" class="frame-svg frame-svg-infdragon" aria-hidden="true">
          <circle cx="50" cy="50" r="39" class="ring-infdragon-base" stroke="#ef4444" stroke-width="2.5" fill="none" opacity="0.85" filter="drop-shadow(0 0 6px #ef4444)"/>
          <circle cx="50" cy="50" r="42" class="ring-infdragon-pulse" stroke="#f59e0b" stroke-width="1.2" stroke-dasharray="6,4" fill="none" opacity="0.9"/>
          <path d="M25,28 Q10,5 28,2" stroke="#ef4444" stroke-width="3.5" fill="none" stroke-linecap="round"/>
          <path d="M75,28 Q90,5 72,2" stroke="#ef4444" stroke-width="3.5" fill="none" stroke-linecap="round"/>
          <polygon points="50,90 54,96 50,100 46,96" fill="#f59e0b"/>
        </svg>

      {:else if resolvedFrameKey === 'clockwork'}
        <svg viewBox="0 0 100 100" class="frame-svg frame-svg-clockwork" aria-hidden="true">
          <circle cx="50" cy="50" r="39" class="ring-clockwork-base" stroke="#f59e0b" stroke-width="2.5" fill="none" opacity="0.85" filter="drop-shadow(0 0 6px #f59e0b)"/>
          <circle cx="50" cy="50" r="42" class="ring-clockwork-pulse" stroke="#78350f" stroke-width="1.2" stroke-dasharray="6,4" fill="none" opacity="0.9"/>
          <g class="nodes-clockwork">
            <polygon points="50,4 53,9 50,14 47,9" fill="#78350f" filter="drop-shadow(0 0 4px #78350f)"/>
            <polygon points="50,86 53,91 50,96 47,91" fill="#78350f"/>
            <polygon points="4,50 9,53 14,50 9,47" fill="#f59e0b"/>
            <polygon points="86,50 91,53 96,50 91,47" fill="#f59e0b"/>
          </g>
        </svg>

      {:else if resolvedFrameKey === 'leviathan'}
        <svg viewBox="0 0 100 100" class="frame-svg frame-svg-leviathan" aria-hidden="true">
          <circle cx="50" cy="50" r="39" class="ring-leviathan-base" stroke="#06b6d4" stroke-width="2.5" fill="none" opacity="0.85" filter="drop-shadow(0 0 6px #06b6d4)"/>
          <circle cx="50" cy="50" r="42" class="ring-leviathan-pulse" stroke="#0284c7" stroke-width="1.2" stroke-dasharray="6,4" fill="none" opacity="0.9"/>
          <g class="nodes-leviathan">
            <polygon points="50,4 53,9 50,14 47,9" fill="#0284c7" filter="drop-shadow(0 0 4px #0284c7)"/>
            <polygon points="50,86 53,91 50,96 47,91" fill="#0284c7"/>
            <polygon points="4,50 9,53 14,50 9,47" fill="#06b6d4"/>
            <polygon points="86,50 91,53 96,50 91,47" fill="#06b6d4"/>
          </g>
        </svg>

      {:else if resolvedFrameKey === 'alchemouroboros'}
        <svg viewBox="0 0 100 100" class="frame-svg frame-svg-alchemouroboros" aria-hidden="true">
          <circle cx="50" cy="50" r="39" class="ring-alchemouroboros-base" stroke="#10b981" stroke-width="2.5" fill="none" opacity="0.85" filter="drop-shadow(0 0 6px #10b981)"/>
          <circle cx="50" cy="50" r="42" class="ring-alchemouroboros-pulse" stroke="#6366f1" stroke-width="1.2" stroke-dasharray="6,4" fill="none" opacity="0.9"/>
          <g class="nodes-alchemouroboros">
            <polygon points="50,4 53,9 50,14 47,9" fill="#6366f1" filter="drop-shadow(0 0 4px #6366f1)"/>
            <polygon points="50,86 53,91 50,96 47,91" fill="#6366f1"/>
            <polygon points="4,50 9,53 14,50 9,47" fill="#10b981"/>
            <polygon points="86,50 91,53 96,50 91,47" fill="#10b981"/>
          </g>
        </svg>

      {:else if resolvedFrameKey === 'halodivinus'}
        <svg viewBox="0 0 100 100" class="frame-svg frame-svg-halodivinus" aria-hidden="true">
          <circle cx="50" cy="50" r="39" class="ring-halodivinus-base" stroke="#fbbf24" stroke-width="2.5" fill="none" opacity="0.85" filter="drop-shadow(0 0 6px #fbbf24)"/>
          <circle cx="50" cy="50" r="42" class="ring-halodivinus-pulse" stroke="#ffffff" stroke-width="1.2" stroke-dasharray="6,4" fill="none" opacity="0.9"/>
          <polygon points="50,4 58,16 68,8 64,24 36,24 32,8 42,16" fill="#fbbf24" stroke="#ffffff" stroke-width="1"/>
          <circle cx="50" cy="94" r="3.5" fill="#ffffff"/>
        </svg>

      {:else if resolvedFrameKey === 'blackrose'}
        <svg viewBox="0 0 100 100" class="frame-svg frame-svg-blackrose" aria-hidden="true">
          <circle cx="50" cy="50" r="39" class="ring-blackrose-base" stroke="#9f1239" stroke-width="2.5" fill="none" opacity="0.85" filter="drop-shadow(0 0 6px #9f1239)"/>
          <circle cx="50" cy="50" r="42" class="ring-blackrose-pulse" stroke="#1e1b4b" stroke-width="1.2" stroke-dasharray="6,4" fill="none" opacity="0.9"/>
          <g class="nodes-blackrose">
            <polygon points="50,4 53,9 50,14 47,9" fill="#1e1b4b" filter="drop-shadow(0 0 4px #1e1b4b)"/>
            <polygon points="50,86 53,91 50,96 47,91" fill="#1e1b4b"/>
            <polygon points="4,50 9,53 14,50 9,47" fill="#9f1239"/>
            <polygon points="86,50 91,53 96,50 91,47" fill="#9f1239"/>
          </g>
        </svg>

      {:else if resolvedFrameKey === 'nanotech'}
        <svg viewBox="0 0 100 100" class="frame-svg frame-svg-nanotech" aria-hidden="true">
          <circle cx="50" cy="50" r="39" class="ring-nanotech-base" stroke="#0284c7" stroke-width="2.5" fill="none" opacity="0.85" filter="drop-shadow(0 0 6px #0284c7)"/>
          <circle cx="50" cy="50" r="42" class="ring-nanotech-pulse" stroke="#38bdf8" stroke-width="1.2" stroke-dasharray="6,4" fill="none" opacity="0.9"/>
          <g class="nodes-nanotech">
            <polygon points="50,4 53,9 50,14 47,9" fill="#38bdf8" filter="drop-shadow(0 0 4px #38bdf8)"/>
            <polygon points="50,86 53,91 50,96 47,91" fill="#38bdf8"/>
            <polygon points="4,50 9,53 14,50 9,47" fill="#0284c7"/>
            <polygon points="86,50 91,53 96,50 91,47" fill="#0284c7"/>
          </g>
        </svg>

      {:else if resolvedFrameKey === 'stormconductor'}
        <svg viewBox="0 0 100 100" class="frame-svg frame-svg-stormconductor" aria-hidden="true">
          <circle cx="50" cy="50" r="39" class="ring-stormconductor-base" stroke="#818cf8" stroke-width="2.5" fill="none" opacity="0.85" filter="drop-shadow(0 0 6px #818cf8)"/>
          <circle cx="50" cy="50" r="42" class="ring-stormconductor-pulse" stroke="#c084fc" stroke-width="1.2" stroke-dasharray="6,4" fill="none" opacity="0.9"/>
          <g class="nodes-stormconductor">
            <polygon points="50,4 53,9 50,14 47,9" fill="#c084fc" filter="drop-shadow(0 0 4px #c084fc)"/>
            <polygon points="50,86 53,91 50,96 47,91" fill="#c084fc"/>
            <polygon points="4,50 9,53 14,50 9,47" fill="#818cf8"/>
            <polygon points="86,50 91,53 96,50 91,47" fill="#818cf8"/>
          </g>
        </svg>

      {:else if resolvedFrameKey === 'amethystcluster'}
        <svg viewBox="0 0 100 100" class="frame-svg frame-svg-amethystcluster" aria-hidden="true">
          <circle cx="50" cy="50" r="39" class="ring-amethystcluster-base" stroke="#a855f7" stroke-width="2.5" fill="none" opacity="0.85" filter="drop-shadow(0 0 6px #a855f7)"/>
          <circle cx="50" cy="50" r="42" class="ring-amethystcluster-pulse" stroke="#7c3aed" stroke-width="1.2" stroke-dasharray="6,4" fill="none" opacity="0.9"/>
          <g class="nodes-amethystcluster">
            <polygon points="50,4 53,9 50,14 47,9" fill="#7c3aed" filter="drop-shadow(0 0 4px #7c3aed)"/>
            <polygon points="50,86 53,91 50,96 47,91" fill="#7c3aed"/>
            <polygon points="4,50 9,53 14,50 9,47" fill="#a855f7"/>
            <polygon points="86,50 91,53 96,50 91,47" fill="#a855f7"/>
          </g>
        </svg>

      {:else if resolvedFrameKey === 'vampirelord'}
        <svg viewBox="0 0 100 100" class="frame-svg frame-svg-vampirelord" aria-hidden="true">
          <circle cx="50" cy="50" r="39" class="ring-vampirelord-base" stroke="#881337" stroke-width="2.5" fill="none" opacity="0.85" filter="drop-shadow(0 0 6px #881337)"/>
          <circle cx="50" cy="50" r="42" class="ring-vampirelord-pulse" stroke="#e11d48" stroke-width="1.2" stroke-dasharray="6,4" fill="none" opacity="0.9"/>
          <path d="M12,45 C2,25 25,15 45,35" stroke="#881337" stroke-width="2" fill="none" opacity="0.9"/>
          <path d="M88,45 C98,25 75,15 55,35" stroke="#881337" stroke-width="2" fill="none" opacity="0.9"/>
          <circle cx="50" cy="8" r="3.5" fill="#e11d48" filter="drop-shadow(0 0 6px #e11d48)"/>
        </svg>

      {:else if resolvedFrameKey === 'solarphoenix'}
        <svg viewBox="0 0 100 100" class="frame-svg frame-svg-solarphoenix" aria-hidden="true">
          <circle cx="50" cy="50" r="39" class="ring-solarphoenix-base" stroke="#f97316" stroke-width="2.5" fill="none" opacity="0.85" filter="drop-shadow(0 0 6px #f97316)"/>
          <circle cx="50" cy="50" r="42" class="ring-solarphoenix-pulse" stroke="#fbbf24" stroke-width="1.2" stroke-dasharray="6,4" fill="none" opacity="0.9"/>
          <path d="M12,45 C2,25 25,15 45,35" stroke="#f97316" stroke-width="2" fill="none" opacity="0.9"/>
          <path d="M88,45 C98,25 75,15 55,35" stroke="#f97316" stroke-width="2" fill="none" opacity="0.9"/>
          <circle cx="50" cy="8" r="3.5" fill="#fbbf24" filter="drop-shadow(0 0 6px #fbbf24)"/>
        </svg>

      {:else if resolvedFrameKey === 'cyberoverdrive'}
        <svg viewBox="0 0 100 100" class="frame-svg frame-svg-cyberoverdrive" aria-hidden="true">
          <circle cx="50" cy="50" r="39" class="ring-cyberoverdrive-base" stroke="#10b981" stroke-width="2.5" fill="none" opacity="0.85" filter="drop-shadow(0 0 6px #10b981)"/>
          <circle cx="50" cy="50" r="42" class="ring-cyberoverdrive-pulse" stroke="#06b6d4" stroke-width="1.2" stroke-dasharray="6,4" fill="none" opacity="0.9"/>
          <g class="nodes-cyberoverdrive">
            <polygon points="50,4 53,9 50,14 47,9" fill="#06b6d4" filter="drop-shadow(0 0 4px #06b6d4)"/>
            <polygon points="50,86 53,91 50,96 47,91" fill="#06b6d4"/>
            <polygon points="4,50 9,53 14,50 9,47" fill="#10b981"/>
            <polygon points="86,50 91,53 96,50 91,47" fill="#10b981"/>
          </g>
        </svg>

      {:else if resolvedFrameKey === 'runicring'}
        <svg viewBox="0 0 100 100" class="frame-svg frame-svg-runicring" aria-hidden="true">
          <circle cx="50" cy="50" r="39" class="ring-runicring-base" stroke="#38bdf8" stroke-width="2.5" fill="none" opacity="0.85" filter="drop-shadow(0 0 6px #38bdf8)"/>
          <circle cx="50" cy="50" r="42" class="ring-runicring-pulse" stroke="#6366f1" stroke-width="1.2" stroke-dasharray="6,4" fill="none" opacity="0.9"/>
          <g class="nodes-runicring">
            <polygon points="50,4 53,9 50,14 47,9" fill="#6366f1" filter="drop-shadow(0 0 4px #6366f1)"/>
            <polygon points="50,86 53,91 50,96 47,91" fill="#6366f1"/>
            <polygon points="4,50 9,53 14,50 9,47" fill="#38bdf8"/>
            <polygon points="86,50 91,53 96,50 91,47" fill="#38bdf8"/>
          </g>
        </svg>

      {:else if resolvedFrameKey === 'frostglacier'}
        <svg viewBox="0 0 100 100" class="frame-svg frame-svg-frostglacier" aria-hidden="true">
          <circle cx="50" cy="50" r="39" class="ring-frostglacier-base" stroke="#38bdf8" stroke-width="2.5" fill="none" opacity="0.85" filter="drop-shadow(0 0 6px #38bdf8)"/>
          <circle cx="50" cy="50" r="42" class="ring-frostglacier-pulse" stroke="#e0f2fe" stroke-width="1.2" stroke-dasharray="6,4" fill="none" opacity="0.9"/>
          <g class="nodes-frostglacier">
            <polygon points="50,4 53,9 50,14 47,9" fill="#e0f2fe" filter="drop-shadow(0 0 4px #e0f2fe)"/>
            <polygon points="50,86 53,91 50,96 47,91" fill="#e0f2fe"/>
            <polygon points="4,50 9,53 14,50 9,47" fill="#38bdf8"/>
            <polygon points="86,50 91,53 96,50 91,47" fill="#38bdf8"/>
          </g>
        </svg>

      {:else if resolvedFrameKey === 'tribalshaman'}
        <svg viewBox="0 0 100 100" class="frame-svg frame-svg-tribalshaman" aria-hidden="true">
          <circle cx="50" cy="50" r="39" class="ring-tribalshaman-base" stroke="#ea580c" stroke-width="2.5" fill="none" opacity="0.85" filter="drop-shadow(0 0 6px #ea580c)"/>
          <circle cx="50" cy="50" r="42" class="ring-tribalshaman-pulse" stroke="#eab308" stroke-width="1.2" stroke-dasharray="6,4" fill="none" opacity="0.9"/>
          <g class="nodes-tribalshaman">
            <polygon points="50,4 53,9 50,14 47,9" fill="#eab308" filter="drop-shadow(0 0 4px #eab308)"/>
            <polygon points="50,86 53,91 50,96 47,91" fill="#eab308"/>
            <polygon points="4,50 9,53 14,50 9,47" fill="#ea580c"/>
            <polygon points="86,50 91,53 96,50 91,47" fill="#ea580c"/>
          </g>
        </svg>

      {:else if resolvedFrameKey === 'andromeda'}
        <svg viewBox="0 0 100 100" class="frame-svg frame-svg-andromeda" aria-hidden="true">
          <circle cx="50" cy="50" r="39" class="ring-andromeda-base" stroke="#c084fc" stroke-width="2.5" fill="none" opacity="0.85" filter="drop-shadow(0 0 6px #c084fc)"/>
          <circle cx="50" cy="50" r="42" class="ring-andromeda-pulse" stroke="#ec4899" stroke-width="1.2" stroke-dasharray="6,4" fill="none" opacity="0.9"/>
          <g class="nodes-andromeda">
            <polygon points="50,4 53,9 50,14 47,9" fill="#ec4899" filter="drop-shadow(0 0 4px #ec4899)"/>
            <polygon points="50,86 53,91 50,96 47,91" fill="#ec4899"/>
            <polygon points="4,50 9,53 14,50 9,47" fill="#c084fc"/>
            <polygon points="86,50 91,53 96,50 91,47" fill="#c084fc"/>
          </g>
        </svg>

      {:else if resolvedFrameKey === 'sixseraph'}
        <svg viewBox="0 0 100 100" class="frame-svg frame-svg-sixseraph" aria-hidden="true">
          <circle cx="50" cy="50" r="39" class="ring-sixseraph-base" stroke="#fbbf24" stroke-width="2.5" fill="none" opacity="0.85" filter="drop-shadow(0 0 6px #fbbf24)"/>
          <circle cx="50" cy="50" r="42" class="ring-sixseraph-pulse" stroke="#ffffff" stroke-width="1.2" stroke-dasharray="6,4" fill="none" opacity="0.9"/>
          <path d="M12,45 C2,25 25,15 45,35" stroke="#fbbf24" stroke-width="2" fill="none" opacity="0.9"/>
          <path d="M88,45 C98,25 75,15 55,35" stroke="#fbbf24" stroke-width="2" fill="none" opacity="0.9"/>
          <circle cx="50" cy="8" r="3.5" fill="#ffffff" filter="drop-shadow(0 0 6px #ffffff)"/>
        </svg>

      {:else if resolvedFrameKey === 'valkspear'}
        <svg viewBox="0 0 100 100" class="frame-svg frame-svg-valkspear" aria-hidden="true">
          <circle cx="50" cy="50" r="39" class="ring-valkspear-base" stroke="#94a3b8" stroke-width="2.5" fill="none" opacity="0.85" filter="drop-shadow(0 0 6px #94a3b8)"/>
          <circle cx="50" cy="50" r="42" class="ring-valkspear-pulse" stroke="#38bdf8" stroke-width="1.2" stroke-dasharray="6,4" fill="none" opacity="0.9"/>
          <g class="nodes-valkspear">
            <polygon points="50,4 53,9 50,14 47,9" fill="#38bdf8" filter="drop-shadow(0 0 4px #38bdf8)"/>
            <polygon points="50,86 53,91 50,96 47,91" fill="#38bdf8"/>
            <polygon points="4,50 9,53 14,50 9,47" fill="#94a3b8"/>
            <polygon points="86,50 91,53 96,50 91,47" fill="#94a3b8"/>
          </g>
        </svg>

      {:else if resolvedFrameKey === 'astrolabe'}
        <svg viewBox="0 0 100 100" class="frame-svg frame-svg-astrolabe" aria-hidden="true">
          <circle cx="50" cy="50" r="39" class="ring-astrolabe-base" stroke="#d97706" stroke-width="2.5" fill="none" opacity="0.85" filter="drop-shadow(0 0 6px #d97706)"/>
          <circle cx="50" cy="50" r="42" class="ring-astrolabe-pulse" stroke="#fde047" stroke-width="1.2" stroke-dasharray="6,4" fill="none" opacity="0.9"/>
          <g class="nodes-astrolabe">
            <polygon points="50,4 53,9 50,14 47,9" fill="#fde047" filter="drop-shadow(0 0 4px #fde047)"/>
            <polygon points="50,86 53,91 50,96 47,91" fill="#fde047"/>
            <polygon points="4,50 9,53 14,50 9,47" fill="#d97706"/>
            <polygon points="86,50 91,53 96,50 91,47" fill="#d97706"/>
          </g>
        </svg>

      {:else if resolvedFrameKey === 'dragonouroboros'}
        <svg viewBox="0 0 100 100" class="frame-svg frame-svg-dragonouroboros" aria-hidden="true">
          <circle cx="50" cy="50" r="39" class="ring-dragonouroboros-base" stroke="#059669" stroke-width="2.5" fill="none" opacity="0.85" filter="drop-shadow(0 0 6px #059669)"/>
          <circle cx="50" cy="50" r="42" class="ring-dragonouroboros-pulse" stroke="#10b981" stroke-width="1.2" stroke-dasharray="6,4" fill="none" opacity="0.9"/>
          <g class="nodes-dragonouroboros">
            <polygon points="50,4 53,9 50,14 47,9" fill="#10b981" filter="drop-shadow(0 0 4px #10b981)"/>
            <polygon points="50,86 53,91 50,96 47,91" fill="#10b981"/>
            <polygon points="4,50 9,53 14,50 9,47" fill="#059669"/>
            <polygon points="86,50 91,53 96,50 91,47" fill="#059669"/>
          </g>
        </svg>

      {:else if resolvedFrameKey === 'blacksun'}
        <svg viewBox="0 0 100 100" class="frame-svg frame-svg-blacksun" aria-hidden="true">
          <circle cx="50" cy="50" r="39" class="ring-blacksun-base" stroke="#ef4444" stroke-width="2.5" fill="none" opacity="0.85" filter="drop-shadow(0 0 6px #ef4444)"/>
          <circle cx="50" cy="50" r="42" class="ring-blacksun-pulse" stroke="#171717" stroke-width="1.2" stroke-dasharray="6,4" fill="none" opacity="0.9"/>
          <g class="nodes-blacksun">
            <polygon points="50,4 53,9 50,14 47,9" fill="#171717" filter="drop-shadow(0 0 4px #171717)"/>
            <polygon points="50,86 53,91 50,96 47,91" fill="#171717"/>
            <polygon points="4,50 9,53 14,50 9,47" fill="#ef4444"/>
            <polygon points="86,50 91,53 96,50 91,47" fill="#ef4444"/>
          </g>
        </svg>

      {:else if resolvedFrameKey === 'toxichazard'}
        <svg viewBox="0 0 100 100" class="frame-svg frame-svg-toxichazard" aria-hidden="true">
          <circle cx="50" cy="50" r="39" class="ring-toxichazard-base" stroke="#84cc16" stroke-width="2.5" fill="none" opacity="0.85" filter="drop-shadow(0 0 6px #84cc16)"/>
          <circle cx="50" cy="50" r="42" class="ring-toxichazard-pulse" stroke="#eab308" stroke-width="1.2" stroke-dasharray="6,4" fill="none" opacity="0.9"/>
          <g class="nodes-toxichazard">
            <polygon points="50,4 53,9 50,14 47,9" fill="#eab308" filter="drop-shadow(0 0 4px #eab308)"/>
            <polygon points="50,86 53,91 50,96 47,91" fill="#eab308"/>
            <polygon points="4,50 9,53 14,50 9,47" fill="#84cc16"/>
            <polygon points="86,50 91,53 96,50 91,47" fill="#84cc16"/>
          </g>
        </svg>

      {:else if resolvedFrameKey === 'eldritch'}
        <svg viewBox="0 0 100 100" class="frame-svg frame-svg-eldritch" aria-hidden="true">
          <circle cx="50" cy="50" r="39" class="ring-eldritch-base" stroke="#701a75" stroke-width="2.5" fill="none" opacity="0.85" filter="drop-shadow(0 0 6px #701a75)"/>
          <circle cx="50" cy="50" r="42" class="ring-eldritch-pulse" stroke="#a21caf" stroke-width="1.2" stroke-dasharray="6,4" fill="none" opacity="0.9"/>
          <g class="nodes-eldritch">
            <polygon points="50,4 53,9 50,14 47,9" fill="#a21caf" filter="drop-shadow(0 0 4px #a21caf)"/>
            <polygon points="50,86 53,91 50,96 47,91" fill="#a21caf"/>
            <polygon points="4,50 9,53 14,50 9,47" fill="#701a75"/>
            <polygon points="86,50 91,53 96,50 91,47" fill="#701a75"/>
          </g>
        </svg>

      {:else if resolvedFrameKey === 'imperialmonarch'}
        <svg viewBox="0 0 100 100" class="frame-svg frame-svg-imperialmonarch" aria-hidden="true">
          <circle cx="50" cy="50" r="39" class="ring-imperialmonarch-base" stroke="#eab308" stroke-width="2.5" fill="none" opacity="0.85" filter="drop-shadow(0 0 6px #eab308)"/>
          <circle cx="50" cy="50" r="42" class="ring-imperialmonarch-pulse" stroke="#fef08a" stroke-width="1.2" stroke-dasharray="6,4" fill="none" opacity="0.9"/>
          <polygon points="50,4 58,16 68,8 64,24 36,24 32,8 42,16" fill="#eab308" stroke="#fef08a" stroke-width="1"/>
          <circle cx="50" cy="94" r="3.5" fill="#fef08a"/>
        </svg>

      {:else if resolvedFrameKey === 'enchantedflora'}
        <svg viewBox="0 0 100 100" class="frame-svg frame-svg-enchantedflora" aria-hidden="true">
          <circle cx="50" cy="50" r="39" class="ring-enchantedflora-base" stroke="#ec4899" stroke-width="2.5" fill="none" opacity="0.85" filter="drop-shadow(0 0 6px #ec4899)"/>
          <circle cx="50" cy="50" r="42" class="ring-enchantedflora-pulse" stroke="#10b981" stroke-width="1.2" stroke-dasharray="6,4" fill="none" opacity="0.9"/>
          <g class="nodes-enchantedflora">
            <polygon points="50,4 53,9 50,14 47,9" fill="#10b981" filter="drop-shadow(0 0 4px #10b981)"/>
            <polygon points="50,86 53,91 50,96 47,91" fill="#10b981"/>
            <polygon points="4,50 9,53 14,50 9,47" fill="#ec4899"/>
            <polygon points="86,50 91,53 96,50 91,47" fill="#ec4899"/>
          </g>
        </svg>

      {:else if resolvedFrameKey === 'meteorring'}
        <svg viewBox="0 0 100 100" class="frame-svg frame-svg-meteorring" aria-hidden="true">
          <circle cx="50" cy="50" r="39" class="ring-meteorring-base" stroke="#f97316" stroke-width="2.5" fill="none" opacity="0.85" filter="drop-shadow(0 0 6px #f97316)"/>
          <circle cx="50" cy="50" r="42" class="ring-meteorring-pulse" stroke="#dc2626" stroke-width="1.2" stroke-dasharray="6,4" fill="none" opacity="0.9"/>
          <g class="nodes-meteorring">
            <polygon points="50,4 53,9 50,14 47,9" fill="#dc2626" filter="drop-shadow(0 0 4px #dc2626)"/>
            <polygon points="50,86 53,91 50,96 47,91" fill="#dc2626"/>
            <polygon points="4,50 9,53 14,50 9,47" fill="#f97316"/>
            <polygon points="86,50 91,53 96,50 91,47" fill="#f97316"/>
          </g>
        </svg>

      {:else if resolvedFrameKey === 'bindingchains'}
        <svg viewBox="0 0 100 100" class="frame-svg frame-svg-bindingchains" aria-hidden="true">
          <circle cx="50" cy="50" r="39" class="ring-bindingchains-base" stroke="#8b5cf6" stroke-width="2.5" fill="none" opacity="0.85" filter="drop-shadow(0 0 6px #8b5cf6)"/>
          <circle cx="50" cy="50" r="42" class="ring-bindingchains-pulse" stroke="#c084fc" stroke-width="1.2" stroke-dasharray="6,4" fill="none" opacity="0.9"/>
          <g class="nodes-bindingchains">
            <polygon points="50,4 53,9 50,14 47,9" fill="#c084fc" filter="drop-shadow(0 0 4px #c084fc)"/>
            <polygon points="50,86 53,91 50,96 47,91" fill="#c084fc"/>
            <polygon points="4,50 9,53 14,50 9,47" fill="#8b5cf6"/>
            <polygon points="86,50 91,53 96,50 91,47" fill="#8b5cf6"/>
          </g>
        </svg>

      {:else if resolvedFrameKey === 'stargate'}
        <svg viewBox="0 0 100 100" class="frame-svg frame-svg-stargate" aria-hidden="true">
          <circle cx="50" cy="50" r="39" class="ring-stargate-base" stroke="#0ea5e9" stroke-width="2.5" fill="none" opacity="0.85" filter="drop-shadow(0 0 6px #0ea5e9)"/>
          <circle cx="50" cy="50" r="42" class="ring-stargate-pulse" stroke="#38bdf8" stroke-width="1.2" stroke-dasharray="6,4" fill="none" opacity="0.9"/>
          <g class="nodes-stargate">
            <polygon points="50,4 53,9 50,14 47,9" fill="#38bdf8" filter="drop-shadow(0 0 4px #38bdf8)"/>
            <polygon points="50,86 53,91 50,96 47,91" fill="#38bdf8"/>
            <polygon points="4,50 9,53 14,50 9,47" fill="#0ea5e9"/>
            <polygon points="86,50 91,53 96,50 91,47" fill="#0ea5e9"/>
          </g>
        </svg>

      {:else if resolvedFrameKey === 'prismrefraction'}
        <svg viewBox="0 0 100 100" class="frame-svg frame-svg-prismrefraction" aria-hidden="true">
          <circle cx="50" cy="50" r="39" class="ring-prismrefraction-base" stroke="#ec4899" stroke-width="2.5" fill="none" opacity="0.85" filter="drop-shadow(0 0 6px #ec4899)"/>
          <circle cx="50" cy="50" r="42" class="ring-prismrefraction-pulse" stroke="#06b6d4" stroke-width="1.2" stroke-dasharray="6,4" fill="none" opacity="0.9"/>
          <g class="nodes-prismrefraction">
            <polygon points="50,4 53,9 50,14 47,9" fill="#06b6d4" filter="drop-shadow(0 0 4px #06b6d4)"/>
            <polygon points="50,86 53,91 50,96 47,91" fill="#06b6d4"/>
            <polygon points="4,50 9,53 14,50 9,47" fill="#ec4899"/>
            <polygon points="86,50 91,53 96,50 91,47" fill="#ec4899"/>
          </g>
        </svg>

      {:else if resolvedFrameKey === 'darkmatter'}
        <svg viewBox="0 0 100 100" class="frame-svg frame-svg-darkmatter" aria-hidden="true">
          <circle cx="50" cy="50" r="39" class="ring-darkmatter-base" stroke="#581c87" stroke-width="2.5" fill="none" opacity="0.85" filter="drop-shadow(0 0 6px #581c87)"/>
          <circle cx="50" cy="50" r="42" class="ring-darkmatter-pulse" stroke="#9333ea" stroke-width="1.2" stroke-dasharray="6,4" fill="none" opacity="0.9"/>
          <g class="nodes-darkmatter">
            <polygon points="50,4 53,9 50,14 47,9" fill="#9333ea" filter="drop-shadow(0 0 4px #9333ea)"/>
            <polygon points="50,86 53,91 50,96 47,91" fill="#9333ea"/>
            <polygon points="4,50 9,53 14,50 9,47" fill="#581c87"/>
            <polygon points="86,50 91,53 96,50 91,47" fill="#581c87"/>
          </g>
        </svg>

      {:else if resolvedFrameKey === 'spartanaegis'}
        <svg viewBox="0 0 100 100" class="frame-svg frame-svg-spartanaegis" aria-hidden="true">
          <circle cx="50" cy="50" r="39" class="ring-spartanaegis-base" stroke="#b45309" stroke-width="2.5" fill="none" opacity="0.85" filter="drop-shadow(0 0 6px #b45309)"/>
          <circle cx="50" cy="50" r="42" class="ring-spartanaegis-pulse" stroke="#f59e0b" stroke-width="1.2" stroke-dasharray="6,4" fill="none" opacity="0.9"/>
          <g class="nodes-spartanaegis">
            <polygon points="50,4 53,9 50,14 47,9" fill="#f59e0b" filter="drop-shadow(0 0 4px #f59e0b)"/>
            <polygon points="50,86 53,91 50,96 47,91" fill="#f59e0b"/>
            <polygon points="4,50 9,53 14,50 9,47" fill="#b45309"/>
            <polygon points="86,50 91,53 96,50 91,47" fill="#b45309"/>
          </g>
        </svg>

      {:else if resolvedFrameKey === 'bloodmoon'}
        <svg viewBox="0 0 100 100" class="frame-svg frame-svg-bloodmoon" aria-hidden="true">
          <circle cx="50" cy="50" r="39" class="ring-bloodmoon-base" stroke="#991b1b" stroke-width="2.5" fill="none" opacity="0.85" filter="drop-shadow(0 0 6px #991b1b)"/>
          <circle cx="50" cy="50" r="42" class="ring-bloodmoon-pulse" stroke="#f43f5e" stroke-width="1.2" stroke-dasharray="6,4" fill="none" opacity="0.9"/>
          <g class="nodes-bloodmoon">
            <polygon points="50,4 53,9 50,14 47,9" fill="#f43f5e" filter="drop-shadow(0 0 4px #f43f5e)"/>
            <polygon points="50,86 53,91 50,96 47,91" fill="#f43f5e"/>
            <polygon points="4,50 9,53 14,50 9,47" fill="#991b1b"/>
            <polygon points="86,50 91,53 96,50 91,47" fill="#991b1b"/>
          </g>
        </svg>

      {:else if resolvedFrameKey === 'graillight'}
        <svg viewBox="0 0 100 100" class="frame-svg frame-svg-graillight" aria-hidden="true">
          <circle cx="50" cy="50" r="39" class="ring-graillight-base" stroke="#facc15" stroke-width="2.5" fill="none" opacity="0.85" filter="drop-shadow(0 0 6px #facc15)"/>
          <circle cx="50" cy="50" r="42" class="ring-graillight-pulse" stroke="#ffffff" stroke-width="1.2" stroke-dasharray="6,4" fill="none" opacity="0.9"/>
          <g class="nodes-graillight">
            <polygon points="50,4 53,9 50,14 47,9" fill="#ffffff" filter="drop-shadow(0 0 4px #ffffff)"/>
            <polygon points="50,86 53,91 50,96 47,91" fill="#ffffff"/>
            <polygon points="4,50 9,53 14,50 9,47" fill="#facc15"/>
            <polygon points="86,50 91,53 96,50 91,47" fill="#facc15"/>
          </g>
        </svg>

      {:else if resolvedFrameKey === 'sentineldone'}
        <svg viewBox="0 0 100 100" class="frame-svg frame-svg-sentineldone" aria-hidden="true">
          <circle cx="50" cy="50" r="39" class="ring-sentineldone-base" stroke="#ef4444" stroke-width="2.5" fill="none" opacity="0.85" filter="drop-shadow(0 0 6px #ef4444)"/>
          <circle cx="50" cy="50" r="42" class="ring-sentineldone-pulse" stroke="#0284c7" stroke-width="1.2" stroke-dasharray="6,4" fill="none" opacity="0.9"/>
          <g class="nodes-sentineldone">
            <polygon points="50,4 53,9 50,14 47,9" fill="#0284c7" filter="drop-shadow(0 0 4px #0284c7)"/>
            <polygon points="50,86 53,91 50,96 47,91" fill="#0284c7"/>
            <polygon points="4,50 9,53 14,50 9,47" fill="#ef4444"/>
            <polygon points="86,50 91,53 96,50 91,47" fill="#ef4444"/>
          </g>
        </svg>

      {:else if resolvedFrameKey === 'zenlotus'}
        <svg viewBox="0 0 100 100" class="frame-svg frame-svg-zenlotus" aria-hidden="true">
          <circle cx="50" cy="50" r="39" class="ring-zenlotus-base" stroke="#f472b6" stroke-width="2.5" fill="none" opacity="0.85" filter="drop-shadow(0 0 6px #f472b6)"/>
          <circle cx="50" cy="50" r="42" class="ring-zenlotus-pulse" stroke="#c084fc" stroke-width="1.2" stroke-dasharray="6,4" fill="none" opacity="0.9"/>
          <g class="nodes-zenlotus">
            <polygon points="50,4 53,9 50,14 47,9" fill="#c084fc" filter="drop-shadow(0 0 4px #c084fc)"/>
            <polygon points="50,86 53,91 50,96 47,91" fill="#c084fc"/>
            <polygon points="4,50 9,53 14,50 9,47" fill="#f472b6"/>
            <polygon points="86,50 91,53 96,50 91,47" fill="#f472b6"/>
          </g>
        </svg>

      {:else if resolvedFrameKey === 'arachneweb'}
        <svg viewBox="0 0 100 100" class="frame-svg frame-svg-arachneweb" aria-hidden="true">
          <circle cx="50" cy="50" r="39" class="ring-arachneweb-base" stroke="#cbd5e1" stroke-width="2.5" fill="none" opacity="0.85" filter="drop-shadow(0 0 6px #cbd5e1)"/>
          <circle cx="50" cy="50" r="42" class="ring-arachneweb-pulse" stroke="#64748b" stroke-width="1.2" stroke-dasharray="6,4" fill="none" opacity="0.9"/>
          <g class="nodes-arachneweb">
            <polygon points="50,4 53,9 50,14 47,9" fill="#64748b" filter="drop-shadow(0 0 4px #64748b)"/>
            <polygon points="50,86 53,91 50,96 47,91" fill="#64748b"/>
            <polygon points="4,50 9,53 14,50 9,47" fill="#cbd5e1"/>
            <polygon points="86,50 91,53 96,50 91,47" fill="#cbd5e1"/>
          </g>
        </svg>

      {:else if resolvedFrameKey === 'hellchains'}
        <svg viewBox="0 0 100 100" class="frame-svg frame-svg-hellchains" aria-hidden="true">
          <circle cx="50" cy="50" r="39" class="ring-hellchains-base" stroke="#dc2626" stroke-width="2.5" fill="none" opacity="0.85" filter="drop-shadow(0 0 6px #dc2626)"/>
          <circle cx="50" cy="50" r="42" class="ring-hellchains-pulse" stroke="#f97316" stroke-width="1.2" stroke-dasharray="6,4" fill="none" opacity="0.9"/>
          <g class="nodes-hellchains">
            <polygon points="50,4 53,9 50,14 47,9" fill="#f97316" filter="drop-shadow(0 0 4px #f97316)"/>
            <polygon points="50,86 53,91 50,96 47,91" fill="#f97316"/>
            <polygon points="4,50 9,53 14,50 9,47" fill="#dc2626"/>
            <polygon points="86,50 91,53 96,50 91,47" fill="#dc2626"/>
          </g>
        </svg>

      {:else if resolvedFrameKey === 'supernovaring'}
        <svg viewBox="0 0 100 100" class="frame-svg frame-svg-supernovaring" aria-hidden="true">
          <circle cx="50" cy="50" r="39" class="ring-supernovaring-base" stroke="#fbbf24" stroke-width="2.5" fill="none" opacity="0.85" filter="drop-shadow(0 0 6px #fbbf24)"/>
          <circle cx="50" cy="50" r="42" class="ring-supernovaring-pulse" stroke="#f43f5e" stroke-width="1.2" stroke-dasharray="6,4" fill="none" opacity="0.9"/>
          <g class="nodes-supernovaring">
            <polygon points="50,4 53,9 50,14 47,9" fill="#f43f5e" filter="drop-shadow(0 0 4px #f43f5e)"/>
            <polygon points="50,86 53,91 50,96 47,91" fill="#f43f5e"/>
            <polygon points="4,50 9,53 14,50 9,47" fill="#fbbf24"/>
            <polygon points="86,50 91,53 96,50 91,47" fill="#fbbf24"/>
          </g>
        </svg>

      {:else if resolvedFrameKey === 'timeweaver'}
        <svg viewBox="0 0 100 100" class="frame-svg frame-svg-timeweaver" aria-hidden="true">
          <circle cx="50" cy="50" r="39" class="ring-timeweaver-base" stroke="#d97706" stroke-width="2.5" fill="none" opacity="0.85" filter="drop-shadow(0 0 6px #d97706)"/>
          <circle cx="50" cy="50" r="42" class="ring-timeweaver-pulse" stroke="#38bdf8" stroke-width="1.2" stroke-dasharray="6,4" fill="none" opacity="0.9"/>
          <g class="nodes-timeweaver">
            <polygon points="50,4 53,9 50,14 47,9" fill="#38bdf8" filter="drop-shadow(0 0 4px #38bdf8)"/>
            <polygon points="50,86 53,91 50,96 47,91" fill="#38bdf8"/>
            <polygon points="4,50 9,53 14,50 9,47" fill="#d97706"/>
            <polygon points="86,50 91,53 96,50 91,47" fill="#d97706"/>
          </g>
        </svg>

      {:else if resolvedFrameKey === 'desertmirage'}
        <svg viewBox="0 0 100 100" class="frame-svg frame-svg-desertmirage" aria-hidden="true">
          <circle cx="50" cy="50" r="39" class="ring-desertmirage-base" stroke="#eab308" stroke-width="2.5" fill="none" opacity="0.85" filter="drop-shadow(0 0 6px #eab308)"/>
          <circle cx="50" cy="50" r="42" class="ring-desertmirage-pulse" stroke="#06b6d4" stroke-width="1.2" stroke-dasharray="6,4" fill="none" opacity="0.9"/>
          <g class="nodes-desertmirage">
            <polygon points="50,4 53,9 50,14 47,9" fill="#06b6d4" filter="drop-shadow(0 0 4px #06b6d4)"/>
            <polygon points="50,86 53,91 50,96 47,91" fill="#06b6d4"/>
            <polygon points="4,50 9,53 14,50 9,47" fill="#eab308"/>
            <polygon points="86,50 91,53 96,50 91,47" fill="#eab308"/>
          </g>
        </svg>

      {:else if resolvedFrameKey === 'krakenabyss'}
        <svg viewBox="0 0 100 100" class="frame-svg frame-svg-krakenabyss" aria-hidden="true">
          <circle cx="50" cy="50" r="39" class="ring-krakenabyss-base" stroke="#0284c7" stroke-width="2.5" fill="none" opacity="0.85" filter="drop-shadow(0 0 6px #0284c7)"/>
          <circle cx="50" cy="50" r="42" class="ring-krakenabyss-pulse" stroke="#06b6d4" stroke-width="1.2" stroke-dasharray="6,4" fill="none" opacity="0.9"/>
          <g class="nodes-krakenabyss">
            <polygon points="50,4 53,9 50,14 47,9" fill="#06b6d4" filter="drop-shadow(0 0 4px #06b6d4)"/>
            <polygon points="50,86 53,91 50,96 47,91" fill="#06b6d4"/>
            <polygon points="4,50 9,53 14,50 9,47" fill="#0284c7"/>
            <polygon points="86,50 91,53 96,50 91,47" fill="#0284c7"/>
          </g>
        </svg>

      {:else if resolvedFrameKey === 'teslaglobe'}
        <svg viewBox="0 0 100 100" class="frame-svg frame-svg-teslaglobe" aria-hidden="true">
          <circle cx="50" cy="50" r="39" class="ring-teslaglobe-base" stroke="#a855f7" stroke-width="2.5" fill="none" opacity="0.85" filter="drop-shadow(0 0 6px #a855f7)"/>
          <circle cx="50" cy="50" r="42" class="ring-teslaglobe-pulse" stroke="#38bdf8" stroke-width="1.2" stroke-dasharray="6,4" fill="none" opacity="0.9"/>
          <g class="nodes-teslaglobe">
            <polygon points="50,4 53,9 50,14 47,9" fill="#38bdf8" filter="drop-shadow(0 0 4px #38bdf8)"/>
            <polygon points="50,86 53,91 50,96 47,91" fill="#38bdf8"/>
            <polygon points="4,50 9,53 14,50 9,47" fill="#a855f7"/>
            <polygon points="86,50 91,53 96,50 91,47" fill="#a855f7"/>
          </g>
        </svg>

      {:else if resolvedFrameKey === 'archangelfeather'}
        <svg viewBox="0 0 100 100" class="frame-svg frame-svg-archangelfeather" aria-hidden="true">
          <circle cx="50" cy="50" r="39" class="ring-archangelfeather-base" stroke="#e2e8f0" stroke-width="2.5" fill="none" opacity="0.85" filter="drop-shadow(0 0 6px #e2e8f0)"/>
          <circle cx="50" cy="50" r="42" class="ring-archangelfeather-pulse" stroke="#fbbf24" stroke-width="1.2" stroke-dasharray="6,4" fill="none" opacity="0.9"/>
          <g class="nodes-archangelfeather">
            <polygon points="50,4 53,9 50,14 47,9" fill="#fbbf24" filter="drop-shadow(0 0 4px #fbbf24)"/>
            <polygon points="50,86 53,91 50,96 47,91" fill="#fbbf24"/>
            <polygon points="4,50 9,53 14,50 9,47" fill="#e2e8f0"/>
            <polygon points="86,50 91,53 96,50 91,47" fill="#e2e8f0"/>
          </g>
        </svg>

      {:else if resolvedFrameKey === 'demonhorns'}
        <svg viewBox="0 0 100 100" class="frame-svg frame-svg-demonhorns" aria-hidden="true">
          <circle cx="50" cy="50" r="39" class="ring-demonhorns-base" stroke="#b91c1c" stroke-width="2.5" fill="none" opacity="0.85" filter="drop-shadow(0 0 6px #b91c1c)"/>
          <circle cx="50" cy="50" r="42" class="ring-demonhorns-pulse" stroke="#7f1d1d" stroke-width="1.2" stroke-dasharray="6,4" fill="none" opacity="0.9"/>
          <path d="M25,28 Q10,5 28,2" stroke="#b91c1c" stroke-width="3.5" fill="none" stroke-linecap="round"/>
          <path d="M75,28 Q90,5 72,2" stroke="#b91c1c" stroke-width="3.5" fill="none" stroke-linecap="round"/>
          <polygon points="50,90 54,96 50,100 46,96" fill="#7f1d1d"/>
        </svg>

      {:else if resolvedFrameKey === 'motherboard'}
        <svg viewBox="0 0 100 100" class="frame-svg frame-svg-motherboard" aria-hidden="true">
          <circle cx="50" cy="50" r="39" class="ring-motherboard-base" stroke="#10b981" stroke-width="2.5" fill="none" opacity="0.85" filter="drop-shadow(0 0 6px #10b981)"/>
          <circle cx="50" cy="50" r="42" class="ring-motherboard-pulse" stroke="#06b6d4" stroke-width="1.2" stroke-dasharray="6,4" fill="none" opacity="0.9"/>
          <g class="nodes-motherboard">
            <polygon points="50,4 53,9 50,14 47,9" fill="#06b6d4" filter="drop-shadow(0 0 4px #06b6d4)"/>
            <polygon points="50,86 53,91 50,96 47,91" fill="#06b6d4"/>
            <polygon points="4,50 9,53 14,50 9,47" fill="#10b981"/>
            <polygon points="86,50 91,53 96,50 91,47" fill="#10b981"/>
          </g>
        </svg>

      {:else if resolvedFrameKey === 'galaxyvortex'}
        <svg viewBox="0 0 100 100" class="frame-svg frame-svg-galaxyvortex" aria-hidden="true">
          <circle cx="50" cy="50" r="39" class="ring-galaxyvortex-base" stroke="#8b5cf6" stroke-width="2.5" fill="none" opacity="0.85" filter="drop-shadow(0 0 6px #8b5cf6)"/>
          <circle cx="50" cy="50" r="42" class="ring-galaxyvortex-pulse" stroke="#ec4899" stroke-width="1.2" stroke-dasharray="6,4" fill="none" opacity="0.9"/>
          <g class="nodes-galaxyvortex">
            <polygon points="50,4 53,9 50,14 47,9" fill="#ec4899" filter="drop-shadow(0 0 4px #ec4899)"/>
            <polygon points="50,86 53,91 50,96 47,91" fill="#ec4899"/>
            <polygon points="4,50 9,53 14,50 9,47" fill="#8b5cf6"/>
            <polygon points="86,50 91,53 96,50 91,47" fill="#8b5cf6"/>
          </g>
        </svg>

      {:else if resolvedFrameKey === 'fairywings'}
        <svg viewBox="0 0 100 100" class="frame-svg frame-svg-fairywings" aria-hidden="true">
          <circle cx="50" cy="50" r="39" class="ring-fairywings-base" stroke="#34d399" stroke-width="2.5" fill="none" opacity="0.85" filter="drop-shadow(0 0 6px #34d399)"/>
          <circle cx="50" cy="50" r="42" class="ring-fairywings-pulse" stroke="#f472b6" stroke-width="1.2" stroke-dasharray="6,4" fill="none" opacity="0.9"/>
          <path d="M12,45 C2,25 25,15 45,35" stroke="#34d399" stroke-width="2" fill="none" opacity="0.9"/>
          <path d="M88,45 C98,25 75,15 55,35" stroke="#34d399" stroke-width="2" fill="none" opacity="0.9"/>
          <circle cx="50" cy="8" r="3.5" fill="#f472b6" filter="drop-shadow(0 0 6px #f472b6)"/>
        </svg>

      {:else if resolvedFrameKey === 'sovereignwyrm'}
        <svg viewBox="0 0 100 100" class="frame-svg frame-svg-sovereignwyrm" aria-hidden="true">
          <circle cx="50" cy="50" r="39" class="ring-sovereignwyrm-base" stroke="#eab308" stroke-width="2.5" fill="none" opacity="0.85" filter="drop-shadow(0 0 6px #eab308)"/>
          <circle cx="50" cy="50" r="42" class="ring-sovereignwyrm-pulse" stroke="#dc2626" stroke-width="1.2" stroke-dasharray="6,4" fill="none" opacity="0.9"/>
          <g class="nodes-sovereignwyrm">
            <polygon points="50,4 53,9 50,14 47,9" fill="#dc2626" filter="drop-shadow(0 0 4px #dc2626)"/>
            <polygon points="50,86 53,91 50,96 47,91" fill="#dc2626"/>
            <polygon points="4,50 9,53 14,50 9,47" fill="#eab308"/>
            <polygon points="86,50 91,53 96,50 91,47" fill="#eab308"/>
          </g>
        </svg>

      {:else if resolvedFrameKey === 'noxsingularity'}
        <svg viewBox="0 0 100 100" class="frame-svg frame-svg-noxsingularity" aria-hidden="true">
          <circle cx="50" cy="50" r="39" class="ring-noxsingularity-base" stroke="#8b5cf6" stroke-width="2.5" fill="none" opacity="0.85" filter="drop-shadow(0 0 6px #8b5cf6)"/>
          <circle cx="50" cy="50" r="42" class="ring-noxsingularity-pulse" stroke="#3b82f6" stroke-width="1.2" stroke-dasharray="6,4" fill="none" opacity="0.9"/>
          <g class="nodes-noxsingularity">
            <polygon points="50,4 53,9 50,14 47,9" fill="#3b82f6" filter="drop-shadow(0 0 4px #3b82f6)"/>
            <polygon points="50,86 53,91 50,96 47,91" fill="#3b82f6"/>
            <polygon points="4,50 9,53 14,50 9,47" fill="#8b5cf6"/>
            <polygon points="86,50 91,53 96,50 91,47" fill="#8b5cf6"/>
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

      

      {:else if resolvedFrameKey === 'phoenix'}
        <svg viewBox="0 0 100 100" class="frame-svg" aria-hidden="true">
          <circle cx="50" cy="50" r="38.5" class="frame-base-ring" />
          <path d="M16,45 C4,25 6,8 24,12 C18,24 22,36 32,46 Z" class="phoenix-wing wing-l" />
          <path d="M84,45 C96,25 94,8 76,12 C82,24 78,36 68,46 Z" class="phoenix-wing wing-r" />
          <circle cx="50" cy="50" r="41.5" class="frame-orbit-ring" />
          <polygon points="50,4 54,12 50,15 46,12" class="phoenix-crest" />
          <circle cx="50" cy="92" r="2.5" class="frame-mote" />
        </svg>

      {:else if resolvedFrameKey === 'dragon'}
        <svg viewBox="0 0 100 100" class="frame-svg" aria-hidden="true">
          <circle cx="50" cy="50" r="38.5" class="frame-base-ring" />
          <circle cx="50" cy="50" r="42" class="frame-orbit-ring" stroke-dasharray="10 6" />
          <polygon points="50,2 54,9 50,14 46,9" class="dragon-scale-horn" />
          <polygon points="26,16 33,22 28,26 22,20" class="dragon-claw" />
          <polygon points="74,16 78,20 72,26 67,22" class="dragon-claw" />
          <polygon points="50,98 46,91 50,86 54,91" class="dragon-scale-horn" />
        </svg>

      {:else if resolvedFrameKey === 'chrono'}
        <svg viewBox="0 0 100 100" class="frame-svg" aria-hidden="true">
          <circle cx="50" cy="50" r="39" class="frame-base-ring" />
          <circle cx="50" cy="50" r="42.5" class="chrono-teeth" stroke-dasharray="4 4" stroke-width="2.5" />
          <line x1="50" y1="50" x2="50" y2="16" class="chrono-hand-min" stroke-width="1.8" />
          <line x1="50" y1="50" x2="74" y2="50" class="chrono-hand-hour" stroke-width="2.2" />
          <circle cx="50" cy="50" r="3" class="frame-center-node" />
        </svg>

      {:else if resolvedFrameKey === 'chaos'}
        <svg viewBox="0 0 100 100" class="frame-svg" aria-hidden="true">
          <circle cx="50" cy="50" r="38.5" class="frame-base-ring" />
          <g class="chaos-nodes">
            <circle cx="20" cy="30" r="3.2" class="chaos-orb orb-1" />
            <circle cx="80" cy="30" r="3.2" class="chaos-orb orb-2" />
            <circle cx="50" cy="90" r="3.5" class="chaos-orb orb-3" />
          </g>
          <ellipse cx="50" cy="50" rx="43" ry="20" class="chaos-orbit" transform="rotate(45 50 50)" />
        </svg>

      {:else if resolvedFrameKey === 'valkyrie'}
        <svg viewBox="0 0 100 100" class="frame-svg" aria-hidden="true">
          <circle cx="50" cy="50" r="38.5" class="frame-base-ring" />
          <path d="M22,35 L12,12 L28,22 Z" class="valkyrie-wing" />
          <path d="M78,35 L88,12 L72,22 Z" class="valkyrie-wing" />
          <polygon points="50,4 53,10 50,13 47,10" class="valkyrie-tiara" />
          <circle cx="50" cy="50" r="41.5" class="frame-orbit-ring" />
        </svg>

      {:else if resolvedFrameKey === 'eye'}
        <svg viewBox="0 0 100 100" class="frame-svg" aria-hidden="true">
          <circle cx="50" cy="50" r="38.5" class="frame-base-ring" />
          <circle cx="50" cy="50" r="42" class="frame-orbit-ring" />
          <g class="eye-symbol" transform="translate(50, 10)">
            <path d="M-12,0 Q0,-8 12,0 Q0,8 -12,0 Z" class="eye-shape" />
            <circle cx="0" cy="0" r="2.5" class="eye-pupil" />
          </g>
        </svg>

      {:else if resolvedFrameKey === 'shield'}
        <svg viewBox="0 0 100 100" class="frame-svg" aria-hidden="true">
          <polygon points="50,8 86,29 86,71 50,92 14,71 14,29" class="shield-hexa" />
          <circle cx="50" cy="50" r="38.5" class="frame-base-ring" />
          <circle cx="50" cy="50" r="42" class="frame-orbit-ring" stroke-dasharray="12 8" />
        </svg>

      {:else if resolvedFrameKey === 'wraith'}
        <svg viewBox="0 0 100 100" class="frame-svg" aria-hidden="true">
          <circle cx="50" cy="50" r="38.5" class="frame-base-ring" />
          <path d="M20,60 Q30,90 50,85 Q70,90 80,60" class="wraith-mist-bot" />
          <circle cx="34" cy="24" r="2.2" class="frame-mote" />
          <circle cx="66" cy="24" r="2.2" class="frame-mote" />
        </svg>

      {:else if resolvedFrameKey === 'diamond'}
        <svg viewBox="0 0 100 100" class="frame-svg" aria-hidden="true">
          <polygon points="50,7 64,22 84,22 70,50 84,78 64,78 50,93 36,78 16,78 30,50 16,22 36,22" class="diamond-facets" />
          <circle cx="50" cy="50" r="38.5" class="frame-base-ring" />
        </svg>

      {:else if resolvedFrameKey === 'blade'}
        <svg viewBox="0 0 100 100" class="frame-svg" aria-hidden="true">
          <circle cx="50" cy="50" r="38.5" class="frame-base-ring" />
          <circle cx="50" cy="50" r="42" class="frame-orbit-ring" stroke-dasharray="12 6" />
          <!-- Katana 1 (TL to BR) -->
          <line x1="8" y1="8" x2="36" y2="36" class="blade-edge edge-tl" stroke-width="3" stroke-linecap="round" />
          <rect x="33" y="33" width="6" height="6" transform="rotate(45 36 36)" class="blade-tsuba" fill="var(--frame-secondary, #fbbf24)" />
          <line x1="64" y1="64" x2="92" y2="92" class="blade-edge edge-br" stroke-width="3" stroke-linecap="round" />
          <rect x="61" y="61" width="6" height="6" transform="rotate(45 64 64)" class="blade-tsuba" fill="var(--frame-secondary, #fbbf24)" />
          <!-- Katana 2 (TR to BL) -->
          <line x1="92" y1="8" x2="64" y2="36" class="blade-edge edge-tr" stroke-width="3" stroke-linecap="round" />
          <rect x="61" y="33" width="6" height="6" transform="rotate(45 64 36)" class="blade-tsuba" fill="var(--frame-secondary, #fbbf24)" />
          <line x1="36" y1="64" x2="8" y2="92" class="blade-edge edge-bl" stroke-width="3" stroke-linecap="round" />
          <rect x="33" y="61" width="6" height="6" transform="rotate(45 36 64)" class="blade-tsuba" fill="var(--frame-secondary, #fbbf24)" />
          <!-- Gleams at tips -->
          <circle cx="8" cy="8" r="2.5" class="frame-mote" />
          <circle cx="92" cy="8" r="2.5" class="frame-mote" />
        </svg>

      {:else if resolvedFrameKey === 'alchemy'}
        <svg viewBox="0 0 100 100" class="frame-svg" aria-hidden="true">
          <circle cx="50" cy="50" r="38.5" class="frame-base-ring" />
          <circle cx="50" cy="50" r="42.5" class="alchemy-ring" stroke-dasharray="14 6" />
          <polygon points="50,9 85,70 15,70" class="alchemy-tri tri-1" />
          <polygon points="50,91 15,30 85,30" class="alchemy-tri tri-2" />
        </svg>

      {:else if resolvedFrameKey === 'spider'}
        <svg viewBox="0 0 100 100" class="frame-svg" aria-hidden="true">
          <circle cx="50" cy="50" r="38.5" class="frame-base-ring" />
          <!-- Corner webs -->
          <path d="M12,12 L32,32 M12,20 Q20,20 20,12 M12,28 Q28,28 28,12" class="spider-web-strand" />
          <path d="M88,12 L68,32 M88,20 Q80,20 80,12 M88,28 Q72,28 72,12" class="spider-web-strand" />
          <path d="M12,88 L32,68 M12,80 Q20,80 20,88 M12,72 Q28,72 28,88" class="spider-web-strand" />
          <path d="M88,88 L68,68 M88,80 Q80,80 80,88 M88,72 Q72,72 72,88" class="spider-web-strand" />
          <!-- Spider at top descending -->
          <line x1="50" y1="0" x2="50" y2="12" stroke="var(--frame-secondary, #93c5fd)" stroke-width="1.2" stroke-dasharray="2 2" />
          <ellipse cx="50" cy="14" rx="3.5" ry="4.5" class="spider-jewel" />
          <circle cx="50" cy="9.5" r="2.2" class="spider-jewel" />
          <path d="M47,11 Q41,6 38,10 M47,13 Q39,12 37,17 M47,15 Q40,18 39,23 M47,16 Q42,22 43,26" stroke="var(--frame-primary, #3b82f6)" stroke-width="1.2" fill="none" />
          <path d="M53,11 Q59,6 62,10 M53,13 Q61,12 63,17 M53,15 Q60,18 61,23 M53,16 Q58,22 57,26" stroke="var(--frame-primary, #3b82f6)" stroke-width="1.2" fill="none" />
          <circle cx="50" cy="50" r="42" class="frame-orbit-ring" stroke-dasharray="8 6" />
        </svg>

      {:else if resolvedFrameKey === 'moon'}
        <svg viewBox="0 0 100 100" class="frame-svg" aria-hidden="true">
          <circle cx="50" cy="50" r="38.5" class="frame-base-ring" />
          <circle cx="50" cy="50" r="43.5" class="frame-orbit-ring" stroke-dasharray="2 4" stroke-width="1" />
          <!-- 8 Moon phases in true sequence -->
          <circle cx="50" cy="6.5" r="3.2" fill="none" stroke="var(--frame-primary, #e2e8f0)" stroke-width="1.2" />
          <path d="M76,16 A3.2,3.2 0 0,0 76,22.4 A3.2,3.2 0 0,1 76,16 Z" class="moon-phase" />
          <path d="M93.5,46.8 A3.2,3.2 0 0,1 93.5,53.2 Z" class="moon-phase" />
          <circle cx="76" cy="80" r="3.2" class="moon-phase" />
          <circle cx="50" cy="93.5" r="4.2" class="moon-phase full" filter="drop-shadow(0 0 6px var(--frame-glow, #ffffff))" />
          <circle cx="24" cy="80" r="3.2" class="moon-phase" />
          <path d="M6.5,46.8 A3.2,3.2 0 0,0 6.5,53.2 Z" class="moon-phase" />
          <path d="M24,16 A3.2,3.2 0 0,1 24,22.4 A3.2,3.2 0 0,0 24,16 Z" class="moon-phase" />
        </svg>

      {:else if resolvedFrameKey === 'supernova'}
        <svg viewBox="0 0 100 100" class="frame-svg" aria-hidden="true">
          <circle cx="50" cy="50" r="38.5" class="frame-base-ring" />
          <g class="supernova-rays">
            <line x1="50" y1="2" x2="50" y2="12" class="nova-beam beam-1" stroke-width="2.5" />
            <line x1="98" y1="50" x2="88" y2="50" class="nova-beam beam-2" stroke-width="2.5" />
            <line x1="50" y1="98" x2="50" y2="88" class="nova-beam beam-3" stroke-width="2.5" />
            <line x1="2" y1="50" x2="12" y2="50" class="nova-beam beam-4" stroke-width="2.5" />
          </g>
          <circle cx="50" cy="50" r="42" class="frame-orbit-ring" stroke-dasharray="6 4" />
        </svg>

      {:else if resolvedFrameKey === 'grail'}
        <svg viewBox="0 0 100 100" class="frame-svg" aria-hidden="true">
          <circle cx="50" cy="50" r="38.5" class="frame-base-ring" />
          <!-- Holy chalice at top -->
          <path d="M42,4 Q50,15 58,4 L55,14 L50,14 L50,18 L54,20 L46,20 L50,18 L50,14 L45,14 Z" class="grail-cup" fill="var(--frame-primary, #eab308)" stroke="var(--frame-secondary, #fef08a)" stroke-width="0.8" filter="drop-shadow(0 0 8px var(--frame-glow, #eab308))" />
          <circle cx="50" cy="2" r="2" class="frame-mote" />
          <line x1="50" y1="0" x2="50" y2="3" stroke="var(--frame-secondary, #fef08a)" stroke-width="1.5" />
          <line x1="38" y1="2" x2="41" y2="5" stroke="var(--frame-secondary, #fef08a)" stroke-width="1.2" />
          <line x1="62" y1="2" x2="59" y2="5" stroke="var(--frame-secondary, #fef08a)" stroke-width="1.2" />
          <circle cx="50" cy="50" r="42" class="frame-orbit-ring" stroke-dasharray="14 8" />
        </svg>

      {:else if resolvedFrameKey === 'kraken'}
        <svg viewBox="0 0 100 100" class="frame-svg" aria-hidden="true">
          <circle cx="50" cy="50" r="38.5" class="frame-base-ring" />
          <circle cx="50" cy="50" r="42" class="frame-orbit-ring" stroke-dasharray="8 6" />
          <!-- Left tentacles -->
          <path d="M14,50 Q4,68 12,82 Q20,92 28,78 Q22,70 20,56" class="kraken-arm arm-l1" />
          <path d="M22,72 Q12,88 24,96 Q32,98 34,84" class="kraken-arm arm-l2" />
          <!-- Right tentacles -->
          <path d="M86,50 Q96,68 88,82 Q80,92 72,78 Q78,70 80,56" class="kraken-arm arm-r1" />
          <path d="M78,72 Q88,88 76,96 Q68,98 66,84" class="kraken-arm arm-r2" />
          <!-- Center reaching tentacles -->
          <path d="M38,88 Q44,98 50,94 Q56,98 62,88" class="kraken-arm arm-center" stroke-width="2.2" />
          <!-- Glowing suckers -->
          <circle cx="10" cy="74" r="1.8" class="frame-mote" />
          <circle cx="90" cy="74" r="1.8" class="frame-mote" />
          <circle cx="20" cy="88" r="1.8" class="frame-mote" />
          <circle cx="80" cy="88" r="1.8" class="frame-mote" />
        </svg>

      {:else if resolvedFrameKey === 'sakura'}
        <svg viewBox="0 0 100 100" class="frame-svg" aria-hidden="true">
          <circle cx="50" cy="50" r="38.5" class="frame-base-ring" />
          <!-- Sakura blossom bough arches over top rim -->
          <path d="M22,30 Q36,10 60,8 Q78,7 86,18" fill="none" stroke="#78350f" stroke-width="2.2" stroke-linecap="round" />
          <!-- Blooming 5-petal sakura flower at top left -->
          <g transform="translate(36, 12)">
            <circle cx="0" cy="-3.5" r="2.5" class="sakura-petal" />
            <circle cx="3.3" cy="-1.1" r="2.5" class="sakura-petal" />
            <circle cx="2.1" cy="2.8" r="2.5" class="sakura-petal" />
            <circle cx="-2.1" cy="2.8" r="2.5" class="sakura-petal" />
            <circle cx="-3.3" cy="-1.1" r="2.5" class="sakura-petal" />
            <circle cx="0" cy="0" r="1.5" fill="#fef08a" />
          </g>
          <!-- Blooming sakura flower at top right -->
          <g transform="translate(70, 11)">
            <circle cx="0" cy="-3" r="2.2" class="sakura-petal" />
            <circle cx="2.8" cy="-0.9" r="2.2" class="sakura-petal" />
            <circle cx="1.8" cy="2.4" r="2.2" class="sakura-petal" />
            <circle cx="-1.8" cy="2.4" r="2.2" class="sakura-petal" />
            <circle cx="-2.8" cy="-0.9" r="2.2" class="sakura-petal" />
            <circle cx="0" cy="0" r="1.2" fill="#fef08a" />
          </g>
          <!-- Swirling petals caught in circular breeze -->
          <g class="sakura-petals-spin">
            <ellipse cx="14" cy="50" rx="3.5" ry="2" transform="rotate(35 14 50)" class="sakura-petal" />
            <ellipse cx="86" cy="55" rx="3.5" ry="2" transform="rotate(-40 86 55)" class="sakura-petal" />
            <ellipse cx="45" cy="92" rx="3.5" ry="2" transform="rotate(15 45 92)" class="sakura-petal" />
            <ellipse cx="28" cy="78" rx="3" ry="1.8" transform="rotate(-60 28 78)" class="sakura-petal" />
          </g>
        </svg>

      {:else if resolvedFrameKey === 'matrix'}
        <svg viewBox="0 0 100 100" class="frame-svg" aria-hidden="true">
          <circle cx="50" cy="50" r="38.5" class="frame-base-ring" />
          <!-- Matrix falling code streams -->
          <g class="matrix-code-fall">
            <line x1="20" y1="15" x2="20" y2="45" stroke="var(--frame-primary, #22c55e)" stroke-width="1.8" stroke-dasharray="3 3" />
            <line x1="80" y1="20" x2="80" y2="55" stroke="var(--frame-primary, #22c55e)" stroke-width="1.8" stroke-dasharray="3 3" />
            <line x1="30" y1="65" x2="30" y2="90" stroke="var(--frame-secondary, #86efac)" stroke-width="1.8" stroke-dasharray="2 3" />
            <line x1="70" y1="60" x2="70" y2="88" stroke="var(--frame-secondary, #86efac)" stroke-width="1.8" stroke-dasharray="2 3" />
          </g>
          <circle cx="20" cy="48" r="2" fill="var(--frame-secondary, #86efac)" filter="drop-shadow(0 0 4px #22c55e)" />
          <circle cx="80" cy="58" r="2" fill="var(--frame-secondary, #86efac)" filter="drop-shadow(0 0 4px #22c55e)" />
          <circle cx="50" cy="50" r="42" class="frame-orbit-ring" stroke-dasharray="8 4" />
        </svg>

      {:else if resolvedFrameKey === 'gargoyle'}
        <svg viewBox="0 0 100 100" class="frame-svg" aria-hidden="true">
          <circle cx="50" cy="50" r="38.5" class="frame-base-ring" />
          <!-- Gargoyle bat wings spreading outwards -->
          <path d="M22,35 C10,18 2,12 8,4 C14,14 18,22 28,30 Z" class="gargoyle-wing wing-l" />
          <path d="M78,35 C90,18 98,12 92,4 C86,14 82,22 72,30 Z" class="gargoyle-wing wing-r" />
          <!-- Demonic curved horns at top -->
          <path d="M42,12 Q38,2 32,4 Q38,8 44,14 Z" fill="var(--frame-secondary, #ef4444)" />
          <path d="M58,12 Q62,2 68,4 Q62,8 56,14 Z" fill="var(--frame-secondary, #ef4444)" />
          <!-- Claws gripping bottom rim -->
          <polygon points="32,84 35,92 38,84 35,80" class="gargoyle-claw" fill="var(--frame-secondary, #ef4444)" />
          <polygon points="62,84 65,92 68,84 65,80" class="gargoyle-claw" fill="var(--frame-secondary, #ef4444)" />
          <!-- Gargoyle ruby eye crest -->
          <polygon points="50,6 54,12 50,15 46,12" fill="var(--frame-secondary, #ef4444)" filter="drop-shadow(0 0 6px #ef4444)" />
        </svg>

      {:else if resolvedFrameKey === 'harp'}
        <svg viewBox="0 0 100 100" class="frame-svg" aria-hidden="true">
          <circle cx="50" cy="50" r="38.5" class="frame-base-ring" />
          <path d="M40,10 Q55,4 60,18 L58,26" class="harp-frame" />
          <line x1="44" y1="10" x2="44" y2="24" class="harp-string string-1" stroke-width="1.2" />
          <line x1="48" y1="8" x2="48" y2="24" class="harp-string string-2" stroke-width="1.2" />
          <line x1="52" y1="8" x2="52" y2="24" class="harp-string string-3" stroke-width="1.2" />
          <circle cx="50" cy="50" r="41.5" class="frame-orbit-ring" />
        </svg>

      {:else if resolvedFrameKey === 'portal'}
        <svg viewBox="0 0 100 100" class="frame-svg" aria-hidden="true">
          <circle cx="50" cy="50" r="38.5" class="frame-base-ring" />
          <circle cx="50" cy="50" r="42.5" class="portal-outer" stroke-dasharray="18 10" />
          <polygon points="50,5 54,11 46,11" class="portal-chevron chev-t" />
          <polygon points="95,50 89,54 89,46" class="portal-chevron chev-r" />
          <polygon points="50,95 46,89 54,89" class="portal-chevron chev-b" />
          <polygon points="5,50 11,46 11,54" class="portal-chevron chev-l" />
        </svg>

      {:else if resolvedFrameKey === 'volcanic'}
        <svg viewBox="0 0 100 100" class="frame-svg" aria-hidden="true">
          <circle cx="50" cy="50" r="38.5" class="frame-base-ring" />
          <circle cx="50" cy="50" r="42" class="frame-orbit-ring" stroke-dasharray="8 6" />
          <polygon points="48,6 52,6 54,14 46,14" class="volcanic-spout" />
          <circle cx="24" cy="80" r="2.5" class="volcanic-ember" />
          <circle cx="76" cy="80" r="2.5" class="volcanic-ember" />
        </svg>

      {:else if resolvedFrameKey === 'glacier'}
        <svg viewBox="0 0 100 100" class="frame-svg" aria-hidden="true">
          <circle cx="50" cy="50" r="38.5" class="frame-base-ring" />
          <!-- Asymmetric Jagged Ice Spikes radiating outwards -->
          <polygon points="50,2 54,16 50,13 46,16" class="glacier-shards" fill="var(--frame-light, #e0f2fe)" stroke="var(--frame-primary, #0284c7)" stroke-width="1.2" />
          <polygon points="20,12 28,24 23,24 17,21" class="glacier-shards" fill="var(--frame-light, #e0f2fe)" stroke="var(--frame-primary, #0284c7)" stroke-width="1.2" />
          <polygon points="80,12 83,21 77,24 72,24" class="glacier-shards" fill="var(--frame-light, #e0f2fe)" stroke="var(--frame-primary, #0284c7)" stroke-width="1.2" />
          <polygon points="4,50 16,46 13,50 16,54" class="glacier-shards" fill="var(--frame-light, #e0f2fe)" stroke="var(--frame-primary, #0284c7)" stroke-width="1.2" />
          <polygon points="96,50 84,46 87,50 84,54" class="glacier-shards" fill="var(--frame-light, #e0f2fe)" stroke="var(--frame-primary, #0284c7)" stroke-width="1.2" />
          <polygon points="50,98 46,84 50,87 54,84" class="glacier-shards" fill="var(--frame-light, #e0f2fe)" stroke="var(--frame-primary, #0284c7)" stroke-width="1.2" />
          <circle cx="50" cy="50" r="42.5" class="frame-orbit-ring" stroke-dasharray="14 10" stroke-width="1.5" />
        </svg>

      {:else if resolvedFrameKey === 'ouroboros'}
        <svg viewBox="0 0 100 100" class="frame-svg" aria-hidden="true">
          <circle cx="50" cy="50" r="38.5" class="ouroboros-body" stroke-dasharray="6 3" stroke-width="3.5" />
          <circle cx="50" cy="50" r="42" class="frame-orbit-ring" stroke-dasharray="2 4" stroke-width="1" />
          <!-- Serpentine head biting tail at top -->
          <g transform="translate(50, 11.5)">
            <path d="M-6,-4 Q0,-8 6,-4 Q8,2 2,5 L-5,5 Z" fill="var(--frame-primary, #059669)" />
            <path d="M-5,-4 Q-9,-10 -6,-12 M5,-4 Q9,-10 6,-12" stroke="var(--frame-secondary, #34d399)" stroke-width="1.4" fill="none" />
            <circle cx="-2" cy="-2" r="1.2" fill="#ef4444" filter="drop-shadow(0 0 3px #ef4444)" />
            <circle cx="2" cy="-2" r="1.2" fill="#ef4444" filter="drop-shadow(0 0 3px #ef4444)" />
          </g>
          <path d="M48,15 Q50,19 52,15" stroke="var(--frame-secondary, #34d399)" stroke-width="2" fill="none" />
        </svg>

      {:else if resolvedFrameKey === 'blackhole'}
        <svg viewBox="0 0 100 100" class="frame-svg" aria-hidden="true">
          <circle cx="50" cy="50" r="38.5" class="frame-base-ring" stroke="#000000" stroke-width="3" filter="drop-shadow(0 0 8px var(--frame-primary, #7e22ce))" />
          <!-- Relativistic Lensed Accretion Disk (Gargantua warped arch) -->
          <path d="M12,50 C12,18 88,18 88,50" fill="none" stroke="var(--frame-primary, #7e22ce)" stroke-width="3.5" filter="drop-shadow(0 0 8px var(--frame-glow, #f43f5e))" />
          <!-- Front accretion ring -->
          <ellipse cx="50" cy="50" rx="46" ry="15" class="accretion-disc" transform="rotate(-15 50 50)" />
          <!-- Relativistic Polar Jet Beams -->
          <line x1="50" y1="12" x2="50" y2="0" stroke="var(--frame-secondary, #f43f5e)" stroke-width="2.5" stroke-linecap="round" filter="drop-shadow(0 0 6px #f43f5e)" />
          <line x1="50" y1="88" x2="50" y2="100" stroke="var(--frame-secondary, #f43f5e)" stroke-width="2.5" stroke-linecap="round" filter="drop-shadow(0 0 6px #f43f5e)" />
        </svg>

      {:else if resolvedFrameKey === 'mandala'}
        <svg viewBox="0 0 100 100" class="frame-svg" aria-hidden="true">
          <circle cx="50" cy="50" r="38.5" class="frame-base-ring" />
          <circle cx="50" cy="50" r="42" class="mandala-petals" stroke-dasharray="6 6" />
          <polygon points="50,8 60,20 50,32 40,20" class="mandala-petal p-t" />
          <polygon points="50,92 60,80 50,68 40,80" class="mandala-petal p-b" />
        </svg>

      {:else if resolvedFrameKey === 'steampunk'}
        <svg viewBox="0 0 100 100" class="frame-svg" aria-hidden="true">
          <circle cx="50" cy="50" r="38.5" class="frame-base-ring" />
          <circle cx="50" cy="50" r="42" class="steampunk-gear gear-main" stroke-dasharray="5 3" stroke-width="3.5" />
          <!-- Top-left interlocking sub-gear -->
          <g transform="translate(18, 18)" class="steampunk-sub1">
            <circle cx="0" cy="0" r="10" class="steampunk-gear gear-sub1" stroke-dasharray="4 3" stroke-width="2.5" />
            <circle cx="0" cy="0" r="3" fill="var(--frame-secondary, #fbbf24)" />
          </g>
          <!-- Bottom-right interlocking sub-gear -->
          <g transform="translate(82, 82)" class="steampunk-sub2">
            <circle cx="0" cy="0" r="10" class="steampunk-gear gear-sub2" stroke-dasharray="4 3" stroke-width="2.5" />
            <circle cx="0" cy="0" r="3" fill="var(--frame-secondary, #fbbf24)" />
          </g>
          <!-- Brass rivets at cardinal points -->
          <circle cx="50" cy="7" r="2" class="frame-center-node" />
          <circle cx="50" cy="93" r="2" class="frame-center-node" />
          <circle cx="7" cy="50" r="2" class="frame-center-node" />
          <circle cx="93" cy="50" r="2" class="frame-center-node" />
        </svg>

      {:else if resolvedFrameKey === 'plasma'}
        <svg viewBox="0 0 100 100" class="frame-svg" aria-hidden="true">
          <circle cx="50" cy="50" r="38.5" class="frame-base-ring" />
          <path d="M22,30 Q36,18 50,30 Q64,42 78,30" class="plasma-arc arc-t" />
          <path d="M22,70 Q36,82 50,70 Q64,58 78,70" class="plasma-arc arc-b" />
          <circle cx="50" cy="50" r="42" class="frame-orbit-ring" />
        </svg>

      {:else if resolvedFrameKey === 'shadow'}
        <svg viewBox="0 0 100 100" class="frame-svg" aria-hidden="true">
          <circle cx="50" cy="50" r="38.5" class="frame-base-ring" />
          <path d="M16,40 Q28,14 50,18 Q72,14 84,40 Q68,26 50,30 Q32,26 16,40 Z" class="shadow-cloak" />
          <circle cx="50" cy="90" r="2.5" class="frame-mote" />
        </svg>

      {:else if resolvedFrameKey === 'compass'}
        <svg viewBox="0 0 100 100" class="frame-svg" aria-hidden="true">
          <circle cx="50" cy="50" r="38.5" class="frame-base-ring" />
          <circle cx="50" cy="50" r="43" class="frame-orbit-ring" stroke-dasharray="2 3" stroke-width="1.2" />
          <!-- Cardinal large points -->
          <polygon points="50,2 53,14 50,11 47,14" class="compass-needle needle-n" filter="drop-shadow(0 0 6px var(--frame-glow, #38bdf8))" />
          <polygon points="50,98 53,86 50,89 47,86" class="compass-needle needle-s" />
          <polygon points="2,50 14,53 11,50 14,47" class="compass-needle needle-w" />
          <polygon points="98,50 86,53 89,50 86,47" class="compass-needle needle-e" />
          <!-- Ordinal smaller points -->
          <polygon points="16,16 25,23 23,21 21,23" class="compass-needle needle-nw" />
          <polygon points="84,16 75,23 77,21 79,23" class="compass-needle needle-ne" />
          <polygon points="16,84 25,77 23,79 21,77" class="compass-needle needle-sw" />
          <polygon points="84,84 75,77 77,79 79,77" class="compass-needle needle-se" />
          <!-- Compass center ring -->
          <circle cx="50" cy="50" r="40" fill="none" stroke="var(--frame-secondary, #38bdf8)" stroke-width="0.8" />
        </svg>

      {:else if resolvedFrameKey === 'fairy'}
        <svg viewBox="0 0 100 100" class="frame-svg" aria-hidden="true">
          <circle cx="50" cy="50" r="38.5" class="frame-base-ring" />
          <circle cx="50" cy="50" r="42" class="frame-orbit-ring" />
          <g class="fairy-particles">
            <circle cx="30" cy="18" r="2.2" class="fairy-dust d-1" />
            <circle cx="70" cy="18" r="2.2" class="fairy-dust d-2" />
            <circle cx="85" cy="60" r="2.5" class="fairy-dust d-3" />
            <circle cx="15" cy="60" r="2.5" class="fairy-dust d-4" />
          </g>
        </svg>

      {:else if resolvedFrameKey === 'emperor'}
        <svg viewBox="0 0 100 100" class="frame-svg" aria-hidden="true">
          <circle cx="50" cy="50" r="38.5" class="frame-base-ring" />
          <!-- Sovereign Imperial Crown at top -->
          <path d="M30,16 L34,8 L42,13 L50,4 L58,13 L66,8 L70,16 Z" class="emperor-crown" />
          <circle cx="50" cy="3" r="2" fill="#ffffff" filter="drop-shadow(0 0 4px #ffffff)" />
          <circle cx="34" cy="7" r="1.5" fill="#ef4444" />
          <circle cx="66" cy="7" r="1.5" fill="#ef4444" />
          <!-- Imperial Laurel Wreath along bottom half -->
          <ellipse cx="20" cy="62" rx="3.5" ry="1.8" transform="rotate(-30 20 62)" fill="var(--frame-primary, #eab308)" />
          <ellipse cx="24" cy="74" rx="3.5" ry="1.8" transform="rotate(-50 24 74)" fill="var(--frame-primary, #eab308)" />
          <ellipse cx="34" cy="84" rx="3.5" ry="1.8" transform="rotate(-70 34 84)" fill="var(--frame-primary, #eab308)" />
          <ellipse cx="80" cy="62" rx="3.5" ry="1.8" transform="rotate(30 80 62)" fill="var(--frame-primary, #eab308)" />
          <ellipse cx="76" cy="74" rx="3.5" ry="1.8" transform="rotate(50 76 74)" fill="var(--frame-primary, #eab308)" />
          <ellipse cx="66" cy="84" rx="3.5" ry="1.8" transform="rotate(70 66 84)" fill="var(--frame-primary, #eab308)" />
          <circle cx="50" cy="92" r="3" fill="var(--frame-secondary, #ffffff)" filter="drop-shadow(0 0 5px var(--frame-glow, #eab308))" />
        </svg>

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

  .avatar-custom-frame-overlay {
    position: absolute;
    top: 50%;
    left: 50%;
    width: 100%;
    height: 100%;
    pointer-events: none;
    z-index: 2;
    overflow: visible;
    display: flex;
    align-items: center;
    justify-content: center;
    transform: translate(calc(-50% + var(--frame-offset-x, 0%)), calc(-50% + var(--frame-offset-y, 0%))) scale(var(--frame-scale, 1.25));
    transform-origin: center center;
  }

  .avatar-custom-frame-asset {
    width: 100%;
    height: 100%;
    max-width: none;
    max-height: none;
    display: block;
    pointer-events: none;
  }

  .avatar-frame-image {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 128%;
    height: 128%;
    object-fit: contain;
    pointer-events: none;
    z-index: 2;
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

  /* =========================================================================
     UNIVERSAL TINT VARIABLES & NEW FRAMES (Round 5: 50 Frames)
     ========================================================================= */
  .tint-blue { --frame-primary: #38bdf8; --frame-secondary: #0284c7; --frame-glow: rgba(56, 189, 248, 0.85); --frame-light: #e0f2fe; }
  .tint-crimson { --frame-primary: #ef4444; --frame-secondary: #b91c1c; --frame-glow: rgba(239, 68, 68, 0.85); --frame-light: #fecaca; }
  .tint-violet { --frame-primary: #a855f7; --frame-secondary: #7e22ce; --frame-glow: rgba(168, 85, 247, 0.85); --frame-light: #f3e8ff; }
  .tint-emerald { --frame-primary: #10b981; --frame-secondary: #047857; --frame-glow: rgba(16, 185, 129, 0.85); --frame-light: #d1fae5; }
  .tint-gold { --frame-primary: #fbbf24; --frame-secondary: #d97706; --frame-glow: rgba(251, 191, 36, 0.85); --frame-light: #fef08a; }
  .tint-cyan { --frame-primary: #06b6d4; --frame-secondary: #0891b2; --frame-glow: rgba(6, 182, 212, 0.85); --frame-light: #cffafe; }
  .tint-magenta { --frame-primary: #f43f5e; --frame-secondary: #e11d48; --frame-glow: rgba(244, 63, 94, 0.85); --frame-light: #ffe4e6; }
  .tint-green { --frame-primary: #22c55e; --frame-secondary: #16a34a; --frame-glow: rgba(34, 197, 94, 0.85); --frame-light: #dcfce7; }
  .tint-orange { --frame-primary: #f97316; --frame-secondary: #c2410c; --frame-glow: rgba(249, 115, 22, 0.85); --frame-light: #ffedd5; }
  .tint-silver { --frame-primary: #e2e8f0; --frame-secondary: #94a3b8; --frame-glow: rgba(226, 232, 240, 0.85); --frame-light: #ffffff; }
  .tint-white { --frame-primary: #ffffff; --frame-secondary: #cbd5e1; --frame-glow: rgba(255, 255, 255, 0.9); --frame-light: #ffffff; }
  .tint-rose { --frame-primary: #fb7185; --frame-secondary: #e11d48; --frame-glow: rgba(251, 113, 133, 0.85); --frame-light: #ffe4e6; }

  /* Universal reactive tint styling for procedural and new frames */
  [class*="tint-"] [class*="ring-"][class*="-base"] {
    stroke: var(--frame-primary) !important;
    filter: drop-shadow(0 0 6px var(--frame-glow, var(--frame-primary))) !important;
  }
  [class*="tint-"] [class*="ring-"][class*="-pulse"] {
    stroke: var(--frame-secondary) !important;
  }
  [class*="tint-"] [class*="nodes-"] * {
    fill: var(--frame-primary) !important;
  }
  [class*="tint-"] [class*="frame-svg-"] > path {
    stroke: var(--frame-primary) !important;
  }
  [class*="tint-"] [class*="frame-svg-"] > polygon {
    fill: var(--frame-secondary) !important;
  }

  .frame-base-ring { fill: none; stroke: var(--frame-primary, #a855f7); stroke-width: 2.2; filter: drop-shadow(0 0 6px var(--frame-glow, rgba(168, 85, 247, 0.85))); }
  .frame-orbit-ring { fill: none; stroke: var(--frame-secondary, #c084fc); stroke-width: 1.5; animation: rotateCw 8s linear infinite; transform-origin: 50px 50px; }
  .frame-mote { fill: var(--frame-light, #ffffff); filter: drop-shadow(0 0 4px var(--frame-glow, rgba(255, 255, 255, 0.9))); animation: starTwinkle 2s ease-in-out infinite; }
  .frame-center-node { fill: var(--frame-primary, #fbbf24); filter: drop-shadow(0 0 6px var(--frame-glow, rgba(251, 191, 36, 0.9))); }

  .phoenix-wing { fill: var(--frame-primary, #f97316); stroke: var(--frame-secondary, #fbbf24); animation: seraphFloat 2.6s ease-in-out infinite; transform-origin: 50px 50px; }
  .phoenix-crest { fill: var(--frame-secondary, #fbbf24); filter: drop-shadow(0 0 6px var(--frame-glow, #f97316)); }

  .dragon-scale-horn { fill: var(--frame-primary, #dc2626); stroke: var(--frame-secondary, #f87171); stroke-width: 0.8; animation: gemBreathe 3s ease-in-out infinite; transform-origin: 50px 50px; }
  .dragon-claw { fill: var(--frame-secondary, #f87171); filter: drop-shadow(0 0 4px var(--frame-glow, #dc2626)); }

  .chrono-teeth { fill: none; stroke: var(--frame-primary, #d97706); animation: rotateCw 20s linear infinite; transform-origin: 50px 50px; }
  .chrono-hand-min { stroke: var(--frame-secondary, #fde68a); animation: rotateCw 6s linear infinite; transform-origin: 50px 50px; }
  .chrono-hand-hour { stroke: var(--frame-primary, #d97706); animation: rotateCw 18s linear infinite; transform-origin: 50px 50px; }

  .chaos-nodes { animation: rotateCcw 7s linear infinite; transform-origin: 50px 50px; }
  .chaos-orb { fill: var(--frame-secondary, #ec4899); filter: drop-shadow(0 0 6px var(--frame-glow, #a855f7)); }
  .chaos-orbit { fill: none; stroke: var(--frame-primary, #a855f7); stroke-width: 1.2; stroke-dasharray: 6 4; }

  .valkyrie-wing { fill: var(--frame-secondary, #ffffff); stroke: var(--frame-primary, #38bdf8); stroke-width: 1.2; animation: seraphFloat 3s ease-in-out infinite; }
  .valkyrie-tiara { fill: var(--frame-primary, #38bdf8); filter: drop-shadow(0 0 6px var(--frame-glow, #38bdf8)); }

  .eye-symbol { animation: gemBreathe 2.5s ease-in-out infinite; transform-origin: 50px 10px; }
  .eye-shape { fill: none; stroke: var(--frame-primary, #8b5cf6); stroke-width: 2; }
  .eye-pupil { fill: var(--frame-secondary, #c084fc); filter: drop-shadow(0 0 5px var(--frame-glow, #8b5cf6)); }

  .shield-hexa { fill: none; stroke: var(--frame-primary, #06b6d4); stroke-width: 2; animation: gemBreathe 3.5s ease-in-out infinite; transform-origin: 50px 50px; }

  .wraith-mist-bot { fill: none; stroke: var(--frame-primary, #10b981); stroke-width: 3; stroke-linecap: round; filter: drop-shadow(0 0 8px var(--frame-glow, #10b981)); animation: cyberBlink 3s infinite; }

  .diamond-facets { fill: none; stroke: var(--frame-primary, #e2e8f0); stroke-width: 1.6; filter: drop-shadow(0 0 6px var(--frame-glow, rgba(226, 232, 240, 0.8))); animation: rotateCw 28s linear infinite; transform-origin: 50px 50px; }

  .blade-edge { stroke: var(--frame-primary, #6366f1); stroke-linecap: round; filter: drop-shadow(0 0 6px var(--frame-glow, #6366f1)); animation: cyberBlink 3s infinite; }

  .alchemy-ring { fill: none; stroke: var(--frame-primary, #f59e0b); stroke-width: 1.4; animation: rotateCw 18s linear infinite; transform-origin: 50px 50px; }
  .alchemy-tri { fill: none; stroke: var(--frame-secondary, #fde68a); stroke-width: 1.5; }
  .alchemy-tri.tri-1 { animation: rotateCw 14s linear infinite; transform-origin: 50px 50px; }
  .alchemy-tri.tri-2 { animation: rotateCcw 14s linear infinite; transform-origin: 50px 50px; }

  .spider-web-strand { fill: none; stroke: var(--frame-primary, #3b82f6); stroke-width: 1.5; stroke-dasharray: 4 2; }
  .spider-jewel { fill: var(--frame-secondary, #93c5fd); filter: drop-shadow(0 0 6px var(--frame-glow, #3b82f6)); }

  .moon-phase { fill: var(--frame-primary, #e2e8f0); filter: drop-shadow(0 0 5px var(--frame-glow, rgba(226, 232, 240, 0.8))); animation: starTwinkle 3s ease-in-out infinite; }

  .supernova-rays { animation: rotateCw 12s linear infinite; transform-origin: 50px 50px; }
  .nova-beam { stroke: var(--frame-primary, #f97316); filter: drop-shadow(0 0 6px var(--frame-glow, #f97316)); }

  .grail-base, .grail-cup { fill: var(--frame-primary, #eab308); stroke: var(--frame-secondary, #fef08a); stroke-width: 0.8; animation: gemBreathe 2.8s ease-in-out infinite; transform-origin: 50px 14px; }

  .kraken-arm { fill: none; stroke: var(--frame-primary, #0ea5e9); stroke-width: 2.4; stroke-linecap: round; filter: drop-shadow(0 0 6px var(--frame-glow, #0ea5e9)); animation: cyberBlink 3s infinite; }

  .sakura-petals-spin { animation: rotateCw 16s linear infinite; transform-origin: 50px 50px; }
  .sakura-petal { fill: var(--frame-primary, #f43f5e); filter: drop-shadow(0 0 4px var(--frame-glow, #f43f5e)); }

  .matrix-code-fall { stroke: var(--frame-primary, #22c55e); animation: rotateCcw 8s linear infinite; transform-origin: 50px 50px; }

  .gargoyle-wing { fill: var(--frame-primary, #991b1b); stroke: var(--frame-secondary, #ef4444); stroke-width: 0.8; animation: seraphFloat 3.2s ease-in-out infinite; transform-origin: 50px 50px; }
  .gargoyle-claw { fill: var(--frame-secondary, #ef4444); }

  .harp-frame { fill: none; stroke: var(--frame-primary, #38bdf8); stroke-width: 2; }
  .harp-string { stroke: var(--frame-secondary, #c084fc); animation: cyberBlink 2.5s infinite; }

  .portal-outer { fill: none; stroke: var(--frame-primary, #7c3aed); stroke-width: 2.2; animation: rotateCw 6s linear infinite; transform-origin: 50px 50px; }
  .portal-chevron { fill: var(--frame-secondary, #c4b5fd); filter: drop-shadow(0 0 6px var(--frame-glow, #7c3aed)); }

  .volcanic-spout { fill: var(--frame-primary, #c2410c); animation: gemBreathe 2s ease-in-out infinite; transform-origin: 50px 50px; }
  .volcanic-ember { fill: var(--frame-secondary, #fb923c); filter: drop-shadow(0 0 4px #c2410c); animation: sporePulse 2.4s infinite; }

  .glacier-shards { fill: none; stroke: var(--frame-primary, #0284c7); stroke-width: 2; animation: rotateCw 25s linear infinite; transform-origin: 50px 50px; }

  .ouroboros-body { fill: none; stroke: var(--frame-primary, #059669); stroke-width: 2.5; animation: rotateCw 10s linear infinite; transform-origin: 50px 50px; }
  .ouroboros-head { fill: var(--frame-secondary, #34d399); filter: drop-shadow(0 0 6px #059669); }

  .accretion-disc { fill: none; stroke: var(--frame-primary, #7e22ce); stroke-width: 3; animation: rotateCw 5s linear infinite; transform-origin: 50px 50px; }

  .mandala-petals { fill: none; stroke: var(--frame-primary, #d97706); stroke-width: 2; animation: rotateCcw 15s linear infinite; transform-origin: 50px 50px; }
  .mandala-petal { fill: var(--frame-secondary, #fef08a); }

  .steampunk-gear { fill: none; stroke: var(--frame-primary, #b45309); animation: rotateCw 12s linear infinite; transform-origin: 50px 50px; }

  .plasma-arc { fill: none; stroke: var(--frame-primary, #2563eb); stroke-width: 2; stroke-linecap: round; filter: drop-shadow(0 0 6px #2563eb); animation: cyberBlink 1.8s infinite; }

  .shadow-cloak { fill: var(--frame-primary, #475569); stroke: var(--frame-secondary, #94a3b8); stroke-width: 1.5; animation: gemBreathe 3s ease-in-out infinite; transform-origin: 50px 50px; }

  .compass-needle { fill: var(--frame-primary, #0284c7); stroke: var(--frame-secondary, #38bdf8); stroke-width: 0.8; animation: rotateCw 24s linear infinite; transform-origin: 50px 50px; }

  .fairy-particles { animation: rotateCcw 9s linear infinite; transform-origin: 50px 50px; }
  .fairy-dust { fill: var(--frame-primary, #ec4899); filter: drop-shadow(0 0 5px #ec4899); }

  .emperor-crown { fill: var(--frame-primary, #eab308); stroke: var(--frame-secondary, #ffffff); stroke-width: 1.2; filter: drop-shadow(0 0 8px #eab308); animation: seraphFloat 3s ease-in-out infinite; transform-origin: 50px 50px; }


  @keyframes seraphFloat {
    0%, 100% { transform: translateY(0) scale(1); }
    50% { transform: translateY(-3px) scale(1.04); }
  }

  .steampunk-sub1 { animation: rotateCcw 8s linear infinite; transform-origin: 18px 18px; }
  .steampunk-sub2 { animation: rotateCcw 8s linear infinite; transform-origin: 82px 82px; }
  .arm-l1 { animation: waveSwell 2.8s ease-in-out infinite; transform-origin: 14px 50px; }
  .arm-r1 { animation: waveSwell 2.8s ease-in-out infinite 0.7s; transform-origin: 86px 50px; }
  .arm-l2 { animation: waveSwell 3.2s ease-in-out infinite 0.4s; transform-origin: 22px 72px; }
  .arm-r2 { animation: waveSwell 3.2s ease-in-out infinite 1.1s; transform-origin: 78px 72px; }
  .arm-center { animation: gemBreathe 2.4s ease-in-out infinite; transform-origin: 50px 94px; }


  /* Round Final Procedural Frames 51-100 Animations */
  @keyframes noxPulseRing { 0%, 100% { opacity: 0.65; transform: scale(1); } 50% { opacity: 1; transform: scale(1.03); } }
  @keyframes noxRotateFrame { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
  .frame-katana .ring-katana-pulse { transform-origin: 50px 50px; animation: noxRotateFrame 18s linear infinite; }
  .frame-katana .ring-katana-base { transform-origin: 50px 50px; animation: noxPulseRing 4.5s ease-in-out infinite; }
  .frame-infdragon .ring-infdragon-pulse { transform-origin: 50px 50px; animation: noxRotateFrame 18s linear infinite; }
  .frame-infdragon .ring-infdragon-base { transform-origin: 50px 50px; animation: noxPulseRing 4.5s ease-in-out infinite; }
  .frame-clockwork .ring-clockwork-pulse { transform-origin: 50px 50px; animation: noxRotateFrame 18s linear infinite; }
  .frame-clockwork .ring-clockwork-base { transform-origin: 50px 50px; animation: noxPulseRing 4.5s ease-in-out infinite; }
  .frame-leviathan .ring-leviathan-pulse { transform-origin: 50px 50px; animation: noxRotateFrame 18s linear infinite; }
  .frame-leviathan .ring-leviathan-base { transform-origin: 50px 50px; animation: noxPulseRing 4.5s ease-in-out infinite; }
  .frame-alchemouroboros .ring-alchemouroboros-pulse { transform-origin: 50px 50px; animation: noxRotateFrame 18s linear infinite; }
  .frame-alchemouroboros .ring-alchemouroboros-base { transform-origin: 50px 50px; animation: noxPulseRing 4.5s ease-in-out infinite; }
  .frame-halodivinus .ring-halodivinus-pulse { transform-origin: 50px 50px; animation: noxRotateFrame 18s linear infinite; }
  .frame-halodivinus .ring-halodivinus-base { transform-origin: 50px 50px; animation: noxPulseRing 4.5s ease-in-out infinite; }
  .frame-blackrose .ring-blackrose-pulse { transform-origin: 50px 50px; animation: noxRotateFrame 18s linear infinite; }
  .frame-blackrose .ring-blackrose-base { transform-origin: 50px 50px; animation: noxPulseRing 4.5s ease-in-out infinite; }
  .frame-nanotech .ring-nanotech-pulse { transform-origin: 50px 50px; animation: noxRotateFrame 18s linear infinite; }
  .frame-nanotech .ring-nanotech-base { transform-origin: 50px 50px; animation: noxPulseRing 4.5s ease-in-out infinite; }
  .frame-stormconductor .ring-stormconductor-pulse { transform-origin: 50px 50px; animation: noxRotateFrame 18s linear infinite; }
  .frame-stormconductor .ring-stormconductor-base { transform-origin: 50px 50px; animation: noxPulseRing 4.5s ease-in-out infinite; }
  .frame-amethystcluster .ring-amethystcluster-pulse { transform-origin: 50px 50px; animation: noxRotateFrame 18s linear infinite; }
  .frame-amethystcluster .ring-amethystcluster-base { transform-origin: 50px 50px; animation: noxPulseRing 4.5s ease-in-out infinite; }
  .frame-vampirelord .ring-vampirelord-pulse { transform-origin: 50px 50px; animation: noxRotateFrame 18s linear infinite; }
  .frame-vampirelord .ring-vampirelord-base { transform-origin: 50px 50px; animation: noxPulseRing 4.5s ease-in-out infinite; }
  .frame-solarphoenix .ring-solarphoenix-pulse { transform-origin: 50px 50px; animation: noxRotateFrame 18s linear infinite; }
  .frame-solarphoenix .ring-solarphoenix-base { transform-origin: 50px 50px; animation: noxPulseRing 4.5s ease-in-out infinite; }
  .frame-cyberoverdrive .ring-cyberoverdrive-pulse { transform-origin: 50px 50px; animation: noxRotateFrame 18s linear infinite; }
  .frame-cyberoverdrive .ring-cyberoverdrive-base { transform-origin: 50px 50px; animation: noxPulseRing 4.5s ease-in-out infinite; }
  .frame-runicring .ring-runicring-pulse { transform-origin: 50px 50px; animation: noxRotateFrame 18s linear infinite; }
  .frame-runicring .ring-runicring-base { transform-origin: 50px 50px; animation: noxPulseRing 4.5s ease-in-out infinite; }
  .frame-frostglacier .ring-frostglacier-pulse { transform-origin: 50px 50px; animation: noxRotateFrame 18s linear infinite; }
  .frame-frostglacier .ring-frostglacier-base { transform-origin: 50px 50px; animation: noxPulseRing 4.5s ease-in-out infinite; }
  .frame-tribalshaman .ring-tribalshaman-pulse { transform-origin: 50px 50px; animation: noxRotateFrame 18s linear infinite; }
  .frame-tribalshaman .ring-tribalshaman-base { transform-origin: 50px 50px; animation: noxPulseRing 4.5s ease-in-out infinite; }
  .frame-andromeda .ring-andromeda-pulse { transform-origin: 50px 50px; animation: noxRotateFrame 18s linear infinite; }
  .frame-andromeda .ring-andromeda-base { transform-origin: 50px 50px; animation: noxPulseRing 4.5s ease-in-out infinite; }
  .frame-sixseraph .ring-sixseraph-pulse { transform-origin: 50px 50px; animation: noxRotateFrame 18s linear infinite; }
  .frame-sixseraph .ring-sixseraph-base { transform-origin: 50px 50px; animation: noxPulseRing 4.5s ease-in-out infinite; }
  .frame-valkspear .ring-valkspear-pulse { transform-origin: 50px 50px; animation: noxRotateFrame 18s linear infinite; }
  .frame-valkspear .ring-valkspear-base { transform-origin: 50px 50px; animation: noxPulseRing 4.5s ease-in-out infinite; }
  .frame-astrolabe .ring-astrolabe-pulse { transform-origin: 50px 50px; animation: noxRotateFrame 18s linear infinite; }
  .frame-astrolabe .ring-astrolabe-base { transform-origin: 50px 50px; animation: noxPulseRing 4.5s ease-in-out infinite; }
  .frame-dragonouroboros .ring-dragonouroboros-pulse { transform-origin: 50px 50px; animation: noxRotateFrame 18s linear infinite; }
  .frame-dragonouroboros .ring-dragonouroboros-base { transform-origin: 50px 50px; animation: noxPulseRing 4.5s ease-in-out infinite; }
  .frame-blacksun .ring-blacksun-pulse { transform-origin: 50px 50px; animation: noxRotateFrame 18s linear infinite; }
  .frame-blacksun .ring-blacksun-base { transform-origin: 50px 50px; animation: noxPulseRing 4.5s ease-in-out infinite; }
  .frame-toxichazard .ring-toxichazard-pulse { transform-origin: 50px 50px; animation: noxRotateFrame 18s linear infinite; }
  .frame-toxichazard .ring-toxichazard-base { transform-origin: 50px 50px; animation: noxPulseRing 4.5s ease-in-out infinite; }
  .frame-eldritch .ring-eldritch-pulse { transform-origin: 50px 50px; animation: noxRotateFrame 18s linear infinite; }
  .frame-eldritch .ring-eldritch-base { transform-origin: 50px 50px; animation: noxPulseRing 4.5s ease-in-out infinite; }
  .frame-imperialmonarch .ring-imperialmonarch-pulse { transform-origin: 50px 50px; animation: noxRotateFrame 18s linear infinite; }
  .frame-imperialmonarch .ring-imperialmonarch-base { transform-origin: 50px 50px; animation: noxPulseRing 4.5s ease-in-out infinite; }
  .frame-enchantedflora .ring-enchantedflora-pulse { transform-origin: 50px 50px; animation: noxRotateFrame 18s linear infinite; }
  .frame-enchantedflora .ring-enchantedflora-base { transform-origin: 50px 50px; animation: noxPulseRing 4.5s ease-in-out infinite; }
  .frame-meteorring .ring-meteorring-pulse { transform-origin: 50px 50px; animation: noxRotateFrame 18s linear infinite; }
  .frame-meteorring .ring-meteorring-base { transform-origin: 50px 50px; animation: noxPulseRing 4.5s ease-in-out infinite; }
  .frame-bindingchains .ring-bindingchains-pulse { transform-origin: 50px 50px; animation: noxRotateFrame 18s linear infinite; }
  .frame-bindingchains .ring-bindingchains-base { transform-origin: 50px 50px; animation: noxPulseRing 4.5s ease-in-out infinite; }
  .frame-stargate .ring-stargate-pulse { transform-origin: 50px 50px; animation: noxRotateFrame 18s linear infinite; }
  .frame-stargate .ring-stargate-base { transform-origin: 50px 50px; animation: noxPulseRing 4.5s ease-in-out infinite; }
  .frame-prismrefraction .ring-prismrefraction-pulse { transform-origin: 50px 50px; animation: noxRotateFrame 18s linear infinite; }
  .frame-prismrefraction .ring-prismrefraction-base { transform-origin: 50px 50px; animation: noxPulseRing 4.5s ease-in-out infinite; }
  .frame-darkmatter .ring-darkmatter-pulse { transform-origin: 50px 50px; animation: noxRotateFrame 18s linear infinite; }
  .frame-darkmatter .ring-darkmatter-base { transform-origin: 50px 50px; animation: noxPulseRing 4.5s ease-in-out infinite; }
  .frame-spartanaegis .ring-spartanaegis-pulse { transform-origin: 50px 50px; animation: noxRotateFrame 18s linear infinite; }
  .frame-spartanaegis .ring-spartanaegis-base { transform-origin: 50px 50px; animation: noxPulseRing 4.5s ease-in-out infinite; }
  .frame-bloodmoon .ring-bloodmoon-pulse { transform-origin: 50px 50px; animation: noxRotateFrame 18s linear infinite; }
  .frame-bloodmoon .ring-bloodmoon-base { transform-origin: 50px 50px; animation: noxPulseRing 4.5s ease-in-out infinite; }
  .frame-graillight .ring-graillight-pulse { transform-origin: 50px 50px; animation: noxRotateFrame 18s linear infinite; }
  .frame-graillight .ring-graillight-base { transform-origin: 50px 50px; animation: noxPulseRing 4.5s ease-in-out infinite; }
  .frame-sentineldone .ring-sentineldone-pulse { transform-origin: 50px 50px; animation: noxRotateFrame 18s linear infinite; }
  .frame-sentineldone .ring-sentineldone-base { transform-origin: 50px 50px; animation: noxPulseRing 4.5s ease-in-out infinite; }
  .frame-zenlotus .ring-zenlotus-pulse { transform-origin: 50px 50px; animation: noxRotateFrame 18s linear infinite; }
  .frame-zenlotus .ring-zenlotus-base { transform-origin: 50px 50px; animation: noxPulseRing 4.5s ease-in-out infinite; }
  .frame-arachneweb .ring-arachneweb-pulse { transform-origin: 50px 50px; animation: noxRotateFrame 18s linear infinite; }
  .frame-arachneweb .ring-arachneweb-base { transform-origin: 50px 50px; animation: noxPulseRing 4.5s ease-in-out infinite; }
  .frame-hellchains .ring-hellchains-pulse { transform-origin: 50px 50px; animation: noxRotateFrame 18s linear infinite; }
  .frame-hellchains .ring-hellchains-base { transform-origin: 50px 50px; animation: noxPulseRing 4.5s ease-in-out infinite; }
  .frame-supernovaring .ring-supernovaring-pulse { transform-origin: 50px 50px; animation: noxRotateFrame 18s linear infinite; }
  .frame-supernovaring .ring-supernovaring-base { transform-origin: 50px 50px; animation: noxPulseRing 4.5s ease-in-out infinite; }
  .frame-timeweaver .ring-timeweaver-pulse { transform-origin: 50px 50px; animation: noxRotateFrame 18s linear infinite; }
  .frame-timeweaver .ring-timeweaver-base { transform-origin: 50px 50px; animation: noxPulseRing 4.5s ease-in-out infinite; }
  .frame-desertmirage .ring-desertmirage-pulse { transform-origin: 50px 50px; animation: noxRotateFrame 18s linear infinite; }
  .frame-desertmirage .ring-desertmirage-base { transform-origin: 50px 50px; animation: noxPulseRing 4.5s ease-in-out infinite; }
  .frame-krakenabyss .ring-krakenabyss-pulse { transform-origin: 50px 50px; animation: noxRotateFrame 18s linear infinite; }
  .frame-krakenabyss .ring-krakenabyss-base { transform-origin: 50px 50px; animation: noxPulseRing 4.5s ease-in-out infinite; }
  .frame-teslaglobe .ring-teslaglobe-pulse { transform-origin: 50px 50px; animation: noxRotateFrame 18s linear infinite; }
  .frame-teslaglobe .ring-teslaglobe-base { transform-origin: 50px 50px; animation: noxPulseRing 4.5s ease-in-out infinite; }
  .frame-archangelfeather .ring-archangelfeather-pulse { transform-origin: 50px 50px; animation: noxRotateFrame 18s linear infinite; }
  .frame-archangelfeather .ring-archangelfeather-base { transform-origin: 50px 50px; animation: noxPulseRing 4.5s ease-in-out infinite; }
  .frame-demonhorns .ring-demonhorns-pulse { transform-origin: 50px 50px; animation: noxRotateFrame 18s linear infinite; }
  .frame-demonhorns .ring-demonhorns-base { transform-origin: 50px 50px; animation: noxPulseRing 4.5s ease-in-out infinite; }
  .frame-motherboard .ring-motherboard-pulse { transform-origin: 50px 50px; animation: noxRotateFrame 18s linear infinite; }
  .frame-motherboard .ring-motherboard-base { transform-origin: 50px 50px; animation: noxPulseRing 4.5s ease-in-out infinite; }
  .frame-galaxyvortex .ring-galaxyvortex-pulse { transform-origin: 50px 50px; animation: noxRotateFrame 18s linear infinite; }
  .frame-galaxyvortex .ring-galaxyvortex-base { transform-origin: 50px 50px; animation: noxPulseRing 4.5s ease-in-out infinite; }
  .frame-fairywings .ring-fairywings-pulse { transform-origin: 50px 50px; animation: noxRotateFrame 18s linear infinite; }
  .frame-fairywings .ring-fairywings-base { transform-origin: 50px 50px; animation: noxPulseRing 4.5s ease-in-out infinite; }
  .frame-sovereignwyrm .ring-sovereignwyrm-pulse { transform-origin: 50px 50px; animation: noxRotateFrame 18s linear infinite; }
  .frame-sovereignwyrm .ring-sovereignwyrm-base { transform-origin: 50px 50px; animation: noxPulseRing 4.5s ease-in-out infinite; }
  .frame-noxsingularity .ring-noxsingularity-pulse { transform-origin: 50px 50px; animation: noxRotateFrame 18s linear infinite; }
  .frame-noxsingularity .ring-noxsingularity-base { transform-origin: 50px 50px; animation: noxPulseRing 4.5s ease-in-out infinite; }

</style>
