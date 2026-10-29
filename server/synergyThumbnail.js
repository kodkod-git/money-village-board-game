import path from 'path'
import { fileURLToPath } from 'url'
import sharp from 'sharp'
import { getSynergyBackground, getCharacterImage, THUMBNAIL_WIDTH, THUMBNAIL_HEIGHT } from '../src/utils/synergyScoring.js'
import { SYNERGY_TYPES } from '../src/constants/synergyData.js'

// 카카오톡 공유 썸네일. 결과 화면 hero(배경 + 나·시민권자 캐릭터 + 시너지 아이콘)를 서버에서 합성한다.
// 카카오가 고정 URL에서 직접 가져가므로 브라우저 합성·업로드 타이밍이나 SDK 버전에 좌우되지 않는다.
// 카카오 피드는 2:1로 보여서 같은 비율(THUMBNAIL_WIDTH × THUMBNAIL_HEIGHT)로 만든다.

const PUBLIC_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '../public')
const CHARACTER_BOX = { width: 288, height: 320 }
const ICON_SIZE = 104

// 조합은 동물 16 × 16 = 256가지뿐이라 한 번 만든 이미지는 메모리에 둔다.
const cache = new Map()

function publicFile(urlPath) {
  return path.join(PUBLIC_DIR, ...urlPath.split('/').filter(Boolean))
}

async function fitInto(urlPath, width, height) {
  return sharp(publicFile(urlPath))
    .resize(width, height, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer()
}

export async function renderSynergyThumbnail(myType, citizenType) {
  const key = `${myType}_${citizenType}`
  if (!cache.has(key)) {
    const promise = (async () => {
      const [left, right, icon] = await Promise.all([
        fitInto(getCharacterImage(SYNERGY_TYPES[myType].animal), CHARACTER_BOX.width, CHARACTER_BOX.height),
        fitInto(getCharacterImage(SYNERGY_TYPES[citizenType].animal), CHARACTER_BOX.width, CHARACTER_BOX.height),
        fitInto('/synergy/synergy.png', ICON_SIZE, ICON_SIZE),
      ])
      const top = (THUMBNAIL_HEIGHT - CHARACTER_BOX.height) / 2
      return sharp(publicFile(getSynergyBackground(myType, citizenType)))
        .resize(THUMBNAIL_WIDTH, THUMBNAIL_HEIGHT, { fit: 'cover' })
        .composite([
          { input: left, left: 48, top },
          { input: right, left: THUMBNAIL_WIDTH - 48 - CHARACTER_BOX.width, top },
          { input: icon, left: (THUMBNAIL_WIDTH - ICON_SIZE) / 2, top: (THUMBNAIL_HEIGHT - ICON_SIZE) / 2 },
        ])
        .jpeg({ quality: 85 })
        .toBuffer()
    })()
    cache.set(key, promise)
    promise.catch(() => cache.delete(key))
  }
  return cache.get(key)
}
