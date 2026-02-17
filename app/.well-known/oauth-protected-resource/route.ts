import {
  protectedResourceHandler,
  metadataCorsOptionsRequestHandler,
} from 'mcp-handler';

const handler = protectedResourceHandler({
  authServerUrls: ['https://mcp.liteapi.travel'],
});

const corsHandler = metadataCorsOptionsRequestHandler();

export { handler as GET, corsHandler as OPTIONS };
