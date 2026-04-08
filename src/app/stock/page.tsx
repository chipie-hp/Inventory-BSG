'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useStore } from '@/hooks/useStore'
import { useAuth } from '@/hooks/useAuth'
import AppLayout from '@/components/layout/AppLayout'
import { Card, CardHeader, CardBody, Button, Badge, StoreBadge, ProgressBar, Spinner, EmptyState } from '@/components/ui'
import type { StoreStockRow } from '@/types'

export default function StockPage() {
  const { activeStore } = useStore()
  const { hasRole } = useAuth()
  const [rows, setRows] = useState<StoreStockRow[]>([])
  const [search, setSearch] = useState('')
  const [filterStore, setFilterStore] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [loading, setLoading] = useState(true)
  const [showReceive, setShowReceive] = useState(false)
  const [showCount, setShowCount] = useState(false)
  const supabase = createClient()

  useEffect(() => { load() }, [activeStore])

  async function load() {
    setLoading(true)
    let q = supabase.from('v_store_stock').select('*').order('item_name')
    if (activeStore) q = q.eq('store_id', activeStore.id)
    const { data } = await q
    setRows(data ?? [])
    setLoading(false)
  }

  const filtered = rows.filter(r => {
    const mq = !search || r.item_name.toLowerCase().includes(search.toLowerCase())
    const ms = !filterStore || r.store_name === filterStore
    const mst = !filterStatus || r.stock_status === filterStatus
    return mq && ms && mst
  })

  const STATUS_COLOR: Record<string, string> = {
    good: '#22c55e', watch: '#f59e0b', low: '#ef4444', out_of_stock: '#ef4444'
  }
  const STATUS_LABEL: Record<string, string> = {
    good: 'Good', watch: 'Watch', low: 'Low Stock', out_of_stock: 'Out of Stock'
  }
  const STORE_BADGE: Record<string, any> = { 'Alliance 1': 'blue', JTI: 'purple', 'Area 10': 'orange' }

  return (
    <AppLayout>
      <div style={{ padding: '16px 20px' }}>

        {/* Filter bar */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' }}>
          <input placeholder="Search items..." value={search} onChange={e => setSearch(e.target.value)}
            style={{ flex: 1, minWidth: 140 }} />
          {!activeStore && (
            <select value={filterStore} onChange={e => setFilterStore(e.target.value)} style={{ width: 150 }}>
              <option value="">All Stores</option>
              <option>Alliance 1</option>
              <option>JTI</option>
              <option>Area 10</option>
            </select>
          )}
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={{ width: 140 }}>
            <option value="">All Status</option>
            <option value="low">Low Stock</option>
            <option value="watch">Watch</option>
            <option value="good">Good</option>
            <option value="out_of_stock">Out of Stock</option>
          </select>
          {hasRole('admin', 'manager', 'store_manager') && (
            <>
              <Button variant="primary" onClick={() => setShowReceive(true)}>+ Receive Stock</Button>
              <Button variant="ghost" onClick={() => setShowCount(true)}>Physical Count</Button>
            </>
          )}
        </div>

        <Card>
          <CardHeader action={<span style={{ fontSize: 10, color: 'var(--text-3)' }}>{filtered.length} items</span>}>
            Current Stock
          </CardHeader>
          <div style={{ overflowX: 'auto' }}>
            {loading ? <Spinner /> : filtered.length === 0 ? (
              <EmptyState icon="📦" title="No items found" description="Try adjusting your filters" />
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>Item</th>
                    <th>Store</th>
                    <th>Unit</th>
                    <th>Qty</th>
                    <th>Min</th>
                    <th>Stock Level</th>
                    <th>Unit Cost</th>
                    <th>Value</th>
                    <th>Status</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(r => (
                    <tr key={r.id}>
                      <td style={{ color: '#fff', fontWeight: 500 }}>
                        {(r.stock_status === 'low' || r.stock_status === 'out_of_stock') && '⚠ '}
                        {r.item_name}
                        <div style={{ fontSize: 9, color: 'var(--text-3)' }}>{r.item_code}</div>
                      </td>
                      <td><StoreBadge code={r.store_code} name={r.store_name} /></td>
                      <td style={{ color: 'var(--text-3)' }}>{r.unit_of_measure}</td>
                      <td style={{ color: STATUS_COLOR[r.stock_status], fontWeight: 700, fontSize: 13 }}>
                        {Number(r.current_qty).toFixed(1)}
                      </td>
                      <td style={{ color: 'var(--text-3)' }}>{r.min_level}</td>
                      <td style={{ minWidth: 90 }}>
                        <ProgressBar value={r.current_qty} max={r.max_level} color={STATUS_COLOR[r.stock_status]} />
                        <div style={{ fontSize: 9, color: 'var(--text-3)', marginTop: 2 }}>
                          {Math.round((r.current_qty / r.max_level) * 100)}% of max
                        </div>
                      </td>
                      <td>${Number(r.avg_unit_cost).toFixed(2)}</td>
                      <td style={{ color: '#fff', fontWeight: 600 }}>${Number(r.stock_value).toFixed(2)}</td>
                      <td>
                        <Badge variant={r.stock_status === 'good' ? 'green' : r.stock_status === 'watch' ? 'amber' : 'red'}>
                          {STATUS_LABEL[r.stock_status]}
                        </Badge>
                      </td>
                      <td>
                        <Button size="sm" variant="ghost">Update</Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </Card>

        {/* Physical Count Modal */}
        {showCount && <PhysicalCountModal onClose={() => { setShowCount(false); load() }} items={rows} />}
      </div>
    </AppLayout>
  )
}

function PhysicalCountModal({ onClose, items }: { onClose: () => void; items: StoreStockRow[] }) {
  const [itemId, setItemId] = useState('')
  const [counted, setCounted] = useState('')
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const supabase = createClient()
  const { user } = useAuth()

  const selected = items.find(i => i.item_id === itemId)

  async function submit() {
    if (!itemId || !counted || !selected) return
    setLoading(true)
    await supabase.rpc('process_physical_count', {
      p_store_id: selected.store_id,
      p_item_id: selected.item_id,
      p_counted_qty: parseFloat(counted),
      p_counter_id: user!.id,
      p_notes: notes || null,
    })
    setDone(true)
    setLoading(false)
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.7)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: '#10111f', border: '1px solid var(--border-2)', borderRadius: 10, width: '90%', maxWidth: 420 }}>
        <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h3 style={{ color: '#fff', fontSize: 13, fontWeight: 600 }}>Physical Count Entry</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-3)', cursor: 'pointer', fontSize: 18 }}>×</button>
        </div>
        <div style={{ padding: 16 }}>
          {done ? (
            <div style={{ textAlign: 'center', padding: '20px 0' }}>
              <div style={{ fontSize: 28, marginBottom: 8 }}>✓</div>
              <div style={{ color: '#22c55e', fontWeight: 600 }}>Count submitted!</div>
              {selected && parseFloat(counted) !== selected.current_qty && (
                <div style={{ marginTop: 8, fontSize: 12, color: '#ef4444' }}>
                  ⚠ Variance detected: {(parseFloat(counted) - selected.current_qty).toFixed(1)} {selected.unit_of_measure}. Alert raised.
                </div>
              )}
              <Button variant="ghost" onClick={onClose} className="mt-4">Close</Button>
            </div>
          ) : (
            <>
              <div style={{ background: 'rgba(245,158,11,.08)', border: '1px solid rgba(245,158,11,.2)', borderRadius: 6, padding: 10, marginBottom: 14, fontSize: 11, color: '#f59e0b', lineHeight: 1.5 }}>
                ⚠ Any difference between system qty and counted qty will auto-flag as a discrepancy alert.
              </div>
              <div style={{ marginBottom: 12 }}>
                <label style={{ display: 'block', fontSize: 10, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 4 }}>Item</label>
                <select value={itemId} onChange={e => setItemId(e.target.value)}>
                  <option value="">Select item...</option>
                  {items.map(i => <option key={i.item_id} value={i.item_id}>{i.item_name} — {i.store_name}</option>)}
                </select>
              </div>
              {selected && (
                <div style={{ marginBottom: 12 }}>
                  <label style={{ display: 'block', fontSize: 10, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 4 }}>System Qty (auto)</label>
                  <input type="number" value={selected.current_qty} readOnly style={{ opacity: .5 }} />
                </div>
              )}
              <div style={{ marginBottom: 12 }}>
                <label style={{ display: 'block', fontSize: 10, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 4 }}>Physical Count (actual)</label>
                <input type="number" value={counted} onChange={e => setCounted(e.target.value)} placeholder="Enter counted qty" />
              </div>
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: 10, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 4 }}>Notes</label>
                <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Any notes..." style={{ height: 52 }} />
              </div>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <Button variant="ghost" onClick={onClose}>Cancel</Button>
                <Button variant="primary" onClick={submit} disabled={!itemId || !counted || loading}>
                  {loading ? 'Submitting...' : 'Submit Count'}
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
