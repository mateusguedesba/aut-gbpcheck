#!/bin/bash

# ===================================
# GBP Check Automation - Selkies Deploy
# Easypanel Production Deploy Script
# ===================================

set -e

echo "🚀 Starting GBP Check Automation Selkies Deploy..."

# Check if running as root (required for GPU access)
if [[ $EUID -eq 0 ]]; then
   echo "✅ Running as root - GPU access available"
else
   echo "⚠️  Not running as root - GPU may not be accessible"
fi

# Check environment file
if [ ! -f .env ]; then
    echo "📝 Creating .env from template..."
    cp .env.example .env
    echo "⚠️  IMPORTANT: Edit .env file with your production settings!"
    echo "   - Update SELKIES_PASSWORD"
    echo "   - Set secure TURN_SECRET"
    echo "   - Adjust resource limits"
fi

# Check NVIDIA GPU
if command -v nvidia-smi &> /dev/null; then
    echo "🎮 NVIDIA GPU detected:"
    nvidia-smi --query-gpu=name,memory.total --format=csv,noheader
else
    echo "⚠️  NVIDIA GPU not detected - using CPU rendering"
fi

# Check Docker Compose
if ! command -v docker-compose &> /dev/null; then
    echo "❌ docker-compose not found. Installing..."
    curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
    chmod +x /usr/local/bin/docker-compose
fi

# Create logs directory
mkdir -p logs data

# Deploy
echo "🐳 Deploying Selkies container..."
docker-compose -f docker-compose.selkies.yml up --build -d

# Wait for health check
echo "⏳ Waiting for services to be healthy..."
sleep 30

# Check status
echo "📊 Service Status:"
docker-compose -f docker-compose.selkies.yml ps

# Show access information
source .env 2>/dev/null || true
PLAYWRIGHT_PORT=${PLAYWRIGHT_PORT:-3002}
SELKIES_PORT=${SELKIES_PORT:-8081}

echo ""
echo "✅ Deploy completed successfully!"
echo ""
echo "🌐 Access URLs:"
echo "   • Selkies WebRTC: http://localhost:${SELKIES_PORT}"
echo "   • Playwright API: http://localhost:${PLAYWRIGHT_PORT}"
echo "   • Health Check:   http://localhost:${PLAYWRIGHT_PORT}/health"
echo ""
echo "🔐 Default Credentials:"
echo "   • Username: admin"
echo "   • Password: (check .env file)"
echo ""
echo "📝 Logs:"
echo "   docker-compose -f docker-compose.selkies.yml logs -f"
echo ""
echo "🛑 Stop:"
echo "   docker-compose -f docker-compose.selkies.yml down"