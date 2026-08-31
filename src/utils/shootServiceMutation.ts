export type RemovedShootService = {
  shootServiceId?: string | number;
  serviceId?: string | number;
  name: string;
  price?: number;
  quantity?: number;
  subtotal?: number;
};

export type ServiceDetachImpact = {
  removedServices: RemovedShootService[];
  filesDetached: number;
  albumsDetached: number;
  uploadAttemptsDetached: number;
  assignmentsRemoved: number;
  progressRowsRemoved: number;
  paymentAllocationsReleased: number;
  leavesNoServices: boolean;
  currentTotal: number;
  newTotal: number;
  totalPaid: number;
  newBalance: number;
  refundCreditDue: number;
};

export type ServiceDetachConfirmation = {
  token: string;
  message: string;
  impact: ServiceDetachImpact;
};

type ServiceMutationSuccess = {
  kind: 'success';
  data: unknown;
};

type ServiceMutationConfirmationRequired = {
  kind: 'confirmation_required';
  confirmation: ServiceDetachConfirmation;
};

export type ShootServiceMutationResult =
  | ServiceMutationSuccess
  | ServiceMutationConfirmationRequired;

export class ShootServiceMutationError extends Error {
  readonly status: number;
  readonly data: Record<string, unknown>;

  constructor(message: string, status: number, data: Record<string, unknown> = {}) {
    super(message);
    this.name = 'ShootServiceMutationError';
    this.status = status;
    this.data = data;
  }
}

const asRecord = (value: unknown): Record<string, unknown> =>
  value !== null && typeof value === 'object' ? value as Record<string, unknown> : {};

const asNumber = (value: unknown): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const asOptionalNumber = (value: unknown): number | undefined => {
  if (value === null || value === undefined || value === '') return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const errorMessageFromBody = (body: Record<string, unknown>, fallback: string): string => {
  const errors = asRecord(body.errors);
  if (Object.keys(errors).length > 0) {
    const messages = Object.entries(errors).flatMap(([field, value]) => {
      const entries = Array.isArray(value) ? value : [value];
      return entries.map((entry) => `${field}: ${String(entry)}`);
    });
    if (messages.length > 0) return messages.join('; ');
  }

  if (typeof body.message === 'string' && body.message.trim()) return body.message;
  if (typeof body.error === 'string' && body.error.trim()) return body.error;
  return fallback;
};

const normalizeRemovedServices = (impact: Record<string, unknown>): RemovedShootService[] => {
  const source = Array.isArray(impact.removed_services)
    ? impact.removed_services
    : Array.isArray(impact.removedServices)
      ? impact.removedServices
      : [];

  return source.map((value) => {
    const service = asRecord(value);
    return {
      shootServiceId: (service.shoot_service_id ?? service.shootServiceId) as string | number | undefined,
      serviceId: (service.service_id ?? service.serviceId) as string | number | undefined,
      name: typeof service.name === 'string' && service.name.trim() ? service.name : 'Service',
      price: asOptionalNumber(service.price),
      quantity: asOptionalNumber(service.quantity),
      subtotal: asOptionalNumber(service.subtotal),
    };
  });
};

export const parseServiceDetachConfirmation = (
  status: number,
  value: unknown,
): ServiceDetachConfirmation | null => {
  const body = asRecord(value);
  if (status !== 409 || body.code !== 'service_detach_confirmation_required') return null;

  const token = body.confirmation_token ?? body.confirmationToken;
  if (typeof token !== 'string' || !token) return null;

  const impact = asRecord(body.impact);
  return {
    token,
    message: typeof body.message === 'string' && body.message.trim()
      ? body.message
      : 'Confirm service removal before saving this shoot.',
    impact: {
      removedServices: normalizeRemovedServices(impact),
      filesDetached: asNumber(impact.files_detached ?? impact.filesDetached),
      albumsDetached: asNumber(impact.albums_detached ?? impact.albumsDetached),
      uploadAttemptsDetached: asNumber(impact.upload_attempts_detached ?? impact.uploadAttemptsDetached),
      assignmentsRemoved: asNumber(impact.assignments_removed ?? impact.assignmentsRemoved),
      progressRowsRemoved: asNumber(impact.progress_rows_removed ?? impact.progressRowsRemoved),
      paymentAllocationsReleased: asNumber(
        impact.payment_allocations_released ?? impact.paymentAllocationsReleased,
      ),
      leavesNoServices: Boolean(impact.leaves_no_services ?? impact.leavesNoServices),
      currentTotal: asNumber(impact.current_total ?? impact.currentTotal),
      newTotal: asNumber(impact.new_total ?? impact.newTotal),
      totalPaid: asNumber(impact.total_paid ?? impact.totalPaid),
      newBalance: asNumber(impact.new_balance ?? impact.newBalance),
      refundCreditDue: asNumber(impact.refund_credit_due ?? impact.refundCreditDue),
    },
  };
};

export async function submitShootServiceMutation({
  url,
  method = 'PATCH',
  token,
  payload,
  confirmationToken,
  signal,
}: {
  url: string;
  method?: 'PATCH' | 'POST' | 'PUT';
  token?: string | null;
  payload: Record<string, unknown>;
  confirmationToken?: string | null;
  signal?: AbortSignal;
}): Promise<ShootServiceMutationResult> {
  const requestPayload = confirmationToken
    ? {
        ...payload,
        confirm_service_detach: true,
        service_detach_confirmation_token: confirmationToken,
      }
    : payload;

  const response = await fetch(url, {
    method,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(requestPayload),
    signal,
  });

  const responseText = await response.text();
  let body: unknown = {};
  if (responseText) {
    try {
      body = JSON.parse(responseText) as unknown;
    } catch {
      body = { message: responseText };
    }
  }

  const confirmation = parseServiceDetachConfirmation(response.status, body);
  if (confirmation) {
    return { kind: 'confirmation_required', confirmation };
  }

  if (!response.ok) {
    const record = asRecord(body);
    const fallback = `Failed to update shoot (${response.status} ${response.statusText})`;
    throw new ShootServiceMutationError(errorMessageFromBody(record, fallback), response.status, record);
  }

  return { kind: 'success', data: body };
}
