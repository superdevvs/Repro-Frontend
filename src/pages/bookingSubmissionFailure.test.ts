import { describe, expect, it } from 'vitest';
import { bookingSubmissionFailure } from './bookingSubmissionFailure';

describe('booking submission failure recovery', () => {
  it('preserves conflict data for the travel check and combines field errors for review', () => {
    const data = { errors: { time: ['Already booked'], photographer: 'Choose another photographer' }, travel_feasibility: { available: false } };
    const failure = bookingSubmissionFailure({ response: { status: 422, data } });
    expect(failure.data).toBe(data);
    expect(failure.message).toBe('Already booked. Choose another photographer');
    expect(failure.notice.title).toBe('Validation Error');
  });
  it('handles a direct mutation error body as well as an Axios error', () => {
    expect(bookingSubmissionFailure({ data: { message: 'The schedule changed. Check it again.' } }).message)
      .toBe('The schedule changed. Check it again.');
  });
  it('retains a useful network failure and a retry path for an unknown response', () => {
    expect(bookingSubmissionFailure(new Error('Connection interrupted')).message).toBe('Connection interrupted');
    expect(bookingSubmissionFailure({ response: { status: 503 } }).notice.description).toContain('503');
  });
});
