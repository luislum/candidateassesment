export interface SimpleInvitePayload {
  version: 1;
  candidateId: string;
  candidateName: string;
  candidateEmail: string;
  variant: 'A' | 'B' | 'C';
  expiresAt: string;
  sessionId: string;
}

function toBase64Url(value: string) {
  const bytes = new TextEncoder().encode(value);
  let binary = '';
  bytes.forEach((b) => { binary += String.fromCharCode(b); });
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function fromBase64Url(value: string) {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((value.length + 3) % 4);
  const binary = atob(padded);
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

export function encodeSimpleInvite(payload: SimpleInvitePayload) {
  return `ca1_${toBase64Url(JSON.stringify(payload))}`;
}

export function decodeSimpleInvite(token: string): SimpleInvitePayload | null {
  if (!token.startsWith('ca1_')) return null;

  try {
    const parsed = JSON.parse(fromBase64Url(token.slice(4)));
    if (
      parsed?.version !== 1 ||
      typeof parsed?.candidateId !== 'string' ||
      typeof parsed?.candidateName !== 'string' ||
      typeof parsed?.candidateEmail !== 'string' ||
      !['A', 'B', 'C'].includes(parsed?.variant) ||
      typeof parsed?.expiresAt !== 'string' ||
      typeof parsed?.sessionId !== 'string'
    ) {
      return null;
    }
    return parsed as SimpleInvitePayload;
  } catch {
    return null;
  }
}
