# Use Node.js 18 LTS as base image
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy source code and OpenAPI schemas
COPY src/ ./src/
COPY openapi-schemas/ ./openapi-schemas/
COPY tsconfig.json ./

# Install dev dependencies for building
RUN npm ci

# Build the TypeScript code
RUN npm run build

# Remove dev dependencies to reduce image size
# RUN npm prune --production

# Make the built file executable
RUN chmod 755 dist/index.js

# Expose port for HTTP server
EXPOSE 3000

# Set the default command to run the MCP server in HTTP mode
CMD ["node", "dist/index.js"]
