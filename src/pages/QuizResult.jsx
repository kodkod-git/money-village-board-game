import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  RESULT_GROUPS,
  ANIMAL_EMOJIS,
  AXIS_LABELS,
  GROUP_DETAIL_URLS,
  NAVER_REVIEW_URL,
  ECONOMIC_TYPES_URL,
} from '../constants/quizData'
import useBodyClass from '../hooks/useBodyClass'
import styles from './QuizResult.module.css'

const KAKAO_JS_KEY = import.meta.env.VITE_KAKAO_JS_KEY

export default function QuizResult() {
  const { resultId } = useParams()
  const navigate = useNavigate()
  useBodyClass('result-mode')
  const [result, setResult] = useState(null)
  const [error, setError] = useState(false)
  const [notice, setNotice] = useState('')

  useEffect(() => {
    fetch(`/api/quiz/results/${resultId}`)
      .then(r => { if (!r.ok) throw new Error('not found'); return r.json() })
      .then(setResult)
      .catch(() => setError(true))
  }, [resultId])

  useEffect(() => {
    if (!notice) return
    const timer = setTimeout(() => setNotice(''), 2000)
    return () => clearTimeout(timer)
  }, [notice])

  const handleCopyLink = useCallback(() => {
    navigator.clipboard.writeText(window.location.href)
    setNotice('링크가 복사됐어요')
  }, [])

  const handleKakaoShare = useCallback((group, resultGroupName) => {
    const kakao = window.Kakao
    if (!KAKAO_JS_KEY || !kakao) {
      setNotice('카카오톡 공유는 준비 중이에요')
      return
    }
    if (!kakao.isInitialized()) kakao.init(KAKAO_JS_KEY)
    kakao.Share.sendDefault({
      objectType: 'feed',
      content: {
        title: `${resultGroupName} - 우리 아이 경제 잠재력 테스트`,
        description: group.tagline,
        imageUrl: `${window.location.origin}${group.illustration}`,
        link: { mobileWebUrl: window.location.href, webUrl: window.location.href },
      },
    })
  }, [])

  if (error) {
    return (
      <div className={styles.page}>
        <div className={styles.errorWrap}>
          <p className={styles.errorText}>결과를 불러오지 못했어요.</p>
          <button className={styles.retryBtn} onClick={() => navigate('/quiz')}>다시 하기</button>
        </div>
      </div>
    )
  }

  if (!result) return null

  const group = RESULT_GROUPS[result.result_group]

  const isTodayTomorrowLeftActive = result.axis_today_tomorrow === AXIS_LABELS.axisTodayTomorrow.leftValue
  const isSafetyAdventureLeftActive = result.axis_safety_adventure === AXIS_LABELS.axisSafetyAdventure.leftValue
  const navBtnStyle = { background: group.color, borderColor: group.color }
  const tintStyle = {
    backgroundColor: `color-mix(in srgb, ${group.color} 12%, white)`,
    borderColor: `color-mix(in srgb, ${group.color} 35%, white)`,
  }
  const pillStyle = { backgroundColor: `color-mix(in srgb, ${group.color} 14%, white)`, color: group.color }
  const activeValueStyle = { ...tintStyle, color: group.color }

  return (
    <div className={styles.page}>
      <div className={styles.hero} style={{ backgroundColor: group.bgColor || group.color }}>
        {group.illustration && (
          <img className={styles.illustration} src={group.illustration} alt={result.result_group} />
        )}
        <div className={styles.heroFade} />
      </div>

      <div className={styles.card}>
        <span className={styles.eyebrow} style={pillStyle}>우리 아이의 경제적 잠재력은</span>
        <h1 className={styles.groupName} style={{ color: group.color }}>{result.result_group}</h1>
        <p className={styles.tagline}>{group.tagline}</p>

        <div className={styles.descriptionBox} style={tintStyle}>
          <svg className={styles.checkIcon} viewBox="0 0 24 24" width="20" height="20" fill="none" stroke={group.color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect x="3" y="3" width="18" height="18" rx="4" />
            <path d="M7 12.5l3 3 7-7" />
          </svg>
          <p className={styles.description}>{group.description}</p>
        </div>

        {group.animals.length > 0 && (
          <div className={styles.section}>
            <p className={styles.sectionLabel}>대표 동물</p>
            <div className={styles.animalRow}>
              {group.animals.map(animal => (
                <div key={animal} className={styles.animalItem}>
                  <span className={styles.animalAvatar} style={tintStyle} aria-hidden="true">{ANIMAL_EMOJIS[animal] ?? '🐾'}</span>
                  <span className={styles.animalName}>{animal}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className={styles.section}>
          <p className={styles.sectionLabel}>핵심 가치</p>
          <div className={styles.valueGrid}>
            <span className={styles.valueChip} style={isTodayTomorrowLeftActive ? activeValueStyle : undefined}>
              {AXIS_LABELS.axisTodayTomorrow.left}
            </span>
            <span className={styles.valueChip} style={!isTodayTomorrowLeftActive ? activeValueStyle : undefined}>
              {AXIS_LABELS.axisTodayTomorrow.right}
            </span>
            <span className={styles.valueChip} style={isSafetyAdventureLeftActive ? activeValueStyle : undefined}>
              {AXIS_LABELS.axisSafetyAdventure.left}
            </span>
            <span className={styles.valueChip} style={!isSafetyAdventureLeftActive ? activeValueStyle : undefined}>
              {AXIS_LABELS.axisSafetyAdventure.right}
            </span>
          </div>
        </div>

        <div className={styles.section}>
          <p className={styles.sectionLabel}>더 알아보기</p>
          <a className={styles.navBtn} style={navBtnStyle} href={GROUP_DETAIL_URLS[result.result_group]} target="_blank" rel="noopener noreferrer">
            우리 아이 경제 그룹 자세히 보기
          </a>
          <a className={styles.navBtn} style={navBtnStyle} href={ECONOMIC_TYPES_URL} target="_blank" rel="noopener noreferrer">
            다양한 경제 유형 알아보기
          </a>
          <a className={styles.navBtn} style={navBtnStyle} href={NAVER_REVIEW_URL} target="_blank" rel="noopener noreferrer">
            네이버 리뷰 작성하기
          </a>
        </div>

        <div className={styles.section}>
          <p className={styles.sectionLabel}>공유하기</p>
          <div className={styles.shareRow}>
            <button
              className={`${styles.iconBtn} ${styles.kakaoIconBtn}`}
              onClick={() => handleKakaoShare(group, result.result_group)}
              aria-label="카카오톡 공유하기"
            >
              <img className={styles.iconBtnImg} src="/icons/mode_comment.png" alt="" aria-hidden="true" />
            </button>
            <button className={styles.iconBtn} onClick={handleCopyLink} aria-label="링크 공유하기">
              <img className={styles.iconBtnImg} src="/icons/link_2.png" alt="" aria-hidden="true" />
            </button>
            <a className={styles.iconBtn} href={group.illustration} download={group.illustration.split('/').pop()} aria-label="사진 공유하기">
              <img className={styles.iconBtnImg} src="/icons/download.png" alt="" aria-hidden="true" />
            </a>
          </div>
          {notice && <p className={styles.notice} style={{ color: group.color }}>{notice}</p>}
        </div>

        <button className={styles.retryBtn} onClick={() => navigate('/quiz')}>
          다시 하기
        </button>
      </div>
    </div>
  )
}
