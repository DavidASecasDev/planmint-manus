type UnknownRecord = Record<string, unknown>;

function record(value: unknown): UnknownRecord {
  return value && typeof value === 'object' ? value as UnknownRecord : {};
}

function safePath(value: unknown): string {
  if (typeof value !== 'string') return '';
  try {
    return new URL(value, 'http://localhost').pathname;
  } catch {
    return value.split(/[?#]/, 1)[0] ?? '';
  }
}

export function sanitizeNetworkEntries(entries: unknown[]): UnknownRecord[] {
  return entries.map((value) => {
    const entry = record(value);
    const response = record(entry.response);
    return {
      timestamp: entry.timestamp,
      type: entry.type,
      method: entry.method,
      url: safePath(entry.url),
      status: response.status,
      duration: entry.duration,
      failed: Boolean(entry.error),
    };
  });
}

export function sanitizeConsoleEntries(entries: unknown[]): UnknownRecord[] {
  return entries.map((value) => {
    const entry = record(value);
    return { timestamp: entry.timestamp, level: entry.level ?? entry.type, content_redacted: true };
  });
}

export function sanitizeSessionEntries(entries: unknown[]): UnknownRecord[] {
  return entries.map((value) => {
    const entry = record(value);
    return { timestamp: entry.timestamp, type: entry.type, content_redacted: true };
  });
}
