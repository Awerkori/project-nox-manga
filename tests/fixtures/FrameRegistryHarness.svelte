<script lang="ts">
  import UserAvatar from '$lib/components/UserAvatar.svelte';
  import { registerDynamicFrame } from '$lib/frame-config';
  registerDynamicFrame('fixture-frame', { asset_url: '/__fixture-frame.svg', style_data: { frame_scale: 1.5 } });
</script>

<UserAvatar frameId="fixture-frame" displayName="Teste" />
<UserAvatar frameId="frame_cosmic_nox" displayName="Curated" />
