# Auditoría Módulo Forms

## Estado: FUNCIONAL pero con problemas de navegación

### Tablas en BD (Supabase)
- `forms` — 2 registros ("Solicitud de Transfer", "Solicitud de Transfer Detallada")
- `form_fields` — 24 registros
- `form_responses` — 0 registros (nunca se ha usado para recibir respuestas)

### Módulo habilitado
- Azul Cars: **enabled = true**
- Bluebnc: enabled = false

### Archivos del módulo
- `client/src/pages/Forms.tsx` — Listado de formularios
- `client/src/pages/FormEditor.tsx` — Editor de formularios
- `client/src/pages/PublicForm.tsx` — Formulario público (ruta /f/:slug)
- `client/src/components/forms/FormCard.tsx` — Tarjeta de formulario
- `client/src/components/forms/FormEditor.tsx` — Componente editor
- `client/src/components/forms/FormFieldEditor.tsx` — Editor de campos
- `client/src/components/forms/FormResponsesDialog.tsx` — Diálogo de respuestas
- `client/src/hooks/useForms.ts` — Hook con CRUD completo
- `client/src/types/forms.ts` — Tipos TypeScript

### Rutas registradas en App.tsx
- `/forms` — Listado (protegido por moduleKey="forms")
- `/forms/:id/edit` — Editor (protegido)
- `/f/:slug` — Formulario público (sin auth)

### Problemas encontrados
1. **Navegación rota**: Forms.tsx y FormEditor.tsx navegan a `/transfers/forms/...` (ruta eliminada en cleanup anterior)
   - Debería navegar a `/forms/:id/edit` y `/forms`
2. **No hay enlace en sidebar**: El módulo Forms no tiene entrada propia en el sidebar
   - Solo era accesible via el submenú de Transfers (eliminado)
   - Necesita su propia entrada en el sidebar o no es accesible
3. **Formularios creados son de tipo "Transfer"**: Los 2 formularios existentes son para solicitudes de transfer
   - Pero el módulo es genérico (puede crear formularios para cualquier entidad)

### Conclusión
El módulo Forms es **funcional** (tiene tablas, datos, código completo, permisos, ruta pública /f/:slug).
Sin embargo, actualmente es **inaccesible** porque:
- Se eliminó el enlace del sidebar de Transfers
- No tiene su propia entrada en el sidebar
- Las navegaciones internas apuntan a rutas muertas (/transfers/forms/...)

### Acciones recomendadas
1. Corregir navegaciones internas: `/transfers/forms/...` → `/forms/...`
2. Añadir entrada "Formularios" al sidebar (con moduleKey="forms")
3. O bien: si el módulo no se usa activamente, dejarlo como está (accesible solo por URL directa /forms)
