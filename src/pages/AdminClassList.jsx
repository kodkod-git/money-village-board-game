import { useState, useEffect, useCallback } from 'react'
import { adminFetch } from '../utils/adminAuth'
import ClassQRModal from '../components/admin/ClassQRModal'
import ConfirmDialog from '../components/admin/ConfirmDialog'
import AdminOverflowMenu from '../components/admin/AdminOverflowMenu'
import useIsAdminMobile from '../hooks/useIsAdminMobile'
import { toBoardCount } from '../constants/gameData'
import styles from './AdminClassList.module.css'

function formatDate(isoString) {
  return new Date(isoString).toLocaleDateString('ko-KR')
}

// 게임 종류: 일반(수업)과 대회(공식전). 목록에서는 대회만 제목 옆 뱃지로 구분한다.
const KIND_OPTIONS = [
  { value: 'class', label: '일반' },
  { value: 'official', label: '대회' },
]

// 게임 진행 방식: 6판(기존)과 5판(부동산 없이 진행).
const BOARD_OPTIONS = [
  { value: 6, label: '6판', hint: '현금·주식·부동산' },
  { value: 5, label: '5판', hint: '부동산 없음' },
]

function SegmentedControl({ label, name, options, value, onChange }) {
  return (
    <div className={styles.field}>
      <span className={styles.fieldLabel} id={`${name}-label`}>{label}</span>
      <div className={styles.segmented} role="radiogroup" aria-labelledby={`${name}-label`}>
        {options.map(option => {
          const selected = option.value === value
          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={selected}
              className={`${styles.segment} ${selected ? styles.segmentActive : ''}`}
              onClick={() => onChange(option.value)}
            >
              <span>{option.label}</span>
              {option.hint && <span className={styles.segmentHint}>{option.hint}</span>}
            </button>
          )
        })}
      </div>
    </div>
  )
}

export default function AdminClassList({ profile, onSelectClass, onLogout }) {
  const [classes, setClasses] = useState([])
  const [newName, setNewName] = useState('')
  const [newKind, setNewKind] = useState('class')
  const [newBoardCount, setNewBoardCount] = useState(6)
  const [error, setError] = useState(null)
  const [qrClass, setQrClass] = useState(null)
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

  async function handleCreate(e) {
    e.preventDefault()
    if (!newName.trim()) {
      setShowEmptyNameWarning(true)
      return
    }
    setError(null)
    const res = await adminFetch('/api/admin/classes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newName.trim(), kind: newKind, boardCount: newBoardCount }),
    })
    const data = await res.json()
    if (!res.ok) {
      setError(data.error ?? '오류가 발생했습니다')
      return
    }
    setNewName('')
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

      <div className={styles.content}>
        <form className={styles.createCard} onSubmit={handleCreate} aria-label="새 게임 만들기">
          <div className={styles.createOptions}>
            <SegmentedControl label="게임 종류" name="new-kind" options={KIND_OPTIONS} value={newKind} onChange={setNewKind} />
            <SegmentedControl label="진행 방식" name="new-board" options={BOARD_OPTIONS} value={newBoardCount} onChange={setNewBoardCount} />
          </div>
          <div className={styles.createRow}>
            <input
              className={styles.createInput}
              placeholder="새 게임 이름"
              aria-label="새 게임 이름"
              value={newName}
              onChange={e => setNewName(e.target.value)}
            />
            <button type="submit" className={styles.createBtn}>생성하기</button>
          </div>
          {error && <p className={styles.error}>{error}</p>}
        </form>

        {classes.length === 0 ? (
          <p className={styles.empty}>아직 만든 게임이 없어요</p>
        ) : (
          <ul className={styles.list}>
            {classes.map(cls => {
              const kind = cls.kind ?? 'class'
              const boardCount = toBoardCount(cls.boardCount)
              return (
                <li key={cls.id} className={styles.item}>
                  <button type="button" className={styles.itemBtn} onClick={() => onSelectClass({ id: cls.id, name: cls.name, kind, boardCount })}>
                    <span className={styles.itemTitleRow}>
                      <span className={styles.itemName}>{cls.name}</span>
                      {kind === 'official' && <span className={styles.officialBadge}>대회</span>}
                      {cls.id !== 'unassigned' && <span className={styles.boardBadge}>{boardCount}판</span>}
                    </span>
                    {cls.createdAt && <span className={styles.itemDate}>{formatDate(cls.createdAt)}</span>}
                  </button>
                  {cls.id !== 'unassigned' && (isMobile ? (
                    <AdminOverflowMenu
                      label={`${cls.name} 메뉴`}
                      items={[
                        { key: 'qr', label: 'QR', onSelect: () => setQrClass(cls) },
                        { key: 'delete', label: '삭제', danger: true, onSelect: () => setDeleteTarget(cls) },
                      ]}
                    />
                  ) : (
                    <>
                      <button type="button" className={styles.qrBtn} onClick={() => setQrClass(cls)}>QR</button>
                      <button type="button" className={styles.deleteBtn} onClick={() => setDeleteTarget(cls)}>삭제</button>
                    </>
                  ))}
                </li>
              )
            })}
          </ul>
        )}
      </div>

      {qrClass && <ClassQRModal classId={qrClass.id} name={qrClass.name} onClose={() => setQrClass(null)} />}

      {deleteTarget && (
        <ConfirmDialog
          tone="danger"
          title={deleteTarget.kind === 'official' ? '대회 삭제' : '게임 삭제'}
          description={<>'{deleteTarget.name}' {deleteTarget.kind === 'official' ? '대회를' : '게임을'} 삭제하면 관련된 모든 팀 기록도 함께 삭제되며 되돌릴 수 없습니다.<br />삭제하시겠습니까?</>}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={handleConfirmDelete}
        />
      )}

      {showEmptyNameWarning && (
        <ConfirmDialog
          tone="primary"
          title="알림"
          description="게임 이름을 입력해주세요"
          confirmLabel="확인"
          hideCancel
          onCancel={() => setShowEmptyNameWarning(false)}
          onConfirm={() => setShowEmptyNameWarning(false)}
        />
      )}
    </div>
  )
}
