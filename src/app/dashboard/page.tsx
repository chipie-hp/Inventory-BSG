'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/useAuth'
import { useStore } from '@/hooks/useStore'
import AppLayout from '@/components/layout/AppLayout'
import { KpiCard, Card, CardHeader, CardBody, ActivityItem, StoreBadge, Badge, StatusBadge, Button } from '@/components/ui'
import type { StoreSummary, Alert } from '@/types'

export default function DashboardPage() {
  const { user } = useAuth()
  const { activeStore, stores } = useStore()
  const [summaries, setSummaries] = useState<StoreSummary[]>([])
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    async function load() {
      setLoading(true)
      const [{ data: sums }, { data: alts }] = await Promise.all([
        supabase.from('v_store_summary').select('*'),
        supabase.from('v_alerts').select('*').in('status', ['open','escalated']).limit(5),
      ])
      setSummaries(sums ?? [])
      setAlerts(alts ?? [])
      setLoading(false)
    }
    load()
  }, [activeStore])

  const filtered = activeStore ? summaries.filter(s => s.store_id === activeStore.id) : summaries
  const totalValue = filtered.reduce((a, s) => a + Number(s.total_value), 0)
  const totalAlerts = filtered.reduce((a, s) => a + Number(s.open_alerts), 0)
  const totalItems = filtered.reduce((a, s) => a + Number(s.total_items), 0)
  const lowStock = filtered.reduce((a, s) => a + Number(s.low_stock_count), 0)

  const STORE_COLOR: Record<string, string> = { A1: '#5ba3f5', JTI: '#a78bfa', A10: '#fb923c' }

  return (
    <AppLayout>
      <div style={{ padding:'16px 20px' }}>

        {/* KPIs */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(4,minmax(0,1fr))', gap:10, marginBottom:14 }}>
          <KpiCard label="Total Stock Value" value={`$${totalValue.toLocaleString(undefined,{minimumFractionDigits:0,maximumFractionDigits:0})}`} sub="All active stores" />
          <KpiCard label="Total Items" value={totalItems} sub="Across stores" />
          <KpiCard label="Low Stock Items" value={lowStock} sub={lowStock > 0 ? 'Need reorder' : 'All good'} subType={lowStock > 0 ? 'down' : 'up'} />
          <KpiCard label="⚠ Active Alerts" value={totalAlerts} sub={totalAlerts > 0 ? 'Require attention' : 'All clear'} danger={totalAlerts > 0} />
        </div>

        {/* Store overview cards — only show in all-stores view */}
        {!activeStore && (
          <div style={{ display:'grid', gridTemplateColumns:'repeat(3,minmax(0,1fr))', gap:10, marginBottom:14 }}>
            {summaries.map(s => (
              <div key={s.store_id} style={{ background:'#10111f', borderRadius:8, padding:12, borderLeft:`3px solid ${STORE_COLOR[s.code]||'#888'}` }}>
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:6 }}>
                  <span style={{ fontSize:13, fontWeight:600, color:'#fff' }}>{s.store_name}</span>
                  <StoreBadge code={s.code} />
                </div>
                <div style={{ fontSize:10, color:'var(--text-3)', marginBottom:8 }}>{s.zone}</div>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6 }}>
                  {[
                    { v: `$${Number(s.total_value).toLocaleString(undefined,{maximumFractionDigits:0})}`, l: 'Stock value' },
                    { v: s.total_items, l: 'Items', color: '#22c55e' },
                    { v: s.low_stock_count, l: 'Low stock', color: s.low_stock_count > 0 ? '#f59e0b' : '#22c55e' },
                    { v: s.open_alerts, l: 'Alerts', color: s.open_alerts > 0 ? '#ef4444' : '#22c55e' },
                  ].map((stat, i) => (
                    <div key={i} style={{ background:'rgba(255,255,255,.03)', borderRadius:5, padding:'7px 9px' }}>
                      <div style={{ fontSize:14, fontWeight:700, color: stat.color || '#fff' }}>{stat.v}</div>
                      <div style={{ fontSize:9, color:'var(--text-3)', marginTop:1 }}>{stat.l}</div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Bottom grid */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(2,minmax(0,1fr))', gap:12 }}>

          {/* Active alerts */}
          <Card>
            <CardHeader action={<Button size="sm" variant="danger" onClick={() => window.location.href='/alerts'}>View all</Button>}>
              ⚠ Theft & Discrepancy Alerts
            </CardHeader>
            <CardBody className="p-0">
              {alerts.length === 0 ? (
                <div style={{ padding:'24px', textAlign:'center', fontSize:12, color:'var(--text-3)' }}>No active alerts</div>
              ) : alerts.map(a => (
                <div key={a.id} style={{ display:'flex', alignItems:'flex-start', gap:10, padding:'10px 14px', borderBottom:'1px solid rgba(255,255,255,.04)' }}>
                  <div style={{ fontSize:15, fontWeight:700, color:'#ef4444', minWidth:28, flexShrink:0 }}>
                    {a.variance_qty !== null && a.variance_qty < 0 ? a.variance_qty : ''}
                  </div>
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:11, color:'#ddd' }}>
                      <strong style={{ color:'#fff' }}>{a.item_name}</strong>
                      &nbsp;<StoreBadge code={a.store_code} name={a.store_name} />
                    </div>
                    <div style={{ fontSize:10, color:'var(--text-3)', marginTop:2 }}>{a.description}</div>
                  </div>
                  <StatusBadge status={a.status} />
                </div>
              ))}
            </CardBody>
          </Card>

          {/* Recent activity */}
          <Card>
            <CardHeader>Recent Activity</CardHeader>
            <CardBody>
              <ActivityItem type="alert"   title="Whisky variance flagged — JTI"           sub="2 hrs ago · Auto-flagged" />
              <ActivityItem type="receipt" title="Received: 50kg Rice · Alliance 1"         sub="4 hrs ago · Gift Zimba" />
              <ActivityItem type="issue"   title="Issued: Cooking Oil x3 · Area 10"         sub="5 hrs ago · Rose Phiri" />
              <ActivityItem type="adjustment" title="Adjustment: Towels -8 · Alliance 1"    sub="6 hrs ago · Pending approval" />
              <ActivityItem type="receipt" title="Received: 200 Red Bull · JTI"             sub="Yesterday · T. Banda" />
            </CardBody>
          </Card>
        </div>
      </div>
    </AppLayout>
  )
}
