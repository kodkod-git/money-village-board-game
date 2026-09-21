import { describe, it, expect } from 'vitest'
import { RESULT_GROUPS, GROUP_DETAIL_URLS, ANIMAL_EMOJIS, QUESTIONS, TOTAL_QUIZ_STEPS } from './quizData'

describe('quizData', () => {
  it('모든 결과 그룹에 대해 일러스트 경로와 상세보기 링크가 존재한다', () => {
    Object.keys(RESULT_GROUPS).forEach(groupName => {
      expect(RESULT_GROUPS[groupName].illustration).toMatch(/^\/groups\/.+\.png$/)
      expect(GROUP_DETAIL_URLS[groupName]).toMatch(/^https:\/\//)
    })
  })

  it('모든 그룹의 대표 동물에 이모지가 매핑돼 있다', () => {
    Object.values(RESULT_GROUPS).forEach(group => {
      group.animals.forEach(animal => {
        expect(ANIMAL_EMOJIS[animal]).toBeDefined()
      })
    })
  })

  it('TOTAL_QUIZ_STEPS는 이름·성별·나이 3단계 + 질문 개수와 같다', () => {
    expect(TOTAL_QUIZ_STEPS).toBe(QUESTIONS.length + 3)
  })
})
