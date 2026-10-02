import { mount } from 'svelte';
import '../../src/app.css';

(globalThis as any).__sveltekit_dev ??= { env: {} };

const { default: Harness } = await import('./AdminPreviewHarness.svelte');

const params = new URLSearchParams(window.location.search);
const page = params.get('view') || 'dashboard';
const role = (params.get('role') || 'ADMIN') as 'ADMIN' | 'EDITOR';

mount(Harness, {
  target: document.getElementById('preview-root')!,
  props: { page, role }
});
