// 기존 "경제적 잠재력 테스트 보고서"(groups_report/*.png) 카드 4장의 문구를 그대로 옮긴 데이터.
// 이미지는 원본 보고서에서 잘라낸 public/groups_report/{color}-animal-N.png, {color}-person.jpg를 쓴다.
// hero는 public/groups/{color}.png(1.3~2.1MB)를 줄인 JPG다 — 원본을 그대로 인쇄하면 Chrome이 PDF를 못 만들고 멈춘다(orange).
// time: 'future'(내일 꿈꾸기) | 'present'(오늘 가꾸기), risk: 'averse'(안전 지키기) | 'tolerant'(모험 즐기기)
export const GROUP_REPORTS = {
  'Blue Group': {
    hero: '/groups_report/blue-hero.jpg',
    title: '내일을 꿈꾸며 모험을 즐기는 그룹',
    description: '앞으로의 가능성을 상상하고\n새로운 도전을 즐기는 힘이 보여요',
    time: 'future',
    risk: 'tolerant',
    animals: [
      { name: '독수리', code: 'FTSN', image: '/groups_report/blue-animal-1.png' },
      { name: '돌고래', code: 'FTEN', image: '/groups_report/blue-animal-2.png' },
      { name: '사자', code: 'FTSC', image: '/groups_report/blue-animal-3.png' },
      { name: '코끼리', code: 'FTEC', image: '/groups_report/blue-animal-4.png' },
    ],
    person: {
      name: '워런 버핏',
      description: '미래를 내다보는 안목과\n신중한 판단으로 성장한 투자자',
      code: 'FTSC',
      codeDetail: 'Future, Risk-Tolerant\nSelf-Orientation,\nConsidered',
      image: '/groups_report/blue-person.jpg',
    },
    traits: [
      '미래를 생각하며 꿈을 그리는 힘이 있어요.',
      '새로운 기회에 도전해보려는 용기가 보여요.',
      '변화를 두려워하기보다 가능성을 먼저 떠올려요.',
      '새로운 선택 앞에서 호기심과 추진력이 보여요.',
    ],
  },
  'Orange Group': {
    hero: '/groups_report/orange-hero.jpg',
    title: '내일을 준비하며 안전을 지키는 그룹',
    description: '차분하게 준비하고\n안정적으로 선택하는 힘이 보여요',
    time: 'future',
    risk: 'averse',
    animals: [
      { name: '개미', code: 'FAEN', image: '/groups_report/orange-animal-1.png' },
      { name: '부엉이', code: 'FASC', image: '/groups_report/orange-animal-2.png' },
      { name: '다람쥐', code: 'FASN', image: '/groups_report/orange-animal-3.png' },
      { name: '수달', code: 'FAEC', image: '/groups_report/orange-animal-4.png' },
    ],
    person: {
      name: '앤드류 카네기',
      description: '가난 속에서도 미래를 준비하고\n배움과 노력으로 성장한 기업가',
      code: 'FTSC',
      codeDetail: 'Future, Risk-Averse\nEmpathetic-Orientaion,\nNimble',
      image: '/groups_report/orange-person.jpg',
    },
    traits: [
      '차분하게 준비하는 힘이 있어요.',
      '안정적으로 선택하는 습관이 보여요.',
      '약속과 기준을 잘 지키는 편이에요.',
      '서두르기보다 생각하고 움직이는 힘이 있어요.',
    ],
  },
  'Green Group': {
    hero: '/groups_report/green-hero.jpg',
    title: '오늘을 가꾸며 안전을 지키는 그룹',
    description: '지금의 일상을 차분히 돌보고\n안정적으로 준비하는 힘이 보여요',
    time: 'present',
    risk: 'averse',
    animals: [
      { name: '캥거루', code: 'PAEC', image: '/groups_report/green-animal-1.png' },
      { name: '판다', code: 'PASC', image: '/groups_report/green-animal-2.png' },
      { name: '고양이', code: 'PASN', image: '/groups_report/green-animal-3.png' },
      { name: '펭귄', code: 'PAEN', image: '/groups_report/green-animal-4.png' },
    ],
    person: {
      name: '밀튼 허시',
      description: '사람들의 삶을 세심하게 돌보고\n안정적인 공동체를 만들어간 기업가',
      code: 'PAEN',
      codeDetail: 'Present, Risk-Averse\nEmpathetic-Orientaion,\nNimble',
      image: '/groups_report/green-person.jpg',
    },
    traits: [
      '지금 해야 할 일을 차분하게 챙기는 힘이 있어요.',
      '안전하고 안정적인 선택을 중요하게 생각해요.',
      '주변 사람을 배려하고 도와주려는 마음이 보여요.',
      '서두르기보다 꼼꼼하게 살피고 신중하게 움직여요.',
    ],
  },
  'Red Group': {
    hero: '/groups_report/red-hero.jpg',
    title: '오늘을 가꾸며 모험을 즐기는 그룹',
    description: '지금 이 순간에 집중하고\n새로운 도전을 즐기는 힘이 보여요',
    time: 'present',
    risk: 'tolerant',
    animals: [
      { name: '원숭이', code: 'PTSN', image: '/groups_report/red-animal-1.png' },
      { name: '여우', code: 'PTSC', image: '/groups_report/red-animal-2.png' },
      { name: '강아지', code: 'PTEN', image: '/groups_report/red-animal-3.png' },
      { name: '호랑이', code: 'PTEC', image: '/groups_report/red-animal-4.png' },
    ],
    person: {
      name: '월트 디즈니',
      description: '새로운 아이디어를 즐겁게 실행하고\n도전으로 현실을 만들어낸 창작자',
      code: 'PTSN',
      codeDetail: 'Present, Risk-Tolerant\nSelf-Orientation,\nNimble',
      image: '/groups_report/red-person.jpg',
    },
    traits: [
      '지금 하고 싶은 일을 에너지 있게 시작하는 힘이 있어요.',
      '새로운 활동과 도전을 즐기려는 용기가 보여요.',
      '생각한 것을 행동으로 빠르게 옮기는 추진력이 있어요.',
      '즐거움과 호기심을 바탕으로 적극적으로 움직여요.',
    ],
  },
}

export const TIME_OPTIONS = [
  { value: 'future', label: 'Future', sub: '내일 꿈꾸기' },
  { value: 'present', label: 'Present', sub: '오늘 가꾸기' },
]

export const RISK_OPTIONS = [
  { value: 'averse', label: 'Risk-Averse', sub: '안전 지키기' },
  { value: 'tolerant', label: 'Risk-Tolerant', sub: '모험 즐기기' },
]
