import { useState, useEffect, useCallback } from 'react'
import { adminFetch } from '../utils/adminAuth'
import ClassQRModal from '../components/admin/ClassQRModal'
import SurveyQRModal from '../components/admin/SurveyQRModal'
import ConfirmDialog from '../components/admin/ConfirmDialog'
import styles from './AdminClassList.module.css'

function formatDate(isoString) {
  return new Date(isoString).toLocaleDateString('ko-KR')
}

const CLASS_MODE_OPTIONS = [
  { value: 'normal', label: '일반' },
  { value: 'competition', label: '경쟁' },
]

export default function AdminClassList({ profile, onSelectClass, onLogout }) {
  const [classes, setClasses] = useState([])
  const [newClassName, setNewClassName] = useState('')
  const [newClassMode, setNewClassMode] = useState('normal')
  const [error, setError] = useState('')
  const [qrClass, setQrClass] = useState(null)
  const [showSurveyQr, setShowSurveyQr] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [showEmptyNameWarning, setShowEmptyNameWarning] = useState(false)

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
    if (!newClassName.trim()) {
      setShowEmptyNameWarning(true)
      return
    }
    setError('')
    const res = await adminFetch('/api/admin/classes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newClassName.trim(), mode: newClassMode }),
    })
    const data = await res.json()
    if (!res.ok) {
      setError(data.error ?? '오류가 발생했습니다')
      return
    }
    setNewClassName('')
    setNewClassMode('normal')
    loadClasses()
  }

  async function handleConfirmDelete() {
    const res = await adminFetch(`/api/admin/classes/${deleteTarget.id}`, { method: 'DELETE' })
    setDeleteTarget(null)
    if (!res.ok) return
    loadClasses()
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>수업 목록</h1>
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
        <div className={styles.modeGroup} role="radiogroup" aria-label="수업 모드">
          {CLASS_MODE_OPTIONS.map(option => (
            <label key={option.value} className={styles.modeOption}>
              <input
                type="radio"
                name="class-mode"
                value={option.value}
                checked={newClassMode === option.value}
                onChange={() => setNewClassMode(option.value)}
              />
              {option.label}
            </label>
          ))}
        </div>
        <button type="submit" className={styles.createBtn}>수업 생성하기</button>
      </form>
      {error && <p className={styles.error}>{error}</p>}

      <ul className={styles.list}>
        {classes.map(cls => (
          <li key={cls.id} className={styles.item}>
            <button type="button" className={styles.itemBtn} onClick={() => onSelectClass({ id: cls.id, name: cls.name, mode: cls.mode ?? 'normal' })}>
              <span className={styles.itemTitleRow}>
                <span className={styles.itemName}>{cls.name}</span>
                {cls.mode === 'competition' && <span className={styles.modeBadge}>경쟁</span>}
              </span>
              {cls.createdAt && <span className={styles.itemDate}>{formatDate(cls.createdAt)}</span>}
            </button>
            {cls.id !== 'unassigned' && (
              <>
                <button type="button" className={styles.qrBtn} onClick={() => setShowSurveyQr(true)}>만족도 조사</button>
                <button type="button" className={styles.qrBtn} onClick={() => setQrClass(cls)}>QR</button>
                <button type="button" className={styles.deleteBtn} onClick={() => setDeleteTarget(cls)}>삭제</button>
              </>
            )}
          </li>
        ))}
      </ul>

      {qrClass && <ClassQRModal classId={qrClass.id} name={qrClass.name} onClose={() => setQrClass(null)} />}
      {showSurveyQr && <SurveyQRModal onClose={() => setShowSurveyQr(false)} />}

      {deleteTarget && (
        <ConfirmDialog
          tone="danger"
          title="수업 삭제"
          description={<>'{deleteTarget.name}' 수업을 삭제하면 관련된 모든 팀 기록도 함께 삭제되며 되돌릴 수 없습니다.<br />삭제하시겠습니까?</>}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={handleConfirmDelete}
        />
      )}

      {showEmptyNameWarning && (
        <ConfirmDialog
          tone="primary"
          title="알림"
          description="수업 이름을 입력해주세요"
          confirmLabel="확인"
          hideCancel
          onCancel={() => setShowEmptyNameWarning(false)}
          onConfirm={() => setShowEmptyNameWarning(false)}
        />
      )}
    </div>
  )
}
