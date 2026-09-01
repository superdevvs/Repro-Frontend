import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createIguideUploadIdempotencyKey,
  discardIguideUploadSession,
  getPersistedIguideUpload,
  IGUIDE_RESUMABLE_CHUNK_BYTES,
  IguideResumableUploadError,
  IguideUploadPausedError,
  uploadIguideOfflinePackageResumable,
} from './iguideResumableUpload';

type XhrHandler = (xhr: MockChunkXMLHttpRequest) => void;

class MockChunkXMLHttpRequest {
  static handler: XhrHandler = () => undefined;
  static instances: MockChunkXMLHttpRequest[] = [];

  headers: Record<string, string> = {};
  listeners: Record<string, (event?: unknown) => void> = {};
  method = '';
  responseText = '';
  sentBody: Blob | null = null;
  status = 0;
  timeout = 0;
  uploadListeners: Record<string, (event: { lengthComputable: boolean; loaded: number; total: number }) => void> = {};
  url = '';
  upload = {
    addEventListener: (event: string, listener: (event: { lengthComputable: boolean; loaded: number; total: number }) => void) => {
      this.uploadListeners[event] = listener;
    },
  };

  constructor() {
    MockChunkXMLHttpRequest.instances.push(this);
  }

  abort() {
    this.listeners.abort?.();
  }

  addEventListener(event: string, listener: (event?: unknown) => void) {
    this.listeners[event] = listener;
  }

  getResponseHeader() {
    return null;
  }

  open(method: string, url: string) {
    this.method = method;
    this.url = url;
  }

  send(body: Blob) {
    this.sentBody = body;
    MockChunkXMLHttpRequest.handler(this);
  }

  setRequestHeader(name: string, value: string) {
    this.headers[name] = value;
  }

  succeed(payload: unknown, status = 201) {
    this.status = status;
    this.responseText = JSON.stringify(payload);
    const range = this.headers['Content-Range']?.match(/bytes (\d+)-(\d+)\//);
    const total = range ? Number(range[2]) - Number(range[1]) + 1 : this.sentBody?.size ?? 0;
    this.uploadListeners.progress?.({ lengthComputable: true, loaded: total, total });
    this.listeners.load?.();
  }

  failNetwork() {
    this.listeners.error?.();
  }

  failHttp(status: number, payload: unknown) {
    this.status = status;
    this.responseText = JSON.stringify(payload);
    this.listeners.load?.();
  }
}

const response = (payload: unknown, status = 200) => new Response(JSON.stringify(payload), {
  status,
  headers: { 'content-type': 'application/json' },
});

const uploadPayload = ({
  filename = 'offline.zip',
  hash = '0'.repeat(64),
  id = 'upload-1',
  received = [],
  size,
  status = 'uploading',
}: {
  filename?: string;
  hash?: string;
  id?: string;
  received?: number[];
  size: number;
  status?: string;
}) => ({
  upload: {
    id,
    status,
    filename,
    size_bytes: size,
    chunk_size_bytes: IGUIDE_RESUMABLE_CHUNK_BYTES,
    total_chunks: Math.ceil(size / IGUIDE_RESUMABLE_CHUNK_BYTES),
    received_bytes: received.reduce((total, index) => {
      const start = index * IGUIDE_RESUMABLE_CHUNK_BYTES;
      return total + Math.max(0, Math.min(size, start + IGUIDE_RESUMABLE_CHUNK_BYTES) - start);
    }, 0),
    received_chunk_indexes: received,
    received_chunks: received.map((index) => {
      const start = index * IGUIDE_RESUMABLE_CHUNK_BYTES;
      return {
        index,
        size_bytes: Math.max(0, Math.min(size, start + IGUIDE_RESUMABLE_CHUNK_BYTES) - start),
        sha256: hash,
      };
    }),
    expires_at: '2099-01-01T00:00:00Z',
    error: null,
    retryable: false,
  },
});

const completedPayload = (size: number) => ({
  ...uploadPayload({
    size,
    status: 'completed',
    received: Array.from({ length: Math.ceil(size / IGUIDE_RESUMABLE_CHUNK_BYTES) }, (_, index) => index),
  }),
  manual_offline_package: {
    id: 'package-1',
    status: 'queued',
    original_filename: 'offline.zip',
    size_bytes: size,
  },
});

const virtualFile = (size: number, name = 'offline.zip', fillByte = 0, lastModified = 1_777) => ({
  name,
  size,
  type: 'application/zip',
  lastModified,
  slice: (start?: number, end?: number) => {
    const requested = Math.max(0, Number(end ?? size) - Number(start ?? 0));
    return new Blob([new Uint8Array(Math.min(requested, 8)).fill(fillByte)], { type: 'application/octet-stream' });
  },
}) as File;

const useContentAwareDigest = () => {
  vi.stubGlobal('crypto', {
    randomUUID: vi.fn(() => '11111111-1111-4111-8111-111111111111'),
    subtle: {
      digest: vi.fn(async (_algorithm: AlgorithmIdentifier, data: BufferSource) => {
        const view = data instanceof ArrayBuffer
          ? new Uint8Array(data)
          : new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
        return new Uint8Array(32).fill(view[0] ?? 0).buffer;
      }),
    },
  });
};

beforeEach(() => {
  MockChunkXMLHttpRequest.instances = [];
  MockChunkXMLHttpRequest.handler = () => undefined;
  vi.stubGlobal('XMLHttpRequest', MockChunkXMLHttpRequest);
  vi.stubGlobal('crypto', {
    randomUUID: vi.fn(() => '11111111-1111-4111-8111-111111111111'),
    subtle: {
      digest: vi.fn(async () => new Uint8Array(32).buffer),
    },
  });
  window.localStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  window.localStorage.clear();
});

describe('resumable iGUIDE upload', () => {
  it('uploads the 144,018,253-byte sample shape in 28 exact 5 MiB ranges with authenticated headers', async () => {
    const size = 144_018_253;
    const file = virtualFile(size);
    window.localStorage.setItem('authToken', 'token-123');
    window.localStorage.setItem('originalUser', JSON.stringify({ id: 1 }));
    window.localStorage.setItem('user', JSON.stringify({ id: 9 }));
    const progress: number[] = [];
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (init?.method === 'POST' && url.endsWith('/uploads')) {
        return response(uploadPayload({ size }), 201);
      }
      if (init?.method === 'POST' && url.endsWith('/complete')) {
        return response(completedPayload(size), 202);
      }
      if (init?.method === 'GET') {
        return response(uploadPayload({
          size,
          received: Array.from({ length: Math.ceil(size / IGUIDE_RESUMABLE_CHUNK_BYTES) }, (_, index) => index),
        }));
      }
      throw new Error(`Unexpected request: ${init?.method} ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    MockChunkXMLHttpRequest.handler = (xhr) => {
      const index = Number(xhr.url.match(/chunks\/(\d+)$/)?.[1]);
      xhr.succeed(uploadPayload({
        size,
        received: Array.from({ length: index + 1 }, (_, receivedIndex) => receivedIndex),
      }));
    };

    const result = await uploadIguideOfflinePackageResumable({
      file,
      shootId: 9137,
      retryDelaysMs: [0, 0, 0],
      pollIntervalMs: 0,
      onProgress: (value) => progress.push(value.percent),
    });

    expect(MockChunkXMLHttpRequest.instances).toHaveLength(28);
    expect(MockChunkXMLHttpRequest.instances[0].headers['Content-Range'])
      .toBe('bytes 0-5242879/144018253');
    expect(MockChunkXMLHttpRequest.instances[27].headers['Content-Range'])
      .toBe('bytes 141557760-144018252/144018253');
    expect(MockChunkXMLHttpRequest.instances[27].headers['X-Chunk-SHA256']).toHaveLength(64);
    expect(MockChunkXMLHttpRequest.instances[0].headers.Authorization).toBe('Bearer token-123');
    expect(MockChunkXMLHttpRequest.instances[0].headers['X-Impersonate-User-Id']).toBe('9');
    const createHeaders = fetchMock.mock.calls[0][1]?.headers as Record<string, string>;
    expect(createHeaders['Idempotency-Key']).toBe('11111111-1111-4111-8111-111111111111');
    expect(createHeaders.Authorization).toBe('Bearer token-123');
    expect(createHeaders['X-Impersonate-User-Id']).toBe('9');
    expect(progress.at(-1)).toBe(100);
    expect(progress.every((value, index) => index === 0 || value >= progress[index - 1])).toBe(true);
    expect(result.status).toBe('queued');
  });

  it('keeps three chunk XHRs in flight and confirms server state before finalizing', async () => {
    const size = (IGUIDE_RESUMABLE_CHUNK_BYTES * 3) + 1;
    const file = virtualFile(size);
    const events: string[] = [];
    const pending = new Map<number, MockChunkXMLHttpRequest>();
    const progress: number[] = [];
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (init?.method === 'POST' && url.endsWith('/uploads')) {
        events.push('create');
        return response(uploadPayload({ size }), 201);
      }
      if (init?.method === 'GET') {
        events.push('authoritative-status');
        return response(uploadPayload({ size, received: [0, 1, 2, 3] }));
      }
      if (init?.method === 'POST' && url.endsWith('/complete')) {
        events.push('complete');
        return response(completedPayload(size), 202);
      }
      throw new Error(`Unexpected request: ${init?.method} ${url}`);
    }));
    MockChunkXMLHttpRequest.handler = (xhr) => {
      const index = Number(xhr.url.match(/chunks\/(\d+)$/)?.[1]);
      events.push(`put-${index}`);
      pending.set(index, xhr);
    };

    const upload = uploadIguideOfflinePackageResumable({
      file,
      shootId: 9138,
      retryDelaysMs: [0, 0, 0],
      pollIntervalMs: 0,
      onProgress: (value) => progress.push(value.percent),
    });
    await vi.waitFor(() => expect(MockChunkXMLHttpRequest.instances).toHaveLength(3));
    expect(Array.from(pending.keys()).sort()).toEqual([0, 1, 2]);
    expect(MockChunkXMLHttpRequest.instances.every((xhr) => xhr.timeout > 120_000)).toBe(true);

    pending.get(2)?.succeed(uploadPayload({ size, received: [2] }));
    await vi.waitFor(() => expect(MockChunkXMLHttpRequest.instances).toHaveLength(4));
    pending.get(3)?.succeed(uploadPayload({ size, received: [2, 3] }));
    pending.get(1)?.succeed(uploadPayload({ size, received: [1] }));
    pending.get(0)?.succeed(uploadPayload({ size, received: [0] }));
    await upload;

    expect(events.indexOf('authoritative-status')).toBeGreaterThan(events.indexOf('put-3'));
    expect(events.indexOf('complete')).toBeGreaterThan(events.indexOf('authoritative-status'));
    expect(progress.every((value, index) => index === 0 || value >= progress[index - 1])).toBe(true);
    expect(progress.at(-1)).toBe(100);
  });

  it('falls back to an RFC 4122 UUID when randomUUID is unavailable', () => {
    vi.stubGlobal('crypto', {
      getRandomValues: vi.fn((bytes: Uint8Array) => {
        bytes.fill(0x11);
        return bytes;
      }),
    });
    const idempotencyKey = createIguideUploadIdempotencyKey();

    expect(idempotencyKey).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });

  it('pauses without deleting the session and resumes by skipping server-confirmed chunks', async () => {
    const size = IGUIDE_RESUMABLE_CHUNK_BYTES + 1;
    const file = virtualFile(size);
    const firstController = new AbortController();
    let statusReads = 0;
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (init?.method === 'POST' && url.endsWith('/uploads')) return response(uploadPayload({ size }), 201);
      if (init?.method === 'GET') {
        statusReads += 1;
        return response(uploadPayload({ size, received: [0, 1] }));
      }
      if (init?.method === 'POST' && url.endsWith('/complete')) return response(completedPayload(size), 202);
      throw new Error(`Unexpected request: ${init?.method} ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);
    MockChunkXMLHttpRequest.handler = (xhr) => {
      const index = Number(xhr.url.match(/chunks\/(\d+)$/)?.[1]);
      xhr.succeed(uploadPayload({ size, received: [index] }));
    };

    await expect(uploadIguideOfflinePackageResumable({
      file,
      shootId: 22,
      signal: firstController.signal,
      retryDelaysMs: [0, 0, 0],
      onProgress: (value) => {
        if (value.bytesConfirmed >= IGUIDE_RESUMABLE_CHUNK_BYTES) firstController.abort();
      },
    })).rejects.toBeInstanceOf(IguideUploadPausedError);
    expect(getPersistedIguideUpload(22, file)?.receivedChunkIndexes).toEqual([0, 1]);

    MockChunkXMLHttpRequest.instances = [];
    MockChunkXMLHttpRequest.handler = (xhr) => xhr.succeed(uploadPayload({ size, received: [0, 1] }));
    await uploadIguideOfflinePackageResumable({
      file,
      shootId: 22,
      retryDelaysMs: [0, 0, 0],
      pollIntervalMs: 0,
    });

    expect(MockChunkXMLHttpRequest.instances).toHaveLength(0);
    expect(getPersistedIguideUpload(22, file)).toBeNull();
  });

  it('checks the server before trusting a locally expired timestamp from a fast workstation clock', async () => {
    const size = IGUIDE_RESUMABLE_CHUNK_BYTES + 1;
    const file = virtualFile(size);
    const firstController = new AbortController();
    let initRequests = 0;
    let statusReads = 0;
    const activeSession = (received: number[] = []) => {
      const payload = uploadPayload({ size, received });
      payload.upload.expires_at = '2000-01-01T00:00:00Z';
      return payload;
    };
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (init?.method === 'POST' && url.endsWith('/uploads')) {
        initRequests += 1;
        return response(activeSession(), 201);
      }
      if (init?.method === 'GET') {
        statusReads += 1;
        return response(activeSession(statusReads === 1 ? [0] : [0, 1]));
      }
      if (init?.method === 'POST' && url.endsWith('/complete')) return response(completedPayload(size), 202);
      throw new Error(`Unexpected request: ${init?.method} ${url}`);
    }));
    MockChunkXMLHttpRequest.handler = (xhr) => {
      const index = Number(xhr.url.match(/chunks\/(\d+)$/)?.[1]);
      xhr.succeed(activeSession([index]));
    };

    await expect(uploadIguideOfflinePackageResumable({
      file,
      shootId: 23,
      signal: firstController.signal,
      retryDelaysMs: [0, 0, 0],
      onProgress: (value) => {
        if (value.bytesConfirmed >= IGUIDE_RESUMABLE_CHUNK_BYTES) firstController.abort();
      },
    })).rejects.toBeInstanceOf(IguideUploadPausedError);

    MockChunkXMLHttpRequest.instances = [];
    MockChunkXMLHttpRequest.handler = (xhr) => xhr.succeed(activeSession([0, 1]));
    await uploadIguideOfflinePackageResumable({
      file,
      shootId: 23,
      retryDelaysMs: [0, 0, 0],
      pollIntervalMs: 0,
    });

    expect(initRequests).toBe(1);
    expect(statusReads).toBe(2);
    expect(MockChunkXMLHttpRequest.instances).toHaveLength(1);
    expect(MockChunkXMLHttpRequest.instances[0].url).toMatch(/chunks\/1$/);
  });

  it('reconciles an uncertain chunk write before deciding whether to retry it', async () => {
    const size = 1_024;
    const file = virtualFile(size);
    let statusReads = 0;
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (init?.method === 'POST' && url.endsWith('/uploads')) return response(uploadPayload({ size }), 201);
      if (init?.method === 'GET') {
        statusReads += 1;
        return response(uploadPayload({ size, received: [0] }));
      }
      if (init?.method === 'POST' && url.endsWith('/complete')) return response(completedPayload(size), 202);
      throw new Error(`Unexpected request: ${init?.method} ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);
    MockChunkXMLHttpRequest.handler = (xhr) => xhr.failNetwork();

    await uploadIguideOfflinePackageResumable({
      file,
      shootId: 4,
      retryDelaysMs: [0, 0, 0],
      pollIntervalMs: 0,
    });

    expect(MockChunkXMLHttpRequest.instances).toHaveLength(1);
    expect(statusReads).toBe(2);
  });

  it.each([
    ['hash', 'f'.repeat(64), 1_024],
    ['size', '0'.repeat(64), 1_023],
  ])('fails closed when uncertain chunk reconciliation reports a different %s', async (
    _mismatch,
    sha256,
    sizeBytes,
  ) => {
    const size = 1_024;
    const file = virtualFile(size);
    let statusReads = 0;
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (init?.method === 'POST' && url.endsWith('/uploads')) return response(uploadPayload({ size }), 201);
      if (init?.method === 'GET') {
        statusReads += 1;
        const payload = uploadPayload({ size, received: [0] });
        payload.upload.received_chunks[0] = { index: 0, sha256, size_bytes: sizeBytes };
        return response(payload);
      }
      throw new Error(`Unexpected request: ${init?.method} ${url}`);
    }));
    MockChunkXMLHttpRequest.handler = (xhr) => xhr.failNetwork();

    await expect(uploadIguideOfflinePackageResumable({
      file,
      shootId: 44,
      retryDelaysMs: [0, 0, 0],
    })).rejects.toMatchObject({
      errorType: 'resume_integrity_conflict',
      sessionId: 'upload-1',
      status: 409,
    });

    expect(MockChunkXMLHttpRequest.instances).toHaveLength(1);
    expect(statusReads).toBe(1);
  });

  it('rejects a reconciled session that matches the attempted chunk but adds different later data', async () => {
    const size = IGUIDE_RESUMABLE_CHUNK_BYTES + 1;
    const file = virtualFile(size);
    let completeRequests = 0;
    let statusReads = 0;
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (init?.method === 'POST' && url.endsWith('/uploads')) return response(uploadPayload({ size }), 201);
      if (init?.method === 'GET') {
        statusReads += 1;
        const payload = uploadPayload({ size, received: [0, 1] });
        payload.upload.received_chunks[1].sha256 = 'f'.repeat(64);
        return response(payload);
      }
      if (init?.method === 'POST' && url.endsWith('/complete')) completeRequests += 1;
      throw new Error(`Unexpected request: ${init?.method} ${url}`);
    }));
    MockChunkXMLHttpRequest.handler = (xhr) => xhr.failNetwork();

    await expect(uploadIguideOfflinePackageResumable({
      file,
      shootId: 45,
      retryDelaysMs: [0, 0, 0],
    })).rejects.toMatchObject({
      errorType: 'resume_integrity_conflict',
      sessionId: 'upload-1',
      status: 409,
    });

    expect(MockChunkXMLHttpRequest.instances).toHaveLength(2);
    expect(statusReads).toBe(2);
    expect(completeRequests).toBe(0);
  });

  it('rejects a successful chunk response that adds different concurrent data', async () => {
    const size = IGUIDE_RESUMABLE_CHUNK_BYTES + 1;
    const file = virtualFile(size);
    let completeRequests = 0;
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (init?.method === 'POST' && url.endsWith('/uploads')) return response(uploadPayload({ size }), 201);
      if (init?.method === 'POST' && url.endsWith('/complete')) completeRequests += 1;
      throw new Error(`Unexpected request: ${init?.method} ${url}`);
    }));
    MockChunkXMLHttpRequest.handler = (xhr) => {
      const payload = uploadPayload({ size, received: [0, 1] });
      payload.upload.received_chunks[1].sha256 = 'f'.repeat(64);
      xhr.succeed(payload);
    };

    await expect(uploadIguideOfflinePackageResumable({
      file,
      shootId: 46,
      retryDelaysMs: [0, 0, 0],
    })).rejects.toMatchObject({
      errorType: 'resume_integrity_conflict',
      sessionId: 'upload-1',
      status: 409,
    });

    expect(MockChunkXMLHttpRequest.instances).toHaveLength(2);
    expect(completeRequests).toBe(0);
  });

  it('recovers a matching active upload after local storage is lost and skips verified chunks', async () => {
    const size = IGUIDE_RESUMABLE_CHUNK_BYTES + 1;
    const file = virtualFile(size);
    const canonicalSession = '22222222-2222-4222-8222-222222222222';
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (init?.method === 'POST' && url.endsWith('/uploads')) {
        return response({
          ...uploadPayload({ id: canonicalSession, size, received: [0] }),
          error_type: 'upload_in_progress',
          message: 'Another iGUIDE package upload is already in progress for this shoot.',
        }, 409);
      }
      if (init?.method === 'POST' && url.endsWith('/complete')) return response(completedPayload(size), 202);
      if (init?.method === 'GET') return response(uploadPayload({
        id: canonicalSession,
        size,
        received: [0, 1],
      }));
      throw new Error(`Unexpected request: ${init?.method} ${url}`);
    }));
    MockChunkXMLHttpRequest.handler = (xhr) => xhr.succeed(uploadPayload({
      id: canonicalSession,
      size,
      received: [0, 1],
    }));

    await uploadIguideOfflinePackageResumable({
      file,
      shootId: 41,
      retryDelaysMs: [0, 0, 0],
      pollIntervalMs: 0,
    });

    expect(MockChunkXMLHttpRequest.instances).toHaveLength(1);
    expect(MockChunkXMLHttpRequest.instances[0].url).toMatch(new RegExp(`${canonicalSession}/chunks/1$`));
  });

  it('does not splice an active upload when the same file metadata has different bytes', async () => {
    useContentAwareDigest();
    const size = IGUIDE_RESUMABLE_CHUNK_BYTES + 1;
    const file = virtualFile(size, 'offline.zip', 1);
    const canonicalSession = '22222222-2222-4222-8222-222222222223';
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (init?.method === 'POST' && url.endsWith('/uploads')) {
        return response({
          ...uploadPayload({ id: canonicalSession, size, received: [0] }),
          error_type: 'upload_in_progress',
          message: 'Another iGUIDE package upload is already in progress for this shoot.',
        }, 409);
      }
      throw new Error(`Unexpected request: ${init?.method} ${url}`);
    }));

    await expect(uploadIguideOfflinePackageResumable({
      file,
      shootId: 411,
      retryDelaysMs: [0, 0, 0],
    })).rejects.toMatchObject({
      message: expect.stringContaining('different file data'),
      sessionId: canonicalSession,
      status: 409,
    });
    expect(MockChunkXMLHttpRequest.instances).toHaveLength(0);
  });

  it('does not adopt a processing conflict after its chunk manifest has been removed', async () => {
    const size = IGUIDE_RESUMABLE_CHUNK_BYTES + 1;
    const file = virtualFile(size);
    const canonicalSession = '22222222-2222-4222-8222-222222222224';
    const payload = uploadPayload({
      id: canonicalSession,
      size,
      received: [0, 1],
      status: 'scanning',
    });
    payload.upload.received_chunks = [];
    vi.stubGlobal('fetch', vi.fn(async () => response({
      ...payload,
      error_type: 'upload_in_progress',
      message: 'Another iGUIDE package upload is already in progress for this shoot.',
    }, 409)));

    await expect(uploadIguideOfflinePackageResumable({
      file,
      shootId: 414,
      retryDelaysMs: [0, 0, 0],
    })).rejects.toMatchObject({
      message: expect.stringContaining('cannot be safely matched'),
      sessionId: canonicalSession,
      status: 409,
    });
    expect(MockChunkXMLHttpRequest.instances).toHaveLength(0);
  });

  it('re-hashes confirmed chunks before resuming a same-name, size, and timestamp file', async () => {
    useContentAwareDigest();
    const size = IGUIDE_RESUMABLE_CHUNK_BYTES + 1;
    const original = virtualFile(size, 'offline.zip', 0, 1_777);
    const changed = virtualFile(size, 'offline.zip', 1, 1_777);
    const controller = new AbortController();
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (init?.method === 'POST' && url.endsWith('/uploads')) return response(uploadPayload({ size }), 201);
      if (init?.method === 'GET') return response(uploadPayload({ size, received: [0] }));
      throw new Error(`Unexpected request: ${init?.method} ${url}`);
    }));
    MockChunkXMLHttpRequest.handler = (xhr) => xhr.succeed(uploadPayload({ size, received: [0] }));

    await expect(uploadIguideOfflinePackageResumable({
      file: original,
      shootId: 412,
      signal: controller.signal,
      retryDelaysMs: [0, 0, 0],
      onProgress: (value) => {
        if (value.bytesConfirmed >= IGUIDE_RESUMABLE_CHUNK_BYTES) controller.abort();
      },
    })).rejects.toBeInstanceOf(IguideUploadPausedError);

    MockChunkXMLHttpRequest.instances = [];
    await expect(uploadIguideOfflinePackageResumable({
      file: changed,
      shootId: 412,
      retryDelaysMs: [0, 0, 0],
    })).rejects.toMatchObject({
      message: expect.stringContaining('different file data'),
      sessionId: 'upload-1',
      status: 409,
    });
    expect(MockChunkXMLHttpRequest.instances).toHaveLength(0);
  });

  it('rejects a successful session response for a same-size file with a different name', async () => {
    const size = 1_024;
    const file = virtualFile(size, 'different-offline.zip');
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (init?.method === 'POST' && url.endsWith('/uploads')) {
        return response(uploadPayload({ id: '33333333-3333-4333-8333-333333333333', size }), 201);
      }
      throw new Error(`Unexpected request: ${init?.method} ${url}`);
    }));

    await expect(uploadIguideOfflinePackageResumable({
      file,
      shootId: 42,
      retryDelaysMs: [0, 0, 0],
    })).rejects.toThrow('belongs to a different file');
    expect(MockChunkXMLHttpRequest.instances).toHaveLength(0);
  });

  it('exposes and explicitly discards a conflicting server session without local metadata', async () => {
    const size = 1_024;
    const file = virtualFile(size, 'different-offline.zip');
    const canonicalSession = '33333333-3333-4333-8333-333333333334';
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (init?.method === 'POST' && url.endsWith('/uploads')) {
        return response({
          ...uploadPayload({ id: canonicalSession, size }),
          error_type: 'upload_in_progress',
          message: 'Another upload is active.',
        }, 409);
      }
      if (init?.method === 'DELETE' && url.endsWith(`/uploads/${canonicalSession}`)) {
        return new Response(null, { status: 204 });
      }
      throw new Error(`Unexpected request: ${init?.method} ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    let conflict: IguideResumableUploadError | null = null;
    try {
      await uploadIguideOfflinePackageResumable({
        file,
        shootId: 413,
        retryDelaysMs: [0, 0, 0],
      });
    } catch (error) {
      conflict = error as IguideResumableUploadError;
    }
    expect(conflict).toMatchObject({ sessionId: canonicalSession, status: 409 });

    await discardIguideUploadSession({
      file,
      shootId: 413,
      sessionId: conflict?.sessionId,
    });
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringMatching(new RegExp(`uploads/${canonicalSession}$`)),
      expect.objectContaining({ method: 'DELETE' }),
    );
  });

  it('retries a missing chunk but does not retry a non-retryable validation error', async () => {
    const size = 1_024;
    const file = virtualFile(size);
    let statusReads = 0;
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (init?.method === 'POST' && url.endsWith('/uploads')) return response(uploadPayload({ size }), 201);
      if (init?.method === 'GET') {
        statusReads += 1;
        return response(uploadPayload({ size, received: statusReads === 1 ? [] : [0] }));
      }
      if (init?.method === 'POST' && url.endsWith('/complete')) return response(completedPayload(size), 202);
      throw new Error(`Unexpected request: ${init?.method} ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);
    let attempts = 0;
    MockChunkXMLHttpRequest.handler = (xhr) => {
      attempts += 1;
      if (attempts === 1) xhr.failNetwork();
      else xhr.succeed(uploadPayload({ size, received: [0] }));
    };
    await uploadIguideOfflinePackageResumable({
      file,
      shootId: 5,
      retryDelaysMs: [0, 0, 0],
      pollIntervalMs: 0,
    });
    expect(attempts).toBe(2);
    expect(statusReads).toBe(2);

    window.localStorage.clear();
    MockChunkXMLHttpRequest.instances = [];
    MockChunkXMLHttpRequest.handler = (xhr) => xhr.failHttp(422, { message: 'Chunk checksum mismatch.' });
    await expect(uploadIguideOfflinePackageResumable({
      file,
      shootId: 6,
      retryDelaysMs: [0, 0, 0],
    })).rejects.toMatchObject({
      message: 'Chunk checksum mismatch.',
      retryable: false,
      status: 422,
    });
    expect(MockChunkXMLHttpRequest.instances).toHaveLength(1);
  });

  it('treats an expired server session as terminal instead of polling it', async () => {
    const size = 1_024;
    const file = virtualFile(size);
    const expired = uploadPayload({ size, status: 'expired' });
    expired.upload.error = 'The resumable upload expired before it was completed.';
    vi.stubGlobal('fetch', vi.fn(async () => response(expired, 201)));

    await expect(uploadIguideOfflinePackageResumable({
      file,
      shootId: 61,
      retryDelaysMs: [0, 0, 0],
      pollIntervalMs: 0,
      maxPolls: 1,
    })).rejects.toMatchObject({
      message: 'The resumable upload expired before it was completed.',
      retryable: false,
    });
    expect(MockChunkXMLHttpRequest.instances).toHaveLength(0);
  });

  it('polls a finalizing session until completion and then returns the package lifecycle', async () => {
    const size = 1_024;
    const file = virtualFile(size);
    let statusReads = 0;
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (init?.method === 'POST' && url.endsWith('/uploads')) return response(uploadPayload({ size }), 201);
      if (init?.method === 'POST' && url.endsWith('/complete')) {
        return response(uploadPayload({ size, received: [0], status: 'finalizing' }), 202);
      }
      if (init?.method === 'GET') {
        statusReads += 1;
        if (statusReads === 1) return response(uploadPayload({ size, received: [0] }));
        return response(statusReads === 2
          ? uploadPayload({ size, received: [0], status: 'finalizing' })
          : completedPayload(size));
      }
      throw new Error(`Unexpected request: ${init?.method} ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);
    MockChunkXMLHttpRequest.handler = (xhr) => xhr.succeed(uploadPayload({ size, received: [0] }));

    const phases: string[] = [];
    const result = await uploadIguideOfflinePackageResumable({
      file,
      shootId: 8,
      retryDelaysMs: [0, 0, 0],
      pollIntervalMs: 0,
      maxPolls: 3,
      onProgress: (value) => phases.push(value.phase),
    });

    expect(statusReads).toBe(3);
    expect(phases).toContain('finalizing');
    expect(result.id).toBe('package-1');
  });

  it('explicitly discards the saved server session and local resume metadata', async () => {
    const size = IGUIDE_RESUMABLE_CHUNK_BYTES + 1;
    const file = virtualFile(size);
    const controller = new AbortController();
    let discardAttempt = 0;
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (init?.method === 'POST' && url.endsWith('/uploads')) return response(uploadPayload({ size }), 201);
      if (init?.method === 'DELETE') {
        discardAttempt += 1;
        if (discardAttempt === 1) throw new TypeError('connection dropped');
        if (discardAttempt === 2) return response({ message: 'Please retry.' }, 503);
        return new Response(null, { status: 204 });
      }
      throw new Error(`Unexpected request: ${init?.method} ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);
    MockChunkXMLHttpRequest.handler = () => controller.abort();
    await expect(uploadIguideOfflinePackageResumable({
      file,
      shootId: 10,
      signal: controller.signal,
      retryDelaysMs: [0, 0, 0],
    })).rejects.toBeInstanceOf(IguideUploadPausedError);
    expect(getPersistedIguideUpload(10, file)?.sessionId).toBe('upload-1');

    await expect(discardIguideUploadSession({ file, shootId: 10 }))
      .rejects.toMatchObject({ retryable: true });
    expect(getPersistedIguideUpload(10, file)?.sessionId).toBe('upload-1');

    await expect(discardIguideUploadSession({ file, shootId: 10 }))
      .rejects.toMatchObject({ retryable: true, status: 503 });
    expect(getPersistedIguideUpload(10, file)?.sessionId).toBe('upload-1');

    await discardIguideUploadSession({ file, shootId: 10 });

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringMatching(/uploads\/upload-1$/),
      expect.objectContaining({ method: 'DELETE' }),
    );
    expect(getPersistedIguideUpload(10, file)).toBeNull();
  });
});
