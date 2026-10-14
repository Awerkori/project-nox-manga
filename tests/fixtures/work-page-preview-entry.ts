import { mount } from 'svelte';
import '../../src/app.css';

(globalThis as any).__sveltekit_dev ??= { env: {} };
const { default: Harness } = await import('./WorkPagePreviewHarness.svelte');
mount(Harness, { target: document.getElementById('preview-root')! });
