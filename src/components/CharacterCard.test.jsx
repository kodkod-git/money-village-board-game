import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import CharacterCard from './CharacterCard'

describe('CharacterCard', () => {
  it('캐릭터 이미지를 렌더링한다', () => {
    render(<CharacterCard id="ptsc" state="idle" onSelect={() => {}} />)
    expect(screen.getByAltText('ptsc')).toBeInTheDocument()
  })

  it('idle 상태에서 클릭 시 onSelect를 호출한다', () => {
    const onSelect = vi.fn()
    render(<CharacterCard id="ptsc" state="idle" onSelect={onSelect} />)
    fireEvent.click(screen.getByRole('button'))
    expect(onSelect).toHaveBeenCalledWith('ptsc')
  })

  it('locked 상태에서 클릭해도 onSelect를 호출하지 않는다', () => {
    const onSelect = vi.fn()
    render(<CharacterCard id="ptsc" state="locked" onSelect={onSelect} />)
    fireEvent.click(screen.getByRole('button'))
    expect(onSelect).not.toHaveBeenCalled()
  })

  it('selected 상태에서 체크 뱃지를 표시한다', () => {
    render(<CharacterCard id="ptsc" state="selected" onSelect={() => {}} />)
    expect(screen.getByText('✓')).toBeInTheDocument()
  })

  it('locked 상태에서 잠금 뱃지를 표시한다', () => {
    render(<CharacterCard id="ptsc" state="locked" onSelect={() => {}} />)
    expect(screen.getByText('🔒')).toBeInTheDocument()
  })
})
