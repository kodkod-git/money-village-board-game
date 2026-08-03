import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import NumberInputModal from './NumberInputModal'

describe('NumberInputModal portal placement', () => {
  it('renders outside its caller so clipped scroll containers cannot crop the keypad', () => {
    const { container } = render(
      <div data-testid="scroll-container" style={{ overflow: 'hidden' }}>
        <NumberInputModal
          title="Quantity"
          initialValue={3}
          unit="ea"
          onConfirm={vi.fn()}
          onClose={vi.fn()}
        />
      </div>,
    )

    expect(screen.getByText('Quantity')).toBeInTheDocument()
    expect(container.querySelector('[data-testid="scroll-container"]')).not.toContainElement(
      screen.getByText('Quantity'),
    )
  })
})
