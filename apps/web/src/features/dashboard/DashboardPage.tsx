import { useEffect, useState } from 'react'
import { Activity, Building2, MailCheck, UsersRound } from 'lucide-react'
import { apiRequest, ApiError } from '../../lib/api'
import { PageHeader } from '../../components/PageHeader'
import { demoModules } from '../../lib/demoData'

interface DashboardSummary {
  scope: { type: 'system' | 'college'; collegeId: string | null; collegeName: string | null }
  metrics: { activeColleges: number; deactivatedColleges: number; activeUsers: number; pendingInvitations: number }
  recentActivity: Array<{
    id: string
    action: string
    entityType: string
    createdAt: string
    actorName: string | null
    collegeName: string | null
  }>
}

interface DashboardPageProps { collegeId: string | null }

const activityLabels: Record<string, string> = {
  'auth.login': 'Signed in',
  'auth.logout': 'Signed out',
  'college.created': 'College created',
  'college.updated': 'College details updated',
  'college.deactivated': 'College deactivated',
  'user.invited': 'User invitation sent',
  'system_admin.invited': 'Super Admin invitation sent',
  'user.updated': 'User access updated',
  'user.deactivated': 'User deactivated',
  'user.membership_deactivated': 'College access removed',
  'settings.updated': 'System settings updated',
}

export function DashboardPage({ collegeId }: DashboardPageProps) {
  const [requestState, setRequestState] = useState<{
    key: string
    summary: DashboardSummary | null
    error: string
  } | null>(null)
  const requestKey = collegeId ?? 'all-colleges'

  useEffect(() => {
    let current = true
    apiRequest<{ data: DashboardSummary }>('/dashboard/summary', { collegeId })
      .then((result) => { if (current) setRequestState({ key: requestKey, summary: result.data, error: '' }) })
      .catch((caught: unknown) => {
        if (current) setRequestState({ key: requestKey, summary: null, error: caught instanceof ApiError ? caught.message : 'Unable to load the dashboard.' })
      })
    return () => { current = false }
  }, [collegeId, requestKey])

  const loading = requestState?.key !== requestKey
  const summary = requestState?.key === requestKey ? requestState.summary : null
  const error = requestState?.key === requestKey ? requestState.error : ''

  return (
    <>
      <PageHeader
        eyebrow={summary?.scope.type === 'system' ? 'System overview' : 'College overview'}
        title="Dashboard"
        description={summary?.scope.collegeName ?? 'A live view of your college network.'}
      />
      {error && <div className="feedback feedback-error" role="alert">{error}</div>}
      {loading ? <div className="page-state" role="status">Loading dashboard…</div> : summary && (
        <>
          <section className="metrics-grid" aria-label="Current system metrics">
            <Metric label={summary.scope.type === 'system' ? 'Active colleges' : 'College status'} value={summary.metrics.activeColleges} detail={summary.metrics.deactivatedColleges ? `${summary.metrics.deactivatedColleges} deactivated` : 'In this workspace'} icon={<Building2 size={19} />} accent="green" />
            <Metric label="Active users" value={summary.metrics.activeUsers} detail="Across this access scope" icon={<UsersRound size={19} />} accent="blue" />
            <Metric label="Pending invitations" value={summary.metrics.pendingInvitations} detail="Awaiting account activation" icon={<MailCheck size={19} />} accent="gold" />
          </section>

          <CampusSnapshot />

          <section className="activity-panel" aria-labelledby="activity-title">
            <div className="panel-heading">
              <div><p className="eyebrow">Latest changes</p><h2 id="activity-title">Recent activity</h2></div>
              <span className="panel-icon"><Activity size={18} /></span>
            </div>
            {summary.recentActivity.length === 0 ? (
              <div className="empty-state"><span className="empty-mark"><Activity size={20} /></span><strong>No activity yet</strong><span>Administrative actions will appear here as they happen.</span></div>
            ) : (
              <ol className="activity-list">
                {summary.recentActivity.map((item) => (
                  <li key={item.id}>
                    <span className="activity-dot" aria-hidden="true" />
                    <div className="activity-copy"><strong>{activityLabels[item.action] ?? item.action.replaceAll('.', ' ')}</strong><span>{item.actorName ?? 'System'}{summary.scope.type === 'system' && item.collegeName ? ` · ${item.collegeName}` : ''}</span></div>
                    <time dateTime={item.createdAt}>{new Date(item.createdAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}</time>
                  </li>
                ))}
              </ol>
            )}
          </section>
          <p className="data-footnote">Platform metrics are live database values. Campus snapshot and charts use labeled local sample records until those modules connect to the database.</p>
        </>
      )}
    </>
  )
}

function CampusSnapshot() {
  const students = demoModules.students.records
  const faculty = demoModules.faculty.records
  const attendance = demoModules.attendance.records
  const fees = demoModules.fees.records
  const exams = demoModules.exams.records
  const books = demoModules.library.records
  const attendanceCounts = attendance.reduce<Record<string, number>>((counts, record) => {
    counts[record.status] = (counts[record.status] ?? 0) + 1
    return counts
  }, {})
  const programs = students.reduce<Record<string, number>>((counts, record) => {
    const program = record.detail.split(' · ')[0]
    counts[program] = (counts[program] ?? 0) + 1
    return counts
  }, {})
  const feeAmounts = fees.map((record) => ({
    name: record.name.split(' ')[0],
    value: Number(record.amount?.replace(/[^\d]/g, '') ?? 0),
    status: record.status,
  }))
  const outstanding = feeAmounts.filter((record) => record.status !== 'Paid').reduce((total, record) => total + record.value, 0)
  const maxProgram = Math.max(...Object.values(programs), 1)
  const maxFee = Math.max(...feeAmounts.map((record) => record.value), 1)
  const attendanceTotal = Math.max(attendance.length, 1)
  const feeFormatter = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 })

  return (
    <section className="campus-snapshot" aria-labelledby="campus-snapshot-title">
      <div className="snapshot-heading"><div><p className="eyebrow">Live-preview dataset</p><h2 id="campus-snapshot-title">Campus snapshot</h2></div><span className="demo-tag">Seeded sample records</span></div>
      <div className="snapshot-metrics">
        <SnapshotMetric label="Students" value={students.length.toString()} detail="Sample directory" />
        <SnapshotMetric label="Faculty" value={faculty.length.toString()} detail="Sample directory" />
        <SnapshotMetric label="Attendance" value={`${Math.round((attendanceCounts.Present ?? 0) / attendanceTotal * 100)}%`} detail="Present on time today" />
        <SnapshotMetric label="Outstanding fees" value={feeFormatter.format(outstanding)} detail="Across sample accounts" />
        <SnapshotMetric label="Available books" value={`${books.filter((record) => record.status === 'Available').length}`} detail={`${books.length} sample titles`} />
        <SnapshotMetric label="Upcoming exams" value={`${exams.filter((record) => record.status !== 'Published').length}`} detail="Scheduled or in progress" />
      </div>
      <div className="snapshot-charts">
        <SnapshotBars title="Student distribution" caption="By program · sample records" entries={Object.entries(programs).map(([label, count]) => ({ label, value: count, width: count / maxProgram * 100, tone: 'green' }))} />
        <SnapshotBars title="Today’s attendance" caption="Year 2 Computer Science · Section A" entries={Object.entries(attendanceCounts).map(([label, count]) => ({ label, value: count, width: count / attendanceTotal * 100, tone: label === 'Absent' ? 'coral' : label === 'Late' ? 'gold' : 'green' }))} />
        <SnapshotBars title="Fee accounts" caption="Sample balances · INR" entries={feeAmounts.map((record) => ({ label: record.name, value: record.value, width: record.value / maxFee * 100, tone: record.status === 'Paid' ? 'green' : record.status === 'Overdue' ? 'coral' : 'gold', display: feeFormatter.format(record.value) }))} />
      </div>
    </section>
  )
}

function SnapshotMetric({ label, value, detail }: { label: string; value: string; detail: string }) {
  return <article className="snapshot-metric"><span>{label}</span><strong>{value}</strong><small>{detail}</small></article>
}

function SnapshotBars({ title, caption, entries }: { title: string; caption: string; entries: Array<{ label: string; value: number; width: number; tone: string; display?: string }> }) {
  return <section className="snapshot-chart"><div className="snapshot-chart-heading"><strong>{title}</strong><span>{caption}</span></div><div className="snapshot-bars">
    {entries.map((entry) => <div className="snapshot-bar-row" key={entry.label}><span>{entry.label}</span><div className="snapshot-track"><i className={`bar-${entry.tone}`} style={{ width: `${Math.max(entry.width, 4)}%` }} /></div><strong>{entry.display ?? entry.value}</strong></div>)}
  </div></section>
}

function Metric({ label, value, detail, icon, accent }: { label: string; value: number; detail: string; icon: React.ReactNode; accent: string }) {
  return (
    <article className={`metric-card metric-${accent}`}>
      <div className="metric-top"><span>{label}</span><span className="metric-icon">{icon}</span></div>
      <strong>{value.toLocaleString()}</strong>
      <span className="metric-detail">{detail}</span>
    </article>
  )
}