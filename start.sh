#!/bin/bash

# Start script for GBP Check Automation Service
# This script ensures proper X server setup for browser automation

set -e

echo "🚀 Starting GBP Check Automation Service..."

# Check if running in headless mode
if [ "${HEADLESS}" = "true" ] || [ "${HEADLESS}" = "1" ]; then
    echo "📺 Headless mode enabled - starting with xvfb-run"
    echo "🖥️  Virtual display: ${DISPLAY:-:99}"
    echo "📐 Screen resolution: 1920x1080x24"
    
    # Start with xvfb-run for virtual display
    exec xvfb-run \
        --auto-servernum \
        --server-args="-screen 0 1920x1080x24 -ac -nolisten tcp -dpi 96 +extension RANDR" \
        node server.js
else
    echo "👁️  Visible mode enabled - starting without xvfb"
    echo "⚠️  Note: Visible mode requires X server to be available"
    
    # Start without xvfb (requires X server)
    exec node server.js
fi

