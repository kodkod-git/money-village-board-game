import { useEffect, useRef, useState } from 'react'
import styles from './AdminOverflowMenu.module.css'

// placement: 화면 아래쪽 버튼에서 열 때는 'up'으로 위로 펼친다.
export default function AdminOverflowMenu({ label, items, placement = 'down' }) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef(null)
  const ordered = [...items.filter(item => !item.danger), ...items.filter(item => item.danger)]

  useEffect(() => {
    if (!open) return undefined
    function handlePointerDown(event) {
      if (!rootRef.current?.contains(event.target)) setOpen(false)
    }
    function handleKeyDown(event) {
      if (event.key === 'Escape') setOpen(false)
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
        className={styles.trigger}
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen(v => !v)}
      >
        ⋯
      </button>
      {open && (
        <div role="menu" className={`${styles.menu} ${placement === 'up' ? styles.menuUp : ''}`}>
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
