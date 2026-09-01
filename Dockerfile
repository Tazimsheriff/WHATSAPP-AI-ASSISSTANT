FROM node:22-alpine

WORKDIR /app

# Install native build tools
RUN apk add --no-cache python3 make g++

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy source code and config
COPY tsconfig.json ./
COPY src ./src

# Create default auth storage folder
RUN mkdir -p auth_info_baileys

ENV NODE_ENV=production

CMD ["npm", "start"]
