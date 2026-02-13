"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// Vercel serverless function entry point
// This file exports the Express app for Vercel deployment
const index_1 = require("../src/index");
const express_1 = __importDefault(require("express"));
let app;
try {
    app = (0, index_1.createApp)();
}
catch (error) {
    console.error('Failed to create app:', error);
    // Create a minimal error app
    app = (0, express_1.default)();
    app.use((req, res) => {
        res.status(500).json({
            error: 'Failed to initialize server',
            message: error instanceof Error ? error.message : 'Unknown error',
            stack: process.env.NODE_ENV === 'development' ? (error instanceof Error ? error.stack : undefined) : undefined
        });
    });
}
// Export the app for Vercel
exports.default = app;
