'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useStore } from '@/hooks/useStore'
import AppLayout from '@/components/layout/AppLayout'
import { Card, CardHeader, Button, StoreBadge, Badge, Spinner } from '@/components/ui'
import type { Movement } from '@/types'

const TYPE_BADGE: Record<string, any> = { receipt: 'green', issue: 'red', adjustment: 'amber', transfer: 'blue', return: 'purple' }

export default function MovementsPage() {
  const { activeStore } = useStore()
  const supabase = createClient()
  const [movements, setMovements] = useState<Movement[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [dateFrom, setDateFrom] = useState(new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0])

  useEffect(() => { load() }, [activeStore, dateFrom])

  async function load() {
    setLoading(true)
    let q = supabase.from('v_movements').select('*').gte('created_at', dateFrom).limit(200)
    if (activeStore) q = q.eq('store_id' as any, activeStore.id)
    const { data } = await q
    setMovements((data ?? []) as any)
    setLoading(false)
  }

  const filtered = movements.filter(m => {
    const mq = !search || m.item_name.toLowerCase().includes(search.toLowerCase()) || m.performed_by_name.toLowerCase().includes(search.toLowerCase())
    const mt = !typeFilter || m.movement_type === typeFilter
    return mq && mt
  })

  return (
    <AppLayout>
      <div style={{ padding: '16px 20px' }}>
        <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' }}>
          <input placeholder="Search item or staff..." value={search} onChange={e => setSearch(e.target.value)} style={{ flex: 1, minWidth: 150 }} />
          <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} style={{ width: 140 }}>
            <option value="">All Types</option>
            <option value="receipt">Receipt</option>
            <option value="issue">Issue</option>
            <option value="adjustment">Adjustment</option>
            <option value="transfer">Transfer</option>
          </select>
          <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} style={{ width: 150 }} />
          <Button variant="ghost" size="sm">Export CSV</Button>
          <span style={{ fontSize: 10, color: 'var(--text-3)' }}>{filtered.length} records</span>
        </div>

        <Card>
          <CardHeader>Movement Log — Full Audit Trail</CardHeader>
          {loading ? <Spinner /> : (
            <div style={{ overflowX: 'auto' }}>
              <table>
                <thead>
                  <tr><th>Date/Time</th><th>Type</th><th>Item</th><th>Store</th><th>In</th><th>Out</th><th>Balance</th><th>Unit Cost</th><th>By</th><th>Reference</th></tr>
                </thead>
                <tbody>
                  {filtered.map(m => (
                    <tr key={m.id}>
                      <td style={{ whiteSpace: 'nowrap', fontSize: 10 }}>
                        {new Date(m.created_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                      </td>
                      <td><Badge variant={TYPE_BADGE[m.movement_type] || 'muted'}>{m.movement_type}</Badge></td>
                      <td>
                        <div style={{ color: '#fff', fontWeight: 500 }}>{m.item_name}</div>
                        <div style={{ fontSize: 9, color: 'var(--text-3)' }}>{m.item_code}</div>
                      </td>
                      <td><StoreBadge code={m.store_code} /></td>
                      <td style={{ color: m.qty_in > 0 ? '#22c55e' : 'var(--text-3)', fontWeight: m.qty_in > 0 ? 600 : 400 }}>
                        {m.qty_in > 0 ? `+${m.qty_in}` : '—'}
                      </td>
                      <td style={{ color: m.qty_out > 0 ? '#ef4444' : 'var(--text-3)', fontWeight: m.qty_out > 0 ? 600 : 400 }}>
                        {m.qty_out > 0 ? `-${m.qty_out}` : '—'}
                      </td>
                      <td style={{ color: '#fff', fontWeight: 600 }}>{m.qty_after}</td>
                      <td>{m.unit_cost ? `$${Number(m.unit_cost).toFixed(2)}` : '—'}</td>
                      <td style={{ color: m.movement_type === 'adjustment' && m.qty_out > 0 ? '#f59e0b' : 'var(--text-2)' }}>
                        {m.performed_by_name}
                      </td>
                      <td style={{ fontSize: 10, color: 'var(--text-3)' }}>{m.reference_number || '—'}</td>
                    </tr>
                  ))}
                  {filtered.length === 0 && (
                    <tr><td colSpan={10} style={{ textAlign: 'center', color: 'var(--text-3)', padding: '20px 0' }}>No movements found</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </AppLayout>
  )
}
