import { NAV_ITEMS } from './adminNavItems'
import styles from './AdminBottomNav.module.css'

const MOBILE_ITEMS = NAV_ITEMS.filter(item => item.mobile !== false)

export default function AdminBottomNav({ activeSection, onNavigate, teamStatusDisabled }) {
  return (
    <nav className={styles.nav}>
      {MOBILE_ITEMS.map(item => {
        const active = activeSection === item.key
        return (
          <button
            key={item.key}
            type="button"
            className={`${styles.item} ${active ? styles.itemActive : ''}`}
            onClick={() => onNavigate(item.key)}
            disabled={item.needsClass ? teamStatusDisabled : false}
            aria-current={active ? 'page' : undefined}
          >
            <span
              className={styles.icon}
              style={{ WebkitMaskImage: `url(${item.icon})`, maskImage: `url(${item.icon})` }}
              aria-hidden="true"
            />
            <span className={styles.label}>{item.label}</span>
          </button>
        )
      })}
    </nav>
  )
}
