# Queue System Testing Guide

## Quick Start Testing

### 1. Start the Service
```bash
npm start
```

### 2. Test Single Job (No Queue)
```bash
curl -X POST http://localhost:3000/automate \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://www.google.com/search?q=test-business",
    "wait_time": 60,
    "headless": false
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "session_id": "automation_xxxxx",
  "message": "Automação iniciada imediatamente",
  "status": "processing",
  "queue_position": 1,
  "queue_size": 0,
  "estimated_wait_seconds": 0
}
```

### 3. Test Queue with Multiple Jobs
```bash
# Submit 3 jobs in quick succession
for i in {1..3}; do
  curl -X POST http://localhost:3000/automate \
    -H "Content-Type: application/json" \
    -d "{\"url\": \"https://www.google.com/search?q=test-$i\", \"wait_time\": 60}" &
done
wait
```

**Expected Responses:**
- Job 1: `queue_position: 1`, `status: "processing"`
- Job 2: `queue_position: 2`, `status: "queued"`
- Job 3: `queue_position: 3`, `status: "queued"`

### 4. Check Queue Status
```bash
curl http://localhost:3000/queue-status | jq
```

## Comprehensive Test Scenarios

### Scenario 1: Sequential Processing

**Objective:** Verify jobs process one at a time

**Steps:**
```bash
# Terminal 1: Monitor queue status
watch -n 2 'curl -s http://localhost:3000/queue-status | jq ".queue | {isProcessing, queueSize, currentJob: .currentJob.sessionId}"'

# Terminal 2: Submit 3 jobs
for i in {1..3}; do
  echo "Submitting job $i"
  curl -X POST http://localhost:3000/automate \
    -H "Content-Type: application/json" \
    -d "{\"url\": \"https://www.google.com/search?q=test-$i\", \"wait_time\": 30}"
  echo ""
  sleep 2
done
```

**Expected Behavior:**
1. First job starts immediately
2. Second and third jobs wait in queue
3. Jobs process sequentially
4. Queue size decreases as jobs complete

**Verification:**
- Only one job shows `isProcessing: true` at a time
- `queueSize` decreases from 2 → 1 → 0
- Each job completes before next starts

---

### Scenario 2: Queue Full Rejection

**Objective:** Verify 503 error when queue is full

**Steps:**
```bash
# Submit 15 jobs (more than max of 10)
for i in {1..15}; do
  echo "=== Job $i ==="
  curl -X POST http://localhost:3000/automate \
    -H "Content-Type: application/json" \
    -d "{\"url\": \"https://www.google.com/search?q=test-$i\", \"wait_time\": 120}"
  echo ""
done
```

**Expected Results:**
- Jobs 1-10: HTTP 200, accepted
- Jobs 11-15: HTTP 503, rejected with "Queue is full"

**Verification:**
```bash
# Check queue status
curl http://localhost:3000/queue-status | jq '.queue | {queueSize, maxSize}'
```
Should show: `queueSize: 10, maxSize: 10`

---

### Scenario 3: Wait Time Estimation

**Objective:** Verify estimated wait times are reasonable

**Steps:**
```bash
# Submit 5 jobs and capture session IDs
for i in {1..5}; do
  SESSION_ID=$(curl -s -X POST http://localhost:3000/automate \
    -H "Content-Type: application/json" \
    -d "{\"url\": \"https://www.google.com/search?q=test-$i\", \"wait_time\": 60}" \
    | jq -r '.session_id')
  
  echo "Job $i: $SESSION_ID"
  
  # Get position and estimated wait
  curl -s http://localhost:3000/queue-position/$SESSION_ID | jq '{position, estimatedWaitSeconds}'
  echo ""
done
```

**Expected Pattern:**
- Job 1: position=1, wait=0s (processing)
- Job 2: position=2, wait≈120s
- Job 3: position=3, wait≈240s
- Job 4: position=4, wait≈360s
- Job 5: position=5, wait≈480s

**Verification:**
- Wait times increase linearly with position
- Estimates update as jobs complete

---

### Scenario 4: Job Position Tracking

**Objective:** Track a job's position as it moves through queue

**Steps:**
```bash
# Submit a job and save session ID
SESSION_ID=$(curl -s -X POST http://localhost:3000/automate \
  -H "Content-Type: application/json" \
  -d '{"url": "https://www.google.com/search?q=tracked-job", "wait_time": 60}' \
  | jq -r '.session_id')

echo "Tracking job: $SESSION_ID"

# Poll position every 5 seconds
while true; do
  POSITION=$(curl -s http://localhost:3000/queue-position/$SESSION_ID)
  echo "$(date +%H:%M:%S) - $POSITION"
  
  STATUS=$(echo $POSITION | jq -r '.status')
  if [ "$STATUS" = "completed" ] || [ "$STATUS" = "failed" ]; then
    echo "Job finished with status: $STATUS"
    break
  fi
  
  sleep 5
done
```

**Expected Output:**
```
10:00:00 - {"status":"queued","position":3,"estimatedWaitSeconds":240}
10:02:00 - {"status":"queued","position":2,"estimatedWaitSeconds":120}
10:04:00 - {"status":"processing","position":0,"estimatedWaitSeconds":0}
10:06:00 - {"status":"completed","position":-1,"estimatedWaitSeconds":0}
Job finished with status: completed
```

---

### Scenario 5: Error Recovery

**Objective:** Verify queue continues after job failure

**Steps:**
```bash
# Submit job with invalid URL (will fail)
curl -X POST http://localhost:3000/automate \
  -H "Content-Type: application/json" \
  -d '{"url": "https://invalid-url-that-will-fail.com", "wait_time": 30}'

# Submit valid job immediately after
curl -X POST http://localhost:3000/automate \
  -H "Content-Type: application/json" \
  -d '{"url": "https://www.google.com/search?q=valid-job", "wait_time": 60}'

# Monitor queue
watch -n 2 'curl -s http://localhost:3000/queue-status | jq ".queue | {isProcessing, queueSize}"'
```

**Expected Behavior:**
1. First job fails (invalid URL)
2. Queue automatically processes second job
3. No manual intervention needed
4. Queue continues normally

**Verification:**
- Check logs for error handling
- Second job completes successfully
- Queue doesn't get stuck

---

### Scenario 6: Concurrent Submissions

**Objective:** Test thread-safety with simultaneous requests

**Steps:**
```bash
# Submit 10 jobs simultaneously
for i in {1..10}; do
  (curl -X POST http://localhost:3000/automate \
    -H "Content-Type: application/json" \
    -d "{\"url\": \"https://www.google.com/search?q=concurrent-$i\", \"wait_time\": 30}" \
    > /tmp/response_$i.json) &
done
wait

# Check all responses
for i in {1..10}; do
  echo "=== Job $i ==="
  cat /tmp/response_$i.json | jq '{success, queue_position, status}'
done

# Verify queue integrity
curl http://localhost:3000/queue-status | jq '.queue | {queueSize, maxSize}'
```

**Expected Results:**
- All 10 jobs accepted (HTTP 200)
- Unique queue positions (1-10)
- No duplicate positions
- Queue size = 10

---

### Scenario 7: Average Completion Time Tracking

**Objective:** Verify completion time tracking updates correctly

**Steps:**
```bash
# Submit several jobs with different wait times
curl -X POST http://localhost:3000/automate \
  -H "Content-Type: application/json" \
  -d '{"url": "https://www.google.com/search?q=job1", "wait_time": 30}'

sleep 35

curl -X POST http://localhost:3000/automate \
  -H "Content-Type: application/json" \
  -d '{"url": "https://www.google.com/search?q=job2", "wait_time": 60}'

sleep 65

curl -X POST http://localhost:3000/automate \
  -H "Content-Type: application/json" \
  -d '{"url": "https://www.google.com/search?q=job3", "wait_time": 45}'

# Check average completion time
curl http://localhost:3000/queue-status | jq '.queue.averageCompletionTimeSeconds'
```

**Expected Behavior:**
- Average updates after each completion
- Reflects recent job durations
- Used for wait time estimates

---

### Scenario 8: Queue Status Monitoring

**Objective:** Verify queue status endpoint provides accurate data

**Steps:**
```bash
# Submit multiple jobs
for i in {1..5}; do
  curl -X POST http://localhost:3000/automate \
    -H "Content-Type: application/json" \
    -d "{\"url\": \"https://www.google.com/search?q=monitor-$i\", \"wait_time\": 45}"
done

# Get detailed queue status
curl http://localhost:3000/queue-status | jq
```

**Verify Response Contains:**
- `isProcessing`: boolean
- `currentJob`: object with session_id, url, elapsed time
- `queueSize`: number
- `queuedJobs`: array with position, waiting time, estimated wait
- `recentCompletedJobs`: array of recent completions
- `averageCompletionTimeSeconds`: number

---

## Performance Testing

### Load Test: Maximum Throughput

```bash
#!/bin/bash
# Submit jobs continuously and measure throughput

START_TIME=$(date +%s)
TOTAL_JOBS=20

for i in $(seq 1 $TOTAL_JOBS); do
  curl -X POST http://localhost:3000/automate \
    -H "Content-Type: application/json" \
    -d "{\"url\": \"https://www.google.com/search?q=load-test-$i\", \"wait_time\": 30}" \
    > /dev/null 2>&1
  
  echo "Submitted job $i/$TOTAL_JOBS"
  sleep 1
done

echo "All jobs submitted. Waiting for completion..."

# Wait for queue to empty
while true; do
  QUEUE_SIZE=$(curl -s http://localhost:3000/queue-status | jq '.queue.queueSize')
  IS_PROCESSING=$(curl -s http://localhost:3000/queue-status | jq '.queue.isProcessing')
  
  if [ "$QUEUE_SIZE" = "0" ] && [ "$IS_PROCESSING" = "false" ]; then
    break
  fi
  
  echo "Queue size: $QUEUE_SIZE, Processing: $IS_PROCESSING"
  sleep 10
done

END_TIME=$(date +%s)
DURATION=$((END_TIME - START_TIME))

echo "=== Performance Results ==="
echo "Total jobs: $TOTAL_JOBS"
echo "Total time: $DURATION seconds"
echo "Average time per job: $((DURATION / TOTAL_JOBS)) seconds"
echo "Throughput: $(echo "scale=2; $TOTAL_JOBS / ($DURATION / 60)" | bc) jobs/minute"
```

---

## Debugging Commands

### View Current Queue State
```bash
curl -s http://localhost:3000/queue-status | jq '.queue | {
  isProcessing,
  queueSize,
  currentJob: .currentJob.sessionId,
  queuedJobs: [.queuedJobs[] | {sessionId, position, waitingSeconds}]
}'
```

### Check Specific Job
```bash
SESSION_ID="automation_xxxxx"
curl -s http://localhost:3000/queue-position/$SESSION_ID | jq
```

### Monitor Queue in Real-Time
```bash
watch -n 2 'curl -s http://localhost:3000/queue-status | jq ".queue | {
  status: (if .isProcessing then \"PROCESSING\" else \"IDLE\" end),
  current: .currentJob.sessionId,
  queued: .queueSize,
  avgTime: .averageCompletionTimeSeconds
}"'
```

### View Recent Completions
```bash
curl -s http://localhost:3000/queue-status | jq '.queue.recentCompletedJobs[] | {
  sessionId,
  status,
  durationSeconds: (.duration / 1000)
}'
```

### Check Logs for Queue Events
```bash
# Windows PowerShell
Get-Content data\app.log -Wait -Tail 50 | Select-String -Pattern "queue|Queue"

# Linux/Mac
tail -f data/app.log | grep -i queue
```

---

## Expected Metrics

### Normal Operation
- **Queue Size**: 0-5 jobs typically
- **Average Completion Time**: 60-180 seconds
- **Wait Time Accuracy**: ±20% of estimate
- **Throughput**: 20-30 jobs/hour

### Under Load
- **Queue Size**: 5-10 jobs
- **Average Completion Time**: May increase slightly
- **Wait Time**: Up to 20 minutes (full queue)
- **Rejection Rate**: <5% (503 errors)

---

## Troubleshooting

### Issue: Queue Not Processing
```bash
# Check if queue is stuck
curl -s http://localhost:3000/queue-status | jq '.queue | {
  isProcessing,
  queueSize,
  currentJobElapsed: .currentJob.elapsedSeconds
}'

# If currentJobElapsed is very high, job may be stuck
# Check logs for errors
tail -100 data/app.log | grep ERROR
```

### Issue: Inaccurate Wait Times
```bash
# Check completion time samples
curl -s http://localhost:3000/queue-status | jq '.queue | {
  averageCompletionTimeSeconds,
  recentCompletions: [.recentCompletedJobs[0:5] | .[] | .duration / 1000]
}'

# Wait times improve after more jobs complete
```

### Issue: Jobs Failing Frequently
```bash
# Check recent failures
curl -s http://localhost:3000/queue-status | jq '.queue.recentCompletedJobs[] | select(.status == "failed")'

# Check error logs
grep -A 5 "Job failed" data/app.log
```

---

## Success Criteria

✅ **Queue System Working Correctly If:**
1. Jobs process sequentially (one at a time)
2. Queue accepts up to 10 jobs
3. 11th job receives 503 error
4. Wait time estimates are reasonable
5. Queue continues after job failures
6. No race conditions with concurrent submissions
7. Average completion time updates correctly
8. Queue status endpoint returns accurate data
9. Jobs complete successfully
10. Browser auto-closes after each job

