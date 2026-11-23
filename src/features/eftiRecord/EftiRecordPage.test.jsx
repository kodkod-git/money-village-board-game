import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import EftiRecordPage from './EftiRecordPage'
import * as api from './api'
import { loadSeedQuestions, allAnswers } from '../../../shared/eftiRecord/testing/seedQuestions.js'

vi.mock('./api')

const QUESTIONS = loadSeedQuestions()
const PROFILE = { username: 'kim', isSuper: false }
const HEADER = { teacherName: 'kim', className: '햇살반', classTime: '토 10:00', completedOn: '2026-11-23' }

beforeEach(() => {
  vi.clearAllMocks()
  api.fetchQuestions.mockResolvedValue(QUESTIONS)
  api.fetchSheets.mockResolvedValue([])
  api.fetchResults.mockResolvedValue([
    { recordId: 'r1', header: HEADER, nickname: '민준', memo: null, citizenType: 'PASC', passportType: 'PASN', passportCounts: { F: 6, P: 7, A: 13, T: 0, S: 9, E: 4, C: 6, N: 7 }, missingCodes: [] },
  ])
  api.fetchSheet.mockResolvedValue({ header: HEADER, students: [{ id: 'r1', nickname: '민준', memo: null, answers: allAnswers(QUESTIONS, 1) }] })
})

describe('EftiRecordPage', () => {
  it('문항을 불러와 입력 탭을 먼저 보여준다', async () => {
    render(<EftiRecordPage profile={PROFILE} />)
    expect(await screen.findByText('더 멋진 사람은?')).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: '입력' })).toHaveAttribute('aria-selected', 'true')
  })

  it('결과 탭에서 행을 누르면 입력 탭에서 그 기록지를 연다', async () => {
    const user = userEvent.setup()
    render(<EftiRecordPage profile={PROFILE} />)
    await screen.findByText('더 멋진 사람은?')
    await user.click(screen.getByRole('tab', { name: '결과' }))
    await user.click(await screen.findByText('민준'))
    expect(screen.getByRole('tab', { name: '입력' })).toHaveAttribute('aria-selected', 'true')
    expect(await screen.findByDisplayValue('민준')).toBeInTheDocument()
    expect(api.fetchSheet).toHaveBeenCalledWith(HEADER)
  })

  it('입력 중에 결과 탭으로 가면 확인을 받는다', async () => {
    const user = userEvent.setup()
    const onDirtyChange = vi.fn()
    render(<EftiRecordPage profile={PROFILE} onDirtyChange={onDirtyChange} />)
    await user.type(await screen.findByLabelText('반 이름'), 'x')
    expect(onDirtyChange).toHaveBeenLastCalledWith(true)
    await user.click(screen.getByRole('tab', { name: '결과' }))
    expect(screen.getByText('저장하지 않은 내용이 있어요')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '계속' }))
    expect(screen.getByRole('tab', { name: '결과' })).toHaveAttribute('aria-selected', 'true')
    expect(onDirtyChange).toHaveBeenLastCalledWith(false)
  })

  it('결과에서 연 기록지는 탭을 오간 뒤 다시 열리지 않는다', async () => {
    const user = userEvent.setup()
    render(<EftiRecordPage profile={PROFILE} />)
    await screen.findByText('더 멋진 사람은?')
    await user.click(screen.getByRole('tab', { name: '결과' }))
    await user.click(await screen.findByText('민준'))
    expect(await screen.findByDisplayValue('민준')).toBeInTheDocument()
    expect(api.fetchSheet).toHaveBeenCalledTimes(1)
    await user.click(screen.getByRole('tab', { name: '결과' }))
    await user.click(screen.getByRole('tab', { name: '입력' }))
    expect(await screen.findByText('더 멋진 사람은?')).toBeInTheDocument()
    expect(api.fetchSheet).toHaveBeenCalledTimes(1)
  })

  it('문항을 못 불러오면 오류를 보여준다', async () => {
    api.fetchQuestions.mockRejectedValue(new Error('x'))
    render(<EftiRecordPage profile={PROFILE} />)
    expect(await screen.findByText('문항을 불러오지 못했어요. Exposed schemas 설정을 확인해 주세요')).toBeInTheDocument()
  })
})
