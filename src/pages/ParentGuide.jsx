import { useEffect, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { GUIDE_CONCEPTS, GUIDE_GRID, GUIDE_GROUPS, GUIDE_ORGANIZATION, GUIDE_STAGE } from '../constants/parentGuide'
import { buildParentGuide, formatManwon } from '../utils/parentGuide'
import useBodyClass from '../hooks/useBodyClass'
import styles from './ParentGuide.module.css'

// 학부모 "수업 결과 안내서" — example/머니빌리지_학부모안내문_6판_*.pdf와 같은 A4 한 장.
// 관리자 "게임 분석" 테이블에서 학생별로 연다(?player=플레이어 uuid).
// 모든 크기는 원본 PDF 좌표(pt)를 그대로 옮겼으므로, 인쇄하면 원본과 같은 크기로 나온다.

function formatDate(iso) {
  const d = new Date(iso)
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일`
}

// 칸이 좁으면(25% 미만) 원본처럼 "주식" 없이 숫자만 쓴다.
function segmentLabel({ label, pct }) {
  return pct >= 25 ? `${label} ${pct}%` : `${pct}%`
}

// 가운뎃점(·)을 원본 안내서와 같은 폭으로 그리기 위해 span으로 감싼다.
function Dotted({ text }) {
  return text.split('·').flatMap((part, i) => (i === 0 ? [part] : [<span key={i} className={styles.dot}>·</span>, part]))
}

function SectionTitle({ number, title, subtitle }) {
  return (
    <div className={styles.sectionTitle}>
      <span className={styles.sectionNumber}>{number}</span>
      <h2 className={styles.sectionName}>{title}</h2>
      <span className={styles.sectionSub}>{subtitle}</span>
    </div>
  )
}

function fetchJson(url) {
  return fetch(url).then(r => { if (!r.ok) throw new Error(); return r.json() })
}

export default function ParentGuide() {
  useBodyClass('guide-mode')
  const { sessionId } = useParams()
  const [searchParams] = useSearchParams()
  const [data, setData] = useState(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    fetchJson(`/api/results/${sessionId}`)
      .then(setData)
      .catch(() => setError(true))
  }, [sessionId])

  const playerUuid = searchParams.get('player')
  const me = data?.players?.find(p => p.playerUuid === playerUuid)

  if (error || (data && !me)) {
    return <p className={styles.message}>{error ? '결과를 불러오지 못했어요.' : '이 학생의 게임 결과를 찾을 수 없어요.'}</p>
  }
  if (!data) return <p className={styles.message}>불러오는 중...</p>

  const guide = buildParentGuide(me, { stockPrices: data.stockPrices, realEstatePrices: data.realEstatePrices })
  const group = GUIDE_GROUPS[guide.group]

  return (
    <div className={styles.viewer}>
      <div className={styles.toolbar}>
        <button type="button" className={styles.printBtn} onClick={() => window.print()}>PDF로 저장 · 인쇄</button>
      </div>

      <article className={styles.sheet} style={{ '--group-text': group.text, '--group-tint': group.tint }}>
        <header>
          <img className={styles.logo} src="/guide/logo.png" alt="" />
          <p className={styles.brand}>MONEY VILLAGE</p>
          <h1 className={styles.title}>머니빌리지 경제교육 수업 결과 안내</h1>
          <span className={styles.audience}>학부모님께</span>
          <p className={styles.tagline}>같은 기회, 다른 선택<br />게임 속 경제 선택을 돌려드립니다</p>
        </header>

        <dl className={`${styles.card} ${styles.infoCard}`}>
          <div><dt>이름</dt><dd>{me.name}</dd></div>
          <div><dt>수업일</dt><dd>{formatDate(data.createdAt)}</dd></div>
          <div><dt>기관</dt><dd>{GUIDE_ORGANIZATION}</dd></div>
          <div><dt>단계</dt><dd><Dotted text={GUIDE_STAGE} /></dd></div>
        </dl>

        <section className={`${styles.card} ${styles.conceptCard}`}>
          <SectionTitle number={1} title="오늘 배운 경제 개념" subtitle="6개 부스, 칸마다 하나씩 만난 경제 개념" />
          <div className={styles.conceptGrid}>
            {GUIDE_CONCEPTS.map(concept => (
              <div key={concept.booth} className={styles.concept}>
                <span className={styles.booth}>{concept.booth}</span>
                <ul className={styles.conceptItems}>
                  {concept.items.map(([label, icon]) => (
                    <li key={icon} className={styles.conceptItem}>
                      <img className={styles.conceptIcon} src={`/guide/concepts/${icon}.png`} alt="" />
                      <span className={styles.conceptLabel}>{label}</span>
                    </li>
                  ))}
                </ul>
                <p className={styles.conceptDesc}>{concept.desc}</p>
              </div>
            ))}
          </div>
        </section>

        <section className={`${styles.card} ${styles.resultCard}`}>
          <SectionTitle number={2} title="게임 결과" subtitle="게임이 끝난 뒤 정산한 자산" />
          <dl className={styles.assetList}>
            <div><dt>현금 <small>(예금 만기 포함)</small></dt><dd>{formatManwon(guide.cash)}</dd></div>
            {guide.stockValue > 0 ? (
              <div><dt>주식 {guide.stockKinds}종목 (끝났을 때 가격)</dt><dd>{formatManwon(guide.stockValue)}</dd></div>
            ) : (
              <div><dt>주식</dt><dd>없음</dd></div>
            )}
            {guide.realEstateValue > 0 ? (
              <div><dt>부동산 (끝났을 때 가격)</dt><dd>{formatManwon(guide.realEstateValue)}</dd></div>
            ) : (
              <div><dt>부동산</dt><dd>없음</dd></div>
            )}
            <div><dt>자산 합계</dt><dd>{formatManwon(guide.baseAssets)}</dd></div>
            <div><dt>성공열쇠 {guide.keyCount}개 × {guide.multiplier}</dt><dd>+ {formatManwon(guide.bonus)}</dd></div>
          </dl>
          <div className={styles.finalBox}>
            <span className={styles.finalLabel}>최종자산</span>
            <span className={styles.finalValue}>{formatManwon(guide.finalAssets)}</span>
          </div>

          <h3 className={`${styles.subhead} ${styles.splitHead}`}>자산을 이렇게 나눴어요</h3>
          <div className={styles.splitBar} data-testid="split-bar">
            {guide.split.filter(s => s.pct > 0).map(s => (
              <span key={s.key} className={`${styles.segment} ${styles[s.key]}`} style={{ width: `${s.pct}%` }}>
                {segmentLabel(s)}
              </span>
            ))}
          </div>
          <ul className={styles.legend}>
            {guide.split.map(s => (
              <li key={s.key}><span className={`${styles.swatch} ${styles[s.key]}`} />{s.label}</li>
            ))}
          </ul>

          <h3 className={`${styles.subhead} ${styles.keysHead}`}>성공열쇠 {guide.keyCount}개를 모았어요</h3>
          <ul className={styles.keyChips}>
            {guide.keys.map(k => (
              <li key={k.key} className={`${styles.keyChip} ${k.on ? styles.keyOn : styles.keyOff}`}>{k.label}</li>
            ))}
          </ul>
          <p className={styles.keyNote}>성공열쇠는 부스에서 <strong>처음 활동할 때</strong> 받는 ‘경험’이에요.</p>
          <p className={styles.keyRule}><Dotted text="0~2개 ×1 · 3개 ×1.1 · 4개 ×1.2 · 5개 ×1.5 · 6개 ×2" /></p>
        </section>

        <section className={`${styles.card} ${styles.potentialCard}`}>
          <SectionTitle number={3} title="나의 경제적 잠재력" subtitle="게임 속 선택을 정산 결과로 읽었어요" />
          <img className={styles.banner} src={group.banner} alt={`나의 경제적 잠재력은 ${guide.group}`} />

          <div className={styles.quadrant}>
            <span className={`${styles.colLabel} ${styles.col1}`}>내일 꿈꾸기</span>
            <span className={`${styles.colLabel} ${styles.col2}`}>오늘 가꾸기</span>
            <span className={`${styles.rowLabel} ${styles.row1}`}>모험 즐기기</span>
            <span className={`${styles.rowLabel} ${styles.row2}`}>안전 지키기</span>
            {GUIDE_GRID.flatMap((row, r) => row.map((name, c) => (
              <span
                key={name}
                className={`${styles.cell} ${styles[`row${r + 1}`]} ${styles[`col${c + 1}`]} ${name === guide.group ? styles.cellOn : ''}`}
                style={{ background: GUIDE_GROUPS[name].cell }}
                aria-current={name === guide.group ? 'true' : undefined}
              >
                {GUIDE_GROUPS[name].short}
              </span>
            )))}
          </div>

          <div className={styles.groupInfo}>
            <p className={styles.groupName}>{guide.group} <span><Dotted text={group.axes} /></span></p>
            <h3 className={styles.subhead}>어떤 선택을 했나요?</h3>
            <ul className={styles.bullets}>
              {guide.bullets.map(b => <li key={b}><Dotted text={b} /></li>)}
            </ul>
            <h3 className={styles.subhead}>이런 힘이 보여요</h3>
            <ul className={styles.strengths}>
              {group.strengths.map(s => <li key={s}>{s}</li>)}
            </ul>
          </div>

          <ul className={styles.notes}>
            <li>※ 그룹은 정산 결과(가진 자산을 어떻게 나눴는지)로 정해지며, 성격 검사가 아니에요.</li>
            <li>※ 다음 수업에서 다른 선택을 하면, 그룹도 달라질 수 있어요.</li>
            <li>※ 머니빌리지 수업에서는 16가지 EFTI 유형으로 더 자세히 알아볼 수 있어요.</li>
          </ul>
        </section>

        <footer className={styles.footer}><Dotted text="머니빌리지 · 특허 등록 초등 경제교육 보드게임" /></footer>
      </article>
    </div>
  )
}
