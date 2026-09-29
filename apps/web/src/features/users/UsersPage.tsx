import { useEffect, useState, type FormEvent } from 'react'
import { ChevronLeft, ChevronRight, MailPlus, Pencil, Search, Shield, UserRoundPlus, UserX } from 'lucide-react'
import { Dialog } from '../../components/Dialog'
import { PageHeader } from '../../components/PageHeader'
import { apiRequest, ApiError } from '../../lib/api'
import type { College, ManagedUser, PageResult } from '../../lib/types'

interface UsersPageProps { collegeId: string | null; isSuperAdmin: boolean }
const roles = [
  ['college_admin', 'College Admin'], ['principal', 'Principal'], ['hod', 'HOD'], ['faculty', 'Faculty'],
  ['student', 'Student'], ['parent', 'Parent'], ['accountant', 'Accountant'], ['librarian', 'Librarian'], ['hr_staff', 'HR / Staff'],
]

export function UsersPage({ collegeId, isSuperAdmin }: UsersPageProps) {
  const [result, setResult] = useState<PageResult<ManagedUser>>({ data: [], pagination: { page: 1, limit: 20, total: 0 } })
  const [colleges, setColleges] = useState<College[]>([])
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('active')
  const [page, setPage] = useState(1)
  const [refreshKey, setRefreshKey] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [dialogMode, setDialogMode] = useState<'user' | 'system' | 'edit' | null>(null)
  const [editingUser, setEditingUser] = useState<ManagedUser | null>(null)
  const [email, setEmail] = useState('')
  const [fullName, setFullName] = useState('')
  const [roleCode, setRoleCode] = useState('college_admin')
  const [formCollegeId, setFormCollegeId] = useState(collegeId ?? '')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let current = true
    const params = new URLSearchParams({ page: String(page), limit: '20', status })
    if (search.trim()) params.set('search', search.trim())
    apiRequest<PageResult<ManagedUser>>(`/users?${params}`, { collegeId })
      .then((value) => { if (current) setResult(value) })
      .catch((caught: unknown) => { if (current) setError(caught instanceof ApiError ? caught.message : 'Unable to load users.') })
      .finally(() => { if (current) setLoading(false) })
    return () => { current = false }
  }, [collegeId, page, refreshKey, search, status])

  useEffect(() => {
    if (!isSuperAdmin) return
    let current = true
    apiRequest<PageResult<College>>('/colleges?limit=100&status=active')
      .then((value) => { if (current) setColleges(value.data) })
      .catch(() => undefined)
    return () => { current = false }
  }, [isSuperAdmin])

  function openInvite(mode: 'user' | 'system') {
    setEditingUser(null)
    setEmail('')
    setFullName('')
    setRoleCode('college_admin')
    setFormCollegeId(collegeId ?? colleges[0]?.id ?? '')
    setDialogMode(mode)
  }

  function openEdit(user: ManagedUser) {
    setEditingUser(user)
    setEmail(user.email)
    setFullName(user.fullName)
    setRoleCode(user.role.code)
    setFormCollegeId(user.college?.id ?? '')
    setDialogMode('edit')
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    setError('')
    try {
      if (dialogMode === 'system') {
        await apiRequest('/users/system-admins', { method: 'POST', body: { email, fullName } })
      } else if (dialogMode === 'edit' && editingUser) {
        await apiRequest(`/users/${editingUser.id}`, {
          method: 'PATCH',
          collegeId: editingUser.college?.id ?? collegeId,
          body: { fullName, roleCode },
        })
      } else {
        const targetCollege = collegeId ?? formCollegeId
        if (isSuperAdmin && !targetCollege) throw new Error('Select a college for this invitation.')
        await apiRequest('/users', {
          method: 'POST',
          collegeId: targetCollege || null,
          body: { email, fullName, roleCode, ...(isSuperAdmin && !collegeId ? { collegeId: targetCollege } : {}) },
        })
      }
      setDialogMode(null)
      setLoading(true)
      setError('')
      setEditingUser(null)
      setRefreshKey((value) => value + 1)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to send invitation.')
    } finally {
      setSaving(false)
    }
  }

  async function deactivate(user: ManagedUser) {
    if (!window.confirm(`Deactivate ${user.fullName}? Their access will be revoked.`)) return
    try {
      await apiRequest(`/users/${user.id}/deactivate`, { method: 'PATCH', collegeId: user.college?.id ?? collegeId })
      setLoading(true)
      setError('')
      setRefreshKey((value) => value + 1)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to deactivate user.')
    }
  }

  return (
    <>
      <PageHeader eyebrow="Access administration" title="Users" description="Invite people and manage their access to this platform." action={<div className="header-actions">{isSuperAdmin && <button className="button button-secondary" type="button" onClick={() => openInvite('system')}><Shield size={16} /> Add Super Admin</button>}<button className="button button-primary" type="button" onClick={() => openInvite('user')}><UserRoundPlus size={17} /> Invite user</button></div>} />
      {error && <div className="feedback feedback-error" role="alert">{error}</div>}
      <section className="data-panel" aria-label="User directory">
        <div className="table-toolbar"><label className="search-control"><Search size={16} /><span className="sr-only">Search users</span><input className="toolbar-input" type="search" placeholder="Search by name or email" value={search} onChange={(event) => { setLoading(true); setError(''); setSearch(event.target.value); setPage(1) }} /></label><label className="select-control"><span className="sr-only">Filter by status</span><select value={status} onChange={(event) => { setLoading(true); setError(''); setStatus(event.target.value); setPage(1) }}><option value="active">Active</option><option value="invited">Invited</option><option value="deactivated">Deactivated</option></select></label><span className="result-count">{result.pagination.total.toLocaleString()} accounts</span></div>
        {loading ? <div className="page-state" role="status">Loading users…</div> : result.data.length === 0 ? <div className="empty-state"><span className="empty-mark"><MailPlus size={21} /></span><strong>No accounts found</strong><span>{search ? 'Try changing your search or status filter.' : 'Invite a colleague to grant them access.'}</span></div> : (
          <div className="table-scroll"><table><thead><tr><th>Person</th><th>Access role</th><th>College</th><th>Status</th><th>Last sign-in</th><th><span className="sr-only">Actions</span></th></tr></thead><tbody>
            {result.data.map((user) => <tr key={`${user.id}-${user.college?.id ?? 'system'}`}><td><div className="entity-cell"><span className="person-avatar">{user.fullName.split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase()}</span><span><strong>{user.fullName}</strong><small>{user.email}</small></span></div></td><td>{user.role.name}</td><td>{user.college?.name ?? 'System'}</td><td><span className={`status-badge status-${user.status}`}>{user.status}</span></td><td>{user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleDateString() : 'Never'}</td><td><div className="row-actions">{user.role.code !== 'super_admin' && user.status !== 'deactivated' && <><button className="icon-button" type="button" onClick={() => openEdit(user)} title="Edit user" aria-label={`Edit ${user.fullName}`}><Pencil size={16} /></button><button className="icon-button icon-danger" type="button" onClick={() => void deactivate(user)} title="Deactivate user" aria-label={`Deactivate ${user.fullName}`}><UserX size={16} /></button></>}</div></td></tr>)}
          </tbody></table></div>
        )}
        <div className="table-footer"><span>Page {result.pagination.page} of {Math.max(1, Math.ceil(result.pagination.total / result.pagination.limit))}</span><div className="pagination-actions"><button className="icon-button" aria-label="Previous page" disabled={page <= 1} onClick={() => { setLoading(true); setPage((value) => Math.max(1, value - 1)) }}><ChevronLeft size={18} /></button><button className="icon-button" aria-label="Next page" disabled={page >= Math.ceil(result.pagination.total / result.pagination.limit)} onClick={() => { setLoading(true); setPage((value) => value + 1) }}><ChevronRight size={18} /></button></div></div>
      </section>
      {dialogMode && <Dialog title={dialogMode === 'system' ? 'Invite Super Admin' : dialogMode === 'edit' ? 'Edit user access' : 'Invite user'} onClose={() => { setDialogMode(null); setEditingUser(null) }}><form className="dialog-form" onSubmit={(event) => void submit(event)}>
        <label className="field-label">Full name<input required minLength={2} maxLength={120} value={fullName} onChange={(event) => setFullName(event.target.value)} /></label>
        {dialogMode !== 'edit' && <label className="field-label">Email address<input required type="email" maxLength={254} value={email} onChange={(event) => setEmail(event.target.value)} /></label>}
        {dialogMode === 'edit' && editingUser && <div className="dialog-readonly"><span>Email</span><strong>{editingUser.email}</strong></div>}
        {(dialogMode === 'user' || dialogMode === 'edit') && <>
          {isSuperAdmin && !collegeId && <label className="field-label">College<select required value={formCollegeId} onChange={(event) => setFormCollegeId(event.target.value)}><option value="">Select a college</option>{colleges.map((college) => <option key={college.id} value={college.id}>{college.name}</option>)}</select></label>}
          <label className="field-label">Access role<select value={roleCode} onChange={(event) => setRoleCode(event.target.value)}>{roles.map(([code, name]) => <option value={code} key={code}>{name}</option>)}</select></label>
        </>}
        {dialogMode !== 'edit' && <p className="dialog-note">The account will receive a secure link to set a password. The invitation expires after 30 minutes.</p>}
        <div className="dialog-actions"><button className="button button-secondary" type="button" onClick={() => { setDialogMode(null); setEditingUser(null) }}>Cancel</button><button className="button button-primary" type="submit" disabled={saving}>{saving ? 'Saving…' : dialogMode === 'edit' ? 'Save changes' : 'Send invitation'}</button></div>
      </form></Dialog>}
    </>
  )
}