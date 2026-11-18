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

// 모든 주식 종목. 자산 계산은 이 전체 목록으로 한다(6판 게임은 뷰티를 보유할 수 없어
// 항상 0주이므로 결과가 같다). 화면에 보여줄 종목은 stockLabelsFor로 고른다.
export const STOCK_LABELS = {
  semiconductor: '반도체', finance: '금융', bio: '바이오', beauty: '뷰티',
}
export const STOCK_IMAGES = {
  semiconductor: '반도체IT', finance: '금융산업', bio: '바이오헬스케어', beauty: '뷰티',
}
// 5판 게임에서만 거래하는 종목.
export const FIVE_BOARD_ONLY_STOCKS = ['beauty']

// 게임 진행 방식에 맞는 주식 종목 { 키: 이름 }. fiveBoard가 참이면 뷰티를 포함한 4종목,
// 아니면(6판) 기존 3종목이다. 컴포넌트에서는 5판 여부인 hideRealEstate를 그대로 넘긴다.
export function stockLabelsFor(fiveBoard) {
  if (fiveBoard) return STOCK_LABELS
  return Object.fromEntries(Object.entries(STOCK_LABELS).filter(([key]) => !FIVE_BOARD_ONLY_STOCKS.includes(key)))
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

// 게임 진행 방식(보드게임 판 수). 6판은 기존 방식, 5판은 부동산 없이 진행한다.
// 게임(수업/대회)마다 정해지며, 값이 없는 예전 데이터는 6판으로 본다.
export const BOARD_COUNTS = [6, 5]
export const DEFAULT_BOARD_COUNT = 6

export function toBoardCount(value) {
  return Number(value) === 5 ? 5 : DEFAULT_BOARD_COUNT
}

export function hasRealEstate(boardCount) {
  return toBoardCount(boardCount) !== 5
}
