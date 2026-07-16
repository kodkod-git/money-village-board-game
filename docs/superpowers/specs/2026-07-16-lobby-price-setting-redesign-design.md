# 로비 버튼 재배치 & 가격 설정 팝업 재구현 (2026-07-16)

> 원본 제안서: `proposal/20260715_modified_details.md`
> 참고 디자인: `design/exit_to_app.png`, `design/팀 만들기.png`, `design/가격 설정-팝업.png`, `design/가격 설정-입력.png`
> 범위: `Lobby.jsx`의 액션 버튼 배치, `PriceSettingModal`을 목업과 동일한 탭+리스트+`NumberInputModal` 방식으로 재구현.

---

## 0. 이미 처리됨

원본 제안서의 항목 1(캐릭터 선택 테두리 회색→검정 통일)과 항목 4(현금/가격 입력 팝업에 좌우 여백 추가)는 이 설계와 별개로 이미 구현·커밋 완료했다(`266907b`). 이 문서는 항목 2(로비 버튼 재배치)와 항목 3(가격 설정 팝업 재구현)만 다룬다.

## 1. 로비 버튼 재배치

### 1.1 "팀 나가기"

- 상단의 텍스트 링크(`.leaveBtn`)를 제거하고, 하단 액션바 왼쪽에 아이콘 전용 정사각형 버튼으로 이동한다. 아이콘은 `design/exit_to_app.png`를 `public/icons/exit_to_app.png`로 복사해 사용한다(텍스트 라벨 없음, `aria-label="팀 나가기"`로 접근성 유지).
- **호스트가 아닌 일반 팀원도 팀을 나갈 수 있어야 한다.** 따라서 이 버튼은 `!readOnly`일 때 항상 렌더링하고(기존 `.leaveBtn`과 동일 조건), "결과 등록" 버튼만 기존처럼 `canManageRoom`(호스트 또는 관전 모드)일 때만 함께 렌더링한다. 즉 일반 팀원은 하단 바에 나가기 버튼만 단독으로 보인다.

### 1.2 "가격 설정"

- 하단 액션바에서 빠져 우측 상단(기존 "팀 나가기" 텍스트가 있던 자리)으로 이동한다. 흰 배경 + 검정 테두리의 pill 버튼, ⚙️ 이모지 + "가격 설정" 텍스트. `canManageRoom`일 때만 보임(기존과 동일한 접근 조건 유지).

### 1.3 "결과 등록"

- 활성화 상태일 때 검정 배경이 되어야 한다. 현재 `.actionBtn`의 기본 배경이 이미 `var(--ink)`(검정)이고, `.submitBtn { background: var(--purple); }`가 이를 보라색으로 덮어쓰고 있을 뿐이다 — 이 오버라이드만 제거하면 된다. `:disabled` 스타일(회색 배경)은 기존 그대로 유지.

## 2. 가격 설정 팝업 재구현

### 2.1 배경

현재 `PriceSettingModal`은 "카테고리 선택(주식/부동산 큰 카드 2개) → 수량형 +/- 컨트롤로 가격 조정 → 확인" 2단계 흐름이다. `design/가격 설정-팝업.png`, `design/가격 설정-입력.png`는 이를 "하나의 화면에서 탭으로 카테고리 전환 + 각 가격을 눌러 `NumberInputModal`로 직접 입력"하는 방식으로 완전히 대체한다.

### 2.2 구조

`PriceSettingModal`을 아래 구조로 전면 재작성한다(props는 기존과 동일: `prices`, `onConfirm`, `onClose`):

- **헤더**: "‹ 뒤로"(클릭 시 `onClose`, 저장 없이 닫힘) / "가격 설정" 제목(중앙) / "초기화" 버튼(우측)
- **탭**: "주식" / "부동산" — 밑줄 스타일(활성 탭: 검정 텍스트 + 검정 밑줄, 비활성: 회색 텍스트). 로컬 `category` state(`'stocks' | 'realEstate'`)로 전환하며, 두 탭 모두 하나의 `tempPrices`(`{ stocks, realEstate }`) state를 공유한다 — 탭 전환은 보여지는 목록만 바꿀 뿐 데이터를 분리하지 않는다.
- **초기화 버튼**: 클릭 시 **현재 활성 탭의 카테고리만** `DEFAULT_PRICES`의 해당 카테고리 값으로 되돌린다(다른 탭 값은 유지).
- **목록**: 활성 카테고리의 6개 항목을 각각 한 행으로: 아이콘(기존 `/badges/stock/${STOCK_IMAGES[key]}.png` / `/badges/estate/${ESTATE_IMAGES[key]}.png` 재사용 — `IndividualPage.jsx`에 있는 `STOCK_IMAGES`/`ESTATE_IMAGES` 매핑을 `Lobby.jsx`에도 동일하게 추가) + 라벨/"단위: 원" + 가격 pill 버튼(예: "75,000 원 ›").
- **가격 pill 클릭**: 이미 구현되어 있는 `NumberInputModal`을 그대로 사용해 연다 — `title={해당 항목 라벨}`, `initialValue={현재 가격}`, `unit="원"`. 확인 시 `tempPrices`의 해당 항목만 갱신하고 팝업을 닫는다. 이 로컬 편집 팝업은 바깥 가격 설정 팝업과 별도 컴포넌트 트리(형제)로 렌더링해 오버레이 클릭 처리가 서로 간섭하지 않게 한다.
- **하단 "확인하기" 버튼**: `onConfirm(tempPrices)`를 호출한다 — 주식/부동산 전체가 함께 저장된다(기존 `handlePriceConfirm`과 시그니처 동일, 호출부 변경 없음).

### 2.3 죽은 CSS 정리

기존 2단계 플로우 전용이었던 `.categoryGrid`/`.categoryCard`/`.categoryIcon`/`.categoryLabel`/`.quantityList`/`.quantityItem`/`.quantityLabel`/`.quantityControls`/`.qtyBtn`/`.priceDisplay`는 제거한다. `ConfirmModal`(결과 등록 확인 팝업)이 계속 사용하는 `.overlay`/`.popup`/`.popupTitle`/`.popupActions`/`.cancelBtn`/`.confirmBtn`/`.confirmText`는 그대로 둔다.

### 2.4 영향 확인

`Lobby.test.jsx`는 (1) readOnly 모드에서 "팀 나가기" `aria-label`이 없는지, (2) readOnly 모드에서 "가격 설정"/"결과 등록" 텍스트가 존재하는지만 확인한다 — 두 조건 모두 이 재설계로 그대로 만족된다(회귀 없음). 가격 설정 팝업 내부 플로우(탭 전환, 항목 편집)에 대한 기존 테스트는 없다.

## 3. 범위 밖 (Out of scope)

- 주식/부동산 가격 범위(min/max, step 단위) 변경 — 기존 `adjust()` 로직의 `min`/`max`/`stepAmt` 값은 이번 재구현에서 사용되지 않으므로(이제 `NumberInputModal`이 자유 입력을 받음) 그대로 제거하고, 새로운 범위 제한은 두지 않는다(기존 동작과 달리 상한/하한 검증 없음 — 현금 입력과 동일하게 자유 입력).
- `Lobby.test.jsx`에 새 테스트 추가 — 이번 재구현은 기존 테스트 통과만 확인하고, 가격 설정 팝업 내부 동작에 대한 신규 테스트 작성은 계획에 포함하되 필수 요구사항은 아니다(플랜 작성 시 결정).

## 4. 파일 변경 목록

**신규**
- `public/icons/exit_to_app.png` (에셋 복사, `design/exit_to_app.png`에서)

**수정**
- `src/pages/Lobby.jsx` — 상단 "팀 나가기" 텍스트 버튼 제거, 하단 액션바에 아이콘 버튼 추가, 우측 상단에 "가격 설정" pill 버튼 추가, `PriceSettingModal` 전면 재작성, `STOCK_IMAGES`/`ESTATE_IMAGES` 상수 추가, `NumberInputModal` import 추가
- `src/pages/Lobby.module.css` — `.leaveBtn`/`.leaveIcon` 제거, `.exitBtn`/`.exitIcon`/`.priceSettingBtn` 신규, `.actionBtn`에서 `.submitBtn` 보라색 오버라이드 제거, 가격 설정 팝업 전용 신규 클래스(`.priceModal`, `.priceModalHeader`, `.priceBackBtn`, `.priceModalTitle`, `.priceResetBtn`, `.priceTabs`, `.priceTab`, `.priceTabActive`, `.priceList`, `.priceRow`, `.priceIcon`, `.priceInfo`, `.priceLabel`, `.priceUnit`, `.pricePill`, `.priceConfirmBtn`) 추가, 옛 2단계 플로우 전용 클래스(`.categoryGrid` 등) 제거
