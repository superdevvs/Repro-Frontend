import { describe, expect, it, vi } from 'vitest';
import { createMediaOrderSaveDeduplicator, createMediaOrderSaveQueue, enqueueShootMediaOrderSave } from './mediaOrderSaveQueue';

describe('media order saves', () => {
  it('finishes an earlier write before starting the latest arrangement', async () => {
    const enqueue = createMediaOrderSaveQueue();
    let finish!: () => void;
    const first = enqueue(() => new Promise<void>(resolve => { finish = resolve; }));
    const writeLatest = vi.fn().mockResolvedValue('latest');
    const latest = enqueue(writeLatest);
    await Promise.resolve();
    expect(writeLatest).not.toHaveBeenCalled();
    finish(); await first;
    expect(await latest).toBe('latest');
    expect(writeLatest).toHaveBeenCalledTimes(1);
  });
  it('allows retry after a failed request', async () => {
    const enqueue = createMediaOrderSaveQueue();
    await expect(enqueue(() => Promise.reject(new Error('offline')))).rejects.toThrow('offline');
    await expect(enqueue(() => Promise.resolve('saved'))).resolves.toBe('saved');
  });
});

it('serializes a closing pane and a reopened pane for the same shoot', async () => {
  let finish!: () => void;
  const closedPane = enqueueShootMediaOrderSave(5933, () => new Promise<void>(resolve => { finish = resolve; }));
  const saveReopenedPane = vi.fn().mockResolvedValue('new order');
  const reopenedPane = enqueueShootMediaOrderSave('5933', saveReopenedPane);
  await Promise.resolve();
  expect(saveReopenedPane).not.toHaveBeenCalled();
  finish();
  await closedPane;
  expect(await reopenedPane).toBe('new order');
  expect(saveReopenedPane).toHaveBeenCalledOnce();
});

it('does not block a different shoot and recovers after a closing pane save fails', async () => {
  const failed = enqueueShootMediaOrderSave(5933, () => Promise.reject(new Error('offline')));
  const retry = enqueueShootMediaOrderSave(5933, () => Promise.resolve('saved'));
  const otherShoot = enqueueShootMediaOrderSave(5934, () => Promise.resolve('independent'));
  await expect(failed).rejects.toThrow('offline');
  await expect(otherShoot).resolves.toBe('independent');
  await expect(retry).resolves.toBe('saved');
});

it('shares an identical in-flight save with a closing pane without swallowing a later changed arrangement', async () => {
  const save = createMediaOrderSaveDeduplicator<string>();
  let finish!: (value: string) => void;
  const first = save('1,2,3', () => new Promise<string>(resolve => { finish = resolve; }));
  const duplicate = vi.fn().mockResolvedValue('duplicate');
  expect(save('1,2,3', duplicate)).toBe(first);
  expect(duplicate).not.toHaveBeenCalled();
  const changed = vi.fn().mockResolvedValue('changed');
  await expect(save('3,2,1', changed)).resolves.toBe('changed');
  const reverted = vi.fn().mockResolvedValue('reverted');
  await expect(save('1,2,3', reverted)).resolves.toBe('reverted');
  expect(reverted).toHaveBeenCalledOnce();
  finish('first');
  await first;
});
