# Queue System Flow Diagrams

## High-Level Queue Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                      AUTOMATION QUEUE                            │
│                                                                  │
│  ┌────────────────┐  ┌──────────────┐  ┌──────────────┐       │
│  │  Current Job   │  │  Job Queue   │  │   History    │       │
│  │  (Processing)  │  │  (Waiting)   │  │ (Completed)  │       │
│  │                │  │              │  │              │       │
│  │  Job #1        │  │  Job #2      │  │  Job #0      │       │
│  │  ⚙️ Running    │  │  ⏳ Queued   │  │  ✅ Done     │       │
│  │                │  │  Job #3      │  │  Job #-1     │       │
│  │                │  │  ⏳ Queued   │  │  ✅ Done     │       │
│  │                │  │  Job #4      │  │  ...         │       │
│  │                │  │  ⏳ Queued   │  │              │       │
│  └────────────────┘  └──────────────┘  └──────────────┘       │
│                                                                  │
│  Max Queue Size: 10 jobs                                        │
│  Average Completion Time: 120 seconds                           │
└─────────────────────────────────────────────────────────────────┘
```

## Request Flow with Queue

```
┌──────────────┐
│   Client 1   │
│   Request    │
└──────┬───────┘
       │
       ▼
┌─────────────────────────────────────────────────────────────────┐
│                    POST /automate                                │
│                    Validate Request                              │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
                  ┌────────────────┐
                  │  Queue Full?   │
                  └────┬──────┬────┘
                       │      │
                  NO   │      │   YES
                       │      │
                       ▼      ▼
            ┌──────────────┐  ┌──────────────────┐
            │  Add to      │  │  Return 503      │
            │  Queue       │  │  Queue Full      │
            └──────┬───────┘  └──────────────────┘
                   │
                   ▼
            ┌──────────────────────────────────┐
            │  Return 200 Immediately          │
            │  {                                │
            │    session_id: "...",             │
            │    status: "queued",              │
            │    queue_position: 3,             │
            │    estimated_wait_seconds: 240    │
            │  }                                │
            └──────────────────────────────────┘
                   │
                   ▼
            ┌──────────────────────────────────┐
            │  Job Waits in Queue              │
            │  (Client can poll status)        │
            └──────────────────────────────────┘
```

## Queue Processing Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                    QUEUE PROCESSOR                               │
└─────────────────────────────────────────────────────────────────┘
                           │
                           ▼
                  ┌────────────────┐
                  │  Queue Empty?  │
                  └────┬──────┬────┘
                       │      │
                  NO   │      │   YES
                       │      │
                       ▼      ▼
            ┌──────────────┐  ┌──────────────┐
            │  Get Next    │  │  Wait for    │
            │  Job         │  │  New Jobs    │
            └──────┬───────┘  └──────────────┘
                   │
                   ▼
            ┌──────────────────────────────────┐
            │  Mark as Processing              │
            │  currentJob = job                │
            │  isProcessing = true             │
            └──────┬───────────────────────────┘
                   │
                   ▼
            ┌──────────────────────────────────┐
            │  Execute Automation              │
            │  • Setup Browser                 │
            │  • Navigate                      │
            │  • Click Button                  │
            │  • Wait for Completion           │
            │  • Click Post-Completion Button  │
            │  • Send Webhook                  │
            │  • Auto-Close                    │
            └──────┬───────────────────────────┘
                   │
                   ▼
            ┌──────────────────────────────────┐
            │  Job Finished                    │
            │  • Update completion time        │
            │  • Move to history               │
            │  • isProcessing = false          │
            └──────┬───────────────────────────┘
                   │
                   ▼
            ┌──────────────────────────────────┐
            │  Process Next Job                │
            │  (Loop back to top)              │
            └──────────────────────────────────┘
```

## Concurrent Requests Handling

```
Time: 0s
┌──────────┐  ┌──────────┐  ┌──────────┐
│ Client 1 │  │ Client 2 │  │ Client 3 │
└────┬─────┘  └────┬─────┘  └────┬─────┘
     │             │             │
     │ POST        │ POST        │ POST
     │ /automate   │ /automate   │ /automate
     ▼             ▼             ▼
┌─────────────────────────────────────────┐
│           AUTOMATION QUEUE              │
│                                         │
│  Current: [Job 1 - Processing]         │
│  Queue:   []                            │
└─────────────────────────────────────────┘
     │             │             │
     │ 200 OK      │ 200 OK      │ 200 OK
     │ pos: 1      │ pos: 2      │ pos: 3
     │ wait: 0s    │ wait: 120s  │ wait: 240s
     ▼             ▼             ▼
┌──────────┐  ┌──────────┐  ┌──────────┐
│ Client 1 │  │ Client 2 │  │ Client 3 │
│ Response │  │ Response │  │ Response │
└──────────┘  └──────────┘  └──────────┘

Time: 120s (Job 1 completes)
┌─────────────────────────────────────────┐
│           AUTOMATION QUEUE              │
│                                         │
│  Current: [Job 2 - Processing]         │
│  Queue:   [Job 3]                       │
│  History: [Job 1 - Completed]          │
└─────────────────────────────────────────┘

Time: 240s (Job 2 completes)
┌─────────────────────────────────────────┐
│           AUTOMATION QUEUE              │
│                                         │
│  Current: [Job 3 - Processing]         │
│  Queue:   []                            │
│  History: [Job 2, Job 1]               │
└─────────────────────────────────────────┘

Time: 360s (Job 3 completes)
┌─────────────────────────────────────────┐
│           AUTOMATION QUEUE              │
│                                         │
│  Current: null                          │
│  Queue:   []                            │
│  History: [Job 3, Job 2, Job 1]        │
└─────────────────────────────────────────┘
```

## Queue Full Scenario

```
┌──────────┐  ┌──────────┐  ┌──────────┐
│ Client 1 │  │ Client 2 │  │ Client N │
└────┬─────┘  └────┬─────┘  └────┬─────┘
     │             │             │
     │ POST        │ POST        │ POST
     │ /automate   │ /automate   │ /automate
     ▼             ▼             ▼
┌─────────────────────────────────────────┐
│           AUTOMATION QUEUE              │
│                                         │
│  Current: [Job 1]                       │
│  Queue:   [Job 2, Job 3, ..., Job 10]  │
│  Size:    10/10 (FULL!)                │
└─────────────────────────────────────────┘
     │             │             │
     │ 200 OK      │ 200 OK      │ 503 ERROR
     │ pos: 1      │ pos: 10     │ Queue Full
     ▼             ▼             ▼
┌──────────┐  ┌──────────┐  ┌──────────┐
│ Client 1 │  │ Client 2 │  │ Client N │
│ Accepted │  │ Accepted │  │ Rejected │
└──────────┘  └──────────┘  └────┬─────┘
                                  │
                                  │ Wait & Retry
                                  ▼
                            ┌──────────────┐
                            │ Exponential  │
                            │ Backoff      │
                            │ Retry Logic  │
                            └──────────────┘
```

## Job State Transitions

```
┌─────────────┐
│  SUBMITTED  │  ← Request received
└──────┬──────┘
       │
       ▼
┌─────────────┐
│   QUEUED    │  ← Added to queue, waiting
└──────┬──────┘
       │
       │ (When reaches front of queue)
       │
       ▼
┌─────────────┐
│ PROCESSING  │  ← Automation running
└──────┬──────┘
       │
       ├─────────────┬─────────────┬──────────────┐
       │             │             │              │
       ▼             ▼             ▼              ▼
┌─────────────┐ ┌─────────┐ ┌──────────┐ ┌──────────────┐
│  COMPLETED  │ │ TIMEOUT │ │  FAILED  │ │ MANUAL_CLOSE │
└─────────────┘ └─────────┘ └──────────┘ └──────────────┘
       │             │             │              │
       └─────────────┴─────────────┴──────────────┘
                     │
                     ▼
              ┌─────────────┐
              │   HISTORY   │  ← Moved to completed jobs
              └─────────────┘
```

## Wait Time Estimation Algorithm

```
┌─────────────────────────────────────────────────────────────┐
│              WAIT TIME CALCULATION                          │
└─────────────────────────────────────────────────────────────┘

Input:
  - Queue Position: 3
  - Current Job: Running for 45s
  - Average Completion Time: 120s

Calculation:
  1. Current Job Remaining Time:
     remaining = max(0, 120s - 45s) = 75s

  2. Jobs Ahead in Queue:
     jobsAhead = position - 1 = 3 - 1 = 2

  3. Queue Wait Time:
     queueWait = jobsAhead × 120s = 2 × 120s = 240s

  4. Total Estimated Wait:
     totalWait = remaining + queueWait
     totalWait = 75s + 240s = 315s

Output: 315 seconds (5 minutes 15 seconds)

┌─────────────────────────────────────────────────────────────┐
│  Timeline:                                                  │
│                                                             │
│  Now          +75s         +195s        +315s              │
│   │            │            │            │                  │
│   ▼            ▼            ▼            ▼                  │
│  [Job 1]──────►[Job 2]─────►[Job 3]────►[Your Job]        │
│  Running      Starts       Starts       Starts             │
│  (45s done)   (120s)       (120s)       (120s)            │
└─────────────────────────────────────────────────────────────┘
```

## Average Completion Time Tracking

```
┌─────────────────────────────────────────────────────────────┐
│         COMPLETION TIME TRACKING                            │
└─────────────────────────────────────────────────────────────┘

Recent Completions (Last 10):
┌────────┬──────────────┬─────────────┐
│ Job ID │ Duration (s) │ Status      │
├────────┼──────────────┼─────────────┤
│ Job 10 │     125      │ Completed   │
│ Job 9  │     118      │ Completed   │
│ Job 8  │     132      │ Completed   │
│ Job 7  │     115      │ Completed   │
│ Job 6  │     128      │ Completed   │
│ Job 5  │     122      │ Completed   │
│ Job 4  │     119      │ Completed   │
│ Job 3  │     135      │ Completed   │
│ Job 2  │     121      │ Completed   │
│ Job 1  │     125      │ Completed   │
└────────┴──────────────┴─────────────┘

Average Calculation:
  Sum = 125+118+132+115+128+122+119+135+121+125 = 1240s
  Average = 1240 / 10 = 124s

Updated Average: 124 seconds

This average is used for estimating wait times for new jobs.
```

## Monitoring Dashboard View

```
┌─────────────────────────────────────────────────────────────┐
│              AUTOMATION QUEUE DASHBOARD                     │
│                                                             │
│  Status: ⚙️ PROCESSING                                      │
│  Queue Size: 3 / 10                                         │
│  Average Completion: 120 seconds                            │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│  CURRENT JOB                                                │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ Session: automation_1234567890_abc123               │   │
│  │ URL: https://www.google.com/search?q=business       │   │
│  │ Status: Processing                                   │   │
│  │ Elapsed: 45 seconds                                  │   │
│  │ Progress: ████████░░░░░░░░ 40%                      │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│  QUEUED JOBS                                                │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ #1 automation_1234567891_def456                     │   │
│  │    Waiting: 30s | Est. Wait: 75s                    │   │
│  ├─────────────────────────────────────────────────────┤   │
│  │ #2 automation_1234567892_ghi789                     │   │
│  │    Waiting: 15s | Est. Wait: 195s                   │   │
│  ├─────────────────────────────────────────────────────┤   │
│  │ #3 automation_1234567893_jkl012                     │   │
│  │    Waiting: 5s  | Est. Wait: 315s                   │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│  RECENT COMPLETIONS                                         │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ ✅ automation_1234567889_xyz999 (125s)              │   │
│  │ ✅ automation_1234567888_uvw888 (118s)              │   │
│  │ ✅ automation_1234567887_rst777 (132s)              │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

## Error Recovery Flow

```
┌─────────────────────────────────────────────────────────────┐
│                    ERROR SCENARIOS                          │
└─────────────────────────────────────────────────────────────┘

Scenario 1: Job Fails
┌──────────────┐
│ Job Running  │
└──────┬───────┘
       │
       ▼
┌──────────────┐
│ Error Occurs │
└──────┬───────┘
       │
       ├─► Log Error
       ├─► Mark Job as Failed
       ├─► Move to History
       ├─► Set isProcessing = false
       │
       ▼
┌──────────────┐
│ Process Next │  ← Queue continues!
│ Job          │
└──────────────┘

Scenario 2: Browser Crashes
┌──────────────┐
│ Job Running  │
└──────┬───────┘
       │
       ▼
┌──────────────┐
│ Browser Dies │
└──────┬───────┘
       │
       ├─► Catch Error
       ├─► Cleanup Resources
       ├─► Mark Job as Failed
       │
       ▼
┌──────────────┐
│ Process Next │  ← Queue recovers!
│ Job          │
└──────────────┘

Scenario 3: Timeout
┌──────────────┐
│ Job Running  │
└──────┬───────┘
       │
       ▼
┌──────────────┐
│ Wait Time    │
│ Exceeded     │
└──────┬───────┘
       │
       ├─► Mark as Timeout
       ├─► Cleanup
       ├─► Move to History
       │
       ▼
┌──────────────┐
│ Process Next │  ← Queue continues!
│ Job          │
└──────────────┘
```

