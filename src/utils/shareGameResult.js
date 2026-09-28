// 게임 결과(랭킹) 페이지 공유. 참가자 결과 화면과 관리자 팀 카드가 함께 쓴다.
// 각 함수는 화면에 띄울 안내 문구를 돌려준다(빈 문자열이면 안내 없음).

export function gameResultUrl(sessionId) {
  return `${window.location.origin}/result/${sessionId}`
}

export async function copyGameResultLink(sessionId) {
  try {
    await navigator.clipboard.writeText(gameResultUrl(sessionId))
    return '링크가 복사됐어요'
  } catch {
    return '링크를 복사하지 못했어요. 다시 시도해 주세요.'
  }
}

export function shareGameResultToKakao(sessionId) {
  const kakao = window.Kakao
  const key = import.meta.env.VITE_KAKAO_JS_KEY
  if (!key || !kakao) return '카카오톡 공유는 준비 중이에요'
  try {
    if (!kakao.isInitialized()) kakao.init(key)
    const url = gameResultUrl(sessionId)
    kakao.Share.sendDefault({
      objectType: 'text',
      text: '머니빌리지 게임 결과를 확인해 보세요!',
      link: { mobileWebUrl: url, webUrl: url },
      buttonTitle: '결과 보기',
    })
    return ''
  } catch {
    return '카카오톡 공유를 열지 못했어요. 다시 시도해 주세요.'
  }
}
