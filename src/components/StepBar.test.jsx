import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import StepBar from './StepBar'

const STEPS = ['직업', '성공카드', '부동산', '주식', '현금']

describe('StepBar', () => {
  it('5개 스텝 라벨을 모두 렌더링한다', () => {
    render(<StepBar steps={STEPS} currentStep={0} completedUpTo={-1} />)
    STEPS.forEach(label => expect(screen.getByText(label)).toBeInTheDocument())
  })

  it('currentStep의 버튼에 stepActive 클래스가 적용된다', () => {
    render(<StepBar steps={STEPS} currentStep={2} completedUpTo={1} />)
    expect(screen.getByText('부동산').closest('button').className).toMatch(/stepActive/)
  })

  it('onStepClick이 없으면 모든 버튼이 disabled이다', () => {
    render(<StepBar steps={STEPS} currentStep={0} completedUpTo={-1} />)
    STEPS.forEach(label => {
      expect(screen.getByText(label).closest('button')).toBeDisabled()
    })
  })

  it('onStepClick이 있고 completedUpTo 이하 스텝은 클릭 가능하다', async () => {
    const onStepClick = vi.fn()
    render(<StepBar steps={STEPS} currentStep={2} completedUpTo={4} onStepClick={onStepClick} />)
    await userEvent.click(screen.getByText('직업').closest('button'))
    expect(onStepClick).toHaveBeenCalledWith(0)
  })
})
