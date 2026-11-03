import { deferImage } from '../../src/lib/actions/defer-image';

for (const node of document.querySelectorAll<HTMLImageElement>('img[data-cover]')) {
  const action = deferImage(node, { src: node.dataset.cover });
  node.addEventListener('cover-change', (event) => {
    action.update({ src: (event as CustomEvent<string>).detail });
  });
}
