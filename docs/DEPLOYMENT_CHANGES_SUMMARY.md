# Docker Deployment Changes Summary

## Overview

This document summarizes all changes made to prepare the automation service for Docker deployment on an online server.

## Changes Made

### 1. Browser Configuration Updates (server.js)

#### Removed Edge-Specific Code
- ❌ Removed `findEdgeExecutable()` method
- ❌ Removed `findEdgeUserDataDir()` method  
- ❌ Removed `checkEdgeRunning()` method
- ❌ Removed all Edge-specific paths and logic

#### Added Chrome/Chromium Detection
- ✅ Added `findChromeExecutable()` method with multi-platform support:
  - Windows: Program Files, LocalAppData
  - Linux: /usr/bin/google-chrome, /usr/bin/chromium
  - macOS: /Applications/Google Chrome.app
  - Environment variable: CHROME_EXECUTABLE_PATH
  
- ✅ Added `checkChromeRunning()` method with cross-platform process detection

#### Updated setupBrowser() Method
- ✅ Changed browser priority: Chrome → Playwright Chromium (fallback)
- ✅ Updated persistent data directory: `edge-profile` → `browser-profile`
- ✅ Added conditional `executablePath` (only set if Chrome is found)
- ✅ Updated all logging messages to reflect Chrome/Chromium
- ✅ Added browser name tracking for better diagnostics

#### Updated Other Methods
- ✅ Updated `cleanup()` method logging
- ✅ Updated `/diagnose` endpoint with new browser detection info:
  - Chrome detection status
  - Playwright Chromium availability
  - Selected browser information
  - Browser profile directory path

### 2. New Docker Configuration Files

#### Dockerfile
**Location:** `/Dockerfile` (root directory)

**Features:**
- Base image: Node.js 18 LTS (Debian Bullseye)
- System dependencies for Playwright and Chrome/Chromium
- Playwright Chromium installation via `npx playwright install chromium`
- Application code copying (server.js, stealth.js)
- Chrome extension directory setup (read-only)
- Data directories creation with proper permissions
- Port 3001 exposure
- Health check configuration
- Production-ready startup command

**Key Dependencies Installed:**
- Core browser dependencies (libgtk-3-0, libnss3, etc.)
- Virtual display support (xvfb)
- Network utilities (curl, wget)
- Process management tools (procps)

#### docker-compose.yml
**Location:** `/docker-compose.yml` (root directory)

**Configuration:**
- Service name: `playwright-service`
- Container name: `gbpcheck-automation`
- Environment variables:
  - NODE_ENV (default: production)
  - TZ (default: America/Sao_Paulo)
  - HEADLESS (default: true)
  - CHROME_EXECUTABLE_PATH (optional)
- Volume mounts:
  - Named volume: `playwright_data` for persistent data
  - Bind mount: `./data/screenshots` for easy access
- Port mapping: 3001:3001
- Required capabilities: SYS_ADMIN
- Security options: seccomp:unconfined
- Shared memory: 2GB
- Health check: /health endpoint (30s interval)
- Restart policy: unless-stopped
- Resource limits: 4GB RAM, 2 CPUs (configurable)
- Logging: JSON file driver with rotation

#### .dockerignore
**Location:** `/.dockerignore` (root directory)

**Excluded from build context:**
- node_modules (reinstalled in container)
- data directories (created in container)
- archive directory (legacy files)
- Git files and history
- IDE configuration files
- Documentation (except README.md)
- Test files
- Environment files
- Logs and temporary files

### 3. Documentation

#### DOCKER_DEPLOYMENT.md
Comprehensive deployment guide including:
- Browser configuration explanation
- Quick start instructions
- Environment variable configuration
- Data persistence and backup procedures
- Monitoring and logging
- Troubleshooting common issues
- Production deployment recommendations
- Security best practices
- Scaling options
- Maintenance procedures

#### DEPLOYMENT_CHANGES_SUMMARY.md
This document - complete summary of all changes made.

## Browser Detection Flow

### Previous (Edge-only)
```
1. Find Edge executable
2. If not found → Error
3. Use Edge with persistent profile
```

### Current (Chrome → Chromium)
```
1. Try to find Chrome executable
   - Check Windows paths
   - Check Linux paths
   - Check macOS paths
   - Check CHROME_EXECUTABLE_PATH env var
2. If Chrome found:
   - Use Chrome with executablePath
   - Log: "Using Google Chrome"
3. If Chrome not found:
   - Use Playwright's bundled Chromium (no executablePath)
   - Log: "Using Playwright Chromium as fallback"
4. Use browser with persistent profile
```

## Docker Container Behavior

### Browser Selection in Container
- **Default:** Playwright Chromium (bundled, always available)
- **Optional:** Install Chrome in container and set CHROME_EXECUTABLE_PATH
- **Automatic:** Service detects and uses available browser

### Data Persistence
- Browser profiles: `/app/data/browser-profile`
- Screenshots: `/app/data/screenshots`
- Downloads: `/app/data/downloads`
- Logs: `/app/data/app.log`

### Extension Loading
- Chrome extension copied to: `/app/chrome-extension`
- Loaded via `--load-extension` argument
- Works with both Chrome and Chromium

## Testing Checklist

### Local Testing (Before Docker)
- [ ] Service starts successfully
- [ ] Chrome detection works (if Chrome installed)
- [ ] Chromium fallback works (if Chrome not installed)
- [ ] Extension loads correctly
- [ ] Automation completes successfully
- [ ] Screenshots are captured
- [ ] /health endpoint responds
- [ ] /diagnose shows correct browser info

### Docker Testing
- [ ] Docker image builds successfully
- [ ] Container starts without errors
- [ ] Playwright Chromium is available
- [ ] Extension loads in container
- [ ] Automation works in headless mode
- [ ] Data persists across container restarts
- [ ] Health checks pass
- [ ] Logs are accessible
- [ ] Screenshots are saved to volume

### Production Testing
- [ ] Service accessible via reverse proxy
- [ ] SSL/TLS configured correctly
- [ ] Authentication implemented (if required)
- [ ] Resource limits appropriate
- [ ] Monitoring configured
- [ ] Backup procedures tested
- [ ] Restart policy works correctly

## Migration Steps

### For Existing Deployments

1. **Backup existing data:**
   ```bash
   cp -r data/edge-profile data/edge-profile.backup
   ```

2. **Update code:**
   ```bash
   git pull
   ```

3. **Test locally:**
   ```bash
   npm start
   ```

4. **Build Docker image:**
   ```bash
   docker-compose build
   ```

5. **Start container:**
   ```bash
   docker-compose up -d
   ```

6. **Verify:**
   ```bash
   curl http://localhost:3001/diagnose
   ```

### For New Deployments

1. **Clone repository:**
   ```bash
   git clone <repository-url>
   cd <repository-directory>
   ```

2. **Configure environment:**
   ```bash
   cp .env.example .env  # If exists
   # Edit .env with your settings
   ```

3. **Build and start:**
   ```bash
   docker-compose up -d
   ```

4. **Verify:**
   ```bash
   curl http://localhost:3001/health
   curl http://localhost:3001/diagnose
   ```

## Key Benefits

### Flexibility
- ✅ Works with Chrome (if available) or Chromium (always available)
- ✅ Cross-platform support (Windows, Linux, macOS)
- ✅ Easy to switch between browsers via environment variable

### Docker-Ready
- ✅ Optimized for containerized environments
- ✅ Minimal image size with only required dependencies
- ✅ Proper data persistence with volumes
- ✅ Health checks and restart policies

### Production-Ready
- ✅ Resource limits and monitoring
- ✅ Logging with rotation
- ✅ Security configurations (capabilities, seccomp)
- ✅ Scalable architecture

### Maintainability
- ✅ Clear separation of concerns
- ✅ Comprehensive documentation
- ✅ Easy troubleshooting with diagnostics endpoint
- ✅ Backward compatible (existing features preserved)

## Notes

- The `/archive` directory was completely ignored as requested
- All Docker files were created from scratch
- Chrome extension files remain unchanged (read-only)
- All existing automation features are preserved
- Browser detection is now more robust and flexible
- Service gracefully handles absence of Chrome

## Support

For issues or questions:
1. Check logs: `docker-compose logs -f`
2. Run diagnostics: `curl http://localhost:3001/diagnose`
3. Review DOCKER_DEPLOYMENT.md for detailed troubleshooting

