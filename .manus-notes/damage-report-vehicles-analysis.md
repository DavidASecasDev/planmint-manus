# Damage Report Vehicle Selector Analysis

## Problem
- `useVehicles()` returns only `is_archived = false` vehicles (101 active)
- 63 archived vehicles exist, 60 of which have reservations
- The damage report forms (DamageReportNew, DamageReportFormDialog, DamageReportEditForm) all use `useVehicles()` 
- Same pattern in AccidentFormDialog, RepairFormDialog, Repairs page

## Data
- vehicles table: 164 total (101 active, 63 archived)
- fleet_vehicles table: 78 total
- reservations distinct plates: 159
- Plates in reservations NOT in vehicles: only 2 (5056NLW, WRANG-CLICK1)

## DB constraint
- damage_reports.vehicle_id FK → vehicles.id
- So the selector MUST use vehicles.id, not fleet_vehicles

## Solution approach
- Create a new hook `useAllVehicles` or add `includeArchived` option to useVehicles
- Better: create a lightweight `useVehicleSelector` hook that fetches ALL vehicles (active + archived) with just id, matricula, modelo for dropdown use
- Use it in damage report forms (and optionally in accident/repair forms too)
- Group the dropdown: "Activos" and "Archivados" sections for clarity

## Files to modify
1. Create: client/src/hooks/useAllVehiclesForSelect.ts (lightweight hook)
2. Modify: client/src/pages/garatech/DamageReportNew.tsx - use new hook
3. Modify: client/src/components/garatech/DamageReportFormDialog.tsx - use new hook
4. Modify: client/src/components/garatech/damage-report-detail/DamageReportEditForm.tsx - use new hook
