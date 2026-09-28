// 경제적 성향 시너지 테스트. 시민권(QR)마다 /synergy/:citizenType 링크가 하나씩 있고,
// 테스트를 푼 사람의 유형과 시민권자 유형의 시너지를 보여준다.
// 원본: 스모어 "경제 잠재력 테스트 FASN" (https://smore.im/quiz/NOHUAfFNc3)

export const MY_NAME_TITLE = '나의 닉네임을\n입력해주세요'
export const CITIZEN_NAME_TITLE = '시민권자(친구)의 닉네임을\n입력해주세요'
export const NAME_SUBTITLE = '결과 화면에 표시됩니다'
export const NAME_LABEL = '닉네임'
export const MY_NAME_PLACEHOLDER = '예: 머니왕'
export const CITIZEN_NAME_PLACEHOLDER = '예: 경제박사'

export const QUESTION_SUBTITLE = '나와 가까운 모습을 골라주세요'

// letter는 유형 코드에서 axis 번째 자리에 들어가는 글자다.
export const SYNERGY_QUESTIONS = [
  {
    key: 'q_pocket_money',
    axis: 0,
    prompt: '용돈을 받으면\n나는?',
    options: [
      { text: '지금 필요한 것부터 바로 산다.', letter: 'P' },
      { text: '앞으로의 일을 생각해 일부를 남겨 둔다.', letter: 'F' },
    ],
  },
  {
    key: 'q_investment',
    axis: 1,
    prompt: '게임에서 투자 선택을 할 때\n나는?',
    options: [
      { text: '더 큰 결과가 날 수 있는 선택을 시도한다.', letter: 'T' },
      { text: '안정적 결과를 얻을 수 있는 선택을 한다.', letter: 'A' },
    ],
  },
  {
    key: 'q_group_buying',
    axis: 2,
    prompt: '친구들과 함께 물건을 사기로 했을 때\n나는?',
    options: [
      { text: '내가 생각한 좋은 물건을 먼저 말한다.', letter: 'S' },
      { text: '친구들이 원하는 물건을 먼저 들어본다.', letter: 'E' },
    ],
  },
  {
    key: 'q_price_compare',
    axis: 3,
    prompt: '가격을 비교해 물건을 고를 때\n나는?',
    options: [
      { text: '빠르게 선택한 뒤 필요하면 조정한다.', letter: 'N' },
      { text: '기준을 비교해 보고 결정한다.', letter: 'C' },
    ],
  },
]

// 닉네임 2단계 + 질문 개수.
export const TOTAL_SYNERGY_STEPS = SYNERGY_QUESTIONS.length + 2

// 결과 화면 "핵심 가치" 칩. 유형 코드의 axis 번째 글자가 left/right 중 어느 쪽인지로 강조한다.
export const SYNERGY_AXES = [
  { left: '내일 꿈꾸기', leftLetter: 'F', right: '오늘 가꾸기', rightLetter: 'P' },
  { left: '안전 지키기', leftLetter: 'A', right: '모험 즐기기', rightLetter: 'T' },
  { left: '친구 도와주기', leftLetter: 'E', right: '나를 아껴주기', rightLetter: 'S' },
  { left: '민첩한 결정', leftLetter: 'N', right: '신중한 결정', rightLetter: 'C' },
]

// 앞 두 글자(오늘/내일 × 모험/안전)가 우리 아이 경제 잠재력 테스트의 4개 그룹과 같다.
// 색상은 quizData.RESULT_GROUPS를 그대로 쓴다.
export const TYPE_GROUP = {
  PA: 'Green Group',
  PT: 'Red Group',
  FA: 'Orange Group',
  FT: 'Blue Group',
}

export const SYNERGY_TYPES = {
  PTSN: { title: '민첩한 실행형 리더', animal: '원숭이', detailUrl: 'https://m.blog.naver.com/kodkod79/224059317015' },
  PTSC: { title: '균형 잡힌 조율형 리더', animal: '여우', detailUrl: 'https://m.blog.naver.com/kodkod79/224059317977' },
  PTEN: { title: '따뜻한 공동체형 리더', animal: '강아지', detailUrl: 'https://m.blog.naver.com/kodkod79/224059316228' },
  PTEC: { title: '신중한 실행형 리더', animal: '호랑이', detailUrl: 'https://m.blog.naver.com/kodkod79/224059317665' },
  PASN: { title: '민첩한 현장형 리더', animal: '고양이', detailUrl: 'https://m.blog.naver.com/kodkod79/224059315773' },
  PASC: { title: '책임감 있는 운영형 리더', animal: '판다', detailUrl: 'https://m.blog.naver.com/kodkod79/224059314176' },
  PAEN: { title: '따뜻한 실천형 리더', animal: '펭귄', detailUrl: 'https://m.blog.naver.com/kodkod79/224059314589' },
  PAEC: { title: '신뢰받는 협력형 리더', animal: '캥거루', detailUrl: 'https://m.blog.naver.com/kodkod79/224059313015' },
  FTSN: { title: '도전적인 탐험형 리더', animal: '독수리', detailUrl: 'https://m.blog.naver.com/kodkod79/224059316655' },
  FTSC: { title: '전략적 분석형 리더', animal: '사자', detailUrl: 'https://m.blog.naver.com/kodkod79/224059315042' },
  FTEN: { title: '위기 해결형 리더', animal: '돌고래', detailUrl: 'https://m.blog.naver.com/kodkod79/224059317325' },
  FTEC: { title: '균형 잡힌 판단형 리더', animal: '코끼리', detailUrl: 'https://m.blog.naver.com/kodkod79/224059315423' },
  FASN: { title: '균형 잡힌 성장형 리더', animal: '다람쥐', detailUrl: 'https://m.blog.naver.com/kodkod79/224059311739' },
  FASC: { title: '신중한 전략형 리더', animal: '부엉이', detailUrl: 'https://m.blog.naver.com/kodkod79/224059312362' },
  FAEN: { title: '따뜻한 실행형 리더', animal: '개미', detailUrl: 'https://m.blog.naver.com/kodkod79/224059311096' },
  FAEC: { title: '차분한 돌봄형 리더', animal: '수달', detailUrl: 'https://m.blog.naver.com/kodkod79/224059313728' },
}

export const ACADEMY_INQUIRY_URL = 'https://map.naver.com/p/entry/place/11832878'
