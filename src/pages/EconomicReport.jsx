import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import BackButton from '../components/BackButton'
import { RESULT_GROUPS, GROUP_DETAIL_URLS, AGE_SUBTITLE, AGE_LABEL, AGE_PLACEHOLDER } from '../constants/quizData'
import { STOCK_LABELS, REAL_ESTATE_LABELS } from '../constants/gameData'
import { calcEconomicPotential } from '../utils/economicPotential'
import { getPlayerUuid } from '../utils/playerUuid'
import useBodyClass from '../hooks/useBodyClass'
import quizStyles from './QuizPlay.module.css'
import styles from './EconomicReport.module.css'

export const REPORT_ORGANIZATION = '한동대학교'
export const REPORT_PROGRAM = '머니빌리지 보드게임'

const HORIZON_LABELS = { future: '미래형', present: '현재형' }
const RISK_LABELS = { risky: '위험형', safe: '안전형' }

function formatDate(iso) {
  const d = new Date(iso)
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일`
}

function formatCount(n) {
  return Number.isInteger(n) ? String(n) : n.toFixed(1)
}

function isValidAge(value) {
  const n = Number(value)
  return Number.isInteger(n) && n > 0 && n < 150
}

function fetchJson(url) {
  return fetch(url).then(r => { if (!r.ok) throw new Error(); return r.json() })
}

export default function EconomicReport() {
  useBodyClass('onboarding-mode')
  const { sessionId } = useParams()
  const navigate = useNavigate()
  const [data, setData] = useState(null)
  const [allPlayers, setAllPlayers] = useState(null)
  const [error, setError] = useState(false)
  const [age, setAge] = useState('')
  const [confirmed, setConfirmed] = useState(false)

  // 미래형/현재형은 역대 모든 플레이어의 평균 보유 수와 비교한다 — 전체 랭킹 API가
  // 모든 게임 결과(보유 현황 포함)를 내려주므로 그대로 쓴다.
  useEffect(() => {
    Promise.all([fetchJson(`/api/results/${sessionId}`), fetchJson('/api/rankings')])
      .then(([result, rankings]) => {
        setData(result)
        setAllPlayers(rankings)
      })
      .catch(() => setError(true))
  }, [sessionId])

  const resultPath = `/result/${sessionId}`
  const myPlayerUuid = getPlayerUuid()
  const me = data?.players?.find(p => p.playerUuid === myPlayerUuid)

  if (error || (data && !me)) {
    return (
      <div className={quizStyles.page}>
        <BackButton to={resultPath} label="결과로" />
        <div className={quizStyles.center}>
          <div className={quizStyles.card}>
            <p className={quizStyles.questionPrompt}>
              {error ? '결과를 불러오지 못했어요.' : '내 게임 결과가 있을 때만\n경제 잠재력 유형을 확인할 수 있어요.'}
            </p>
            <button className={quizStyles.gradBtn} onClick={() => navigate(resultPath)}>결과로 돌아가기</button>
          </div>
        </div>
      </div>
    )
  }

  if (!data) {
    return (
      <div className={quizStyles.page}>
        <div className={quizStyles.statusWrap}>
          <div className={quizStyles.spinner} />
          <p className={quizStyles.statusText}>불러오는 중</p>
        </div>
      </div>
    )
  }

  const resultDate = new Date(data.createdAt ?? Date.now())

  // 나이 입력 화면은 경제 잠재력 테스트(QuizPlay)의 나이 단계 화면을 그대로 재사용한다.
  if (!confirmed) {
    return (
      <div className={quizStyles.page}>
        <BackButton to={resultPath} label="결과로" />
        <div className={quizStyles.center}>
          <div className={quizStyles.heading}>
            <h1 className={quizStyles.stepTitle}>{me.name}님은 몇 살인가요?</h1>
            <p className={quizStyles.stepSubtitle}>{AGE_SUBTITLE}</p>
          </div>
          <div className={quizStyles.card}>
            <div className={quizStyles.inputGroup}>
              <label className={quizStyles.label} htmlFor="report-age">{AGE_LABEL}</label>
              <input
                id="report-age"
                className={quizStyles.input}
                type="number"
                inputMode="numeric"
                placeholder={AGE_PLACEHOLDER}
                value={age}
                onChange={e => setAge(e.target.value)}
              />
            </div>
            <button className={quizStyles.gradBtn} onClick={() => setConfirmed(true)} disabled={!isValidAge(age)}>
              보고서 보기
            </button>
          </div>
        </div>
      </div>
    )
  }

  const result = calcEconomicPotential(me, allPlayers)
  const group = RESULT_GROUPS[result.group]
  const { holdings } = result

  return (
    <div className={styles.page}>
      <div className={styles.toolbar}>
        <button type="button" className={styles.toolBtn} onClick={() => setConfirmed(false)}>나이 다시 입력</button>
        <button type="button" className={`${styles.toolBtn} ${styles.toolBtnPrimary}`} onClick={() => window.print()}>
          PDF로 저장
        </button>
      </div>

      <article className={styles.report} style={{ '--group-color': group.color, '--group-bg': group.bgColor }}>
        <header className={styles.reportHeader}>
          <p className={styles.eyebrow}>{REPORT_PROGRAM}</p>
          <h1 className={styles.reportTitle}>경제 잠재력 보고서</h1>
        </header>

        <dl className={styles.infoTable}>
          <div><dt>기관명</dt><dd>{REPORT_ORGANIZATION}</dd></div>
          <div><dt>프로그램</dt><dd>{REPORT_PROGRAM}</dd></div>
          <div><dt>이름</dt><dd>{me.name}</dd></div>
          <div><dt>나이</dt><dd>{Number(age)}세</dd></div>
          <div><dt>날짜</dt><dd>{formatDate(resultDate)}</dd></div>
        </dl>

        <section className={styles.groupCard}>
          <img className={styles.groupImg} src={group.illustration} alt={`${result.group} 일러스트`} />
          <div className={styles.groupBody}>
            <p className={styles.groupType}>
              {HORIZON_LABELS[result.horizon]} · {RISK_LABELS[result.risk]}
            </p>
            <h2 className={styles.groupName}>{result.group}</h2>
            <p className={styles.groupTagline}>{group.tagline}</p>
            <p className={styles.groupDesc}>{group.description}</p>
          </div>
        </section>

        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>판단 근거</h3>
          <div className={styles.axis}>
            <p className={styles.axisLabel}>
              <strong>{HORIZON_LABELS[result.horizon]}</strong>
              <span>미래형 / 현재형</span>
            </p>
            <p className={styles.axisText}>
              주식·부동산 보유 수 <b>{holdings.total}개</b> (역대 플레이어 평균 {formatCount(result.average)}개)
            </p>
          </div>
          <div className={styles.axis}>
            <p className={styles.axisLabel}>
              <strong>{RISK_LABELS[result.risk]}</strong>
              <span>위험형 / 안전형</span>
            </p>
            <p className={styles.axisText}>
              보유 자산 중 빌라·바이오 비중 <b>{Math.round(result.riskyRatio * 100)}%</b> ({holdings.risky}개 / {holdings.total}개)
            </p>
          </div>
        </section>

        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>보유 자산</h3>
          <table className={styles.holdings}>
            <tbody>
              <tr>
                <th>주식</th>
                {Object.entries(STOCK_LABELS).map(([key, label]) => (
                  <td key={key}>{label} {me.stockHoldings?.[key] ?? 0}</td>
                ))}
              </tr>
              <tr>
                <th>부동산</th>
                {Object.entries(REAL_ESTATE_LABELS).map(([key, label]) => (
                  <td key={key}>{label} {me.realEstateHoldings?.[key] ?? 0}</td>
                ))}
              </tr>
            </tbody>
          </table>
        </section>

        <footer className={styles.reportFooter}>
          {REPORT_ORGANIZATION} · {REPORT_PROGRAM}
        </footer>
      </article>

      <div className={styles.bottomActions}>
        <a className={styles.linkBtn} href={GROUP_DETAIL_URLS[result.group]} target="_blank" rel="noopener noreferrer">
          유형 자세히 보기
        </a>
        <button type="button" className={styles.linkBtn} onClick={() => navigate(resultPath)}>결과로 돌아가기</button>
      </div>
    </div>
  )
}
