import { useRef, useState } from 'react'
import TeamStatSlide from './TeamStatSlide'
import styles from './CompetitionResultCarousel.module.css'

const STAT_SLIDES = [
  { valueKey: 'cash', title: '더 많은 현금을 가진 팀은?' },
  { valueKey: 'stockValue', title: '주식으로 더 많은 돈을 번 팀은?' },
  { valueKey: 'realEstateValue', title: '부동산으로 더 많은 돈을 번 팀은?' },
  { valueKey: 'totalAssets', title: '총 자산이 더 많은 팀은?' },
]

// 경쟁 모드 결과 화면: 팀 비교 4장을 옆으로 넘기고, 마지막 장(children)에서 기존 랭킹을 보여준다.
// 라이브러리 없이 가로 scroll-snap을 쓰고, 현재 장은 스크롤 위치로 계산한다.
export default function CompetitionResultCarousel({ teams, mySessionId, children }) {
  const trackRef = useRef(null)
  const [current, setCurrent] = useState(0)
  const total = STAT_SLIDES.length + 1

  function goTo(index) {
    setCurrent(index)
    const track = trackRef.current
    track?.scrollTo?.({ left: index * track.clientWidth, behavior: 'smooth' })
  }

  function handleScroll() {
    const track = trackRef.current
    if (!track?.clientWidth) return
    setCurrent(Math.round(track.scrollLeft / track.clientWidth))
  }

  return (
    <div className={styles.carousel}>
      <div ref={trackRef} className={styles.track} onScroll={handleScroll} data-testid="result-carousel-track">
        {STAT_SLIDES.map(slide => (
          <div key={slide.valueKey} className={styles.slide}>
            <TeamStatSlide title={slide.title} valueKey={slide.valueKey} teams={teams} mySessionId={mySessionId} />
          </div>
        ))}
        <div className={styles.slide}>{children}</div>
      </div>

      <div className={styles.controls}>
        <button type="button" className={styles.arrow} aria-label="이전 화면" disabled={current === 0} onClick={() => goTo(current - 1)}>‹</button>
        <div className={styles.dots}>
          {Array.from({ length: total }, (_, i) => (
            <button
              key={i}
              type="button"
              className={`${styles.dot} ${i === current ? styles.dotActive : ''}`}
              aria-label={`${i + 1}번째 화면`}
              aria-current={i === current ? 'true' : undefined}
              onClick={() => goTo(i)}
            />
          ))}
        </div>
        <button type="button" className={styles.arrow} aria-label="다음 화면" disabled={current === total - 1} onClick={() => goTo(current + 1)}>›</button>
      </div>
    </div>
  )
}
