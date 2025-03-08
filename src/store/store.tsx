// store/store.ts
import { create } from 'zustand';

// Define the type for the global store
type GlobalStore = {
  fillWithSideBar: boolean;
  setFillWithSideBar: (fillWithSideBar: boolean) => void;
  avatar: string | null;
  setAvatar: (avatar: string) => void;
};

// Create the global store with the defined type
export const globalStore = create<GlobalStore>((set) => ({
  fillWithSideBar: false,
  setFillWithSideBar: (fillWithSideBar) => set({ fillWithSideBar }),
  avatar: null,
  setAvatar: (avatar) => set({ avatar }),
}));