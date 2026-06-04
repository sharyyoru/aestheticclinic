FROM node:18-slim

# Install Chromium and required system libs for Puppeteer
RUN apt-get update && apt-get install -y \
    chromium \
    fonts-ipafont-gothic \
    fonts-wqy-zenhei \
    fonts-thai-tlwg \
    fonts-kacst \
    fonts-freefont-ttf \
    libnss3 \
    libatk-bridge2.0-0 \
    libdrm2 \
    libxkbcommon0 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxrandr2 \
    libgbm1 \
    libasound2 \
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

# Increase /dev/shm size workaround: symlink shm to /tmp/shm
# Railway containers have limited /dev/shm (64MB by default); this prevents
# Chromium from crashing with "cannot map shared memory" on startup.
RUN mkdir -p /tmp/chromium-shm

# Tell Puppeteer to use installed Chromium instead of downloading its own
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

WORKDIR /app

# Copy package files
COPY package*.json ./

RUN npm install --only=production

# Copy all application files
COPY . .

# Create persistent data directory (mount Railway volume here at /data)
# - /data/whatsapp-sessions/ — WhatsApp Web auth data per user (LocalAuth)
# - /data/sessions.db — SQLite session metadata & logs
RUN mkdir -p /data/whatsapp-sessions

# Point session storage and SQLite DB to the persistent volume
ENV WA_SESSION_PATH=/data/whatsapp-sessions
ENV DB_PATH=/data/sessions.db

EXPOSE 3001

CMD ["node", "index.js"]
