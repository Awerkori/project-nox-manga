type DeferredImageOptions = {
  src: string | null | undefined;
  rootMargin?: string;
};

/**
 * Native lazy loading uses a very large browser-dependent distance and was
 * starting dozens of Telegram-backed cover requests on a single view. This
 * action only assigns src near the viewport, preserving the first-view budget.
 */
export function deferImage(node: HTMLImageElement, initial: DeferredImageOptions) {
  let observer: IntersectionObserver | null = null;
  let options = initial;
  let loaded = Boolean(node.getAttribute('src'));

  const stop = () => {
    observer?.disconnect();
    observer = null;
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
    observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) load();
      },
      { rootMargin: options.rootMargin || '500px 0px', threshold: 0.01 }
    );
    observer.observe(node);
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
