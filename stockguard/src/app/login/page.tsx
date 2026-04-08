'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setError(error.message)
      setLoading(false)
    } else {
      router.push('/dashboard')
    }
  }

  return (
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:'var(--bg)' }}>
      <div style={{ width:'100%', maxWidth:380, padding:'0 16px' }}>

        {/* Logo */}
        <div style={{ textAlign:'center', marginBottom:32 }}>
          <div style={{ width:48, height:48, borderRadius:12, background:'#1b2d45', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 12px', fontSize:18, fontWeight:700, color:'var(--a1)' }}>SG</div>
          <h1 style={{ fontSize:22, fontWeight:700, color:'#fff', margin:0 }}>StockGuard</h1>
          <p style={{ fontSize:13, color:'var(--text-3)', marginTop:4 }}>Inventory Management System</p>
        </div>

        {/* Store tags */}
        <div style={{ display:'flex', gap:6, justifyContent:'center', marginBottom:28 }}>
          {[['Alliance 1','#5ba3f5'],['JTI','#a78bfa'],['Area 10','#fb923c']].map(([name, color]) => (
            <span key={name} style={{ fontSize:10, fontWeight:600, padding:'3px 8px', borderRadius:4, background:`${color}18`, color }}>
              {name}
            </span>
          ))}
        </div>

        {/* Form */}
        <div style={{ background:'#10111f', border:'1px solid var(--border)', borderRadius:12, padding:24 }}>
          <h2 style={{ fontSize:14, fontWeight:600, color:'#fff', marginBottom:20 }}>Sign in to your account</h2>

          {error && (
            <div style={{ background:'rgba(239,68,68,.1)', border:'1px solid rgba(239,68,68,.25)', borderRadius:6, padding:'10px 12px', marginBottom:16, fontSize:12, color:'#ef4444' }}>
              {error}
            </div>
          )}

          <form onSubmit={handleLogin}>
            <div style={{ marginBottom:14 }}>
              <label style={{ display:'block', fontSize:10, textTransform:'uppercase', letterSpacing:'.5px', color:'var(--text-3)', marginBottom:4 }}>Email</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                placeholder="your@email.com" required autoComplete="email" />
            </div>
            <div style={{ marginBottom:20 }}>
              <label style={{ display:'block', fontSize:10, textTransform:'uppercase', letterSpacing:'.5px', color:'var(--text-3)', marginBottom:4 }}>Password</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                placeholder="••••••••" required autoComplete="current-password" />
            </div>
            <button type="submit" disabled={loading}
              style={{ width:'100%', padding:'10px', borderRadius:8, border:'none', background:'var(--a1)', color:'#fff', fontSize:13, fontWeight:600, cursor:loading?'not-allowed':'pointer', opacity:loading?0.7:1, transition:'all .15s' }}>
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>
        </div>

        <p style={{ textAlign:'center', fontSize:11, color:'var(--text-3)', marginTop:16 }}>
          Contact your admin to get an account
        </p>
      </div>
    </div>
  )
}
