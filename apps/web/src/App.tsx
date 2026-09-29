import { useEffect, useState } from 'react'
import {
  Activity, BookOpen, Building2, ChevronDown, GraduationCap,
  CalendarDays, ClipboardCheck, CreditCard, LayoutDashboard, Library,
  LogOut, Menu, Settings2, UsersRound, X,
} from 'lucide-react'
import { AuthPage } from './features/auth/AuthPage'
import { CollegesPage } from './features/colleges/CollegesPage'
import { DashboardPage } from './features/dashboard/DashboardPage'
import { SettingsPage } from './features/settings/SettingsPage'
import { UsersPage } from './features/users/UsersPage'
import { MvpDemoPage } from './features/demo/MvpDemoPage'
import { apiRequest, clearCsrfToken } from './lib/api'
import type { College, PageResult, SessionData } from './lib/types'
import './App.css'

type View = 'dashboard' | 'colleges' | 'users' | 'settings' | 'students' | 'faculty' | 'attendance' | 'exams' | 'fees' | 'library'

const viewTitles: Record<View, string> = {
  dashboard: 'Dashboard',
  colleges: 'Colleges',
  users: 'Users',
  settings: 'System settings',
  students: 'Students',
  faculty: 'Faculty',
  attendance: 'Attendance',
  exams: 'Exams & results',
  fees: 'Fees & payments',
  library: 'Library',
}

function savedCollegeId() {
  try { return window.localStorage.getItem('cms-college-id') } catch { return null }
}

function App() {
  const [session, setSession] = useState<SessionData | null>(null)
  const [activeCollegeId, setActiveCollegeId] = useState<string | null>(savedCollegeId())
  const [booting, setBooting] = useState(true)
  const [authError, setAuthError] = useState('')

  async function loadSession(collegeId: string | null) {
    const result = await apiRequest<{ data: SessionData }>('/auth/me', { collegeId })
    setSession(result.data)
    const nextCollegeId = result.data.college?.id ?? null
    setActiveCollegeId(nextCollegeId)
    try {
      if (nextCollegeId) window.localStorage.setItem('cms-college-id', nextCollegeId)
      else window.localStorage.removeItem('cms-college-id')
    } catch { /* Session authorization does not depend on browser storage. */ }
  }

  useEffect(() => {
    let current = true
    apiRequest<{ data: SessionData }>('/auth/me', { collegeId: savedCollegeId() })
      .then((result) => {
        if (!current) return
        setSession(result.data)
        const collegeId = result.data.college?.id ?? null
        setActiveCollegeId(collegeId)
        if (collegeId) {
          try { window.localStorage.setItem('cms-college-id', collegeId) } catch { /* Optional preference. */ }
        }
      })
      .catch(() => { if (current) setSession(null) })
      .finally(() => { if (current) setBooting(false) })
    return () => { current = false }
  }, [])

  async function signOut() {
    try { await apiRequest('/auth/logout', { method: 'POST', collegeId: activeCollegeId }) } catch { /* Session may already be expired. */ }
    clearCsrfToken()
    setSession(null)
    setActiveCollegeId(null)
    try { window.localStorage.removeItem('cms-college-id') } catch { /* Optional preference. */ }
  }

  if (booting) return <div className="boot-screen" role="status">Opening your workspace…</div>
  if (!session) return <AuthPage onAuthenticated={loadSession} />

  return <Workspace
    session={session}
    activeCollegeId={activeCollegeId}
    onSelectCollege={(collegeId) => {
      setAuthError('')
      void loadSession(collegeId).catch((error: unknown) => setAuthError(error instanceof Error ? error.message : 'Unable to switch college.'))
    }}
    onSignOut={() => void signOut()}
    authError={authError}
  />
}

interface WorkspaceProps {
  session: SessionData
  activeCollegeId: string | null
  onSelectCollege: (collegeId: string | null) => void
  onSignOut: () => void
  authError: string
}

function Workspace({ session, activeCollegeId, onSelectCollege, onSignOut, authError }: WorkspaceProps) {
  const [view, setView] = useState<View>('dashboard')
  const [colleges, setColleges] = useState<College[]>([])
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [platformName, setPlatformName] = useState('College Management')

  useEffect(() => {
    if (!session.isSuperAdmin) return
    let current = true
    apiRequest<PageResult<College>>('/colleges?limit=100&status=active')
      .then((result) => { if (current) setColleges(result.data) })
      .catch(() => undefined)
    apiRequest<{ data: { platformName: string } }>('/settings')
      .then((result) => { if (current) setPlatformName(result.data.platformName) })
      .catch(() => undefined)
    return () => { current = false }
  }, [session.isSuperAdmin])

  const navItems = [
    { id: 'dashboard' as const, label: 'Overview', icon: LayoutDashboard, show: session.permissions.includes('dashboard.view') },
    { id: 'colleges' as const, label: 'Colleges', icon: Building2, show: session.permissions.includes('colleges.view') },
    { id: 'users' as const, label: 'Users & access', icon: UsersRound, show: session.permissions.includes('users.view') },
    { id: 'settings' as const, label: 'System settings', icon: Settings2, show: session.permissions.includes('settings.manage') },
    { id: 'students' as const, label: 'Students', icon: GraduationCap, show: session.permissions.includes('students.view') },
    { id: 'faculty' as const, label: 'Faculty', icon: UsersRound, show: session.permissions.includes('faculty.view') },
    { id: 'attendance' as const, label: 'Attendance', icon: ClipboardCheck, show: session.permissions.includes('attendance.view') },
    { id: 'exams' as const, label: 'Exams & marks', icon: CalendarDays, show: session.permissions.includes('marks.view') },
    { id: 'fees' as const, label: 'Fees', icon: CreditCard, show: session.permissions.includes('fees.view') },
    { id: 'library' as const, label: 'Library', icon: Library, show: session.permissions.includes('library.manage') },
  ].filter((item) => item.show)

  function navigate(nextView: View) {
    setView(nextView)
    setMobileNavOpen(false)
  }

  return (
    <div className="workspace-shell">
      {mobileNavOpen && <button className="nav-scrim" aria-label="Close navigation" onClick={() => setMobileNavOpen(false)} />}
      <aside className={`sidebar ${mobileNavOpen ? 'sidebar-open' : ''}`} aria-label="Primary navigation">
        <div className="sidebar-brand"><span className="brand-mark"><span>CM</span></span><span className="brand-wordmark"><strong>{platformName}</strong><small>ADMINISTRATION</small></span><button className="icon-button mobile-close" aria-label="Close navigation" onClick={() => setMobileNavOpen(false)}><X size={18} /></button></div>
        <div className="sidebar-section-label">WORKSPACE</div>
        <nav className="sidebar-nav" aria-label="Workspace">
          {navItems.map(({ id, label, icon: Icon }) => <button key={id} type="button" className={`nav-link ${view === id ? 'nav-link-active' : ''}`} onClick={() => navigate(id)} aria-current={view === id ? 'page' : undefined}><Icon size={18} /><span>{label}</span>{id === 'colleges' && <span className="nav-count">{colleges.length || ''}</span>}</button>)}
        </nav>
        <div className="sidebar-spacer" />
        <div className="sidebar-help"><span className="help-icon"><BookOpen size={17} /></span><span><strong>Phase 1 workspace</strong><small>Identity and access</small></span></div>
        <div className="sidebar-user"><span className="user-avatar">{initials(session.user.fullName)}</span><span className="sidebar-user-copy"><strong>{session.user.fullName}</strong><small>{session.role.name}</small></span><button className="icon-button signout-icon" onClick={onSignOut} title="Sign out" aria-label="Sign out"><LogOut size={17} /></button></div>
      </aside>

      <div className="workspace-main">
        <header className="topbar">
          <button className="icon-button mobile-menu" aria-label="Open navigation" aria-expanded={mobileNavOpen} onClick={() => setMobileNavOpen(true)}><Menu size={20} /></button>
          <div className="breadcrumbs"><span>Workspace</span><span className="breadcrumb-divider">/</span><strong>{viewTitles[view]}</strong></div>
          <div className="topbar-actions">
            {session.isSuperAdmin && <label className="college-switcher"><Building2 size={16} /><span className="sr-only">Active college scope</span><select value={activeCollegeId ?? ''} onChange={(event) => onSelectCollege(event.target.value || null)}><option value="">All colleges</option>{colleges.map((college) => <option key={college.id} value={college.id}>{college.name}</option>)}</select><ChevronDown size={14} /></label>}
            <span className="topbar-role"><span className="online-dot" />{session.role.name}</span>
            <button className="topbar-avatar" aria-label={`Signed in as ${session.user.fullName}`} title={session.user.email}>{initials(session.user.fullName)}</button>
          </div>
        </header>

        <main className="workspace-content" id="main-content" tabIndex={-1}>
          {authError && <div className="feedback feedback-error" role="alert">{authError}</div>}
          {view === 'dashboard' && <DashboardPage collegeId={activeCollegeId} />}
          {view === 'colleges' && session.permissions.includes('colleges.view') && <CollegesPage />}
          {view === 'users' && session.permissions.includes('users.view') && <UsersPage collegeId={activeCollegeId} isSuperAdmin={session.isSuperAdmin} />}
          {view === 'settings' && session.permissions.includes('settings.manage') && <SettingsPage />}
          {['students', 'faculty', 'attendance', 'exams', 'fees', 'library'].includes(view) && <MvpDemoPage key={view} moduleId={view as 'students' | 'faculty' | 'attendance' | 'exams' | 'fees' | 'library'} />}
        </main>
        <footer className="workspace-footer"><span><GraduationCap size={16} /> {platformName}</span><span><Activity size={14} /> Access is scoped by your account permissions</span></footer>
      </div>
    </div>
  )
}

export default App

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase()
}
