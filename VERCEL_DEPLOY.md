# Vercel Deployment Guide

This project is configured for deployment on Vercel. The MCP server functionality is exposed via HTTP API endpoints.

## Prerequisites

1. A Vercel account ([sign up here](https://vercel.com))
2. Vercel CLI installed (`npm i -g vercel`)
3. Your LiteAPI API key

## Deployment Steps

### 1. Install Dependencies

```bash
npm install
```

### 2. Build the Project

```bash
npm run build
```

### 3. Deploy to Vercel

#### Option A: Using Vercel CLI

```bash
# Login to Vercel
vercel login

# Deploy (follow prompts)
vercel

# For production deployment
vercel --prod
```

#### Option B: Using GitHub Integration

1. Push your code to a GitHub repository
2. Go to [Vercel Dashboard](https://vercel.com/dashboard)
3. Click "New Project"
4. Import your GitHub repository
5. Configure environment variables (see below)
6. Click "Deploy"

### 4. Set Environment Variables

In your Vercel project settings, add the following environment variable:

- `LITEAPI_API_KEY`: Your LiteAPI API key

**To set via CLI:**
```bash
vercel env add LITEAPI_API_KEY
```

**To set via Dashboard:**
1. Go to your project settings
2. Navigate to "Environment Variables"
3. Add `LITEAPI_API_KEY` with your API key value
4. Select environments (Production, Preview, Development)
5. Redeploy if needed

## API Usage

Once deployed, your API will be available at:
- Production: `https://your-project.vercel.app/api`
- Preview: `https://your-project-git-branch.vercel.app/api`

### List Available Tools

```bash
curl https://your-project.vercel.app/api
```

Response:
```json
{
  "tools": [
    {
      "name": "post_hotels_rates",
      "description": "Search for hotel rates",
      "method": "POST",
      "path": "/hotels/rates",
      "parameters": [...]
    },
    ...
  ],
  "count": 50
}
```

### Execute a Tool

```bash
curl -X POST https://your-project.vercel.app/api \
  -H "Content-Type: application/json" \
  -d '{
    "tool": "post_hotels_rates",
    "checkin": "2024-01-15",
    "checkout": "2024-01-20",
    "destination": {
      "type": "city",
      "value": "PAR"
    }
  }'
```

Response:
```json
{
  "success": true,
  "tool": "post_hotels_rates",
  "result": {
    ...
  }
}
```

## Project Structure

- `/api/index.ts` - HTTP API wrapper for Vercel serverless functions
- `/vercel.json` - Vercel configuration
- `/src/` - MCP server source code
- `/openapi-schemas/` - OpenAPI specification files

## Notes

- The API route handles CORS automatically
- Maximum execution time is set to 30 seconds
- The serverless function caches endpoints for better performance
- Make sure `openapi-schemas/` directory is included in your deployment (it's not in `.vercelignore`)

## Troubleshooting

### Environment Variables Not Working

- Ensure `LITEAPI_API_KEY` is set in Vercel project settings
- Redeploy after adding environment variables
- Check function logs in Vercel dashboard

### OpenAPI Schemas Not Found

- Verify `openapi-schemas/` directory exists in your repository
- Check that files are not ignored in `.vercelignore`
- Review build logs for path resolution issues

### Function Timeout

- Increase `maxDuration` in `vercel.json` (up to 60 seconds on Pro plan)
- Optimize API calls or reduce response sizes
