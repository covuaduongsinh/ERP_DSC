"use client";

import { create } from "zustand";

interface UIState {
  sidebarOpen: boolean;
  isMobile: boolean;
  searchOpen: boolean;
  /** Nhóm điều hướng đang thu gọn (mặc định: tất cả mở). Key = group key. */
  collapsedGroups: Record<string, boolean>;
  setSidebarOpen: (open: boolean) => void;
  toggleSidebar: () => void;
  setIsMobile: (mobile: boolean) => void;
  toggleGroup: (key: string) => void;
  openSearch: () => void;
  closeSearch: () => void;
}

export const useUIStore = create<UIState>((set) => ({
  sidebarOpen: typeof window !== "undefined" ? window.innerWidth >= 768 : true,
  isMobile: typeof window !== "undefined" ? window.innerWidth < 768 : false,
  searchOpen: false,
  collapsedGroups: {},
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  setIsMobile: (mobile) => set({ isMobile: mobile }),
  toggleGroup: (key) =>
    set((s) => ({
      collapsedGroups: { ...s.collapsedGroups, [key]: !s.collapsedGroups[key] },
    })),
  openSearch: () => set({ searchOpen: true }),
  closeSearch: () => set({ searchOpen: false }),
}));
