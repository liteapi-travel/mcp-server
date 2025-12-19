// Vercel serverless function entry point
// This file exports the Express app for Vercel deployment
import { createApp } from '../src/index';

const app = createApp();

// Export the app for Vercel
export default app;

