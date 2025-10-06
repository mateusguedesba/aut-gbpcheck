# GBP Check Automation Service - Docker Deployment

## 🚀 Quick Start

### Prerequisites
- Docker Engine 20.10+
- Docker Compose 1.29+
- 4GB RAM minimum
- 10GB disk space

### Deploy in 3 Steps

```bash
# 1. Build the image
docker-compose build

# 2. Start the service
docker-compose up -d

# 3. Verify it's running
curl http://localhost:3001/health
```

## 🌐 Browser Configuration

The service automatically selects the best available browser:

1. **Google Chrome** (Primary) - Used if installed on the system
2. **Playwright Chromium** (Fallback) - Always available in Docker

No configuration needed! The service detects and uses the appropriate browser automatically.

## 📋 Common Commands

```bash
# View logs
docker-compose logs -f

# Check status
docker-compose ps

# Restart service
docker-compose restart

# Stop service
docker-compose down

# Run diagnostics
curl http://localhost:3001/diagnose | jq
```

## 🔧 Configuration

Edit `docker-compose.yml` or create `.env` file:

```env
NODE_ENV=production
TZ=America/Sao_Paulo
HEADLESS=true
```

## 📊 API Endpoints

### Health Check
```bash
curl http://localhost:3001/health
```

### System Diagnostics
```bash
curl http://localhost:3001/diagnose
```

### Run Automation
```bash
curl -X POST http://localhost:3001/automate \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://example.com",
    "headless": true
  }'
```

## 📁 Data Persistence

Data is stored in Docker volumes:
- Browser profiles and sessions
- Screenshots
- Application logs

Backup your data:
```bash
docker run --rm -v playwright_data:/data -v $(pwd):/backup \
  alpine tar czf /backup/backup.tar.gz /data
```

## 🐛 Troubleshooting

### Build fails with npm error
If you see "npm ci can only install with an existing package-lock.json":
```bash
# The Dockerfile uses npm install which works with or without package-lock.json
# If issue persists, ensure package-lock.json is not in .dockerignore
docker-compose build --no-cache
```

### Service won't start
```bash
docker-compose logs playwright-service
docker-compose build --no-cache
```

### Check browser detection
```bash
curl http://localhost:3001/diagnose | jq '.data.browser_detection'
```

### Memory issues
Increase shared memory in `docker-compose.yml`:
```yaml
shm_size: 4gb
```

## 📚 Documentation

- **[DOCKER_DEPLOYMENT.md](DOCKER_DEPLOYMENT.md)** - Complete deployment guide
- **[DOCKER_QUICK_REFERENCE.md](DOCKER_QUICK_REFERENCE.md)** - Command reference
- **[DEPLOYMENT_CHANGES_SUMMARY.md](DEPLOYMENT_CHANGES_SUMMARY.md)** - Technical changes

## 🔒 Production Deployment

1. Use a reverse proxy (nginx/Traefik) for SSL
2. Implement API authentication
3. Set up firewall rules
4. Configure monitoring and alerts
5. Enable log rotation

See [DOCKER_DEPLOYMENT.md](DOCKER_DEPLOYMENT.md) for detailed production setup.

## 🆘 Support

1. Check logs: `docker-compose logs -f`
2. Run diagnostics: `curl http://localhost:3001/diagnose`
3. Review documentation in this repository

## ✅ What's New

- ✅ Chrome/Chromium browser support (Edge removed)
- ✅ Docker-optimized configuration
- ✅ Automatic browser detection and fallback
- ✅ Production-ready deployment setup
- ✅ Comprehensive documentation
- ✅ Health checks and monitoring

## 🎯 Key Features

- **Flexible Browser Support** - Works with Chrome or Chromium
- **Docker-Ready** - Optimized for containerized environments
- **Data Persistence** - Browser sessions and data preserved
- **Health Monitoring** - Built-in health checks
- **Production-Ready** - Resource limits and security configurations
- **Easy Deployment** - Simple docker-compose setup

---

**Need help?** Check the documentation files or run diagnostics to troubleshoot issues.

