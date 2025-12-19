// Vercel serverless function entry point
// This file exports the Express app for Vercel deployment
import { createApp } from '../src/index';
import express from 'express';

let app: express.Application;

try {
  app = createApp();
} catch (error) {
  console.error('Failed to create app:', error);
  // Create a minimal error app
  app = express();
  app.use((req, res) => {
    res.status(500).json({
      error: 'Failed to initialize server',
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: process.env.NODE_ENV === 'development' ? (error instanceof Error ? error.stack : undefined) : undefined
    });
  });
}

// Export the app for Vercel
export default app;

