import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { openAPIToZod } from '../src/utils/schema-converter';
import type { OpenAPISchema } from '../src/utils/openapi-parser';

describe('openAPIToZod', () => {
  it('maps anyOf object branches to ZodUnion (booking payment pattern)', () => {
    const paymentSchema: OpenAPISchema = {
      anyOf: [
        {
          type: 'object',
          additionalProperties: false,
          required: ['method'],
          properties: {
            method: { enum: ['ACC_CREDIT_CARD', 'WALLET', 'CREDIT'] },
          },
        },
        {
          type: 'object',
          additionalProperties: false,
          required: ['method', 'transactionId'],
          properties: {
            method: { enum: ['TRANSACTION_ID'] },
            transactionId: { type: 'string' },
          },
        },
      ],
      description: 'payment',
    };

    const zod = openAPIToZod(paymentSchema);
    expect(zod).toBeInstanceOf(z.ZodUnion);

    zod.parse({ method: 'ACC_CREDIT_CARD' });
    zod.parse({ method: 'TRANSACTION_ID', transactionId: 'tx-sandbox-1' });
    expect(() => zod.parse({ method: 'INVALID' })).toThrow();
  });

  it('maps oneOf to ZodUnion', () => {
    const schema: OpenAPISchema = {
      oneOf: [
        { type: 'string' },
        { type: 'integer' },
      ],
    };
    const zod = openAPIToZod(schema);
    expect(zod).toBeInstanceOf(z.ZodUnion);
  });

  it('maps plain object with properties to ZodObject', () => {
    const schema: OpenAPISchema = {
      type: 'object',
      required: ['a'],
      properties: {
        a: { type: 'string' },
        b: { type: 'number' },
      },
    };
    const zod = openAPIToZod(schema);
    expect(zod).toBeInstanceOf(z.ZodObject);
    expect(zod.parse({ a: 'x', b: 1 })).toEqual({ a: 'x', b: 1 });
  });

  it('returns z.any() for undefined schema', () => {
    const zod = openAPIToZod(undefined);
    expect(zod).toBeInstanceOf(z.ZodAny);
  });
});
