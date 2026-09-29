import { useEffect, useState, type FormEvent } from 'react'
import { Building2, ChevronLeft, ChevronRight, Pencil, Plus, Search, ShieldOff } from 'lucide-react'
import { Dialog } from '../../components/Dialog'
import { PageHeader } from '../../components/PageHeader'
import { apiRequest, ApiError } from '../../lib/api'
import type { College, PageResult } from '../../lib/types'

const emptyForm = { name: '', code: '', timezone: 'UTC', locale: 'en', currency: 'USD' }

export function CollegesPage() {
  const [result, setResult] = useState<PageResult<College>>({ data: [], pagination: { page: 1, limit: 20, total: 0 } })
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('active')
  const [page, setPage] = useState(1)
  const [refreshKey, setRefreshKey] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<College | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let current = true
    const params = new URLSearchParams({ page: String(page), limit: '20', status })
    if (search.trim()) params.set('search', search.trim())
    apiRequest<PageResult<College>>(`/colleges?${params}`)
      .then((value) => { if (current) setResult(value) })
      .catch((caught: unknown) => { if (current) setError(caught instanceof ApiError ? caught.message : 'Unable to load colleges.') })
      .finally(() => { if (current) setLoading(false) })
    return () => { current = false }
  }, [page, refreshKey, search, status])

  function openCreate() {
    setEditing(null)
    setForm(emptyForm)
    setDialogOpen(true)
  }

  function openEdit(college: College) {
    setEditing(college)
    setForm({ name: college.name, code: college.code, timezone: college.timezone, locale: college.locale, currency: college.currency })
    setDialogOpen(true)
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    setError('')
    try {
      await apiRequest(editing ? `/colleges/${editing.id}` : '/colleges', {
        method: editing ? 'PATCH' : 'POST',
        body: form,
      })
      setDialogOpen(false)
      setLoading(true)
      setError('')
      setRefreshKey((value) => value + 1)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to save college.')
    } finally {
      setSaving(false)
    }
  }

  async function deactivate(college: College) {
    if (!window.confirm(`Deactivate ${college.name}? Members will no longer be able to sign in to this college.`)) return
    try {
      await apiRequest(`/colleges/${college.id}/deactivate`, { method: 'PATCH' })
      setLoading(true)
      setError('')
      setRefreshKey((value) => value + 1)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to deactivate college.')
    }
  }

  return (
    <>
      <PageHeader eyebrow="System administration" title="Colleges" description="Manage institution profiles and access status." action={<button className="button button-primary" type="button" onClick={openCreate}><Plus size={17} /> Add college</button>} />
      {error && <div className="feedback feedback-error" role="alert">{error}</div>}
      <section className="data-panel" aria-label="College directory">
        <div className="table-toolbar">
          <label className="search-control"><Search size={16} /><span className="sr-only">Search colleges</span><input className="toolbar-input" type="search" placeholder="Search by college or code" value={search} onChange={(event) => { setLoading(true); setError(''); setSearch(event.target.value); setPage(1) }} /></label>
          <label className="select-control"><span className="sr-only">Filter by status</span><select value={status} onChange={(event) => { setLoading(true); setError(''); setStatus(event.target.value); setPage(1) }}><option value="active">Active</option><option value="deactivated">Deactivated</option></select></label>
          <span className="result-count">{result.pagination.total.toLocaleString()} {result.pagination.total === 1 ? 'college' : 'colleges'}</span>
        </div>
        {loading ? <div className="page-state" role="status">Loading colleges…</div> : result.data.length === 0 ? (
          <div className="empty-state"><span className="empty-mark"><Building2 size={21} /></span><strong>No colleges found</strong><span>{search ? 'Try changing your search or status filter.' : 'Add a college to begin managing your network.'}</span></div>
        ) : (
          <div className="table-scroll"><table><thead><tr><th>College</th><th>Code</th><th>Locale</th><th>Status</th><th>Added</th><th><span className="sr-only">Actions</span></th></tr></thead><tbody>
            {result.data.map((college) => <tr key={college.id}>
              <td><div className="entity-cell"><span className="entity-mark"><Building2 size={17} /></span><span><strong>{college.name}</strong><small>{college.timezone}</small></span></div></td>
              <td><span className="code-pill">{college.code}</span></td>
              <td>{college.locale} · {college.currency}</td>
              <td><span className={`status-badge status-${college.status}`}>{college.status}</span></td>
              <td>{new Date(college.createdAt).toLocaleDateString()}</td>
              <td><div className="row-actions"><button className="icon-button" type="button" onClick={() => openEdit(college)} aria-label={`Edit ${college.name}`} title="Edit college"><Pencil size={16} /></button>{college.status === 'active' && <button className="icon-button icon-danger" type="button" onClick={() => void deactivate(college)} aria-label={`Deactivate ${college.name}`} title="Deactivate college"><ShieldOff size={16} /></button>}</div></td>
            </tr>)}
          </tbody></table></div>
        )}
        <div className="table-footer"><span>Page {result.pagination.page} of {Math.max(1, Math.ceil(result.pagination.total / result.pagination.limit))}</span><div className="pagination-actions"><button className="icon-button" aria-label="Previous page" disabled={page <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))}><ChevronLeft size={18} /></button><button className="icon-button" aria-label="Next page" disabled={page >= Math.ceil(result.pagination.total / result.pagination.limit)} onClick={() => setPage((value) => value + 1)}><ChevronRight size={18} /></button></div></div>
      </section>
      {dialogOpen && <Dialog title={editing ? 'Edit college' : 'Add college'} onClose={() => setDialogOpen(false)}>
        <form className="dialog-form" onSubmit={(event) => void submit(event)}>
          <label className="field-label">College name<input required minLength={2} maxLength={120} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></label>
          <label className="field-label">College code<input required pattern="[A-Za-z0-9][A-Za-z0-9_-]{1,31}" maxLength={32} value={form.code} onChange={(event) => setForm({ ...form, code: event.target.value.toUpperCase() })} /></label>
          <div className="form-grid"><label className="field-label">Timezone<input required maxLength={64} value={form.timezone} onChange={(event) => setForm({ ...form, timezone: event.target.value })} /></label><label className="field-label">Locale<input required maxLength={16} value={form.locale} onChange={(event) => setForm({ ...form, locale: event.target.value })} /></label></div>
          <label className="field-label">Currency<input required pattern="[A-Za-z]{3}" maxLength={3} value={form.currency} onChange={(event) => setForm({ ...form, currency: event.target.value.toUpperCase() })} /></label>
          <div className="dialog-actions"><button className="button button-secondary" type="button" onClick={() => setDialogOpen(false)}>Cancel</button><button className="button button-primary" type="submit" disabled={saving}>{saving ? 'Saving…' : editing ? 'Save changes' : 'Create college'}</button></div>
        </form>
      </Dialog>}
    </>
  )
}