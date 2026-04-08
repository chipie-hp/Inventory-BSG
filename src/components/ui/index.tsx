import { ReactNode } from 'react'
import { clsx } from 'clsx'

// ── Badge ──────────────────────────────────────────────────
type BadgeVariant = 'green' | 'red' | 'amber' | 'blue' | 'purple' | 'orange' | 'muted'

const BADGE_STYLES: Record<BadgeVariant, string> = {
  green:  'bg-emerald-500/10 text-emerald-400',
  red:    'bg-red-500/10 text-red-400',
  amber:  'bg-amber-500/10 text-amber-400',
  blue:   'bg-blue-400/10 text-blue-400',
  purple: 'bg-violet-400/10 text-violet-400',
  orange: 'bg-orange-400/10 text-orange-400',
  muted:  'bg-white/5 text-[var(--text-3)]',
}

export function Badge({ children, variant = 'muted', className }: {
  children: ReactNode; variant?: BadgeVariant; className?: string
}) {
  return (
    <span className={clsx('inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold', BADGE_STYLES[variant], className)}>
      {children}
    </span>
  )
}

// Store-specific badge
const STORE_BADGE: Record<string, BadgeVariant> = { A1: 'blue', JTI: 'purple', A10: 'orange' }
export function StoreBadge({ code, name }: { code: string; name?: string }) {
  return <Badge variant={STORE_BADGE[code] || 'muted'}>{name || code}</Badge>
}

// Alert severity badge
export function SeverityBadge({ severity }: { severity: string }) {
  const map: Record<string, BadgeVariant> = { critical: 'red', high: 'red', medium: 'amber', low: 'blue' }
  return <Badge variant={map[severity] || 'muted'}>{severity}</Badge>
}

// Status badge
export function StatusBadge({ status }: { status: string }) {
  const map: Record<string, BadgeVariant> = {
    good: 'green', watch: 'amber', low: 'red', out_of_stock: 'red',
    open: 'red', escalated: 'red', under_review: 'amber', resolved: 'green', dismissed: 'muted',
    posted: 'green', submitted: 'blue', draft: 'muted', verified: 'green',
    pending: 'amber', approved: 'green', issued: 'green', rejected: 'red', cancelled: 'muted',
    active: 'green', flagged: 'red',
  }
  const label = status.replace(/_/g, ' ')
  return <Badge variant={map[status] || 'muted'}>{label}</Badge>
}

// ── Card ───────────────────────────────────────────────────
export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={clsx('rounded-lg border overflow-hidden', className)}
      style={{ background: '#10111f', borderColor: 'var(--border)' }}>
      {children}
    </div>
  )
}

export function CardHeader({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex items-center justify-between px-4 py-2.5 border-b"
      style={{ borderColor: 'var(--border)' }}>
      <h3 className="text-xs font-semibold text-white">{children}</h3>
      {action && <div className="flex items-center gap-2">{action}</div>}
    </div>
  )
}

export function CardBody({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={clsx('p-4', className)}>{children}</div>
}

// ── Button ─────────────────────────────────────────────────
type ButtonVariant = 'primary' | 'danger' | 'ghost' | 'success'

const BTN_STYLES: Record<ButtonVariant, string> = {
  primary: 'bg-blue-500/10 text-blue-400 border border-blue-400/25 hover:bg-blue-500/20',
  danger:  'bg-red-500/10 text-red-400 border border-red-400/25 hover:bg-red-500/20',
  ghost:   'bg-white/5 text-[var(--text-2)] border border-white/10 hover:bg-white/10 hover:text-white',
  success: 'bg-emerald-500/10 text-emerald-400 border border-emerald-400/20 hover:bg-emerald-500/20',
}

export function Button({ children, variant = 'ghost', size = 'md', onClick, disabled, type = 'button', className }: {
  children: ReactNode; variant?: ButtonVariant; size?: 'sm' | 'md'; onClick?: () => void;
  disabled?: boolean; type?: 'button' | 'submit'; className?: string
}) {
  const sizeClass = size === 'sm' ? 'px-2.5 py-1 text-[10px]' : 'px-3 py-1.5 text-xs'
  return (
    <button type={type} onClick={onClick} disabled={disabled}
      className={clsx('rounded font-semibold transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed', sizeClass, BTN_STYLES[variant], className)}>
      {children}
    </button>
  )
}

// ── KPI Card ───────────────────────────────────────────────
export function KpiCard({ label, value, sub, subType, danger }: {
  label: string; value: string | number; sub?: string; subType?: 'up' | 'down' | 'neutral'; danger?: boolean
}) {
  return (
    <div className={clsx('rounded-lg border p-3', danger ? 'border-red-500/25 bg-red-500/5' : 'border-white/7 bg-[#10111f]')}
      style={{ borderColor: danger ? 'rgba(239,68,68,.25)' : 'var(--border)' }}>
      <div className="text-[9px] uppercase tracking-wide" style={{ color: 'var(--text-3)' }}>{label}</div>
      <div className={clsx('text-xl font-bold mt-1 mb-0.5', danger ? 'text-red-400' : 'text-white')}>{value}</div>
      {sub && (
        <div className={clsx('text-[10px]',
          subType === 'up' ? 'text-emerald-400' :
          subType === 'down' ? 'text-red-400' : 'text-[var(--text-3)]')}>
          {sub}
        </div>
      )}
    </div>
  )
}

// ── Alert Panel ────────────────────────────────────────────
export function AlertPanel({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-lg border p-3"
      style={{ background: 'rgba(239,68,68,.06)', borderColor: 'rgba(239,68,68,.2)' }}>
      {children}
    </div>
  )
}

// ── Form Group ─────────────────────────────────────────────
export function FormGroup({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="mb-3">
      <label className="block text-[9px] uppercase tracking-wide mb-1" style={{ color: 'var(--text-3)' }}>
        {label}
      </label>
      {children}
    </div>
  )
}

// ── Progress Bar ───────────────────────────────────────────
export function ProgressBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = Math.min(Math.round((value / max) * 100), 100)
  return (
    <div className="h-1 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,.06)' }}>
      <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
    </div>
  )
}

// ── Activity Item ──────────────────────────────────────────
type ActType = 'receipt' | 'issue' | 'adjustment' | 'alert'
const ACT_COLORS: Record<ActType, string> = {
  receipt: '#22c55e', issue: '#ef4444', adjustment: '#f59e0b', alert: '#ef4444'
}

export function ActivityItem({ type, title, sub }: { type: ActType; title: string; sub: string }) {
  return (
    <div className="flex items-start gap-2 py-2 border-b last:border-0" style={{ borderColor: 'rgba(255,255,255,.04)' }}>
      <div className={clsx('w-1.5 h-1.5 rounded-full flex-shrink-0 mt-1.5', type === 'alert' && 'animate-blink')}
        style={{ background: ACT_COLORS[type] }} />
      <div>
        <div className="text-[11px]" style={{ color: 'var(--text-2)' }}>{title}</div>
        <div className="text-[10px]" style={{ color: 'var(--text-3)' }}>{sub}</div>
      </div>
    </div>
  )
}

// ── Stat Row ───────────────────────────────────────────────
export function StatRow({ label, value, valueColor }: { label: string; value: string | number; valueColor?: string }) {
  return (
    <div className="flex items-center justify-between py-1.5 border-b last:border-0" style={{ borderColor: 'rgba(255,255,255,.04)' }}>
      <span className="text-[10px]" style={{ color: 'var(--text-3)' }}>{label}</span>
      <span className="text-[11px] font-medium" style={{ color: valueColor || '#fff' }}>{value}</span>
    </div>
  )
}

// ── Empty State ────────────────────────────────────────────
export function EmptyState({ icon, title, description }: { icon: string; title: string; description: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="text-4xl mb-3 opacity-20">{icon}</div>
      <div className="text-sm font-medium text-white mb-1">{title}</div>
      <div className="text-xs" style={{ color: 'var(--text-3)' }}>{description}</div>
    </div>
  )
}

// ── Loading spinner ────────────────────────────────────────
export function Spinner() {
  return (
    <div className="flex items-center justify-center py-16">
      <div className="w-6 h-6 border-2 rounded-full animate-spin"
        style={{ borderColor: 'var(--border-2)', borderTopColor: 'var(--a1)' }} />
    </div>
  )
}

// ── Section heading ────────────────────────────────────────
export function SectionHeading({ children }: { children: ReactNode }) {
  return <h2 className="text-sm font-semibold text-white mb-3">{children}</h2>
}
