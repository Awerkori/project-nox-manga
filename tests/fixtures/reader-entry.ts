import { mount } from 'svelte';
import Harness from './ReaderHarness.svelte';
import '../../src/app.css';
mount(Harness, { target: document.getElementById('reader')! });
