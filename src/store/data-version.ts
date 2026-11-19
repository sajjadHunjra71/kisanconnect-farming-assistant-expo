import { create } from 'zustand';

import { onLocalWrite } from '@/db/events';

/** Bumped after every local write and every sync run, so screens re-query. */
export const useDataVersion = create<{ version: number; bump: () => void }>((set) => ({
  version: 0,
  bump: () => set((s) => ({ version: s.version + 1 })),
}));

onLocalWrite(() => useDataVersion.getState().bump());
