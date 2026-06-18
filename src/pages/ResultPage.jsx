import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import styles from './ResultPage.module.css'

const JOB_LABELS = {
  a: '경영·금융', b: '연구·기술', c: '보건·교육',
  d: '문화·콘텐츠', e: '서비스·판매', f: '생산·운송',
}

const BADGE_NAMES = ['communication', 'global', 'idea', 'money', 'thinking', 'trust']

const RANK_COLORS = ['#FFD700', '#C0C0C0', '#CD7F32', '#AAAAAA']

export default function ResultPage() {
  const { sessionId } = useParams()
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const [expanded, setExpanded] = useState(null)

  useEffect(() => {
    fetch(`/api/results/${sessionId}`)
      .then(r => {
        if (!r.ok) throw new Error('Not found')
        return r.json()
      })
      .then(setData)
      .catch(() => setError('결과를 불러올 수 없습니다.'))
  }, [sessionId])

  if (error) return <div className={styles.message}>{error}</div>
  if (!data) return <div className={styles.message}>불러오는 중...</div>

  const dateStr = new Date(data.createdAt).toLocaleDateString('ko-KR', {
    year: 'numeric', month: 'long', day: 'numeric',
  })

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div className={styles.teamCode}>팀 {data.teamCode}</div>
        <div className={styles.date}>{dateStr}</div>
      </div>

      <div className={styles.rankList}>
        {data.players.map((player, i) => (
          <div
            key={i}
            className={`${styles.rankCard} ${expanded === i ? styles.rankCardExpanded : ''}`}
            onClick={() => setExpanded(expanded === i ? null : i)}
          >
            <div className={styles.rankRow}>
              <span className={styles.rank} style={{ color: RANK_COLORS[i] }}>
                {player.rank}위
              </span>
              <img
                src={`/characters/${player.character}.png`}
                alt={player.character}
                className={styles.characterImg}
              />
              <div className={styles.playerInfo}>
                <span className={styles.name}>{player.name}</span>
                <span className={styles.job}>{JOB_LABELS[player.job]}</span>
              </div>
              <span className={styles.totalAssets}>
                {player.totalAssets.toLocaleString()}원
              </span>
            </div>

            {expanded === i && (
              <div className={styles.detail}>
                <div className={styles.detailRow}>
                  <span className={styles.detailLabel}>현금</span>
                  <span className={styles.detailValue}>{player.cash.toLocaleString()}원</span>
                </div>
                <div className={styles.detailRow}>
                  <span className={styles.detailLabel}>성공카드</span>
                  <span className={styles.detailValue}>
                    {player.badges.filter(Boolean).length}개
                  </span>
                </div>
                <div className={styles.detailRow}>
                  <span className={styles.detailLabel}>획득 뱃지</span>
                  <div className={styles.badgeRow}>
                    {BADGE_NAMES.map((name, bi) => (
                      <img
                        key={name}
                        src={`/badges/${name}.png`}
                        alt={name}
                        className={`${styles.badgeImg} ${!player.badges[bi] ? styles.badgeLocked : ''}`}
                      />
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
