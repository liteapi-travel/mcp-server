/**
 * Critical-path checks for booking OpenAPI → Zod (matches lib/mcp-tools / server tool schemas).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { z } from 'zod';
import { openAPIToZod } from '../src/utils/schema-converter';
import { parseEndpoints } from '../src/utils/openapi-parser';
import type { OpenAPISpec } from '../src/utils/openapi-parser';

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadBookingSpec(): OpenAPISpec {
  const raw = readFileSync(join(__dirname, '../openapi-schemas/booking.json'), 'utf-8');
  return JSON.parse(raw) as OpenAPISpec;
}

describe('booking flow (OpenAPI fixtures)', () => {
  const spec = loadBookingSpec();
  const endpoints = parseEndpoints(spec);

  const bookEndpoint = endpoints.find((e) => e.path === '/rates/book' && e.method === 'POST');
  const prebookEndpoint = endpoints.find((e) => e.path === '/rates/prebook' && e.method === 'POST');

  it('parses booking.json and exposes POST /rates/book', () => {
    expect(bookEndpoint).toBeDefined();
    expect(bookEndpoint?.requestBody?.properties?.payment).toBeDefined();
  });

  it('POST /rates/book payment field is anyOf → ZodUnion (not ZodAny)', () => {
    const paymentProp = bookEndpoint!.requestBody!.properties!.payment;
    const zPayment = openAPIToZod(paymentProp);
    expect(zPayment).toBeInstanceOf(z.ZodUnion);

    zPayment.parse({ method: 'ACC_CREDIT_CARD' });
    zPayment.parse({ method: 'TRANSACTION_ID', transactionId: 'tx-abc' });
  });

  it('POST /rates/prebook body schema includes required offerId + usePaymentSdk', () => {
    expect(prebookEndpoint).toBeDefined();
    const rb = prebookEndpoint!.requestBody!;
    expect(rb.required).toContain('offerId');
    expect(rb.required).toContain('usePaymentSdk');

    const zBody = openAPIToZod(prebookEndpoint!.requestBody);
    const parsed = zBody.parse({
      offerId: 'offer-from-rates-test',
      usePaymentSdk: false,
    });
    expect(parsed).toMatchObject({ offerId: 'offer-from-rates-test', usePaymentSdk: false });
  });
});
