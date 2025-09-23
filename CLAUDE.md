# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Playwright-based automation service that works with the GBP Check Chrome Extension to automate Google Business Profile health checks. The service runs as a Node.js Express server that controls browser automation through Playwright.

## Key Components

### Main Application
- **server.js** - Main Express server containing the PlaywrightAutomation class and all API endpoints
- **package.json** - Node.js dependencies including Playwright, Express, Winston for logging

### Chrome Extension
- **chrome-extension/** - Contains the official GBP Check extension that works with Google Business Profile pages
- **manifest.json** - Chrome extension manifest v3 with permissions for Google domains
- **code.js, popup.js, background.js** - Extension scripts for content injection and automation
- **NOTE: This is an official extension and cannot be edited or modified**

### Docker Configuration
- **docker-compose.yml** - Orchestrates the Playwright service and optional VNC server for remote viewing
- **Dockerfile.playwright** - Node.js 18 container with Playwright and Chromium dependencies

## Development Commands

```bash
# Start the service locally
npm start

# Start with auto-reload during development
npm run dev

# Install dependencies
npm install

# Build and run with Docker
docker-compose up --build

# Access VNC viewer (if enabled)
# http://localhost:6080 (password: playwright123)
```

## Architecture

### PlaywrightAutomation Class
The core automation logic is contained in a single class with methods for:
- **setupBrowser()** - Configures Chromium with the extension loaded
- **performLoginIfNeeded()** - Handles authentication flows
- **navigateToUrl()** - Navigation with error handling
- **findAndClickButton()** - Locates and clicks automation triggers
- **waitForCompletion()** - Monitors process completion across multiple tabs
- **takeScreenshot()** - Captures results for debugging

### API Endpoints
- **POST /automate** - Main automation endpoint accepting URL and configuration
- **GET /health** - Service health check
- **GET /diagnose** - Comprehensive system diagnostics
- **GET /screenshots** - List captured screenshots
- **DELETE /screenshots/cleanup** - Clean old screenshots

### Data Persistence
- **data/screenshots/** - Browser screenshots for debugging
- **data/browser-data/** - Persistent browser profile data
- **data/app.log** - Application logs via Winston

## Configuration

The service accepts these parameters via the /automate endpoint:
- `url` - Target URL for automation
- `wait_time` - Maximum wait time in seconds (default: 300)
- `button_selectors` - Custom button selectors to click
- `completion_selectors` - Custom completion indicators
- `login_url, username, password` - Optional authentication
- `headless` - Browser visibility (default: true)
- `enable_vnc` - VNC server for remote viewing

## Browser Extension Integration

The Chrome extension is loaded automatically and provides:
- Content scripts for Google Business Profile pages
- Communication bridge to external services via externally_connectable
- Screenshot capture capabilities via html2canvas
- jQuery-based DOM manipulation

## Debugging

Screenshots are automatically captured at key points and stored in `/screenshots/` endpoint. The service includes comprehensive logging and diagnostic endpoints to troubleshoot browser setup, extension loading, and automation flow issues.