import { useEffect, useState } from 'react'

const QUERY = '(max-width: 767px)'

function matches() {
  return typeof window.matchMedia === 'function' && window.matchMedia(QUERY).matches
}

/**
 * 관리자 화면이 모바일 폭(767px 이하)인지 알려 준다.
 * 스타일만 다를 때는 쓰지 말고 CSS의 @media를 쓴다.
 */
export default function useIsAdminMobile() {
  const [isMobile, setIsMobile] = useState(matches)

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return undefined
    const query = window.matchMedia(QUERY)
    const handleChange = event => setIsMobile(event.matches)
    query.addEventListener('change', handleChange)
    return () => query.removeEventListener('change', handleChange)
  }, [])

  return isMobile
}
