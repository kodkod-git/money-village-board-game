// needsClass: 수업을 고르기 전에는 누를 수 없다. mobile: false: 모바일 탭바에서 숨긴다.
export const NAV_ITEMS = [
  { key: 'classes', label: '수업 목록', icon: '/icons/IconClasses.png' },
  { key: 'team-status', label: '팀 현황', icon: '/icons/IconTeams.png', needsClass: true },
  { key: 'ranking', label: '랭킹 보기', icon: '/icons/IconRankings.png', needsClass: true },
  // 설문 응답 원본을 다루므로 마스터 관리자에게만 보인다.
  { key: 'responses', label: '테스트 분석', icon: '/icons/assignment.png', superOnly: true, mobile: false },
  // 모든 수업의 참가자 결과를 보여 주므로 마찬가지로 마스터 관리자 전용이다.
  { key: 'all-results', label: '게임 분석', icon: '/icons/IconGame.svg', superOnly: true, mobile: false },
  { key: 'settings', label: '설정', icon: '/icons/IconSettings.png' },
]
