'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useStore } from '@/hooks/useStore'
import { useAuth } from '@/hooks/useAuth'
import AppLayout from '@/components/layout/AppLayout'
import { Card, CardHeader, CardBody, Button, StoreBadge, StatusBadge, Spinner } from '@/components/ui'
import type { StockAdjustment, StoreStockRow } from '@/types'

const ADJ_TYPES = ['physical_count','spoilage','damage','theft','transfer','supplier_return','other']
const ADJ_LABELS: Record<string, string> = { physical_count:'Physical Count Correction', spoilage:'Spoilage / Damage', damage:'Breakage / Damage', theft:'Theft / Loss (Confirmed)', transfer:'Transfer Between Stores', supplier_return:'Supplier Return', other:'Other' }

export default function AdjustmentsPage() {
  const { activeStore, stores } = useStore()
  const { user, hasRole } = useAuth()
  const supabase = createClient()

  const [adjustments, setAdjustments] = useState<any[]>([])
  const [stockItems, setStockItems] = useState<StoreStockRow[]>([])
  const [loading, setLoading] = useState(true)

  // Form state
  const [selStore, setSelStore] = useState(activeStore?.id || '')
  const [itemId, setItemId] = useState('')
  const [adjType, setAdjType] = useState('physical_count')
  const [qtyAdjusted, setQtyAdjusted] = useState('')
  const [reason, setReason] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    if (activeStore) setSelStore(activeStore.id)
    loadAdj()
    loadStock()
  }, [activeStore])

  async function loadAdj() {
    setLoading(true)
    let q = supabase.from('stock_adjustments')
      .select('*, store:stores(name,code), item:items(name,code), requested_by_profile:profiles!requested_by(full_name)')
      .order('created_at', { ascending: false }).limit(30)
    if (activeStore) q = q.eq('store_id', activeStore.id)
    const { data } = await q
    setAdjustments(data ?? [])
    setLoading(false)
  }

  async function loadStock() {
    let q = supabase.from('v_store_stock').select('*').order('item_name')
    if (activeStore) q = q.eq('store_id', activeStore.id)
    const { data } = await q
    setStockItems(data ?? [])
  }

  const selectedStock = stockItems.find(s => s.item_id === itemId && s.store_id === selStore)
  const newQty = selectedStock ? selectedStock.current_qty + parseFloat(qtyAdjusted || '0') : null

  async function submitAdj() {
    if (!selStore || !itemId || !qtyAdjusted || !reason || !selectedStock) return
    setSubmitting(true)

    const qty = parseFloat(qtyAdjusted)
    const qtyAfter = Math.max(0, selectedStock.current_qty + qty)

    const { data: adj } = await supabase.from('stock_adjustments').insert({
      store_id: selStore,
      item_id: itemId,
      adjustment_type: adjType,
      qty_before: selectedStock.current_qty,
      qty_adjusted: qty,
      qty_after: qtyAfter,
      reason,
      requested_by: user!.id,
      status: hasRole('admin', 'manager') ? 'approved' : 'pending',
    }).select().single()

    if (adj && hasRole('admin', 'manager')) {
      await supabase.rpc('post_adjustment', { p_adj_id: adj.id, p_approver_id: user!.id })
    }

    setItemId(''); setQtyAdjusted(''); setReason(''); setAdjType('physical_count')
    setSuccess(true)
    setTimeout(() => setSuccess(false), 3000)
    loadAdj()
    setSubmitting(false)
  }

  async function approveAdj(adjId: string) {
    await supabase.rpc('post_adjustment', { p_adj_id: adjId, p_approver_id: user!.id })
    loadAdj()
  }

  async function rejectAdj(adjId: string) {
    await supabase.from('stock_adjustments').update({ status: 'rejected', approved_by: user!.id, approved_at: new Date().toISOString(), rejected_reason: 'Rejected by manager' }).eq('id', adjId)
    loadAdj()
  }

  return (
    <AppLayout>
      <div style={{ padding: '16px 20px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: 14 }}>

          {/* Adjustment Form */}
          <Card>
            <CardHeader>Stock Adjustment</CardHeader>
            <CardBody>
              {success && (
                <div style={{ background: 'rgba(34,197,94,.1)', border: '1px solid rgba(34,197,94,.25)', borderRadius: 6, padding: '9px 12px', marginBottom: 12, fontSize: 11, color: '#22c55e' }}>
                  ✓ Adjustment submitted successfully
                </div>
              )}

              {!activeStore && (
                <div style={{ marginBottom: 12 }}>
                  <label style={{ display: 'block', fontSize: 10, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 4 }}>Store</label>
                  <select value={selStore} onChange={e => { setSelStore(e.target.value); setItemId('') }}>
                    <option value="">Select store...</option>
                    {stores.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
              )}

              <div style={{ marginBottom: 12 }}>
                <label style={{ display: 'block', fontSize: 10, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 4 }}>Item</label>
                <select value={itemId} onChange={e => setItemId(e.target.value)}>
                  <option value="">Select item...</option>
                  {stockItems.filter(s => !selStore || s.store_id === selStore).map(s => (
                    <option key={s.item_id} value={s.item_id}>{s.item_name} (current: {s.current_qty} {s.unit_of_measure})</option>
                  ))}
                </select>
              </div>

              <div style={{ marginBottom: 12 }}>
                <label style={{ display: 'block', fontSize: 10, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 4 }}>Adjustment Type</label>
                <select value={adjType} onChange={e => setAdjType(e.target.value)}>
                  {ADJ_TYPES.map(t => <option key={t} value={t}>{ADJ_LABELS[t]}</option>)}
                </select>
              </div>

              <div style={{ marginBottom: 12 }}>
                <label style={{ display: 'block', fontSize: 10, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 4 }}>
                  Quantity Adjustment (+ to add, - to remove)
                </label>
                <input type="number" value={qtyAdjusted} onChange={e => setQtyAdjusted(e.target.value)} placeholder="e.g. -5 or +10" />
                {selectedStock && qtyAdjusted && (
                  <div style={{ fontSize: 10, color: 'var(--text-3)', marginTop: 4 }}>
                    Current: <strong style={{ color: '#fff' }}>{selectedStock.current_qty}</strong>
                    {' → '}
                    New: <strong style={{ color: newQty != null && newQty < 0 ? '#ef4444' : '#22c55e' }}>{Math.max(0, newQty ?? 0)}</strong>
                    {' '}{selectedStock.unit_of_measure}
                  </div>
                )}
              </div>

              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: 10, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 4 }}>Reason / Evidence</label>
                <textarea value={reason} onChange={e => setReason(e.target.value)} placeholder="Describe the reason. For theft: note who was on duty and any evidence." style={{ height: 70 }} />
              </div>

              <div style={{ background: 'rgba(239,68,68,.07)', border: '1px solid rgba(239,68,68,.18)', borderRadius: 5, padding: '9px 10px', marginBottom: 14, fontSize: 10, color: '#ef4444', lineHeight: 1.6 }}>
                ⚠ All adjustments are permanently logged with your name and timestamp. Negative adjustments require manager or admin approval before stock is updated.
              </div>

              <Button variant="primary" onClick={submitAdj} disabled={!selStore || !itemId || !qtyAdjusted || !reason || submitting} className="w-full">
                {submitting ? 'Submitting...' : hasRole('admin', 'manager') ? 'Apply Adjustment' : 'Submit for Approval'}
              </Button>
            </CardBody>
          </Card>

          {/* Adjustment History */}
          <Card>
            <CardHeader>Recent Adjustments</CardHeader>
            <CardBody className="p-0">
              {loading ? <Spinner /> : (
                <div style={{ overflowX: 'auto' }}>
                  <table>
                    <thead><tr><th>Item</th><th>Store</th><th>Qty</th><th>Type</th><th>By</th><th>Status</th><th></th></tr></thead>
                    <tbody>
                      {adjustments.map(a => (
                        <tr key={a.id}>
                          <td>
                            <div style={{ color: '#fff', fontWeight: 500 }}>{a.item?.name}</div>
                            <div style={{ fontSize: 9, color: 'var(--text-3)' }}>{a.adj_number}</div>
                          </td>
                          <td><StoreBadge code={a.store?.code} /></td>
                          <td style={{ color: a.qty_adjusted < 0 ? '#ef4444' : '#22c55e', fontWeight: 700 }}>
                            {a.qty_adjusted > 0 ? `+${a.qty_adjusted}` : a.qty_adjusted}
                          </td>
                          <td style={{ fontSize: 10 }}>{ADJ_LABELS[a.adjustment_type] || a.adjustment_type}</td>
                          <td>{a.requested_by_profile?.full_name}</td>
                          <td><StatusBadge status={a.status} /></td>
                          <td>
                            {a.status === 'pending' && hasRole('admin', 'manager') && (
                              <div style={{ display: 'flex', gap: 4 }}>
                                <Button size="sm" variant="success" onClick={() => approveAdj(a.id)}>✓</Button>
                                <Button size="sm" variant="danger" onClick={() => rejectAdj(a.id)}>✕</Button>
                              </div>
                            )}
                          </td>
                        </tr>
                      ))}
                      {adjustments.length === 0 && (
                        <tr><td colSpan={7} style={{ textAlign: 'center', color: 'var(--text-3)', padding: '20px 0' }}>No adjustments yet</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </CardBody>
          </Card>
        </div>
      </div>
    </AppLayout>
  )
}
