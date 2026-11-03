import { deferImage } from '../../src/lib/actions/defer-image';

for (const node of document.querySelectorAll<HTMLImageElement>('img[data-cover]')) {
  deferImage(node, { src: node.dataset.cover });
}
