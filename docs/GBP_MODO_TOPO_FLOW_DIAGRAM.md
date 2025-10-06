# GBP "Modo Topo" - Automation Flow Diagrams

## Overview

This document provides visual flow diagrams showing when and how the "modo topo" correction executes in the automation workflow.

---

## Complete Automation Flow (After Fix)

```
┌─────────────────────────────────────────────────────────────┐
│ START: runAutomationInBackground()                          │
└────────────────────────┬────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────────┐
│ Setup Browser & Navigate to URL                             │
└────────────────────────┬────────────────────────────────────┘
                         ↓
                    ┌────┴────┐
                    │ Is Maps │
                    │  URL?   │
                    └────┬────┘
                    Yes ↓     ↓ No
         ┌──────────────┘     └──────────────┐
         ↓                                    ↓
┌─────────────────────────┐    ┌─────────────────────────────┐
│ MAPS URL FLOW           │    │ DIRECT SEARCH URL FLOW      │
│                         │    │                             │
│ 1. handleGoogleMaps     │    │ 1. Check if Google Search   │
│    Redirect()           │    │                             │
│    - Click "Ver na      │    │ 2. Wait for page load       │
│      Pesquisa"          │    │    - domcontentloaded       │
│    - New tab opens      │    │    - networkidle            │
│    - Switch to new tab  │    │                             │
│                         │    │ 3. handleGBPTopMode         │
│ 2. ✅ Wait 10 seconds   │    │    Correction(0, false)     │
│                         │    │    - Check for modo topo    │
│ 3. Wait for page load   │    │    - Click "Avaliações"     │
│    - domcontentloaded   │    │      if detected            │
│    - networkidle        │    │                             │
│                         │    │ 4. If corrected:            │
│ 4. ✅ handleGBPTopMode  │    │    Wait 5-7 seconds         │
│    Correction(0, true)  │    │                             │
│    - Check for modo topo│    │                             │
│    - Click "Avaliações" │    │                             │
│      if detected        │    │                             │
│                         │    │                             │
│ 5. If corrected:        │    │                             │
│    Wait 5-7 seconds     │    │                             │
└────────────┬────────────┘    └──────────────┬──────────────┘
             │                                 │
             └────────────┬────────────────────┘
                          ↓
         ┌────────────────────────────────────┐
         │ Wait 15 seconds for extension      │
         └────────────────┬───────────────────┘
                          ↓
         ┌────────────────────────────────────┐
         │ findAndClickButton()               │
         │ - Search for GBP Check button      │
         │ - Periodic modo topo re-checks     │
         │   (every 2-3 failed attempts)      │
         └────────────────┬───────────────────┘
                          ↓
         ┌────────────────────────────────────┐
         │ Monitor for completion             │
         └────────────────┬───────────────────┘
                          ↓
         ┌────────────────────────────────────┐
         │ Complete & Cleanup                 │
         └────────────────────────────────────┘
```

---

## Maps URL Flow (Detailed)

```
┌──────────────────────────────────────────────────────────────┐
│ User provides Maps URL                                       │
│ Example: https://maps.google.com/maps?cid=12345             │
└────────────────────────┬─────────────────────────────────────┘
                         ↓
┌──────────────────────────────────────────────────────────────┐
│ Navigate to Maps URL                                         │
│ Page loads: Google Maps interface                            │
└────────────────────────┬─────────────────────────────────────┘
                         ↓
┌──────────────────────────────────────────────────────────────┐
│ Detect: isGoogleMapsUrl(currentUrl) = true                  │
│ Set: automation.cameFromMaps = true                         │
└────────────────────────┬─────────────────────────────────────┘
                         ↓
┌──────────────────────────────────────────────────────────────┐
│ handleGoogleMapsRedirect()                                   │
│                                                              │
│ 1. Wait 10 seconds for Maps to load                         │
│ 2. Wait for domcontentloaded + networkidle                  │
│ 3. Find "Ver na Pesquisa" button (from extension)          │
│ 4. Click button                                             │
│ 5. Wait 3 seconds                                           │
│ 6. New tab opens with Google Search                         │
│ 7. Switch to new tab (this.page = newPage)                 │
│ 8. Wait for domcontentloaded                                │
└────────────────────────┬─────────────────────────────────────┘
                         ↓
┌──────────────────────────────────────────────────────────────┐
│ ✅ NEW: Wait 10 seconds for Search page to load             │
│ Log: "Aguardando 10 segundos para página carregar..."       │
└────────────────────────┬─────────────────────────────────────┘
                         ↓
┌──────────────────────────────────────────────────────────────┐
│ ✅ NEW: Wait for page load states                           │
│ - domcontentloaded (5s timeout)                             │
│ - networkidle (5s timeout, optional)                        │
└────────────────────────┬─────────────────────────────────────┘
                         ↓
┌──────────────────────────────────────────────────────────────┐
│ ✅ NEW: handleGBPTopModeCorrection(0, true)                 │
│                                                              │
│ Parameters:                                                  │
│ - retryAttempt = 0 (first attempt)                          │
│ - cameFromMaps = true (indicates Maps redirect)            │
│                                                              │
│ Process:                                                     │
│ 1. Check if on Google Search page                          │
│ 2. Wait 4 seconds (extra time for Maps redirect)           │
│ 3. Look for [aria-label="Resultados em destaque"]          │
│ 4. If found: Look for "Avaliações" button                  │
│ 5. If found: Click button                                  │
│ 6. Wait for same-page navigation                           │
│ 7. Verify URL changed                                       │
│ 8. Verify exited "modo topo"                               │
│ 9. Return true if successful                               │
└────────────────────────┬─────────────────────────────────────┘
                         ↓
                    ┌────┴────┐
                    │ Success?│
                    └────┬────┘
                    Yes ↓     ↓ No
         ┌──────────────┘     └──────────────┐
         ↓                                    ↓
┌─────────────────────────┐    ┌─────────────────────────────┐
│ Modo topo corrected     │    │ Not in modo topo OR         │
│                         │    │ correction failed           │
│ - Set gbpModeFixed=true │    │                             │
│ - Wait 5-7 seconds      │    │ - Continue normally         │
│   (humanDelay)          │    │                             │
└────────────┬────────────┘    └──────────────┬──────────────┘
             │                                 │
             └────────────┬────────────────────┘
                          ↓
         ┌────────────────────────────────────┐
         │ Continue to extension wait         │
         │ (15 seconds)                       │
         └────────────────┬───────────────────┘
                          ↓
         ┌────────────────────────────────────┐
         │ findAndClickButton()               │
         │ Search for GBP Check button        │
         └────────────────────────────────────┘
```

---

## Direct Search URL Flow (Detailed)

```
┌──────────────────────────────────────────────────────────────┐
│ User provides Search URL                                     │
│ Example: https://www.google.com/search?q=restaurant         │
└────────────────────────┬─────────────────────────────────────┘
                         ↓
┌──────────────────────────────────────────────────────────────┐
│ Navigate to Search URL                                       │
│ Page loads: Google Search results                            │
└────────────────────────┬─────────────────────────────────────┘
                         ↓
┌──────────────────────────────────────────────────────────────┐
│ Detect: isGoogleMapsUrl(currentUrl) = false                 │
│ Detect: isGoogleSearchUrl(currentUrl) = true                │
└────────────────────────┬─────────────────────────────────────┘
                         ↓
┌──────────────────────────────────────────────────────────────┐
│ ✅ NEW: Wait for page load states                           │
│ - domcontentloaded (5s timeout)                             │
│ - networkidle (5s timeout, optional)                        │
└────────────────────────┬─────────────────────────────────────┘
                         ↓
┌──────────────────────────────────────────────────────────────┐
│ ✅ NEW: handleGBPTopModeCorrection(0, false)                │
│                                                              │
│ Parameters:                                                  │
│ - retryAttempt = 0 (first attempt)                          │
│ - cameFromMaps = false (direct URL)                         │
│                                                              │
│ Process:                                                     │
│ 1. Check if on Google Search page                          │
│ 2. Wait 2 seconds (normal wait time)                       │
│ 3. Look for [aria-label="Resultados em destaque"]          │
│ 4. If found: Look for "Avaliações" button                  │
│ 5. If found: Click button                                  │
│ 6. Wait for same-page navigation                           │
│ 7. Verify URL changed                                       │
│ 8. Verify exited "modo topo"                               │
│ 9. Return true if successful                               │
└────────────────────────┬─────────────────────────────────────┘
                         ↓
                    ┌────┴────┐
                    │ Success?│
                    └────┬────┘
                    Yes ↓     ↓ No
         ┌──────────────┘     └──────────────┐
         ↓                                    ↓
┌─────────────────────────┐    ┌─────────────────────────────┐
│ Modo topo corrected     │    │ Not in modo topo OR         │
│                         │    │ correction failed           │
│ - Set gbpModeFixed=true │    │                             │
│ - Wait 5-7 seconds      │    │ - Continue normally         │
│   (humanDelay)          │    │                             │
└────────────┬────────────┘    └──────────────┬──────────────┘
             │                                 │
             └────────────┬────────────────────┘
                          ↓
         ┌────────────────────────────────────┐
         │ Continue to extension wait         │
         │ (15 seconds)                       │
         └────────────────┬───────────────────┘
                          ↓
         ┌────────────────────────────────────┐
         │ findAndClickButton()               │
         │ Search for GBP Check button        │
         └────────────────────────────────────┘
```

---

## Timing Comparison

### ❌ BEFORE (Incorrect)

```
Maps URL:
─────────────────────────────────────────────────────────
Time  Action
─────────────────────────────────────────────────────────
0s    Navigate to Maps URL
2s    findAndClickButton() called
2s    ❌ handleGBPTopModeCorrection() (on Maps page!)
5s    handleGoogleMapsRedirect()
8s    Click "Ver na Pesquisa"
11s   New tab opens
14s   Button search starts
─────────────────────────────────────────────────────────
Result: Modo topo check happened on WRONG page (Maps)
```

### ✅ AFTER (Correct)

```
Maps URL:
─────────────────────────────────────────────────────────
Time  Action
─────────────────────────────────────────────────────────
0s    Navigate to Maps URL
2s    handleGoogleMapsRedirect()
5s    Click "Ver na Pesquisa"
8s    New tab opens with Search
8s    ✅ Wait 10 seconds for page load
18s   ✅ Wait for domcontentloaded + networkidle
20s   ✅ handleGBPTopModeCorrection() (on Search page!)
22s   Click "Avaliações" if needed
25s   Wait 5-7 seconds if corrected
32s   Wait 15 seconds for extension
47s   Button search starts
─────────────────────────────────────────────────────────
Result: Modo topo check happens on CORRECT page (Search)
```

---

## Key Timing Points

### Maps URL Flow

| Event | Time | Duration | Purpose |
|-------|------|----------|---------|
| Navigate to Maps | 0s | - | Initial navigation |
| Maps redirect | +2s | 3s | Click button, new tab opens |
| **New: Page load wait** | +5s | **10s** | **Let Search page load** |
| **New: Load states** | +15s | **2-5s** | **Verify page ready** |
| **New: Modo topo check** | +17s | **3-5s** | **Check and correct** |
| Stabilization (if corrected) | +22s | 5-7s | Let page settle |
| Extension wait | +29s | 15s | Extension loads |
| Button search | +44s | - | Start searching |

### Direct Search URL Flow

| Event | Time | Duration | Purpose |
|-------|------|----------|---------|
| Navigate to Search | 0s | - | Initial navigation |
| **New: Load states** | +2s | **2-5s** | **Verify page ready** |
| **New: Modo topo check** | +4s | **3-5s** | **Check and correct** |
| Stabilization (if corrected) | +9s | 5-7s | Let page settle |
| Extension wait | +16s | 15s | Extension loads |
| Button search | +31s | - | Start searching |

---

## Decision Tree

```
                    Start Automation
                          |
                          ↓
                    Navigate to URL
                          |
                          ↓
                  ┌───────┴───────┐
                  │               │
            Is Maps URL?    Is Search URL?
                  │               │
            Yes   ↓               ↓   Yes
                  │               │
        ┌─────────┴─────┐         │
        │ Maps Redirect │         │
        │ - Click btn   │         │
        │ - New tab     │         │
        └─────────┬─────┘         │
                  │               │
                  ↓               ↓
            Wait 10 seconds   Wait for load
                  │               │
                  ↓               ↓
            Wait for load     Check modo topo
                  │           (cameFromMaps=false)
                  ↓               │
            Check modo topo       │
            (cameFromMaps=true)   │
                  │               │
                  └───────┬───────┘
                          ↓
                    ┌─────┴─────┐
                    │ Corrected?│
                    └─────┬─────┘
                    Yes   ↓   No
                          │
                    ┌─────┴─────┐
                    │ Wait 5-7s │
                    └─────┬─────┘
                          │
                          ↓
                    Wait 15s for ext
                          │
                          ↓
                    Search for button
```

---

## Summary

### Key Changes

1. **Maps URLs:** Modo topo check moved to AFTER redirect completes (10s wait)
2. **Direct URLs:** Modo topo check added AFTER page loads
3. **Timing:** All checks happen when page is fully loaded
4. **Flag:** `cameFromMaps` properly indicates source

### Benefits

✅ Correct page for check (Search, not Maps)  
✅ Page fully loaded before check  
✅ Proper wait times for each scenario  
✅ Clear logging of timing  
✅ Better success rate  

The "modo topo" correction now executes at the optimal time in the automation flow! 🚀

