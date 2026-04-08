'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useStore } from '@/hooks/useStore'
import { useAuth } from '@/hooks/useAuth'
import AppLayout from '@/components/layout/AppLayout'
import { Card, CardHeader, CardBody, Button, Badge, StoreBadge, ActivityItem, StatusBadge, Spinner } from '@/components/ui'
import type { GRN, Item, Store } from '@/types'

interface GRNLine { item_id: string; item_name: string; qty_ordered: number; qty_received: number; unit_cost: number; condition: 'good' | 'damaged' | 'partial'; condition_notes: string }

export default function ReceivePage() {
  const { activeStore, stores } = useStore()
  const { user } = useAuth()
  const supabase = createClient()

  const [items, setItems] = useState<Item[]>([])
  const [recentGRNs, setRecentGRNs] = useState<GRN[]>([])
  const [lines, setLines] = useState<GRNLine[]>([])
  const [selectedStore, setSelectedStore] = useState(activeStore?.id || '')
  const [supplier, setSupplier] = useState('')
  const [invoiceNo, setInvoiceNo] = useState('')
  const [deliveryDate, setDeliveryDate] = useState(new Date().toISOString().split('T')[0])
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState<string | null>(null)

  useEffect(() => {
    loadItems()
    loadRecentGRNs()
    if (activeStore) setSelectedStore(activeStore.id)
  }, [activeStore])

  async function loadItems() {
    const { data } = await supabase.from('items').select('*').eq('is_active', true).order('name')
    setItems(data ?? [])
  }

  async function loadRecentGRNs() {
    let q = supabase.from('grns').select('*, store:stores(name,code)').order('created_at', { ascending: false }).limit(6)
    if (activeStore) q = q.eq('store_id', activeStore.id)
    const { data } = await q
    setRecentGRNs(data ?? [])
  }

  function addLine() {
    setLines(prev => [...prev, { item_id: '', item_name: '', qty_ordered: 0, qty_received: 0, unit_cost: 0, condition: 'good', condition_notes: '' }])
  }

  function updateLine(idx: number, field: keyof GRNLine, value: any) {
    setLines(prev => prev.map((l, i) => {
      if (i !== idx) return l
      if (field === 'item_id') {
        const item = items.find(it => it.id === value)
        return { ...l, item_id: value, item_name: item?.name || '' }
      }
      return { ...l, [field]: value }
    }))
  }

  function removeLine(idx: number) { setLines(prev => prev.filter((_, i) => i !== idx)) }

  async function submitGRN() {
    if (!selectedStore || lines.length === 0) return
    setSubmitting(true)

    // Create GRN
    const { data: grn, error } = await supabase.from('grns').insert({
      store_id: selectedStore,
      supplier_name: supplier,
      invoice_number: invoiceNo,
      delivery_date: deliveryDate,
      notes,
      received_by: user!.id,
      status: 'submitted',
    }).select().single()

    if (error || !grn) { setSubmitting(false); return }

    // Insert lines
    await supabase.from('grn_lines').insert(
      lines.filter(l => l.item_id).map(l => ({
        grn_id: grn.id,
        item_id: l.item_id,
        qty_ordered: l.qty_ordered,
        qty_received: l.qty_received,
        unit_cost: l.unit_cost,
        condition: l.condition,
        condition_notes: l.condition_notes || null,
      }))
    )

    // Post the GRN (updates stock)
    await supabase.rpc('post_grn', { p_grn_id: grn.id, p_user_id: user!.id })

    setSubmitted(grn.id)
    setLines([])
    setSupplier('')
    setInvoiceNo('')
    setNotes('')
    loadRecentGRNs()
    setSubmitting(false)
  }

  const lineTotal = lines.reduce((a, l) => a + (l.qty_received * l.unit_cost), 0)

  return (
    <AppLayout>
      <div style={{ padding: '16px 20px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: 14, marginBottom: 14 }}>

          {/* GRN Form */}
          <Card>
            <CardHeader>New Goods Received Note (GRN)</CardHeader>
            <CardBody>
              {submitted && (
                <div style={{ background: 'rgba(34,197,94,.1)', border: '1px solid rgba(34,197,94,.25)', borderRadius: 6, padding: '10px 12px', marginBottom: 14, fontSize: 12, color: '#22c55e' }}>
                  ✓ GRN posted successfully! Stock levels updated.
                  <button onClick={() => setSubmitted(null)} style={{ marginLeft: 10, background: 'none', border: 'none', color: '#22c55e', cursor: 'pointer', fontSize: 11 }}>Dismiss</button>
                </div>
              )}

              {!activeStore && (
                <div style={{ marginBottom: 12 }}>
                  <label style={{ display: 'block', fontSize: 10, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 4 }}>Store</label>
                  <select value={selectedStore} onChange={e => setSelectedStore(e.target.value)}>
                    <option value="">Select store...</option>
                    {stores.map(s => <option key={s.id} value={s.id}>{s.name} — {s.zone}</option>)}
                  </select>
                </div>
              )}

              {[
                { label: 'Supplier Name', val: supplier, set: setSupplier, placeholder: 'Supplier company name' },
                { label: 'Invoice / Delivery Note #', val: invoiceNo, set: setInvoiceNo, placeholder: 'INV-2024-0231' },
              ].map(f => (
                <div key={f.label} style={{ marginBottom: 12 }}>
                  <label style={{ display: 'block', fontSize: 10, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 4 }}>{f.label}</label>
                  <input value={f.val} onChange={e => f.set(e.target.value)} placeholder={f.placeholder} />
                </div>
              ))}

              <div style={{ marginBottom: 12 }}>
                <label style={{ display: 'block', fontSize: 10, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 4 }}>Delivery Date</label>
                <input type="date" value={deliveryDate} onChange={e => setDeliveryDate(e.target.value)} />
              </div>
              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: 10, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 4 }}>Notes / Damages</label>
                <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Any delivery notes, damages, short deliveries..." style={{ height: 52 }} />
              </div>

              <Button variant="ghost" onClick={addLine} className="w-full">+ Add Line Item</Button>
            </CardBody>
          </Card>

          {/* Recent GRNs */}
          <Card>
            <CardHeader>Recent GRNs</CardHeader>
            <CardBody>
              {recentGRNs.length === 0 ? (
                <div style={{ fontSize: 12, color: 'var(--text-3)', textAlign: 'center', padding: '20px 0' }}>No GRNs yet</div>
              ) : recentGRNs.map(g => (
                <ActivityItem key={g.id} type="receipt"
                  title={`${g.grn_number} · ${(g.store as any)?.name} · ${g.supplier_name || 'Unknown supplier'}`}
                  sub={`${new Date(g.created_at).toLocaleDateString()} · ${g.invoice_number || 'No invoice'}`} />
              ))}
            </CardBody>
          </Card>
        </div>

        {/* Line Items */}
        <Card>
          <CardHeader
            action={
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                {lines.length > 0 && <span style={{ fontSize: 11, color: 'var(--text-3)' }}>Total: <strong style={{ color: '#fff' }}>${lineTotal.toFixed(2)}</strong></span>}
                <Button variant="success" onClick={submitGRN} disabled={submitting || lines.length === 0 || !selectedStore}>
                  {submitting ? 'Posting...' : 'Submit & Post GRN'}
                </Button>
              </div>
            }
          >
            Line Items — {lines.length} item{lines.length !== 1 ? 's' : ''}
          </CardHeader>
          <div style={{ overflowX: 'auto' }}>
            {lines.length === 0 ? (
              <div style={{ padding: '24px', textAlign: 'center', fontSize: 12, color: 'var(--text-3)' }}>
                Click "+ Add Line Item" above to start adding items to this GRN
              </div>
            ) : (
              <table>
                <thead>
                  <tr><th>Item</th><th>Qty Ordered</th><th>Qty Received</th><th>Unit Cost ($)</th><th>Total</th><th>Condition</th><th></th></tr>
                </thead>
                <tbody>
                  {lines.map((l, i) => (
                    <tr key={i}>
                      <td>
                        <select value={l.item_id} onChange={e => updateLine(i, 'item_id', e.target.value)} style={{ width: 180 }}>
                          <option value="">Select item...</option>
                          {items.map(it => <option key={it.id} value={it.id}>{it.name}</option>)}
                        </select>
                      </td>
                      <td><input type="number" value={l.qty_ordered} onChange={e => updateLine(i, 'qty_ordered', parseFloat(e.target.value))} style={{ width: 80 }} /></td>
                      <td><input type="number" value={l.qty_received} onChange={e => updateLine(i, 'qty_received', parseFloat(e.target.value))} style={{ width: 80 }} /></td>
                      <td><input type="number" value={l.unit_cost} onChange={e => updateLine(i, 'unit_cost', parseFloat(e.target.value))} step="0.01" style={{ width: 90 }} /></td>
                      <td style={{ color: '#fff', fontWeight: 600 }}>${(l.qty_received * l.unit_cost).toFixed(2)}</td>
                      <td>
                        <select value={l.condition} onChange={e => updateLine(i, 'condition', e.target.value)} style={{ width: 110 }}>
                          <option value="good">Good</option>
                          <option value="damaged">Damaged</option>
                          <option value="partial">Partial</option>
                        </select>
                      </td>
                      <td>
                        <button onClick={() => removeLine(i)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: 14 }}>×</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </Card>
      </div>
    </AppLayout>
  )
}
