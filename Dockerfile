FROM node:22-alpine

# Install Playwright dependencies
RUN apk add --no-cache \
    chromium \
    firefox \
    ttf-freefont \
    font-noto-emoji \
    harfbuzz \
    ca-certificates

# Set Playwright browsers path
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY src/ ./src/

# Build application
RUN npm run build

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S playwright -u 1001 -G nodejs
USER playwright

# Create logs directory
RUN mkdir -p logs screenshots

EXPOSE 3000

CMD ["npm", "start"]
