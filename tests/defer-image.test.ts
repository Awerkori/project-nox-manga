import { afterEach, describe, expect, it, vi } from 'vitest';
import { deferImage } from '../src/lib/actions/defer-image';

class FakeObserver {
  static instances: FakeObserver[] = [];
  observed = new Set<Element>();
  disconnect = vi.fn();
  constructor(private callback: IntersectionObserverCallback, public options: IntersectionObserverInit) {
    FakeObserver.instances.push(this);
  }
  observe = (node: Element) => { this.observed.add(node); };
  unobserve = (node: Element) => { this.observed.delete(node); };
  trigger(node: Element, isIntersecting = true) {
    this.callback([{ target: node, isIntersecting } as IntersectionObserverEntry], this as unknown as IntersectionObserver);
  }
}

function image() {
  return { src: '', getAttribute: () => null } as unknown as HTMLImageElement;
}

describe('deferred cover loading', () => {
  afterEach(() => { vi.unstubAllGlobals(); FakeObserver.instances = []; });

  it('shares observers by margin, loads only visible covers and cleans them up', () => {
    vi.stubGlobal('IntersectionObserver', FakeObserver);
    const images = Array.from({ length: 100 }, image);
    const actions = images.map((node, i) => deferImage(node, { src: `/cover/${i}`, rootMargin: i < 50 ? '500px 0px' : '0px 450px' }));
    expect(FakeObserver.instances).toHaveLength(2);
    const [vertical, horizontal] = FakeObserver.instances;
    expect(vertical.observed.size).toBe(50);
    expect(horizontal.observed.size).toBe(50);
    vertical.trigger(images[0], false);
    expect(images[0].src).toBe('');
    vertical.trigger(images[0]);
    expect(images[0].src).toBe('/cover/0');
    expect(images[1].src).toBe('');
    actions.forEach((action) => action.destroy());
    expect(vertical.observed.size).toBe(0);
    expect(horizontal.observed.size).toBe(0);
    expect(vertical.disconnect).toHaveBeenCalledOnce();
    expect(horizontal.disconnect).toHaveBeenCalledOnce();
  });

  it('moves a pending image to a new margin and loads its latest URL', () => {
    vi.stubGlobal('IntersectionObserver', FakeObserver);
    const node = image();
    const action = deferImage(node, { src: '/old' });
    const first = FakeObserver.instances[0];
    action.update({ src: '/new', rootMargin: '10px' });
    expect(first.observed.size).toBe(0);
    FakeObserver.instances[1].trigger(node);
    expect(node.src).toBe('/new');
    action.destroy();
  });

  it('loads immediately when IntersectionObserver is unavailable', () => {
    vi.stubGlobal('IntersectionObserver', undefined);
    const node = image();
    const action = deferImage(node, { src: '/cover' });
    expect(node.src).toBe('/cover');
    action.destroy();
  });

  it('updates a displayed cover when its keyed card receives a new URL', () => {
    vi.stubGlobal('IntersectionObserver', FakeObserver);
    const node = image();
    const action = deferImage(node, { src: '/old' });
    FakeObserver.instances[0].trigger(node);
    expect(node.src).toBe('/old');
    action.update({ src: '/new' });
    expect(node.src).toBe('/new');
    expect(FakeObserver.instances).toHaveLength(1);
    action.destroy();
  });
});
