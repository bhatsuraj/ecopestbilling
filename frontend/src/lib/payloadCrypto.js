// AES-GCM payload obfuscation — mirror of /app/backend/payload_middleware.py.
// Decrypts response bodies of the shape:
//   { "__enc": 1, "iv": "<b64url>", "ct": "<b64url>" }
// so the React app sees plain JS objects while DevTools Network shows
// only ciphertext.

const KEY_B64 = process.env.REACT_APP_PAYLOAD_KEY || '';

function b64urlToBytes(str) {
  const pad = '='.repeat((4 - (str.length % 4)) % 4);
  const b64 = (str + pad).replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) out[i] = bin.charCodeAt(i);
  return out;
}

let _keyPromise = null;
function getKey() {
  if (!_keyPromise) {
    if (!KEY_B64) {
      _keyPromise = Promise.reject(new Error('REACT_APP_PAYLOAD_KEY missing'));
    } else {
      _keyPromise = window.crypto.subtle.importKey(
        'raw',
        b64urlToBytes(KEY_B64),
        { name: 'AES-GCM' },
        false,
        ['decrypt'],
      );
    }
  }
  return _keyPromise;
}

export function isEncryptedPayload(obj) {
  return (
    obj
    && typeof obj === 'object'
    && obj.__enc === 1
    && typeof obj.iv === 'string'
    && typeof obj.ct === 'string'
  );
}

export async function decryptPayload(payload) {
  const key = await getKey();
  const iv = b64urlToBytes(payload.iv);
  const ct = b64urlToBytes(payload.ct);
  const plainBuf = await window.crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    ct,
  );
  const text = new TextDecoder().decode(plainBuf);
  return JSON.parse(text);
}
