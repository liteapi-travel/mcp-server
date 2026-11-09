import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { z } from 'zod';
import { toJsonSchemaCompat } from '@modelcontextprotocol/sdk/server/zod-json-schema-compat.js';
import { loadEndpointMap } from '../src/utils/catalog.js';
import {
  createToolInputShape,
  openAPIToZod,
  openAPIEnumToZod,
} from '../src/utils/schema-converter.js';

function enumValueMatchesDeclaredType(value: unknown, declaredType: unknown): boolean {
  const types =
    declaredType === undefined
      ? []
      : Array.isArray(declaredType)
        ? declaredType
        : [declaredType];

  if (types.length === 0) {
    return typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean';
  }

  for (const t of types) {
    if (t === 'integer' && typeof value === 'number' && Number.isInteger(value)) {
      return true;
    }
    if (t === 'number' && typeof value === 'number') {
      return true;
    }
    if (t === 'string' && typeof value === 'string') {
      return true;
    }
    if (t === 'boolean' && typeof value === 'boolean') {
      return true;
    }
  }
  return false;
}

function collectEnumTypeMismatches(
  schema: unknown,
  path: string,
  errors: string[]
): void {
  if (!schema || typeof schema !== 'object') {
    return;
  }
  const node = schema as Record<string, unknown>;

  if (Array.isArray(node.enum) && node.enum.length > 0) {
    for (const value of node.enum) {
      if (!enumValueMatchesDeclaredType(value, node.type)) {
        errors.push(
          `${path}: enum value ${JSON.stringify(value)} incompatible with type ${JSON.stringify(node.type)}`
        );
      }
    }
  }

  if (node.properties && typeof node.properties === 'object') {
    for (const [key, child] of Object.entries(node.properties as Record<string, unknown>)) {
      collectEnumTypeMismatches(child, `${path}.properties.${key}`, errors);
    }
  }

  if (node.items) {
    collectEnumTypeMismatches(node.items, `${path}.items`, errors);
  }

  for (const key of ['anyOf', 'oneOf', 'allOf'] as const) {
    const branch = node[key];
    if (Array.isArray(branch)) {
      branch.forEach((child, index) => collectEnumTypeMismatches(child, `${path}.${key}[${index}]`, errors));
    }
  }
}

describe('OpenAPI enum → Zod', () => {
  it('keeps string enums as z.enum', () => {
    const schema = openAPIEnumToZod(['MR', 'MS', 'MRS']);
    assert.equal(schema.safeParse('MR').success, true);
    assert.equal(schema.safeParse('MR'.toLowerCase()).success, false);
  });

  it('accepts integer passengerType 0 for flights prebook', () => {
    const endpoints = loadEndpointMap();
    const prebook = endpoints.get('post_flights_prebooks');
    assert.ok(prebook, 'post_flights_prebooks endpoint should exist');

    const passengerTypeSchema = prebook.requestBody?.properties?.passengers?.items?.properties
      ?.passengerType as { type?: string; enum?: number[] };
    assert.ok(passengerTypeSchema?.enum?.includes(0));

    const zodPassengerType = openAPIToZod(passengerTypeSchema);
    assert.equal(zodPassengerType.safeParse(0).success, true);
    assert.equal(zodPassengerType.safeParse('0').success, false);

    const inputShape = createToolInputShape(prebook);
    assert.ok(inputShape.passengers, 'passengers field should be in tool input shape');

    const minimalPassenger = {
      passengerType: 0,
      firstName: 'Test',
      lastName: 'User',
      nationality: 'US',
    };
    const arraySchema = z.array(
      z.object({
        passengerType: zodPassengerType,
        firstName: z.string(),
        lastName: z.string(),
        nationality: z.string(),
      })
    );
    assert.equal(arraySchema.safeParse([minimalPassenger]).success, true);
  });
});

describe('generated MCP tool JSON schemas', () => {
  it('has no enum values that disagree with their declared JSON Schema type', () => {
    const endpoints = loadEndpointMap();
    const errors: string[] = [];

    for (const endpoint of endpoints.values()) {
      const shape = createToolInputShape(endpoint);
      if (Object.keys(shape).length === 0) {
        continue;
      }
      const zodObject = z.object(shape);
      const jsonSchema = toJsonSchemaCompat(zodObject, {
        strictUnions: true,
        pipeStrategy: 'input',
      });
      collectEnumTypeMismatches(jsonSchema, endpoint.operationId, errors);
    }

    assert.deepEqual(errors, []);
  });
});
