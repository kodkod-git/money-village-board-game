import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import styles from './ResultPage.module.css'

const JOB_LABELS = {
  a: '경영·금융', b: '연구·기술', c: '보건·교육',
  d: '문화·콘텐츠', e: '서비스·판매', f: '생산·운송',
}
const JOB_IMAGES = {
  a: '경영금융', b: '연구기술', c: '보건교육',
  d: '문화콘텐츠', e: '서비스판매', f: '생산운송',
}
const BADGE_NAMES = ['communication', 'global', 'idea', 'money', 'thinking', 'trust']
const ESTATE_IMAGES = {
  gaon: '가온개미', nuri: '누리고양이', dami: '다미원숭이',
  maru: '마루수리', chorong: '초롱부엉이', hani: '하니여우',
}
const STOCK_IMAGES = {
  semiconductor: '반도체IT', finance: '금융산업', industrial: '산업재기계',
  auto: '소재화학', bio: '바이오헬스케어', content: '콘텐츠소비재',
}

export default function ResultPage() {
  const { sessionId, playerUuid } = useParams()
  const navigate = useNavigate()
  const [player, setPlayer] = useState(null)
  const [stockPrices, setStockPrices] = useState({})
  const [realEstatePrices, setRealEstatePrices] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    fetch(`/api/results/${sessionId}`)
      .then(r => { if (!r.ok) throw new Error(); return r.json() })
      .then(data => {
        const found = data.players?.find(p => p.playerUuid === playerUuid)
        if (!found) throw new Error('Player not found')
        setPlayer(found)
        setStockPrices(data.stockPrices ?? {})
        setRealEstatePrices(data.realEstatePrices ?? {})
        setLoading(false)
      })
      .catch(() => { setError('결과를 불러올 수 없습니다.'); setLoading(false) })
  }, [sessionId, playerUuid])

  if (loading) return <div className={styles.page}><p className={styles.message}>불러오는 중...</p></div>
  if (error) return <div className={styles.page}><p className={styles.message}>{error}</p></div>

  const earnedBadges = BADGE_NAMES.filter((_, i) => player.badges?.[i])
  const estateItems = Object.entries(player.realEstateHoldings ?? {}).filter(([, qty]) => qty > 0)
  const stockItems = Object.entries(player.stockHoldings ?? {}).filter(([, qty]) => qty > 0)
  const estateSubtotal = estateItems.reduce((sum, [key, qty]) => sum + (realEstatePrices[key] ?? 0) * qty, 0)
  const stockSubtotal = stockItems.reduce((sum, [key, qty]) => sum + (stockPrices[key] ?? 0) * qty, 0)

  return (
    <div className={styles.page}>
      <button className={styles.backBtn} onClick={() => navigate(-1)}>← 뒤로</button>
      <div className={styles.columns}>
        <div className={styles.leftCol}>
          <img
            src={`/characters/${player.character}.png`}
            alt={player.character}
            className={styles.characterImg}
          />
          <div className={styles.playerName}>{player.name}</div>
          <div className={styles.playerAffiliation}>{player.affiliation}</div>
        </div>

        <div className={styles.rightCol}>
          <section className={styles.section}>
            <div className={styles.sectionLabel}>총 자산</div>
            <div className={styles.totalAssets}>{player.totalAssets.toLocaleString()}원</div>
          </section>

          {player.job && (
            <section className={styles.section}>
              <div className={styles.sectionLabel}>직업</div>
              <div className={styles.jobRow}>
                <img
                  src={`/badges/job/${JOB_IMAGES[player.job]}.png`}
                  alt={JOB_LABELS[player.job]}
                  className={styles.jobImg}
                />
                <span>{JOB_LABELS[player.job]}</span>
              </div>
            </section>
          )}

          {earnedBadges.length > 0 && (
            <section className={styles.section}>
              <div className={styles.sectionLabel}>성공카드</div>
              <div className={styles.badgeGrid}>
                {earnedBadges.map(name => (
                  <img
                    key={name}
                    src={`/badges/success/${name}.png`}
                    alt={name}
                    className={styles.badgeImg}
                  />
                ))}
              </div>
            </section>
          )}

          {estateItems.length > 0 && (
            <section className={styles.section}>
              <div className={styles.sectionHeader}>
                <span className={styles.sectionLabel}>부동산</span>
                <span className={styles.subtotal}>{estateSubtotal.toLocaleString()}원</span>
              </div>
              <div className={styles.assetGrid}>
                {estateItems.flatMap(([key, qty]) =>
                  Array.from({ length: qty }, (_, i) => (
                    <img
                      key={`${key}-${i}`}
                      src={`/badges/estate/${ESTATE_IMAGES[key]}.png`}
                      alt={ESTATE_IMAGES[key]}
                      className={styles.assetImg}
                      title={`${(realEstatePrices[key] ?? 0).toLocaleString()}원`}
                    />
                  ))
                )}
              </div>
            </section>
          )}

          {stockItems.length > 0 && (
            <section className={styles.section}>
              <div className={styles.sectionHeader}>
                <span className={styles.sectionLabel}>주식</span>
                <span className={styles.subtotal}>{stockSubtotal.toLocaleString()}원</span>
              </div>
              <div className={styles.assetGrid}>
                {stockItems.flatMap(([key, qty]) =>
                  Array.from({ length: qty }, (_, i) => (
                    <img
                      key={`${key}-${i}`}
                      src={`/badges/stock/${STOCK_IMAGES[key]}.png`}
                      alt={STOCK_IMAGES[key]}
                      className={styles.assetImg}
                      title={`${(stockPrices[key] ?? 0).toLocaleString()}원`}
                    />
                  ))
                )}
              </div>
            </section>
          )}

          <section className={styles.section}>
            <div className={styles.sectionLabel}>현금</div>
            <div className={styles.cashValue}>{(player.cash ?? 0).toLocaleString()}원</div>
          </section>
        </div>
      </div>
    </div>
  )
}
