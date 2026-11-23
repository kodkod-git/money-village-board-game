import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import SheetEditor from './SheetEditor'
import * as api from './api'
import { loadSeedQuestions, allAnswers } from '../../../shared/eftiRecord/testing/seedQuestions.js'

vi.mock('./api')

const QUESTIONS = loadSeedQuestions()
const PROFILE = { username: 'kim', isSuper: false }
const HEADER = { teacherName: 'kim', className: '햇살반', classTime: '토 10:00', completedOn: '2026-11-23' }
const SHEET = {
  header: HEADER,
  students: [
    { id: 'r1', nickname: '민준', memo: null, answers: allAnswers(QUESTIONS, 1) },
    { id: 'r2', nickname: '서연', memo: '결석', answers: allAnswers(QUESTIONS, 2) },
  ],
}

beforeEach(() => {
  vi.clearAllMocks()
  api.fetchSheets.mockResolvedValue([{ header: HEADER, studentCount: 2, needsFollowUpCount: 0 }])
  api.fetchSheet.mockResolvedValue(SHEET)
})

async function fillHeader(user) {
  await user.type(screen.getByLabelText('반 이름'), '햇살반')
  await user.type(screen.getByLabelText('수업시간'), '토 10:00')
  fireEvent.change(screen.getByLabelText('수업 날짜'), { target: { value: '2026-11-23' } })
}

describe('SheetEditor', () => {
  it('선생님 칸은 로그인 계정으로 채워지고 수정할 수 없다', async () => {
    render(<SheetEditor questions={QUESTIONS} profile={PROFILE} />)
    const teacher = screen.getByLabelText('선생님')
    expect(teacher).toHaveValue('kim')
    expect(teacher).toHaveAttribute('readonly')
    await waitFor(() => expect(api.fetchSheets).toHaveBeenCalled())
  })

  it('헤더와 학생을 채우면 저장이 켜지고, 저장 결과로 다시 채운다', async () => {
    const user = userEvent.setup()
    api.saveSheet.mockResolvedValue({ header: HEADER, students: [{ id: 'r9', nickname: '민준', memo: null, answers: allAnswers(QUESTIONS, 1) }] })
    render(<SheetEditor questions={QUESTIONS} profile={PROFILE} />)
    const save = screen.getByRole('button', { name: '저장' })
    expect(save).toBeDisabled()
    await fillHeader(user)
    await user.type(screen.getByLabelText('학생 1 이름'), '민준')
    await user.click(screen.getByRole('button', { name: '민준 01' }))
    expect(save).toBeEnabled()
    await user.click(save)
    const payload = api.saveSheet.mock.calls[0][0]
    expect(payload.original).toBeNull()
    expect(payload.header).toEqual(HEADER)
    expect(payload.students[0]).toMatchObject({ nickname: '민준' })
    expect(payload.students[0].answers['01']).toBe(1)
    expect(await screen.findByText('학생 1명을 저장했어요')).toBeInTheDocument()
    expect(save).toBeDisabled()
  })

  it('target 으로 기록지를 열고, 저장된 학생 열을 지우면 확인 후 deleteIds 로 보낸다', async () => {
    const user = userEvent.setup()
    api.saveSheet.mockResolvedValue({ header: HEADER, students: [SHEET.students[0]] })
    render(<SheetEditor questions={QUESTIONS} profile={PROFILE} target={{ header: HEADER, nickname: '서연' }} />)
    expect(await screen.findByDisplayValue('서연')).toBeInTheDocument()
    expect(api.fetchSheet).toHaveBeenCalledWith(HEADER)
    await user.click(screen.getByRole('button', { name: '서연 삭제' }))
    await user.click(screen.getByRole('button', { name: '삭제' }))
    expect(screen.queryByDisplayValue('서연')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '저장' }))
    const payload = api.saveSheet.mock.calls[0][0]
    expect(payload.original).toEqual(HEADER)
    expect(payload.deleteIds).toEqual(['r2'])
  })

  it('서버 오류 메시지를 보여준다', async () => {
    const user = userEvent.setup()
    api.saveSheet.mockRejectedValue({ errors: [{ code: 'SHEET_EXISTS', message: '같은 기록지가 이미 있어요' }] })
    render(<SheetEditor questions={QUESTIONS} profile={PROFILE} target={{ header: HEADER }} />)
    await screen.findByDisplayValue('민준')
    await user.clear(screen.getByLabelText('수업시간'))
    await user.type(screen.getByLabelText('수업시간'), '토 11:00')
    await user.click(screen.getByRole('button', { name: '저장' }))
    expect(await screen.findByText('같은 기록지가 이미 있어요')).toBeInTheDocument()
  })

  it('저장하지 않은 변경이 있으면 다른 기록지를 열기 전에 묻는다', async () => {
    const user = userEvent.setup()
    render(<SheetEditor questions={QUESTIONS} profile={PROFILE} />)
    await user.type(screen.getByLabelText('반 이름'), 'x')
    const select = await screen.findByRole('combobox', { name: '기존 기록지 열기' })
    await waitFor(() => expect(select.options.length).toBe(2))
    await user.selectOptions(select, '0')
    expect(screen.getByText('저장하지 않은 내용이 있어요')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '계속' }))
    expect(await screen.findByDisplayValue('민준')).toBeInTheDocument()
  })

  it('파일을 고르면 업로드 미리보기를 띄운다', async () => {
    const user = userEvent.setup()
    api.uploadFile.mockResolvedValue({ header: HEADER, students: [], errors: [], existingSheet: false })
    render(<SheetEditor questions={QUESTIONS} profile={PROFILE} />)
    await user.upload(screen.getByLabelText('업로드 파일'), new File(['x'], 'sheet.xlsx'))
    expect(await screen.findByRole('dialog', { name: '업로드 미리보기' })).toBeInTheDocument()
  })

  it('저장 중에는 입력이 잠긴다', async () => {
    const user = userEvent.setup()
    api.saveSheet.mockReturnValue(new Promise(() => {}))
    render(<SheetEditor questions={QUESTIONS} profile={PROFILE} />)
    await fillHeader(user)
    await user.type(screen.getByLabelText('학생 1 이름'), '민준')
    await user.click(screen.getByRole('button', { name: '민준 01' }))
    await user.click(screen.getByRole('button', { name: '저장' }))
    expect(screen.getByRole('button', { name: '민준 01' })).toBeDisabled()
  })
})
