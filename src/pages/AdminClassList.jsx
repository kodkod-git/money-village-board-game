import { useState, useEffect, useCallback } from 'react'
import { adminFetch } from '../utils/adminAuth'
import ClassQRModal from '../components/admin/ClassQRModal'
import SurveyQRModal from '../components/admin/SurveyQRModal'
import ConfirmDialog from '../components/admin/ConfirmDialog'
import AdminOverflowMenu from '../components/admin/AdminOverflowMenu'
import useIsAdminMobile from '../hooks/useIsAdminMobile'
import styles from './AdminClassList.module.css'

function formatDate(isoString) {
  return new Date(isoString).toLocaleDateString('ko-KR')
}

// 게임 목록은 수업과 대회(공식전)를 좌우 칼럼으로 나눠 각자 생성 폼과 목록을 둔다.
const COLUMNS = [
  { kind: 'class', title: '수업 목록', placeholder: '새 수업 이름', createLabel: '수업 생성하기', empty: '아직 만든 수업이 없어요' },
  { kind: 'official', title: '대회 목록', placeholder: '새 대회 이름', createLabel: '대회 생성하기', empty: '아직 만든 대회가 없어요' },
]

export default function AdminClassList({ profile, onSelectClass, onLogout }) {
  const [classes, setClasses] = useState([])
  const [newClassName, setNewClassName] = useState('')
  const [newContestName, setNewContestName] = useState('')
  const [error, setError] = useState(null) // { kind, message }
  const [qrClass, setQrClass] = useState(null)
  const [showSurveyQr, setShowSurveyQr] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [showEmptyNameWarning, setShowEmptyNameWarning] = useState(false)
  const isMobile = useIsAdminMobile()

  const loadClasses = useCallback(() => {
    adminFetch('/api/admin/classes')
      .then(r => r.json())
      .then(setClasses)
      .catch(() => {})
  }, [])

  useEffect(() => {
    loadClasses()
  }, [loadClasses])

  async function createEntry(kind, rawName, reset) {
    if (!rawName.trim()) {
      setShowEmptyNameWarning(kind)
      return
    }
    setError(null)
    const body = kind === 'official' ? { name: rawName.trim(), kind } : { name: rawName.trim() }
    const res = await adminFetch('/api/admin/classes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const data = await res.json()
    if (!res.ok) {
      setError({ kind, message: data.error ?? '오류가 발생했습니다' })
      return
    }
    reset('')
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
        <h1 className={styles.title}>게임 목록</h1>
        <div className={styles.headerActions}>
          <span className={styles.username}>{profile.username}</span>
          <button type="button" className={styles.logoutBtn} onClick={onLogout}>로그아웃</button>
        </div>
      </div>

      <div className={styles.columns}>
        {COLUMNS.map(col => {
          const items = classes.filter(cls => (cls.kind ?? 'class') === col.kind)
          const value = col.kind === 'official' ? newContestName : newClassName
          const setValue = col.kind === 'official' ? setNewContestName : setNewClassName
          return (
            <section key={col.kind} className={styles.column} aria-labelledby={`list-${col.kind}`}>
              <h2 id={`list-${col.kind}`} className={styles.columnTitle}>{col.title}</h2>
              <form className={styles.createForm} onSubmit={e => { e.preventDefault(); createEntry(col.kind, value, setValue) }}>
                <input
                  className={styles.createInput}
                  placeholder={col.placeholder}
                  value={value}
                  onChange={e => setValue(e.target.value)}
                />
                <button type="submit" className={styles.createBtn}>{col.createLabel}</button>
              </form>
              {error?.kind === col.kind && <p className={styles.error}>{error.message}</p>}

              {items.length === 0 ? (
                <p className={styles.empty}>{col.empty}</p>
              ) : (
                <ul className={styles.list}>
                  {items.map(cls => (
                    <li key={cls.id} className={styles.item}>
                      <button type="button" className={styles.itemBtn} onClick={() => onSelectClass({ id: cls.id, name: cls.name, kind: cls.kind ?? 'class' })}>
                        <span className={styles.itemName}>{cls.name}</span>
                        {cls.createdAt && <span className={styles.itemDate}>{formatDate(cls.createdAt)}</span>}
                      </button>
                      {cls.id !== 'unassigned' && (isMobile ? (
                        <AdminOverflowMenu
                          label={`${cls.name} 메뉴`}
                          items={[
                            { key: 'survey', label: '만족도 조사', onSelect: () => setShowSurveyQr(true) },
                            { key: 'qr', label: 'QR', onSelect: () => setQrClass(cls) },
                            { key: 'delete', label: '삭제', danger: true, onSelect: () => setDeleteTarget(cls) },
                          ]}
                        />
                      ) : (
                        <>
                          <button type="button" className={styles.qrBtn} onClick={() => setShowSurveyQr(true)}>만족도 조사</button>
                          <button type="button" className={styles.qrBtn} onClick={() => setQrClass(cls)}>QR</button>
                          <button type="button" className={styles.deleteBtn} onClick={() => setDeleteTarget(cls)}>삭제</button>
                        </>
                      ))}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )
        })}
      </div>

      {qrClass && <ClassQRModal classId={qrClass.id} name={qrClass.name} onClose={() => setQrClass(null)} />}
      {showSurveyQr && <SurveyQRModal onClose={() => setShowSurveyQr(false)} />}

      {deleteTarget && (
        <ConfirmDialog
          tone="danger"
          title={deleteTarget.kind === 'official' ? '대회 삭제' : '수업 삭제'}
          description={<>'{deleteTarget.name}' {deleteTarget.kind === 'official' ? '대회를' : '수업을'} 삭제하면 관련된 모든 팀 기록도 함께 삭제되며 되돌릴 수 없습니다.<br />삭제하시겠습니까?</>}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={handleConfirmDelete}
        />
      )}

      {showEmptyNameWarning && (
        <ConfirmDialog
          tone="primary"
          title="알림"
          description={showEmptyNameWarning === 'official' ? '대회 이름을 입력해주세요' : '수업 이름을 입력해주세요'}
          confirmLabel="확인"
          hideCancel
          onCancel={() => setShowEmptyNameWarning(false)}
          onConfirm={() => setShowEmptyNameWarning(false)}
        />
      )}
    </div>
  )
}
