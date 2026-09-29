import { useMemo, useState } from 'react'
import { Download, Search } from 'lucide-react'
import { PageHeader } from '../../components/PageHeader'
import { demoModules, loadDemoRecords, persistDemoRecords, type DemoModuleId, type DemoRecord } from '../../lib/demoData'

const editableStatuses: Partial<Record<DemoModuleId, string[]>> = {
  attendance: ['Present', 'Absent', 'Late', 'Excused'],
  fees: ['Pending', 'Overdue', 'Paid'],
  library: ['Available', 'Issued'],
}

export function MvpDemoPage({ moduleId }: { moduleId: DemoModuleId }) {
  const module = demoModules[moduleId]
  const [records, setRecords] = useState<DemoRecord[]>(() => loadDemoRecords(moduleId))
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('all')
  const rows = useMemo(() => records.filter((record) => {
    const matchesSearch = `${record.name} ${record.reference} ${record.detail} ${record.meta}`.toLowerCase().includes(search.trim().toLowerCase())
    return matchesSearch && (status === 'all' || record.status.toLowerCase() === status.toLowerCase())
  }), [records, search, status])
  const statuses = [...new Set(records.map((record) => record.status))]

  function updateRecord(id: string, nextStatus: string) {
    const updated = records.map((record) => record.id === id ? { ...record, status: nextStatus } : record)
    setRecords(updated)
    persistDemoRecords(moduleId, updated)
  }

  function exportCsv() {
    const values = [
      ['Name', 'Reference', module.columns[0], 'Status', 'Details', 'Amount'],
      ...rows.map((record) => [record.name, record.reference, record.detail, record.status, record.meta, record.amount ?? '']),
    ]
    const csv = values.map((row) => row.map((value) => `"${value.replaceAll('"', '""')}"`).join(',')).join('\r\n')
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
    const link = document.createElement('a')
    link.href = url
    link.download = `${moduleId}-demo.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  return <>
    <PageHeader eyebrow={module.eyebrow} title={module.title} description={module.description} action={<span className="demo-tag">MVP sample data</span>} />
    <div className="demo-notice" role="note"><span className="demo-notice-dot" /> This screen uses local demo records until its database module is connected. Changes are saved in this browser only.</div>
    <section className="demo-summary" aria-label={`${module.title} summary`}>
      <article><span>{moduleId === 'fees' ? 'Accounts shown' : moduleId === 'attendance' ? 'Students in session' : moduleId === 'library' ? 'Titles in sample' : 'Records shown'}</span><strong>{records.length}</strong></article>
      <article><span>{moduleId === 'attendance' ? 'Present today' : moduleId === 'fees' ? 'Paid' : 'Active / available'}</span><strong>{records.filter((record) => ['present', 'paid', 'available', 'active', 'published'].includes(record.status.toLowerCase())).length}</strong></article>
      <article><span>{moduleId === 'attendance' ? 'Needs review' : moduleId === 'fees' ? 'Outstanding' : 'Other statuses'}</span><strong>{records.filter((record) => !['present', 'paid', 'available', 'active', 'published'].includes(record.status.toLowerCase())).length}</strong></article>
    </section>
    <section className="data-panel" aria-label={`${module.title} records`}>
      <div className="table-toolbar">
        <label className="search-control"><Search size={16} /><span className="sr-only">Search {module.title.toLowerCase()}</span><input className="toolbar-input" type="search" placeholder={`Search ${module.title.toLowerCase()}`} value={search} onChange={(event) => setSearch(event.target.value)} /></label>
        <label className="select-control"><span className="sr-only">Filter by status</span><select value={status} onChange={(event) => setStatus(event.target.value)}><option value="all">All statuses</option>{statuses.map((item) => <option value={item} key={item}>{item}</option>)}</select></label>
        <span className="result-count">{rows.length} shown</span>
        <button className="button button-secondary export-button" type="button" onClick={exportCsv}><Download size={15} /> Export CSV</button>
      </div>
      {rows.length === 0 ? <div className="empty-state"><strong>No records match</strong><span>Adjust the search or status filter.</span></div> : <div className="table-scroll"><table><thead><tr><th>{moduleId === 'fees' ? 'Student' : moduleId === 'attendance' ? 'Student' : moduleId === 'library' ? 'Title' : 'Name'}</th><th>{module.columns[0]}</th><th>{module.columns[1]}</th>{moduleId === 'fees' && <th>Amount</th>}<th>Status</th>{editableStatuses[moduleId] && <th><span className="sr-only">Update status</span></th>}</tr></thead><tbody>
        {rows.map((record) => <tr key={record.id}>
          <td><div className="entity-cell"><span className="person-avatar">{moduleId === 'library' ? 'BK' : record.name.split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase()}</span><span><strong>{record.name}</strong><small>{record.reference}</small></span></div></td>
          <td>{record.detail}</td><td>{record.meta}</td>{moduleId === 'fees' && <td className="amount-cell">{record.amount}</td>}
          <td><span className={`status-badge ${statusClass(record.status)}`}>{record.status}</span></td>
          {editableStatuses[moduleId] && <td><label className="sr-only" htmlFor={`status-${record.id}`}>Update status for {record.name}</label><select id={`status-${record.id}`} className="row-status-select" value={record.status} onChange={(event) => updateRecord(record.id, event.target.value)}>{editableStatuses[moduleId]!.map((option) => <option value={option} key={option}>{option}</option>)}</select></td>}
        </tr>)}
      </tbody></table></div>}
      <div className="table-footer"><span>Sample records · {records.length} total</span><span>Changes persist in this browser</span></div>
    </section>
  </>
}

function statusClass(status: string) {
  const value = status.toLowerCase()
  if (['active', 'present', 'paid', 'available', 'published'].includes(value)) return 'status-active'
  if (['invited', 'late', 'scheduled', 'in progress', 'marks entry'].includes(value)) return 'status-invited'
  if (['absent', 'overdue', 'on leave'].includes(value)) return 'status-deactivated'
  return 'status-neutral'
}