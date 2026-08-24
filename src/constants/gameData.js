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
  communication: '의사소통 및 협상능력', global: '글로벌경제이해력',
  idea: '문제해결능력', money: '재정관리능력',
  thinking: '기업가정신', trust: '신용과 신뢰',
}
// Figma 디자인(성공카드 수정 화면)과 동일한 표시 순서.
export const BADGE_DISPLAY_ORDER = ['money', 'communication', 'global', 'idea', 'thinking', 'trust']

export const REAL_ESTATE_LABELS = {
  gaon: '단독 가온개미', nuri: '단독 누리고양이', dami: '다세대 다미원숭이',
  maru: '다세대 마루수리', chorong: '아파트 초롱부엉이', hani: '아파트 하늬여우',
}
export const ESTATE_IMAGES = {
  gaon: '가온개미', nuri: '누리고양이', dami: '다미원숭이',
  maru: '마루수리', chorong: '초롱부엉이', hani: '하니여우',
}
export const ESTATE_PRICES = {
  gaon: '2만원', nuri: '2만원', dami: '7만원',
  maru: '7만원', chorong: '10만원', hani: '10만원',
}

export const STOCK_LABELS = {
  semiconductor: '반도체·IT', finance: '금융', industrial: '산업재·기계',
  auto: '자동차·쇼핑', bio: '바이오·헬스케어', content: '콘텐츠·플랫폼',
}
export const STOCK_IMAGES = {
  semiconductor: '반도체IT', finance: '금융산업', industrial: '산업재기계',
  auto: '소재화학', bio: '바이오헬스케어', content: '콘텐츠소비재',
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
