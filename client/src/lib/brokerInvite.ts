/**
 * Broker Invite Link Utilities
 * 
 * Encodes/decodes organization IDs for broker registration invite links.
 * The invite code is a Base64-encoded JSON payload containing the org ID
 * and a timestamp, making it slightly opaque while remaining stateless.
 */

interface InvitePayload {
  /** Organization ID */
  o: string;
  /** Timestamp (ms) when the invite was created */
  t: number;
}

/**
 * Generate an invite code from an organization ID.
 * The code is a URL-safe Base64 string.
 */
export function generateBrokerInviteCode(organizationId: string): string {
  const payload: InvitePayload = {
    o: organizationId,
    t: Date.now(),
  };
  const json = JSON.stringify(payload);
  // Use btoa for Base64, then make URL-safe
  return btoa(json).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * Decode an invite code and return the organization ID.
 * Returns null if the code is invalid.
 */
export function decodeBrokerInviteCode(code: string): string | null {
  try {
    // Restore standard Base64 from URL-safe variant
    let base64 = code.replace(/-/g, '+').replace(/_/g, '/');
    // Add padding if needed
    while (base64.length % 4 !== 0) {
      base64 += '=';
    }
    const json = atob(base64);
    const payload: InvitePayload = JSON.parse(json);

    // Validate payload shape
    if (!payload.o || typeof payload.o !== 'string') {
      return null;
    }

    // UUID format check (basic)
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(payload.o)) {
      return null;
    }

    return payload.o;
  } catch {
    return null;
  }
}

/**
 * Build the full broker registration URL with invite code.
 */
export function buildBrokerInviteLink(organizationId: string): string {
  const code = generateBrokerInviteCode(organizationId);
  return `${window.location.origin}/broker/register?invite=${code}`;
}
