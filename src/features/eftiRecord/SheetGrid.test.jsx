import { useReducer, useMemo } from 'react'
import { render, screen, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import SheetGrid from './SheetGrid'
import { sheetReducer, initialSheetState } from './sheetState'
import { computeResult } from '../../../shared/eftiRecord/scoring.js'
import { loadSeedQuestions } from '../../../shared/eftiRecord/testing/seedQuestions.js'

const QUESTIONS = loadSeedQuestions()

function Harness({ onRemove = vi.fn() }) {
  const [state, dispatch] = useReducer(sheetReducer, undefined, () => initialSheetState(QUESTIONS, 'kim'))
  const results = useMemo(() => state.students.map(s => computeResult(s.answers, QUESTIONS)), [state.students])
  return (
    <SheetGrid
      questions={QUESTIONS}
      students={state.students}
      results={results}
      onCycle={(key, code) => dispatch({ type: 'cycleAnswer', key, code })}
      onSetAnswer={(key, code, value) => dispatch({ type: 'setAnswer', key, code, value })}
      onSetName={(key, value) => dispatch({ type: 'setStudentField', key, field: 'nickname', value })}
      onSetMemo={(key, value) => dispatch({ type: 'setStudentField', key, field: 'memo', value })}
      onRemove={onRemove}
      onAdd={() => dispatch({ type: 'addStudent', questions: QUESTIONS })}
    />
  )
}

const cell = name => screen.getByRole('button', { name })

describe('SheetGrid', () => {
  it('문항 코드·질문·선택지와 1단계/2단계 구분 행을 보여준다', () => {
    render(<Harness />)
    expect(screen.getByText('더 멋진 사람은?')).toBeInTheDocument()
    expect(screen.getByText('내일을 위해 차근차근 준비')).toBeInTheDocument()
    expect(screen.getByText('1단계')).toBeInTheDocument()
    expect(screen.getByText('2단계')).toBeInTheDocument()
  })

  it('클릭하면 빈칸 → ① → ② → 빈칸', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await user.click(cell('학생 1 01'))
    expect(cell('학생 1 01')).toHaveTextContent(/^1$/)
    await user.click(cell('학생 1 01'))
    expect(cell('학생 1 01')).toHaveTextContent(/^2$/)
    await user.click(cell('학생 1 01'))
    expect(cell('학생 1 01')).toHaveTextContent(/^$/)
  })

  it('1/2 를 누르면 입력하고 아래 칸으로, Backspace 는 비우기, 방향키 이동', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    act(() => cell('학생 1 01').focus())
    await user.keyboard('1')
    expect(cell('학생 1 01')).toHaveTextContent(/^1$/)
    expect(cell('학생 1 02')).toHaveFocus()
    await user.keyboard('2')
    expect(cell('학생 1 02')).toHaveTextContent(/^2$/)
    await user.keyboard('{ArrowUp}{ArrowUp}{Backspace}')
    expect(cell('학생 1 01')).toHaveTextContent(/^$/)
  })

  it('이름을 넣고 52문항을 모두 1로 채우면 요약 행에 PASC / PASN', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await user.type(screen.getByLabelText('학생 1 이름'), '민준{Enter}')
    expect(cell('민준 01')).toHaveFocus()
    expect(screen.getAllByText('보충 필요').length).toBeGreaterThan(0)
    await user.keyboard('1'.repeat(52))
    expect(screen.getByText('PASC')).toBeInTheDocument()
    expect(screen.getByText('PASN')).toBeInTheDocument()
    expect(screen.queryByText('보충 필요')).not.toBeInTheDocument()
  })

  it('+ 학생 으로 열을 늘리고, 삭제 버튼은 onRemove(key)', async () => {
    const user = userEvent.setup()
    const onRemove = vi.fn()
    render(<Harness onRemove={onRemove} />)
    await user.click(screen.getByRole('button', { name: '+ 학생' }))
    expect(screen.getByLabelText('학생 2 이름')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '학생 2 삭제' }))
    expect(onRemove).toHaveBeenCalledWith(expect.stringMatching(/^s\d+$/))
  })

  it('읽기 전용이면 배지·메모를 보여주고 입력 버튼이 없다', () => {
    const students = [{ key: 'u0', nickname: '민준', memo: '결석', answers: { '01': 1, '02': '3' } }]
    render(
      <SheetGrid
        readOnly
        questions={QUESTIONS}
        students={students}
        results={[computeResult(students[0].answers, QUESTIONS)]}
        errors={[{ code: 'INVALID_ANSWER', message: '1 또는 2만', studentIndex: 0, questionCode: '02' }]}
        badges={{ u0: '새로 추가' }}
      />
    )
    expect(screen.getByText('새로 추가')).toBeInTheDocument()
    expect(screen.getByTitle('결석')).toBeInTheDocument()
    expect(screen.getByText('3')).toHaveAttribute('title', '1 또는 2만')
    expect(screen.queryByRole('button', { name: '+ 학생' })).not.toBeInTheDocument()
  })

  it('답 칸은 첫 행만 Tab 정지점이다', () => {
    render(<Harness />)
    expect(cell('학생 1 01')).toHaveAttribute('tabindex', '0')
    expect(cell('학생 1 02')).toHaveAttribute('tabindex', '-1')
  })

  it('메모 버튼으로 메모 칸을 열면 포커스되고 Escape 로 닫힌다', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await user.click(cell('학생 1 메모'))
    expect(screen.getByLabelText('학생 1 메모 입력')).toHaveFocus()
    await user.keyboard('{Escape}')
    expect(screen.queryByLabelText('학생 1 메모 입력')).not.toBeInTheDocument()
  })
})

describe('SheetGrid 표시', () => {
  it('①은 파란, ②는 주황 원형 배지로 크게 보인다', () => {
    const questions = loadSeedQuestions()
    const answers = Object.fromEntries(questions.map(q => [q.code, null]))
    answers['01'] = 1
    answers['02'] = 2
    render(
      <SheetGrid
        questions={questions}
        students={[{ key: 'a', nickname: '민준', memo: '', answers }]}
        results={[]}
        onCycle={() => {}} onSetAnswer={() => {}} onSetName={() => {}}
        onSetMemo={() => {}} onRemove={() => {}} onAdd={() => {}}
      />,
    )
    expect(screen.getByRole('button', { name: '민준 01' }).querySelector('[data-mark="1"]')).toHaveTextContent('1')
    expect(screen.getByRole('button', { name: '민준 02' }).querySelector('[data-mark="2"]')).toHaveTextContent('2')
  })
})
