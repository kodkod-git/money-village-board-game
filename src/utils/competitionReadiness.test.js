import { describe, it, expect } from 'vitest'
import { competitionReadiness } from './competitionReadiness'

const player = (isCompleted) => ({ gameState: { isCompleted } })

describe('competitionReadiness', () => {
  it('미배정·입력 중 인원을 이유로 보여주고 준비되지 않았다고 한다', () => {
    const pool = [player(true), player(false)]
    const rooms = [
      { registered: false, players: [player(true), player(false)] },
      { registered: true, players: [player(false)] }, // 이미 등록된 팀은 세지 않는다
      { registered: false, players: [] },             // 빈 팀도 세지 않는다
    ]
    expect(competitionReadiness(pool, rooms)).toEqual({ ready: false, reason: '미배정 2명 · 입력 중 1명' })
  })

  it('등록할 팀이 없으면 그 이유를 보여준다', () => {
    expect(competitionReadiness([], [{ registered: true, players: [player(true)] }]))
      .toEqual({ ready: false, reason: '등록할 팀이 없어요' })
  })

  it('전원 배정·입력 완료면 준비됐다', () => {
    expect(competitionReadiness([], [{ registered: false, players: [player(true)] }]))
      .toEqual({ ready: true, reason: '' })
  })
})
