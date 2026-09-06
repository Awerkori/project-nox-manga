import { mount } from 'svelte';
import Harness from './EditorHarness.svelte';
import '../../src/app.css';
mount(Harness, { target: document.getElementById('editor')! });
