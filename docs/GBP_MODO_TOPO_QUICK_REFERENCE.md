# GBP "Modo Topo" - Quick Reference

## What is "Modo Topo"?

**"Modo topo"** (top mode) is when Google displays business information in a featured box at the top of search results, identified by `[aria-label="Resultados em destaque"]`.

## Why Does It Matter?

The GBP Check extension needs the business profile in **standard view** to properly analyze it. "Modo topo" has a different layout that may prevent proper analysis.

## How It Works

### Detection
```javascript
// Looks for this element
document.querySelector('[aria-label="Resultados em destaque"]')

// Plus clickable "Avaliações" (Reviews) link inside it
```

### Correction
1. Find "Avaliações" button in the featured box
2. Click it to navigate to full business profile
3. Verify we exited "modo topo"

### Strategies (Tried in Order)
1. **Strategy 1:** Click + wait for new tab
2. **Strategy 2:** Click + wait for navigation
3. **Strategy 3:** Direct navigation to href

## When It Runs

### 1. Initial Check
- **When:** Right after navigating to URL
- **Purpose:** Correct before searching for GBP Check button

### 2. Periodic Re-check
- **When:** Every 2-3 failed button search attempts
- **Purpose:** Re-correct if page reverted to "modo topo"

## Code Locations

| Component | Location |
|-----------|----------|
| Main handler | `handleGBPTopModeCorrection()` (lines 1967-2208) |
| Strategy executor | `executeGBPTopModeCorrection()` (lines 1497-1713) |
| Selectors | `GBP_CONFIG.SELECTORS.GBP_REVIEWS_BUTTON` (lines 64-84) |
| Initial check | Lines 2356-2365 |
| Periodic check | Lines 2450-2477 |

## Configuration

### Selectors (Most Important First)
```javascript
[
  '[aria-label="Resultados em destaque"] a[href*="search"][href*="tbm=lcl"]',
  '[aria-label="Resultados em destaque"] a[href*="search"]',
  '[aria-label="Resultados em destaque"] .CYJS5e a[href]',
  'a.pPgDke.WWVCY[href*="search"]',
  // ... 10 more fallback selectors
]
```

### No Environment Variables
Feature is **always active** - no way to disable it.

## Logging

### Detection Logs
```
🔍 Checking if GBP is in top mode
📊 GBP verification result
```

### Correction Logs
```
🗺️ GBP is in top mode - looking for clickable Reviews button
🔄 Strategy 1: Normal click and wait for new tab
✅ GBP correction executed successfully
```

### Error Logs
```
❌ Reviews button not found in top mode
❌ All GBP correction strategies failed
```

## Response Data

Check if correction was applied:

```json
{
  "gbp_mode_correction": {
    "was_corrected": true,
    "description": "GBP was in top mode - corrected by clicking Reviews"
  }
}
```

## Troubleshooting

### Check if "Modo Topo" is Present
```javascript
// In browser console
document.querySelector('[aria-label="Resultados em destaque"]')
// Returns element if in top mode, null otherwise
```

### Check for "Avaliações" Button
```javascript
// In browser console
document.querySelectorAll('[aria-label="Resultados em destaque"] a')
// Should show clickable links including Reviews
```

### View Logs
```bash
tail -f data/app.log | grep -i "modo topo\|top mode\|avaliações"
```

### Common Issues

| Issue | Cause | Solution |
|-------|-------|----------|
| Not detected | Google changed structure | Update selectors |
| Correction fails | Button not clickable | Check page manually |
| Still in top mode | All strategies failed | Check logs for errors |

## Testing

### Test Detection
```bash
# Submit URL that shows top mode
curl -X POST http://localhost:3002/automate \
  -H "Content-Type: application/json" \
  -d '{"url": "https://www.google.com/search?q=restaurant+name+city"}'

# Check logs
tail -50 data/app.log | grep "modo topo"
```

### Expected Log Output
```
🔍 Initial GBP display mode verification
ℹ️ Looking for Reviews button (appears in top mode)
🔍 Checking if GBP is in top mode
📊 GBP verification result: isTopMode: true
🗺️ GBP is in top mode - looking for clickable Reviews button
🔄 Strategy 1: Normal click and wait for new tab
✅ GBP correction executed successfully
✅ GBP mode corrected initially - waiting for stabilization
```

## Flow Diagram

```
┌─────────────────────────────────────┐
│ Navigate to URL                     │
└──────────────┬──────────────────────┘
               ↓
┌─────────────────────────────────────┐
│ Check for "Resultados em destaque"  │
└──────────────┬──────────────────────┘
               ↓
         ┌─────┴─────┐
         │ Found?    │
         └─────┬─────┘
         Yes ↓     ↓ No
┌──────────────┐   └──────────────────┐
│ Find         │                       │
│ "Avaliações" │                       │
│ Button       │                       │
└──────┬───────┘                       │
       ↓                               │
┌──────────────┐                       │
│ Try Strategy │                       │
│ 1, 2, or 3   │                       │
└──────┬───────┘                       │
       ↓                               │
┌──────────────┐                       │
│ Verify Exit  │                       │
│ Top Mode     │                       │
└──────┬───────┘                       │
       ↓                               ↓
┌─────────────────────────────────────┐
│ Continue Automation                 │
└─────────────────────────────────────┘
```

## Key Takeaways

✅ **Always Active** - Runs automatically, no configuration needed  
✅ **Two Checkpoints** - Initial + periodic re-checks  
✅ **Three Strategies** - Multiple approaches to ensure success  
✅ **Fully Logged** - All actions tracked in logs  
✅ **Tracked in Response** - Know if correction was applied  
✅ **No Extension Dependency** - Handled by Playwright automation  

## Related Documentation

- **GBP_MODO_TOPO_ANALYSIS.md** - Comprehensive analysis (this is the detailed version)
- **AUTOMATION_CHANGES.md** - Overall automation flow
- **QUEUE_SYSTEM.md** - Queue processing system

## Quick Commands

```bash
# Monitor modo topo activity
tail -f data/app.log | grep -i "modo topo\|GBP.*topo\|avaliações"

# Check if feature is working
grep -i "modo topo" data/app.log | tail -20

# Count corrections applied
grep "GBP mode corrected" data/app.log | wc -l
```

## Support

If "modo topo" correction is failing:

1. **Check logs** for error messages
2. **Verify selectors** still match current Google structure
3. **Test manually** by clicking "Avaliações" button
4. **Update selectors** in `GBP_CONFIG.SELECTORS.GBP_REVIEWS_BUTTON` if needed
5. **Report issue** with screenshots and logs

