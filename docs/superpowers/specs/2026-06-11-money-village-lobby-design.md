# Money Village 보드게임 웹앱 — 팀 구성 & 로비 설계 스펙

**날짜**: 2026-06-11  
**범위**: 팀 생성/참가 + 로비 화면 (1차 구현)

---

## 1. 프로젝트 개요

보드게임(Money Village) 진행 중 플레이어들이 사용하는 웹 어플리케이션이다. 최대 4명이 한 팀을 이루며, 동시에 최대 5개 팀(20명)이 병렬로 게임을 진행한다. 별도 진행자(퍼실리테이터) 1명이 전체 게임을 관제하나 진행자 UI는 1차 구현 범위에 포함하지 않는다.

---

## 2. 기술 스택

| 구분 | 선택 | 비고 |
|------|------|------|
| 프론트엔드 | React + JavaScript (Vite) | React Router로 화면 전환 |
| 백엔드 | Node.js + Express | REST API + Socket.io 실시간 |
| 실시간 통신 | Socket.io | 팀원 입장/퇴장 브로드캐스트 |
| 배포 | Railway | Express 단일 서비스 (React 빌드를 정적 파일로 서빙) |
| 세션 | 인메모리 (Map) | 1차. DB 연결은 이후 추가 예정 |
| QR 코드 | qrcode (npm) | 참가 URL 인코딩 |

**DB 확장성**: Express 구조를 유지하므로 추후 Railway PostgreSQL + Prisma 연결 시 인메모리 Map만 교체하면 된다.

---

## 3. 구현 범위 (1차)

- [x] 홈 화면: 팀 만들기 / 팀 참가
- [x] 팀 만들기: 방 코드 생성 → 로비 입장 (방장)
- [x] 팀 참가 — 코드 입력
- [x] 팀 참가 — QR 코드 스캔
- [x] 이름 입력 화면
- [x] 캐릭터 선택 화면 (16종)
- [x] 로비 화면: 실시간 팀원 현황

---

## 4. 화면 구성 & UX 흐름

### 4-1. 홈 화면
- 버튼 2개: **팀 만들기** / **팀 참가**
- 게임 타이틀 표시

### 4-2. 팀 참가 흐름

```
홈
 ├─ [팀 만들기] → 방 코드 생성 → 이름 입력 → 캐릭터 선택 → 로비(방장, 일반 플레이어와 동일 플로우)
 └─ [팀 참가]
       ├─ 코드 입력 모달 → (이름 입력) → (캐릭터 선택) → 로비(참가자)
       └─ QR 스캔 (URL 파라미터로 코드 자동 주입) → (이름 입력) → (캐릭터 선택) → 로비(참가자)
```

### 4-3. 이름 입력 화면
- 텍스트 입력 필드 1개
- [다음 →] 버튼으로 캐릭터 선택으로 이동

### 4-4. 캐릭터 선택 화면
- 4×4 그리드, `efti/` 폴더의 16개 이미지 전체 표시
- 선택된 캐릭터: 컬러 이미지 + 파란 테두리 + 체크 뱃지
- 미선택: 반투명 처리
- 이미 다른 플레이어가 선택한 캐릭터: 잠금 표시 (선택 불가)
- [완료 → 로비 입장] 버튼

### 4-5. 로비 화면
- 상단: 팀 코드 표시 + 📋 복사 버튼 / 📱 QR 공유 버튼 / 팀 나가기 버튼
- 참가 인원 표시: `N / 4 명 참가`
- 캐릭터 4개가 배경 위에 나란히 서있는 형태
  - 참가 완료: 컬러 이미지 + 이름 뱃지 (파란 테두리)
  - 대기 중: 흑백 + 반투명 + 점선 뱃지
- 실시간 업데이트: 새 플레이어 입장 시 즉시 반영 (Socket.io)

---

## 5. 데이터 모델 (인메모리)

```js
// 서버 인메모리 Map
rooms = {
  "ABC123": {
    code: "ABC123",
    createdAt: Date,
    players: [
      {
        socketId: string,
        name: string,
        character: string,  // efti 파일명 (예: "ptsc")
        isHost: boolean,
        joinedAt: Date
      }
    ]
  }
}
```

---

## 6. API 엔드포인트 (REST)

| Method | Path | 설명 |
|--------|------|------|
| POST | `/api/rooms` | 방 생성, 6자리 코드 반환 |
| GET | `/api/rooms/:code` | 방 정보 조회 (입장 전 유효성 확인) |
| GET | `/api/rooms/:code/qr` | QR 코드 이미지 반환 |

---

## 7. Socket.io 이벤트

| 이벤트 | 방향 | 설명 |
|--------|------|------|
| `join-room` | Client → Server | 방 코드 + 이름 + 캐릭터 전송 |
| `room-updated` | Server → All in room | 현재 플레이어 목록 전체 브로드캐스트 |
| `leave-room` | Client → Server | 퇴장 |
| `character-locked` | Server → All in room | 특정 캐릭터 선택됨 알림 (선택 잠금) |

---

## 8. 컴포넌트 구조

```
src/
├── pages/
│   ├── Home.jsx          # 홈 화면
│   ├── NameInput.jsx     # 이름 입력
│   ├── CharacterSelect.jsx  # 캐릭터 선택
│   └── Lobby.jsx         # 로비
├── components/
│   ├── CharacterCard.jsx # 캐릭터 카드 (선택/잠금 상태 포함)
│   ├── PlayerSlot.jsx    # 로비 캐릭터 슬롯
│   ├── CodeModal.jsx     # 코드 입력 모달
│   └── QRModal.jsx       # QR 코드 모달
├── hooks/
│   └── useSocket.js      # Socket.io 연결 훅
├── assets/
│   └── characters/       # efti/ 이미지 복사
└── App.jsx               # React Router 설정
```

---

## 9. 캐릭터 이미지 규칙

`efti/` 폴더의 파일명 규칙: `[p/f][t/a][s/e][c/n].png`

- 16개 파일 전체를 선택 가능 캐릭터로 사용 (c/n 구분 없이 모두 독립 캐릭터로 취급)
- 선택 상태는 이미지 교체 없이 CSS만으로 구분:
  - 선택됨: 파란 테두리 + 체크 뱃지, opacity 100%
  - 미선택: 회색 테두리, opacity 70%
  - 잠금(다른 플레이어 선택): 회색 테두리 + 🔒 뱃지, `pointer-events: none`

---

## 10. 미결 사항 (향후 구현)

- 진행자(퍼실리테이터) 관제 화면
- DB 연결 (Railway PostgreSQL + Prisma)
- 게임 진행 화면 (보드게임 본 게임 UI)
- 방 만료 처리 (일정 시간 비활성 시 자동 삭제)
