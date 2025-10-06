# Docker Deployment Guide

## Overview

This guide explains how to deploy the GBP Check automation service using Docker on an online server.

## Browser Configuration

The service now uses the following browser priority:

1. **Google Chrome** (Primary) - If installed on the system
2. **Playwright Chromium** (Fallback) - Bundled with Playwright, always available in Docker

### Browser Detection Logic

- The service automatically detects Chrome on Windows, Linux, and macOS
- If Chrome is not found, it falls back to Playwright's bundled Chromium
- In Docker containers, Playwright Chromium is the default since Chrome is not pre-installed
- All features (extension loading, screenshots, persistent sessions) work with both browsers

## Prerequisites

- Docker Engine 20.10 or later
- Docker Compose 1.29 or later
- At least 4GB RAM available
- At least 10GB disk space

## Quick Start

### 1. Build and Start the Service

```bash
# Build the Docker image
docker-compose build

# Or build without cache (recommended for first build)
docker-compose build --no-cache

# Start the service
docker-compose up -d

# View logs
docker-compose logs -f playwright-service
```

### 2. Verify the Service

```bash
# Check health status
curl http://localhost:3001/health

# Run diagnostics
curl http://localhost:3001/diagnose
```

### 3. Test Automation

```bash
curl -X POST http://localhost:3001/automate \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://example.com",
    "headless": true
  }'
```

## Configuration

### Environment Variables

Edit the `docker-compose.yml` or create a `.env` file:

```env
# Node environment
NODE_ENV=production

# Timezone
TZ=America/Sao_Paulo

# Browser mode (true for headless, false for visible)
HEADLESS=true

# Optional: Custom Chrome path (if Chrome is installed in container)
# CHROME_EXECUTABLE_PATH=/usr/bin/google-chrome
```

### Port Configuration

The service exposes port 3001 internally. When using platforms like Easypanel, the platform handles port mapping automatically.

For manual Docker deployments, you can add port mapping:

```yaml
ports:
  - "8080:3001"  # Map to port 8080 on host
```

Or use the `expose` directive (current configuration):

```yaml
expose:
  - "3001"  # Platform handles external mapping
```

## Data Persistence

### Volumes

The service uses Docker volumes for persistent data:

- `playwright_data` - Browser profiles, sessions, and application data
- `./data/screenshots` - Screenshot files (mounted for easy access)

### Backup Data

```bash
# Backup the volume
docker run --rm -v playwright_data:/data -v $(pwd):/backup \
  alpine tar czf /backup/playwright-backup.tar.gz /data

# Restore the volume
docker run --rm -v playwright_data:/data -v $(pwd):/backup \
  alpine tar xzf /backup/playwright-backup.tar.gz -C /
```

## Monitoring

### View Logs

```bash
# Real-time logs
docker-compose logs -f

# Last 100 lines
docker-compose logs --tail=100

# Logs for specific service
docker-compose logs -f playwright-service
```

### Health Checks

The service includes automatic health checks:

```bash
# Check container health
docker ps

# Manual health check
curl http://localhost:3001/health
```

### System Diagnostics

```bash
# Get detailed system information
curl http://localhost:3001/diagnose | jq
```

## Troubleshooting

### Container Won't Start

```bash
# Check logs
docker-compose logs playwright-service

# Rebuild without cache
docker-compose build --no-cache

# Check system resources
docker stats
```

### Browser Issues

```bash
# Verify browser detection
curl http://localhost:3001/diagnose | jq '.data.browser_detection'

# Check if Chromium is installed
docker-compose exec playwright-service npx playwright --version
```

### Memory Issues

If you encounter memory errors:

1. Increase shared memory in `docker-compose.yml`:
   ```yaml
   shm_size: 4gb
   ```

2. Increase container memory limits:
   ```yaml
   deploy:
     resources:
       limits:
         memory: 8G
   ```

### Permission Issues

```bash
# Fix data directory permissions
docker-compose exec playwright-service chmod -R 755 /app/data
```

## Production Deployment

### Security Recommendations

1. **Use a reverse proxy** (nginx, Traefik) for SSL/TLS
2. **Implement authentication** for API endpoints
3. **Set up firewall rules** to restrict access
4. **Use Docker secrets** for sensitive data
5. **Enable log rotation** to prevent disk space issues

### Reverse Proxy Example (nginx)

```nginx
server {
    listen 443 ssl;
    server_name automation.example.com;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    location / {
        proxy_pass http://localhost:3001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # Increase timeout for long-running automations
        proxy_read_timeout 600s;
        proxy_connect_timeout 600s;
        proxy_send_timeout 600s;
    }
}
```

### Scaling

To run multiple instances:

```yaml
services:
  playwright-service:
    # ... existing configuration ...
    deploy:
      replicas: 3
```

## Maintenance

### Update the Service

```bash
# Pull latest code
git pull

# Rebuild and restart
docker-compose down
docker-compose build --no-cache
docker-compose up -d
```

### Clean Up

```bash
# Remove stopped containers
docker-compose down

# Remove volumes (WARNING: deletes all data)
docker-compose down -v

# Clean up unused images
docker image prune -a
```

## Support

For issues or questions:

1. Check the logs: `docker-compose logs -f`
2. Run diagnostics: `curl http://localhost:3001/diagnose`
3. Review the application logs in `/app/data/app.log`

## Additional Resources

- [Docker Documentation](https://docs.docker.com/)
- [Playwright Documentation](https://playwright.dev/)
- [Docker Compose Documentation](https://docs.docker.com/compose/)

