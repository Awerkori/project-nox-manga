import { mount } from 'svelte';
import WorkShelf from '../../src/lib/components/WorkShelf.svelte';

mount(WorkShelf, {
  target: document.getElementById('app')!,
  props: {
    title: 'Histórias',
    loadMoreSort: 'latest',
    works: [{ id: 'one', slug: 'one', title: 'Primeira história', kind: 'MANGA' }] as any
  }
});
