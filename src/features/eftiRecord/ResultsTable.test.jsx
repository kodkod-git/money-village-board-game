import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import ResultsTable from './ResultsTable'
import * as api from './api'

vi.mock('./api')

const HEADER = { teacherName: 'kim', className: '햇살반', classTime: '토 10:00', completedOn: '2026-11-23' }
const COUNTS = { F: 6, P: 7, A: 13, T: 0, S: 9, E: 4, C: 6, N: 7 }
const ROWS = [
  { recordId: 'r1', header: HEADER, nickname: '민준', memo: null, citizenType: 'PASC', passportType: 'PASN', passportCounts: COUNTS, missingCodes: [] },
  { recordId: 'r2', header: HEADER, nickname: '서연', memo: '결석', citizenType: 'PASC', passportType: null, passportCounts: COUNTS, missingCodes: ['33-2', '46'] },
]

beforeEach(() => {
  vi.clearAllMocks()
  api.fetchSheets.mockResolvedValue([
    { header: HEADER, studentCount: 2, needsFollowUpCount: 1 },
    { header: { ...HEADER, teacherName: 'lee', className: '달님반' }, studentCount: 1, needsFollowUpCount: 0 },
  ])
  api.fetchResults.mockResolvedValue(ROWS)
})

describe('ResultsTable', () => {
  it('학생별 유형·축별 개수·미응답을 보여주고 보충 필요를 표시한다', async () => {
    render(<ResultsTable profile={{ username: 'kim', isSuper: false }} onOpen={vi.fn()} />)
    expect(await screen.findByText('민준')).toBeInTheDocument()
    expect(screen.getByText('PASN')).toBeInTheDocument()
    expect(screen.getAllByText('6:7')[0]).toBeInTheDocument()
    expect(screen.getByText('보충 필요')).toBeInTheDocument()
    expect(screen.getByText('33-2, 46')).toBeInTheDocument()
    expect(screen.getByText('결석')).toBeInTheDocument()
    expect(screen.queryByLabelText('선생님')).not.toBeInTheDocument()
  })

  it('필터를 바꾸면 그 조건으로 다시 조회한다', async () => {
    const user = userEvent.setup()
    render(<ResultsTable profile={{ username: 'kim', isSuper: false }} onOpen={vi.fn()} />)
    await screen.findByText('민준')
    await waitFor(() => expect(screen.getByLabelText('반 이름').options.length).toBe(3))
    await user.selectOptions(screen.getByLabelText('반 이름'), '햇살반')
    await user.click(screen.getByLabelText('보충 필요만'))
    await waitFor(() => expect(api.fetchResults).toHaveBeenLastCalledWith(expect.objectContaining({ className: '햇살반', needsFollowUp: true })))
  })

  it('마스터에게만 선생님 필터가 보인다', async () => {
    render(<ResultsTable profile={{ username: 'admin', isSuper: true }} onOpen={vi.fn()} />)
    await screen.findByText('민준')
    await waitFor(() => expect(screen.getByLabelText('선생님').options.length).toBe(3))
  })

  it('행을 누르면 그 학생 기록지를 연다', async () => {
    const user = userEvent.setup()
    const onOpen = vi.fn()
    render(<ResultsTable profile={{ username: 'kim', isSuper: false }} onOpen={onOpen} />)
    await user.click(await screen.findByText('서연'))
    expect(onOpen).toHaveBeenCalledWith({ header: HEADER, nickname: '서연' })
  })
})
