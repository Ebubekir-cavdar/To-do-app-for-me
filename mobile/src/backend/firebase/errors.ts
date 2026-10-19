/**
 * Sign-in error mapping: native Google Sign-In / Firebase Auth errors → short Turkish
 * messages the UI can show as-is. Pure (no native imports) so it is unit-testable.
 */

export type SignInErrorCode =
  | 'cancelled'
  | 'in-progress'
  | 'network'
  | 'config'
  | 'play-services'
  | 'account-disabled'
  | 'unknown';

/** An Error with a stable `code`. Check `code`, not `instanceof` (subclassing Error is unreliable after transpiling). */
export interface SignInError extends Error {
  code: SignInErrorCode;
  cause?: unknown;
}

export const SIGN_IN_MESSAGES: Record<SignInErrorCode, string> = {
  cancelled: 'Giriş iptal edildi.',
  'in-progress': 'Giriş zaten sürüyor, lütfen bekle.',
  network: 'İnternet bağlantısı yok. Bağlanıp tekrar dene.',
  config:
    "Google girişi ayarlı değil: Firebase'deki SHA-1 parmak izini ve app.json'daki web client ID'yi kontrol et (docs/FIREBASE_KURULUM.md).",
  'play-services': 'Bu cihazda Google Play Hizmetleri yok ya da güncel değil.',
  'account-disabled': 'Bu hesap devre dışı bırakılmış.',
  unknown: 'Giriş yapılamadı. Lütfen tekrar dene.',
};

export function signInError(code: SignInErrorCode, cause?: unknown, message = SIGN_IN_MESSAGES[code]): SignInError {
  const err = new Error(message) as SignInError;
  err.name = code === 'cancelled' ? 'SignInCancelledError' : 'SignInError';
  err.code = code;
  if (cause !== undefined) err.cause = cause;
  return err;
}

/** True for the "user closed the Google account picker" error — the UI should ignore it silently. */
export function isSignInCancelled(e: unknown): boolean {
  return isSignInError(e) && e.code === 'cancelled';
}

function isSignInError(e: unknown): e is SignInError {
  if (!(e instanceof Error) || (e.name !== 'SignInError' && e.name !== 'SignInCancelledError')) return false;
  const code = errorCode(e);
  return code !== null && code in SIGN_IN_MESSAGES;
}

// Android codes (com.google.android.gms GoogleSignInStatusCodes / CommonStatusCodes) and the
// string codes @react-native-google-signin/google-signin v16 rejects with.
const GOOGLE_CODES: Record<string, SignInErrorCode> = {
  '12501': 'cancelled', // SIGN_IN_CANCELLED
  SIGN_IN_CANCELLED: 'cancelled',
  '16': 'cancelled', // CommonStatusCodes.CANCELED
  ASYNC_OP_IN_PROGRESS: 'in-progress', // statusCodes.IN_PROGRESS
  '12502': 'in-progress', // SIGN_IN_CURRENTLY_IN_PROGRESS
  PLAY_SERVICES_NOT_AVAILABLE: 'play-services',
  '7': 'network', // NETWORK_ERROR
  '10': 'config', // DEVELOPER_ERROR — SHA-1 / web client ID mismatch
  '12500': 'config', // SIGN_IN_FAILED — in practice almost always a SHA-1 / OAuth consent setup issue
};

// Firebase Auth error codes (RNFirebase uses the web SDK's `auth/...` codes).
const FIREBASE_CODES: Record<string, SignInErrorCode> = {
  'auth/network-request-failed': 'network',
  'auth/user-disabled': 'account-disabled',
  'auth/invalid-credential': 'config',
  'auth/operation-not-allowed': 'config', // Google provider not enabled in the Firebase console
  'auth/app-not-authorized': 'config',
  'auth/invalid-api-key': 'config',
};

/** Convert anything thrown during sign-in into a SignInError with a Turkish message. */
export function toSignInError(e: unknown): SignInError {
  if (isSignInError(e)) return e;

  const code = errorCode(e);
  if (code) {
    const mapped = GOOGLE_CODES[code] ?? FIREBASE_CODES[code];
    if (mapped) return signInError(mapped, e);
  }

  const message = e instanceof Error ? e.message : typeof e === 'string' ? e : '';
  if (/DEVELOPER_ERROR/i.test(message)) return signInError('config', e);
  if (/No Firebase App|google-services|webClientId|offline use requires server web ClientID/i.test(message)) {
    return signInError('config', e);
  }
  if (/network|timeout|unreachable/i.test(message)) return signInError('network', e);
  return signInError('unknown', e);
}

function errorCode(e: unknown): string | null {
  if (typeof e !== 'object' || e === null || !('code' in e)) return null;
  const c = (e as { code: unknown }).code;
  if (typeof c === 'string') return c;
  if (typeof c === 'number') return String(c);
  return null;
}
