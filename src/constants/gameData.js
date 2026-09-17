export const JOB_LABELS = {
  a: '경영·금융', b: '연구·기술', c: '보건·교육',
  d: '문화·콘텐츠', e: '서비스·판매', f: '생산·운송',
}
export const JOB_ICONS = { a: '💼', b: '⚙️', c: '🏥', d: '🎨', e: '🛒', f: '🚚' }
export const JOB_IMAGES = {
  a: '경영금융', b: '연구기술', c: '보건교육',
  d: '문화콘텐츠', e: '서비스판매', f: '생산운송',
}

// badges[] 저장 배열의 인덱스는 이 배열의 순서를 기준으로 하며, 기존에 저장된
// 게임 결과와의 호환을 위해 순서를 바꾸지 않는다. 화면에 그릴 때 쓰는 순서는
// BADGE_DISPLAY_ORDER를 따로 둔다.
export const BADGE_NAMES = ['communication', 'global', 'idea', 'money', 'thinking', 'trust']
export const BADGE_LABELS = {
  communication: '행운', global: '부동산',
  idea: '직업', money: '노동',
  thinking: '주식', trust: '은행',
}
// 성공열쇠 선택/수정 화면: 노동·직업·은행 / 주식·부동산·행운.
export const BADGE_DISPLAY_ORDER = ['money', 'idea', 'trust', 'thinking', 'global', 'communication']

export const REAL_ESTATE_LABELS = {
  gaon: '단독주택', dami: '빌라', chorong: '아파트',
}
export const ESTATE_IMAGES = {
  gaon: 'Property 1=주택', dami: 'Property 1=빌라', chorong: 'Property 1=아파트',
}
export const ESTATE_PRICES = {
  gaon: '2만원', dami: '7만원', chorong: '10만원',
}

export const STOCK_LABELS = {
  semiconductor: '반도체', finance: '금융', bio: '바이오',
}
export const STOCK_IMAGES = {
  semiconductor: '반도체IT', finance: '금융산업', bio: '바이오헬스케어',
}

export const MAX_CASH = 1000000000

export const MAX_ASSET_PRICE = 1000000
export const MAX_ASSET_QUANTITY = 100

export const ROOM_STATUS_LABELS = {
  live: '미입력',
  stale: '정체',
  abandoned: '방치',
  'completed-but-unregistered': '등록 대기',
}
