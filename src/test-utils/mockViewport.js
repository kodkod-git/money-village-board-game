import { act } from '@testing-library/react'

// jsdom에는 matchMedia가 없어 관리자 화면 테스트의 폭을 이것으로 흉내 낸다.
export function mockViewport(initialWidth) {
  let width = initialWidth
  const listeners = new Set()

  window.matchMedia = query => {
    const max = Number(/max-width:\s*(\d+)px/.exec(query)?.[1])
    return {
      media: query,
      get matches() { return width <= max },
      addEventListener: (_, fn) => listeners.add({ fn, max }),
      removeEventListener: (_, fn) => {
        listeners.forEach(entry => { if (entry.fn === fn) listeners.delete(entry) })
      },
    }
  }

  return {
    resize(nextWidth) {
      width = nextWidth
      act(() => listeners.forEach(({ fn, max }) => fn({ matches: width <= max })))
    },
  }
}

export function restoreViewport() {
  delete window.matchMedia
}
