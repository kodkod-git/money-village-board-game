import { renderHook } from '@testing-library/react'
import { describe, it, expect, afterEach } from 'vitest'
import useIsAdminMobile from './useIsAdminMobile'
import { mockViewport, restoreViewport } from '../test-utils/mockViewport'

afterEach(restoreViewport)

describe('useIsAdminMobile', () => {
  it('767px은 모바일이다', () => {
    mockViewport(767)
    expect(renderHook(() => useIsAdminMobile()).result.current).toBe(true)
  })

  it('768px은 모바일이 아니다', () => {
    mockViewport(768)
    expect(renderHook(() => useIsAdminMobile()).result.current).toBe(false)
  })

  it('폭이 바뀌면 값도 바뀐다', () => {
    const viewport = mockViewport(1280)
    const { result } = renderHook(() => useIsAdminMobile())
    viewport.resize(390)
    expect(result.current).toBe(true)
    viewport.resize(1280)
    expect(result.current).toBe(false)
  })

  it('matchMedia가 없으면 PC로 판단한다', () => {
    expect(renderHook(() => useIsAdminMobile()).result.current).toBe(false)
  })
})
