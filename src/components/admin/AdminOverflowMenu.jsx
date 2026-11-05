import { useEffect, useRef, useState } from 'react'
import styles from './AdminOverflowMenu.module.css'

// placement: 화면 아래쪽 버튼에서 열 때는 'up'으로 위로 펼친다.
export default function AdminOverflowMenu({ label, items, placement = 'down' }) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef(null)
  const triggerRef = useRef(null)
  const menuRef = useRef(null)
  const ordered = [...items.filter(item => !item.danger), ...items.filter(item => item.danger)]

  useEffect(() => {
    // 스크롤 목록의 아래쪽 행에서 열면 메뉴가 잘리므로 보이는 위치로 끌어온다.
    if (open) menuRef.current?.scrollIntoView?.({ block: 'nearest' })
  }, [open])

  useEffect(() => {
    if (!open) return undefined
    function handlePointerDown(event) {
      if (!rootRef.current?.contains(event.target)) setOpen(false)
    }
    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        setOpen(false)
        triggerRef.current?.focus()
      }
    }
    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [open])

  return (
    <div ref={rootRef} className={styles.root}>
      <button
        type="button"
        ref={triggerRef}
        className={styles.trigger}
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen(v => !v)}
      >
        ⋯
      </button>
      {open && (
        <div ref={menuRef} role="menu" aria-label={label} className={`${styles.menu} ${placement === 'up' ? styles.menuUp : ''}`}>
          {ordered.map(item => (
            <button
              key={item.key}
              type="button"
              role="menuitem"
              className={`${styles.item} ${item.danger ? styles.itemDanger : ''}`}
              disabled={item.disabled}
              onClick={() => { setOpen(false); item.onSelect() }}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
