import { describe, expect, it } from 'vitest';

import { getPaymentErrorMessage } from './paymentErrorMessage';

describe('payment validation messages', () => {
  it('preserves the first backend allocation validation message', () => {
    const error = {
      isAxiosError: true,
      message: 'Request failed with status code 422',
      response: {
        data: {
          message: 'The given data was invalid.',
          errors: {
            shoot_service_ids: ['One or more selected services do not belong to this shoot.'],
          },
        },
      },
    };

    expect(getPaymentErrorMessage(error, 'Payment failed')).toBe(
      'One or more selected services do not belong to this shoot.',
    );
  });
});
