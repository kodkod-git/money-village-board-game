import { useState } from 'react'
import styles from './AdminSidebar.module.css'

const NAV_ITEMS = [
  { key: 'classes', label: '수업 목록', icon: '/icons/IconClasses.png' },
  { key: 'team-status', label: '팀 현황', icon: '/icons/IconTeams.png' },
  { key: 'ranking', label: '랭킹 보기', icon: '/icons/IconRankings.png' },
  { key: 'settings', label: '설정', icon: '/icons/IconSettings.png' },
]

export default function AdminSidebar({ activeSection, onNavigate, teamStatusDisabled }) {
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
        {NAV_ITEMS.map(item => {
          const disabled = item.key === 'team-status' || item.key === 'ranking' ? teamStatusDisabled : false
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
