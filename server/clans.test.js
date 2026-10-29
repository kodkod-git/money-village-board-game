// @vitest-environment node
import { describe, it, expect, beforeEach } from 'vitest'
import {
  createClan, renameClan, deleteClan, assignToClan, listClans, pruneMembers, deleteClassClans,
  isValidClanName, _resetClans,
} from './clans.js'

beforeEach(() => _resetClans())

describe('clans', () => {
  it('수업별로 "팀 N" 이름으로 만들고, 지워도 번호를 다시 쓰지 않는다', () => {
    const a = createClan('c1')
    const b = createClan('c1')
    expect([a.name, b.name]).toEqual(['팀 1', '팀 2'])
    deleteClan('c1', b.id)
    expect(createClan('c1').name).toBe('팀 3')
    expect(createClan('c2').name).toBe('팀 1')
  })

  it('만든 순서대로 목록을 돌려준다', () => {
    const a = createClan('c1')
    const b = createClan('c1')
    expect(listClans('c1').map(c => c.id)).toEqual([a.id, b.id])
    expect(listClans('none')).toEqual([])
  })

  it('이름 검증: 앞뒤 공백을 빼고 1~20자', () => {
    expect(isValidClanName(' 호랑이반 ')).toBe(true)
    expect(isValidClanName('   ')).toBe(false)
    expect(isValidClanName('가'.repeat(21))).toBe(false)
    expect(isValidClanName(3)).toBe(false)
  })

  it('이름을 바꾼다(앞뒤 공백 제거). 없는 클랜이면 null', () => {
    const a = createClan('c1')
    expect(renameClan('c1', a.id, '  호랑이반 ').name).toBe('호랑이반')
    expect(listClans('c1')[0].name).toBe('호랑이반')
    expect(renameClan('c2', a.id, '다른 수업')).toBeNull()
  })

  it('배정·이동·해제한다. 한 참여자는 한 클랜에만 있다', () => {
    const a = createClan('c1')
    const b = createClan('c1')
    expect(assignToClan('c1', 'r1', a.id)).toBe(true)
    expect(assignToClan('c1', 'r1', b.id)).toBe(true)
    expect(listClans('c1').map(c => c.memberIds)).toEqual([[], ['r1']])
    expect(assignToClan('c1', 'r1', null)).toBe(true)
    expect(listClans('c1').map(c => c.memberIds)).toEqual([[], []])
  })

  it('없는 클랜으로는 배정하지 않는다', () => {
    const a = createClan('c1')
    assignToClan('c1', 'r1', a.id)
    expect(assignToClan('c1', 'r1', 'missing')).toBe(false)
    expect(listClans('c1')[0].memberIds).toEqual(['r1'])
  })

  it('클랜을 지우면 멤버도 배정 해제된다', () => {
    const a = createClan('c1')
    assignToClan('c1', 'r1', a.id)
    expect(deleteClan('c1', a.id)).toBe(true)
    expect(deleteClan('c1', a.id)).toBe(false)
    expect(listClans('c1')).toEqual([])
  })

  it('pruneMembers는 남아 있는 결과 id만 남긴다', () => {
    const a = createClan('c1')
    assignToClan('c1', 'r1', a.id)
    assignToClan('c1', 'r2', a.id)
    pruneMembers('c1', new Set(['r2']))
    expect(listClans('c1')[0].memberIds).toEqual(['r2'])
  })

  it('deleteClassClans는 그 수업의 클랜만 지운다', () => {
    createClan('c1')
    createClan('c2')
    deleteClassClans('c1')
    expect(listClans('c1')).toEqual([])
    expect(listClans('c2')).toHaveLength(1)
    expect(createClan('c1').name).toBe('팀 1')
  })
})
