/**
 * Shared utility for parsing user agent strings into human-readable device names.
 * Used by both useUserSessions hook and AuthContext to avoid circular dependencies.
 */
export function parseUserAgent(ua: string | null): string {
  if (!ua) return 'Desconocido';

  if (ua.includes('Mobile') || ua.includes('Android') || ua.includes('iPhone')) {
    if (ua.includes('Android')) return 'Android';
    if (ua.includes('iPhone') || ua.includes('iPad')) return 'iOS';
    return 'Móvil';
  }

  if (ua.includes('Windows')) return 'Windows';
  if (ua.includes('Mac')) return 'macOS';
  if (ua.includes('Linux')) return 'Linux';

  return 'Navegador';
}
