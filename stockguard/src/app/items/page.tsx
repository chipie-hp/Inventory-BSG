'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/useAuth'
import AppLayout from '@/components/layout/AppLayout'
import { Card, CardHeader, CardBody, Button, Badge, Spinner } from '@/components/ui'
import type { Item, ItemCategory, Store } from '@/types'

export default function ItemsPage() {
  const { hasRole } = useAuth()
  const supabase = createClient()
  const [items, setItems] = useState<any[]>([])
  const [categories, setCategories] = useState<ItemCategory[]>([])
  const [stores, setStores] = useState<Store[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [catFilter, setCatFilter] = useState('')
  const [showAdd, setShowAdd] = useState(false)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const [{ data: its }, { data: cats }, { data: ss }] = await Promise.all([
      supabase.from('items').select('*, category:item_categories(name), store_items(store_id, stores(name,code))').order('name'),
      supabase.from('item_categories').select('*').order('name'),
      supabase.from('stores').select('*').order('name'),
    ])
    setItems(its ?? [])
    setCategories(cats ?? [])
    setStores(ss ?? [])
    setLoading(false)
  }

  const filtered = items.filter(i => {
    const mq = !search || i.name.toLowerCase().includes(search.toLowerCase()) || i.code.toLowerCase().includes(search.toLowerCase())
    const mc = !catFilter || i.category?.name === catFilter
    return mq && mc
  })

  const STORE_C: Record<string, string> = { A1: '#5ba3f5', JTI: '#a78bfa', A10: '#fb923c' }

  return (
    <AppLayout>
      <div style={{ padding: '16px 20px' }}>
        <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' }}>
          <input placeholder="Search items..." value={search} onChange={e => setSearch(e.target.value)} style={{ flex: 1, minWidth: 140 }} />
          <select value={catFilter} onChange={e => setCatFilter(e.target.value)} style={{ width: 180 }}>
            <option value="">All Categories</option>
            {categories.map(c => <option key={c.id}>{c.name}</option>)}
          </select>
          {hasRole('admin', 'manager') && (
            <Button variant="primary" onClick={() => setShowAdd(true)}>+ Add Item</Button>
          )}
          {hasRole('admin') && <Button variant="ghost">Import CSV</Button>}
          <span style={{ fontSize: 10, color: 'var(--text-3)' }}>{filtered.length} items</span>
        </div>

        <Card>
          <CardHeader>Item Master List</CardHeader>
          {loading ? <Spinner /> : (
            <div style={{ overflowX: 'auto' }}>
              <table>
                <thead><tr><th>Code</th><th>Item Name</th><th>Category</th><th>Unit</th><th>Reorder Point</th><th>Stores</th><th>Status</th></tr></thead>
                <tbody>
                  {filtered.map(i => (
                    <tr key={i.id}>
                      <td style={{ color: 'var(--text-3)', fontSize: 10, fontFamily: 'monospace' }}>{i.code}</td>
                      <td>
                        <div style={{ color: '#fff', fontWeight: 500 }}>{i.name}</div>
                        {i.description && <div style={{ fontSize: 10, color: 'var(--text-3)' }}>{i.description}</div>}
                      </td>
                      <td>{i.category?.name || '—'}</td>
                      <td style={{ color: 'var(--text-3)' }}>{i.unit_of_measure}</td>
                      <td>{i.reorder_point}</td>
                      <td>
                        {(i.store_items ?? []).map((si: any) => si.stores && (
                          <span key={si.store_id} style={{ display: 'inline-block', padding: '2px 5px', borderRadius: 3, fontSize: 9, fontWeight: 700, background: `${STORE_C[si.stores.code]||'#888'}18`, color: STORE_C[si.stores.code]||'#888', marginRight: 3 }}>
                            {si.stores.code}
                          </span>
                        ))}
                      </td>
                      <td><Badge variant={i.is_active ? 'green' : 'red'}>{i.is_active ? 'Active' : 'Inactive'}</Badge></td>
                    </tr>
                  ))}
                  {filtered.length === 0 && (
                    <tr><td colSpan={7} style={{ textAlign: 'center', color: 'var(--text-3)', padding: '20px 0' }}>No items found</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        {showAdd && <AddItemModal categories={categories} stores={stores} onClose={() => { setShowAdd(false); load() }} />}
      </div>
    </AppLayout>
  )
}

function AddItemModal({ categories, stores, onClose }: { categories: ItemCategory[]; stores: Store[]; onClose: () => void }) {
  const supabase = createClient()
  const { user } = useAuth()
  const [name, setName] = useState('')
  const [desc, setDesc] = useState('')
  const [catId, setCatId] = useState('')
  const [unit, setUnit] = useState('units')
  const [reorder, setReorder] = useState(0)
  const [selStores, setSelStores] = useState<string[]>([])
  const [minLevels, setMinLevels] = useState<Record<string, number>>({})
  const [maxLevels, setMaxLevels] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(false)

  const UNITS = ['units','kg','litres','bottles','cans','pcs','packets','boxes','bags','rolls']

  async function create() {
    setLoading(true)
    const { data: item } = await supabase.from('items').insert({
      name, description: desc || null, category_id: catId || null,
      unit_of_measure: unit, reorder_point: reorder, created_by: user!.id,
    }).select().single()

    if (item) {
      for (const sid of selStores) {
        await supabase.from('store_items').insert({
          store_id: sid, item_id: item.id,
          min_level: minLevels[sid] || 0,
          max_level: maxLevels[sid] || 999,
          current_qty: 0, avg_unit_cost: 0,
        })
      }
    }
    onClose()
    setLoading(false)
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.7)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: '#10111f', border: '1px solid var(--border-2)', borderRadius: 10, width: '90%', maxWidth: 460, maxHeight: '85vh', overflowY: 'auto' }}>
        <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h3 style={{ color: '#fff', fontSize: 13, fontWeight: 600 }}>Add Item to Master List</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-3)', cursor: 'pointer', fontSize: 18 }}>×</button>
        </div>
        <div style={{ padding: 16 }}>
          {[{l:'Item Name', v:name, s:setName, p:'Description'}, {l:'Description (optional)', v:desc, s:setDesc, p:'Brief description'}].map(f => (
            <div key={f.l} style={{ marginBottom: 12 }}>
              <label style={{ display: 'block', fontSize: 10, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 4 }}>{f.l}</label>
              <input value={f.v} onChange={e => f.s(e.target.value)} placeholder={f.p} />
            </div>
          ))}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
            <div>
              <label style={{ display: 'block', fontSize: 10, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 4 }}>Category</label>
              <select value={catId} onChange={e => setCatId(e.target.value)}>
                <option value="">Select...</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 10, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 4 }}>Unit of Measure</label>
              <select value={unit} onChange={e => setUnit(e.target.value)}>
                {UNITS.map(u => <option key={u}>{u}</option>)}
              </select>
            </div>
          </div>
          <div style={{ marginBottom: 14 }}>
            <label style={{ display: 'block', fontSize: 10, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 4 }}>Reorder Point</label>
            <input type="number" value={reorder} onChange={e => setReorder(parseInt(e.target.value))} />
          </div>

          <div style={{ marginBottom: 14 }}>
            <label style={{ display: 'block', fontSize: 10, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 8 }}>Assign to Stores</label>
            {stores.map(s => (
              <div key={s.id} style={{ marginBottom: 10 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, cursor: 'pointer' }}>
                  <input type="checkbox" checked={selStores.includes(s.id)} onChange={e => setSelStores(prev => e.target.checked ? [...prev, s.id] : prev.filter(x => x !== s.id))} style={{ width: 'auto' }} />
                  <span style={{ fontSize: 12, color: '#fff', fontWeight: 500 }}>{s.name}</span>
                </label>
                {selStores.includes(s.id) && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, paddingLeft: 22 }}>
                    <div>
                      <label style={{ fontSize: 9, color: 'var(--text-3)' }}>Min Level</label>
                      <input type="number" value={minLevels[s.id] || ''} onChange={e => setMinLevels(p => ({ ...p, [s.id]: parseInt(e.target.value) }))} placeholder="0" style={{ marginTop: 2 }} />
                    </div>
                    <div>
                      <label style={{ fontSize: 9, color: 'var(--text-3)' }}>Max Level</label>
                      <input type="number" value={maxLevels[s.id] || ''} onChange={e => setMaxLevels(p => ({ ...p, [s.id]: parseInt(e.target.value) }))} placeholder="999" style={{ marginTop: 2 }} />
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <Button variant="ghost" onClick={onClose}>Cancel</Button>
            <Button variant="primary" onClick={create} disabled={!name || loading}>{loading ? 'Saving...' : 'Save Item'}</Button>
          </div>
        </div>
      </div>
    </div>
  )
}
