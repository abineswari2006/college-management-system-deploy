export type DemoModuleId = 'students' | 'faculty' | 'attendance' | 'exams' | 'fees' | 'library'

export interface DemoRecord {
  id: string
  name: string
  reference: string
  detail: string
  status: string
  meta: string
  amount?: string
}

export const demoModules: Record<DemoModuleId, {
  title: string
  description: string
  eyebrow: string
  columns: [string, string]
  records: DemoRecord[]
}> = {
  students: {
    title: 'Students',
    description: 'Student directory and current enrollment snapshot.',
    eyebrow: 'Academic records',
    columns: ['Program and year', 'Admission reference'],
    records: [
      { id: 'st-101', name: 'Aarav Menon', reference: 'STU-2026-0148', detail: 'B.Sc. Computer Science · Year 2', status: 'Active', meta: 'Admitted 12 Jun 2025' },
      { id: 'st-102', name: 'Ananya Rao', reference: 'STU-2026-0152', detail: 'B.Com. Finance · Year 1', status: 'Active', meta: 'Admitted 08 Jul 2026' },
      { id: 'st-103', name: 'Ibrahim Khan', reference: 'STU-2025-0091', detail: 'B.A. Economics · Year 3', status: 'Active', meta: 'Admitted 21 Jun 2024' },
      { id: 'st-104', name: 'Meera Joseph', reference: 'STU-2024-0064', detail: 'B.Sc. Mathematics · Year 3', status: 'On leave', meta: 'Admitted 18 Jun 2023' },
      { id: 'st-105', name: 'Kavya Nair', reference: 'STU-2026-0176', detail: 'B.Sc. Computer Science · Year 1', status: 'Active', meta: 'Admitted 02 Aug 2026' },
    ],
  },
  faculty: {
    title: 'Faculty',
    description: 'Faculty directory, departments, and teaching assignments.',
    eyebrow: 'People',
    columns: ['Department and designation', 'Employee reference'],
    records: [
      { id: 'fc-201', name: 'Dr. Nisha Iyer', reference: 'EMP-0182', detail: 'Computer Science · Associate Professor', status: 'Active', meta: 'Joined 04 Jan 2019' },
      { id: 'fc-202', name: 'Prof. Vikram Das', reference: 'EMP-0214', detail: 'Commerce · Professor', status: 'Active', meta: 'Joined 17 Jul 2017' },
      { id: 'fc-203', name: 'Dr. Farah Siddiqui', reference: 'EMP-0276', detail: 'Economics · Assistant Professor', status: 'Active', meta: 'Joined 11 Aug 2021' },
      { id: 'fc-204', name: 'Prof. Rohan Mathew', reference: 'EMP-0310', detail: 'Mathematics · Head of Department', status: 'On leave', meta: 'Joined 09 Jun 2015' },
    ],
  },
  attendance: {
    title: 'Attendance',
    description: 'Daily attendance for Year 2 Computer Science, Section A.',
    eyebrow: 'Teaching and learning',
    columns: ['Student and section', 'Session reference'],
    records: [
      { id: 'at-301', name: 'Aarav Menon', reference: 'CS-2A · Data Structures', detail: 'Year 2 · Section A', status: 'Present', meta: 'Today · 09:00 AM' },
      { id: 'at-302', name: 'Ananya Rao', reference: 'CS-2A · Data Structures', detail: 'Year 2 · Section A', status: 'Late', meta: 'Today · 09:14 AM' },
      { id: 'at-303', name: 'Ibrahim Khan', reference: 'CS-2A · Data Structures', detail: 'Year 2 · Section A', status: 'Absent', meta: 'Today · 09:00 AM' },
      { id: 'at-304', name: 'Kavya Nair', reference: 'CS-2A · Data Structures', detail: 'Year 2 · Section A', status: 'Present', meta: 'Today · 08:52 AM' },
      { id: 'at-305', name: 'Meera Joseph', reference: 'CS-2A · Data Structures', detail: 'Year 2 · Section A', status: 'Excused', meta: 'Today · Approved leave' },
    ],
  },
  exams: {
    title: 'Exams & results',
    description: 'Assessment calendar, marks entry, and result publication.',
    eyebrow: 'Teaching and learning',
    columns: ['Course and cohort', 'Assessment window'],
    records: [
      { id: 'ex-401', name: 'Mid-semester assessment', reference: 'EXAM-2026-09', detail: 'B.Sc. Computer Science · Semester 3', status: 'In progress', meta: '12–18 Oct 2026' },
      { id: 'ex-402', name: 'Internal assessment II', reference: 'EXAM-2026-08', detail: 'B.Com. Finance · Semester 1', status: 'Marks entry', meta: 'Marks due 03 Oct 2026' },
      { id: 'ex-403', name: 'Practical examinations', reference: 'EXAM-2026-07', detail: 'B.Sc. Mathematics · Semester 5', status: 'Scheduled', meta: '20–23 Oct 2026' },
      { id: 'ex-404', name: 'End-semester results', reference: 'EXAM-2026-06', detail: 'B.A. Economics · Semester 4', status: 'Published', meta: 'Published 18 Sep 2026' },
    ],
  },
  fees: {
    title: 'Fees & payments',
    description: 'Student accounts, upcoming dues, and recent collections.',
    eyebrow: 'Finance',
    columns: ['Student and fee type', 'Invoice reference'],
    records: [
      { id: 'fe-501', name: 'Ananya Rao', reference: 'INV-26-0418', detail: 'Semester 1 tuition · Due 05 Oct 2026', status: 'Pending', meta: 'B.Com. Finance · Year 1', amount: '₹42,500' },
      { id: 'fe-502', name: 'Aarav Menon', reference: 'INV-26-0381', detail: 'Library and lab fees · Due 28 Sep 2026', status: 'Overdue', meta: 'B.Sc. Computer Science · Year 2', amount: '₹6,800' },
      { id: 'fe-503', name: 'Ibrahim Khan', reference: 'REC-26-0294', detail: 'Semester 5 tuition · Paid 24 Sep 2026', status: 'Paid', meta: 'B.A. Economics · Year 3', amount: '₹39,000' },
      { id: 'fe-504', name: 'Kavya Nair', reference: 'INV-26-0442', detail: 'Admission and tuition · Due 10 Oct 2026', status: 'Pending', meta: 'B.Sc. Computer Science · Year 1', amount: '₹48,000' },
    ],
  },
  library: {
    title: 'Library',
    description: 'Circulation desk, availability, and books currently on loan.',
    eyebrow: 'Campus services',
    columns: ['Author and category', 'ISBN'],
    records: [
      { id: 'lb-601', name: 'Database System Concepts', reference: '978-0-07-352332-3', detail: 'Abraham Silberschatz · Computer Science', status: 'Available', meta: '12 copies · 8 available' },
      { id: 'lb-602', name: 'Principles of Economics', reference: '978-1-292-40561-6', detail: 'N. Gregory Mankiw · Economics', status: 'Issued', meta: 'Issued to Ibrahim Khan · Due 06 Oct' },
      { id: 'lb-603', name: 'Financial Accounting', reference: '978-93-325-8757-8', detail: 'T. S. Grewal · Commerce', status: 'Available', meta: '8 copies · 5 available' },
      { id: 'lb-604', name: 'Introduction to Algorithms', reference: '978-0-262-04630-5', detail: 'Cormen, Leiserson, Rivest & Stein · Computing', status: 'Issued', meta: 'Issued to Aarav Menon · Due 30 Sep' },
      { id: 'lb-605', name: 'Linear Algebra and Its Applications', reference: '978-0-321-99277-1', detail: 'David C. Lay · Mathematics', status: 'Available', meta: '6 copies · 4 available' },
    ],
  },
}

const storagePrefix = 'cms-mvp-demo:'

export function loadDemoRecords(moduleId: DemoModuleId) {
  try {
    const stored = window.localStorage.getItem(`${storagePrefix}${moduleId}`)
    if (stored) return JSON.parse(stored) as DemoRecord[]
  } catch { /* Use the bundled development fixture if storage is unavailable. */ }
  return demoModules[moduleId].records
}

export function persistDemoRecords(moduleId: DemoModuleId, records: DemoRecord[]) {
  try { window.localStorage.setItem(`${storagePrefix}${moduleId}`, JSON.stringify(records)) }
  catch { /* Demo changes remain visible for this open page. */ }
}