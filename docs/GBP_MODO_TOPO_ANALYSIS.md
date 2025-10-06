# GBP "Modo Topo" (Top Mode) - Comprehensive Analysis

## Executive Summary

The "modo topo" (top mode) is a specific Google Business Profile (GBP) display state that occurs when Google shows business information in a featured/highlighted format at the top of search results. The automation system detects and corrects this mode to ensure the GBP Check extension can properly analyze the business profile.

---

## 1. Location

### Primary Implementation
**File:** `server.js`  
**Class:** `PlaywrightAutomation`

### Key Methods

#### Main Handler Method
- **Method:** `handleGBPTopModeCorrection(retryAttempt = 0, cameFromMaps = false)`
- **Lines:** 1967-2208
- **Purpose:** Detects if GBP is in "modo topo" and corrects it

#### Correction Execution Method
- **Method:** `executeGBPTopModeCorrection(reviewsButton, foundSelector, currentUrl, retryAttempt)`
- **Lines:** 1497-1713
- **Purpose:** Executes different strategies to exit "modo topo"

### Configuration
**Location:** `GBP_CONFIG` object (lines 40-149)

**Relevant Sections:**
- **SELECTORS.GBP_REVIEWS_BUTTON** (lines 64-84): Selectors to find the "Avaliações" (Reviews) button
- **MESSAGES.GBP_TOP_MODE_DETECTED** (line 139): Log message for detection
- **MESSAGES.GBP_REVIEWS_CLICKED** (line 140): Log message for successful correction
- **MESSAGES.GBP_REVIEWS_NOT_FOUND** (line 141): Log message when button not found

---

## 2. Purpose

### What is "Modo Topo"?

"Modo topo" (top mode) is a Google Search feature where business information appears in a **featured/highlighted section** at the top of search results, identified by the element `[aria-label="Resultados em destaque"]` (Featured Results).

### Visual Characteristics

```
┌─────────────────────────────────────────────────┐
│  [Resultados em destaque]                       │
│  ┌───────────────────────────────────────────┐  │
│  │  Business Name                            │  │
│  │  ⭐⭐⭐⭐⭐ 4.5 (123 reviews)              │  │
│  │  📍 Address                               │  │
│  │  📞 Phone                                 │  │
│  │  [Avaliações] [Website] [Directions]     │  │ ← Clickable links
│  └───────────────────────────────────────────┘  │
└─────────────────────────────────────────────────┘
```

### Why Correction is Needed

**Problem:** When GBP is in "modo topo", the GBP Check extension may not be able to properly analyze the business profile because:
1. The layout is different from the standard GBP view
2. Some elements may not be accessible
3. The extension expects a specific page structure

**Solution:** Click the "Avaliações" (Reviews) button to navigate to the full business profile page, which has the standard layout the extension expects.

---

## 3. Implementation Details

### Detection Logic

The system detects "modo topo" by checking for:

1. **Primary Indicator:** Element with `aria-label="Resultados em destaque"`
2. **Secondary Check:** Presence of clickable links within that element
3. **Tertiary Check:** Links containing "Avaliações" (Reviews) text or relevant hrefs

<augment_code_snippet path="server.js" mode="EXCERPT">
````javascript
// Detection code (lines 1998-2054)
const gbpTopModeAnalysis = await this.page.evaluate(() => {
  // Look for "Resultados em destaque" element
  const featuredResults = document.querySelector('[aria-label="Resultados em destaque"]');
  
  if (!featuredResults) {
    return { isTopMode: false, reason: 'Element not found' };
  }
  
  // Look for clickable links (search, maps, or place)
  const searchLinks = featuredResults.querySelectorAll(
    'a[href*="search"], a[href*="maps.google.com"], a[href*="place"]'
  );
  
  if (searchLinks.length === 0) {
    return { isTopMode: false, reason: 'No search/maps links found' };
  }
  
  // Find "Avaliações" (Reviews) link
  let reviewsLink = null;
  for (const link of searchLinks) {
    const text = link.textContent?.trim().toLowerCase();
    if (text.includes('avaliações') || text.includes('avaliacoes') || 
        text.includes('reviews')) {
      reviewsLink = link;
      break;
    }
  }
  
  if (!reviewsLink) {
    return { isTopMode: false, reason: 'No Reviews link found' };
  }
  
  return {
    isTopMode: true,
    reason: 'Top mode detected - clickable Reviews link found',
    reviewsButtonText: reviewsLink.textContent,
    hasClickableLink: true
  };
});
````
</augment_code_snippet>

### Correction Strategies

The system uses **3 different strategies** to exit "modo topo", trying them in sequence:

#### Strategy 1: Normal Click + Wait for New Tab
- Click the "Avaliações" button normally
- Wait for a new tab/page to open
- Switch to the new page
- **Use Case:** When clicking opens a new tab

#### Strategy 2: Click + Wait on Same Page
- Click the "Avaliações" button
- Wait for navigation on the same page
- **Use Case:** When clicking navigates in the same tab

#### Strategy 3: Direct Navigation
- Extract the href from the "Avaliações" link
- Navigate directly to that URL
- **Use Case:** When clicking doesn't work (fallback)

<augment_code_snippet path="server.js" mode="EXCERPT">
````javascript
// Strategy execution (lines 1497-1713)
async executeGBPTopModeCorrection(reviewsButton, foundSelector, currentUrl, retryAttempt) {
  const strategies = [
    {
      name: 'Strategy 1: Normal click and wait for new tab',
      execute: async () => {
        // Click and wait for new page
        const [newPage] = await Promise.all([
          this.context.waitForEvent('page', { timeout: 10000 }),
          reviewsButton.click()
        ]);
        await newPage.waitForLoadState('domcontentloaded');
        this.page = newPage;
      }
    },
    {
      name: 'Strategy 2: Click and wait on same page',
      execute: async () => {
        await Promise.all([
          this.page.waitForNavigation({ timeout: 10000 }),
          reviewsButton.click()
        ]);
      }
    },
    {
      name: 'Strategy 3: Direct navigation',
      execute: async () => {
        const href = await reviewsButton.getAttribute('href');
        await this.page.goto(href, { waitUntil: 'domcontentloaded' });
      }
    }
  ];
  
  // Try the strategy for this retry attempt
  const strategy = strategies[retryAttempt % strategies.length];
  await strategy.execute();
  
  // Verify we exited top mode
  const stillTopMode = await this.page.evaluate(() => {
    return !!document.querySelector('[aria-label="Resultados em destaque"]');
  });
  
  return !stillTopMode;
}
````
</augment_code_snippet>

### Selectors Used

The system tries multiple selectors to find the "Avaliações" button (lines 64-84):

```javascript
GBP_REVIEWS_BUTTON: [
  // Most specific selectors
  '[aria-label="Resultados em destaque"] a[href*="search"][href*="tbm=lcl"]',
  '[aria-label="Resultados em destaque"] a[href*="search"]',
  '[aria-label="Resultados em destaque"] .CYJS5e a[href]',
  'a.pPgDke.WWVCY[href*="search"]',
  '.CYJS5e a[href*="search"]',
  
  // Selectors for Maps redirects
  '[aria-label="Resultados em destaque"] a[href*="maps.google.com"]',
  '[aria-label="Resultados em destaque"] a[href*="place"]',
  '.CYJS5e a[href*="maps.google.com"]',
  '.CYJS5e a[href*="place"]',
  
  // Fallback selectors
  'a[href*="search"][href*="tbm=lcl"]',
  'a[href*="search"]:has(.bmh4p)',
  'a[href*="search"]',
  'a[href*="maps.google.com"]',
  'a[href*="place"]'
]
```

---

## 4. Behavior

### When is it Triggered?

The "modo topo" correction is triggered at **two key points** in the automation workflow:

#### 1. Initial Check (After Navigation)
**Location:** Lines 2356-2365  
**Timing:** Immediately after navigating to the target URL  
**Purpose:** Detect and correct "modo topo" before attempting to find the GBP Check button

<augment_code_snippet path="server.js" mode="EXCERPT">
````javascript
// Initial GBP mode verification
this.structuredLogger.info('🔍 Initial GBP display mode verification');
this.structuredLogger.info('ℹ️ Looking for Reviews button (appears in top mode)');

const initialGBPCorrection = await this.handleGBPTopModeCorrection(0, this.cameFromMaps);

if (initialGBPCorrection) {
  this.structuredLogger.info('✅ GBP mode corrected initially - waiting for stabilization');
  await this.stealthManager.humanDelay(5000, 7000);
}
````
</augment_code_snippet>

#### 2. Periodic Retry Check (During Button Search)
**Location:** Lines 2450-2477  
**Timing:** Every 2-3 failed attempts to find the GBP Check button  
**Purpose:** Re-check if page reverted to "modo topo" during automation

<augment_code_snippet path="server.js" mode="EXCERPT">
````javascript
// Smart alternation: Every 2-3 failed attempts, check GBP mode
if (attempt % 3 === 0 || (attempt % 2 === 0 && attempt > 2)) {
  this.structuredLogger.info('🔄 Switching to GBP mode verification', {
    failedAttempts: attempt,
    reason: 'Multiple button attempts failed - checking if still in top mode'
  });
  
  const gbpCorrected = await this.handleGBPTopModeCorrection(
    Math.floor(attempt / 2), 
    this.cameFromMaps
  );
  
  if (gbpCorrected) {
    this.structuredLogger.info('✅ GBP mode corrected during retry');
    await this.stealthManager.humanDelay(5000, 7000);
    
    // Verify we actually exited top mode
    const stillTopMode = await this.page.evaluate(() => {
      return !!document.querySelector('[aria-label="Resultados em destaque"]');
    });
    
    if (!stillTopMode) {
      this.structuredLogger.info('✅ Confirmed: exited top mode');
      continue; // Try button search immediately
    }
  }
}
````
</augment_code_snippet>

### Workflow Integration

```
Start Automation
  ↓
Navigate to URL
  ↓
Wait for Page Load
  ↓
┌─────────────────────────────────────┐
│ Initial GBP Mode Check              │
│ - Detect "modo topo"                │
│ - Click "Avaliações" if detected    │
│ - Wait for page stabilization       │
└─────────────────────────────────────┘
  ↓
Search for GBP Check Button
  ↓
Button Not Found? (Retry Loop)
  ↓
Every 2-3 Failed Attempts:
┌─────────────────────────────────────┐
│ Periodic GBP Mode Re-check          │
│ - Check if reverted to "modo topo"  │
│ - Correct if needed                 │
│ - Continue button search            │
└─────────────────────────────────────┘
  ↓
Button Found or Max Retries
  ↓
Continue Automation
```

---

## 5. Dependencies

### Chrome Extension
**Dependency:** None  
**Note:** The "modo topo" correction is handled entirely by the Playwright automation, NOT by the Chrome extension. The extension is passive during this phase.

### URL Patterns
**Required:** Google Search URLs  
**Patterns:**
- `www.google.com/search`
- `google.com/search`
- `local.google.com/place`

**Not applicable to:** Google Maps URLs (Maps has its own redirect logic)

### DOM Elements
**Critical Element:** `[aria-label="Resultados em destaque"]`  
**Purpose:** Primary indicator of "modo topo"

**Target Element:** Links containing "Avaliações" (Reviews)  
**Purpose:** Button to click to exit "modo topo"

### Page State
**Requires:**
- Page must be fully loaded
- JavaScript must be enabled
- DOM must be accessible

---

## 6. Current State

### ✅ ACTIVE

The "modo topo" correction feature is **currently active** and runs automatically.

### Configuration

**No environment variables** control this feature. It is always enabled.

**Configurable aspects:**
- Selectors (in `GBP_CONFIG.SELECTORS.GBP_REVIEWS_BUTTON`)
- Retry strategies (3 strategies hardcoded)
- Wait times (uses `stealthManager.humanDelay()`)

### Tracking

The system tracks whether "modo topo" was corrected:

<augment_code_snippet path="server.js" mode="EXCERPT">
````javascript
// Instance variable (set when correction succeeds)
this.gbpModeFixed = true;

// Included in response data (lines 3514-3517)
gbp_mode_correction: {
  was_corrected: automation.gbpModeFixed,
  description: automation.gbpModeFixed ? 
    'GBP was in top mode - corrected by clicking Reviews' : 
    'GBP was already in correct mode'
}
````
</augment_code_snippet>

### Logging

All "modo topo" operations are logged with structured logging:

**Detection:**
- `🔍 Checking if GBP is in top mode`
- `📊 GBP verification result`

**Correction:**
- `🗺️ GBP is in top mode - looking for clickable Reviews button`
- `🔄 Strategy X: [strategy name]`
- `✅ GBP correction executed successfully`

**Errors:**
- `❌ Reviews button not found in top mode`
- `❌ All GBP correction strategies failed`

---

## 7. Success Verification

### How to Verify Correction Worked

After correction, the system verifies success by checking:

1. **URL Changed:** New URL is different from original
2. **No Longer in Top Mode:** `[aria-label="Resultados em destaque"]` element is gone
3. **Has Business Info:** Page contains business-related elements

<augment_code_snippet path="server.js" mode="EXCERPT">
````javascript
// Verification logic (lines 1655-1703)
const pageAnalysis = await this.page.evaluate(() => {
  const featuredResults = document.querySelector('[aria-label="Resultados em destaque"]');
  const stillTopMode = !!featuredResults;
  
  // Check if we're on a search results page (not top mode)
  const isSearchResults = document.querySelector('#search') ||
                         document.querySelector('.g') ||
                         document.querySelector('[data-ved]');
  
  // Check for business info elements
  const hasBusinessInfo = document.querySelector('[data-attrid*="business"]') ||
                         document.querySelector('[data-attrid="kc:/business/business:phone_number"]') ||
                         document.querySelector('.review-item') ||
                         document.querySelector('[aria-label*="estrela"]');
  
  return {
    stillTopMode,
    isSearchResults,
    hasBusinessInfo,
    url: window.location.href
  };
});

if (!pageAnalysis.stillTopMode) {
  // Success!
  return true;
}
````
</augment_code_snippet>

---

## 8. Common Scenarios

### Scenario 1: Direct Search URL (Top Mode)
```
User searches: "Restaurant Name City"
  ↓
Google shows business in "Resultados em destaque"
  ↓
Automation detects top mode
  ↓
Clicks "Avaliações" button
  ↓
Navigates to full business profile
  ↓
GBP Check extension can now analyze
```

### Scenario 2: Maps Redirect (May Trigger Top Mode)
```
User provides Maps URL
  ↓
Automation redirects to Search
  ↓
Search may show "modo topo"
  ↓
Correction applied (cameFromMaps = true)
  ↓
Extra wait time for Maps redirect
  ↓
Full business profile loaded
```

### Scenario 3: Already in Correct Mode
```
User provides direct business profile URL
  ↓
Page loads in standard view
  ↓
"Resultados em destaque" not found
  ↓
No correction needed
  ↓
Proceed with automation
```

---

## 9. Troubleshooting

### Issue: "Modo Topo" Not Detected

**Symptoms:**
- Automation proceeds but GBP Check fails
- No "modo topo" logs in output

**Possible Causes:**
1. Google changed the `aria-label` text
2. Page structure changed
3. JavaScript not fully loaded

**Solution:**
- Check logs for detection attempts
- Verify `[aria-label="Resultados em destaque"]` exists in page
- Update selectors if needed

### Issue: Correction Fails (All Strategies)

**Symptoms:**
- Log shows: `❌ All GBP correction strategies failed`
- Still in top mode after attempts

**Possible Causes:**
1. "Avaliações" button not clickable
2. Navigation blocked
3. Page structure changed

**Solution:**
- Check if button exists: `document.querySelector('[aria-label="Resultados em destaque"] a')`
- Verify button is visible and clickable
- Try manual click to see behavior
- Update selectors or strategies

### Issue: Correction Succeeds but Extension Fails

**Symptoms:**
- "Modo topo" corrected successfully
- GBP Check extension still doesn't work

**Possible Causes:**
1. Landed on wrong page after correction
2. Extension not loaded on new page
3. Page structure unexpected

**Solution:**
- Verify final URL is a valid business profile
- Check extension is injected: `console.log(window.gbpCheckExtension)`
- Ensure page has business information elements

---

## 10. Future Enhancements

### Potential Improvements

1. **Dynamic Selector Discovery**
   - Use AI/ML to find "Avaliações" button dynamically
   - Reduce dependency on hardcoded selectors

2. **Internationalization**
   - Support "Reviews" in multiple languages
   - Detect language and use appropriate text

3. **Performance Optimization**
   - Cache detection results
   - Skip check if URL pattern indicates standard view

4. **Enhanced Verification**
   - More robust success criteria
   - Screenshot comparison before/after

5. **Fallback Mechanisms**
   - Direct URL construction if all strategies fail
   - Alternative navigation paths

---

## 11. Code References

### Key Files
- **server.js** - All "modo topo" logic

### Key Methods
- `handleGBPTopModeCorrection()` - Main detection and correction handler
- `executeGBPTopModeCorrection()` - Strategy execution
- `findAndClickButton()` - Integrates periodic re-checks

### Key Configuration
- `GBP_CONFIG.SELECTORS.GBP_REVIEWS_BUTTON` - Button selectors
- `GBP_CONFIG.MESSAGES.GBP_TOP_MODE_DETECTED` - Log messages

### Integration Points
- Line 2360: Initial check after navigation
- Lines 2450-2477: Periodic re-check during button search
- Lines 3514-3517: Response data tracking

---

## Summary

The "modo topo" feature is a **critical component** of the GBP automation system that ensures the business profile is displayed in the correct format for the GBP Check extension to analyze. It is **always active**, uses **multiple detection and correction strategies**, and is **fully integrated** into the automation workflow with comprehensive logging and error handling.

