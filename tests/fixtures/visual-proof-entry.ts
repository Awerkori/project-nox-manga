import { mount } from 'svelte';
import Harness from './VisualProofHarness.svelte';
import '../../src/app.css';

const params = new URLSearchParams(window.location.search);
const view = params.get('view') || 'storage';

mount(Harness, {
  target: document.getElementById('preview-root')!,
  props: { view }
});
