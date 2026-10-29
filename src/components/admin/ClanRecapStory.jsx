import { useState, useEffect, useCallback, useRef } from 'react'
import { createPortal } from 'react-dom'
import RecapIntroSlide from './recap/RecapIntroSlide'
import RecapCategorySlide from './recap/RecapCategorySlide'
import RecapFinalSlide from './recap/RecapFinalSlide'
import { RECAP_CATEGORIES } from '../../utils/clanRecap'
import styles from './ClanRecapStory.module.css'

// 팀 대결 결과 스토리: 어두운 오버레이 위 세로 카드를 인스타그램 스토리처럼 넘겨 본다.
// 자동으로 넘어가지 않는다(선생님이 설명하며 넘긴다). 배경을 눌러도 닫히지 않는다.
export default function ClanRecapStory({ className, recap, onClose }) {
  const [index, setIndex] = useState(0)
  const dialogRef = useRef(null)
  const cardRef = useRef(null)
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  const slides = [
    {
      key: 'intro',
      theme: 'intro',
      content: <RecapIntroSlide className={className} teamCount={recap.teamCount} memberCount={recap.memberCount} />,
    },
    ...RECAP_CATEGORIES.map(category => ({
      key: category.valueKey,
      theme: category.theme,
      content: <RecapCategorySlide title={category.title} valueKey={category.valueKey} teams={recap.teams} />,
    })),
    { key: 'final', theme: 'final', content: <RecapFinalSlide teams={recap.teams} /> },
  ]
  const last = slides.length - 1
  const slide = slides[index]

  const prev = useCallback(() => setIndex(i => Math.max(0, i - 1)), [])
  const next = useCallback(() => setIndex(i => Math.min(last, i + 1)), [last])

  useEffect(() => {
    function handleKeyDown(e) {
      const onButton = e.target instanceof Element && e.target.closest('button')
      if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        e.preventDefault()
        prev()
      } else if (e.key === 'ArrowRight' || e.key === 'PageDown') {
        e.preventDefault()
        next()
      } else if (e.key === ' ' && !onButton) {
        e.preventDefault()
        next()
      } else if (e.key === 'Escape') {
        onCloseRef.current()
      } else if (e.key === 'Tab') {
        const items = dialogRef.current?.querySelectorAll('button:not([disabled]), [data-recap-card]')
        if (!items || items.length === 0) return
        const first = items[0]
        const lastItem = items[items.length - 1]
        const active = document.activeElement
        if (!dialogRef.current.contains(active)) {
          e.preventDefault()
          first.focus()
        } else if (e.shiftKey && active === first) {
          e.preventDefault()
          lastItem.focus()
        } else if (!e.shiftKey && active === lastItem) {
          e.preventDefault()
          first.focus()
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [prev, next])

  // 열 때 카드로 포커스를 옮기고, 닫으면 열기 전에 있던 요소로 되돌린다.
  useEffect(() => {
    const opener = document.activeElement
    cardRef.current?.focus()
    return () => { opener?.focus?.() }
  }, [])

  useEffect(() => {
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = previous }
  }, [])

  // 인스타그램처럼 카드 왼쪽 1/3은 이전, 나머지는 다음.
  function handleCardClick(e) {
    const rect = e.currentTarget.getBoundingClientRect()
    if (e.clientX - rect.left < rect.width / 3) prev()
    else next()
  }

  return createPortal(
    <div ref={dialogRef} className={styles.backdrop} role="dialog" aria-modal="true" aria-label="팀 대결 결과">
      <button type="button" className={styles.closeBtn} aria-label="닫기" onClick={onClose}>×</button>
      <div className={styles.stage}>
        <button
          type="button"
          className={`${styles.navBtn} ${index === 0 ? styles.navHidden : ''}`}
          aria-label="이전"
          disabled={index === 0}
          onClick={prev}
        >‹</button>
        <div
          ref={cardRef}
          tabIndex={-1}
          data-recap-card
          aria-label={`${index + 1} / ${slides.length}`}
          className={`${styles.card} ${styles[slide.theme]}`}
          data-testid="recap-card"
          onClick={handleCardClick}
        >
          <div className={styles.progress}>
            {slides.map((s, i) => (
              <span
                key={s.key}
                className={styles.segment}
                data-testid="recap-progress"
                data-state={i < index ? 'done' : i === index ? 'current' : 'todo'}
              />
            ))}
          </div>
          <p className={styles.className}>{className}</p>
          {/* key로 다시 마운트해서 장에 들어올 때마다 애니메이션을 처음부터 재생한다 */}
          <div key={slide.key} className={styles.content} aria-live="polite">{slide.content}</div>
        </div>
        <button
          type="button"
          className={`${styles.navBtn} ${index === last ? styles.navHidden : ''}`}
          aria-label="다음"
          disabled={index === last}
          onClick={next}
        >›</button>
      </div>
    </div>,
    document.body,
  )
}
