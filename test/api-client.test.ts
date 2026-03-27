import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { makeAPIRequest } from '../src/utils/api-client';

describe('makeAPIRequest', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: { get: (name: string) => (name === 'content-type' ? 'application/json' : null) },
      json: async () => ({ data: { ok: true } }),
    } as Response);
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('sends POST body as JSON with nested objects (payment must not be double-encoded)', async () => {
    const fetchMock = globalThis.fetch as ReturnType<typeof vi.fn>;
    const body = {
      prebookId: 'prebook-test-1',
      holder: {
        firstName: 'A',
        lastName: 'B',
        email: 'a@example.com',
        phone: '1',
      },
      guests: [{ occupancyNumber: 1, firstName: 'A', lastName: 'B', email: 'a@example.com' }],
      payment: { method: 'ACC_CREDIT_CARD' },
    };

    await makeAPIRequest(
      'https://api.liteapi.travel/v3.0',
      'POST',
      '/rates/book',
      'sand_test_key',
      {},
      body
    );

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(init.method).toBe('POST');
    const raw = init.body as string;
    const parsed = JSON.parse(raw);
    expect(parsed.payment).toEqual({ method: 'ACC_CREDIT_CARD' });
    expect(typeof parsed.payment).toBe('object');
    expect(typeof parsed.payment).not.toBe('string');
    const headers = init.headers as Record<string, string>;
    expect(headers['X-API-Key']).toBe('sand_test_key');
  });

  it('replaces path params and appends query string', async () => {
    const fetchMock = globalThis.fetch as ReturnType<typeof vi.fn>;
    await makeAPIRequest(
      'https://api.liteapi.travel/v3.0',
      'GET',
      '/bookings/{bookingId}',
      'key',
      { bookingId: 'bid-1', foo: 'bar' }
    );

    const [url] = fetchMock.mock.calls[0] as [string];
    expect(url).toContain('/bookings/bid-1');
    expect(url).toContain('foo=bar');
  });
});
