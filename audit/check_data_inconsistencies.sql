-- 1. Profiles without organization_id
SELECT 'profiles_no_org' as check_name, count(*) as cnt FROM profiles WHERE organization_id IS NULL;

-- 2. Organization members without matching profile
SELECT 'orphan_org_members' as check_name, count(*) as cnt FROM organization_members om WHERE NOT EXISTS (SELECT 1 FROM profiles p WHERE p.id = om.user_id);

-- 3. Profiles without org_members entry
SELECT 'profiles_no_membership' as check_name, count(*) as cnt FROM profiles p WHERE p.organization_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM organization_members om WHERE om.user_id = p.id AND om.organization_id = p.organization_id);

-- 4. Vehicles without fleet_vehicle link
SELECT 'vehicles_no_fleet_link' as check_name, count(*) as cnt FROM vehicles v WHERE v.fleet_vehicle_id IS NULL AND v.is_archived = false AND v.archived_at IS NULL;

-- 5. Fleet vehicles without vehicles entry
SELECT 'fleet_no_vehicle' as check_name, count(*) as cnt FROM fleet_vehicles fv WHERE NOT EXISTS (SELECT 1 FROM vehicles v WHERE v.fleet_vehicle_id = fv.id);

-- 6. Vehicles with status 'alquilado' but no active reservation
SELECT 'rented_no_reservation' as check_name, count(*) as cnt FROM vehicles v WHERE v.status = 'alquilado' AND (v.current_reservation_id IS NULL OR NOT EXISTS (SELECT 1 FROM reservations r WHERE r.id = v.current_reservation_id AND r.estado IN ('En curso', 'Confirmada', 'Pendiente')));

-- 7. Notifications with excessive count (spam check)
SELECT 'notification_spam' as check_name, count(*) as cnt FROM notifications WHERE created_at > now() - interval '7 days';

-- 8. Duplicate notifications per user+entity
SELECT 'duplicate_notifications' as check_name, count(*) as cnt FROM (SELECT user_id, type, entity_type, entity_id, count(*) as c FROM notifications WHERE created_at > now() - interval '7 days' GROUP BY user_id, type, entity_type, entity_id HAVING count(*) > 3) sub;

-- 9. Expired pending invitations
SELECT 'expired_pending_invitations' as check_name, count(*) as cnt FROM organization_invitations WHERE status = 'pending' AND expires_at < now();

-- 10. Equipment assigned but reservation completed
SELECT 'equipment_stale_assignment' as check_name, count(*) as cnt FROM equipment_inventory ei JOIN reservations r ON ei.reservation_id = r.id WHERE ei.estado = 'asignada' AND r.estado IN ('Completada', 'Cancelada');

-- 11. Reservations with mismatched vehicle in vehicles table
SELECT 'reservation_vehicle_mismatch' as check_name, count(*) as cnt FROM vehicles v JOIN reservations r ON v.current_reservation_id = r.id WHERE v.matricula != r.auto AND r.auto IS NOT NULL AND v.status = 'alquilado';

-- 12. Empty tables that should have data
SELECT 'empty_repair_photos' as check_name, count(*) as cnt FROM repair_photos;
SELECT 'empty_repair_comments' as check_name, count(*) as cnt FROM repair_comments;

-- 13. Broker profiles without matching transfer_brokers
SELECT 'broker_profile_orphan' as check_name, count(*) as cnt FROM broker_profiles bp WHERE NOT EXISTS (SELECT 1 FROM transfer_brokers tb WHERE tb.id = bp.broker_id);

-- 14. Transfer requests without broker_id
SELECT 'transfer_no_broker_id' as check_name, count(*) as cnt FROM transfer_requests WHERE broker_id IS NULL AND broker_name IS NOT NULL;

-- 15. RLS policies count per table
SELECT 'tables_without_rls_policies' as check_name, count(*) as cnt FROM (SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename NOT IN (SELECT DISTINCT tablename FROM pg_policies WHERE schemaname = 'public')) sub;
