'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useStore } from '@/hooks/useStore'
import { useAuth } from '@/hooks/useAuth'
import AppLayout from '@/components/layout/AppLayout'
import { Card, CardHeader, CardBody, Button, StoreBadge, StatusBadge, Spinner, Badge } from '@/components/ui'
import type { Requisition, Item, StoreStockRow } from '@/types'

type Tab = 'new' | 'pending' | 'issued'

export default function IssuePage() {
  const [tab, setTab] = useState<Tab>('new')
  const { activeStore, stores } = useStore()
  const { user, hasRole } = useAuth()
  const supabase = createClient()

  const [items, setItems] = useState<StoreStockRow[]>([])
  const [requisitions, setRequisitions] = useState<Requisition[]>([])
  const [selectedStore, setSelectedStore] = useState(activeStore?.id || '')
  const [department, setDepartment] = useState('')
  const [purpose, setPurpose] = useState('')
  const [lines, setLines] = useState<{ item_id: string; item_name: string; max: number; unit: string; qty: number }[]>([])
  const [submitting, setSubmitting] = useState(false)

  const DEPTS = ['Kitchen — Shift A', 'Kitchen — Shift B', 'Bar / Main Bar', 'Pool Bar', 'Restaurant', 'Housekeeping', 'Maintenance', 'Laundry', 'Front Office']

  useEffect(() => {
    if (activeStore) setSelectedStore(activeStore.id)
    loadItems()
    loadReqs()
  }, [activeStore])

  async function loadItems() {
    let q = supabase.from('v_store_stock').select('*').order('item_name')
    if (activeStore) q = q.eq('store_id', activeStore.id)
    else if (selectedStore) q = q.eq('store_id', selectedStore)
    const { data } = await q
    setItems(data ?? [])
  }

  async function loadReqs() {
    let q = supabase.from('requisitions')
      .select('*, store:stores(name,code), requested_by_profile:profiles!requested_by(full_name)')
      .order('created_at', { ascending: false })
      .limit(30)
    if (activeStore) q = q.eq('store_id', activeStore.id)
    const { data } = await q
    setRequisitions((data ?? []) as any)
  }

  function addItem(stockRow: StoreStockRow) {
    if (lines.find(l => l.item_id === stockRow.item_id)) return
    setLines(prev => [...prev, { item_id: stockRow.item_id, item_name: stockRow.item_name, max: stockRow.current_qty, unit: stockRow.unit_of_measure, qty: 1 }])
  }

  function updateQty(item_id: string, qty: number) {
    setLines(prev => prev.map(l => l.item_id === item_id ? { ...l, qty: Math.max(1, Math.min(qty, l.max)) } : l))
  }

  async function submitReq() {
    if (!selectedStore || !department || lines.length === 0) return
    setSubmitting(true)

    const { data: req } = await supabase.from('requisitions').insert({
      store_id: selectedStore,
      department,
      purpose,
      requested_by: user!.id,
      status: hasRole('admin', 'manager', 'store_manager') ? 'approved' : 'pending',
    }).select().single()

    if (req) {
      await supabase.from('requisition_lines').insert(
        lines.map(l => ({ req_id: req.id, item_id: l.item_id, qty_requested: l.qty }))
      )
      if (hasRole('admin', 'manager', 'store_manager')) {
        await supabase.rpc('post_requisition', { p_req_id: req.id, p_user_id: user!.id })
      }
    }

    setLines([])
    setDepartment('')
    setPurpose('')
    loadReqs()
    setTab('pending')
    setSubmitting(false)
  }

  async function approveAndIssue(reqId: string) {
    await supabase.rpc('post_requisition', { p_req_id: reqId, p_user_id: user!.id })
    loadReqs()
  }

  async function rejectReq(reqId: string) {
    await supabase.from('requisitions').update({ status: 'rejected', rejected_by: user!.id, rejected_at: new Date().toISOString(), rejection_reason: 'Rejected by manager' }).eq('id', reqId)
    loadReqs()
  }

  const pending = requisitions.filter(r => r.status === 'pending')
  const issued = requisitions.filter(r => r.status === 'issued')

  return (
    <AppLayout>
      <div style={{ padding: '16px 20px' }}>
        {/* Tabs */}
        <div style={{ display: 'flex', gap: 2, background: 'rgba(255,255,255,.03)', borderRadius: 7, padding: 3, marginBottom: 14, width: 'fit-content' }}>
          {([['new', 'New Requisition'], ['pending', `Pending (${pending.length})`], ['issued', 'Issued Today']] as [Tab, string][]).map(([t, label]) => (
            <button key={t} onClick={() => setTab(t)} style={{
              padding: '5px 12px', borderRadius: 5, border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 600,
              background: tab === t ? 'var(--bg-3)' : 'none',
              color: tab === t ? '#fff' : 'var(--text-3)',
            }}>{label}</button>
          ))}
        </div>

        {tab === 'new' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: 14 }}>
            <Card>
              <CardHeader>Issue Requisition Form</CardHeader>
              <CardBody>
                {!activeStore && (
                  <div style={{ marginBottom: 12 }}>
                    <label style={{ display: 'block', fontSize: 10, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 4 }}>From Store</label>
                    <select value={selectedStore} onChange={e => { setSelectedStore(e.target.value); loadItems() }}>
                      <option value="">Select store...</option>
                      {stores.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                  </div>
                )}
                <div style={{ marginBottom: 12 }}>
                  <label style={{ display: 'block', fontSize: 10, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 4 }}>Issued To (Department)</label>
                  <select value={department} onChange={e => setDepartment(e.target.value)}>
                    <option value="">Select department...</option>
                    {DEPTS.map(d => <option key={d}>{d}</option>)}
                  </select>
                </div>
                <div style={{ marginBottom: 14 }}>
                  <label style={{ display: 'block', fontSize: 10, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 4 }}>Purpose / Reason</label>
                  <textarea value={purpose} onChange={e => setPurpose(e.target.value)} placeholder="Reason for this requisition..." style={{ height: 52 }} />
                </div>

                {lines.length > 0 && (
                  <div style={{ marginBottom: 14, border: '1px solid var(--border)', borderRadius: 6, overflow: 'hidden' }}>
                    <table>
                      <thead><tr><th>Item</th><th>Available</th><th>Qty</th><th></th></tr></thead>
                      <tbody>
                        {lines.map(l => (
                          <tr key={l.item_id}>
                            <td style={{ color: '#fff' }}>{l.item_name}</td>
                            <td style={{ color: 'var(--text-3)' }}>{l.max} {l.unit}</td>
                            <td><input type="number" value={l.qty} onChange={e => updateQty(l.item_id, parseInt(e.target.value))} min={1} max={l.max} style={{ width: 60 }} /></td>
                            <td><button onClick={() => setLines(p => p.filter(x => x.item_id !== l.item_id))} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer' }}>×</button></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                <div style={{ display: 'flex', gap: 8 }}>
                  <Button variant="primary" onClick={submitReq} disabled={!selectedStore || !department || lines.length === 0 || submitting} className="flex-1">
                    {submitting ? 'Submitting...' : hasRole('admin', 'manager', 'store_manager') ? 'Issue Now' : 'Submit for Approval'}
                  </Button>
                  <Button variant="ghost">Draft</Button>
                </div>
              </CardBody>
            </Card>

            <Card>
              <CardHeader>Select Items to Issue</CardHeader>
              <CardBody className="p-0">
                <div style={{ overflowX: 'auto', maxHeight: 480, overflowY: 'auto' }}>
                  <table>
                    <thead><tr><th>Item</th><th>Store</th><th>Qty</th><th>Status</th><th></th></tr></thead>
                    <tbody>
                      {items.map(r => (
                        <tr key={r.id}>
                          <td style={{ color: '#fff' }}>{r.item_name}</td>
                          <td><StoreBadge code={r.store_code} /></td>
                          <td style={{ color: r.current_qty <= r.min_level ? '#ef4444' : '#22c55e', fontWeight: 600 }}>{r.current_qty} {r.unit_of_measure}</td>
                          <td><StatusBadge status={r.stock_status} /></td>
                          <td>
                            <Button size="sm" variant={lines.find(l => l.item_id === r.item_id) ? 'success' : 'ghost'}
                              onClick={() => addItem(r)} disabled={r.current_qty <= 0}>
                              {lines.find(l => l.item_id === r.item_id) ? '✓ Added' : '+ Add'}
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardBody>
            </Card>
          </div>
        )}

        {tab === 'pending' && (
          <Card>
            <CardHeader>Pending Requisitions — Awaiting Approval</CardHeader>
            {pending.length === 0 ? (
              <CardBody><div style={{ textAlign: 'center', padding: '20px 0', fontSize: 12, color: 'var(--text-3)' }}>No pending requisitions</div></CardBody>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table>
                  <thead><tr><th>Req #</th><th>Store</th><th>Department</th><th>Purpose</th><th>Requested By</th><th>Time</th><th>Actions</th></tr></thead>
                  <tbody>
                    {pending.map(r => (
                      <tr key={r.id}>
                        <td style={{ color: '#fff', fontWeight: 600 }}>{r.req_number}</td>
                        <td><StoreBadge code={(r.store as any)?.code} name={(r.store as any)?.name} /></td>
                        <td>{r.department}</td>
                        <td style={{ maxWidth: 160, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.purpose || '—'}</td>
                        <td>{(r as any).requested_by_profile?.full_name}</td>
                        <td>{new Date(r.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                        <td>
                          {hasRole('admin', 'manager', 'store_manager') && (
                            <div style={{ display: 'flex', gap: 6 }}>
                              <Button size="sm" variant="success" onClick={() => approveAndIssue(r.id)}>Approve & Issue</Button>
                              <Button size="sm" variant="danger" onClick={() => rejectReq(r.id)}>Reject</Button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        )}

        {tab === 'issued' && (
          <Card>
            <CardHeader>Issued — Recent</CardHeader>
            <div style={{ overflowX: 'auto' }}>
              <table>
                <thead><tr><th>Date</th><th>Req #</th><th>Store</th><th>Department</th><th>Requested By</th><th>Status</th></tr></thead>
                <tbody>
                  {issued.map(r => (
                    <tr key={r.id}>
                      <td>{new Date(r.issued_at || r.created_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}</td>
                      <td style={{ color: '#fff', fontWeight: 600 }}>{r.req_number}</td>
                      <td><StoreBadge code={(r.store as any)?.code} name={(r.store as any)?.name} /></td>
                      <td>{r.department}</td>
                      <td>{(r as any).requested_by_profile?.full_name}</td>
                      <td><StatusBadge status={r.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </div>
    </AppLayout>
  )
}
