FROM node:18-slim

# Install Chromium dependencies for Puppeteer (used by whatsapp-web.js)
RUN apt-get update && apt-get install -y \
    chromium \
    fonts-ipafont-gothic \
    fonts-wqy-zenhei \
    fonts-thai-tlwg \
    fonts-kacst \
    fonts-freefont-ttf \
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

# Tell Puppeteer to use installed Chromium instead of downloading its own
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

WORKDIR /app

# Copy package files from whatsapp-server directory
COPY whatsapp-server/package*.json ./

RUN npm ci --only=production

# Copy all whatsapp-server files
COPY whatsapp-server/ ./

# Create directories for WhatsApp session persistence and SQLite database
RUN mkdir -p /app/whatsapp-sessions /app/data

# Set SQLite database path to persistent volume
ENV DB_PATH=/app/data/sessions.db

EXPOSE 3001

CMD ["node", "index.js"]
