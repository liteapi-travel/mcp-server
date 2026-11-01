import { authorizationServerMetadata, corsPreflight, jsonMetadata } from '../../../lib/oauth-metadata';

export function GET() {
  return jsonMetadata(authorizationServerMetadata());
}

export function OPTIONS() {
  return corsPreflight();
}
