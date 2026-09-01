FROM node:22-alpine

WORKDIR /app

# Install build dependencies if needed
RUN apk add --no-cache python3 make g++

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --omit=dev || npm install --omit=dev

# Copy source code and config
COPY tsconfig.json ./
COPY src ./src

# Create auth storage folder
RUN mkdir -p auth_info_baileys

ENV NODE_ENV=production

CMD ["npx", "tsx", "src/index.ts"]
