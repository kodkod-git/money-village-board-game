import { useState, useEffect, useCallback } from 'react'
import { adminFetch } from '../utils/adminAuth'
import OrgQRModal from '../components/admin/OrgQRModal'
import styles from './AdminOrgList.module.css'

export default function AdminOrgList({ profile, onSelectOrg, onLogout }) {
  const [orgs, setOrgs] = useState([])
  const [newOrgName, setNewOrgName] = useState('')
  const [error, setError] = useState('')
  const [qrOrg, setQrOrg] = useState(null)

  const loadOrgs = useCallback(() => {
    adminFetch('/api/admin/orgs')
      .then(r => r.json())
      .then(setOrgs)
      .catch(() => {})
  }, [])

  useEffect(() => {
    loadOrgs()
  }, [loadOrgs])

  async function handleCreateOrg(e) {
    e.preventDefault()
    if (!newOrgName.trim()) return
    setError('')
    const res = await adminFetch('/api/admin/orgs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newOrgName.trim() }),
    })
    const data = await res.json()
    if (!res.ok) {
      setError(data.error ?? '오류가 발생했습니다')
      return
    }
    setNewOrgName('')
    loadOrgs()
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>소속 선택</h1>
        <div className={styles.headerActions}>
          <span className={styles.username}>{profile.username}</span>
          <button type="button" className={styles.logoutBtn} onClick={onLogout}>로그아웃</button>
        </div>
      </div>

      <form className={styles.createForm} onSubmit={handleCreateOrg}>
        <input
          className={styles.createInput}
          placeholder="새 소속 이름"
          value={newOrgName}
          onChange={e => setNewOrgName(e.target.value)}
        />
        <button type="submit" className={styles.createBtn}>소속 생성하기</button>
      </form>
      {error && <p className={styles.error}>{error}</p>}

      <ul className={styles.list}>
        {orgs.map(org => (
          <li key={org.id} className={styles.item}>
            <button type="button" className={styles.itemBtn} onClick={() => onSelectOrg(org.name)}>
              {org.name}
            </button>
            {org.id !== 'unassigned' && (
              <button type="button" className={styles.qrBtn} onClick={() => setQrOrg(org)}>QR</button>
            )}
          </li>
        ))}
      </ul>

      {qrOrg && <OrgQRModal orgName={qrOrg.name} onClose={() => setQrOrg(null)} />}
    </div>
  )
}
