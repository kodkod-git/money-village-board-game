import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { RESULT_GROUPS } from '../constants/quizData'
import { INTRO_TITLE, INTRO_SUBTITLE, INTRO_SHARE_TEXT, SYNERGY_TYPES } from '../constants/synergyData'
import { normalizeSynergyType, getTypeGroup, getCharacterImage } from '../utils/synergyScoring'
import useBodyClass from '../hooks/useBodyClass'
import { trackSurveyEvent } from '../utils/surveyTracking'
import styles from './SynergyIntro.module.css'

const KAKAO_JS_KEY = import.meta.env.VITE_KAKAO_JS_KEY

export default function SynergyIntro() {
  const { citizenType: rawCitizenType } = useParams()
  const citizenType = normalizeSynergyType(rawCitizenType)
  const navigate = useNavigate()
  useBodyClass('onboarding-mode')
  const [notice, setNotice] = useState('')

  // 참여: 시민권 QR 링크로 들어온 수
  useEffect(() => {
    if (citizenType) trackSurveyEvent('synergy', 'visit')
  }, [citizenType])

  useEffect(() => {
    if (!notice) return
    const timer = setTimeout(() => setNotice(''), 2000)
    return () => clearTimeout(timer)
  }, [notice])

  if (!citizenType) {
    return (
      <div className={styles.page}>
        <p className={styles.subtitle}>올바르지 않은 시민권 링크예요.</p>
      </div>
    )
  }

  const info = SYNERGY_TYPES[citizenType]
  const group = RESULT_GROUPS[getTypeGroup(citizenType)]
  const characterImage = getCharacterImage(info.animal)

  function handleCopyLink() {
    navigator.clipboard.writeText(window.location.href)
    setNotice('링크가 복사됐어요')
  }

  function handleKakaoShare() {
    const kakao = window.Kakao
    if (!KAKAO_JS_KEY || !kakao) {
      setNotice('카카오톡 공유는 준비 중이에요')
      return
    }
    if (!kakao.isInitialized()) kakao.init(KAKAO_JS_KEY)
    kakao.Share.sendDefault({
      objectType: 'feed',
      content: {
        title: `${INTRO_TITLE} ${citizenType}`,
        description: INTRO_SHARE_TEXT,
        imageUrl: `${window.location.origin}${characterImage}`,
        link: { mobileWebUrl: window.location.href, webUrl: window.location.href },
      },
    })
  }

  return (
    <div className={styles.page} style={{ '--group': group.color, '--group-bg': group.bgColor }}>
      <span className={`${styles.sparkle} ${styles.sparkleA}`} aria-hidden="true">✦</span>
      <span className={`${styles.sparkle} ${styles.sparkleB}`} aria-hidden="true">✦</span>
      <span className={`${styles.sparkle} ${styles.sparkleC}`} aria-hidden="true">✧</span>
      <span className={`${styles.sparkle} ${styles.sparkleD}`} aria-hidden="true">✦</span>

      <div className={styles.center}>
        <h1 className={styles.title}>
          {INTRO_TITLE}
          <span className={styles.titleAccent}>{citizenType}</span>
        </h1>
        <p className={styles.subtitle}>{INTRO_SUBTITLE}</p>

        <div className={styles.arch}>
          <img className={styles.character} src={characterImage} alt={`시민권자의 대표 동물 ${info.animal}`} />
        </div>

        <button className={styles.startBtn} onClick={() => navigate(`/synergy/${citizenType}/play`)}>
          <span aria-hidden="true">›</span>
          테스트 시작하기
        </button>

        <div className={styles.shareRow}>
          <button className={`${styles.iconBtn} ${styles.kakaoIconBtn}`} onClick={handleKakaoShare} aria-label="카카오톡 공유하기">
            <img className={styles.iconBtnImg} src="/icons/mode_comment.png" alt="" aria-hidden="true" />
          </button>
          <button className={styles.iconBtn} onClick={handleCopyLink} aria-label="링크 공유하기">
            <img className={styles.iconBtnImg} src="/icons/link_2.png" alt="" aria-hidden="true" />
          </button>
        </div>
        {notice && <p role="status" className={styles.notice}>{notice}</p>}
      </div>
    </div>
  )
}
