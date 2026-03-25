# Production Error Analysis - plan-mint.com/fleet

## Errors from screenshot (in order):

1. **Error 400** - Supabase query: `...fecha_entrada.desc:1` - query malformada con `.desc` en la URL
2. **Warning** - Missing `Description` or `aria-describedby=(undefined)` for `{DialogContent}` (x2)
3. **Error 429** - `/api/get-my-profile:1` - rate limiting 
4. **Failed to load module script** - `assets/FleetVehicle-cRF7ksh.js:1` - server responds text/html instead of JS
5. **Failed to load module script** - `assets/index-Dcf79m4v.js:1` - same MIME type issue
6. **Failed to load module script** - `assets/FleetList-D57C6GRN.js:1` - same MIME type issue
7. **TypeError** - Failed to fetch dynamically imported module: `https://plan-mint.com/assets/FleetList-D57C6GRN.js`
8. **Uncaught TypeError** - Same FleetList module fetch failure

## Root cause analysis:

### Module loading failures (errors 4-8):
These are the CRITICAL errors causing the blank page. When the server returns text/html for JS assets, 
it means the asset files don't exist on the deployed server and it's returning the SPA fallback (index.html).
This happens when:
- A new deployment changed the chunk hashes but the browser has cached old chunk references
- The Service Worker is caching old asset paths
- The build output doesn't match what's deployed

### The 429 error (error 3):
Rate limiting on get-my-profile triggers auth failure, which may cause a redirect loop or re-render
that tries to load modules again.

### The 400 error (error 1):
A Supabase query is using `.desc` in the wrong format - likely `.order('fecha_entrada.desc')` 
instead of `.order('fecha_entrada', { ascending: false })`.

## Action plan:
1. Fix the Supabase query format (fecha_entrada ordering)
2. Fix the 429 rate limiting on get-my-profile
3. Fix the Service Worker to not cache JS chunks aggressively / add retry logic for dynamic imports
4. Fix aria-describedby warnings
