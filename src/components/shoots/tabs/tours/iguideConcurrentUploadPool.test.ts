import { describe, expect, it, vi } from 'vitest';
import {
  mergeVerifiedIguideSessionProgress,
  runIguideConcurrentUploadPool,
} from './iguideConcurrentUploadPool';
import { IguideResumableUploadError } from './iguideResumableUpload';
import type { IguideUploadSession } from './iguideResumableUploadContract';

const deferred = () => {
  let resolve = () => undefined;
  const promise = new Promise<void>((next) => { resolve = next; });
  return { promise, resolve };
};

const session = (received: number[]): IguideUploadSession => ({
  chunkSizeBytes: 5,
  error: '',
  expiresAt: '2099-01-01T00:00:00Z',
  filename: 'offline.zip',
  id: 'upload-1',
  receivedBytes: received.length * 5,
  receivedChunkIndexes: received,
  receivedChunks: received.map((index) => ({ index, sha256: String(index).repeat(64), sizeBytes: 5 })),
  retryable: false,
  sizeBytes: 20,
  status: 'uploading',
  totalChunks: 4,
});

describe('iGUIDE concurrent upload pool', () => {
  it('keeps three tasks active and refills the pool as each task completes', async () => {
    const gates = Array.from({ length: 5 }, () => deferred());
    const started: number[] = [];
    let active = 0;
    let maxActive = 0;
    const upload = runIguideConcurrentUploadPool({
      concurrency: 3,
      items: [0, 1, 2, 3, 4],
      run: async (item) => {
        started.push(item);
        active += 1;
        maxActive = Math.max(maxActive, active);
        await gates[item].promise;
        active -= 1;
      },
    });

    await vi.waitFor(() => expect(started).toEqual([0, 1, 2]));
    gates[1].resolve();
    await vi.waitFor(() => expect(started).toEqual([0, 1, 2, 3]));
    gates[0].resolve();
    await vi.waitFor(() => expect(started).toEqual([0, 1, 2, 3, 4]));
    gates[2].resolve();
    gates[3].resolve();
    gates[4].resolve();
    await upload;

    expect(maxActive).toBe(3);
  });

  it('aborts sibling tasks and preserves the first failure', async () => {
    const fail = deferred();
    const original = new Error('chunk failed');
    const aborted: number[] = [];
    const upload = runIguideConcurrentUploadPool({
      concurrency: 3,
      items: [0, 1, 2],
      run: async (item, signal) => {
        if (item === 0) {
          await fail.promise;
          throw original;
        }
        await new Promise<void>((_resolve, reject) => signal.addEventListener('abort', () => {
          aborted.push(item);
          reject(new Error('sibling aborted'));
        }, { once: true }));
      },
    });

    fail.resolve();
    await expect(upload).rejects.toBe(original);
    expect(aborted.sort()).toEqual([1, 2]);
  });

  it('merges a stale verified response without dropping newer progress', () => {
    const merged = mergeVerifiedIguideSessionProgress(20, session([0, 1]), session([0]));
    expect(merged.receivedChunkIndexes).toEqual([0, 1]);
    expect(merged.receivedBytes).toBe(10);
  });

  it('fails closed if a response changes a previously verified chunk', () => {
    const changed = session([0]);
    changed.receivedChunks[0].sha256 = 'f'.repeat(64);

    expect(() => mergeVerifiedIguideSessionProgress(20, session([0]), changed))
      .toThrow(IguideResumableUploadError);
  });
});
