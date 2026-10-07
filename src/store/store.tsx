// store/store.ts
import { create } from 'zustand';

type GlobalStore = {
  /** A freshly uploaded avatar (data URL), shown right away before the account is refetched. */
  avatar: string | null;
  setAvatar: (avatar: string) => void;
};

export const globalStore = create<GlobalStore>()((set) => ({
  avatar: null,
  setAvatar: (avatar) => set({ avatar }),
}));
