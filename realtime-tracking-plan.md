# Real-time Vehicle Tracking Implementation Plan

## Current State (already implemented)
- AnimatedMarker component with smooth interpolation (ease-out cubic, 2000ms duration)
- REFRESH_INTERVAL = 10_000 (10s) for frontend auto-refresh
- createVehicleIcon already includes direction arrow (white triangle rotated by course)
- followingVehicleId state + useEffect that calls setMapTarget when vehicle position changes
- handleFollowVehicle toggles follow mode with toast notification
- "Seguir" button exists in VehicleDetailPanel (line 449)
- MapController uses map.setView with animate:true for smooth panning
- Backend poll is on a scheduled cron (60s interval externally configured)

## What to Improve

### 1. Follow mode UX enhancements
- Add a visible floating banner when follow mode is active (shows which vehicle is being followed)
- Add "Seguir" button directly on VehicleCard (not just in detail panel)
- Make the followed vehicle's marker pulse/glow distinctly
- When following, zoom to 17 (closer) for better street-level view

### 2. Reduce frontend refresh to 8s (from 10s)
- Already at 10s which is good, can reduce slightly

### 3. Backend poll frequency
- Currently 60s cron. Reducing to 30s would help.
- This is configured externally via Manus Heartbeat schedule, not in code.

### 4. Visual improvements for "live" feel
- Add a "LIVE" badge with pulsing dot when following a vehicle
- Show speed in real-time on the followed vehicle's marker
- Trail line showing last few positions when following

## Key File Locations
- FleetGPS.tsx: /home/ubuntu/planmint-preview/client/src/pages/fleet/FleetGPS.tsx
- AnimatedMarker: /home/ubuntu/planmint-preview/client/src/components/map/AnimatedMarker.tsx
- VehicleDetailPanel: /home/ubuntu/planmint-preview/client/src/components/fleet/VehicleDetailPanel.tsx
- useTraccar hook: /home/ubuntu/planmint-preview/client/src/hooks/useTraccar.ts
- scheduledXexunPoll: /home/ubuntu/planmint-preview/server/scheduledXexunPoll.ts

## VehicleCard props (line 953-961):
```
vehicle: FleetVehicleGPS;
isSelected: boolean;
onClick: () => void;
```
Need to add: isFollowing, onFollow props

## MapController (line 185-193):
Uses map.setView(center, zoom, { animate: true })
