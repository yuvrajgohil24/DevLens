'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard, Rocket, ShieldAlert, Server,
  GitBranch, AlertTriangle, Zap,
} from 'lucide-react';

const NAV = [
  { href: '/dashboard',          label: 'Dashboard',       color: 'var(--primary)' },
  { href: '/deployments',        label: 'Deployments',     color: 'var(--high)' },
  { href: '/vulnerabilities',    label: 'Vulnerabilities', color: 'var(--critical)' },
  { href: '/services',           label: 'Services',        color: 'var(--low)' },
  { href: '/devflow',            label: 'DevFlow',         color: 'var(--accent)' },
  { href: '/policy-violations',  label: 'Violations',      color: 'var(--warning)' },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="sidebar">
      {/* Logo */}
      <div style={{ padding: '24px 20px 20px', borderBottom: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 32, height: 32, borderRadius: 4,
            background: 'var(--text-primary)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Zap size={16} color="#000" strokeWidth={3} />
          </div>
          <div>
            <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: '0.95rem', lineHeight: 1.1, color: 'var(--text-primary)', textTransform: 'uppercase' }}>
              DevLens
            </div>
            <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)', fontWeight: 500, letterSpacing: '0.1em' }}>
              PLATFORM
            </div>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav style={{ padding: '12px 10px', flex: 1 }}>
        <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', padding: '8px 10px 4px' }}>
          Platform
        </div>
        {NAV.map(({ href, label, color }) => {
          const active = pathname === href || pathname.startsWith(href + '/');
          return (
            <Link key={href} href={href} style={{ textDecoration: 'none' }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '8px 10px', borderRadius: 0, marginBottom: 2,
                background: 'transparent',
                color: active ? 'var(--text-primary)' : 'var(--text-secondary)',
                fontSize: '0.8rem', fontWeight: active ? 600 : 400,
                borderRight: active ? `2px solid ${color}` : '2px solid transparent',
                transition: 'all 0.1s',
                cursor: 'pointer',
              }}
              onMouseEnter={e => {
                if (!active) {
                  (e.currentTarget as HTMLElement).style.color = 'var(--text-primary)';
                }
              }}
              onMouseLeave={e => {
                if (!active) {
                  (e.currentTarget as HTMLElement).style.color = 'var(--text-secondary)';
                }
              }}
              >
                <span style={{ 
                  width: 8, height: 8, borderRadius: '50%', background: color,
                  opacity: active ? 1 : 0.4,
                  boxShadow: active ? `0 0 8px ${color}` : 'none'
                }} />
                {label}
              </div>
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div style={{ padding: '16px 20px', borderTop: '1px solid var(--border)' }}>
        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
          Phase 1 MVP · v0.1.0
        </div>
      </div>
    </aside>
  );
}
