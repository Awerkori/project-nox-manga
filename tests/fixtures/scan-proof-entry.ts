import { mount } from 'svelte';
import Harness from './ScanProofHarness.svelte';
import '../../src/app.css';

const params = new URLSearchParams(window.location.search);
const initialTab = params.get('tab') || 'pipeline';
const initialStage = params.get('stage') || 'clean_redraw';
const role = params.get('role') || 'OWNER';

mount(Harness, {
  target: document.getElementById('preview-root')!,
  props: { initialTab, initialStage, role }
});
