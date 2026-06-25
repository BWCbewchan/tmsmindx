"use client";

import { createContext, useContext, useEffect, useState } from "react";

export type NavMode = 'sidebar' | 'dock'

interface SidebarContextType {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  toggle: () => void;
  // Dùng cho onboarding: yêu cầu sidebar mở rộng các submenu chứa label này
  requestExpandLabels: string[];
  setRequestExpandLabels: (labels: string[]) => void;
  // Navigation mode: sidebar or dock
  navMode: NavMode;
  setNavMode: (mode: NavMode) => void;
}

const SidebarContext = createContext<SidebarContextType | undefined>(undefined);

export function SidebarProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('tps_nav_mode')
      if (saved === 'dock') {
        return false;
      }
    }
    return true;
  });
  const [requestExpandLabels, setRequestExpandLabels] = useState<string[]>([]);
  const [navMode, setNavModeState] = useState<NavMode>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('tps_nav_mode') as NavMode | null
      if (saved === 'dock' || saved === 'sidebar') {
        return saved;
      }
    }
    return 'sidebar';
  });

  // Sync state on mount just in case
  useEffect(() => {
    const saved = localStorage.getItem('tps_nav_mode') as NavMode | null
    if (saved === 'dock' || saved === 'sidebar') {
      setNavModeState(saved)
      if (saved === 'dock') {
        setIsOpen(false)
      }
    }
  }, [])

  const setNavMode = (mode: NavMode) => {
    setNavModeState(mode)
    localStorage.setItem('tps_nav_mode', mode)
    if (mode === 'dock') {
      setIsOpen(false)
    } else {
      // When switching back to sidebar, open it on desktop
      if (typeof window !== 'undefined' && window.innerWidth >= 1024) {
        setIsOpen(true)
      }
    }
  }

  // Auto-collapse on mobile with debounce
  useEffect(() => {
    let timeoutId: NodeJS.Timeout;
    
    const handleResize = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        const isMobile = window.innerWidth < 1024;
        const isTablet = window.innerWidth >= 768 && window.innerWidth < 1024;
        
        if (isMobile || isTablet) {
          setIsOpen(false);
        } else {
          // Auto-open on desktop if it was closed by mobile resize
          // But not when in dock mode
          const savedMode = localStorage.getItem('tps_nav_mode')
          if (savedMode === 'dock') return
          const wasClosedByMobile = localStorage.getItem('sidebarClosedByMobile') === 'true';
          if (wasClosedByMobile) {
            setIsOpen(true);
            localStorage.removeItem('sidebarClosedByMobile');
          }
        }
      }, 150);
    };
    
    // Store initial state
    if (window.innerWidth < 1024) {
      localStorage.setItem('sidebarClosedByMobile', 'true');
    }
    
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => {
      clearTimeout(timeoutId);
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  const toggle = () => setIsOpen(!isOpen);

  return (
    <SidebarContext.Provider value={{ isOpen, setIsOpen, toggle, requestExpandLabels, setRequestExpandLabels, navMode, setNavMode }}>
      {children}
    </SidebarContext.Provider>
  );
}

export function useSidebar() {
  const context = useContext(SidebarContext);
  if (context === undefined) {
    throw new Error('useSidebar must be used within a SidebarProvider');
  }
  return context;
}