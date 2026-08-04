# 로비 시스템 개편 (2026-08-04)

> 원본 제안서: `proposal/20260804_changed_lobby_system.md`
> 범위: 미배정 수업 진입 경로 제거, 캐릭터 선택 이후 등장하는 화면을 "팀 만들기/참여 선택"에서 "해당 수업의 팀 목록 그리드(로비)"로 교체, 기존 "로비"라고 불리던 팀원 현황 화면을 "팀 화면"으로 명명 정리.
> 작업 브랜치: `feature/lobby-system-redesign`

---

## 1. 배경 및 현재 상태

현재 코드베이스의 명명이 제안서가 의도하는 개념과 어긋나 있다:

- `src/pages/Home.jsx` (route `/team`) — "팀 만들기 / 팀 참여" 선택 화면. 제안서가 "팀 화면(팀 만들기/팀 참여)"이라 부르는 화면이다.
- `src/pages/Lobby.jsx` (route `/lobby/:code`) — 팀원 현황과 자신의 자산(가격 설정 등)을 다루는 화면. 제안서가 "기존에 있던 팀 로비 화면"이라 부르며, 앞으로는 **"팀 화면"**으로 부르기로 한 화면이다.
- 제안서가 "로비 화면"이라 부르는, 수업에 생성된 모든 팀을 카드 그리드로 보여주는 화면은 **아직 존재하지 않는다**.

또한 현재는 두 가지 입장 경로가 있다:
1. 수업 배정: 관리자 QR(`/join?classId=X`) → 이름 입력 → 캐릭터 선택 → `Home.jsx`
2. 수업 미배정: 랜딩페이지 "참여하기" 버튼(`/join`, classId 없음) → ... → `Home.jsx` (서버의 `classId: null` 방은 관리자 화면에서 가상의 "미배정 수업"으로 묶여 조회됨)

이번 개편으로 경로 2번(미배정 수업 신규 진입)을 없애고, 경로 1번의 `Home.jsx` 자리를 새 "로비" 화면으로 교체한다.

## 2. 용어 및 파일/라우팅 변경

| 현재 | 역할 | 변경 후 |
|---|---|---|
| `src/pages/Home.jsx`, route `/team` | 팀 만들기/참여 선택 | **삭제**. 기능은 신규 로비 화면에 흡수 |
| `src/pages/Lobby.jsx`, `Lobby.module.css`, `Lobby.test.jsx`, route `/lobby/:code` | 팀원 현황 + 자산 관리 | **`Team.jsx`/`Team.module.css`/`Team.test.jsx`로 파일명·컴포넌트명 변경**, route `/team/:code` |
| *(신규)* | 수업의 팀 목록 그리드 + 팀 만들기 | `src/pages/Lobby.jsx`(신규 생성), route `/lobby` |
| `src/pages/IndividualPage.jsx`, route `/lobby/:code/individual` | 개인 자산 수정 | route만 `/team/:code/individual`로 변경 |

**참조 업데이트가 필요한 지점**
- `CharacterSelect.jsx`: `navigate(`/team?${params}`)` → `navigate(`/lobby?${params}`)` (params에 `classId`, `code`, `name`, `character`, `affiliation` 유지)
- `IndividualPage.jsx`: 6곳의 `navigate(`/lobby/${code}`)` → `navigate(`/team/${code}`)`
- `Team.jsx`(구 `Lobby.jsx`) 내부 `you-were-kicked` 소켓 핸들러: 현재 `navigate('/team')`(Home.jsx로 복귀)인데, Home.jsx가 사라지므로 팀에서 추방된 사용자는 해당 수업의 새 로비 화면(`/lobby?classId=...`)으로 돌아가야 한다. 추방 시점에 자신이 속했던 classId를 알아야 하므로, 서버 `you-were-kicked` 이벤트 payload에 `classId`를 실어 보내거나 클라이언트가 `sessionStorage`의 `player_profile`에 저장된 classId를 사용한다. → **`player_profile`에 `classId` 필드를 추가로 저장**하는 방식을 택한다(서버 프로토콜 변경 없이 클라이언트만으로 해결 가능).
- `App.jsx` 라우트 테이블 갱신

## 3. 신규 로비 화면 (`src/pages/Lobby.jsx`)

### 3.1 진입 및 파라미터

`/lobby?classId=X&name=..&affiliation=..&character=..` 형태로 진입한다(캐릭터 선택 화면에서 그대로 전달). 팀 QR/코드로 특정 팀에 직접 들어온 경우 `code` 파라미터도 함께 전달된다.

- `code`가 있으면: 그리드를 그리지 않고 기존 `Home.jsx`의 `initialCode` 동작과 동일하게 참가 확인 모달(`CodeModal`, 코드 미리 채움)을 띄우고, 확인 시 바로 `join-room` 소켓 이벤트를 emit해 `/team/:code`로 이동한다.
- `code`가 없으면: 아래 그리드 UI를 렌더링한다.

### 3.2 그리드 UI

2열 그리드. 각 카드에 표시할 정보:
- **방제목**: 팀 코드를 그대로 표시(신규 이름 필드 없음)
- **참여 캐릭터 이미지**: 참여 인원 수만큼 캐릭터 아이콘을 나열(빈 슬롯은 표시하지 않음)
- **방 상태 뱃지**: `server/rooms.js`의 `computeLiveRoomStatus`가 반환하는 `live`/`stale`/`abandoned`/`completed-but-unregistered`를 그대로 사용(관리자 대시보드와 동일한 기준)
- **인원수**: 뱃지와 별도로 `참여인원/4` 형태 텍스트로 표시(예: `3/4`)

카드 클릭 시 `/team/:code`로 이동 + `join-room` 소켓 이벤트(비호스트로) emit — 기존 `Home.jsx`의 `handleJoinByCode`와 동일한 흐름.

상단에는:
- **"팀 만들기" 버튼**: 기존 `Home.jsx`의 `handleCreate`를 그대로 이식(`POST /api/rooms` with `classId` → `join-room` as host → `/team/:code`)
- **"코드로 참가" 보조 버튼**: 기존 `CodeModal` 재사용(그리드에 아직 안 보이는 팀이거나 문자로 코드를 공유받은 경우 대비)

### 3.3 팀 목록 조회 (신규 공개 API)

기존 `/api/admin/rooms?classId=X`는 관리자 인증이 필요하고 민감 정보(플레이어 이름, gameState 등)까지 포함하므로 그대로 재사용하지 않는다. 대신 인증이 필요 없는 신규 엔드포인트를 추가한다:

```
GET /api/rooms?classId=X
```
응답: 해당 classId의 진행 중인 방 목록(완료·삭제된 방 제외)을 배열로 반환하며, 각 항목은 다음 필드만 포함한다.
```jsonc
{ "code": "A3F9C1", "status": "live", "playerCount": 3, "characters": ["fox", "owl", "cat"] }
```
플레이어 이름, `gameState`, `affiliation`, 가격 정보 등은 포함하지 않는다. `server/rooms.js`에 `listAllRooms()`를 `classId`로 필터링하는 헬퍼를 추가해 재사용한다.

### 3.4 실시간 갱신

같은 수업의 다른 학생이 팀을 만들거나 팀 인원이 바뀌면 로비 화면에 즉시 반영되어야 하므로 소켓 기반으로 처리한다.

- 로비 화면 마운트 시 클라이언트가 `watch-class-rooms` 이벤트를 `{ classId }`와 함께 emit → 서버가 해당 소켓을 `class:{classId}` 소켓 룸에 join시킨다.
- 언마운트 시 `unwatch-class-rooms` emit(또는 `disconnect`) → 소켓 룸에서 제거.
- 서버는 다음 시점에 `class:{classId}`로 `class-rooms-updated` 이벤트를 broadcast한다: 방 생성(`POST /api/rooms`), `join-room`/`leave-room`/`kick-player`/`disconnect`/재연결 등 인원 변화, 그리고 상태(`status`)가 바뀔 수 있는 모든 시점.
- 클라이언트는 이벤트를 받으면 `GET /api/rooms?classId=X`를 재호출해 목록을 새로고침한다(payload에 전체 목록을 실어 보내는 것도 가능하지만, 소켓 payload 크기를 줄이고 서버 로직을 단순하게 유지하기 위해 "갱신 신호만 보내고 클라이언트가 재조회"하는 방식을 택한다).

## 4. 미배정 수업 제거 범위

- **서버**: `createRoom({ classId })`가 `classId: null`을 받는 경로 자체(함수 시그니처)는 그대로 둔다 — 과거 데이터 호환 및 `server/classes.js`의 `UNASSIGNED_CLASS`/`hasClassAccess`의 `'unassigned'` 특수 처리도 유지한다. `AdminClassList.jsx`/`AdminClassDashboard.jsx`의 "미배정 수업" 조회·표시 기능(삭제 버튼 비활성화 등)도 그대로 유지해 과거에 미배정으로 생성된 팀 기록을 관리자가 계속 조회할 수 있게 한다.
- **클라이언트**: `classId` 없이 `/join`으로 진입하는 유일한 경로였던 **랜딩페이지의 "참여하기" 버튼을 제거**한다. 이로써 신규 미배정 방은 더 이상 생성되지 않는다(관리자 QR을 통한 `classId` 보유 진입만 가능).
- **랜딩페이지(`LandingPage.jsx`)**: "참여하기" 버튼 자리를 안내 문구로 대체한다. 예: "선생님이 보여주는 QR 코드를 스캔해주세요." "랭킹 보기" 버튼과 관리자 모드 진입(우상단 톱니 아이콘)은 그대로 유지.
  - 카메라로 QR을 직접 스캔하는 기능은 이번 스코프에서 다루지 않는다(제안서에서도 "나중엔" 목표로 언급됨). 추후 별도 제안/설계로 다룬다.

## 5. 테스트 영향

- `Home.test.jsx` — 파일 삭제(컴포넌트 삭제에 따름)
- `Lobby.test.jsx` → `Team.test.jsx`로 이동, import 경로 및 컴포넌트명만 변경(테스트 내용 자체는 라우팅 변경과 무관하므로 로직 변경 없음)
- `LandingPage.test.jsx` — "참여하기" 버튼 클릭 후 `/join` 이동을 검증하던 테스트가 있다면 제거/수정
- 신규: `Lobby.test.jsx`(새 그리드 화면) — 그리드 렌더링, 카드 클릭 시 이동, 팀 만들기, `code` 파라미터 직행 동작에 대한 테스트를 플랜 단계에서 작성
- `server/rooms.test.js` — `classId`로 필터링하는 신규 헬퍼에 대한 테스트 추가
- `server/index.js`에 대한 통합 테스트가 있다면 신규 `GET /api/rooms?classId=X` 엔드포인트 테스트 추가

## 6. 파일 변경 목록

**삭제**
- `src/pages/Home.jsx`, `src/pages/Home.jsx`에 대응하는 `Home.module.css`, `src/pages/Home.test.jsx`

**이름 변경**
- `src/pages/Lobby.jsx` → `src/pages/Team.jsx` (export 컴포넌트명 `Lobby` → `Team`)
- `src/pages/Lobby.module.css` → `src/pages/Team.module.css`
- `src/pages/Lobby.test.jsx` → `src/pages/Team.test.jsx`

**신규**
- `src/pages/Lobby.jsx` (팀 목록 그리드), `src/pages/Lobby.module.css`, `src/pages/Lobby.test.jsx`
- `src/components/RoomCard.jsx` + `.module.css` (그리드 카드 단위 컴포넌트, 필요 시)

**수정**
- `src/App.jsx` — 라우트 테이블 갱신(`/team` 제거, `/lobby`·`/team/:code`·`/team/:code/individual` 추가)
- `src/pages/CharacterSelect.jsx` — 이동 대상 경로 변경
- `src/pages/IndividualPage.jsx` — `navigate` 경로 6곳 변경
- `src/pages/LandingPage.jsx`, `LandingPage.module.css` — "참여하기" 버튼 제거, 안내 문구 추가
- `server/rooms.js` — classId 필터링 헬퍼(`listRoomsByClassId` 등) 추가
- `server/index.js` — `GET /api/rooms?classId=X` 엔드포인트 추가, 방 생성/입장/퇴장/추방/연결끊김 지점에 `class:{classId}` 소켓 broadcast 추가, `watch-class-rooms`/`unwatch-class-rooms` 소켓 핸들러 추가

## 7. 범위 밖 (Out of scope)

- 카메라 기반 QR 스캔 기능(랜딩페이지에서 직접 스캔) — 추후 별도 제안
- 방제목 커스텀 입력(팀 이름 직접 짓기) — 이번에는 팀 코드를 그대로 표시
- 미배정 수업 관련 기존 관리자 기능 변경 — 조회 전용으로 그대로 유지
