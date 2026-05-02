'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard, Rocket, ShieldAlert, Server,
  GitBranch, AlertTriangle, Zap,
} from 'lucide-react';

const NAV = [
  { href: '/dashboard',          label: 'Dashboard',       icon: LayoutDashboard },
  { href: '/deployments',        label: 'Deployments',     icon: Rocket },
  { href: '/vulnerabilities',    label: 'Vulnerabilities', icon: ShieldAlert },
  { href: '/services',           label: 'Services',        icon: Server },
  { href: '/devflow',            label: 'DevFlow',         icon: GitBranch },
  { href: '/policy-violations',  label: 'Violations',      icon: AlertTriangle },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="sidebar">
      {/* Logo */}
      <div style={{ padding: '24px 20px 20px', borderBottom: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 34, height: 34, borderRadius: 8,
            background: 'linear-gradient(135deg, var(--primary), var(--accent))',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 0 16px var(--primary-glow)',
          }}>
            <Zap size={18} color="#fff" strokeWidth={2.5} />
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: '1rem', letterSpacing: '-0.01em', color: 'var(--text-primary)' }}>
              DevLens
            </div>
            <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
              Developer Platform
            </div>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav style={{ padding: '12px 10px', flex: 1 }}>
        <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', padding: '8px 10px 4px' }}>
          Platform
        </div>
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + '/');
          return (
            <Link key={href} href={href} style={{ textDecoration: 'none' }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '9px 10px', borderRadius: 7, marginBottom: 2,
                background: active ? 'rgba(129,140,248,0.12)' : 'transparent',
                color: active ? 'var(--primary)' : 'var(--text-secondary)',
                fontSize: '0.875rem', fontWeight: active ? 600 : 400,
                border: active ? '1px solid rgba(129,140,248,0.2)' : '1px solid transparent',
                transition: 'all 0.15s',
                cursor: 'pointer',
              }}
              onMouseEnter={e => {
                if (!active) {
                  (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.04)';
                  (e.currentTarget as HTMLElement).style.color = 'var(--text-primary)';
                }
              }}
              onMouseLeave={e => {
                if (!active) {
                  (e.currentTarget as HTMLElement).style.background = 'transparent';
                  (e.currentTarget as HTMLElement).style.color = 'var(--text-secondary)';
                }
              }}
              >
                <Icon size={16} strokeWidth={active ? 2.5 : 2} />
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
