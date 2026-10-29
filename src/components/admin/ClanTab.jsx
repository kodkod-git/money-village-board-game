import { useState, useEffect, useCallback, useRef } from 'react'
import ClanParticipantBlock from './ClanParticipantBlock'
import ClanCard from './ClanCard'
import ConfirmDialog from './ConfirmDialog'
import { adminFetch } from '../../utils/adminAuth'
import { toast } from '../../utils/toast'
import { moveInView } from '../../utils/clanView'
import { useSocketContext } from '../../contexts/SocketContext'
import styles from './ClanTab.module.css'

// 팀 현황 페이지의 트로피 탭 본문: 결과 등록 참여자를 팀(클랜)으로 묶는다.
// 클랜은 서버 메모리에 있으므로 서버가 재시작되면 비어서 내려온다.
export default function ClanTab({ classId }) {
  const { socket } = useSocketContext()
  const [view, setView] = useState(null)
  const [loadError, setLoadError] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const base = `/api/admin/classes/${encodeURIComponent(classId)}/clans`

  // 요청 순서 번호: 가장 최근에 시작한 요청의 응답만 반영한다(늦게 도착한 옛 응답이 새 상태를 덮지 않게).
  const seqRef = useRef(0)

  const load = useCallback(() => {
    const seq = ++seqRef.current
    adminFetch(base)
      .then(r => { if (!r.ok) throw new Error(); return r.json() })
      .then(data => {
        if (seq !== seqRef.current) return
        setView(data)
        setLoadError(false)
      })
      .catch(() => { if (seq === seqRef.current) setLoadError(true) })
  }, [base])

  useEffect(() => { load() }, [load])

  // 클랜 변경은 class-clans-updated, 결과 등록·등록된 팀 삭제는 class-rooms-updated로 알 수 있다.
  // class-rooms-updated는 학생 입력마다 오므로 300ms 디바운스한다.
  // 채널 가입(watch-class-rooms)은 AdminClassDashboard가 한다.
  useEffect(() => {
    if (!socket) return
    let timer = null
    const onRoomsUpdated = () => {
      clearTimeout(timer)
      timer = setTimeout(load, 300)
    }
    socket.on('class-clans-updated', load)
    socket.on('class-rooms-updated', onRoomsUpdated)
    return () => {
      clearTimeout(timer)
      socket.off('class-clans-updated', load)
      socket.off('class-rooms-updated', onRoomsUpdated)
    }
  }, [socket, load])

  async function send(path, options, fallbackError) {
    try {
      const res = await adminFetch(`${base}${path}`, {
        ...options,
        headers: { 'Content-Type': 'application/json' },
      })
      if (res.ok) return true
      const { error } = await res.json().catch(() => ({}))
      toast(error || fallbackError)
    } catch {
      toast(fallbackError)
    }
    load()
    return false
  }

  function handleMove(resultId, toClanId) {
    seqRef.current += 1 // 낙관적 변경 이전에 시작한 GET 응답은 무시한다
    setView(v => moveInView(v, resultId, toClanId))
    send('/assign', { method: 'POST', body: JSON.stringify({ resultId, toClanId }) }, '팀 배정에 실패했어요')
  }

  function handleCreate() {
    send('', { method: 'POST' }, '팀을 만들지 못했어요')
  }

  function handleRename(clanId, name) {
    seqRef.current += 1
    setView(v => ({ ...v, clans: v.clans.map(c => (c.id === clanId ? { ...c, name } : c)) }))
    send(`/${clanId}`, { method: 'PATCH', body: JSON.stringify({ name }) }, '팀 이름을 바꾸지 못했어요')
  }

  async function handleConfirmDelete() {
    const target = deleteTarget
    setDeleteTarget(null)
    await send(`/${target.id}`, { method: 'DELETE' }, '팀을 삭제하지 못했어요')
  }

  if (loadError && !view) return <p className={styles.message}>팀 정보를 불러오지 못했어요.</p>
  if (!view) return <p className={styles.message}>불러오는 중...</p>

  return (
    <>
      <ClanParticipantBlock participants={view.participants} onDropMember={resultId => handleMove(resultId, null)} />
      <div className={styles.grid}>
        {view.clans.map(clan => (
          <ClanCard
            key={clan.id}
            clan={clan}
            onDropMember={handleMove}
            onRename={handleRename}
            onDelete={setDeleteTarget}
          />
        ))}
        <button type="button" className={styles.createCard} onClick={handleCreate}>
          <span className={styles.createIcon} aria-hidden="true">+</span>
          <span className={styles.createLabel}>팀 만들기</span>
        </button>
      </div>

      {deleteTarget && (
        <ConfirmDialog
          tone="danger"
          title="팀 삭제"
          description={<>{deleteTarget.name}을(를) 삭제할까요?<br />팀원은 참여자 목록으로 돌아갑니다.</>}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={handleConfirmDelete}
        />
      )}
    </>
  )
}
