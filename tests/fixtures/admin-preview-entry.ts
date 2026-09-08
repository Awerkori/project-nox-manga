import { mount } from 'svelte';
import Harness from './AdminPreviewHarness.svelte';
import '../../src/app.css';

const params = new URLSearchParams(window.location.search);
const page = params.get('view') || 'dashboard';
const role = (params.get('role') || 'ADMIN') as 'ADMIN' | 'EDITOR';

mount(Harness, {
  target: document.getElementById('preview-root')!,
  props: { page, role }
});
