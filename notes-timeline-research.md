# Timeline Research Notes

## Data Sources
- **Reservations**: Table `reservations` in Supabase
  - Key fields: `auto` (plate), `modelo`, `categoria`, `desde` (pickup date), `hasta` (return date), `estado`, `cliente_nombre`, `cliente_apellido`, `lugar_entrega`, `lugar_devolucion`, `pagado`, `origen_reserva`, `external_reservation_id`
  - Fetched via `useReservations` hook with date filter
  - For public ops page: fetched via `/api/public/operations/:orgSlug`

- **Vehicles**: Table `vehicles` in Supabase
  - Key fields: `matricula`, `modelo`, `categoria`, `status`
  - Fetched via `useVehicles` hook

## Timeline Requirements
- Y-axis: Vehicles grouped by category (MINI, CLASEB, etc.)
- X-axis: Days (horizontal scroll)
- Bars: Reservations colored by status
- PlanMint version: hover tooltip + click to open reservation
- Azul Ops version: informational only (no click)

## Color Scheme (from Rently screenshot)
- Gray: Past/completed reservations
- Orange: Confirmed reservations
- Green: Currently in progress (vehicle rented out)
- Pink/Red striped: Cancelled
- Purple/Magenta: Special status
- Light blue: Pending/unconfirmed

## API for Public Ops Timeline
Need a new endpoint that returns reservations in a timeline-friendly format:
- All vehicles (grouped by category)
- Reservations for a date range (e.g., ±30 days from today)
- No PII needed for public version (just plate, model, dates, status)
