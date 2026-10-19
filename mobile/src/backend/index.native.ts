/**
 * Firebase backend (Android): Google sign-in + Cloud Firestore with on-device persistence,
 * so tasks work offline and survive losing the phone. Web and tests use `index.ts` (local).
 * Setup steps: docs/FIREBASE_KURULUM.md.
 */
import type { Backend } from '../data/types';
import { onAuthChanged, signIn, signOut } from './firebase/auth';
import { createFirestoreRepository } from './firebase/firestoreRepository';

export const backend: Backend = {
  mode: 'firebase',
  onAuthChanged,
  signIn,
  signOut,
  repository: (user) => createFirestoreRepository(user.uid),
};
