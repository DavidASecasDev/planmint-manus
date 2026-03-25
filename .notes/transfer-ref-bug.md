# Transfer Reference Bug Analysis

## Current State (11 records)
- TRF-2026-0007: 7 duplicates (Feb 2 - Mar 24)
- TRF-2026-0008: 1 (Mar 24)
- TRF-2026-0009: 1 (Mar 24)
- TRF-2026-0010: 1 (Mar 24)
- TRF-2026-0011: 1 (Mar 24)

## Root Cause
The trigger function `generate_transfer_request_number` uses:
```sql
SELECT COUNT(*) + 1 INTO v_count
FROM public.transfer_requests
WHERE organization_id = NEW.organization_id
AND to_char(created_at, 'YYYY') = v_year;
```

This means:
- When there were 6 records, COUNT(*)+1 = 7 → TRF-2026-0007
- If records were deleted (e.g., went from 13 to 6), new inserts restart at 0007
- Previously there were likely 13+ records, 6 were deleted, leaving 7 records
- Then the first insert on Feb 2 saw 6 existing → generated 0007
- All subsequent inserts also saw 6 existing (since they were all 0007) → generated 0007
- Wait, that's wrong. After Feb 2 insert, there were 7 records, so next should be 0008

Actually the real issue: records 0001-0006 were deleted before Feb 2.
- Feb 2: 0 records in 2026 → COUNT=0+1=1... no wait, it says 0007

Let me reconsider: there must have been 6 records that existed when the first 0007 was created.
Those 6 records (0001-0006) were then deleted.
After deletion, COUNT dropped to 6 (just the 0007 one) → next insert = 0007 again.
This repeated for each deletion cycle.

## Fix Plan
1. Replace COUNT(*)+1 with MAX-based approach
2. Use COALESCE(MAX(substring(request_number from '\d{4}$')::int), 0) + 1
3. Fix existing duplicates by reassigning sequential numbers
