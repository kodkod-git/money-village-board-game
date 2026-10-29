// 학부모 "수업 결과 안내서"(example/머니빌리지_학부모안내문_6판_*.pdf)의 고정 문구·색상.
// 학생마다 바뀌는 값(이름·수업일·게임 결과·그룹)은 utils/parentGuide.js에서 계산한다.
// 이미지는 원본 PDF에서 그대로 뽑아낸 public/guide/* 를 쓴다.

export const GUIDE_ORGANIZATION = '코드코드영재학원'
export const GUIDE_STAGE = '3단계 · 6판'

export const GUIDE_CONCEPTS = [
  { booth: '노동', desc: '일한 만큼 벌고, 일과 쉼의 균형도 배워요.', items: [['기본급', 'labor-1'], ['상여금', 'labor-2'], ['성과급', 'labor-3'], ['과로', 'labor-4']] },
  { booth: '직업', desc: '경험이 소득을 올리고, 다시 일어서는 법도 배워요.', items: [['지식', 'job-1'], ['기술', 'job-2'], ['경험', 'job-3'], ['해고', 'job-4']] },
  { booth: '은행', desc: '기다릴수록 커지는 저축의 힘을 느껴요.', items: [['기본예금', 'bank-1'], ['자유예금', 'bank-2'], ['우대예금', 'bank-3']] },
  { booth: '주식', desc: '한 곳에 몰지 않고 나눠 담는 지혜를 배워요.', items: [['반도체', 'stock-1'], ['금융', 'stock-2'], ['바이오', 'stock-3'], ['산업위기', 'stock-4']] },
  { booth: '부동산', desc: '집도 자산! 지역이 쇠퇴하면 집값도 떨어져요.', items: [['단독주택', 'estate-1'], ['빌라', 'estate-2'], ['아파트', 'estate-3'], ['지역소멸', 'estate-4']] },
  { booth: '행운', desc: '확률 속 기회와 위험, 내 돈 지키는 법을 배워요.', items: [['개인행운', 'luck-1'], ['단체행운', 'luck-2'], ['상대행운', 'luck-3'], ['금융사기', 'luck-4']] },
]

// 성공열쇠 칩 순서(노동·직업·은행·주식·부동산·행운) — gameData의 BADGE_DISPLAY_ORDER와 같은 순서다.
export const GUIDE_KEY_ORDER = ['money', 'idea', 'trust', 'thinking', 'global', 'communication']

// 4분면 칸 배치: 열 = 내일 꿈꾸기 / 오늘 가꾸기, 행 = 모험 즐기기 / 안전 지키기.
export const GUIDE_GRID = [
  ['Blue Group', 'Red Group'],
  ['Orange Group', 'Green Group'],
]

// cell: 4분면 칸 배경, text: 그룹 이름·칩 글자, tint: 강점 칩 배경 — 원본 PDF의 색을 그대로 옮겼다.
export const GUIDE_GROUPS = {
  'Blue Group': { short: 'Blue', banner: '/guide/banner-blue.jpg', cell: '#2563eb', text: '#2563eb', tint: '#eef3fe', axes: '내일 꿈꾸기 · 모험 즐기기', strengths: ['도전성', '비전'] },
  'Red Group': { short: 'Red', banner: '/guide/banner-red.jpg', cell: '#e23b3b', text: '#d22f2f', tint: '#fdeeee', axes: '오늘 가꾸기 · 모험 즐기기', strengths: ['도전성', '실행력'] },
  'Orange Group': { short: 'Orange', banner: '/guide/banner-orange.jpg', cell: '#f07a12', text: '#e06a0c', tint: '#fff3e8', axes: '내일 꿈꾸기 · 안전 지키기', strengths: ['계획성', '안정감'] },
  'Green Group': { short: 'Green', banner: '/guide/banner-green.jpg', cell: '#2e8b47', text: '#2e8b47', tint: '#f1faf3', axes: '오늘 가꾸기 · 안전 지키기', strengths: ['집중력', '안정감'] },
}
