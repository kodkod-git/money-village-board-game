export const GUIDE_TEXT = '우리 아이와 가까운 모습을 선택해주세요.\n정답은 없습니다.'

export const NAME_LABEL = '우리 아이의 이름을 입력해주세요.'
export const NAME_PLACEHOLDER = '텍스트를 입력해 주세요.'

export const AGE_LABEL = '우리 아이의 나이를 입력해주세요.'
export const AGE_PLACEHOLDER = '숫자를 입력해 주세요.'

// key는 survey.efti_test_responses 컬럼명과 1:1 대응한다.
// axis: 'A'는 오늘(today)/내일(tomorrow), 'B'는 안전(safety)/모험(adventure).
export const QUESTIONS = [
  {
    key: 'q_pocket_money',
    axis: 'A',
    prompt: '우리 아이는 용돈을 받으면 어떤 편인가요?',
    options: [
      { text: '바로 쓰며 기뻐하는 편이에요.', polarity: 'today' },
      { text: '모았다가 뜻있게 쓰는 편이에요.', polarity: 'tomorrow' },
    ],
  },
  {
    key: 'q_new_activity',
    axis: 'B',
    prompt: '우리 아이는 새로운 활동을 할 때 어떤 편인가요?',
    options: [
      { text: '익숙한 방법이 편한 편이에요.', polarity: 'safety' },
      { text: '새로운 방법도 즐겁게 해보는 편이에요.', polarity: 'adventure' },
    ],
  },
  {
    key: 'q_want_something',
    axis: 'A',
    prompt: '우리 아이는 갖고 싶은 것이 생기면 어떤 편인가요?',
    options: [
      { text: '빨리 갖고 싶어 하는 편이에요.', polarity: 'today' },
      { text: '기다렸다가 더 잘 고르는 편이에요.', polarity: 'tomorrow' },
    ],
  },
  {
    key: 'q_hard_task',
    axis: 'B',
    prompt: '우리 아이는 쉽지 않아 보이는 일 앞에서 어떤 편인가요?',
    options: [
      { text: '잘할 수 있는 방법을 먼저 고르는 편이에요.', polarity: 'safety' },
      { text: '해보면서 배워보려는 편이에요.', polarity: 'adventure' },
    ],
  },
  {
    key: 'q_choosing_item',
    axis: 'A',
    prompt: '우리 아이는 물건을 고를 때 어떤 편인가요?',
    options: [
      { text: '지금 마음에 드는 것을 고르는 편이에요.', polarity: 'today' },
      { text: '오래 쓸 수 있는 것을 생각하는 편이에요.', polarity: 'tomorrow' },
    ],
  },
  {
    key: 'q_problem_solving',
    axis: 'B',
    prompt: '우리 아이는 문제를 해결할 때 어떤 편인가요?',
    options: [
      { text: '실수 없는 방법을 고르는 편이에요.', polarity: 'safety' },
      { text: '여러 방법을 시도해보는 편이에요.', polarity: 'adventure' },
    ],
  },
]

export const AXIS_LABELS = {
  axisTodayTomorrow: { left: '내일 꿈꾸기', leftValue: 'tomorrow', right: '오늘 가꾸기', rightValue: 'today' },
  axisSafetyAdventure: { left: '안전 지키기', leftValue: 'safety', right: '모험 즐기기', rightValue: 'adventure' },
}

export const NAVER_REVIEW_URL = 'https://m.place.naver.com/my/checkin'
export const ECONOMIC_TYPES_URL = 'https://m.blog.naver.com/kodkod79/224205817036'

export const GROUP_DETAIL_URLS = {
  'Orange Group': 'https://blog.naver.com/kodkod79/224229258314',
  'Blue Group': 'https://blog.naver.com/kodkod79/224229266592',
  'Green Group': 'https://blog.naver.com/kodkod79/224229264370',
  'Red Group': 'https://blog.naver.com/kodkod79/224229254511',
}

export const RESULT_GROUPS = {
  'Green Group': {
    color: '#4CAF7D',
    tagline: '오늘을 가꾸며 안정을 추구하는 그룹',
    description: '오늘의 일상을 소중히 가꾸고 편안하게 지켜가는 힘이 보여요',
    animals: ['판다', '캥거루', '고양이', '펭귄'],
    illustration: '/groups/green.png',
  },
  'Red Group': {
    color: '#F26D6D',
    tagline: '지금 이 순간, 도전을 즐기는 그룹',
    description: '지금 이 순간을 즐기며 용감하게 움직이는 힘이 보여요',
    animals: ['강아지', '여우', '원숭이', '호랑이'],
    illustration: '/groups/red.png',
  },
  'Orange Group': {
    color: '#F2A65A',
    tagline: '내일을 준비하며 안전을 지키는 그룹',
    description: '차분하게 준비하고 안정적으로 선택하는 힘이 보여요',
    animals: ['개미', '부엉이', '다람쥐', '수달'],
    illustration: '/groups/orange.png',
  },
  'Blue Group': {
    color: '#5B8DEF',
    tagline: '미래에 과감히 투자하는 그룹',
    description: '미래를 바라보며 과감하게 도전하는 힘이 보여요',
    animals: ['독수리', '돌고래', '사자', '코끼리'],
    illustration: '/groups/blue.png',
  },
}
