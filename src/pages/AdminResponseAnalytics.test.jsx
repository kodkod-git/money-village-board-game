import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import AdminResponseAnalytics from './AdminResponseAnalytics'

const POTENTIAL_ROWS = [
  {
    id: 'p1', submitted_at: '2026-10-10T12:21:00', child_name: '이도경', child_gender: 'female', child_age: 10,
    q_pocket_money: '바로 쓰며 기뻐하는 편이에요.', result_group: 'Green Group', source: 'app',
  },
  { id: 'p2', submitted_at: '2026-10-08T16:46:00', child_name: '최윤솔', child_age: 9, result_group: 'Blue Group', source: 'smore_import', smore_token: 'tok' },
]

const SYNERGY_ROWS = [
  { id: 's1', submitted_at: '2026-10-11T10:00:00', my_name: '머니왕', citizen_name: '경제박사', citizen_type: 'FASN', my_type: 'PTSN', source: 'app' },
]

beforeEach(() => {
  global.fetch = vi.fn(url => {
    const data = url.includes('/synergy/') ? SYNERGY_ROWS : POTENTIAL_ROWS
    return Promise.resolve({ ok: true, json: () => Promise.resolve(data) })
  })
})

describe('AdminResponseAnalytics', () => {
  it('완료 수를 보여주고 아직 수집하지 않는 지표는 준비 중으로 표시한다', async () => {
    render(<AdminResponseAnalytics />)
    await screen.findByText('이도경')
    expect(screen.getByText('완료').previousSibling).toHaveTextContent('2')
    expect(screen.getAllByText('준비 중')).toHaveLength(5)
  })

  it('응답별 데이터 테이블에 DB 컬럼을 모두 보여준다', async () => {
    render(<AdminResponseAnalytics />)
    await screen.findByText('이도경')
    expect(screen.getByText('여자아이')).toBeInTheDocument()
    expect(screen.getByText('스모어 이관')).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: 'smore_token' })).toBeInTheDocument()
    expect(fetch).toHaveBeenCalledWith('/api/admin/survey/potential/responses', expect.anything())
  })

  it('테스트 탭을 바꾸면 시너지 테스트 응답을 불러온다', async () => {
    render(<AdminResponseAnalytics />)
    await screen.findByText('이도경')
    await userEvent.click(screen.getByRole('tab', { name: 'EFTI 시너지 테스트' }))
    expect(await screen.findByText('머니왕')).toBeInTheDocument()
    expect(fetch).toHaveBeenLastCalledWith('/api/admin/survey/synergy/responses', expect.anything())
  })

  it('경제적 잠재력 인사이트는 그룹별 도넛 차트를 보여준다', async () => {
    render(<AdminResponseAnalytics />)
    await screen.findByText('이도경')
    await userEvent.click(screen.getByRole('tab', { name: '결과 인사이트' }))
    expect(screen.getByRole('img', { name: /Green Group 1명.*Blue Group 1명/ })).toBeInTheDocument()
  })

  it('시너지 인사이트는 16개 유형 히스토그램을 보여준다', async () => {
    render(<AdminResponseAnalytics />)
    await screen.findByText('이도경')
    await userEvent.click(screen.getByRole('tab', { name: 'EFTI 시너지 테스트' }))
    await screen.findByText('머니왕')
    await userEvent.click(screen.getByRole('tab', { name: '결과 인사이트' }))
    const chart = screen.getByRole('img', { name: /PTSN 1명/ })
    expect(within(chart).getAllByText(/^[FP][TA][SE][NC]$/)).toHaveLength(16)
  })

  it('기간 인사이트는 일자별 완료 수 막대 차트를 보여주고 기간을 바꿀 수 있다', async () => {
    render(<AdminResponseAnalytics />)
    await screen.findByText('이도경')
    await userEvent.click(screen.getByRole('tab', { name: '기간 인사이트' }))
    expect(screen.getByRole('img', { name: /2026-10-10 1건.*2026-10-08 1건|2026-10-08 1건.*2026-10-10 1건/ })).toBeInTheDocument()
    expect(screen.getByText('2건')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('tab', { name: '최근 7일' }))
    expect(screen.getByRole('tab', { name: '최근 7일' })).toHaveAttribute('aria-selected', 'true')
  })

  it('질문 인사이트는 고른 질문의 선택지 비율을 파이 차트로 보여준다', async () => {
    render(<AdminResponseAnalytics />)
    await screen.findByText('이도경')
    await userEvent.click(screen.getByRole('tab', { name: '질문 인사이트' }))
    // 첫 질문(용돈): 2건 중 1건만 답했고, 답한 1건이 "바로 쓰며…"
    expect(screen.getByRole('img', { name: /바로 쓰며 기뻐하는 편이에요. 100.0%.*모았다가 뜻있게 쓰는 편이에요. 0.0%/ })).toBeInTheDocument()
    expect(screen.getByText(/미응답 1건 제외/)).toBeInTheDocument()

    await userEvent.selectOptions(screen.getByRole('combobox'), '우리 아이는 새로운 활동을 할 때 어떤 편인가요?')
    expect(screen.getByRole('img', { name: /익숙한 방법이 편한 편이에요. 0.0%/ })).toBeInTheDocument()
  })

  it('질문 이탈률은 질문 목록과 준비 중 안내를 보여준다', async () => {
    render(<AdminResponseAnalytics />)
    await screen.findByText('이도경')
    await userEvent.click(screen.getByRole('tab', { name: '질문 이탈률' }))
    const table = screen.getByRole('table')
    expect(within(table).getByRole('columnheader', { name: '이탈률' })).toBeInTheDocument()
    // 이름·성별·나이 + 질문 6개
    expect(within(table).getAllByRole('row')).toHaveLength(1 + 9)
    expect(within(table).getByText(/우리 아이는 용돈을 받으면/)).toBeInTheDocument()
    expect(within(table).getAllByText('준비 중')).toHaveLength(9)
  })

  it('불러오기에 실패하면 오류 문구를 보여준다', async () => {
    global.fetch = vi.fn(() => Promise.resolve({ ok: false }))
    render(<AdminResponseAnalytics />)
    expect(await screen.findByText('응답을 불러오는 중 오류가 발생했습니다.')).toBeInTheDocument()
  })
})
