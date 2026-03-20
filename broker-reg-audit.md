# Auditoría del Flujo de Registro de Brokers

## Flujo completo:
1. Broker accede a `/broker/register` → BrokerRegister.tsx
2. Selecciona organización, rellena datos (nombre, empresa, email, teléfono, contraseña)
3. Submit → POST a Supabase Edge Function `request-broker-access`
4. Si OK → muestra pantalla de éxito "Solicitud Enviada"
5. Admin ve solicitudes en `/transfers/brokers` → tab "Solicitudes" → BrokerRegistrationList
6. Admin aprueba → RPC `approve_broker_registration`
7. Broker puede hacer login → BrokerAuthContext verifica perfil vía RPC `get_broker_profile`

## Problemas encontrados:

### 1. Selector de organizaciones - PROBLEMA DE SEGURIDAD/UX
- El registro carga TODAS las organizaciones activas de la base de datos
- Para una plataforma privada del grupo Azul, esto no tiene sentido
- Un broker externo no debería ver la lista de todas las organizaciones
- **Solución**: Pre-seleccionar la organización o usar un código de invitación

### 2. Flujo funcional - CORRECTO
- La lógica de submit es correcta: llama a Edge Function con los datos
- Los errores están bien mapeados (pending, rejected, email_exists, etc.)
- La pantalla de éxito es clara

### 3. Login post-aprobación - CORRECTO
- BrokerAuthContext maneja bien los estados: pending, rejected, no-access, inactive
- Después de aprobación, el RPC `get_broker_profile` devuelve el perfil

### 4. Admin side - CORRECTO
- BrokerManagement muestra solicitudes pendientes con badge de count
- Approve/Reject funciona con RPCs dedicados
- Realtime subscription actualiza la lista automáticamente

## Resumen:
El flujo es funcionalmente correcto. El principal problema es el selector de organizaciones
que debería simplificarse para la plataforma privada.
