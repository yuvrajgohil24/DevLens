import type { Metadata } from 'next';
import './globals.css';
import { ClerkProvider } from '@clerk/nextjs';

export const metadata: Metadata = {
  title: 'DevLens — Developer Platform',
  description: 'Unified developer platform: Code → Deploy → Monitor → Secure',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider>
      <html lang="en" className="dark">
        <head>
          <link rel="preconnect" href="https://fonts.googleapis.com" />
          <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
          <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&family=JetBrains+Mono:ital,wght@0,300;0,400;0,500;0,600;0,700;1,300;1,400;1,500&display=swap" rel="stylesheet" />
        </head>
        <body>
          {children}
        </body>
      </html>
    </ClerkProvider>
  );
}
