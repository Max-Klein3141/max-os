import { useState } from 'react'
import { supabase } from './supabase'

type Mode = 'login' | 'signup' | 'forgot'

export function Auth() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [mode, setMode] = useState<Mode>('login')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  function switchMode(next: Mode) {
    setMode(next)
    setError('')
    setMessage('')
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setMessage('')
    if (mode === 'signup') {
      const { error } = await supabase.auth.signUp({ email, password })
      if (error) setError(error.message)
    } else if (mode === 'forgot') {
      // Send the reset link back to this app. The origin must be listed under
      // Supabase → Authentication → URL Configuration → Redirect URLs.
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin,
      })
      if (error) setError(error.message)
      else setMessage('If that email has an account, a reset link is on its way. Check your inbox.')
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) setError(error.message)
    }
  }

  const submitLabel =
    mode === 'login' ? 'Log in' : mode === 'signup' ? 'Sign up' : 'Send reset link'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', gap: '1rem' }}>
      <h1>MAX OS</h1>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', width: '300px' }}>
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={e => setEmail(e.target.value)}
        />
        {mode !== 'forgot' && (
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={e => setPassword(e.target.value)}
          />
        )}
        {error && <p style={{ color: 'red' }}>{error}</p>}
        {message && <p style={{ color: '#34d399' }}>{message}</p>}
        <button type="submit">{submitLabel}</button>
        {mode === 'login' && (
          <button type="button" onClick={() => switchMode('forgot')}>
            Forgot password?
          </button>
        )}
        <button
          type="button"
          onClick={() => switchMode(mode === 'login' ? 'signup' : 'login')}
        >
          {mode === 'login' ? 'No account? Sign up' : 'Have an account? Log in'}
        </button>
      </form>
    </div>
  )
}

/**
 * Shown after the user clicks a password-recovery email link. Supabase has
 * already put them in a temporary recovery session; here they choose a new
 * password.
 */
export function ResetPassword({ onDone }: { onDone: () => void }) {
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSaving(true)
    const { error } = await supabase.auth.updateUser({ password })
    setSaving(false)
    if (error) setError(error.message)
    else onDone()
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', gap: '1rem' }}>
      <h1>Set a new password</h1>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', width: '300px' }}>
        <input
          type="password"
          placeholder="New password"
          value={password}
          onChange={e => setPassword(e.target.value)}
        />
        {error && <p style={{ color: 'red' }}>{error}</p>}
        <button type="submit" disabled={saving || password.length < 6}>
          {saving ? 'Updating…' : 'Update password'}
        </button>
      </form>
    </div>
  )
}
