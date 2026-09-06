/** Shares only the generated versions chosen by the user, never source credentials. */
export async function shareOutputs(title: string, outputs: { name: string; url: string }[]): Promise<'shared' | 'copied' | 'cancelled'> {
  if (!outputs.length) throw new Error('There are no generated outputs to share yet.');
  const text = outputs.map(output => `${output.name}\n${output.url}`).join('\n\n');
  const data: ShareData = outputs.length === 1 ? { title, url: outputs[0].url } : { title, text };
  if (navigator.share && (!navigator.canShare || navigator.canShare(data))) {
    try { await navigator.share(data); return 'shared'; }
    catch (reason) { if (reason && typeof reason === 'object' && 'name' in reason && reason.name === 'AbortError') return 'cancelled'; }
  }
  if (!navigator.clipboard?.writeText) throw new Error('Copying is unavailable in this browser. Open a download link and copy its address.');
  await navigator.clipboard.writeText(outputs.length === 1 ? outputs[0].url : text);
  return 'copied';
}
