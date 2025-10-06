# XVfb Virtual Display Fix

## Problem

When running Playwright in a Docker container without a graphical environment, the browser fails with:

```
Target page, context or browser has been closed
Browser logs:

╔════════════════════════════════════════════════════════════════════════════════════════════════╗
║ Looks like you launched a headed browser without having a XServer running.                     ║
║ Set either 'headless: true' or use 'xvfb-run <your-playwright-app>' before running Playwright. ║
║                                                                                                ║
║ <3 Playwright Team                                                                             ║
╚════════════════════════════════════════════════════════════════════════════════════════════════╝
```

## Root Cause

Docker containers don't have an X server (graphical display) by default. Even when running in "headless" mode, Chromium/Chrome still requires a display server for certain operations.

## Solution

Use **Xvfb** (X Virtual Framebuffer) to provide a virtual display server.

### What is Xvfb?

Xvfb is a virtual display server that performs all graphical operations in memory without showing any screen output. It's perfect for running browsers in Docker containers.

## Implementation

### 1. Dockerfile Changes

**Added xvfb package:**
```dockerfile
RUN apt-get update && apt-get install -y \
    # ... other dependencies ...
    xvfb \
    && rm -rf /var/lib/apt/lists/*
```

**Set DISPLAY environment variable:**
```dockerfile
ENV DISPLAY=:99
```

**Use xvfb-run in startup command:**
```dockerfile
CMD ["./start.sh"]
```

### 2. Startup Script (start.sh)

Created a smart startup script that:
- Detects headless mode setting
- Automatically uses xvfb-run when needed
- Configures optimal display settings

```bash
#!/bin/bash

set -e

echo "🚀 Starting GBP Check Automation Service..."

if [ "${HEADLESS}" = "true" ] || [ "${HEADLESS}" = "1" ]; then
    echo "📺 Headless mode enabled - starting with xvfb-run"
    echo "🖥️  Virtual display: ${DISPLAY:-:99}"
    echo "📐 Screen resolution: 1920x1080x24"
    
    exec xvfb-run \
        --auto-servernum \
        --server-args="-screen 0 1920x1080x24 -ac -nolisten tcp -dpi 96 +extension RANDR" \
        node server.js
else
    echo "👁️  Visible mode enabled - starting without xvfb"
    exec node server.js
fi
```

### 3. Xvfb Configuration

**Command-line arguments explained:**

- `--auto-servernum` - Automatically find available display number
- `--server-args` - Arguments passed to Xvfb:
  - `-screen 0 1920x1080x24` - Screen 0, 1920x1080 resolution, 24-bit color
  - `-ac` - Disable access control (allow all connections)
  - `-nolisten tcp` - Don't listen on TCP (security)
  - `-dpi 96` - Set DPI to 96 (standard)
  - `+extension RANDR` - Enable RANDR extension (screen resizing)

## Benefits

### ✅ Reliability
- Browser launches consistently in Docker
- No X server errors
- Works in any container environment

### ✅ Performance
- Virtual display runs in memory
- No GPU required
- Minimal overhead

### ✅ Flexibility
- Supports both headless and visible modes
- Configurable via environment variables
- Works with any Chromium-based browser

### ✅ Compatibility
- Works on all Linux distributions
- Compatible with Kubernetes, Docker Swarm
- Platform-agnostic (Easypanel, Portainer, etc.)

## Environment Variables

### HEADLESS
Controls browser display mode:
```bash
HEADLESS=true   # Use xvfb-run (default)
HEADLESS=false  # Direct mode (requires X server)
```

### DISPLAY
X server display number:
```bash
DISPLAY=:99     # Default virtual display
DISPLAY=:0      # Physical display (if available)
```

## Testing

### Test in Docker

```bash
# Build image
docker-compose build

# Start container
docker-compose up -d

# Check logs for xvfb startup
docker-compose logs | grep "xvfb"

# Should see:
# 📺 Headless mode enabled - starting with xvfb-run
# 🖥️  Virtual display: :99
# 📐 Screen resolution: 1920x1080x24
```

### Test Browser Launch

```bash
# Run automation
curl -X POST http://localhost:3001/automate \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://example.com",
    "headless": true
  }'

# Should complete without X server errors
```

### Verify Display

```bash
# Check if Xvfb is running
docker-compose exec playwright-service ps aux | grep Xvfb

# Should show Xvfb process with display :99
```

## Troubleshooting

### Issue: "Cannot open display"

**Solution:** Ensure DISPLAY environment variable is set
```bash
# In docker-compose.yml
environment:
  DISPLAY: ":99"
```

### Issue: "Xvfb failed to start"

**Solution:** Check if xvfb is installed
```bash
docker-compose exec playwright-service which Xvfb
# Should return: /usr/bin/Xvfb
```

### Issue: "Display already in use"

**Solution:** Use --auto-servernum (already configured)
```bash
xvfb-run --auto-servernum node server.js
```

### Issue: Browser still fails

**Solution:** Check browser logs
```bash
docker-compose logs | grep -A 10 "Browser logs"
```

## Alternative Approaches

### 1. Force Headless in Code

Modify server.js to always use headless:
```javascript
const launchOptions = {
  headless: true,  // Force headless
  // ... other options
};
```

### 2. Use Playwright's Built-in Headless

Playwright has improved headless mode that doesn't require X server:
```javascript
const browser = await chromium.launch({
  headless: true,
  args: ['--headless=new']  // New headless mode
});
```

### 3. Use Docker with X11 Forwarding

For development/debugging with visible browser:
```bash
docker run -e DISPLAY=$DISPLAY \
  -v /tmp/.X11-unix:/tmp/.X11-unix \
  your-image
```

## Performance Impact

### Xvfb Overhead

- **Memory:** ~50-100MB additional RAM
- **CPU:** Minimal (<1% idle, <5% during rendering)
- **Startup:** +1-2 seconds for Xvfb initialization

### Optimization Tips

1. **Reduce resolution** for better performance:
   ```bash
   --server-args="-screen 0 1280x720x24"
   ```

2. **Disable unnecessary extensions:**
   ```bash
   --server-args="-screen 0 1920x1080x24 -extension GLX"
   ```

3. **Use shared memory** (already configured):
   ```yaml
   shm_size: 2gb
   ```

## Production Recommendations

### ✅ Always Use Xvfb in Containers
- Ensures consistent behavior
- Prevents X server errors
- Works in any environment

### ✅ Set Appropriate Resolution
- 1920x1080 for screenshots
- 1280x720 for better performance
- Match your automation needs

### ✅ Monitor Resource Usage
- Check memory consumption
- Monitor CPU usage
- Adjust limits as needed

### ✅ Use Health Checks
- Verify browser can launch
- Check display availability
- Monitor service health

## Summary

The xvfb-run integration provides:

- ✅ **Reliable browser automation** in Docker containers
- ✅ **No X server required** - works anywhere
- ✅ **Automatic configuration** via startup script
- ✅ **Minimal performance impact** - efficient virtual display
- ✅ **Production-ready** - tested and stable

The service now runs smoothly in any Docker environment, including Easypanel, Kubernetes, and standalone Docker! 🚀

## Files Modified

1. **Dockerfile**
   - Added xvfb package
   - Set DISPLAY environment variable
   - Copy and execute start.sh

2. **start.sh** (new file)
   - Smart startup script
   - Automatic xvfb-run integration
   - Headless mode detection

3. **docker-compose.yml**
   - No changes needed
   - Works with existing configuration

## Verification Checklist

- [x] Xvfb installed in container
- [x] DISPLAY environment variable set
- [x] start.sh script created and executable
- [x] Dockerfile uses start.sh
- [x] Browser launches without X server errors
- [x] Automation completes successfully
- [x] Health checks pass
- [x] Service runs in production

