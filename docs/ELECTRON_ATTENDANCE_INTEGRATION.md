# Electron App Integration with Attendance & Timesheet System

## Overview

This document explains how the Electron desktop monitoring app integrates with the attendance tracking, idle time SLA threshold, and timesheet reporting system.

## Data Flow Architecture

```
┌─────────────────┐
│  Electron App   │
│  (Desktop)      │
│                 │
│  - Tracks idle  │
│  - Captures     │
│    screenshots  │
│  - Monitors     │
│    activity     │
└────────┬─────────┘
         │
         │ Syncs via API
         │
         ▼
┌─────────────────────────┐
│  /api/monitoring/sync   │
│                         │
│  - Receives screenshots │
│  - Receives activity    │
│  - Receives idle time   │
└────────┬────────────────┘
         │
         │ Processes & Stores
         │
         ▼
┌─────────────────────────┐
│ UnifiedMonitoringService│
│                         │
│  - Stores in            │
│    unified_activities   │
│  - Calculates daily     │
│    metrics              │
│  - Stores in            │
│    unified_metrics      │
└────────┬────────────────┘
         │
         │ Also syncs via
         │
         ▼
┌─────────────────────────┐
│  /api/attendance/sync   │
│                         │
│  - Receives idleTime    │
│    (in minutes)         │
│  - Receives activeTime  │
│  - Updates attendance   │
│    records              │
└────────┬────────────────┘
         │
         │ Applies SLA
         │
         ▼
┌─────────────────────────┐
│  Attendance Records     │
│                         │
│  - Calculates:          │
│    * totalHours         │
│    * activeTime         │
│    * idleTimeTotal      │
│    * idleTimeSLAStatus  │
│                         │
│  - Uses threshold from  │
│    Settings             │
└─────────────────────────┘
```

## Key Integration Points

### 1. Electron App Idle Time Tracking

**Location:** `electron/main.js`

The Electron app tracks idle time using:
- System idle time detection (`powerMonitor.getSystemIdleTime()`)
- Activity monitoring (keyboard/mouse events)
- Configurable idle threshold (`maxIdleTime`)

**Current Implementation:**
```javascript
this.maxIdleTime = 10 * 60 * 1000; // 10 minutes (default)
// Can be overridden by settings from server
```

**Idle Time Data Structure:**
- `currentIdleTime`: Current idle duration in milliseconds
- `idleTime`: Accumulated idle time in the session
- Tracked per activity in `activityData` array

### 2. Data Sync to Server

**Two Sync Endpoints:**

#### A. `/api/monitoring/sync` (Productivity/Monitoring)
- **Purpose:** Stores detailed monitoring data (screenshots, activities)
- **Data Sent:**
  ```javascript
  {
    screenshots: [...],
    activityData: [
      {
        idleTime: 120000, // milliseconds
        activeTime: 3600000,
        timestamp: "...",
        workStatus: "working" | "idle" | "break"
      }
    ],
    syncTime: "..."
  }
  ```
- **Stores in:**
  - `monitoring/{userId}/screenshots`
  - `monitoring/{userId}/activity`
  - `unified_activities` (via UnifiedMonitoringService)
  - `unified_metrics` (aggregated daily metrics)

#### B. `/api/attendance/sync` (Attendance Tracking)
- **Purpose:** Updates attendance records with time tracking
- **Data Sent:**
  ```javascript
  {
    session: {
      startTime: "...",
      idleTime: 120, // minutes (converted from ms)
      activeTime: 360, // minutes
      activities: [...],
      isCheckOut: false
    },
    userId: "..."
  }
  ```
- **Process:**
  1. Finds or creates today's attendance record
  2. Accumulates `idleTime` and `activeTime`
  3. Calculates `totalHours`, `activeTime`, `idleTimeTotal`
  4. **Fetches SLA threshold from Settings**
  5. Calculates `idleTimeSLAStatus` (normal/warning/exceeded)
  6. Updates attendance record

### 3. SLA Threshold Application

**Location:** `app/api/attendance/sync/route.ts`

The attendance sync endpoint:
1. **Fetches Settings:**
   ```typescript
   const settingsService = SettingsService.getInstance()
   const settings = await settingsService.getSettings()
   const slaThreshold = settings.attendance.idleTimeSLAThreshold || 3
   ```

2. **Calculates SLA Status:**
   ```typescript
   let idleTimeSLAStatus: 'normal' | 'warning' | 'exceeded' = 'normal'
   if (idleTimeTotal > slaThreshold) {
     idleTimeSLAStatus = 'exceeded'
   } else if (idleTimeTotal > slaThreshold * 0.7) {
     idleTimeSLAStatus = 'warning'
   }
   ```

3. **Updates Attendance Record:**
   ```typescript
   updateData.idleTimeSLAStatus = idleTimeSLAStatus
   updateData.totalHours = workHours
   updateData.activeTime = activeTimeMinutes
   updateData.idleTimeTotal = idleTimeTotal
   ```

### 4. Unified Monitoring Service Processing

**Location:** `lib/unified-monitoring-service.ts`

The UnifiedMonitoringService:
1. Receives desktop data from `/api/monitoring/sync`
2. Processes idle activities:
   ```typescript
   case 'idle':
     totalIdleTime += activity.data?.activity?.duration || 0
     break
   ```
3. Stores in `unified_metrics`:
   ```typescript
   {
     totalIdleTime, // in minutes
     totalActiveTime,
     // ... other metrics
   }
   ```
4. This data is used by productivity dashboards

### 5. Attendance Record Calculation

**Location:** `lib/attendance.ts` → `detectIdleTime()`

When attendance records are processed:
1. Receives `idleTime` periods array
2. Calculates total idle minutes
3. Gets SLA threshold from settings:
   ```typescript
   const slaThreshold = settings.idleTimeSLAThreshold || 3
   ```
4. Determines SLA status based on threshold
5. Calculates active time = total time - idle time
6. Returns updated record with all calculated fields

## Settings Configuration

### Idle Time SLA Threshold

**Location:** Settings → Attendance Tab

- **Field:** "Idle Time SLA Threshold (minutes)"
- **Default:** 3 minutes
- **Purpose:** Determines when idle time triggers warnings/exceeded status
- **Storage:** `settings/global` → `attendance.idleTimeSLAThreshold`

**How It's Used:**
1. Admin configures threshold in Settings page
2. Stored in Firestore `settings/global`
3. Retrieved by:
   - `SettingsService.getSettings()` (server-side)
   - `SettingsClientService.getSettings()` (client-side)
4. Applied when:
   - Syncing attendance data
   - Calculating attendance records
   - Displaying timesheet reports

## Timesheet Integration

### Data Sources

Timesheet reports pull data from:
1. **Attendance Records** (`attendance` collection)
   - Clock in/out times
   - `totalHours`
   - `activeTime` (minutes)
   - `idleTimeTotal` (minutes)
   - `idleTimeSLAStatus`

2. **Unified Metrics** (`unified_metrics` collection)
   - Aggregated daily productivity data
   - Includes Electron app monitoring data

### Timesheet Report Generation

**Location:** `lib/timesheet.ts`

The timesheet service:
1. Fetches attendance records for period
2. Extracts:
   - Clock in/out times
   - Total hours
   - Active time
   - Idle time
3. Generates daily/weekly/bi-weekly summaries
4. Displays in `components/attendance/timesheet-report.tsx`

## Current Gaps & Considerations

### 1. Idle Time Format Consistency

**Issue:** Electron app tracks idle time in milliseconds, but attendance sync expects minutes.

**Current Solution:**
- Electron app converts to minutes before sending to `/api/attendance/sync`
- Extension sends `idleTime` in milliseconds, converted server-side

### 2. Idle Periods vs Total Idle Time

**Current State:**
- Electron app sends **total accumulated idle time** (number)
- Attendance records store **idle periods array** (with start/end times)

**Processing:**
- `/api/attendance/sync` receives total idle time (minutes)
- Web app tracks idle periods separately (browser-based tracking)
- Both are used to calculate `idleTimeTotal`

### 3. Real-time Updates

**Current Flow:**
- Electron app syncs periodically (not real-time)
- Attendance records updated on sync
- SLA status calculated on sync

**Future Enhancement:**
- Could add real-time idle time warnings in Electron app
- Could show SLA status in Electron UI when threshold exceeded

## Recommendations

### 1. Electron App Enhancements

Consider adding to Electron app:
- **Display SLA Status:** Show warning when idle time approaches/exceeds threshold
- **Fetch Settings:** Electron app could fetch `idleTimeSLAThreshold` from settings API
- **Real-time Alerts:** Notify user when idle time exceeds SLA threshold

### 2. Data Consistency

Ensure:
- Idle time units are consistent (minutes vs milliseconds)
- Both sync endpoints use same idle time calculation
- Attendance records reflect Electron app data accurately

### 3. Settings Sync

Consider:
- Electron app fetching settings on startup
- Caching settings locally
- Updating when settings change

## Testing Checklist

- [ ] Electron app tracks idle time correctly
- [ ] Idle time syncs to `/api/monitoring/sync`
- [ ] Idle time syncs to `/api/attendance/sync`
- [ ] SLA threshold is read from settings
- [ ] SLA status calculated correctly (normal/warning/exceeded)
- [ ] Attendance records show correct active/idle time
- [ ] Timesheet reports display Electron app data
- [ ] Settings changes reflect in SLA calculations

## Summary

The Electron app integrates with the attendance system through:

1. **Data Collection:** Tracks idle time using system APIs
2. **Data Sync:** Sends to both monitoring and attendance endpoints
3. **SLA Application:** Server applies configurable threshold from settings
4. **Record Updates:** Attendance records include calculated fields
5. **Reporting:** Timesheet reports display the data

The system is designed so the Electron app doesn't need to know about SLA thresholds - it just tracks and sends raw idle time data. The server-side logic applies the business rules (SLA thresholds) based on configured settings.

