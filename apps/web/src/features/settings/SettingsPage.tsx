import { useEffect, useState, type FormEvent } from 'react'
import { Save, SlidersHorizontal } from 'lucide-react'
import { PageHeader } from '../../components/PageHeader'
import { apiRequest, ApiError } from '../../lib/api'

interface SettingsValue { platformName: string; supportEmail: string; maintenanceMode: boolean; updatedAt: string | null }

export function SettingsPage() {
  const [settings, setSettings] = useState<SettingsValue>({ platformName: '', supportEmail: '', maintenanceMode: false, updatedAt: null })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    let current = true
    apiRequest<{ data: SettingsValue }>('/settings')
      .then((result) => { if (current) setSettings(result.data) })
      .catch((caught: unknown) => { if (current) setError(caught instanceof ApiError ? caught.message : 'Unable to load settings.') })
      .finally(() => { if (current) setLoading(false) })
    return () => { current = false }
  }, [])

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    setError('')
    setSuccess('')
    try {
      const result = await apiRequest<{ data: SettingsValue }>('/settings', {
        method: 'PATCH',
        body: { platformName: settings.platformName, supportEmail: settings.supportEmail, maintenanceMode: settings.maintenanceMode },
      })
      setSettings(result.data)
      setSuccess('System settings saved.')
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to save settings.')
    } finally {
      setSaving(false)
    }
  }

  return <>
    <PageHeader eyebrow="Platform administration" title="System settings" description="Configure the shared platform identity and support contact." />
    {error && <div className="feedback feedback-error" role="alert">{error}</div>}
    {success && <div className="feedback feedback-success" role="status">{success}</div>}
    {loading ? <div className="page-state" role="status">Loading settings…</div> : <section className="settings-layout">
      <div className="settings-intro"><span className="settings-icon"><SlidersHorizontal size={20} /></span><h2>Platform profile</h2><p>These settings apply across colleges. Individual institutions can manage their own locale and currency in the college profile.</p></div>
      <form className="settings-form" onSubmit={(event) => void submit(event)}>
        <label className="field-label">Platform name<input required minLength={3} maxLength={80} value={settings.platformName} onChange={(event) => setSettings({ ...settings, platformName: event.target.value })} /></label>
        <label className="field-label">Support email<input type="email" maxLength={254} value={settings.supportEmail} onChange={(event) => setSettings({ ...settings, supportEmail: event.target.value })} /></label>
        <label className="toggle-row"><span><strong>Maintenance mode</strong><small>Display an unavailable response for non-administrator access.</small></span><input type="checkbox" checked={settings.maintenanceMode} onChange={(event) => setSettings({ ...settings, maintenanceMode: event.target.checked })} /></label>
        <div className="settings-actions"><span>{settings.updatedAt ? `Last updated ${new Date(settings.updatedAt).toLocaleString()}` : 'Not saved yet'}</span><button className="button button-primary" type="submit" disabled={saving}><Save size={16} />{saving ? 'Saving…' : 'Save settings'}</button></div>
      </form>
    </section>}
  </>
}