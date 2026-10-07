// store/store.ts
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

type GlobalStore = {
  /** Desktop sidebar: expanded (icons + labels) or collapsed (icons only). */
  sidebarExpanded: boolean;
  setSidebarExpanded: (expanded: boolean) => void;
  toggleSidebar: () => void;
  /** Mobile sidebar: slide-over drawer opened from the top bar. */
  mobileMenuOpen: boolean;
  setMobileMenuOpen: (open: boolean) => void;
  avatar: string | null;
  setAvatar: (avatar: string) => void;
};

export const globalStore = create<GlobalStore>()(
  persist(
    (set) => ({
      sidebarExpanded: false,
      setSidebarExpanded: (sidebarExpanded) => set({ sidebarExpanded }),
      toggleSidebar: () => set((state) => ({ sidebarExpanded: !state.sidebarExpanded })),
      mobileMenuOpen: false,
      setMobileMenuOpen: (mobileMenuOpen) => set({ mobileMenuOpen }),
      avatar: null,
      setAvatar: (avatar) => set({ avatar }),
    }),
    {
      name: 'tunisiaflicks-ui',
      storage: createJSONStorage(() => localStorage),
      // Only remember the desktop sidebar choice.
      partialize: (state) => ({ sidebarExpanded: state.sidebarExpanded }),
      // Rehydrated after mount (see Sidebar) so server and client markup match.
      skipHydration: true,
    }
  )
);
