// 트로피 탭의 낙관적 갱신: 서버 응답 전에 화면의 { participants, clans }에서 참여자 한 명을 옮긴다.
// toClanId가 null이면 참여자 블럭으로 돌려보낸다.
export function moveInView(view, resultId, toClanId) {
  const member = [...view.participants, ...view.clans.flatMap(c => c.members)]
    .find(m => m.resultId === resultId)
  if (!member) return view
  const without = list => list.filter(m => m.resultId !== resultId)
  return {
    participants: toClanId === null ? [...without(view.participants), member] : without(view.participants),
    clans: view.clans.map(clan => ({
      ...clan,
      members: clan.id === toClanId ? [...without(clan.members), member] : without(clan.members),
    })),
  }
}
