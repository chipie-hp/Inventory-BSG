'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useStore } from '@/hooks/useStore'
import { useAuth } from '@/hooks/useAuth'
import AppLayout from '@/components/layout/AppLayout'
import { Card, CardHeader, CardBody, Button, StoreBadge, SeverityBadge, StatusBadge, Spinner, Badge } from '@/components/ui'
import type { Alert } from '@/types'

export default function AlertsPage() {
  const { activeStore } = useStore()
  const { user, hasRole } = useAuth()
  const supabase = createClient()
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [resolved, setResolved] = useState<Alert[]>([])
  const [loading, setLoading] = useState(true)
  const [investigateAlert, setInvestigateAlert] = useState<Alert | null>(null)

  useEffect(() => { load() }, [activeStore])

  async function load() {
    setLoading(true)
    let q = supabase.from('v_alerts').select('*')
    if (activeStore) q = q.eq('store_id' as any, activeStore.id)

    const [{ data: open }, { data: res }] = await Promise.all([
      q.in('status', ['open', 'escalated', 'under_review']).order('created_at' as any, { ascending: false }),
      supabase.from('v_alerts').select('*').in('status', ['resolved', 'dismissed']).limit(10).order('updated_at' as any, { ascending: false }),
    ])

    setAlerts(open ?? [])
    setResolved(res ?? [])
    setLoading(false)
  }

  async function escalate(alertId: string) {
    await supabase.from('alerts').update({ status: 'escalated', escalated_to: user!.id, escalated_at: new Date().toISOString() }).eq('id', alertId)
    load()
  }

  async function dismiss(alertId: string) {
    await supabase.from('alerts').update({ status: 'dismissed' }).eq('id', alertId)
    load()
  }

  async function resolve(alertId: string, action: string, notes: string) {
    await supabase.from('alerts').update({
      status: 'resolved', action_taken: action, investigation_notes: notes,
      resolved_by: user!.id, resolved_at: new Date().toISOString()
    }).eq('id', alertId)
    setInvestigateAlert(null)
    load()
  }

  const SEV_ORDER: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 }
  const sorted = [...alerts].sort((a, b) => (SEV_ORDER[a.severity] ?? 4) - (SEV_ORDER[b.severity] ?? 4))

  return (
    <AppLayout>
      <div style={{ padding: '16px 20px' }}>

        {loading ? <Spinner /> : (
          <>
            {/* Summary chips */}
            <div style={{ display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
              {[
                { label: 'Total Active', val: alerts.length, color: '#ef4444' },
                { label: 'High / Critical', val: alerts.filter(a => ['high','critical'].includes(a.severity)).length, color: '#ef4444' },
                { label: 'Repeat Offences', val: alerts.filter(a => a.is_repeat).length, color: '#f59e0b' },
                { label: 'Resolved This Month', val: resolved.length, color: '#22c55e' },
              ].map(c => (
                <div key={c.label} style={{ background: '#10111f', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 18, fontWeight: 700, color: c.color }}>{c.val}</span>
                  <span style={{ fontSize: 10, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '.5px' }}>{c.label}</span>
                </div>
              ))}
            </div>

            {/* Active alerts */}
            <div style={{ background: 'rgba(239,68,68,.06)', border: '1px solid rgba(239,68,68,.2)', borderRadius: 8, padding: '12px 14px', marginBottom: 14 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#ef4444', marginBottom: 12 }}>⚠ Active Discrepancy & Theft Alerts</div>
              {sorted.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '20px 0', fontSize: 12, color: 'rgba(239,68,68,.5)' }}>No active alerts — all clear!</div>
              ) : sorted.map(a => (
                <div key={a.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '10px 0', borderBottom: '1px solid rgba(239,68,68,.1)' }} className="last:border-0">
                  <div style={{ fontSize: 16, fontWeight: 700, color: '#ef4444', minWidth: 32, flexShrink: 0, paddingTop: 2 }}>
                    {a.variance_qty != null ? (a.variance_qty > 0 ? `+${a.variance_qty}` : a.variance_qty) : '?'}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12, color: '#ddd', marginBottom: 3 }}>
                      <strong style={{ color: '#fff' }}>{a.item_name}</strong>
                      &nbsp;<StoreBadge code={a.store_code} name={a.store_name} />
                      {a.is_repeat && <span style={{ marginLeft: 6, fontSize: 10, color: '#f59e0b', fontWeight: 600 }}>🔁 REPEAT ({a.repeat_count}x)</span>}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: 6 }}>{a.description}</div>
                    {a.last_issued_by_name && (
                      <div style={{ fontSize: 10, color: 'var(--text-3)' }}>Last issued by: <span style={{ color: '#f59e0b' }}>{a.last_issued_by_name}</span></div>
                    )}
                    {hasRole('admin', 'manager') && (
                      <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                        {a.status !== 'escalated' && <Button size="sm" variant="danger" onClick={() => escalate(a.id)}>Escalate</Button>}
                        <Button size="sm" variant="ghost" onClick={() => setInvestigateAlert(a)}>Investigate</Button>
                        <Button size="sm" variant="ghost" onClick={() => dismiss(a.id)}>Dismiss</Button>
                      </div>
                    )}
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <SeverityBadge severity={a.severity} />
                    <br />
                    <StatusBadge status={a.status} />
                    <div style={{ fontSize: 10, color: 'var(--text-3)', marginTop: 4 }}>
                      {new Date(a.created_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Resolved */}
            <Card>
              <CardHeader>Resolved / Dismissed</CardHeader>
              <div style={{ overflowX: 'auto' }}>
                <table>
                  <thead><tr><th>Item</th><th>Store</th><th>Variance</th><th>Resolution</th><th>Action Taken</th><th>Resolved By</th><th>Date</th></tr></thead>
                  <tbody>
                    {resolved.map(a => (
                      <tr key={a.id}>
                        <td style={{ color: '#fff' }}>{a.item_name}</td>
                        <td><StoreBadge code={a.store_code} /></td>
                        <td style={{ color: a.variance_qty != null && a.variance_qty < 0 ? '#ef4444' : '#22c55e', fontWeight: 600 }}>{a.variance_qty}</td>
                        <td><StatusBadge status={a.status} /></td>
                        <td style={{ maxWidth: 200, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.action_taken || '—'}</td>
                        <td>{a.resolved_by_name || '—'}</td>
                        <td>{a.updated_at ? new Date(a.updated_at).toLocaleDateString() : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </>
        )}

        {/* Investigate modal */}
        {investigateAlert && (
          <InvestigateModal alert={investigateAlert} onClose={() => setInvestigateAlert(null)} onResolve={resolve} />
        )}
      </div>
    </AppLayout>
  )
}

function InvestigateModal({ alert: a, onClose, onResolve }: { alert: Alert; onClose: () => void; onResolve: (id: string, action: string, notes: string) => void }) {
  const [notes, setNotes] = useState(a.investigation_notes || '')
  const [action, setAction] = useState(a.action_taken || '')
  const ACTIONS = ['Monitoring — Pending', 'Verbal Warning Issued', 'Written Warning Issued', 'Suspended Pending Investigation', 'Dismissed', 'Reported to Police', 'Write Off — Spoilage', 'Write Off — Damage']

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.7)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: '#10111f', border: '1px solid var(--border-2)', borderRadius: 10, width: '90%', maxWidth: 460 }}>
        <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h3 style={{ color: '#fff', fontSize: 13, fontWeight: 600 }}>⚠ Investigation — {a.item_name}</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-3)', cursor: 'pointer', fontSize: 18 }}>×</button>
        </div>
        <div style={{ padding: 16 }}>
          <div style={{ background: 'rgba(239,68,68,.07)', border: '1px solid rgba(239,68,68,.2)', borderRadius: 6, padding: 12, marginBottom: 14 }}>
            {[
              ['Store', `${a.store_name}`],
              ['Variance', `${a.variance_qty} units`],
              ['Raised', new Date(a.created_at).toLocaleString()],
              ['Last issued by', a.last_issued_by_name || 'Unknown'],
            ].map(([l, v]) => (
              <div key={l} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px solid rgba(239,68,68,.1)' }}>
                <span style={{ fontSize: 10, color: 'var(--text-3)' }}>{l}</span>
                <span style={{ fontSize: 11, color: '#fff', fontWeight: 500 }}>{v}</span>
              </div>
            ))}
          </div>
          <div style={{ marginBottom: 12 }}>
            <label style={{ display: 'block', fontSize: 10, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 4 }}>Investigation Notes</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Record findings, interviews, evidence..." style={{ height: 80 }} />
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 10, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 4 }}>Action Taken</label>
            <select value={action} onChange={e => setAction(e.target.value)}>
              <option value="">Select action...</option>
              {ACTIONS.map(ac => <option key={ac}>{ac}</option>)}
            </select>
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <Button variant="ghost" onClick={onClose}>Cancel</Button>
            <Button variant="danger" onClick={() => onResolve(a.id, action, notes)} disabled={!action}>Save & Resolve</Button>
          </div>
        </div>
      </div>
    </div>
  )
}
