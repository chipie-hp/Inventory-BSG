'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useStore } from '@/hooks/useStore'
import AppLayout from '@/components/layout/AppLayout'
import { Card, CardHeader, CardBody, KpiCard, StoreBadge, Button, Spinner } from '@/components/ui'

export default function ValuationPage() {
  const { activeStore } = useStore()
  const supabase = createClient()
  const [rows, setRows] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [method, setMethod] = useState('FIFO')

  useEffect(() => {
    async function load() {
      setLoading(true)
      let q = supabase.from('v_store_stock').select('*').order('store_name').order('category')
      if (activeStore) q = q.eq('store_id', activeStore.id)
      const { data } = await q
      setRows(data ?? [])
      setLoading(false)
    }
    load()
  }, [activeStore])

  // Group by store
  const byStore: Record<string, { store: string; code: string; items: any[]; value: number }> = {}
  rows.forEach(r => {
    if (!byStore[r.store_id]) byStore[r.store_id] = { store: r.store_name, code: r.store_code, items: [], value: 0 }
    byStore[r.store_id].items.push(r)
    byStore[r.store_id].value += Number(r.stock_value)
  })

  const totalValue = Object.values(byStore).reduce((a, s) => a + s.value, 0)
  const totalItems = rows.length

  // Group by category for table
  const byCategory: Record<string, { items: number; qty: number; value: number; store: string; code: string }> = {}
  rows.forEach(r => {
    const key = `${r.category}__${r.store_id}`
    if (!byCategory[key]) byCategory[key] = { items: 0, qty: 0, value: 0, store: r.store_name, code: r.store_code }
    byCategory[key].items++
    byCategory[key].qty += Number(r.current_qty)
    byCategory[key].value += Number(r.stock_value)
  })

  return (
    <AppLayout>
      <div style={{ padding: '16px 20px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,minmax(0,1fr))', gap: 10, marginBottom: 14 }}>
          <KpiCard label="Total Inventory Value" value={`$${totalValue.toLocaleString(undefined,{maximumFractionDigits:0})}`} sub={method + ' method'} />
          {Object.values(byStore).map(s => (
            <KpiCard key={s.store} label={s.store} value={`$${s.value.toLocaleString(undefined,{maximumFractionDigits:0})}`} sub={`${s.items.length} items`} />
          ))}
        </div>

        <Card>
          <CardHeader action={
            <div style={{ display: 'flex', gap: 7 }}>
              <select value={method} onChange={e => setMethod(e.target.value)} style={{ width: 140, padding: '4px 8px', fontSize: 11 }}>
                <option>FIFO</option><option>LIFO</option><option>Weighted Avg</option>
              </select>
              <Button variant="ghost" size="sm">Export PDF</Button>
              <Button variant="ghost" size="sm">Export CSV</Button>
            </div>
          }>
            Stock Valuation Report — {new Date().toLocaleDateString()}
          </CardHeader>
          {loading ? <Spinner /> : (
            <div style={{ overflowX: 'auto' }}>
              <table>
                <thead><tr><th>Category</th><th>Store</th><th>Items</th><th>Total Qty</th><th>Avg Unit Cost</th><th>Total Value</th><th>% of Portfolio</th></tr></thead>
                <tbody>
                  {Object.entries(byCategory).map(([key, c]) => (
                    <tr key={key}>
                      <td style={{ color: '#fff' }}>{key.split('__')[0]}</td>
                      <td><StoreBadge code={c.code} name={c.store} /></td>
                      <td>{c.items}</td>
                      <td>{c.qty.toFixed(1)}</td>
                      <td>{c.items > 0 ? `$${(c.value / c.qty).toFixed(2)}` : '—'}</td>
                      <td style={{ color: '#fff', fontWeight: 600 }}>${c.value.toFixed(2)}</td>
                      <td style={{ color: 'var(--text-3)' }}>{totalValue > 0 ? ((c.value / totalValue) * 100).toFixed(1) : 0}%</td>
                    </tr>
                  ))}
                  <tr style={{ borderTop: '1px solid rgba(255,255,255,.1)' }}>
                    <td colSpan={2}><strong style={{ color: '#fff' }}>TOTAL</strong></td>
                    <td><strong style={{ color: '#fff' }}>{totalItems}</strong></td>
                    <td colSpan={2}>—</td>
                    <td><strong style={{ color: '#f59e0b', fontSize: 14 }}>${totalValue.toFixed(2)}</strong></td>
                    <td style={{ color: 'var(--text-3)' }}>100%</td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </AppLayout>
  )
}
