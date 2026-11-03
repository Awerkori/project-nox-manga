import { mount } from 'svelte';
import HeroCarousel from '../../src/lib/components/HeroCarousel.svelte';

mount(HeroCarousel, {
  target: document.getElementById('app')!,
  props: {
    works: [
      { id: 'a', slug: 'a', title: 'First', cover_id: '/fixture-active.svg', kind: 'MANGA' },
      { id: 'b', slug: 'b', title: 'Next', cover_id: '/fixture-next.svg', kind: 'MANGA' },
      { id: 'c', slug: 'c', title: 'Previous', cover_id: '/fixture-previous.svg', kind: 'MANGA' }
    ] as any
  }
});
