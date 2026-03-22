# Auditoría del Sistema de Permisos Granulares - PlanMint

## Arquitectura Actual

### Capas del sistema
1. **BD (role_permissions)**: Tabla con 91 claves de permiso × 5 roles (owner, admin, manager, member, read_only)
2. **BD (user_permissions)**: Overrides individuales por usuario
3. **BD (custom_roles)**: Roles personalizados con `permissions_json` (estructura anidada)
4. **BD (get_my_permissions RPC)**: Función que resuelve permisos efectivos (role defaults + overrides)
5. **Frontend (usePermissions)**: Hook que consume la RPC y expone `hasPermission(key)`
6. **Frontend (permissionDefinitions.ts)**: Catálogo de 82 permisos organizados en 16 categorías para UI
7. **Frontend (enterprise.ts)**: Tipos `RolePermissions` (estructura anidada) + `DEFAULT_ROLE_PERMISSIONS`
8. **Frontend (MemberPermissionsEditor)**: `mapCustomRoleToFlatPermissions()` convierte nested → flat

## Inconsistencias Encontradas

### 1. PermissionKey type vs permissionDefinitions.ts (9 claves huérfanas)
Claves en PermissionKey pero NO en permissionDefinitions (no aparecen en UI de gestión):
- daily_tasks.view, daily_tasks.view_other_days, daily_tasks.complete, daily_tasks.manage
- fleet.view, fleet.manage, fleet.import
- movements.edit_photos, movements.upload_receipt

### 2. mapCustomRoleToFlatPermissions() incompleta (20 claves faltantes)
Claves de BD no mapeadas al convertir roles personalizados:
- areas.view, tags.view, tasks.view, teams.view, templates.view (¡claves .view críticas!)
- daily_tasks.* (4 claves)
- fleet.* (3 claves)
- movements.delete, movements.edit_photos, movements.upload_receipt
- vehicles.change_status, vehicles.complete_tasks, vehicles.import, vehicles.manage_locations, vehicles.sync

### 3. RolePermissions interface (enterprise.ts) no incluye movements ni daily_tasks
- No hay categoría `movements` en la interfaz RolePermissions
- No hay categoría `daily_tasks` en la interfaz RolePermissions
- Esto significa que los roles personalizados NO pueden configurar estos módulos

### 4. OrgRole type inconsistente
- usePermissions.ts: `'owner' | 'admin' | 'manager' | 'member'` (sin read_only)
- AuthContext.tsx: `'owner' | 'admin' | 'manager' | 'member' | 'read_only'` (con read_only)
- roleHierarchy.ts: ROLE_HIERARCHY no incluye read_only (nivel 0 por defecto)

### 5. read_only no está en la tabla de roles del Admin panel
- RolePermissionsTable solo muestra ['owner', 'admin', 'manager', 'member']
- read_only existe en BD con 86 claves pero no se puede gestionar desde UI

### 6. Duplicación de UIs de gestión de roles
- RolesSection.tsx (Settings) y RoleEditor.tsx (Admin) son dos UIs separadas para lo mismo
- Usan diferentes fuentes de datos para labels (PERMISSION_LABELS vs PERMISSION_CATEGORIES)

### 7. Falta de protección en la escritura de role_permissions
- toggleRolePermission() actualiza directamente en Supabase sin verificar permisos del actor
- Solo se bloquea owner en frontend, pero no hay validación server-side de quién puede cambiar permisos

### 8. movements.view defaults a true en mapCustomRoleToFlatPermissions
- Línea 108: `flat['movements.view'] = permissionsJson?.movements?.view ?? true;`
- Esto da acceso por defecto a movimientos para roles personalizados, inconsistente con otros módulos

## Plan de Corrección

1. Añadir las 9 claves faltantes a permissionDefinitions.ts (daily_tasks, fleet, movements extras)
2. Completar mapCustomRoleToFlatPermissions con las 20 claves faltantes
3. Añadir movements y daily_tasks a RolePermissions interface en enterprise.ts
4. Unificar OrgRole type para incluir read_only
5. Añadir read_only a ROLE_HIERARCHY
6. Mostrar read_only en RolePermissionsTable
7. Corregir movements.view default a false
