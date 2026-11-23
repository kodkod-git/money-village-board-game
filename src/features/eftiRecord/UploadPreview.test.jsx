import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import UploadPreview from './UploadPreview'
import * as api from './api'
import { emptyAnswers } from '../../../shared/eftiRecord/sheetFormat.js'
import { loadSeedQuestions, allAnswers } from '../../../shared/eftiRecord/testing/seedQuestions.js'

vi.mock('./api')

const QUESTIONS = loadSeedQuestions()
const HEADER = { teacherName: 'kim', className: '햇살반', classTime: '토 10:00', completedOn: '2026-11-23' }
const PREVIEW = {
  header: HEADER,
  existingSheet: true,
  errors: [],
  students: [
    { nickname: '민준', memo: null, answers: allAnswers(QUESTIONS, 1), status: 'overwrite', existingId: 'r1', changedCount: 3 },
    { nickname: '서연', memo: '결석', answers: emptyAnswers(QUESTIONS), status: 'new', existingId: null, changedCount: 0 },
  ],
}

beforeEach(() => vi.clearAllMocks())

describe('UploadPreview', () => {
  it('헤더 요약, 학생별 배지와 유형을 보여준다', () => {
    render(<UploadPreview questions={QUESTIONS} preview={PREVIEW} onCancel={vi.fn()} onSaved={vi.fn()} />)
    expect(screen.getByText('햇살반 · 토 10:00 · 2026-11-23 · 선생님 kim · 학생 2명')).toBeInTheDocument()
    expect(screen.getByText('덮어쓰기 (바뀐 문항 3개)')).toBeInTheDocument()
    expect(screen.getByText('새로 추가')).toBeInTheDocument()
    expect(screen.getByText('PASN')).toBeInTheDocument()
  })

  it('오류가 있으면 셀 주소와 함께 보여주고 저장을 막는다', () => {
    const preview = { ...PREVIEW, errors: [{ code: 'INVALID_ANSWER', message: '1 또는 2만 입력할 수 있어요', cell: 'F10', studentIndex: 0, questionCode: '03' }] }
    render(<UploadPreview questions={QUESTIONS} preview={preview} onCancel={vi.fn()} onSaved={vi.fn()} />)
    expect(screen.getByText('F10: 1 또는 2만 입력할 수 있어요')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '저장' })).toBeDisabled()
  })

  it('저장은 덮어쓸 학생에 existingId 를 id 로 보내고 onSaved 를 부른다', async () => {
    const user = userEvent.setup()
    const saved = { header: HEADER, students: [] }
    api.saveSheet.mockResolvedValue(saved)
    const onSaved = vi.fn()
    render(<UploadPreview questions={QUESTIONS} preview={PREVIEW} onCancel={vi.fn()} onSaved={onSaved} />)
    await user.click(screen.getByRole('button', { name: '저장' }))
    const payload = api.saveSheet.mock.calls[0][0]
    expect(payload.original).toBeNull()
    expect(payload.deleteIds).toEqual([])
    expect(payload.students[0]).toMatchObject({ id: 'r1', nickname: '민준' })
    expect(payload.students[1]).not.toHaveProperty('id')
    expect(onSaved).toHaveBeenCalledWith(saved)
  })

  it('저장 실패 메시지를 보여준다', async () => {
    const user = userEvent.setup()
    api.saveSheet.mockRejectedValue({ errors: [{ code: 'SHEET_EXISTS', message: '이미 있어요' }] })
    render(<UploadPreview questions={QUESTIONS} preview={PREVIEW} onCancel={vi.fn()} onSaved={vi.fn()} />)
    await user.click(screen.getByRole('button', { name: '저장' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('이미 있어요')
  })

  it('Escape 로 닫고 취소 버튼에 포커스가 있다', async () => {
    const user = userEvent.setup()
    const onCancel = vi.fn()
    render(<UploadPreview questions={QUESTIONS} preview={PREVIEW} onCancel={onCancel} onSaved={vi.fn()} />)
    expect(screen.getByRole('button', { name: '취소' })).toHaveFocus()
    await user.keyboard('{Escape}')
    expect(onCancel).toHaveBeenCalled()
  })
})
