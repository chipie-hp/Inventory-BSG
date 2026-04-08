'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/useAuth'
import AppLayout from '@/components/layout/AppLayout'
import { Card, CardHeader, CardBody, Button, Badge, StatusBadge, Spinner } from '@/components/ui'
import type { Store } from '@/types'

const ROLES = ['admin','manager','store_manager','clerk','requester']
const ROLE_BADGE: Record<string, any> = { admin:'red', manager:'amber', store_manager:'blue', clerk:'muted', requester:'muted' }

export default function UsersPage() {
  const { user: me, hasRole } = useAuth()
  const supabase = createClient()
  const [users, setUsers] = useState<any[]>([])
  const [stores, setStores] = useState<Store[]>([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [editUser, setEditUser] = useState<any | null>(null)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const [{ data: ps }, { data: ss }, { data: acc }] = await Promise.all([
      supabase.from('profiles').select('*').order('full_name'),
      supabase.from('stores').select('*').order('name'),
      supabase.from('user_store_access').select('user_id, store_id, stores(name,code)'),
    ])
    const accessMap: Record<string, any[]> = {}
    ;(acc ?? []).forEach((a: any) => {
      if (!accessMap[a.user_id]) accessMap[a.user_id] = []
      accessMap[a.user_id].push(a.stores)
    })
    setUsers((ps ?? []).map(p => ({ ...p, storeAccess: accessMap[p.id] ?? [] })))
    setStores(ss ?? [])
    setLoading(false)
  }

  async function toggleFlag(userId: string, flagged: boolean) {
    await supabase.from('profiles').update({ is_flagged: !flagged }).eq('id', userId)
    load()
  }

  async function suspendUser(userId: string) {
    await supabase.from('profiles').update({ is_active: false }).eq('id', userId)
    load()
  }

  async function activateUser(userId: string) {
    await supabase.from('profiles').update({ is_active: true }).eq('id', userId)
    load()
  }

  async function updateRole(userId: string, role: string) {
    await supabase.from('profiles').update({ role }).eq('id', userId)
    load()
  }

  async function grantStoreAccess(userId: string, storeId: string) {
    await supabase.from('user_store_access').upsert({ user_id: userId, store_id: storeId, granted_by: me!.id })
    load()
  }

  async function revokeStoreAccess(userId: string, storeId: string) {
    await supabase.from('user_store_access').delete().eq('user_id', userId).eq('store_id', storeId)
    load()
  }

  if (!hasRole('admin')) {
    return <AppLayout><div style={{ padding: 40, textAlign: 'center', color: 'var(--text-3)' }}>Access denied. Admin only.</div></AppLayout>
  }

  return (
    <AppLayout>
      <div style={{ padding: '16px 20px' }}>

        {/* Info banner */}
        <div style={{ background: 'rgba(91,163,245,.07)', border: '1px solid rgba(91,163,245,.15)', borderRadius: 7, padding: '10px 14px', marginBottom: 14, fontSize: 11, color: 'var(--a1)', lineHeight: 1.6 }}>
          ⬤ Store access is assigned per user by Admin only. Managers with "all stores" role see a combined dashboard. Clerks are locked to their assigned store.
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
          <Button variant="primary" onClick={() => setShowAdd(true)}>+ Add User</Button>
        </div>

        {/* Users table */}
        <Card style={{ marginBottom: 14 }}>
          <CardHeader>Users & Role Management</CardHeader>
          {loading ? <Spinner /> : (
            <div style={{ overflowX: 'auto' }}>
              <table>
                <thead><tr><th>Name</th><th>Role</th><th>Store Access</th><th>Status</th><th>Flagged</th><th>Actions</th></tr></thead>
                <tbody>
                  {users.map(u => (
                    <tr key={u.id}>
                      <td>
                        <div style={{ color: u.is_flagged ? '#ef4444' : '#fff', fontWeight: 500 }}>{u.full_name}</div>
                        {u.id === me?.id && <div style={{ fontSize: 9, color: 'var(--text-3)' }}>You</div>}
                      </td>
                      <td>
                        <select value={u.role} onChange={e => updateRole(u.id, e.target.value)}
                          disabled={u.id === me?.id}
                          style={{ width: 140, padding: '3px 6px', fontSize: 11, background: 'var(--bg-3)', border: '1px solid var(--border-2)', color: '#fff', borderRadius: 5 }}>
                          {ROLES.map(r => <option key={r} value={r}>{r.replace('_',' ')}</option>)}
                        </select>
                      </td>
                      <td>
                        {u.role === 'admin' || u.role === 'manager'
                          ? <Badge variant="green">All Stores</Badge>
                          : u.storeAccess.length === 0
                            ? <Badge variant="muted">No Access</Badge>
                            : u.storeAccess.map((s: any) => <StoreBadgeInline key={s?.code} code={s?.code} name={s?.name} />)
                        }
                      </td>
                      <td>
                        <Badge variant={u.is_active ? 'green' : 'red'}>{u.is_active ? 'Active' : 'Suspended'}</Badge>
                      </td>
                      <td>
                        <Badge variant={u.is_flagged ? 'red' : 'muted'}>{u.is_flagged ? '⚠ Flagged' : 'Clear'}</Badge>
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                          {u.id !== me?.id && (
                            <>
                              <Button size="sm" variant="ghost" onClick={() => setEditUser(u)}>Access</Button>
                              {u.is_active
                                ? <Button size="sm" variant="danger" onClick={() => suspendUser(u.id)}>Suspend</Button>
                                : <Button size="sm" variant="success" onClick={() => activateUser(u.id)}>Activate</Button>
                              }
                              <Button size="sm" variant={u.is_flagged ? 'ghost' : 'danger'} onClick={() => toggleFlag(u.id, u.is_flagged)}>
                                {u.is_flagged ? 'Unflag' : 'Flag'}
                              </Button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        {/* Permissions matrix */}
        <Card>
          <CardHeader>Permissions Matrix</CardHeader>
          <div style={{ overflowX: 'auto' }}>
            <table>
              <thead><tr><th>Permission</th><th>Admin</th><th>Manager</th><th>Store Manager</th><th>Clerk</th><th>Requester</th></tr></thead>
              <tbody>
                {[
                  ['View all stores dashboard', '✓', '✓ (if granted)', '—', '—', '—'],
                  ['View own store', '✓', '✓', '✓', '✓', '✓'],
                  ['Receive Stock (GRN)', '✓', '✓', '✓', '—', '—'],
                  ['Issue Stock', '✓', '✓', '✓', 'With approval', '—'],
                  ['Approve Requisitions', '✓', '✓', '✓', '—', '—'],
                  ['Stock Adjustments', '✓', 'Approve only', 'Own store', 'Request only', '—'],
                  ['View Reports & Valuation', '✓', '✓', '✓', '—', '—'],
                  ['Manage Users / Grant Access', '✓ Admin only', '—', '—', '—', '—'],
                  ['Resolve Theft Alerts', '✓', '✓', '—', '—', '—'],
                ].map(([perm, ...vals]) => (
                  <tr key={perm}>
                    <td style={{ color: 'var(--text-3)' }}>{perm}</td>
                    {vals.map((v, i) => (
                      <td key={i} style={{ color: v === '✓' ? '#22c55e' : v === '—' ? 'var(--text-3)' : '#f59e0b', fontWeight: v === '✓' ? 700 : 400 }}>{v}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        {/* Store access modal */}
        {editUser && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.7)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ background: '#10111f', border: '1px solid var(--border-2)', borderRadius: 10, width: '90%', maxWidth: 380 }}>
              <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <h3 style={{ color: '#fff', fontSize: 13, fontWeight: 600 }}>Store Access — {editUser.full_name}</h3>
                <button onClick={() => { setEditUser(null); load() }} style={{ background: 'none', border: 'none', color: 'var(--text-3)', cursor: 'pointer', fontSize: 18 }}>×</button>
              </div>
              <div style={{ padding: 16 }}>
                <p style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: 14 }}>Toggle store access for this user. Admin and Manager roles automatically get all stores.</p>
                {stores.map(s => {
                  const hasAccess = editUser.storeAccess?.some((a: any) => a?.code === s.code)
                  return (
                    <div key={s.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '9px 0', borderBottom: '1px solid var(--border)' }}>
                      <div>
                        <div style={{ fontSize: 12, color: '#fff', fontWeight: 500 }}>{s.name}</div>
                        <div style={{ fontSize: 10, color: 'var(--text-3)' }}>{s.zone}</div>
                      </div>
                      <Button size="sm" variant={hasAccess ? 'danger' : 'success'}
                        onClick={() => hasAccess ? revokeStoreAccess(editUser.id, s.id) : grantStoreAccess(editUser.id, s.id)}>
                        {hasAccess ? 'Revoke' : 'Grant'}
                      </Button>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        )}

        {showAdd && <AddUserModal stores={stores} onClose={() => { setShowAdd(false); load() }} />}
      </div>
    </AppLayout>
  )
}

function StoreBadgeInline({ code, name }: { code: string; name: string }) {
  const C: Record<string, string> = { A1: 'rgba(91,163,245,.12)', JTI: 'rgba(167,139,250,.12)', A10: 'rgba(251,146,60,.12)' }
  const T: Record<string, string> = { A1: '#5ba3f5', JTI: '#a78bfa', A10: '#fb923c' }
  return <span style={{ display: 'inline-block', padding: '2px 6px', borderRadius: 3, fontSize: 9, fontWeight: 700, background: C[code]||'rgba(255,255,255,.06)', color: T[code]||'#888', marginRight: 4 }}>{name||code}</span>
}

function AddUserModal({ stores, onClose }: { stores: Store[]; onClose: () => void }) {
  const supabase = createClient()
  const { user: me } = useAuth()
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [role, setRole] = useState('clerk')
  const [password, setPassword] = useState('')
  const [selStores, setSelStores] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function create() {
    setLoading(true); setError('')
    // Create auth user via admin (this requires service role — in production use a server action)
    // For now, user must sign up and admin assigns role
    const { data, error: err } = await supabase.auth.admin.createUser({
      email, password, email_confirm: true,
      user_metadata: { full_name: name }
    })
    if (err) { setError(err.message); setLoading(false); return }

    if (data.user) {
      await supabase.from('profiles').insert({ id: data.user.id, full_name: name, role })
      if (!['admin','manager'].includes(role)) {
        for (const sid of selStores) {
          await supabase.from('user_store_access').insert({ user_id: data.user.id, store_id: sid, granted_by: me!.id })
        }
      }
    }
    onClose()
    setLoading(false)
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.7)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: '#10111f', border: '1px solid var(--border-2)', borderRadius: 10, width: '90%', maxWidth: 400 }}>
        <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h3 style={{ color: '#fff', fontSize: 13, fontWeight: 600 }}>Add New User</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-3)', cursor: 'pointer', fontSize: 18 }}>×</button>
        </div>
        <div style={{ padding: 16 }}>
          {error && <div style={{ background: 'rgba(239,68,68,.1)', border: '1px solid rgba(239,68,68,.25)', borderRadius: 5, padding: '8px 10px', marginBottom: 12, fontSize: 11, color: '#ef4444' }}>{error}</div>}
          {[{ l:'Full Name', v:name, s:setName, t:'text', p:'Employee full name' }, { l:'Email', v:email, s:setEmail, t:'email', p:'user@email.com' }, { l:'Password', v:password, s:setPassword, t:'password', p:'Temporary password' }].map(f => (
            <div key={f.l} style={{ marginBottom: 12 }}>
              <label style={{ display: 'block', fontSize: 10, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 4 }}>{f.l}</label>
              <input type={f.t} value={f.v} onChange={e => f.s(e.target.value)} placeholder={f.p} />
            </div>
          ))}
          <div style={{ marginBottom: 12 }}>
            <label style={{ display: 'block', fontSize: 10, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 4 }}>Role</label>
            <select value={role} onChange={e => setRole(e.target.value)}>
              {['admin','manager','store_manager','clerk','requester'].map(r => <option key={r} value={r}>{r.replace('_',' ')}</option>)}
            </select>
          </div>
          {!['admin','manager'].includes(role) && (
            <div style={{ marginBottom: 14 }}>
              <label style={{ display: 'block', fontSize: 10, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 6 }}>Store Access</label>
              {stores.map(s => (
                <label key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, cursor: 'pointer' }}>
                  <input type="checkbox" checked={selStores.includes(s.id)} onChange={e => setSelStores(prev => e.target.checked ? [...prev, s.id] : prev.filter(x => x !== s.id))} style={{ width: 'auto', cursor: 'pointer' }} />
                  <span style={{ fontSize: 12, color: '#fff' }}>{s.name} <span style={{ color: 'var(--text-3)', fontSize: 10 }}>— {s.zone}</span></span>
                </label>
              ))}
            </div>
          )}
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <Button variant="ghost" onClick={onClose}>Cancel</Button>
            <Button variant="primary" onClick={create} disabled={!email || !name || !password || loading}>{loading ? 'Creating...' : 'Create User'}</Button>
          </div>
        </div>
      </div>
    </div>
  )
}
