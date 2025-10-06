# Use Node.js 18 LTS as base image
FROM node:18-bullseye

# Set working directory
WORKDIR /app

# Install system dependencies for Playwright and Chrome
RUN apt-get update && apt-get install -y \
    # Core dependencies
    wget \
    gnupg \
    ca-certificates \
    fonts-liberation \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libatspi2.0-0 \
    libcups2 \
    libdbus-1-3 \
    libdrm2 \
    libgbm1 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libwayland-client0 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxkbcommon0 \
    libxrandr2 \
    xdg-utils \
    # Additional dependencies for Chrome
    libu2f-udev \
    libvulkan1 \
    # Process management
    procps \
    # Network utilities
    curl \
    # Virtual display for headless mode
    xvfb \
    # Cleanup
    && rm -rf /var/lib/apt/lists/*

# Copy package files
COPY package*.json ./

# Install Node.js dependencies
# Use npm install if package-lock.json exists, otherwise it will create one
RUN npm install --production

# Install Playwright and Chromium browser
RUN npx playwright install chromium
RUN npx playwright install-deps chromium

# Copy application code
COPY server.js ./
COPY stealth.js ./
COPY start.sh ./

# Copy Chrome extension (read-only)
COPY chrome-extension ./chrome-extension

# Make startup script executable
RUN chmod +x start.sh

# Create necessary data directories with proper permissions
RUN mkdir -p /app/data/screenshots \
    /app/data/browser-data \
    /app/data/browser-profile \
    /app/data/downloads \
    && chmod -R 755 /app/data

# Set environment variables
ENV NODE_ENV=production
ENV HEADLESS=true
ENV TZ=America/Sao_Paulo
ENV DISPLAY=:99

# Expose application port
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:3001/health || exit 1

# Start the application using startup script
CMD ["./start.sh"]

