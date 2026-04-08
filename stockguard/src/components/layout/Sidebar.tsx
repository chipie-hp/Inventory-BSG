'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import { useStore } from '@/hooks/useStore'
import {
  LayoutDashboard, AlertTriangle, Package, ArrowDownToLine,
  ArrowUpFromLine, SlidersHorizontal, BarChart3, History,
  Users, List, LogOut, ChevronDown
} from 'lucide-react'
import { useState } from 'react'

const NAV = [
  { group: 'Overview', items: [
    { href: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { href: '/alerts',    icon: AlertTriangle,   label: 'Theft Alerts', badge: true },
  ]},
  { group: 'Inventory', items: [
    { href: '/stock',       icon: Package,           label: 'Current Stock' },
    { href: '/receive',     icon: ArrowDownToLine,   label: 'Receive Stock' },
    { href: '/issue',       icon: ArrowUpFromLine,   label: 'Issue / Requisition' },
    { href: '/adjustments', icon: SlidersHorizontal, label: 'Adjustments' },
  ]},
  { group: 'Reports', items: [
    { href: '/valuation', icon: BarChart3, label: 'Stock Valuation' },
    { href: '/movements', icon: History,   label: 'Movement Log' },
  ]},
  { group: 'Admin', items: [
    { href: '/users', icon: Users, label: 'Users & Roles',  adminOnly: true },
    { href: '/items', icon: List,  label: 'Item Master',    adminOnly: false },
  ]},
]

const STORE_COLORS: Record<string, string> = {
  A1:  '#5ba3f5',
  JTI: '#a78bfa',
  A10: '#fb923c',
}

export default function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const { user, signOut, hasRole } = useAuth()
  const { stores, activeStore, setActiveStore } = useStore()
  const [storeOpen, setStoreOpen] = useState(false)

  async function handleSignOut() {
    await signOut()
    router.push('/login')
  }

  const canSeeAllStores = hasRole('admin', 'manager')

  return (
    <aside className="sidebar">
      {/* Logo */}
      <div className="sidebar-logo">
        <div className="sidebar-logo-icon">SG</div>
        <div>
          <div className="sidebar-logo-title">StockGuard</div>
          <div className="sidebar-logo-sub">Inventory System</div>
        </div>
      </div>

      {/* Store switcher */}
      <div className="store-switcher">
        <div className="store-switcher-label">Active Store</div>
        <div className="store-switcher-current" onClick={() => setStoreOpen(!storeOpen)}>
          <div className="store-dot" style={{ background: activeStore ? (STORE_COLORS[activeStore.code] || '#888') : '#22c55e' }} />
          <span>{activeStore ? activeStore.name : 'All Stores'}</span>
          {canSeeAllStores && <ChevronDown size={12} style={{ marginLeft: 'auto', color: 'var(--text-3)' }} />}
        </div>
        {storeOpen && canSeeAllStores && (
          <div className="store-dropdown animate-fadeIn">
            <div className="store-dropdown-item" onClick={() => { setActiveStore(null); setStoreOpen(false) }}>
              <div className="store-dot" style={{ background: '#22c55e' }} />
              <div>
                <div className="store-dropdown-name">All Stores</div>
                <div className="store-dropdown-loc">Manager view</div>
              </div>
              {activeStore === null && <span className="store-dropdown-check">✓</span>}
            </div>
            {stores.map(s => (
              <div key={s.id} className="store-dropdown-item" onClick={() => { setActiveStore(s); setStoreOpen(false) }}>
                <div className="store-dot" style={{ background: STORE_COLORS[s.code] || '#888' }} />
                <div>
                  <div className="store-dropdown-name">{s.name}</div>
                  <div className="store-dropdown-loc">{s.zone}</div>
                </div>
                {activeStore?.id === s.id && <span className="store-dropdown-check">✓</span>}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="sidebar-nav">
        {NAV.map(group => {
          const items = group.items.filter(i => !i.adminOnly || hasRole('admin'))
          if (!items.length) return null
          return (
            <div key={group.group} className="nav-group">
              <div className="nav-group-label">{group.group}</div>
              {items.map(item => {
                const active = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href))
                return (
                  <Link key={item.href} href={item.href} className={`nav-item ${active ? 'active' : ''}`}>
                    <item.icon size={14} />
                    <span>{item.label}</span>
                    {item.badge && <span className="nav-badge">4</span>}
                  </Link>
                )
              })}
            </div>
          )
        })}
      </nav>

      {/* User bar */}
      <div className="sidebar-userbar">
        <div className={`user-avatar role-${user?.profile.role}`}>
          {user?.profile.full_name.split(' ').map(n => n[0]).join('').slice(0,2).toUpperCase()}
        </div>
        <div className="user-info">
          <div className="user-name">{user?.profile.full_name}</div>
          <div className="user-role">{user?.profile.role.replace('_', ' ')}</div>
        </div>
        <button className="signout-btn" onClick={handleSignOut} title="Sign out">
          <LogOut size={14} />
        </button>
      </div>

      <style jsx>{`
        .sidebar { width:220px;min-width:220px;background:#10111f;border-right:1px solid var(--border);display:flex;flex-direction:column;height:100vh;overflow:hidden;flex-shrink:0 }
        .sidebar-logo { padding:14px 12px 12px;border-bottom:1px solid var(--border);display:flex;align-items:center;gap:10px }
        .sidebar-logo-icon { width:30px;height:30px;border-radius:7px;background:#1b2d45;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;color:var(--a1);flex-shrink:0 }
        .sidebar-logo-title { font-size:13px;font-weight:600;color:#fff }
        .sidebar-logo-sub { font-size:10px;color:var(--text-3);margin-top:1px }
        .store-switcher { padding:10px;border-bottom:1px solid var(--border);position:relative }
        .store-switcher-label { font-size:9px;text-transform:uppercase;letter-spacing:1px;color:var(--text-3);margin-bottom:5px }
        .store-switcher-current { display:flex;align-items:center;gap:7px;padding:7px 9px;border-radius:6px;background:rgba(255,255,255,.04);cursor:pointer;font-size:11px;color:#fff;font-weight:500 }
        .store-dot { width:7px;height:7px;border-radius:50%;flex-shrink:0 }
        .store-dropdown { position:absolute;left:10px;right:10px;top:calc(100% - 4px);background:#1e1f32;border:1px solid var(--border-2);border-radius:7px;z-index:100;overflow:hidden }
        .store-dropdown-item { display:flex;align-items:center;gap:8px;padding:9px 11px;cursor:pointer;transition:background .12s }
        .store-dropdown-item:hover { background:rgba(255,255,255,.05) }
        .store-dropdown-name { font-size:11px;color:#fff;font-weight:500 }
        .store-dropdown-loc { font-size:9px;color:var(--text-3) }
        .store-dropdown-check { margin-left:auto;color:#22c55e;font-size:11px }
        .sidebar-nav { flex:1;overflow-y:auto;padding:6px 0 }
        .nav-group { margin-bottom:2px }
        .nav-group-label { font-size:9px;color:var(--text-3);text-transform:uppercase;letter-spacing:.9px;padding:10px 14px 3px }
        :global(.nav-item) { display:flex;align-items:center;gap:8px;padding:7px 14px;cursor:pointer;color:var(--text-3);font-size:11px;font-weight:500;border-left:2px solid transparent;transition:all .12s;text-decoration:none }
        :global(.nav-item:hover) { color:var(--text-2);background:rgba(255,255,255,.02) }
        :global(.nav-item.active) { color:var(--a1);border-left-color:var(--a1);background:rgba(91,163,245,.06) }
        .nav-badge { margin-left:auto;background:#dc2626;color:#fff;font-size:9px;padding:1px 5px;border-radius:8px;font-weight:700 }
        .sidebar-userbar { padding:10px 12px;border-top:1px solid var(--border);display:flex;align-items:center;gap:8px }
        .user-avatar { width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;color:#fff;flex-shrink:0 }
        .role-admin { background:#dc2626 }
        .role-manager { background:#1e3a5f }
        .role-store_manager { background:#1e3a5f }
        .role-clerk { background:#374151 }
        .role-requester { background:#374151 }
        .user-info { flex:1;min-width:0 }
        .user-name { font-size:11px;color:#fff;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis }
        .user-role { font-size:9px;color:var(--text-3);text-transform:capitalize }
        .signout-btn { background:none;border:none;color:var(--text-3);cursor:pointer;padding:4px;border-radius:4px;display:flex;align-items:center }
        .signout-btn:hover { color:var(--text-2);background:rgba(255,255,255,.06) }
      `}</style>
    </aside>
  )
}
