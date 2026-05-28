# Service Bar Investigation Notes

## Repairs table key fields for date ranges:
- `created_at` - when the repair was created
- `started_at` - when the repair actually started (set when status changes to 'en_taller')
- `completed_at` - when the repair was completed (set when status changes to 'finalizado')
- `scheduled_date` - scheduled date for the repair
- `vehicle_id` - FK to vehicles table
- `status` - RepairStatus enum

## RepairStatus values:
- pendiente_aprobacion
- listo_entregar_taller
- en_taller
- esperando_piezas
- listo_recoger
- finalizado (completed - NOT active)

## Strategy for service period bars:
For each active repair, the service period is:
- Start: `started_at` if available, otherwise `created_at`
- End: For active repairs (not finalizado), use TODAY as the end date (ongoing)
- For completed repairs in the date range: `started_at` to `completed_at`

## New data structure needed:
Instead of boolean `inService`, return an array of `servicePeriods`:
```
servicePeriods: [{
  startDate: string,  // YYYY-MM-DD
  endDate: string,    // YYYY-MM-DD (or null = ongoing until today)
  type: string,       // repair status
  notes: string,      // description
  repairId: string,   // for linking
}]
```

## Frontend rendering:
- Render service periods as bars (like reservations) but with diagonal stripe pattern
- Use amber/orange color with diagonal stripes
- Remove the full-row amber background
