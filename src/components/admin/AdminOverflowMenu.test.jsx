import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import AdminOverflowMenu from './AdminOverflowMenu'

const open = () => userEvent.click(screen.getByRole('button', { name: '수업 메뉴' }))

describe('AdminOverflowMenu', () => {
  it('처음에는 닫혀 있고, 누르면 항목이 보인다', async () => {
    render(<AdminOverflowMenu label="수업 메뉴" items={[{ key: 'qr', label: 'QR 코드', onSelect: vi.fn() }]} />)
    expect(screen.queryByRole('menuitem')).not.toBeInTheDocument()
    await open()
    expect(screen.getByRole('menuitem', { name: 'QR 코드' })).toBeInTheDocument()
  })

  it('항목을 고르면 닫고 onSelect를 부른다', async () => {
    const onSelect = vi.fn()
    render(<AdminOverflowMenu label="수업 메뉴" items={[{ key: 'qr', label: 'QR 코드', onSelect }]} />)
    await open()
    await userEvent.click(screen.getByRole('menuitem', { name: 'QR 코드' }))
    expect(onSelect).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('menuitem')).not.toBeInTheDocument()
  })

  it('위험 항목은 넘긴 순서와 상관없이 맨 아래에 둔다', async () => {
    render(
      <AdminOverflowMenu
        label="수업 메뉴"
        items={[
          { key: 'delete', label: '삭제', danger: true, onSelect: vi.fn() },
          { key: 'qr', label: 'QR 코드', onSelect: vi.fn() },
        ]}
      />
    )
    await open()
    expect(screen.getAllByRole('menuitem').map(el => el.textContent)).toEqual(['QR 코드', '삭제'])
  })

  it('비활성 항목은 누를 수 없다', async () => {
    render(<AdminOverflowMenu label="수업 메뉴" items={[{ key: 'delete', label: '삭제', disabled: true, onSelect: vi.fn() }]} />)
    await open()
    expect(screen.getByRole('menuitem', { name: '삭제' })).toBeDisabled()
  })

  it('바깥을 누르거나 Esc를 누르면 닫힌다', async () => {
    render(
      <div>
        <button type="button">바깥</button>
        <AdminOverflowMenu label="수업 메뉴" items={[{ key: 'qr', label: 'QR 코드', onSelect: vi.fn() }]} />
      </div>
    )
    await open()
    await userEvent.click(screen.getByRole('button', { name: '바깥' }))
    expect(screen.queryByRole('menuitem')).not.toBeInTheDocument()

    await open()
    await userEvent.keyboard('{Escape}')
    expect(screen.queryByRole('menuitem')).not.toBeInTheDocument()
  })

  it('열면 메뉴를 보이는 위치로 스크롤한다', async () => {
    const scrollIntoView = vi.fn()
    Element.prototype.scrollIntoView = scrollIntoView
    render(<AdminOverflowMenu label="수업 메뉴" items={[{ key: 'qr', label: 'QR 코드', onSelect: vi.fn() }]} />)
    await open()
    expect(scrollIntoView).toHaveBeenCalledWith({ block: 'nearest' })
    delete Element.prototype.scrollIntoView
  })

  it('Esc로 닫으면 포커스가 트리거로 돌아간다', async () => {
    render(<AdminOverflowMenu label="수업 메뉴" items={[{ key: 'qr', label: 'QR 코드', onSelect: vi.fn() }]} />)
    await open()
    await userEvent.keyboard('{Escape}')
    expect(screen.getByRole('button', { name: '수업 메뉴' })).toHaveFocus()
  })

  it('메뉴에 접근 가능한 이름이 있다', async () => {
    render(<AdminOverflowMenu label="수업 메뉴" items={[{ key: 'qr', label: 'QR 코드', onSelect: vi.fn() }]} />)
    await open()
    expect(screen.getByRole('menu', { name: '수업 메뉴' })).toBeInTheDocument()
  })
})
