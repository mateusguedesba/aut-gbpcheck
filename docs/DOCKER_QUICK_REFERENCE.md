# Docker Quick Reference

## Essential Commands

### Build & Start

```bash
# Build the image
docker-compose build

# Build without cache (clean build)
docker-compose build --no-cache

# Start services in background
docker-compose up -d

# Start services with logs visible
docker-compose up

# Build and start in one command
docker-compose up -d --build
```

### Stop & Remove

```bash
# Stop services
docker-compose stop

# Stop and remove containers
docker-compose down

# Stop, remove containers and volumes (⚠️ deletes data)
docker-compose down -v

# Remove only stopped containers
docker-compose rm
```

### Logs & Monitoring

```bash
# View real-time logs
docker-compose logs -f

# View last 100 lines
docker-compose logs --tail=100

# View logs for specific service
docker-compose logs -f playwright-service

# Check container status
docker-compose ps

# Check resource usage
docker stats
```

### Service Management

```bash
# Restart service
docker-compose restart

# Restart specific service
docker-compose restart playwright-service

# Scale service (run multiple instances)
docker-compose up -d --scale playwright-service=3
```

### Execute Commands in Container

```bash
# Open shell in running container
docker-compose exec playwright-service /bin/bash

# Run a single command
docker-compose exec playwright-service node --version

# Check Playwright version
docker-compose exec playwright-service npx playwright --version

# List files in data directory
docker-compose exec playwright-service ls -la /app/data
```

## Health & Diagnostics

```bash
# Check service health
curl http://localhost:3001/health

# Get detailed diagnostics
curl http://localhost:3001/diagnose

# Pretty print diagnostics with jq
curl http://localhost:3001/diagnose | jq

# Check browser detection
curl http://localhost:3001/diagnose | jq '.data.browser_detection'

# Check container health status
docker inspect --format='{{.State.Health.Status}}' gbpcheck-automation
```

## Data Management

### Volumes

```bash
# List volumes
docker volume ls

# Inspect volume
docker volume inspect playwright_data

# Backup volume
docker run --rm \
  -v playwright_data:/data \
  -v $(pwd):/backup \
  alpine tar czf /backup/backup-$(date +%Y%m%d-%H%M%S).tar.gz /data

# Restore volume
docker run --rm \
  -v playwright_data:/data \
  -v $(pwd):/backup \
  alpine tar xzf /backup/backup-YYYYMMDD-HHMMSS.tar.gz -C /

# Remove unused volumes
docker volume prune
```

### Screenshots

```bash
# List screenshots
ls -lh data/screenshots/

# Copy screenshot from container
docker cp gbpcheck-automation:/app/data/screenshots/screenshot.png ./

# View screenshot count
docker-compose exec playwright-service \
  sh -c 'ls -1 /app/data/screenshots | wc -l'
```

## Troubleshooting

### Container Issues

```bash
# View container logs with timestamps
docker-compose logs -f --timestamps

# Check container exit code
docker-compose ps -a

# Inspect container configuration
docker inspect gbpcheck-automation

# Check container processes
docker-compose exec playwright-service ps aux
```

### Browser Issues

```bash
# Verify Chromium installation
docker-compose exec playwright-service \
  npx playwright install chromium --dry-run

# Check browser processes
docker-compose exec playwright-service \
  ps aux | grep -i chromium

# Test browser launch
docker-compose exec playwright-service \
  node -e "const pw = require('playwright'); pw.chromium.launch().then(b => b.close())"
```

### Network Issues

```bash
# Check port binding
docker-compose port playwright-service 3001

# Test connectivity from host
curl -v http://localhost:3001/health

# Test connectivity from container
docker-compose exec playwright-service \
  curl -v http://localhost:3001/health

# Check network configuration
docker network inspect aut-gbpcheck_default
```

### Permission Issues

```bash
# Fix data directory permissions
docker-compose exec playwright-service \
  chmod -R 755 /app/data

# Check file ownership
docker-compose exec playwright-service \
  ls -la /app/data

# Run as root (for debugging only)
docker-compose exec -u root playwright-service /bin/bash
```

### Memory Issues

```bash
# Check memory usage
docker stats --no-stream

# Check shared memory
docker-compose exec playwright-service df -h | grep shm

# Increase shared memory (edit docker-compose.yml)
# shm_size: 4gb
```

## Testing

### API Testing

```bash
# Test health endpoint
curl http://localhost:3001/health

# Test automation endpoint
curl -X POST http://localhost:3001/automate \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://example.com",
    "headless": true
  }'

# Test with authentication (if configured)
curl -X POST http://localhost:3001/automate \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "url": "https://example.com"
  }'
```

### Performance Testing

```bash
# Monitor resource usage during automation
docker stats

# Check response time
time curl http://localhost:3001/health

# Load test (requires apache-bench)
ab -n 100 -c 10 http://localhost:3001/health
```

## Maintenance

### Updates

```bash
# Pull latest code
git pull

# Rebuild and restart
docker-compose down
docker-compose build --no-cache
docker-compose up -d

# Verify update
curl http://localhost:3001/diagnose | jq '.data.node_version'
```

### Cleanup

```bash
# Remove stopped containers
docker-compose down

# Remove unused images
docker image prune -a

# Remove unused volumes
docker volume prune

# Remove everything (⚠️ nuclear option)
docker system prune -a --volumes

# Clean build cache
docker builder prune
```

### Logs Management

```bash
# View log file size
docker-compose exec playwright-service \
  du -h /app/data/app.log

# Truncate log file
docker-compose exec playwright-service \
  sh -c '> /app/data/app.log'

# Rotate logs (if using json-file driver)
docker-compose restart
```

## Environment Variables

```bash
# Set environment variable for single run
HEADLESS=false docker-compose up

# View current environment
docker-compose exec playwright-service env

# Update environment variable
# 1. Edit docker-compose.yml or .env
# 2. Restart service
docker-compose restart
```

## Production Commands

### Deployment

```bash
# Deploy to production
docker-compose -f docker-compose.yml up -d --build

# Check deployment status
docker-compose ps
curl http://localhost:3001/health

# View deployment logs
docker-compose logs -f --tail=100
```

### Monitoring

```bash
# Continuous monitoring
watch -n 5 'docker stats --no-stream'

# Check uptime
docker inspect -f '{{.State.StartedAt}}' gbpcheck-automation

# Check restart count
docker inspect -f '{{.RestartCount}}' gbpcheck-automation
```

### Backup & Restore

```bash
# Full backup
docker-compose down
tar czf backup-$(date +%Y%m%d).tar.gz \
  docker-compose.yml \
  Dockerfile \
  .env \
  data/

# Restore
tar xzf backup-YYYYMMDD.tar.gz
docker-compose up -d
```

## Useful Aliases

Add to your `~/.bashrc` or `~/.zshrc`:

```bash
# Docker Compose shortcuts
alias dc='docker-compose'
alias dcup='docker-compose up -d'
alias dcdown='docker-compose down'
alias dclogs='docker-compose logs -f'
alias dcps='docker-compose ps'
alias dcrestart='docker-compose restart'

# GBP Check specific
alias gbp-logs='docker-compose logs -f playwright-service'
alias gbp-health='curl http://localhost:3001/health'
alias gbp-diagnose='curl http://localhost:3001/diagnose | jq'
alias gbp-shell='docker-compose exec playwright-service /bin/bash'
alias gbp-restart='docker-compose restart playwright-service'
```

## Emergency Procedures

### Service Not Responding

```bash
# 1. Check if container is running
docker-compose ps

# 2. Check logs for errors
docker-compose logs --tail=50 playwright-service

# 3. Restart service
docker-compose restart playwright-service

# 4. If still not working, rebuild
docker-compose down
docker-compose up -d --build
```

### Out of Memory

```bash
# 1. Check memory usage
docker stats --no-stream

# 2. Increase memory limit in docker-compose.yml
# deploy.resources.limits.memory: 8G

# 3. Restart with new limits
docker-compose down
docker-compose up -d
```

### Disk Space Full

```bash
# 1. Check disk usage
df -h

# 2. Clean Docker resources
docker system prune -a --volumes

# 3. Clean old screenshots
docker-compose exec playwright-service \
  find /app/data/screenshots -mtime +7 -delete

# 4. Rotate logs
docker-compose restart
```

## Additional Resources

- [Docker Documentation](https://docs.docker.com/)
- [Docker Compose CLI Reference](https://docs.docker.com/compose/reference/)
- [Playwright Docker Guide](https://playwright.dev/docs/docker)

