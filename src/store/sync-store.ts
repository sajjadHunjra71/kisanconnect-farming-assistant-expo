import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import type { SyncTable } from '@/db/types';

export type SyncStatus = 'saved-locally' | 'syncing' | 'synced' | 'offline' | 'error';

export type FailedOp = { opId: string; table: SyncTable; rowId: string; error: string | null };
export type ConflictNote = { table: SyncTable; id: string; at: string };

type SyncState = {
  status: SyncStatus;
  pending: number;
  failed: FailedOp[];
  /** "Updated from another device" notes, keyed `table:id`. */
  conflicts: Record<string, ConflictNote>;
  lastSyncedAt: string | null;
  lastError: string | null;
  /** Session ended on its own with unsent changes; kept until that user signs in again. */
  sessionLoss: { userId: string; count: number } | null;
  set: (patch: Partial<Omit<SyncState, 'set' | 'addConflicts' | 'dismissConflict' | 'reset'>>) => void;
  addConflicts: (notes: ConflictNote[]) => void;
  dismissConflict: (table: SyncTable, id: string) => void;
  reset: () => void;
};

const initial = { status: 'synced' as SyncStatus, pending: 0, failed: [], conflicts: {}, lastSyncedAt: null, lastError: null };

export const useSyncStore = create<SyncState>()(
  persist(
    (set) => ({
      ...initial,
      sessionLoss: null,
      set: (patch) => set(patch),
      addConflicts: (notes) =>
        set((s) => {
          if (notes.length === 0) return s;
          const conflicts = { ...s.conflicts };
          for (const n of notes) conflicts[`${n.table}:${n.id}`] = n;
          return { conflicts };
        }),
      dismissConflict: (table, id) =>
        set((s) => {
          const conflicts = { ...s.conflicts };
          delete conflicts[`${table}:${id}`];
          return { conflicts };
        }),
      reset: () => set(initial),
    }),
    {
      name: 'kisanconnect-sync',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({ sessionLoss: s.sessionLoss }),
    },
  ),
);

export const conflictFor = (table: SyncTable, id: string) => (s: SyncState) => s.conflicts[`${table}:${id}`] ?? null;
