import { mount } from 'svelte';
import ParticleBackground from '../../src/lib/components/ParticleBackground.svelte';

mount(ParticleBackground, { target: document.getElementById('particle')! });
