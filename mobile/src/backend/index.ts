/**
 * Local backend: no login, data on this device only. Used on web (design preview)
 * and in tests. On Android, Metro picks `index.native.ts` (Firebase) instead.
 */
import type { AppUser, Backend, TaskRepository } from '../data/types';
import { createLocalRepository } from './localRepository';

const LOCAL_USER: AppUser = { uid: 'local', name: 'Önizleme', email: null, photoURL: null };
let repo: TaskRepository | null = null;

export const backend: Backend = {
  mode: 'local',
  onAuthChanged(cb) {
    cb(LOCAL_USER);
    return () => {};
  },
  async signIn() {},
  async signOut() {},
  repository() {
    return (repo ||= createLocalRepository('todoapp.tasks.v1', { seed: true }));
  },
};
