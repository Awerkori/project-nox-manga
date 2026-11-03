type DeferredImageOptions = {
  src: string | null | undefined;
  rootMargin?: string;
};

// A page can contain dozens of covers with the same visibility threshold.
// Share an observer for each margin instead of allocating one per image.
type ObserverGroup = {
  observer: IntersectionObserver;
  callbacks: Map<Element, () => void>;
};
const observerGroups = new Map<string, ObserverGroup>();

function observeCover(node: HTMLImageElement, margin: string, onVisible: () => void): () => void {
  let group = observerGroups.get(margin);
  if (!group) {
    const callbacks = new Map<Element, () => void>();
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) callbacks.get(entry.target)?.();
      }
    }, { rootMargin: margin, threshold: 0.01 });
    group = { observer, callbacks };
    observerGroups.set(margin, group);
  }
  const selected = group;
  selected.callbacks.set(node, onVisible);
  selected.observer.observe(node);
  return () => {
    selected.observer.unobserve(node);
    selected.callbacks.delete(node);
    if (selected.callbacks.size === 0 && observerGroups.get(margin) === selected) {
      selected.observer.disconnect();
      observerGroups.delete(margin);
    }
  };
}

/**
 * Native lazy loading uses a very large browser-dependent distance and was
 * starting dozens of Telegram-backed cover requests on a single view. This
 * action only assigns src near the viewport, preserving the first-view budget.
 */
export function deferImage(node: HTMLImageElement, initial: DeferredImageOptions) {
  let unobserve: (() => void) | null = null;
  let options = initial;
  let loaded = Boolean(node.getAttribute('src'));

  const stop = () => {
    unobserve?.();
    unobserve = null;
  };

  const load = () => {
    if (loaded || !options.src) return;
    loaded = true;
    stop();
    node.src = options.src;
  };

  const observe = () => {
    stop();
    if (loaded || !options.src) return;
    if (typeof IntersectionObserver === 'undefined') {
      load();
      return;
    }
    unobserve = observeCover(node, options.rootMargin || '500px 0px', load);
  };

  observe();
  return {
    update(next: DeferredImageOptions) {
      options = next;
      if (!loaded) observe();
    },
    destroy: stop
  };
}
