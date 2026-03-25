# PDF Budget Automation - Architecture Audit

## Current Flow
1. User uploads PDF/image to `transfer-documents` storage bucket
2. `transfer_documents` record created with `ai_status: 'pending'`
3. Server endpoint `POST /api/parse-transfer-document` called
4. LLM parses document → extracts: document_type, total_amount, date, provider_name, items[]
5. Each item has: date, pickup_time, pickup_location, dropoff_location, vehicle_type, pax_count, amount, notes
6. Results stored in `transfer_documents.ai_raw_data`, `detected_amount`, `detected_date`, `detected_provider`, `detected_items`
7. UI shows detected data + "Aplicar y Crear Items" button
8. `applyProviderCost` creates `transfer_items` from detected items

## Current Gap: No Movement Creation
- `transfer_items` are created but NO `vehicle_movements` are generated
- Movements require: matricula, movement_type, driver_id, organization_id
- Transfer items have: pickup_location, dropoff_location, date, time, pax_count, vehicle_type
- There's NO foreign key between transfer_items and vehicle_movements
- Movements are currently created manually via StartMovement page (camera + OCR flow)

## Key Tables
- `transfer_requests` - parent request (broker, client, status, pricing)
- `transfer_items` - individual routes/trips within a request
- `transfer_documents` - uploaded PDFs with AI parsing results
- `vehicle_movements` - physical vehicle movements (entrega/recogida/escoba/limpieza)
- `transfer_item_vehicles` - extra vehicles per transfer item

## Design Decision: What "Create Movements" Means
The user wants: upload PDF → parse → auto-create movements
But movements need: matricula (plate), driver_id, movement_type
These are NOT in the PDF budget.

**Solution**: The automation should:
1. Parse PDF → create transfer_items (already works)
2. NEW: After items are created, show a review UI where user can:
   - Confirm/edit extracted data
   - Assign vehicle (matricula) and driver to each item
   - Choose movement type (entrega by default for transfers)
3. Then batch-create movements from the enriched items

## Implementation Plan
1. Enhance LLM prompt to extract more data (return trips, flight numbers, etc.)
2. Add `source_document_id` to transfer_items to link back to the document
3. Create new endpoint: `POST /api/create-movements-from-items`
4. Create review UI component: `TransferMovementReview`
5. Add batch movement creation logic
6. Keep existing flow working (backwards compatible)
