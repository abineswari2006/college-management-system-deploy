import { useState, type FormEvent } from 'react'
import { ArrowLeft, ArrowUpRight, LockKeyhole, Mail, ShieldCheck } from 'lucide-react'
import { apiRequest, ApiError } from '../../lib/api'

const currentYear = new Date().getFullYear()

interface AuthPageProps {
  onAuthenticated: (collegeId: string | null) => Promise<void>
}

export function AuthPage({ onAuthenticated }: AuthPageProps) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const path = window.location.pathname
  const mode = path === '/forgot-password' ? 'forgot' : path === '/reset-password' ? 'reset' : 'login'
  const resetToken = new URLSearchParams(window.location.search).get('token') ?? ''

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true)
    setError('')
    setMessage('')
    const form = new FormData(event.currentTarget)

    try {
      if (mode === 'login') {
        const result = await apiRequest<{ data: { memberships: Array<{ collegeId: string }>; isSuperAdmin: boolean } }>(
          '/auth/login', { method: 'POST', body: { email, password } },
        )
        await onAuthenticated(result.data.memberships[0]?.collegeId ?? null)
      } else if (mode === 'forgot') {
        await apiRequest('/auth/forgot-password', { method: 'POST', body: { email } })
        setMessage('If the account exists, password reset instructions will be sent.')
      } else {
        const newPassword = String(form.get('newPassword') ?? '')
        const confirmation = String(form.get('confirmPassword') ?? '')
        if (newPassword !== confirmation) throw new ApiError('The passwords do not match.', 400)
        await apiRequest('/auth/reset-password', {
          method: 'POST',
          body: { token: resetToken, password: newPassword },
        })
        setMessage('Password updated. You can sign in now.')
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Something went wrong. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  const heading = mode === 'forgot' ? 'Reset your password' : mode === 'reset' ? 'Choose a new password' : 'Welcome back'

  return (
    <main className="auth-screen">
      <section className="auth-brand" aria-label="College Management">
        <div className="auth-brand-top">
          <span className="brand-mark"><span>CM</span></span>
          <span>College Management</span>
        </div>
        <div className="brand-message">
          <p className="eyebrow">A clearer view of campus</p>
          <h1>Every college,<br />in good order.</h1>
          <p className="brand-subtitle">A secure workspace for the people and work that keep learning moving.</p>
        </div>
        <div className="brand-footnote"><ShieldCheck size={16} /> Private by institution. Managed with care.</div>
        <div className="brand-grid" aria-hidden="true" />
      </section>

      <section className="auth-panel">
        <div className="auth-panel-content">
          <p className="eyebrow">College operations platform</p>
          <h2>{heading}</h2>
          <p className="auth-intro">
            {mode === 'login'
              ? 'Sign in with your college account to continue.'
              : mode === 'forgot'
                ? 'Enter your work email and we will send reset instructions.'
                : 'Use a new password with at least 12 characters.'}
          </p>

          {error && <div className="feedback feedback-error" role="alert">{error}</div>}
          {message && <div className="feedback feedback-success" role="status">{message}</div>}

          <form className="auth-form" onSubmit={submit}>
            {mode !== 'reset' && (
              <label className="field-label" htmlFor="email">
                Work email
                <span className="input-wrap"><Mail size={17} /><input id="email" name="email" type="email" autoComplete="email" required maxLength={254} value={email} onChange={(event) => setEmail(event.target.value)} /></span>
              </label>
            )}
            {mode === 'login' && (
              <label className="field-label" htmlFor="password">
                Password
                <span className="input-wrap"><LockKeyhole size={17} /><input id="password" name="password" type="password" autoComplete="current-password" required minLength={8} maxLength={128} value={password} onChange={(event) => setPassword(event.target.value)} /></span>
              </label>
            )}
            {mode === 'reset' && <input type="hidden" name="token" value={resetToken} />}
            {mode === 'reset' && !resetToken && <div className="feedback feedback-error" role="alert">This reset link is missing its token.</div>}
            {mode === 'reset' && (
              <>
                <label className="field-label" htmlFor="newPassword">New password<input id="newPassword" name="newPassword" type="password" autoComplete="new-password" required minLength={12} maxLength={128} /></label>
                <label className="field-label" htmlFor="confirmPassword">Confirm password<input id="confirmPassword" name="confirmPassword" type="password" autoComplete="new-password" required minLength={12} maxLength={128} /></label>
              </>
            )}
            <button className="button button-primary auth-submit" type="submit" disabled={busy || (mode === 'reset' && !resetToken)}>
              {busy ? 'Please wait…' : mode === 'login' ? 'Sign in' : mode === 'forgot' ? 'Send reset link' : 'Update password'}
              {!busy && <ArrowUpRight size={18} />}
            </button>
          </form>

          <a className="auth-back-link" href={mode === 'login' ? '/forgot-password' : '/'}>
            {mode === 'login' ? 'Forgot password?' : <><ArrowLeft size={15} /> Back to sign in</>}
          </a>
        </div>
        <footer className="auth-footer"><span>© {currentYear} College Management</span><span>Secure access</span></footer>
      </section>
    </main>
  )
}