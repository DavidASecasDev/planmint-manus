# Tareas Workspace v1

**Autor:** Manus AI  
**Estado:** implementado en preview; no publicado; migración no aplicada a producción.

## Objetivo

Esta versión convierte Tareas en una **agenda personal y de encargos al equipo** sin reemplazar las fuentes existentes. Las tareas, asignaciones, áreas, etiquetas, subtareas, hitos, actualizaciones, recordatorios, rutinas, calendario y Kanban continúan usando sus tablas, hooks y rutas anteriores. La vista principal es una proyección compacta sobre esos datos.

## Experiencia implementada

| Superficie | Comportamiento |
|---|---|
| Hoy | Agrupa atrasadas, vencimientos del día, seguimientos, rutinas y tareas sin fecha; una tarea aparece una sola vez por prioridad operativa. |
| Mis tareas | Incluye responsabilidad principal y colaboración explícita. |
| Delegadas | Muestra tareas creadas por el usuario y asignadas a otra persona. |
| Hechas | Separa el historial completado del trabajo activo. |
| Todas | Mantiene acceso al inventario completo y a tareas sin fecha. |
| Calendario | Proyecta vencimiento y seguimiento como eventos diferenciados del mismo registro en mes, semana, día y rango. |
| Kanban y rutinas | Conservan las rutas y componentes previos. |

Las filas muestran título, prioridad, responsable principal, plazo, estado operativo y siguiente seguimiento. Los filtros de persona, área y proyecto también afectan a Hoy. La búsqueda opera sobre título y descripción.

## Creación y detalle

La creación rápida exige **título, responsable principal y fecha límite**. «Más detalles» permite prioridad, descripción, área, proyecto, próximo seguimiento, colaboradores, revisión opcional, supervisor y subtareas. Los documentos se añaden después desde el panel de detalle para conservar autoría e historial.

El detalle existente mantiene descripción, responsables, hitos, actualizaciones, recordatorios y acciones legacy. Se añadieron una síntesis del encargo, subtareas, dependencias y planificación editable. El campo `commissioned_at` solo se establece en tareas nuevas delegadas; no se inventan fechas para registros históricos.

## Revisión opcional y permisos

Cuando `review_required=false`, la persona responsable o un rol administrativo puede completar directamente. Cuando `review_required=true`, «Terminada» ejecuta `request_task_completion`: la tarea conserva su estado anterior y queda `pending_review`. El supervisor, creador o rol administrativo puede aprobar o devolver con motivo mediante `review_task_completion`. El cierre se puede deshacer con `undo_task_completion`.

Los colaboradores ven la tarea, pero no adquieren por ello permiso para completarla. Las RPC verifican autenticación, organización, persona responsable, supervisor y roles. Los estados antiguos no reconocidos se muestran literalmente y la migración no reescribe filas existentes.

## Migración propuesta

Archivo: `supabase/migrations/20260911130000_tasks_workspace_v1.sql`  
SHA-256: `b174cec64a31a2e86458e099404a6462e18fb00c5da5d403fc20ed3ceae89f20`

La migración es aditiva. Añade diez columnas opcionales a `tasks`, `assignment_role` a `task_assignees`, y las tablas `task_dependencies`, `task_documents` y `task_workflow_events`. Incluye índices, RLS forzada, políticas organizativas y tres RPC transaccionales. No contiene `DROP TABLE`, `TRUNCATE`, `DELETE FROM` ni DML top-level sobre tareas existentes.

> La migración se ejecutó dos veces únicamente en PostgreSQL local efímero. **No se aplicó a Supabase de producción.** Hasta aplicarla, la interfaz detecta la ausencia del esquema y mantiene el flujo legacy, dejando seguimiento avanzado y revisión en modo no disponible.

## Archivos principales

| Área | Archivos |
|---|---|
| Dominio | `client/src/features/tasks/taskWorkspaceDomain.ts` |
| Workspace | `client/src/features/tasks/TaskWorkspace.tsx` |
| Creación | `client/src/features/tasks/TaskQuickCreateSheet.tsx` |
| Flujo avanzado | `client/src/features/tasks/useTaskWorkspaceWorkflow.ts`, `client/src/features/tasks/TaskWorkflowPanel.tsx` |
| Detalle | `client/src/components/tasks/TaskDetail.tsx`, `TaskSubtasksPanel.tsx`, `TaskDependenciesPanel.tsx` |
| Calendario | `client/src/pages/Calendar.tsx`, `client/src/components/calendar/*View.tsx`, `CalendarTaskCard.tsx` |
| SQL | `supabase/migrations/20260911130000_tasks_workspace_v1.sql` |
| Fixture | `/__fixtures/tasks-workspace` |

## Límites reales

La v1 no envía correo, WhatsApp ni notificaciones externas. No crea un motor de recurrencia nuevo: enlaza las rutinas existentes. Los documentos del nuevo registro `task_documents` tienen metadatos y referencia de almacenamiento, pero la subida sigue entrando por el flujo de adjuntos existente del detalle. La migración debe revisarse y autorizarse por separado antes de probar revisión o seguimiento contra datos persistentes reales.

