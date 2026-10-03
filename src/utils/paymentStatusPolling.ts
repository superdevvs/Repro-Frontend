/** Keep one confirmation in flight and ignore results after checkout closes. */
export function startPaymentStatusPolling(
  poll: (isActive: () => boolean) => Promise<void>,
  delayMs = 3000,
): () => void {
  let active = true;
  let timer: ReturnType<typeof setTimeout>;
  const run = async () => {
    try {
      await poll(() => active);
    } catch {
      // A temporary status failure must not stop subsequent confirmation.
    } finally {
      if (active) timer = setTimeout(() => void run(), delayMs);
    }
  };
  timer = setTimeout(() => void run(), delayMs);
  return () => { active = false; clearTimeout(timer); };
}
