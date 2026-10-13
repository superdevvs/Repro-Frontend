/** Network byte deltas across concurrent files; server processing adds no bytes. */
export function createUploadTransferTracker(fileSizes: number[], now = Date.now()) {
  const loaded = fileSizes.map(() => 0);
  const phases = fileSizes.map(() => 'queued');
  let bytes = 0;
  let lastTransferAt = now;
  let samples = [{ at: now, bytes: 0 }];
  const snapshot = (at = Date.now()) => {
    samples = samples.filter((sample, index) => sample.at >= at - 4000 || index === samples.length - 1);
    const first = samples[0];
    const elapsed = at - first.at;
    return {
      phase: phases.includes('transferring') ? 'transferring' as const : 'processing' as const,
      bytesPerSecond: elapsed >= 250 ? Math.max(0, (bytes - first.bytes) * 1000 / elapsed) : undefined,
      lastTransferAt,
    };
  };
  return {
    snapshot,
    update(index: number, value: number, total: number, phase: 'transferring' | 'processing', at = Date.now()) {
      phases[index] = phase;
      if (phase === 'transferring') {
        const next = Math.max(0, Math.min(1, value / Math.max(total, fileSizes[index], 1))) * fileSizes[index];
        // A retry can restart this file at zero. Count bytes actually sent again.
        const delta = next >= loaded[index] ? next - loaded[index] : next;
        loaded[index] = next;
        if (delta > 0) { bytes += delta; lastTransferAt = at; }
        samples.push({ at, bytes });
      }
      return snapshot(at);
    },
  };
}

export function formatTransferSpeed(bytesPerSecond: number | undefined): string {
  if (bytesPerSecond === undefined || !Number.isFinite(bytesPerSecond)) return 'Calculating…';
  return bytesPerSecond >= 1024 * 1024
    ? `${(bytesPerSecond / (1024 * 1024)).toFixed(1)} MB/s`
    : `${Math.max(0, bytesPerSecond / 1024).toFixed(1)} KB/s`;
}
