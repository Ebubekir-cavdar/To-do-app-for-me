/// <reference types="jest" />
/* eslint-disable @typescript-eslint/no-explicit-any */
import { onAuthChanged, readWebClientId, signIn, signOut, toAppUser } from '../firebase/auth';
import { isSignInCancelled, SIGN_IN_MESSAGES, toSignInError } from '../firebase/errors';

const VALID_ID = '1234-abc.apps.googleusercontent.com';

jest.mock('expo-constants', () => ({
  __esModule: true,
  default: { expoConfig: { extra: { googleWebClientId: '1234-abc.apps.googleusercontent.com' } } },
}));

jest.mock('@react-native-google-signin/google-signin', () => ({
  GoogleSignin: {
    configure: jest.fn(),
    hasPlayServices: jest.fn(() => Promise.resolve(true)),
    signIn: jest.fn(),
    signOut: jest.fn(() => Promise.resolve(null)),
  },
}));

jest.mock('@react-native-firebase/auth', () => ({
  getAuth: jest.fn(() => ({ kind: 'auth' })),
  onAuthStateChanged: jest.fn(),
  signInWithCredential: jest.fn(() => Promise.resolve({})),
  signOut: jest.fn(() => Promise.resolve()),
  GoogleAuthProvider: { credential: jest.fn((idToken: string) => ({ providerId: 'google.com', idToken })) },
}));

const Constants = jest.requireMock('expo-constants').default as any;
const { GoogleSignin } = jest.requireMock('@react-native-google-signin/google-signin') as any;
const fbAuth = jest.requireMock('@react-native-firebase/auth') as any;

const success = (idToken: string | null) => ({ type: 'success', data: { idToken, user: { id: 'g1' } } });
const nativeError = (code: string, message = 'native') => Object.assign(new Error(message), { code });

let warn: jest.SpyInstance;
beforeEach(() => {
  jest.clearAllMocks();
  Constants.expoConfig.extra.googleWebClientId = VALID_ID;
  warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => warn.mockRestore());

describe('signIn', () => {
  it('exchanges the Google idToken for a Firebase credential', async () => {
    GoogleSignin.signIn.mockResolvedValueOnce(success('tok'));
    await signIn();
    expect(GoogleSignin.configure).toHaveBeenCalledWith({ webClientId: VALID_ID });
    expect(GoogleSignin.hasPlayServices).toHaveBeenCalledWith({ showPlayServicesUpdateDialog: true });
    expect(fbAuth.GoogleAuthProvider.credential).toHaveBeenCalledWith('tok');
    expect(fbAuth.signInWithCredential).toHaveBeenCalledWith({ kind: 'auth' }, { providerId: 'google.com', idToken: 'tok' });
  });

  it('rejects with a distinct, ignorable error when the user cancels', async () => {
    GoogleSignin.signIn.mockResolvedValueOnce({ type: 'cancelled', data: null });
    const err = await signIn().catch((e) => e);
    expect(isSignInCancelled(err)).toBe(true);
    expect(err.message).toBe(SIGN_IN_MESSAGES.cancelled);
    expect(fbAuth.signInWithCredential).not.toHaveBeenCalled();
    expect(warn).not.toHaveBeenCalled();
  });

  it('explains SHA-1 / web client ID setup on DEVELOPER_ERROR', async () => {
    GoogleSignin.signIn.mockRejectedValueOnce(nativeError('10', 'DEVELOPER_ERROR: Follow troubleshooting'));
    const err = await signIn().catch((e) => e);
    expect(err.code).toBe('config');
    expect(err.message).toMatch(/SHA-1/);
    expect(err.message).toMatch(/web client ID/);
    expect(isSignInCancelled(err)).toBe(false);
  });

  it('reports a config problem when the web client ID is still the placeholder', async () => {
    Constants.expoConfig.extra.googleWebClientId = 'REPLACE_WITH_FIREBASE_WEB_CLIENT_ID.apps.googleusercontent.com';
    const err = await signIn().catch((e) => e);
    expect(err.code).toBe('config');
    expect(GoogleSignin.signIn).not.toHaveBeenCalled();
  });

  it('reports a config problem when Google returns no idToken', async () => {
    GoogleSignin.signIn.mockResolvedValueOnce(success(null));
    expect((await signIn().catch((e) => e)).code).toBe('config');
  });

  it('maps missing Play services', async () => {
    GoogleSignin.hasPlayServices.mockRejectedValueOnce(nativeError('PLAY_SERVICES_NOT_AVAILABLE'));
    const err = await signIn().catch((e) => e);
    expect(err.code).toBe('play-services');
    expect(err.message).toBe(SIGN_IN_MESSAGES['play-services']);
  });

  it('maps network failures from Google and Firebase', async () => {
    GoogleSignin.signIn.mockRejectedValueOnce(nativeError('7'));
    expect((await signIn().catch((e) => e)).code).toBe('network');

    GoogleSignin.signIn.mockResolvedValueOnce(success('tok'));
    fbAuth.signInWithCredential.mockRejectedValueOnce(nativeError('auth/network-request-failed'));
    expect((await signIn().catch((e) => e)).message).toBe(SIGN_IN_MESSAGES.network);
  });
});

describe('toSignInError', () => {
  it.each([
    ['12501', 'cancelled'],
    ['ASYNC_OP_IN_PROGRESS', 'in-progress'],
    ['12500', 'config'],
    ['auth/operation-not-allowed', 'config'],
    ['auth/user-disabled', 'account-disabled'],
    ['something-else', 'unknown'],
  ])('code %s -> %s', (code, expected) => {
    expect(toSignInError(nativeError(code)).code).toBe(expected);
  });

  it('handles non-Error values and keeps the cause', () => {
    const e = toSignInError('boom');
    expect(e).toBeInstanceOf(Error);
    expect(e.code).toBe('unknown');
    expect(e.cause).toBe('boom');
    expect(toSignInError(e)).toBe(e);
  });

  it('every message is short Turkish text', () => {
    for (const m of Object.values(SIGN_IN_MESSAGES)) expect(m.length).toBeLessThan(160);
  });
});

describe('auth state & sign-out', () => {
  it('maps Firebase users to AppUser', () => {
    expect(toAppUser({ uid: 'u1', displayName: 'Ayşe', email: 'a@b.c', photoURL: null })).toEqual({
      uid: 'u1', name: 'Ayşe', email: 'a@b.c', photoURL: null,
    });
    expect(toAppUser({ uid: 'u2', displayName: '', email: null, photoURL: '' } as any)).toEqual({
      uid: 'u2', name: null, email: null, photoURL: null,
    });
  });

  it('onAuthChanged forwards mapped users and returns the unsubscribe', () => {
    const unsub = jest.fn();
    fbAuth.onAuthStateChanged.mockImplementationOnce((_auth: unknown, next: (u: unknown) => void) => {
      next({ uid: 'u1', displayName: 'A', email: null, photoURL: null });
      next(null);
      return unsub;
    });
    const cb = jest.fn();
    expect(onAuthChanged(cb)).toBe(unsub);
    expect(cb.mock.calls).toEqual([[{ uid: 'u1', name: 'A', email: null, photoURL: null }], [null]]);
  });

  it('signOut signs out of both Google and Firebase', async () => {
    await signOut();
    expect(GoogleSignin.signOut).toHaveBeenCalled();
    expect(fbAuth.signOut).toHaveBeenCalledWith({ kind: 'auth' });
  });

  it('signOut still signs out of Firebase if Google sign-out fails', async () => {
    GoogleSignin.signOut.mockRejectedValueOnce(new Error('apiClient is null'));
    await signOut();
    expect(fbAuth.signOut).toHaveBeenCalled();
  });

  it('readWebClientId rejects placeholders', () => {
    expect(readWebClientId()).toBe(VALID_ID);
    Constants.expoConfig.extra.googleWebClientId = '';
    expect(readWebClientId()).toBeNull();
  });
});
