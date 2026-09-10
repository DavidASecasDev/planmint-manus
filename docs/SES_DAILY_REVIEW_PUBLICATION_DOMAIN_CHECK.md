# Verificación pública de dominios — SES Daily Review

**Fecha de comprobación:** 10 de septiembre de 2026, 17:47–17:49 UTC  
**Tipo de comprobación:** solo lectura  
**Checkpoint publicado:** `6939afcb`  
**Migración aplicada:** `ses_daily_review_batches_20260910`, versión Supabase `20260910173524`

## Resultado ejecutivo

Los dos dominios personalizados están conectados y responden actualmente. `https://plan-mint.com/ses-hospedajes` devuelve HTTP 200 y la aplicación redirige a `/auth/login` cuando no existe una sesión válida. `https://www.plan-mint.com/ses-hospedajes` devuelve HTTP 301 hacia la misma ruta del dominio raíz, que después carga el inicio de sesión.

No se reprodujo `Page not found`. La evidencia actual descarta que el dominio raíz esté desconectado. El error inicial es compatible con un estado transitorio de propagación, caché o publicación inmediatamente posterior, no con una configuración permanentemente rota.

## Dominios configurados

| Dominio | Estado configurado observado |
|---|---|
| `planmint-ixfk4yej.manus.space` | Configurado |
| `planmint-azulcars.manus.space` | Configurado |
| `plan-mint.com` | Configurado |
| `www.plan-mint.com` | Configurado |

La plataforma informó que la lista de dominios permaneció sin cambios después de la publicación.

## DNS y HTTP

| Comprobación | `plan-mint.com` | `www.plan-mint.com` |
|---|---|---|
| Resolución local | `104.18.26.246`, `104.18.27.246` | `104.19.168.112`, `104.19.169.112` |
| Cloudflare DNS | Coincide con resolución local | Coincide con resolución local |
| Google DNS | Coincide con resolución local | Coincide con resolución local |
| CNAME | Apex sin CNAME visible | `cname.manus.space` |
| HTTPS `/ses-hospedajes` | HTTP 200 | HTTP 301 |
| Destino efectivo | `/ses-hospedajes`, después `/auth/login` por la aplicación | `https://plan-mint.com/ses-hospedajes`, después `/auth/login` |
| Verificación TLS | Correcta | Correcta |
| `Page not found` | No reproducido | No reproducido |

Las cabeceras del dominio raíz incluían `cache-control: no-cache, no-store, must-revalidate`, `server: cloudflare` y `x-manus-proxy-mode: transparent/1`. El dominio `www` respondió con `Location: https://plan-mint.com/ses-hospedajes`.

## Navegación real

La apertura directa de ambos enlaces en navegador terminó en `https://plan-mint.com/auth/login` y mostró la pantalla de inicio de sesión de PlanMint. Este resultado es coherente con la expiración o pérdida de sesión comunicada por el usuario. No se intentó iniciar sesión ni se inspeccionaron credenciales.

La ruta protegida no puede mostrar `Revisar entregas` sin autenticación, pero el shell público y la redirección de autenticación sí cargan correctamente en ambos hosts.

## Publicación y migración

La publicación completada corresponde al checkpoint `6939afcb`, que contiene la implementación SES y el informe de aplicación. La migración de Supabase permanece registrada como `ses_daily_review_batches_20260910`, versión `20260910173524`.

No se creó ningún lote durante esta comprobación. Tampoco se modificaron DNS, secretos, autenticación o configuración de dominios; no se volvió a publicar; no se activó Heartbeat ni otro programador; y no se enviaron comunicaciones.

## Diagnóstico

> **Conclusión:** el dominio raíz no está desconectado. En el momento de la verificación, el apex sirve la aplicación con HTTP 200 y `www` redirige de forma canónica al apex con HTTP 301. El `Page not found` inicial debe tratarse como transitorio salvo que reaparezca de forma reproducible después de limpiar caché o desde otra red.

La reautenticación pendiente de David es un asunto de sesión separado del DNS. No se realizaron cambios porque la infraestructura pública ya presenta un comportamiento coherente.
