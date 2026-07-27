import { useState, useEffect, useCallback } from 'react'
import { adminFetch } from '../utils/adminAuth'
import ClassQRModal from '../components/admin/ClassQRModal'
import styles from './AdminClassList.module.css'

export default function AdminClassList({ profile, onSelectClass, onLogout }) {
  const [classes, setClasses] = useState([])
  const [newClassName, setNewClassName] = useState('')
  const [error, setError] = useState('')
  const [qrClass, setQrClass] = useState(null)

  const loadClasses = useCallback(() => {
    adminFetch('/api/admin/classes')
      .then(r => r.json())
      .then(setClasses)
      .catch(() => {})
  }, [])

  useEffect(() => {
    loadClasses()
  }, [loadClasses])

  async function handleCreateClass(e) {
    e.preventDefault()
    if (!newClassName.trim()) return
    setError('')
    const res = await adminFetch('/api/admin/classes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newClassName.trim() }),
    })
    const data = await res.json()
    if (!res.ok) {
      setError(data.error ?? '오류가 발생했습니다')
      return
    }
    setNewClassName('')
    loadClasses()
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>수업 선택</h1>
        <div className={styles.headerActions}>
          <span className={styles.username}>{profile.username}</span>
          <button type="button" className={styles.logoutBtn} onClick={onLogout}>로그아웃</button>
        </div>
      </div>

      <form className={styles.createForm} onSubmit={handleCreateClass}>
        <input
          className={styles.createInput}
          placeholder="새 수업 이름"
          value={newClassName}
          onChange={e => setNewClassName(e.target.value)}
        />
        <button type="submit" className={styles.createBtn}>수업 생성하기</button>
      </form>
      {error && <p className={styles.error}>{error}</p>}

      <ul className={styles.list}>
        {classes.map(cls => (
          <li key={cls.id} className={styles.item}>
            <button type="button" className={styles.itemBtn} onClick={() => onSelectClass({ id: cls.id, name: cls.name })}>
              {cls.name}
            </button>
            {cls.id !== 'unassigned' && (
              <button type="button" className={styles.qrBtn} onClick={() => setQrClass(cls)}>QR</button>
            )}
          </li>
        ))}
      </ul>

      {qrClass && <ClassQRModal classId={qrClass.id} name={qrClass.name} onClose={() => setQrClass(null)} />}
    </div>
  )
}
