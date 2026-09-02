import { useSyncExternalStore } from 'react'
import { subscribeToasts, getToasts, dismissToast } from '../utils/toast'
import styles from './Toaster.module.css'

export default function Toaster() {
  const toasts = useSyncExternalStore(subscribeToasts, getToasts, getToasts)
  if (toasts.length === 0) return null
  return (
    <div className={styles.container} role="status" aria-live="polite">
      {toasts.map(t => (
        <button
          key={t.id}
          type="button"
          className={styles.toast}
          onClick={() => dismissToast(t.id)}
        >
          {t.message}
        </button>
      ))}
    </div>
  )
}
