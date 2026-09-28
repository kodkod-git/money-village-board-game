import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { RESULT_GROUPS, ANIMAL_EMOJIS, ECONOMIC_TYPES_URL } from '../constants/quizData'
import { SYNERGY_TYPES, SYNERGY_AXES, ACADEMY_INQUIRY_URL } from '../constants/synergyData'
import { calcSynergyScores, normalizeSynergyType, getTypeGroup } from '../utils/synergyScoring'
import useBodyClass from '../hooks/useBodyClass'
import styles from './QuizResult.module.css'
import synergyStyles from './SynergyResult.module.css'

const KAKAO_JS_KEY = import.meta.env.VITE_KAKAO_JS_KEY

export default function SynergyResult() {
  const { citizenType: rawCitizenType } = useParams()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  useBodyClass('result-mode')
  const [notice, setNotice] = useState('')

  const citizenType = normalizeSynergyType(rawCitizenType)
  const myType = normalizeSynergyType(searchParams.get('me'))
  const myName = searchParams.get('name') || '나'
  const citizenName = searchParams.get('friend') || '시민권자'

  useEffect(() => {
    if (!notice) return
    const timer = setTimeout(() => setNotice(''), 2000)
    return () => clearTimeout(timer)
  }, [notice])

  const handleCopyLink = useCallback(() => {
    navigator.clipboard.writeText(window.location.href)
    setNotice('링크가 복사됐어요')
  }, [])

  const handleKakaoShare = useCallback((type, group) => {
    const kakao = window.Kakao
    if (!KAKAO_JS_KEY || !kakao) {
      setNotice('카카오톡 공유는 준비 중이에요')
      return
    }
    if (!kakao.isInitialized()) kakao.init(KAKAO_JS_KEY)
    kakao.Share.sendDefault({
      objectType: 'feed',
      content: {
        title: `${type} - 경제적 성향 시너지 테스트`,
        description: SYNERGY_TYPES[type].title,
        imageUrl: `${window.location.origin}${group.illustration}`,
        link: { mobileWebUrl: window.location.href, webUrl: window.location.href },
      },
    })
  }, [])

  if (!citizenType || !myType) {
    return (
      <div className={styles.page}>
        <div className={styles.errorWrap}>
          <p className={styles.errorText}>결과를 불러오지 못했어요.</p>
          {citizenType && (
            <button className={styles.retryBtn} onClick={() => navigate(`/synergy/${citizenType}`)}>다시 하기</button>
          )}
        </div>
      </div>
    )
  }

  const myInfo = SYNERGY_TYPES[myType]
  const citizenInfo = SYNERGY_TYPES[citizenType]
  const group = RESULT_GROUPS[getTypeGroup(myType)]
  const { strength, complement } = calcSynergyScores(myType, citizenType)

  const navBtnStyle = { background: group.color, borderColor: group.color }
  const tintStyle = {
    backgroundColor: `color-mix(in srgb, ${group.color} 12%, white)`,
    borderColor: `color-mix(in srgb, ${group.color} 35%, white)`,
  }
  const pillStyle = { backgroundColor: `color-mix(in srgb, ${group.color} 14%, white)`, color: group.color }
  const activeValueStyle = { ...tintStyle, color: group.color }

  return (
    <div className={styles.page}>
      {/* 배경 이미지는 추후 추가 예정 — 지금은 그룹 색만 깐다. */}
      <div className={styles.hero} style={{ backgroundColor: group.bgColor || group.color }}>
        <div className={styles.heroFade} />
      </div>

      <div className={styles.card}>
        <span className={styles.eyebrow} style={pillStyle}>{myName}의 경제적 성향은</span>
        <h1 className={styles.groupName} style={{ color: group.color }}>{myType}</h1>
        <p className={styles.tagline}>{myInfo.title}</p>

        <div className={styles.descriptionBox} style={tintStyle}>
          <span aria-hidden="true">{ANIMAL_EMOJIS[myInfo.animal]}</span>
          <p className={styles.description}>대표 동물 : {myInfo.animal}</p>
        </div>

        <div className={styles.section}>
          <p className={styles.sectionLabel}>핵심 가치</p>
          <div className={styles.valueGrid}>
            {SYNERGY_AXES.flatMap((axis, i) => [
              <span key={axis.left} className={styles.valueChip} style={myType[i] === axis.leftLetter ? activeValueStyle : undefined}>
                {axis.left}
              </span>,
              <span key={axis.right} className={styles.valueChip} style={myType[i] === axis.rightLetter ? activeValueStyle : undefined}>
                {axis.right}
              </span>,
            ])}
          </div>
        </div>

        <div className={styles.section}>
          <p className={styles.sectionLabel}>{myName} × {citizenName} 시너지</p>
          <div className={synergyStyles.pairBox} style={tintStyle}>
            <p className={synergyStyles.pairTypes} style={{ color: group.color }}>{myType} × {citizenType}</p>
            <p className={synergyStyles.pairCaption}>
              {citizenName}의 경제적 성향 : {citizenType} ({citizenInfo.title})
            </p>
          </div>
          <div className={synergyStyles.scoreRow}>
            <div className={synergyStyles.scoreCard} style={tintStyle}>
              <span className={synergyStyles.scoreLabel}>💪 강점 강화 지수</span>
              <span className={synergyStyles.scoreValue} style={{ color: group.color }} data-testid="synergy-strength">{strength}</span>
            </div>
            <div className={synergyStyles.scoreCard} style={tintStyle}>
              <span className={synergyStyles.scoreLabel}>🤝 상호 보완 지수</span>
              <span className={synergyStyles.scoreValue} style={{ color: group.color }} data-testid="synergy-complement">{complement}</span>
            </div>
          </div>
        </div>

        <div className={styles.section}>
          <p className={styles.sectionLabel}>더 알아보기</p>
          <a className={styles.navBtn} style={navBtnStyle} href={myInfo.detailUrl} target="_blank" rel="noopener noreferrer">
            나의 경제 유형 자세히 보기
          </a>
          <a className={styles.navBtn} style={navBtnStyle} href={ECONOMIC_TYPES_URL} target="_blank" rel="noopener noreferrer">
            다양한 경제 유형 알아보기
          </a>
          <a className={styles.navBtn} style={navBtnStyle} href={ACADEMY_INQUIRY_URL} target="_blank" rel="noopener noreferrer">
            초등 경제 수업 문의하기
          </a>
        </div>

        <div className={styles.section}>
          <p className={styles.sectionLabel}>공유하기</p>
          <div className={styles.shareRow}>
            <button
              className={`${styles.iconBtn} ${styles.kakaoIconBtn}`}
              onClick={() => handleKakaoShare(myType, group)}
              aria-label="카카오톡 공유하기"
            >
              <img className={styles.iconBtnImg} src="/icons/mode_comment.png" alt="" aria-hidden="true" />
            </button>
            <button className={styles.iconBtn} onClick={handleCopyLink} aria-label="링크 공유하기">
              <img className={styles.iconBtnImg} src="/icons/link_2.png" alt="" aria-hidden="true" />
            </button>
          </div>
          {notice && <p className={styles.notice} style={{ color: group.color }}>{notice}</p>}
        </div>

        <button className={styles.retryBtn} onClick={() => navigate(`/synergy/${citizenType}`)}>
          다시 하기
        </button>
      </div>
    </div>
  )
}
