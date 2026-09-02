# Restore Dashboard to Original State

Restore the `wellen.id/dashboard` application to match the professional logistics dashboard seen on `https://on-track-indol.vercel.app`.

## Proposed Changes

### Configuration
#### [MODIFY] [vercel.json](file:///Users/dombamalam/AndroidStudioProjects/Wtrack/vercel.json)
- Update all rewrites currently pointing to `https://web-track-phi-gilt.vercel.app` to point to the correct reference URL: `https://on-track-indol.vercel.app`.

### Dashboard
#### [MODIFY] [index.html](file:///Users/dombamalam/AndroidStudioProjects/Wtrack/dashboard/index.html)
- Replace the current simplified dashboard code with the advanced professional logistics dashboard code found in `logistik/index.html`. This includes:
    - Advanced stat cards (On-Time Rate, In Transit, etc.)
    - Live Fleet Tracking with Heatmap
    - Priority Alerts system
    - Courier Efficiency Ranking and charts
    - Cost Calculator
    - Regional Client filtering and Excel import
    - App Release Management

## Verification Plan

### Manual Verification
- Verify that the routing in `vercel.json` correctly points to the reference site.
- Verify that the code in `dashboard/index.html` now contains the advanced features from `logistik/index.html`.
