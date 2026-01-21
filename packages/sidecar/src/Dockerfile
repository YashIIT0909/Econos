# Use a lightweight Node image
FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package.json ./

# Install dependencies
RUN npm install

# Copy source code
COPY . .

# Build the TypeScript (ES2020 for private identifiers, CommonJS for Node.js compatibility)
RUN npx tsc src/server.ts --outDir dist --esModuleInterop --target ES2020 --module CommonJS --moduleResolution node --skipLibCheck

# Expose the Worker Port
EXPOSE 3001

# Run the Sidecar
CMD ["node", "dist/server.js"]