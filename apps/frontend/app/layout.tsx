import type { Metadata } from 'next';
import './globals.css';
import { ClerkProvider } from '@clerk/nextjs';
import { Inter, Plus_Jakarta_Sans, JetBrains_Mono } from 'next/font/google';

// Self-hosted by Next.js at build time (variable fonts: every weight included)
const inter = Inter({ subsets: ['latin'], display: 'swap', variable: '--font-inter' });
const jakarta = Plus_Jakarta_Sans({ subsets: ['latin'], display: 'swap', variable: '--font-jakarta' });
const jetbrainsMono = JetBrains_Mono({ subsets: ['latin'], style: ['normal', 'italic'], display: 'swap', variable: '--font-jetbrains-mono' });

export const metadata: Metadata = {
  title: 'DevLens — Developer Platform',
  description: 'Unified developer platform: Code → Deploy → Monitor → Secure',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider>
      <html lang="en" className={`dark ${inter.variable} ${jakarta.variable} ${jetbrainsMono.variable}`}>
        <body>
          {children}
        </body>
      </html>
    </ClerkProvider>
  );
}
