import { mount } from 'svelte';
import PublicScanHarness from './ScanPublicProofHarness.svelte';
import '../../src/app.css';

mount(PublicScanHarness, {
  target: document.getElementById('preview-root')!
});
