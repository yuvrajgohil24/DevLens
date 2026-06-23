import { Sidebar } from '@/components/layout/Sidebar';
import { Header } from '@/components/layout/Header';
import { LiveAlertBanner } from '@/components/layout/LiveAlertBanner';
import { DemoModeBanner } from '@/components/layout/DemoModeBanner';
import { WebSocketProvider } from '@/components/providers/WebSocketProvider';
import { TooltipProvider } from '@/components/ui/tooltip';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <WebSocketProvider>
      <TooltipProvider>
        <DemoModeBanner />
        <LiveAlertBanner />
        <div className="app-layout">
          <Sidebar />
          <div className="main-content">
            <Header />
            <main className="page-content">
              {children}
            </main>
          </div>
        </div>
      </TooltipProvider>
    </WebSocketProvider>
  );
}
