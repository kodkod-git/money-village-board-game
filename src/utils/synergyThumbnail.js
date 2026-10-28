// 카카오톡 공유 썸네일. 결과 화면 hero(배경 + 나·시민권자 캐릭터 + 시너지 아이콘)를 캔버스에 다시 그려
// 카카오 서버에 올리고, 그 URL을 피드 이미지로 쓴다. 카카오 피드는 2:1로 보여서 같은 비율로 만든다.
export const THUMBNAIL_WIDTH = 800
export const THUMBNAIL_HEIGHT = 400

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = src
  })
}

function drawContain(ctx, img, x, y, w, h) {
  const scale = Math.min(w / img.width, h / img.height)
  const dw = img.width * scale
  const dh = img.height * scale
  ctx.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh)
}

export async function renderSynergyThumbnail({ background, leftCharacter, rightCharacter, icon }) {
  const [bg, left, right, mark] = await Promise.all([background, leftCharacter, rightCharacter, icon].map(loadImage))
  const canvas = document.createElement('canvas')
  canvas.width = THUMBNAIL_WIDTH
  canvas.height = THUMBNAIL_HEIGHT
  const ctx = canvas.getContext('2d')

  // 배경(3475×1500)은 2:1에 맞춰 가운데를 채운다.
  const cover = Math.max(THUMBNAIL_WIDTH / bg.width, THUMBNAIL_HEIGHT / bg.height)
  const bw = bg.width * cover
  const bh = bg.height * cover
  ctx.drawImage(bg, (THUMBNAIL_WIDTH - bw) / 2, (THUMBNAIL_HEIGHT - bh) / 2, bw, bh)

  ctx.shadowColor = 'rgba(0, 0, 0, 0.18)'
  ctx.shadowBlur = 16
  ctx.shadowOffsetY = 6
  drawContain(ctx, left, THUMBNAIL_WIDTH * 0.06, THUMBNAIL_HEIGHT * 0.1, THUMBNAIL_WIDTH * 0.36, THUMBNAIL_HEIGHT * 0.8)
  drawContain(ctx, right, THUMBNAIL_WIDTH * 0.58, THUMBNAIL_HEIGHT * 0.1, THUMBNAIL_WIDTH * 0.36, THUMBNAIL_HEIGHT * 0.8)
  const iconSize = THUMBNAIL_WIDTH * 0.13
  drawContain(ctx, mark, (THUMBNAIL_WIDTH - iconSize) / 2, (THUMBNAIL_HEIGHT - iconSize) / 2, iconSize, iconSize)

  return new Promise((resolve, reject) => {
    canvas.toBlob(blob => (blob ? resolve(blob) : reject(new Error('thumbnail failed'))), 'image/png')
  })
}

// 썸네일을 그려 카카오에 올리고 이미지 URL을 돌려준다.
export async function uploadSynergyThumbnail(kakao, images) {
  const blob = await renderSynergyThumbnail(images)
  const file = new File([blob], 'synergy.png', { type: 'image/png' })
  const response = await kakao.Share.uploadImage({ file: [file] })
  return response.infos.original.url
}
