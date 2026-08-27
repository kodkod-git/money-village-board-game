import { useEffect } from 'react'

/**
 * 마운트되어 있는 동안 <body>에 클래스를 붙였다가 언마운트 시 제거한다.
 * 퀴즈 화면처럼 공통 폰 프레임(#root 카드) 레이아웃을 벗어나야 할 때 쓴다.
 */
export default function useBodyClass(className) {
  useEffect(() => {
    if (!className) return undefined
    document.body.classList.add(className)
    return () => document.body.classList.remove(className)
  }, [className])
}
