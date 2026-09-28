// 관리자 화면에서 팀을 부르는 이름. 처음 설정한 방 이름이 있으면 그 이름을,
// 없으면(학생이 만든 방은 null, 관리자가 만든 방은 처음에 '') 목록 순서대로 "팀 N"을 쓴다.
export function teamDisplayName(room, index) {
  return room.title?.trim() || `팀 ${index + 1}`
}
