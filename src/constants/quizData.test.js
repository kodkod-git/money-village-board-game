import { describe, it, expect } from 'vitest'
import { RESULT_GROUPS, GROUP_DETAIL_URLS } from './quizData'

describe('quizData', () => {
  it('모든 결과 그룹에 대해 일러스트 경로와 상세보기 링크가 존재한다', () => {
    Object.keys(RESULT_GROUPS).forEach(groupName => {
      expect(RESULT_GROUPS[groupName].illustration).toMatch(/^\/groups\/.+\.png$/)
      expect(GROUP_DETAIL_URLS[groupName]).toMatch(/^https:\/\//)
    })
  })
})
