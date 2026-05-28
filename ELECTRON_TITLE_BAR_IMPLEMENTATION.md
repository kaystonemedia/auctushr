# Custom Title Bar Implementation Plan

## Current Issue
- Window dragging doesn't work on main window
- DevTools window works fine (has native frame)
- Need proper custom title bar implementation

## Solution: Hybrid Approach

### Option 1: Use Electron's Native titleBarOverlay (Recommended)
- Use `titleBarOverlay` for the drag region
- Keep React component for visual controls
- Ensure proper alignment

### Option 2: Fully Custom with CSS
- Make entire title bar draggable
- Ensure no content overlaps
- Use proper z-index and positioning

### Option 3: Native Title Bar Controls
- Use Electron's built-in controls
- Customize appearance only
- Most reliable but less customizable

## Implementation Steps

1. **Fix titleBarOverlay configuration**
   - Ensure proper height and color
   - Make sure drag region covers entire bar

2. **Update React component**
   - Align with native overlay
   - Ensure buttons are in correct position
   - Make entire bar draggable except buttons

3. **Test drag functionality**
   - Verify dragging works
   - Test all window controls
   - Ensure no conflicts




