# Travel Time Issue Analysis

## From the screenshot:
- The table shows columns: Date/Time, Date/Time, eye icon, Type badge (Entrega/Devolución), Booking#, Location, Location address, icons, **"—"**, Customer, Vehicle Class, Plate
- The "—" appears in what seems to be a **travel time column** (between the map/play icons and customer name)
- This is the **PublicOperations** page (public scheduling view)

## Key finding:
- PublicOperations.tsx does NOT have a travelMinutes column in its table
- The "—" in the screenshot might be a different field entirely (not travel time)
- Need to check what that column actually represents

## Looking at the screenshot more carefully:
- The columns appear to be: datetime, datetime, status icon, type, booking#, location name, location address, action icons (map, send, play), **a dash column**, customer, class, plate
- The dash column could be: assigned driver, notes, or travel time

## Need to check:
- The OperationRow type from usePublicOperations hook
- What columns the PublicOperations table renders
