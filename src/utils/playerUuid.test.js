import { describe, it, expect, beforeEach } from 'vitest'
import { getPlayerUuid, resetPlayerUuid } from './playerUuid'

beforeEach(() => sessionStorage.clear())

describe('getPlayerUuid', () => {
  it('처음 호출 시 새 uuid를 생성해 sessionStorage에 저장한다', () => {
    const uuid = getPlayerUuid()
    expect(uuid).toMatch(/^[0-9a-f-]{36}$/)
    expect(sessionStorage.getItem('player_uuid')).toBe(uuid)
  })

  it('같은 세션(탭)에서 반복 호출하면 동일한 uuid를 반환한다', () => {
    const first = getPlayerUuid()
    const second = getPlayerUuid()
    expect(second).toBe(first)
  })

  it('localStorage가 아닌 sessionStorage에 저장한다 (다른 탭 간 공유되지 않도록)', () => {
    getPlayerUuid()
    expect(localStorage.getItem('player_uuid')).toBeNull()
  })
})

describe('resetPlayerUuid', () => {
  it('기존 uuid가 있어도 새 uuid를 생성해 덮어쓴다', () => {
    const first = getPlayerUuid()
    const second = resetPlayerUuid()
    expect(second).not.toBe(first)
    expect(sessionStorage.getItem('player_uuid')).toBe(second)
  })

  it('이후 getPlayerUuid를 호출하면 새로 발급된 uuid를 반환한다', () => {
    getPlayerUuid()
    const reset = resetPlayerUuid()
    expect(getPlayerUuid()).toBe(reset)
  })
})
