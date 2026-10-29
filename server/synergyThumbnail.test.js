// @vitest-environment node
import { describe, it, expect } from 'vitest'
import sharp from 'sharp'
import { renderSynergyThumbnail } from './synergyThumbnail.js'
import { THUMBNAIL_WIDTH, THUMBNAIL_HEIGHT } from '../src/utils/synergyScoring.js'

describe('renderSynergyThumbnail', () => {
  it.each([
    ['PTEN', 'PTSN'], // 시민권자 Red
    ['PTEN', 'FTEN'], // Blue
    ['PTEN', 'FAEC'], // Orange
    ['PTEN', 'PASC'], // Green
  ])('%s × %s 조합을 2:1 JPEG로 합성한다', async (myType, citizenType) => {
    const image = await renderSynergyThumbnail(myType, citizenType)
    const meta = await sharp(image).metadata()
    expect(meta).toMatchObject({ format: 'jpeg', width: THUMBNAIL_WIDTH, height: THUMBNAIL_HEIGHT })
  })

  it('같은 조합은 다시 합성하지 않는다', async () => {
    expect(await renderSynergyThumbnail('FASN', 'PAEN')).toBe(await renderSynergyThumbnail('FASN', 'PAEN'))
  })
})
