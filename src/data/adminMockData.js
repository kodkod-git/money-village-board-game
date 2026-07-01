export const ADMIN_MOCK_PRICES = {
  stocks: { semiconductor: 2000, finance: 2000, industrial: 2000, auto: 2000, bio: 2000, content: 2000 },
  realEstate: { gaon: 10000, nuri: 10000, dami: 10000, maru: 10000, chorong: 10000, hani: 10000 },
}

function emptyGameState() {
  return {
    cash: null,
    job: null,
    stocks: { semiconductor: 0, finance: 0, industrial: 0, auto: 0, bio: 0, content: 0 },
    realEstate: { gaon: 0, nuri: 0, dami: 0, maru: 0, chorong: 0, hani: 0 },
    badges: [false, false, false, false, false, false],
    isCompleted: false,
  }
}

export const ADMIN_MOCK_ROOMS = [
  {
    code: 'AB1234',
    registered: false,
    prices: ADMIN_MOCK_PRICES,
    players: [],
  },
  {
    code: 'CD5678',
    registered: false,
    prices: ADMIN_MOCK_PRICES,
    players: [
      {
        playerUuid: 'mock-1', name: '홍길동', affiliation: '서울중', character: 'Adventurer-강아지', isHost: true,
        gameState: { ...emptyGameState(), job: 'a', cash: 15000 },
      },
      {
        playerUuid: 'mock-2', name: '김철수', affiliation: '서울중', character: 'Guardian-고양이', isHost: false,
        gameState: emptyGameState(),
      },
    ],
  },
  {
    code: 'EF9012',
    registered: false,
    prices: ADMIN_MOCK_PRICES,
    players: [
      {
        playerUuid: 'mock-3', name: '이영희', affiliation: '한빛중', character: 'Innovator-사자', isHost: true,
        gameState: { ...emptyGameState(), job: 'b', cash: 8000 },
      },
      {
        playerUuid: 'mock-4', name: '박민수', affiliation: '한빛중', character: 'Planner-수달', isHost: false,
        gameState: { ...emptyGameState(), job: 'c', cash: 12000 },
      },
      {
        playerUuid: 'mock-5', name: '정다은', affiliation: '한빛중', character: 'Guardian-펭귄', isHost: false,
        gameState: {
          ...emptyGameState(), job: 'd',
          stocks: { semiconductor: 1, finance: 0, industrial: 0, auto: 0, bio: 0, content: 0 },
        },
      },
      {
        playerUuid: 'mock-6', name: '최유진', affiliation: '한빛중', character: 'Adventurer-호랑이', isHost: false,
        gameState: emptyGameState(),
      },
    ],
  },
  {
    code: 'GH3456',
    registered: true,
    prices: ADMIN_MOCK_PRICES,
    players: [
      {
        playerUuid: 'mock-7', name: '오세훈', affiliation: '미래고', character: 'Innovator-돌고래', isHost: true,
        gameState: {
          job: 'a', cash: 32000,
          stocks: { semiconductor: 2, finance: 1, industrial: 0, auto: 0, bio: 0, content: 0 },
          realEstate: { gaon: 1, nuri: 0, dami: 0, maru: 0, chorong: 0, hani: 0 },
          badges: [true, true, true, false, false, false],
          isCompleted: true,
        },
      },
      {
        playerUuid: 'mock-8', name: '한소희', affiliation: '미래고', character: 'Planner-개미', isHost: false,
        gameState: {
          job: 'e', cash: 18000,
          stocks: { semiconductor: 0, finance: 0, industrial: 3, auto: 0, bio: 0, content: 0 },
          realEstate: { gaon: 0, nuri: 1, dami: 0, maru: 0, chorong: 0, hani: 0 },
          badges: [false, true, false, true, false, false],
          isCompleted: true,
        },
      },
      {
        playerUuid: 'mock-9', name: '장하늘', affiliation: '미래고', character: 'Guardian-캥거루', isHost: false,
        gameState: {
          job: 'f', cash: 25000,
          stocks: { semiconductor: 0, finance: 0, industrial: 0, auto: 2, bio: 0, content: 0 },
          realEstate: { gaon: 0, nuri: 0, dami: 1, maru: 0, chorong: 0, hani: 0 },
          badges: [true, false, false, false, true, false],
          isCompleted: true,
        },
      },
      {
        playerUuid: 'mock-10', name: '윤서준', affiliation: '미래고', character: 'Adventurer-원숭이', isHost: false,
        gameState: {
          job: 'b', cash: 9000,
          stocks: { semiconductor: 1, finance: 0, industrial: 0, auto: 0, bio: 1, content: 0 },
          realEstate: { gaon: 0, nuri: 0, dami: 0, maru: 0, chorong: 1, hani: 0 },
          badges: [false, false, true, false, false, true],
          isCompleted: true,
        },
      },
    ],
  },
]
