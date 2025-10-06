# Name Field Implementation

## Overview
Added a new optional "name" field to the POST /automate endpoint that captures the requester's name and includes it in the webhook payload sent upon automation completion.

## Changes Made

### 1. PlaywrightAutomation Class Constructor (Line 217)
**File:** `server.js`

Added `name` parameter to the constructor and stored it as an instance variable:

```javascript
constructor(sessionId = null, name = null) {
  // ... existing code ...
  this.name = name; // Nome do solicitante da automação
}
```

### 2. POST /automate Endpoint (Lines 3147, 3155-3166)
**File:** `server.js`

#### Extract name from request body:
```javascript
const name = requestData.name || null;
```

#### Validate name field:
```javascript
// Validar campo name se fornecido
if (name !== null && typeof name !== 'string') {
  sessionLogger.error('Campo "name" deve ser uma string', {
    receivedType: typeof name,
    receivedValue: name
  });
  return res.status(400).json({
    error: 'Campo "name" inválido',
    details: 'O campo "name" deve ser uma string',
    receivedType: typeof name
  });
}
```

### 3. Logging and Queue Addition (Lines 3192, 3210)
**File:** `server.js`

Added name to logging context and queue parameters:

```javascript
sessionLogger.info(`Automação GBP Check solicitada`, {
  sessionId: sessionId,
  targetUrl: cleanedUrl,
  waitTime: wait_time,
  headless: headless,
  name: name  // Added
});

// ADD TO QUEUE
const queueResult = automationQueue.add(sessionId, cleanedUrl, {
  wait_time: wait_time,
  button_selectors: button_selectors,
  headless: headless,
  sessionLogger: sessionLogger,
  startTime: startTime,
  name: name  // Added
});
```

### 4. Queue Processing (Line 2868)
**File:** `server.js`

Updated the queue's processQueue method to pass name parameter:

```javascript
await runAutomationInBackground(
  job.sessionId,
  job.url,
  job.params.wait_time,
  job.params.button_selectors,
  job.params.headless,
  job.params.sessionLogger,
  job.params.startTime,
  job.params.name  // Added
);
```

### 5. Background Automation Function (Lines 3270, 3278-3280, 3291)
**File:** `server.js`

Updated function signature and logging:

```javascript
async function runAutomationInBackground(sessionId, url, wait_time, button_selectors, headless, sessionLogger, startTime, name = null) {
  // ... existing code ...
  
  if (name) {
    sessionLogger.setContext('name', name);
  }
  
  sessionLogger.info(`Executando automação GBP Check em background`, {
    targetUrl: url,
    customSelectors: button_selectors.length > 0,
    selectorCount: button_selectors.length,
    completionUrl: 'app.gbpcheck.com/extension/healthcheck (com fechamento automático)',
    checkInterval: '5 segundos',
    windowManagement: 'Nova janela independente será criada e fechada automaticamente',
    name: name  // Added
  });

  automation = new PlaywrightAutomation(sessionId, name);  // Pass name to constructor
}
```

### 6. Webhook Payload (Line 3491)
**File:** `server.js`

Added name field to the response data that is sent to the webhook:

```javascript
const responseData = {
  success: true,
  session_id: sessionId,
  message: completed ? 'Automação GBP Check concluída com sucesso' : 'Automação GBP Check finalizada (timeout atingido)',
  data: {
    name: automation.name,  // Added - will be included in webhook
    initial_url: url,
    final_url: finalUrl,
    // ... rest of the data ...
  }
};
```

## API Usage

### Request Format

```json
POST /automate
Content-Type: application/json

{
  "url": "https://example.com",
  "wait_time": 300,
  "headless": true,
  "name": "John Doe"  // Optional field
}
```

### Field Specifications

- **name** (optional): String
  - Represents the name of the person or system requesting the automation
  - If not provided, defaults to `null`
  - If provided, must be a string (validation enforced)
  - Invalid types will return a 400 error

### Response Format

The name field is included in the webhook payload sent to the external service:

```json
{
  "success": true,
  "session_id": "automation_1234567890_abc123",
  "message": "Automação GBP Check concluída com sucesso",
  "data": {
    "name": "John Doe",
    "initial_url": "https://example.com",
    "final_url": "https://example.com/result",
    "process_completed": true,
    // ... other fields ...
  }
}
```

## Testing

A test script has been created: `test-name-field.js`

Run the tests:
```bash
node test-name-field.js
```

The test script validates:
1. ✅ Valid name field (string) - should be accepted
2. ✅ No name field - should work with null
3. ✅ Invalid name field (non-string) - should return 400 error

## Logging

The name field is logged at multiple points for debugging:
- When the automation request is received
- When the automation starts in background
- Throughout the structured logging context

## Backward Compatibility

✅ **Fully backward compatible**
- The name field is optional
- Existing API calls without the name field will continue to work
- The field defaults to `null` when not provided

## Webhook Integration

The name field is automatically included in the webhook payload sent to:
```
https://ample-n8n.i9msbj.easypanel.host/webhook/f024ef22-70b6-4374-829e-e1ba5c22474d
```

The external service can now identify which user or system initiated each automation request.

