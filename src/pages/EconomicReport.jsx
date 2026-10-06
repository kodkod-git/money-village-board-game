import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import BackButton from '../components/BackButton'
import { RESULT_GROUPS, GROUP_DETAIL_URLS, AGE_SUBTITLE, AGE_LABEL, AGE_PLACEHOLDER } from '../constants/quizData'
import { GROUP_REPORTS, TIME_OPTIONS, RISK_OPTIONS } from '../constants/groupReport'
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
              {error ? '결과를 불러오지 못했어요.' : '내 게임 결과가 있을 때만\n경제적 잠재력 유형을 확인할 수 있어요.'}
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
  const groupReport = GROUP_REPORTS[result.group]

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
          <h1 className={styles.reportTitle}>경제적 잠재력 유형 보고서</h1>
        </header>

        <dl className={styles.infoTable}>
          <div><dt>기관명</dt><dd>{REPORT_ORGANIZATION}</dd></div>
          <div><dt>프로그램</dt><dd>{REPORT_PROGRAM}</dd></div>
          <div><dt>이름</dt><dd>{me.name}</dd></div>
          <div><dt>나이</dt><dd>{Number(age)}세</dd></div>
          <div><dt>날짜</dt><dd>{formatDate(resultDate)}</dd></div>
        </dl>

        <section className={styles.groupCard}>
          <img className={styles.groupImg} src={groupReport.hero} alt={`${result.group} 일러스트`} />
          <div className={styles.groupBody}>
            <p className={styles.groupType}>
              {HORIZON_LABELS[result.horizon]} · {RISK_LABELS[result.risk]}
            </p>
            <h2 className={styles.groupName}>{result.group}</h2>
          </div>
        </section>

        <section className={styles.cardGrid}>
          <div className={styles.infoCard}>
            <h3 className={styles.cardTitle}>[{groupReport.title}]</h3>
            <p className={styles.cardLead}>{groupReport.description}</p>
            <div className={styles.axisGrid}>
              {[['Time', TIME_OPTIONS, groupReport.time], ['Risk', RISK_OPTIONS, groupReport.risk]].map(([axis, options, picked]) => (
                <div key={axis} className={styles.axisRow}>
                  {[options[0], null, options[1]].map(option => option ? (
                    <span
                      key={option.value}
                      className={`${styles.axisChip} ${option.value === picked ? styles.axisChipOn : ''}`}
                      aria-current={option.value === picked ? 'true' : undefined}
                    >
                      {option.value === picked && <span className={styles.axisCheck} aria-hidden="true">✓</span>}
                      <span>{option.label}<small>({option.sub})</small></span>
                    </span>
                  ) : (
                    <span key="axis" className={styles.axisName}>{axis}</span>
                  ))}
                </div>
              ))}
            </div>
          </div>

          <div className={styles.infoCard}>
            <h3 className={styles.cardTitle}>[대표 동물]</h3>
            <p className={styles.cardLead}>대표 동물 · EFTI 연결 보기</p>
            <ul className={styles.animalList}>
              {groupReport.animals.map(animal => (
                <li key={animal.code} className={styles.animal}>
                  <img className={styles.animalImg} src={animal.image} alt={animal.name} />
                  <span className={styles.animalName}>{animal.name}</span>
                  <span className={styles.codeBadge}>{animal.code}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className={`${styles.infoCard} ${styles.personCard}`}>
            <img className={styles.personImg} src={groupReport.person.image} alt={groupReport.person.name} />
            <div className={styles.personBody}>
              <h3 className={styles.cardTitle}>[대표 인물]</h3>
              <p className={styles.personName}>{groupReport.person.name}</p>
              <p className={styles.cardLead}>{groupReport.person.description}</p>
              <div className={styles.personCode}>
                <p className={styles.personCodeTitle}>{groupReport.person.name}의 EFTI : {groupReport.person.code}</p>
                <p className={styles.personCodeDetail}>{groupReport.person.codeDetail}</p>
              </div>
            </div>
          </div>

          <div className={styles.infoCard}>
            <h3 className={styles.cardTitle}>[우리 아이의 경제적 특징]</h3>
            <ul className={styles.traitList}>
              {groupReport.traits.map(trait => (
                <li key={trait} className={styles.trait}>
                  <span className={styles.traitCheck} aria-hidden="true">✓</span>
                  {trait}
                </li>
              ))}
            </ul>
          </div>
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
