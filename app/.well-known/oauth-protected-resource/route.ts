import { corsPreflight, jsonMetadata, protectedResourceMetadata } from '../../../lib/oauth-metadata';

export function GET() {
  return jsonMetadata(protectedResourceMetadata());
}

export function OPTIONS() {
  return corsPreflight();
}
