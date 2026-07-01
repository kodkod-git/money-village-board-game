import { describe, it, expect } from 'vitest'
import { ADMIN_MOCK_ROOMS } from './adminMockData'

describe('ADMIN_MOCK_ROOMS', () => {
  it('4개의 목업 방을 제공한다', () => {
    expect(ADMIN_MOCK_ROOMS).toHaveLength(4)
  })

  it('등록완료 방이 최소 1개 존재한다', () => {
    expect(ADMIN_MOCK_ROOMS.some(r => r.registered)).toBe(true)
  })

  it('진행중(미등록) 방이 최소 1개 존재한다', () => {
    expect(ADMIN_MOCK_ROOMS.some(r => !r.registered)).toBe(true)
  })

  it('등록완료 방의 모든 플레이어는 isCompleted가 true다', () => {
    const registeredRoom = ADMIN_MOCK_ROOMS.find(r => r.registered)
    expect(registeredRoom.players.every(p => p.gameState.isCompleted)).toBe(true)
  })

  it('각 방은 고유한 코드를 가진다', () => {
    const codes = ADMIN_MOCK_ROOMS.map(r => r.code)
    expect(new Set(codes).size).toBe(codes.length)
  })
})
