# Versión aislada de publicación SES sobre 6939afcb

**Base publicada:** `6939afcb34336f5630bc16156b4a451cf5f76b55`  
**Fuente SES validada:** `4f619ac6bb22ffa45c9e0a104c78b4ac04801402`  
**Tareas preservado:** `5677996efd3485fd1d132eb83c34e8ecd636cd8e`

## Método

Se creó el worktree `/home/ubuntu/planmint-ses-release-6939` y la rama `ses-release-isolated` directamente desde el checkpoint publicado. Después se copiaron únicamente archivos SES seleccionados del checkpoint `4f619ac6`. No se utilizó `reset`, no se eliminó ninguna referencia y los checkpoints de Tareas y del desarrollo SES completo siguen siendo recuperables.

## Alcance

El diff contiene solo componentes, tipos, helpers, handlers, pruebas, fixtures y documentación de SES, más los dos adaptadores compartidos estrictamente necesarios: `server/syncRently.ts` y `server/rentlyCanonicalAdapter.test.ts`. No contiene archivos de Tareas, Calendario, Horarios/Schedules ni migraciones SQL.

Los cambios incluyen las correcciones previas de revisión diaria —rango histórico, cobertura/progreso honesto, cola prioritaria y precisión documental— y la clasificación no destructiva de cancelaciones Rently, contadores, filtros, revisión diaria y defensa XML.

## Verificación

Todos los archivos funcionales coinciden byte a byte con su versión en `4f619ac6`. La suite aislada aprobó **194/194 pruebas en 41 archivos**. `pnpm check` y `pnpm build` finalizaron correctamente; solo permanecen los avisos históricos de tamaño de chunks y Browserslist.

## Selección para publicar

Manus publica la versión correspondiente al checkpoint seleccionado. Para evitar incluir Tareas, debe publicarse exclusivamente el nuevo checkpoint aislado resultante de esta rama, no `4f619ac6` ni `5677996e`. Publicar el checkpoint aislado no elimina ni sobrescribe esos checkpoints; siguen disponibles para una publicación posterior independiente.

