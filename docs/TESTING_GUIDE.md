# Testing Guide for Automation Changes

## Quick Test

### 1. Start the Service
```bash
npm start
```

### 2. Test the Immediate Response
Send a POST request to `/automate`:

```bash
curl -X POST http://localhost:3000/automate \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://www.google.com/search?q=your-business-name",
    "wait_time": 300,
    "headless": false
  }'
```

**Expected Response** (should return immediately):
```json
{
  "success": true,
  "session_id": "automation_1234567890_abc123",
  "message": "Automação iniciada em background",
  "status": "processing"
}
```

### 3. Monitor the Logs
Watch the logs to see the automation progress:

```bash
# On Windows PowerShell
Get-Content data\app.log -Wait -Tail 50

# On Linux/Mac
tail -f data/app.log
```

Look for these log entries:
- `✅ Resposta 200 enviada imediatamente - continuando em background`
- `🖱️ Clicando no botão após conclusão...`
- `✅ Botão clicado com sucesso após conclusão`
- `📡 Enviando webhook com dados de conclusão...`
- `✅ Webhook enviado com sucesso`

### 4. Check Session Status (Optional)
If you want to check the status of the automation:

```bash
curl http://localhost:3000/session-status/automation_1234567890_abc123
```

Replace `automation_1234567890_abc123` with the actual session_id from step 2.

## Detailed Testing Scenarios

### Scenario 1: Successful Automation
**Test**: Normal flow with valid GBP URL

**Steps**:
1. Send POST request with a valid Google Business Profile URL
2. Verify immediate 200 response
3. Wait for automation to complete
4. Check logs for button click
5. Check logs for webhook send
6. Verify webhook received data at n8n endpoint

**Expected Results**:
- Immediate 200 response
- Button clicked successfully
- Webhook sent with complete data
- Browser auto-closes after completion

### Scenario 2: Button Not Found
**Test**: What happens if the button selector doesn't exist

**Steps**:
1. Temporarily modify the button selector to something invalid
2. Run automation
3. Check logs

**Expected Results**:
- Automation continues despite button not found
- Log shows: `⚠️ Não foi possível clicar no botão após conclusão`
- Webhook still sent
- No crash or error

### Scenario 3: Webhook Failure
**Test**: What happens if webhook URL is unreachable

**Steps**:
1. Temporarily modify webhook URL to invalid endpoint
2. Run automation
3. Check logs

**Expected Results**:
- Automation continues despite webhook failure
- Log shows: `❌ Erro ao enviar webhook`
- `responseData.data.webhook_sent = false`
- Browser still auto-closes

### Scenario 4: Timeout
**Test**: Automation times out before completion

**Steps**:
1. Send request with very short `wait_time` (e.g., 10 seconds)
2. Use a slow-loading URL
3. Check logs

**Expected Results**:
- Immediate 200 response
- Automation times out
- No button click (only happens on completion)
- No webhook sent (only happens on completion)
- Session status shows 'timeout'

### Scenario 5: Invalid URL
**Test**: Request with invalid URL

**Steps**:
```bash
curl -X POST http://localhost:3000/automate \
  -H "Content-Type: application/json" \
  -d '{
    "url": "not-a-valid-url"
  }'
```

**Expected Results**:
- Immediate 400 response
- Error message: "URL inválida"
- No automation started

## Webhook Payload Verification

The webhook should receive a JSON payload with this structure:

```json
{
  "success": true,
  "session_id": "automation_xxxxx",
  "message": "Automação GBP Check concluída com sucesso",
  "data": {
    "initial_url": "https://...",
    "final_url": "https://app.gbpcheck.com/extension/healthcheck",
    "screenshot_url": "/screenshots/screenshot-2024-01-01.png",
    "button_clicked": true,
    "process_completed": true,
    "completion_method": "primary_url",
    "gbp_check_data": {
      "health_check_data": [...],
      "user_info": {...},
      "place_data": {...}
    },
    "api_data": {
      "intercepted_requests": 5,
      "gbp_check_data": {...},
      "raw_api_calls": [...]
    },
    "downloads": {
      "count": 0,
      "files": []
    },
    "webhook_sent": true
  }
}
```

## Debugging Tips

### Check if Button Selector is Correct
1. Open the completion page manually in browser
2. Open DevTools (F12)
3. Run in console:
```javascript
document.querySelector('#actions-main-header-button-dropdown > a:nth-child(3) > i')
```
4. Should return the element or null

### Check Webhook Endpoint
Test the webhook endpoint directly:
```bash
curl -X POST https://ample-n8n.i9msbj.easypanel.host/webhook/f024ef22-70b6-4374-829e-e1ba5c22474d \
  -H "Content-Type: application/json" \
  -d '{"test": "data"}'
```

### View Screenshots
Screenshots are saved in `data/screenshots/` directory. You can view them to see what the automation saw.

### Check Session Data
```bash
curl http://localhost:3000/session-status/SESSION_ID
```

## Common Issues

### Issue: "Button not found"
**Cause**: Button selector might be wrong or page not fully loaded
**Solution**: 
- Verify selector in browser DevTools
- Increase wait time before clicking (currently 2 seconds)

### Issue: "Webhook timeout"
**Cause**: Webhook endpoint not responding
**Solution**:
- Check if n8n is running
- Verify webhook URL is correct
- Check network connectivity

### Issue: "Page closed during automation"
**Cause**: Browser closed manually or crashed
**Solution**:
- Check logs for crash details
- Ensure sufficient system resources
- Check if headless mode works better

## Performance Monitoring

Monitor these metrics:
- **Response Time**: Should be < 100ms for initial response
- **Total Automation Time**: Varies by URL, typically 30-120 seconds
- **Button Click Time**: Should be < 5 seconds after completion
- **Webhook Send Time**: Should be < 2 seconds

## Log Levels

The logs use these emoji indicators:
- `✅` Success
- `⚠️` Warning (non-critical)
- `❌` Error (critical)
- `🖱️` Button action
- `📡` Webhook action
- `🔍` Monitoring
- `🔒` Auto-close action

## Next Steps

After successful testing:
1. Monitor production logs for any issues
2. Set up alerts for webhook failures
3. Consider adding retry logic for webhook if needed
4. Consider making button selector and webhook URL configurable

