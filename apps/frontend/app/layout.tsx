import type { Metadata } from 'next';
import './globals.css';
import { Sidebar } from '@/components/layout/Sidebar';
import { Header } from '@/components/layout/Header';
import { LiveAlertBanner } from '@/components/layout/LiveAlertBanner';
import { WebSocketProvider } from '@/components/providers/WebSocketProvider';
import { TooltipProvider } from '@/components/ui/tooltip';

export const metadata: Metadata = {
  title: 'DevLens — Developer Platform',
  description: 'Unified developer platform: Code → Deploy → Monitor → Secure',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&amp;family=JetBrains+Mono:wght@400;500&amp;display=swap" rel="stylesheet" />
      </head>
      <body>
        <WebSocketProvider>
          <TooltipProvider>
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
      </body>
    </html>
  );
}
