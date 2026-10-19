/// <reference types="jest" />
import { backend } from '../index.native';

jest.mock('expo-constants', () => ({ __esModule: true, default: { expoConfig: { extra: {} } } }));
jest.mock('@react-native-google-signin/google-signin', () => ({ GoogleSignin: {} }));
jest.mock('@react-native-firebase/auth', () => ({ GoogleAuthProvider: {} }));
jest.mock('@react-native-firebase/firestore', () => ({
  getFirestore: jest.fn(() => ({})),
  collection: jest.fn((_db: unknown, ...segments: string[]) => ({ path: segments.join('/') })),
  doc: jest.fn(),
}));

it('is the Firebase backend with a per-user Firestore repository', () => {
  const { collection } = jest.requireMock('@react-native-firebase/firestore');
  expect(backend.mode).toBe('firebase');
  const repo = backend.repository({ uid: 'abc', name: null, email: null, photoURL: null });
  expect(typeof repo.subscribeRange).toBe('function');
  expect(collection).toHaveBeenCalledWith(expect.anything(), 'users', 'abc', 'tasks');
});
