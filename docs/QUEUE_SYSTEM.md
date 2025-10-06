# Automation Queue System Documentation

## Overview

The automation service now includes a comprehensive queue system that processes automation requests sequentially, preventing multiple browser instances from running simultaneously. This ensures optimal resource usage and prevents conflicts with the Chrome extension.

## Key Features

### 1. Sequential Processing
- Only one automation runs at a time
- Subsequent requests wait in queue
- Automatic processing of next job when current completes

### 2. Immediate Response
- All requests receive immediate HTTP 200 response
- Response includes queue position and estimated wait time
- No client timeout issues

### 3. Queue Management
- Maximum queue size: 10 jobs (configurable)
- Automatic rejection when queue is full (503 status)
- FIFO (First In, First Out) processing order

### 4. Smart Wait Time Estimation
- Tracks average completion time of recent jobs
- Calculates estimated wait based on queue position
- Updates estimates as jobs complete

### 5. Comprehensive Status Tracking
- Real-time queue status endpoint
- Individual job position tracking
- History of completed jobs

## API Endpoints

### POST /automate
Submit a new automation request.

**Request Body:**
```json
{
  "url": "https://www.google.com/search?q=business",
  "wait_time": 300,
  "headless": false,
  "button_selectors": []
}
```

**Response (Immediate):**

**Case 1: Job starts immediately (queue empty)**
```json
{
  "success": true,
  "session_id": "automation_1234567890_abc123",
  "message": "Automação iniciada imediatamente",
  "status": "processing",
  "queue_position": 1,
  "queue_size": 0,
  "estimated_wait_seconds": 0
}
```

**Case 2: Job added to queue**
```json
{
  "success": true,
  "session_id": "automation_1234567890_abc123",
  "message": "Automação adicionada à fila",
  "status": "queued",
  "queue_position": 3,
  "queue_size": 3,
  "estimated_wait_seconds": 240
}
```

**Case 3: Queue is full (503 error)**
```json
{
  "success": false,
  "error": "Queue is full",
  "message": "O sistema está processando o número máximo de requisições. Tente novamente em alguns minutos.",
  "queue_size": 10,
  "max_queue_size": 10
}
```

### GET /queue-status
Get current queue status and statistics.

**Response:**
```json
{
  "success": true,
  "timestamp": "2024-01-01T12:00:00.000Z",
  "queue": {
    "isProcessing": true,
    "currentJob": {
      "sessionId": "automation_1234567890_abc123",
      "url": "https://www.google.com/search?q=business",
      "status": "processing",
      "startedAt": 1704110400000,
      "elapsedSeconds": 45
    },
    "queueSize": 2,
    "maxSize": 10,
    "queuedJobs": [
      {
        "sessionId": "automation_1234567891_def456",
        "url": "https://www.google.com/search?q=another",
        "position": 1,
        "status": "queued",
        "addedAt": 1704110445000,
        "waitingSeconds": 15,
        "estimatedWaitSeconds": 75
      },
      {
        "sessionId": "automation_1234567892_ghi789",
        "url": "https://www.google.com/search?q=third",
        "position": 2,
        "status": "queued",
        "addedAt": 1704110450000,
        "waitingSeconds": 10,
        "estimatedWaitSeconds": 195
      }
    ],
    "recentCompletedJobs": [
      {
        "sessionId": "automation_1234567889_xyz999",
        "status": "completed",
        "duration": 125000,
        "completedAt": 1704110395000
      }
    ],
    "averageCompletionTimeSeconds": 120
  }
}
```

### GET /queue-position/:sessionId
Get specific job's position in queue.

**Response:**

**Case 1: Job is currently processing**
```json
{
  "success": true,
  "sessionId": "automation_1234567890_abc123",
  "status": "processing",
  "position": 0,
  "estimatedWaitSeconds": 0
}
```

**Case 2: Job is queued**
```json
{
  "success": true,
  "sessionId": "automation_1234567891_def456",
  "status": "queued",
  "position": 2,
  "estimatedWaitSeconds": 180
}
```

**Case 3: Job completed**
```json
{
  "success": true,
  "sessionId": "automation_1234567889_xyz999",
  "status": "completed",
  "position": -1,
  "estimatedWaitSeconds": 0
}
```

**Case 4: Job not found**
```json
{
  "success": false,
  "error": "Job not found in queue or history"
}
```

## Queue Behavior

### Job Lifecycle

```
1. SUBMITTED → Request received at /automate
   ↓
2. VALIDATED → URL and parameters validated
   ↓
3. QUEUED → Added to queue, immediate response sent
   ↓
4. PROCESSING → Job starts when it reaches front of queue
   ↓
5. COMPLETED/FAILED/TIMEOUT → Job finishes, next job starts
   ↓
6. HISTORY → Moved to completed jobs history
```

### Completion Criteria

A job is considered finished and removed from processing when:

1. **Success**: Automation reaches completion URL and all post-completion actions finish
   - Button click completed
   - Webhook sent
   - Browser auto-closed

2. **Timeout**: Wait time exceeded without reaching completion URL

3. **Error**: Fatal error occurs during automation
   - Browser setup failure
   - Navigation error
   - Unexpected crash

4. **Manual Close**: Browser closed manually by user

### Queue Processing Rules

1. **FIFO Order**: Jobs processed in order they were added
2. **No Preemption**: Running job cannot be interrupted
3. **Automatic Start**: Next job starts immediately when current finishes
4. **No Gaps**: Queue processes continuously until empty

## Configuration

### Queue Settings

Located in `server.js`:

```javascript
const automationQueue = new AutomationQueue(10); // Max 10 jobs
```

**Configurable Parameters:**
- `maxSize`: Maximum number of jobs in queue (default: 10)
- `maxCompletedHistory`: Number of completed jobs to keep (default: 50)
- `maxCompletionSamples`: Number of samples for average calculation (default: 10)

### Environment Variables

No new environment variables required. Existing variables still work:
- `DISABLE_AUTO_CLOSE`: Disable browser auto-close
- `CLOUDFLARE_TUNNEL`: Adjust response wait times
- `DEBUG_API_DATA`: Include detailed API data

## Monitoring & Logging

### Log Events

The queue system logs these events:

**Queue Operations:**
- `Job added to queue` - New job added
- `Starting job from queue` - Job begins processing
- `Job completed successfully` - Job finished successfully
- `Job failed` - Job encountered error
- `Queue is empty` - No more jobs to process
- `Queue is full, rejecting new request` - Queue at capacity

**Queue Status:**
- `Updated average completion time` - Completion time statistics updated
- `Processing next job in queue` - Moving to next job

### Monitoring Endpoints

**Real-time Monitoring:**
```bash
# Watch queue status
watch -n 5 'curl -s http://localhost:3000/queue-status | jq'

# Check specific job
curl http://localhost:3000/queue-position/automation_xxxxx
```

**Log Monitoring:**
```bash
# Watch logs for queue events
tail -f data/app.log | grep -i queue
```

## Performance Considerations

### Resource Usage

**Single Job Processing:**
- Memory: ~500MB per browser instance
- CPU: Moderate during page load, low during monitoring
- Network: Depends on target website

**Queue Benefits:**
- Prevents memory exhaustion from multiple browsers
- Avoids Chrome extension conflicts
- Ensures stable performance
- Predictable resource usage

### Throughput

**Typical Throughput:**
- Average job duration: 2 minutes
- Throughput: ~30 jobs/hour
- Queue capacity: 10 jobs
- Maximum wait time: ~20 minutes (full queue)

**Optimization Tips:**
1. Reduce `wait_time` for faster completions
2. Use `headless: true` for better performance
3. Monitor average completion time
4. Adjust queue size based on server capacity

## Error Handling

### Queue Full (503)

**When it happens:**
- 10 jobs already in queue
- New request arrives

**Client should:**
- Wait and retry after a few minutes
- Implement exponential backoff
- Show user-friendly message

**Example retry logic:**
```javascript
async function submitWithRetry(url, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    const response = await fetch('/automate', {
      method: 'POST',
      body: JSON.stringify({ url }),
      headers: { 'Content-Type': 'application/json' }
    });
    
    if (response.status === 503) {
      // Queue full, wait and retry
      const waitTime = Math.pow(2, i) * 60000; // 1min, 2min, 4min
      await new Promise(resolve => setTimeout(resolve, waitTime));
      continue;
    }
    
    return response.json();
  }
  
  throw new Error('Queue is consistently full');
}
```

### Job Failures

**Handled gracefully:**
- Job marked as failed
- Error logged
- Next job starts automatically
- No queue disruption

## Testing

### Test Scenarios

**1. Single Job**
```bash
curl -X POST http://localhost:3000/automate \
  -H "Content-Type: application/json" \
  -d '{"url": "https://www.google.com/search?q=test"}'
```

**2. Multiple Jobs (Queue)**
```bash
# Submit 3 jobs quickly
for i in {1..3}; do
  curl -X POST http://localhost:3000/automate \
    -H "Content-Type: application/json" \
    -d "{\"url\": \"https://www.google.com/search?q=test$i\"}" &
done
wait

# Check queue status
curl http://localhost:3000/queue-status | jq
```

**3. Queue Full Test**
```bash
# Submit 15 jobs (more than max)
for i in {1..15}; do
  curl -X POST http://localhost:3000/automate \
    -H "Content-Type: application/json" \
    -d "{\"url\": \"https://www.google.com/search?q=test$i\"}"
  echo ""
done
```

**4. Position Tracking**
```bash
# Submit job and track position
SESSION_ID=$(curl -X POST http://localhost:3000/automate \
  -H "Content-Type: application/json" \
  -d '{"url": "https://www.google.com/search?q=test"}' | jq -r '.session_id')

# Poll position
watch -n 5 "curl -s http://localhost:3000/queue-position/$SESSION_ID | jq"
```

## Migration Notes

### Changes from Previous Version

**Before (No Queue):**
- Multiple automations could run simultaneously
- Resource conflicts possible
- No request limiting

**After (With Queue):**
- Sequential processing
- Resource-efficient
- Built-in rate limiting
- Better error isolation

### Backward Compatibility

✅ **Fully Compatible:**
- All existing endpoints work
- Same request/response format (with additions)
- No breaking changes
- Additional fields in response (queue info)

### Client Updates Recommended

**Optional enhancements:**
1. Display queue position to users
2. Show estimated wait time
3. Handle 503 errors gracefully
4. Poll queue position for updates

## Troubleshooting

### Issue: Jobs stuck in queue

**Symptoms:**
- Queue size not decreasing
- Current job running too long

**Solutions:**
1. Check logs for errors
2. Verify browser didn't crash
3. Check if completion URL is reachable
4. Restart service if needed

### Issue: Queue fills up quickly

**Symptoms:**
- Frequent 503 errors
- Long wait times

**Solutions:**
1. Increase queue size
2. Reduce wait_time for jobs
3. Optimize automation flow
4. Add more server capacity

### Issue: Inaccurate wait time estimates

**Symptoms:**
- Estimated time very different from actual

**Causes:**
- Not enough completion samples
- High variance in job durations

**Solutions:**
- Wait for more jobs to complete
- Check for outlier jobs
- Consider different wait_time values

