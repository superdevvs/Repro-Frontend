import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { normalizeIguideOfflinePackage } from '@/utils/shootTourData';
import { IguideOfflinePackageDialog } from './IguideOfflinePackageDialog';

type Listener = (event?: unknown) => void;

class MockXMLHttpRequest {
  static latest: MockXMLHttpRequest | null = null;

  method = '';
  url = '';
  status = 202;
  responseText = JSON.stringify({
    manual_offline_package: {
      id: 'package-uuid',
      file_id: 72,
      status: 'queued',
      original_filename: 'offline.zip',
      size_bytes: 3,
    },
  });
  sentBody: unknown;
  headers: Record<string, string> = {};
  listeners: Record<string, Listener> = {};
  uploadListeners: Record<string, Listener> = {};
  upload = {
    addEventListener: (event: string, listener: Listener) => {
      this.uploadListeners[event] = listener;
    },
  };

  constructor() {
    MockXMLHttpRequest.latest = this;
  }

  addEventListener(event: string, listener: Listener) {
    this.listeners[event] = listener;
  }

  open(method: string, url: string) {
    this.method = method;
    this.url = url;
  }

  setRequestHeader(name: string, value: string) {
    this.headers[name] = value;
  }

  send(body: unknown) {
    this.sentBody = body;
    this.uploadListeners.progress?.({ lengthComputable: true, loaded: 2, total: 3 });
    this.listeners.load?.();
  }

  abort() {
    this.listeners.abort?.();
  }
}

beforeEach(() => {
  MockXMLHttpRequest.latest = null;
  vi.stubGlobal('XMLHttpRequest', MockXMLHttpRequest);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('IguideOfflinePackageDialog', () => {
  it('uploads the selected ZIP as multipart package and returns queued state', () => {
    const onUploaded = vi.fn();
    const onOpenChange = vi.fn();
    const { container } = render(
      <IguideOfflinePackageDialog
        currentPackage={normalizeIguideOfflinePackage(null)}
        open
        onOpenChange={onOpenChange}
        onUploaded={onUploaded}
        shootId={9137}
      />,
    );
    const file = new File(['zip'], 'offline.zip', { type: 'application/zip' });
    const input = container.ownerDocument.querySelector('input[type="file"]') as HTMLInputElement;

    fireEvent.change(input, { target: { files: [file] } });
    fireEvent.click(screen.getByRole('button', { name: 'Upload package' }));

    const xhr = MockXMLHttpRequest.latest;
    expect(xhr?.method).toBe('POST');
    expect(xhr?.url).toContain('/api/integrations/shoots/9137/iguide/offline-package');
    expect(xhr?.sentBody).toBeInstanceOf(FormData);
    expect((xhr?.sentBody as FormData).get('package')).toBe(file);
    expect(xhr?.headers).not.toHaveProperty('Content-Type');
    expect(onUploaded).toHaveBeenCalledWith(expect.objectContaining({
      id: 'package-uuid',
      fileId: '72',
      status: 'queued',
    }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
