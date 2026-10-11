import { mount } from 'svelte';
import Harness from './MySpaceHarness.svelte';

mount(Harness, { target: document.getElementById('my-space')! });
