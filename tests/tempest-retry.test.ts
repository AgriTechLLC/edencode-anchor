/**
 * TDD: Structured error types + retry logic for Tempest API service
 *
 * These tests were written FIRST and drove the implementation of:
 * - TempestAPIError (structured errors with status codes)
 * - withRetry() (exponential backoff for transient failures)
 * - 429 rate-limit detection
 * - Timeout detection and classification
 */

// Zero-delay retries so tests run in milliseconds, not seconds
process.env.TEMPEST_RETRY_DELAY_MS = '0';

import { getStations, getCurrentConditions, TempestAPIError } from '../src/service/tempest';

describe('TempestAPIError — structured error type', () => {
  it('should be an instance of Error', () => {
    const err = new TempestAPIError('oops', 500);
    expect(err).toBeInstanceOf(Error);
  });

  it('should carry statusCode', () => {
    const err = new TempestAPIError('Rate limited', 429);
    expect(err.statusCode).toBe(429);
  });

  it('should have correct name for instanceof checks', () => {
    const err = new TempestAPIError('Not found', 404);
    expect(err.name).toBe('TempestAPIError');
  });

  it('should be identifiable via isRetryable — 429 is retryable', () => {
    const err = new TempestAPIError('Rate limited', 429);
    expect(err.isRetryable).toBe(true);
  });

  it('should be identifiable via isRetryable — 500 is retryable', () => {
    const err = new TempestAPIError('Server error', 500);
    expect(err.isRetryable).toBe(true);
  });

  it('should NOT be retryable for 401 Unauthorized', () => {
    const err = new TempestAPIError('Unauthorized', 401);
    expect(err.isRetryable).toBe(false);
  });

  it('should NOT be retryable for 400 Bad Request', () => {
    const err = new TempestAPIError('Bad request', 400);
    expect(err.isRetryable).toBe(false);
  });
});

describe('getStations — retry on transient failure', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('should throw TempestAPIError (not plain Error) on 401', async () => {
    global.fetch = (() =>
      Promise.resolve({ ok: false, status: 401, statusText: 'Unauthorized' })
    ) as any;

    await expect(getStations()).rejects.toBeInstanceOf(TempestAPIError);
  });

  it('should include status code in TempestAPIError on 429', async () => {
    global.fetch = (() =>
      Promise.resolve({ ok: false, status: 429, statusText: 'Too Many Requests' })
    ) as any;

    try {
      await getStations();
      fail('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(TempestAPIError);
      expect((err as TempestAPIError).statusCode).toBe(429);
    }
  });

  it('should succeed on second attempt after one transient 500', async () => {
    let callCount = 0;
    global.fetch = (() => {
      callCount++;
      if (callCount === 1) {
        return Promise.resolve({ ok: false, status: 500, statusText: 'Internal Server Error' });
      }
      return Promise.resolve({
        ok: true,
        json: async () => ({ stations: [{ station_id: 99 }] }),
      });
    }) as any;

    const ids = await getStations();
    expect(ids).toEqual([99]);
    expect(callCount).toBe(2);
  });

  it('should throw after exhausting all retries on persistent 503', async () => {
    let callCount = 0;
    global.fetch = (() => {
      callCount++;
      return Promise.resolve({ ok: false, status: 503, statusText: 'Service Unavailable' });
    }) as any;

    await expect(getStations()).rejects.toBeInstanceOf(TempestAPIError);
    // Should have retried (at least 2 calls total)
    expect(callCount).toBeGreaterThan(1);
  });

  it('should NOT retry on 401 — fail fast', async () => {
    let callCount = 0;
    global.fetch = (() => {
      callCount++;
      return Promise.resolve({ ok: false, status: 401, statusText: 'Unauthorized' });
    }) as any;

    await expect(getStations()).rejects.toBeInstanceOf(TempestAPIError);
    expect(callCount).toBe(1); // no retry on auth errors
  });
});

describe('getCurrentConditions — retry on transient failure', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('should throw TempestAPIError with statusCode on HTTP error', async () => {
    global.fetch = (() =>
      Promise.resolve({ ok: false, status: 502, statusText: 'Bad Gateway' })
    ) as any;

    try {
      await getCurrentConditions(123);
      fail('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(TempestAPIError);
      expect((err as TempestAPIError).statusCode).toBe(502);
    }
  });

  it('should succeed on second attempt after network error', async () => {
    let callCount = 0;
    global.fetch = (() => {
      callCount++;
      if (callCount === 1) {
        return Promise.reject(new Error('ECONNRESET'));
      }
      return Promise.resolve({
        ok: true,
        json: async () => ({ current_conditions: { air_temperature: 22 } }),
      });
    }) as any;

    const data = await getCurrentConditions(42);
    expect(data.air_temperature).toBe(22);
    expect(callCount).toBe(2);
  });

  it('should NOT retry on 403 Forbidden', async () => {
    let callCount = 0;
    global.fetch = (() => {
      callCount++;
      return Promise.resolve({ ok: false, status: 403, statusText: 'Forbidden' });
    }) as any;

    await expect(getCurrentConditions(42)).rejects.toBeInstanceOf(TempestAPIError);
    expect(callCount).toBe(1);
  });
});
