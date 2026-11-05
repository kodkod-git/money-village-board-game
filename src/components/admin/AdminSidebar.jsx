import { useState } from 'react'
import { NAV_ITEMS } from './adminNavItems'
import styles from './AdminSidebar.module.css'

export default function AdminSidebar({ activeSection, onNavigate, teamStatusDisabled, isSuper }) {
  const [collapsed, setCollapsed] = useState(false)

  return (
    <nav className={`${styles.sidebar} ${collapsed ? styles.collapsed : ''}`}>
      <div className={styles.brand}>
        <div className={styles.brandIcon} aria-hidden="true">🙂</div>
        {!collapsed && (
          <div className={styles.brandText}>
            <p className={styles.brandName}>GameAdmin</p>
            <p className={styles.brandSub}>관리자 모드</p>
          </div>
        )}
      </div>

      <div className={styles.nav}>
        {NAV_ITEMS.filter(item => !item.superOnly || isSuper).map(item => {
          const disabled = item.needsClass ? teamStatusDisabled : false
          return (
            <button
              key={item.key}
              type="button"
              className={`${styles.navItem} ${activeSection === item.key ? styles.navItemActive : ''}`}
              onClick={() => onNavigate(item.key)}
              disabled={disabled}
              title={collapsed ? item.label : undefined}
            >
              <span
                className={styles.navIcon}
                style={{ WebkitMaskImage: `url(${item.icon})`, maskImage: `url(${item.icon})` }}
                aria-hidden="true"
              />
              {!collapsed && <span className={styles.navLabel}>{item.label}</span>}
            </button>
          )
        })}
      </div>

      <div className={styles.footer}>
        <button type="button" className={styles.collapseBtn} onClick={() => setCollapsed(v => !v)}>
          <span aria-hidden="true">{collapsed ? '»' : '«'}</span>
          {!collapsed && <span>메뉴 접기</span>}
        </button>
      </div>
    </nav>
  )
}
