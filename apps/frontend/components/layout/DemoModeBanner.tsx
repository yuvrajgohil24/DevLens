'use client';

import { useDemoMode } from '@/lib/demo';
import { Eye } from 'lucide-react';

/**
 * Thin banner shown to visitors browsing as the public demo account, so it's
 * clear the data is sample data and write actions are disabled.
 */
export function DemoModeBanner() {
  const isDemo = useDemoMode();
  if (!isDemo) return null;

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        padding: '6px 16px',
        fontSize: '0.76rem',
        fontWeight: 600,
        color: '#fde68a',
        background: 'rgba(245, 158, 11, 0.12)',
        borderBottom: '1px solid rgba(245, 158, 11, 0.3)',
      }}
    >
      <Eye size={13} />
      Demo mode — you&apos;re viewing sample data as a guest. Changes are disabled.
    </div>
  );
}
