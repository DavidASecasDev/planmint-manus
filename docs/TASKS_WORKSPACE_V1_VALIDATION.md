# Validación de Tareas Workspace v1

**Fecha:** 11 de septiembre de 2026  
**Entorno:** preview y PostgreSQL local efímero; sin escrituras en Supabase de producción.

## Resultados

| Validación | Resultado |
|---|---|
| Dominio, integración y contrato SQL | 20/20 pruebas aprobadas inicialmente; matriz focal ampliada 80/80. |
| TypeScript | `pnpm check` aprobado. |
| Build | `pnpm build` aprobado; solo avisos históricos de tamaño de chunks y Browserslist. |
| PostgreSQL | Migración aplicada dos veces desde cero; `TASKS_WORKSPACE_FIXTURE_OK`. |
| Suite global | 1.614/1.615 pruebas aprobadas. Único fallo: autenticación externa Xexun 401 ya conocido y ajeno a Tareas. |
| Visual escritorio | Workspace compacto verificado a 1440 × 1000. |
| Visual móvil | Workspace, creación y detalle verificados a 390 × 844. |

## Escenarios aislados

La fixture PostgreSQL y el dominio cubren encargar una limpieza con revisión, devolverla con motivo, volver a terminarla y aprobarla. También cubren pedir documentos antes de reservar ITV, cierre directo sin revisión y deshacer. Se verificaron colaborador sin permiso de cierre, usuario de otra organización, preservación de estado legacy, cambios de vencimiento, seguimiento, proyecto, tarea sin fecha y tarea vencida.

La fixture visual utiliza exclusivamente identidades y tareas marcadas como `fixture`. Permite abrir creación rápida y detalle mediante:

| Ruta | Uso |
|---|---|
| `/__fixtures/tasks-workspace` | Agenda completa. |
| `/__fixtures/tasks-workspace?create=1` | Creación rápida en primer plano. |
| `/__fixtures/tasks-workspace?detail=1` | Detalle sintético en primer plano. |

## Preservación

El diff funcional se limita a Tareas, Calendario, tipos asociados y una ruta de fixture disponible solo en desarrollo. No modifica código de reservas, SES.HOSPEDAJES ni flota. La suite global mantuvo sus pruebas; el único fallo fue una petición real de token Xexun con respuesta 401, sin relación con este cambio.

## Operaciones no realizadas

No se publicó ni desplegó. No se aplicó la migración a producción. No se crearon tareas, personas, recordatorios, documentos ni ejemplos en Supabase real. No se cambiaron permisos existentes. No se activaron horarios, Heartbeats, correos, WhatsApp ni notificaciones externas.

