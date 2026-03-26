# Inspection Photos Audit

## Key Findings

### Tables
- `fleet_vehicle_inspections` — 27 inspections exist
- `fleet_inspection_photos` — 377 photos exist (from Lovable)
- `vehicle_quality_audits` — 2 audits (new system), both in_progress
- `vehicle_audit_photos` — 0 photos (new system, never used with photos)

### Photo Storage
- Photos stored in `repair-files` bucket (PRIVATE, not public)
- `storage_path` pattern: `{org_id}/fleet/{vehicle_id}/{type}/{timestamp}_{filename}`
- Bucket has RLS: users can view files from their org folder
- Photos require **signed URLs** (`createSignedUrl`) to access

### How Photos Load (FleetInspectionDetail.tsx)
- `useSignedUrls` hook generates signed URLs for all photos
- Uses `supabase.storage.from('repair-files').createSignedUrl(path, 3600)` 
- Signed URLs expire after 1 hour

### The Problem
The photos exist in the database (377 records) and the storage bucket.
The `useFleetInspection` hook fetches photos via join: `photos:fleet_inspection_photos(*)`.
The `FleetInspectionDetail` page uses `useSignedUrls` to generate viewable URLs.

### Possible Issues
1. Photos uploaded to `repair-files` bucket but storage_path doesn't match actual file location
2. RLS policy requires auth - if session expired, signed URLs fail
3. The new audit system (`vehicle_quality_audits`) has 0 photos - completely separate from fleet inspections
4. User might be looking at the wrong section (audits vs inspections)

### Next Steps
- Verify a sample photo actually exists in storage
- Check if the FleetInspectionDetail page loads photos correctly
- Check if there's a mismatch between where photos are uploaded vs where they're read from
