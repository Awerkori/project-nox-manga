<script lang="ts">
  import UserAvatar from '$lib/components/UserAvatar.svelte';
  import { computeFrameFitFromUrl, type FrameFit } from '$lib/frame-fit';

  const MEDIA = 'https://home-preview-manga.project-nox-awerkori.workers.dev/media/';

  // Square SVG frame (1:1) with horns/crown leaving the circle.
  const squareFrame =
    'data:image/svg+xml;utf8,' +
    encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400" width="400" height="400">
      <circle cx="200" cy="215" r="120" fill="none" stroke="#c084fc" stroke-width="22"/>
      <path d="M110 120 L70 20 L150 95 Z" fill="#7c3aed"/><path d="M290 120 L330 20 L250 95 Z" fill="#7c3aed"/>
      <path d="M150 92 L175 40 L200 80 L225 40 L250 92 Z" fill="#fbbf24"/>
      <circle cx="200" cy="350" r="16" fill="#f43f5e"/></svg>`);

  // Wide rectangular SVG frame (2:1) with wings; opening off-centre.
  const wideFrame =
    'data:image/svg+xml;utf8,' +
    encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 300" width="600" height="300">
      <path d="M240 150 C120 40 40 60 10 20 C40 140 120 200 230 190 Z" fill="#38bdf8" opacity=".85"/>
      <path d="M400 150 C520 40 600 60 590 20 C570 140 500 200 410 190 Z" fill="#38bdf8" opacity=".85"/>
      <circle cx="320" cy="160" r="100" fill="none" stroke="#e2e8f0" stroke-width="16"/></svg>`);

  type Scenario = { key: string; label: string; avatarId?: string | null; crop?: any; frameUrl?: string; frameId?: string; size: number };
  const scenarios: Scenario[] = [
    { key: 'face-top-default', label: 'Personagem (rosto no topo) — crop salvo do usuário', avatarId: '4c812f93-6bb1-40f9-9151-dc2d20e86e5e', crop: { x: 0, y: 0, zoom: 1 }, size: 110 },
    { key: 'face-top-nocrop', label: 'Mesmo avatar SEM crop (comportamento antigo das prévias)', avatarId: '4c812f93-6bb1-40f9-9151-dc2d20e86e5e', crop: null, size: 110 },
    { key: 'wide-avatar', label: 'Avatar 2:1 (outro usuário, crop x=100)', avatarId: '12efda41-ed3d-40a5-b58c-f77275356641', crop: { x: 100, y: 50, zoom: 1 }, size: 110 },
    { key: 'gif-avatar', label: 'Avatar GIF com zoom 1.85 (outro usuário)', avatarId: '1f8888f1-46db-498c-9d77-96ff349cfa4d', crop: { x: 28, y: 72, zoom: 1.85 }, size: 110 },
    { key: 'halloween', label: 'Moldura PNG Halloween (803×705) — auto-ajuste', avatarId: '4c812f93-6bb1-40f9-9151-dc2d20e86e5e', crop: { x: 0, y: 0, zoom: 1 }, frameUrl: '/__fixtures/halloween.png', size: 110 },
    { key: 'square', label: 'Moldura SVG quadrada com chifres — auto-ajuste', avatarId: '5a13c33e-e692-41a8-b8f8-53922d21127e', crop: { x: 55, y: 45, zoom: 1.5 }, frameUrl: squareFrame, size: 110 },
    { key: 'wide', label: 'Moldura SVG retangular 2:1 com asas — auto-ajuste', avatarId: '94279a76-6b93-45d1-ab66-74c4e4b305a5', crop: null, frameUrl: wideFrame, size: 110 },
    { key: 'procedural-angelic', label: 'Moldura animada existente (Serafim)', avatarId: '4c812f93-6bb1-40f9-9151-dc2d20e86e5e', crop: { x: 0, y: 0, zoom: 1 }, frameId: 'frame_angelic_seraph', size: 110 },
    { key: 'procedural-cosmic', label: 'Moldura animada existente (Cosmic Nox)', avatarId: '94279a76-6b93-45d1-ab66-74c4e4b305a5', crop: null, frameId: 'frame_cosmic_nox', size: 110 }
  ];

  let fits = $state<Record<string, FrameFit | null>>({});
  let ready = $state(false);

  $effect(() => {
    (async () => {
      const next: Record<string, FrameFit | null> = {};
      for (const s of scenarios) {
        if (!s.frameUrl) continue;
        try {
          const r = await computeFrameFitFromUrl(s.frameUrl);
          next[s.key] = r.ok ? r.fit : null;
        } catch {
          next[s.key] = null;
        }
      }
      fits = next;
      ready = true;
    })();
  });
</script>

<div class="grid" data-ready={ready}>
  {#each scenarios as s (s.key)}
    {@const fit = fits[s.key]}
    <figure class="cell" data-scenario={s.key} data-fit={fit ? JSON.stringify(fit) : ''}>
      <div class="stage">
        <UserAvatar
          avatarUrl={s.avatarId ? MEDIA + s.avatarId : null}
          crop={s.crop}
          frameId={s.frameId ?? null}
          frameUrl={s.frameUrl ?? null}
          frameScale={fit?.frame_scale}
          frameOffsetX={fit?.frame_offset_x}
          frameOffsetY={fit?.frame_offset_y}
          frameFit={fit?.frame_fit}
          size={s.size}
          loading="eager"
          displayName="Teste"
        />
      </div>
      <figcaption>
        {s.label}
        {#if fit}<code>scale {fit.frame_scale} · x {fit.frame_offset_x}% · y {fit.frame_offset_y}%</code>{/if}
      </figcaption>
    </figure>
  {/each}

  <!-- Comment-row context: frames must not clip and must not shift layout -->
  <figure class="cell wide-cell" data-scenario="comment-row">
    <div class="comment-row">
      <UserAvatar avatarUrl={MEDIA + '4c812f93-6bb1-40f9-9151-dc2d20e86e5e'} crop={{ x: 0, y: 0, zoom: 1 }} frameUrl="/__fixtures/halloween.png" frameScale={fits.halloween?.frame_scale} frameOffsetX={fits.halloween?.frame_offset_x} frameOffsetY={fits.halloween?.frame_offset_y} size={38} loading="eager" />
      <div><strong>Awerkori</strong><p>Comentário de teste com moldura personalizada equipada.</p></div>
    </div>
    <figcaption>Contexto real: linha de comentário (38px)</figcaption>
  </figure>
</div>

<style>
  :global(body) { margin: 0; background: #0b0d16; color: #e2e8f0; font-family: system-ui, sans-serif; }
  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(230px, 1fr)); gap: 18px; padding: 24px; }
  .cell { margin: 0; background: #12152a; border: 1px solid #23284a; border-radius: 12px; padding: 16px; display: flex; flex-direction: column; align-items: center; gap: 10px; }
  .wide-cell { grid-column: 1 / -1; align-items: flex-start; }
  .stage { width: 200px; height: 200px; display: flex; align-items: center; justify-content: center; }
  figcaption { font-size: 12px; text-align: center; color: #94a3b8; display: flex; flex-direction: column; gap: 4px; }
  code { color: #dfc28d; font-size: 11px; }
  .comment-row { display: flex; gap: 14px; align-items: flex-start; padding: 16px; background: #181c33; border-radius: 10px; width: 100%; max-width: 520px; box-sizing: border-box; }
  .comment-row p { margin: 4px 0 0; font-size: 13px; color: #cbd5e1; }
</style>
