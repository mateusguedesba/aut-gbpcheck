# Queue System Quick Reference

## 🚀 Quick Start

### Start Service
```bash
npm start
```

### Submit Job
```bash
curl -X POST http://localhost:3000/automate \
  -H "Content-Type: application/json" \
  -d '{"url": "https://www.google.com/search?q=business"}'
```

### Check Queue Status
```bash
curl http://localhost:3000/queue-status | jq
```

### Check Job Position
```bash
curl http://localhost:3000/queue-position/automation_xxxxx | jq
```

---

## 📋 API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/automate` | POST | Submit automation job |
| `/queue-status` | GET | View queue status |
| `/queue-position/:sessionId` | GET | Check specific job |

---

## 📊 Response Codes

| Code | Meaning | Action |
|------|---------|--------|
| 200 | Job accepted | Track with session_id |
| 400 | Invalid request | Fix URL/parameters |
| 503 | Queue full | Retry in a few minutes |
| 500 | Server error | Check logs |

---

## 🎯 Response Format

### Job Accepted (200)
```json
{
  "success": true,
  "session_id": "automation_xxxxx",
  "message": "Automação adicionada à fila",
  "status": "queued",
  "queue_position": 3,
  "queue_size": 3,
  "estimated_wait_seconds": 180
}
```

### Queue Full (503)
```json
{
  "success": false,
  "error": "Queue is full",
  "message": "O sistema está processando o número máximo de requisições...",
  "queue_size": 10,
  "max_queue_size": 10
}
```

---

## 📈 Job States

| State | Description |
|-------|-------------|
| `queued` | Waiting in queue |
| `processing` | Currently running |
| `completed` | Successfully finished |
| `failed` | Error occurred |
| `timeout` | Wait time exceeded |

---

## ⚙️ Configuration

### Queue Size (server.js)
```javascript
const automationQueue = new AutomationQueue(10); // Max 10 jobs
```

### Job Parameters
```json
{
  "url": "https://...",           // Required
  "wait_time": 300,               // Optional, default: 300s
  "headless": false,              // Optional, default: false
  "button_selectors": []          // Optional
}
```

---

## 🔍 Monitoring Commands

### Watch Queue in Real-Time
```bash
watch -n 2 'curl -s http://localhost:3000/queue-status | jq ".queue | {isProcessing, queueSize, currentJob: .currentJob.sessionId}"'
```

### Monitor Logs
```bash
# Windows PowerShell
Get-Content data\app.log -Wait -Tail 50 | Select-String "queue"

# Linux/Mac
tail -f data/app.log | grep -i queue
```

### Check Current Job
```bash
curl -s http://localhost:3000/queue-status | jq '.queue.currentJob'
```

### View Queued Jobs
```bash
curl -s http://localhost:3000/queue-status | jq '.queue.queuedJobs'
```

### Recent Completions
```bash
curl -s http://localhost:3000/queue-status | jq '.queue.recentCompletedJobs'
```

---

## 🧪 Testing Commands

### Single Job
```bash
curl -X POST http://localhost:3000/automate \
  -H "Content-Type: application/json" \
  -d '{"url": "https://www.google.com/search?q=test"}'
```

### Multiple Jobs (Queue Test)
```bash
for i in {1..5}; do
  curl -X POST http://localhost:3000/automate \
    -H "Content-Type: application/json" \
    -d "{\"url\": \"https://www.google.com/search?q=test$i\"}"
done
```

### Queue Full Test
```bash
for i in {1..15}; do
  curl -X POST http://localhost:3000/automate \
    -H "Content-Type: application/json" \
    -d "{\"url\": \"https://www.google.com/search?q=test$i\"}"
done
```

---

## 📊 Key Metrics

| Metric | Normal | Alert |
|--------|--------|-------|
| Queue Size | 0-5 | >8 |
| Avg Completion | 60-180s | >300s |
| Throughput | 20-30/hr | <10/hr |
| Failure Rate | <5% | >10% |

---

## 🐛 Troubleshooting

### Queue Not Processing
```bash
# Check current job
curl http://localhost:3000/queue-status | jq '.queue.currentJob'

# Check logs
tail -100 data/app.log | grep ERROR
```

### Queue Fills Up
```bash
# Check queue size
curl http://localhost:3000/queue-status | jq '.queue | {queueSize, maxSize}'

# Solutions:
# 1. Increase queue size in server.js
# 2. Reduce wait_time for jobs
# 3. Check for stuck jobs
```

### Inaccurate Wait Times
```bash
# Check completion samples
curl http://localhost:3000/queue-status | jq '.queue | {averageCompletionTimeSeconds, recentCompletions: [.recentCompletedJobs[0:5]]}'

# Wait for more jobs to complete (10+ jobs)
```

---

## 💡 Best Practices

### Client Implementation
```javascript
async function submitJob(url) {
  const response = await fetch('/automate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url })
  });
  
  if (response.status === 503) {
    // Queue full - implement retry logic
    return handleQueueFull();
  }
  
  const data = await response.json();
  
  // Show queue info to user
  if (data.queue_position > 1) {
    showQueueInfo(data.queue_position, data.estimated_wait_seconds);
  }
  
  return data.session_id;
}
```

### Retry Logic
```javascript
async function submitWithRetry(url, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    const response = await fetch('/automate', {
      method: 'POST',
      body: JSON.stringify({ url }),
      headers: { 'Content-Type': 'application/json' }
    });
    
    if (response.status === 503) {
      const waitTime = Math.pow(2, i) * 60000; // 1min, 2min, 4min
      await new Promise(resolve => setTimeout(resolve, waitTime));
      continue;
    }
    
    return response.json();
  }
  
  throw new Error('Queue is consistently full');
}
```

### Status Polling
```javascript
async function pollJobStatus(sessionId) {
  const interval = setInterval(async () => {
    const response = await fetch(`/queue-position/${sessionId}`);
    const data = await response.json();
    
    if (data.status === 'completed' || data.status === 'failed') {
      clearInterval(interval);
      handleJobComplete(data);
    } else {
      updateUI(data.position, data.estimatedWaitSeconds);
    }
  }, 5000); // Poll every 5 seconds
}
```

---

## 📚 Documentation Files

| File | Purpose |
|------|---------|
| `QUEUE_SYSTEM.md` | Complete documentation |
| `QUEUE_FLOW_DIAGRAM.md` | Visual diagrams |
| `QUEUE_TESTING_GUIDE.md` | Testing scenarios |
| `QUEUE_IMPLEMENTATION_SUMMARY.md` | Implementation details |
| `QUEUE_QUICK_REFERENCE.md` | This file |

---

## 🎓 Common Scenarios

### Scenario 1: Submit and Track
```bash
# Submit job
SESSION_ID=$(curl -s -X POST http://localhost:3000/automate \
  -H "Content-Type: application/json" \
  -d '{"url": "https://www.google.com/search?q=test"}' \
  | jq -r '.session_id')

# Track position
watch -n 5 "curl -s http://localhost:3000/queue-position/$SESSION_ID | jq"
```

### Scenario 2: Monitor Queue
```bash
# Terminal 1: Watch queue
watch -n 2 'curl -s http://localhost:3000/queue-status | jq ".queue | {isProcessing, queueSize}"'

# Terminal 2: Submit jobs
for i in {1..3}; do
  curl -X POST http://localhost:3000/automate \
    -H "Content-Type: application/json" \
    -d "{\"url\": \"https://www.google.com/search?q=test$i\"}"
done
```

### Scenario 3: Check Performance
```bash
# Get average completion time
curl -s http://localhost:3000/queue-status | jq '.queue.averageCompletionTimeSeconds'

# Get recent completions
curl -s http://localhost:3000/queue-status | jq '.queue.recentCompletedJobs[] | {sessionId, duration: (.duration/1000), status}'
```

---

## ⚡ Performance Tips

1. **Use headless mode** for better performance:
   ```json
   {"url": "...", "headless": true}
   ```

2. **Reduce wait_time** if possible:
   ```json
   {"url": "...", "wait_time": 60}
   ```

3. **Monitor queue size** and adjust capacity:
   ```javascript
   const automationQueue = new AutomationQueue(15); // Increase if needed
   ```

4. **Check average completion time** regularly:
   ```bash
   curl -s http://localhost:3000/queue-status | jq '.queue.averageCompletionTimeSeconds'
   ```

---

## 🔗 Related Endpoints

| Endpoint | Purpose |
|----------|---------|
| `/health` | Service health check |
| `/diagnose` | System diagnostics |
| `/screenshots` | List screenshots |
| `/api-data` | View intercepted data |

---

## 📞 Support

### Check Logs
```bash
# View recent logs
tail -100 data/app.log

# Search for errors
grep ERROR data/app.log

# Search for specific session
grep "automation_xxxxx" data/app.log
```

### Restart Service
```bash
# Stop service (Ctrl+C)
# Start again
npm start
```

### Clear Queue (Emergency)
```bash
# Restart service to clear queue
# All queued jobs will be lost
```

---

## ✅ Health Check

### Quick Health Check
```bash
# Check if service is running
curl http://localhost:3000/health

# Check queue status
curl http://localhost:3000/queue-status | jq '.queue | {isProcessing, queueSize}'

# Check recent errors
tail -50 data/app.log | grep ERROR
```

### Expected Healthy State
- Service responds to `/health`
- Queue size < 10
- No stuck jobs (same job processing >10 min)
- Recent completions visible
- No repeated errors in logs

---

## 🎯 Quick Wins

### Display Queue Info to Users
```javascript
if (data.queue_position > 1) {
  const minutes = Math.ceil(data.estimated_wait_seconds / 60);
  alert(`Você está na posição ${data.queue_position}. Tempo estimado: ${minutes} minutos.`);
}
```

### Handle Queue Full Gracefully
```javascript
if (response.status === 503) {
  alert('Sistema ocupado no momento. Por favor, tente novamente em alguns minutos.');
  // Optionally: auto-retry after delay
}
```

### Show Processing Status
```javascript
async function showStatus(sessionId) {
  const data = await fetch(`/queue-position/${sessionId}`).then(r => r.json());
  
  if (data.status === 'queued') {
    return `Aguardando... Posição ${data.position}`;
  } else if (data.status === 'processing') {
    return 'Processando...';
  } else {
    return `Concluído: ${data.status}`;
  }
}
```

