/*
 * Azul Cars Brand — App Layout
 * Main area bg: #F5F3EF (warm off-white) via --background
 * Sidebar: dark navy #001321
 */
import { ReactNode, useState, useEffect } from 'react';
import { SidebarProvider } from '@/components/ui/sidebar';
import { AppSidebar } from './AppSidebar';
import { AppHeader } from './AppHeader';
import { OfflineBanner } from '@/components/offline/OfflineBanner';
import { ConflictModal } from '@/components/offline/ConflictModal';
import { useSyncEngine, ConflictInfo, ConflictResolution } from '@/hooks/useSyncEngine';
// SyncStatusIndicator is now rendered inline in AppHeader
import { useRealtimeNotifications } from '@/hooks/useRealtimeNotifications';

interface AppLayoutProps {
  children: ReactNode;
  title: string;
}

export function AppLayout({ children, title }: AppLayoutProps) {
  const { conflicts, resolveConflict } = useSyncEngine();
  const [currentConflict, setCurrentConflict] = useState<ConflictInfo | null>(null);
  
  useRealtimeNotifications();

  useEffect(() => {
    if (conflicts.length > 0 && !currentConflict) {
      setCurrentConflict(conflicts[0]);
    }
  }, [conflicts, currentConflict]);

  const handleResolveConflict = async (resolution: ConflictResolution) => {
    if (currentConflict) {
      await resolveConflict(currentConflict, resolution);
      setCurrentConflict(null);
    }
  };

  return (
    <SidebarProvider>
      <div className="flex h-screen w-full" style={{ backgroundColor: '#F5F3EF' }}>
        <AppSidebar />
        <div className="flex flex-1 flex-col min-w-0">
          <OfflineBanner />
          <AppHeader title={title} />
          <main className="flex-1 overflow-auto p-4 md:p-6 lg:p-8">
            <div className="mx-auto max-w-7xl animate-in h-full">
              {children}
            </div>
          </main>
        </div>
      </div>
      
      <ConflictModal
        conflict={currentConflict}
        onResolve={handleResolveConflict}
        onClose={() => setCurrentConflict(null)}
      />

    </SidebarProvider>
  );
}
