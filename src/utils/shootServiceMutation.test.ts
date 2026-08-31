import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  parseServiceDetachConfirmation,
  ShootServiceMutationError,
  submitShootServiceMutation,
} from './shootServiceMutation';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('shoot service mutation confirmation', () => {
  it('normalizes the structured service-detach impact', () => {
    const confirmation = parseServiceDetachConfirmation(409, {
      code: 'service_detach_confirmation_required',
      confirmation_token: 'opaque-token',
      impact: {
        removed_services: [{ shoot_service_id: 9, service_id: 3, name: 'Photos', price: '90', quantity: 2, subtotal: '180' }],
        files_detached: 4,
        albums_detached: 1,
        upload_attempts_detached: 2,
        assignments_removed: 1,
        progress_rows_removed: 3,
        payment_allocations_released: '75.50',
        leaves_no_services: true,
        current_total: '200',
        new_total: '0',
        total_paid: '75.50',
        new_balance: 0,
        refund_credit_due: '75.50',
      },
    });

    expect(confirmation).toEqual(expect.objectContaining({
      token: 'opaque-token',
      impact: expect.objectContaining({
        leavesNoServices: true,
        filesDetached: 4,
        paymentAllocationsReleased: 75.5,
        refundCreditDue: 75.5,
        removedServices: [expect.objectContaining({ name: 'Photos', subtotal: 180 })],
      }),
    }));
  });

  it('adds confirmation fields only to the confirmed retry body', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: { id: 12 } }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }));
    vi.stubGlobal('fetch', fetchMock);

    await submitShootServiceMutation({
      url: '/api/shoots/12',
      token: 'auth-token',
      payload: { services: [] },
      confirmationToken: 'opaque-token',
    });

    expect(fetchMock).toHaveBeenCalledOnce();
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(String(init.body))).toEqual({
      services: [],
      confirm_service_detach: true,
      service_detach_confirmation_token: 'opaque-token',
    });
    expect(init.headers).toEqual(expect.objectContaining({ Authorization: 'Bearer auth-token' }));
  });

  it('returns a confirmation result for 409 and throws normalized errors otherwise', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        code: 'service_detach_confirmation_required',
        confirmation_token: 'token-2',
        impact: { removed_services: [] },
      }), { status: 409 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ errors: { services: ['At least one service is required.'] } }), { status: 422 }));
    vi.stubGlobal('fetch', fetchMock);

    const confirmation = await submitShootServiceMutation({
      url: '/api/shoots/12',
      payload: { services: [] },
    });
    expect(confirmation.kind).toBe('confirmation_required');

    await expect(submitShootServiceMutation({
      url: '/api/shoots/12',
      payload: { services: [] },
    })).rejects.toMatchObject({
      status: 422,
      message: 'services: At least one service is required.',
    } satisfies Partial<ShootServiceMutationError>);
  });
});
