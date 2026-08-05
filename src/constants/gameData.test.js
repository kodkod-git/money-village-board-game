import { describe, it, expect } from 'vitest'
import {
  JOB_LABELS, JOB_ICONS, BADGE_NAMES, BADGE_LABELS,
  REAL_ESTATE_LABELS, ESTATE_IMAGES, ESTATE_PRICES,
  STOCK_LABELS, STOCK_IMAGES, ROOM_STATUS_LABELS,
  MAX_ASSET_PRICE, MAX_ASSET_QUANTITY,
} from './gameData'

describe('gameData constants', () => {
  it('직업은 6개이며 라벨과 아이콘 키가 일치한다', () => {
    const keys = Object.keys(JOB_LABELS)
    expect(keys).toHaveLength(6)
    expect(Object.keys(JOB_ICONS)).toEqual(keys)
  })

  it('성공카드는 6개이며 이름과 라벨 키가 일치한다', () => {
    expect(BADGE_NAMES).toHaveLength(6)
    expect(Object.keys(BADGE_LABELS)).toEqual(BADGE_NAMES)
  })

  it('부동산은 6개이며 라벨/이미지/가격 키가 일치한다', () => {
    const keys = Object.keys(REAL_ESTATE_LABELS)
    expect(keys).toHaveLength(6)
    expect(Object.keys(ESTATE_IMAGES)).toEqual(keys)
    expect(Object.keys(ESTATE_PRICES)).toEqual(keys)
  })

  it('주식은 6개이며 라벨/이미지 키가 일치한다', () => {
    const keys = Object.keys(STOCK_LABELS)
    expect(keys).toHaveLength(6)
    expect(Object.keys(STOCK_IMAGES)).toEqual(keys)
  })

  it('방 상태 라벨은 live/stale/abandoned/completed-but-unregistered 키를 갖는다', () => {
    expect(Object.keys(ROOM_STATUS_LABELS)).toEqual(['live', 'stale', 'abandoned', 'completed-but-unregistered'])
  })

  it('자산 가격/수량 상한값이 정의되어 있다', () => {
    expect(MAX_ASSET_PRICE).toBe(1000000)
    expect(MAX_ASSET_QUANTITY).toBe(100)
  })
})
