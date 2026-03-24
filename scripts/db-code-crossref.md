# DB vs Code Cross-Reference

## EXISTING TABLES (confirmed in Supabase):
profiles, organizations, organization_members, role_permissions, transfer_brokers,
transfer_requests, transfer_items, transfer_documents, transfer_providers,
transfer_invoice_settings, transfer_item_vehicles, broker_profiles,
broker_registration_requests, vehicles, reservations, notifications,
notification_preferences, audit_logs

## MISSING TABLES (PGRST205 - not in schema cache):
roles, permissions, member_roles, invitations, transfer_notes,
transfer_status_history, transfer_reports, broker_notifications,
vehicle_categories, vehicle_maintenance, vehicle_documents,
vehicle_prep_checklists, vehicle_prep_items, vehicle_prep_alerts,
fleet_audit_logs, fleet_categories, billing_records, billing_settings,
properties, property_units, drivers, driver_documents,
user_preferences, app_settings, transfer_pricing_rules,
transfer_vehicle_assignments, organization_settings, member_permissions

## CRITICAL: transfer_brokers only has 5 columns:
id, name, organization_id, is_active, created_at
MISSING: email, phone, company, user_id (code expects these!)

## Code references tables NOT checked yet:
tasks, areas, repair-files, repairs, reminders, fleet_vehicle_damages,
damage_reports, task_assignees, organization_invitations, usage_events,
fleet_vehicles, task_subtasks, task_milestones, tags, transfer_brokers,
task_updates, subscriptions, vehicle_movements, team_members,
area_access_rules, accidents, workshops, user_templates, user_feedback,
time_entries, referrals, forms, form_fields, custom_roles,
vehicle_quality_audits, vehicle_cleaning_tasks, user_sessions,
super_admin_alerts, saml_connections, org_security_settings,
fleet_vehicle_inspections, transfer_request_notes, operation_legs,
damage_catalog, coupon_redemptions, automation_rules, user_permissions,
vehicle_locations, vehicle_audit_photos, teams, scim_tokens,
organization_modules, kanban_columns, fleet_inspection_photos, coupons,
rently_sync_status, integration_settings, daily_task_templates,
daily_task_completions, dropdown_options, push_subscriptions
