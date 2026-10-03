export type ImageRequest = { key: string; url: string; original: boolean; bytes: number; current: boolean };
export type BufferedImage = ImageRequest & { state: 'queued' | 'loading' | 'ready' | 'error'; image?: HTMLImageElement };

/** Viewer-local decoded cache. No shared credentials, blob URLs, or unbounded album downloads. */
export class ViewerImageBuffer {
  entries = new Map<string, BufferedImage>();
  failed = new Set<string>();
  sizes = new Map<string, number>();
  private order: string[] = [];
  constructor(private changed: () => void, private originalBudget: number) {}

  configure(requests: ImageRequest[]) {
    let originals = 0;
    let originalBytes = 0;
    let previews = 0;
    const accepted = requests.filter((request) => {
      if (!request.url) return false;
      if (!request.original) return ++previews <= 6;
      if (!request.current && (originals >= 3 || originalBytes + request.bytes > this.originalBudget)) return false;
      originals++;
      originalBytes += request.bytes;
      return true;
    });
    const keys = new Set(accepted.map((request) => request.key));
    for (const [key, entry] of this.entries) {
      if (!keys.has(key) || accepted.find((r) => r.key === key)?.url !== entry.url) {
        this.release(entry);
        this.entries.delete(key);
      }
    }
    this.order = accepted.map((r) => r.key);
    for (const request of accepted) {
      const previous = this.entries.get(request.key);
      if (previous) Object.assign(previous, request);
      else this.entries.set(request.key, { ...request, state: this.failed.has(request.key) ? 'error' : 'queued' });
    }
    this.pump();
  }

  private pump() {
    // Two downloads total keeps previews/originals from flooding the page's connection.
    let active = [...this.entries.values()].filter((e) => e.state === 'loading').length;
    for (const key of this.order) {
      const entry = this.entries.get(key);
      if (!entry || entry.state !== 'queued' || active >= 2) continue;
      active++;
      entry.state = 'loading';
      const image = new Image();
      entry.image = image;
      image.decoding = 'async';
      image.fetchPriority = entry.current ? 'high' : 'low';
      const settle = (state: 'ready' | 'error') => {
        if (this.entries.get(key) !== entry || entry.state !== 'loading') return;
        entry.state = state;
        if (state === 'ready') { entry.bytes = image.naturalWidth * image.naturalHeight * 4; this.sizes.set(key, entry.bytes); }
        else this.failed.add(key);
        image.onload = null;
        image.onerror = null;
        this.enforceBudget();
        this.changed();
        this.pump();
      };
      image.onload = () => {
        if (image.decode) void image.decode().then(() => settle('ready'), () => settle('error'));
        else settle(image.naturalWidth > 0 ? 'ready' : 'error');
      };
      image.onerror = () => settle('error');
      image.src = entry.url;
    }
  }

  private enforceBudget() {
    let bytes = [...this.entries.values()].filter((e) => e.original).reduce((sum, e) => sum + e.bytes, 0);
    for (const key of [...this.order].reverse()) {
      const entry = this.entries.get(key);
      if (bytes <= this.originalBudget) break;
      if (!entry?.original || entry.current) continue;
      bytes -= entry.bytes;
      this.release(entry);
      this.entries.delete(key);
    }
  }

  fail(key: string) {
    const entry = this.entries.get(key);
    if (entry) { this.failed.add(key); this.release(entry); entry.state = 'error'; this.changed(); this.pump(); }
  }

  private release(entry: BufferedImage) {
    if (!entry.image) return;
    entry.image.onload = null;
    entry.image.onerror = null;
    if (entry.state === 'loading') entry.image.removeAttribute('src');
    entry.image = undefined;
  }

  dispose() {
    this.entries.forEach((entry) => this.release(entry));
    this.entries.clear();
    this.order = [];
    this.failed.clear();
    this.sizes.clear();
  }
}
