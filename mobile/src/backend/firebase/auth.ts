/**
 * Google sign-in (native account picker) → Firebase Auth credential.
 * Firebase keeps the session on the device, so the user stays signed in across restarts.
 */
import {
  GoogleAuthProvider,
  getAuth,
  onAuthStateChanged,
  signInWithCredential,
  signOut as firebaseSignOut,
  type User,
} from '@react-native-firebase/auth';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import Constants from 'expo-constants';
import type { AppUser } from '../../data/types';
import { signInError, toSignInError } from './errors';

type FirebaseUser = Pick<User, 'uid' | 'displayName' | 'email' | 'photoURL'>;

export function toAppUser(u: FirebaseUser): AppUser {
  return {
    uid: u.uid,
    name: u.displayName || null,
    email: u.email || null,
    photoURL: u.photoURL || null,
  };
}

/** The Web client ID from app.json `extra.googleWebClientId`, or null if missing / still the placeholder. */
export function readWebClientId(): string | null {
  const v: unknown = Constants.expoConfig?.extra?.googleWebClientId;
  if (typeof v !== 'string') return null;
  const id = v.trim();
  if (!id || id.startsWith('REPLACE_WITH') || !id.endsWith('.apps.googleusercontent.com')) return null;
  return id;
}

let configuredFor: string | null = null;

/** Configure Google Sign-In once. Returns false if the web client ID is not set up. */
function configureGoogle(): boolean {
  const webClientId = readWebClientId();
  if (!webClientId) return false;
  if (configuredFor !== webClientId) {
    GoogleSignin.configure({ webClientId });
    configuredFor = webClientId;
  }
  return true;
}

export function onAuthChanged(cb: (user: AppUser | null) => void): () => void {
  try {
    // Fires immediately with the persisted user (or null), then on every change.
    return onAuthStateChanged(getAuth(), (u) => cb(u ? toAppUser(u) : null));
  } catch (e) {
    console.warn('[auth] Firebase is not available (google-services.json?)', e);
    cb(null);
    return () => {};
  }
}

export async function signIn(): Promise<void> {
  try {
    if (!configureGoogle()) throw signInError('config');
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    const res = await GoogleSignin.signIn();
    if (res.type !== 'success') throw signInError('cancelled');
    // idToken is null when the web client ID does not belong to this Firebase project.
    const idToken = res.data.idToken;
    if (!idToken) throw signInError('config');
    await signInWithCredential(getAuth(), GoogleAuthProvider.credential(idToken));
  } catch (e) {
    const err = toSignInError(e);
    if (err.code !== 'cancelled') console.warn('[auth] sign-in failed', e);
    throw err;
  }
}

/** Signs out of Firebase and of Google (so the account picker shows again next time). */
export async function signOut(): Promise<void> {
  if (configureGoogle()) {
    await GoogleSignin.signOut().catch((e: unknown) => console.warn('[auth] Google sign-out failed', e));
  }
  await firebaseSignOut(getAuth());
}
