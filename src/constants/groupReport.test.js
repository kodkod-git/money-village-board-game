import { describe, it, expect } from 'vitest'
import { existsSync } from 'node:fs'
import { GROUP_REPORTS } from './groupReport'
import { RESULT_GROUPS } from './quizData'

describe('GROUP_REPORTS', () => {
  it('경제 잠재력 4개 그룹 모두의 카드 데이터가 있다', () => {
    expect(Object.keys(GROUP_REPORTS).sort()).toEqual(Object.keys(RESULT_GROUPS).sort())
  })

  it.each(Object.entries(GROUP_REPORTS))('%s: 동물 4마리·특징 4개와 이미지 파일이 모두 있다', (_, report) => {
    expect(report.animals).toHaveLength(4)
    expect(report.traits).toHaveLength(4)
    const images = [...report.animals.map(a => a.image), report.person.image]
    images.forEach(src => expect(existsSync(`public${src}`)).toBe(true))
  })
})
