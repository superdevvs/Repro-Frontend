/* Play the saved perspective motion once, then leave the browser tab icon idle. */
(() => {
  const link = document.querySelector('link[data-re-favicon]');
  if (!link) return;
  const staticHref = link.href;
  const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const controller = new AbortController();
  const canvas = document.createElement('canvas');
  let context;
  let sprite;
  let manifest;
  let request = 0;
  let startedAt = 0;
  let lastFrame = -1;
  let loading = false;
  let disposed = false;
  let started = false;
  let pageHidden = false;

  function stop() {
    if (request) cancelAnimationFrame(request);
    request = 0;
    if (lastFrame !== -1) {
      link.type = 'image/svg+xml';
      link.href = staticHref;
    }
    lastFrame = -1;
  }

  function finish() {
    stop();
    disposed = true;
    controller.abort();
    motion.removeEventListener('change', sync);
    document.removeEventListener('visibilitychange', sync);
    window.removeEventListener('pageshow', onPageShow);
    window.removeEventListener('pagehide', onPageHide);
    context = sprite = manifest = undefined;
    canvas.width = canvas.height = 0;
  }

  function tick(now) {
    request = 0;
    if (disposed || pageHidden || document.hidden || motion.matches) {
      finish();
      return;
    }
    const { frameSize, count, columns, durationMs } = manifest;
    const elapsed = now - startedAt;
    if (elapsed >= durationMs) {
      finish();
      return;
    }
    const frame = Math.max(0, Math.floor(elapsed / durationMs * count));
    if (frame !== lastFrame) {
      try {
        context.clearRect(0, 0, frameSize, frameSize);
        context.drawImage(sprite, (frame % columns) * frameSize,
          Math.floor(frame / columns) * frameSize, frameSize, frameSize,
          0, 0, frameSize, frameSize);
        const href = canvas.toDataURL('image/png');
        link.type = 'image/png';
        link.href = href;
        lastFrame = frame;
      } catch {
        finish();
        return;
      }
    }
    request = requestAnimationFrame(tick);
  }

  async function resume() {
    if (disposed || started || pageHidden || motion.matches || document.hidden) return;
    if (!manifest) {
      if (loading) return;
      loading = true;
      try {
        const response = await fetch('/brand/re/favicon-animation.json', { signal: controller.signal });
        if (!response.ok) throw new Error('Favicon unavailable');
        const data = await response.json();
        if (disposed) return;
        const { frameSize, count, columns, durationMs } = data;
        if (!Number.isInteger(frameSize) || frameSize < 16 || frameSize > 128 ||
            !Number.isInteger(count) || count < 2 || count > 240 ||
            !Number.isInteger(columns) || columns < 1 || columns > count ||
            !Number.isFinite(durationMs) || durationMs < 500 || durationMs > 30000) {
          throw new Error('Invalid favicon animation');
        }
        const image = new Image();
        await new Promise((resolve, reject) => {
          image.onload = resolve;
          image.onerror = reject;
          image.src = '/brand/re/favicon-sprite.png';
        });
        if (disposed) return;
        if (image.naturalWidth < columns * frameSize ||
            image.naturalHeight < Math.ceil(count / columns) * frameSize) {
          throw new Error('Incomplete favicon sprite');
        }
        canvas.width = canvas.height = frameSize;
        context = canvas.getContext('2d');
        if (!context) throw new Error('Canvas unavailable');
        sprite = image;
        manifest = data;
      } catch {
        finish();
        return;
      } finally {
        loading = false;
      }
    }
    if (disposed || started || pageHidden || motion.matches || document.hidden) return;
    started = true;
    startedAt = performance.now();
    request = requestAnimationFrame(tick);
  }

  function sync() {
    if (pageHidden || document.hidden || motion.matches) {
      // An interrupted intro is consumed, so tab/preference changes cannot replay it.
      if (started) finish();
      return;
    }
    void resume();
  }

  function onPageHide(event) {
    pageHidden = true;
    if (started || !event.persisted) finish();
  }

  function onPageShow() {
    pageHidden = false;
    sync();
  }

  motion.addEventListener('change', sync);
  document.addEventListener('visibilitychange', sync);
  window.addEventListener('pageshow', onPageShow);
  window.addEventListener('pagehide', onPageHide);
  void resume();
})();
