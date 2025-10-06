# Automation Flow Diagram

## New Flow (After Changes)

```
┌─────────────────────────────────────────────────────────────────────┐
│                         CLIENT REQUEST                               │
│                    POST /automate                                    │
│                    { url, wait_time, ... }                          │
└────────────────────────────┬────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    VALIDATION & SETUP                                │
│  • Validate URL                                                      │
│  • Generate session_id                                               │
│  • Create session in automationSessions Map                         │
└────────────────────────────┬────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│              ✅ IMMEDIATE RESPONSE (< 100ms)                         │
│  {                                                                   │
│    "success": true,                                                  │
│    "session_id": "automation_xxxxx",                                │
│    "message": "Automação iniciada em background",                   │
│    "status": "processing"                                            │
│  }                                                                   │
└────────────────────────────┬────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│              BACKGROUND AUTOMATION STARTS                            │
│              (runAutomationInBackground)                             │
└────────────────────────────┬────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    BROWSER SETUP                                     │
│  • Launch Edge with extension                                        │
│  • Apply stealth configuration                                       │
│  • Setup API interception                                            │
└────────────────────────────┬────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    NAVIGATE TO URL                                   │
│  • Navigate to target URL                                            │
│  • Handle Google Maps redirect if needed                            │
│  • Wait for extension to load (15s)                                 │
└────────────────────────────┬────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    FIND & CLICK BUTTON                               │
│  • Search for GBP Check start button                                │
│  • Click button if found                                             │
│  • Continue even if not found                                        │
└────────────────────────────┬────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│              PASSIVE MONITORING (Every 5s)                           │
│  • Monitor URL changes                                               │
│  • Check all tabs for completion URL                                │
│  • Wait for: app.gbpcheck.com/extension/healthcheck                │
│  • Timeout: wait_time seconds (default 300s)                        │
└────────────────────────────┬────────────────────────────────────────┘
                             │
                             ▼
                    ┌────────┴────────┐
                    │                 │
                    ▼                 ▼
        ┌───────────────┐   ┌──────────────┐
        │   COMPLETED   │   │   TIMEOUT    │
        └───────┬───────┘   └──────┬───────┘
                │                  │
                │                  └──────────────┐
                ▼                                 │
┌─────────────────────────────────────────────┐  │
│     🆕 NEW ACTION 1: CLICK BUTTON           │  │
│  • Selector: #actions-main-header-button... │  │
│  • Wait for button (10s timeout)            │  │
│  • Click button                              │  │
│  • Log success/failure                       │  │
└────────────────────┬────────────────────────┘  │
                     │                            │
                     ▼                            │
┌─────────────────────────────────────────────┐  │
│          COLLECT COMPLETION DATA            │◄─┘
│  • Take screenshot                           │
│  • Get page info                             │
│  • Get downloads                             │
│  • Get intercepted API data                  │
│  • Extract GBP Check data                    │
└────────────────────┬────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────┐
│          BUILD RESPONSE DATA                │
│  • Compile all collected data               │
│  • Add metadata (timestamps, URLs, etc.)    │
│  • Add status flags                         │
└────────────────────┬────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────┐
│     🆕 NEW ACTION 2: SEND WEBHOOK           │
│  • URL: n8n webhook endpoint                │
│  • Method: POST                              │
│  • Payload: Complete responseData           │
│  • Timeout: 30s                              │
│  • Add webhook_sent flag to response        │
└────────────────────┬────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────┐
│          UPDATE SESSION STATUS              │
│  • Update automationSessions Map            │
│  • Set status: 'completed' or 'timeout'     │
│  • Store complete data                       │
└────────────────────┬────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────┐
│          AUTO-CLOSE BROWSER                 │
│  • Close all automation tabs                │
│  • Close browser window/context             │
│  • Cleanup resources                         │
└────────────────────┬────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────┐
│          BACKGROUND TASK COMPLETE           │
│  • Log final status                          │
│  • Session data available for polling       │
└─────────────────────────────────────────────┘
```

## Old Flow (Before Changes)

```
┌─────────────────────────────────────────────┐
│         CLIENT REQUEST                       │
│         POST /automate                       │
└────────────────┬────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────┐
│         VALIDATION                           │
└────────────────┬────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────┐
│         BROWSER SETUP                        │
└────────────────┬────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────┐
│         NAVIGATE TO URL                      │
└────────────────┬────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────┐
│         FIND & CLICK BUTTON                  │
└────────────────┬────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────┐
│         WAIT FOR COMPLETION                  │
│         (Client waits here!)                 │
└────────────────┬────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────┐
│         COLLECT DATA                         │
└────────────────┬────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────┐
│         SEND RESPONSE                        │
│         (After 30-120 seconds!)              │
└────────────────┬────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────┐
│         AUTO-CLOSE                           │
└─────────────────────────────────────────────┘
```

## Key Differences

### Response Timing
- **Old**: Client waits 30-120 seconds for complete automation
- **New**: Client gets response in < 100ms

### New Actions
- **Button Click**: Clicks specific button after completion
- **Webhook**: Sends completion data to external endpoint

### Error Handling
- **Old**: Errors returned to client
- **New**: Errors logged, session updated, client already has response

### Session Tracking
- **Old**: No session tracking
- **New**: Sessions stored in Map, can be polled for status

## Sequence Diagram

```
Client          Server          Browser         n8n Webhook
  │               │               │                  │
  │─POST /automate─>              │                  │
  │               │               │                  │
  │               │─validate──────│                  │
  │               │               │                  │
  │<─200 OK──────│               │                  │
  │  (immediate)  │               │                  │
  │               │               │                  │
  │               │─setup browser─>                  │
  │               │               │                  │
  │               │─navigate─────>│                  │
  │               │               │                  │
  │               │─click button─>│                  │
  │               │               │                  │
  │               │─monitor───────>                  │
  │               │  (passive)    │                  │
  │               │               │                  │
  │               │<─completion───│                  │
  │               │   detected    │                  │
  │               │               │                  │
  │               │─click new btn─>                  │
  │               │               │                  │
  │               │─collect data──>                  │
  │               │               │                  │
  │               │─send webhook──────────────────>  │
  │               │               │                  │
  │               │<─webhook OK───────────────────── │
  │               │               │                  │
  │               │─auto close───>│                  │
  │               │               │                  │
  │               │─cleanup──────>│                  │
  │               │               │                  │
```

## Error Flow

```
┌─────────────────────────────────────────────┐
│         ERROR OCCURS IN BACKGROUND          │
└────────────────┬────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────┐
│         LOG ERROR                            │
│  • Structured logging with context          │
│  • Screenshot if possible                    │
└────────────────┬────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────┐
│         UPDATE SESSION                       │
│  • Set status: 'error'                       │
│  • Store error details                       │
│  • Store screenshot URL                      │
└────────────────┬────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────┐
│         CLEANUP RESOURCES                    │
│  • Close browser                             │
│  • Free memory                               │
└────────────────┬────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────┐
│         BACKGROUND TASK ENDS                 │
│  • Client already has 200 response          │
│  • Can poll session for error details       │
└─────────────────────────────────────────────┘
```

## Data Flow

```
Request Data                Response Data (Immediate)
┌──────────────┐           ┌──────────────────────┐
│ url          │           │ success: true        │
│ wait_time    │──────────>│ session_id: "..."    │
│ headless     │           │ message: "..."       │
│ selectors    │           │ status: "processing" │
└──────────────┘           └──────────────────────┘

                           Webhook Data (After Completion)
                           ┌──────────────────────────┐
                           │ success: true            │
                           │ session_id: "..."        │
                           │ message: "..."           │
                           │ data:                    │
                           │   - initial_url          │
                           │   - final_url            │
                           │   - screenshot_url       │
                           │   - button_clicked       │
                           │   - process_completed    │
                           │   - gbp_check_data       │
                           │   - api_data             │
                           │   - downloads            │
                           │   - webhook_sent         │
                           └──────────────────────────┘
```

