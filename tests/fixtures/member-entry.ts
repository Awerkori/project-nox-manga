import { mount } from 'svelte';

(globalThis as any).__sveltekit_dev ??= { env: {} };

const { default: Harness } = await import('./MemberHarness.svelte');

mount(Harness, { target: document.getElementById('member')! });
