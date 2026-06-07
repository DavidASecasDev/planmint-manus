export const COOKIE_NAME = "app_session_id";
export const ONE_YEAR_MS = 1000 * 60 * 60 * 24 * 365;
export const AXIOS_TIMEOUT_MS = 30_000;
export const UNAUTHED_ERR_MSG = 'Please login (10001)';
export const NOT_ADMIN_ERR_MSG = 'You do not have required permission (10002)';

// Organization IDs
export const AZUL_CARS_ORG_ID = 'a23a0d42-5af7-4cda-9955-569c10cc6714';

// Organization slug → ID mapping for public endpoints
export const ORG_SLUG_MAP: Record<string, string> = {
  'azul-ops': AZUL_CARS_ORG_ID,
};

// Plates to exclude from public views (dummy/test vehicles)
export const EXCLUDED_PLATES = ['6513MFG'];
