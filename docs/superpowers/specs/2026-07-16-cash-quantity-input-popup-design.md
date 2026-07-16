# 현금/수량 입력 팝업 (2026-07-16)

> 참고 디자인: `design/현금-메인.png`, `design/현금-팝업.png`
> 범위: `IndividualPage.jsx`의 현금 입력 스텝을 "입력란 클릭 → 바텀시트 팝업"으로 재구성하고, 같은 팝업을 부동산/주식 카드(`AssetCard`/`QuantitySelector`)의 수량 직접 입력에도 재사용한다.

---

## 1. 배경

현재 현금 스텝(step 4)은 페이지에 숫자패드(numpad)가 항상 펼쳐져 있는 형태다. `design/현금-메인.png`는 카드 안에 클릭 가능한 입력란만 보이고, 그 입력란을 클릭하면 `design/현금-팝업.png`처럼 화면 하단에서 올라오는 바텀시트 팝업(제목 + 큰 숫자 표시 + 숫자패드 + 확인 버튼)이 뜨는 형태다. 이 패턴을 신규 컴포넌트로 만들고, 부동산/주식 카드(`AssetCard` 안의 `QuantitySelector`)의 수량 숫자를 클릭했을 때도 동일한 팝업으로 정확한 수량을 직접 입력할 수 있게 한다(기존 `−`/`+` 버튼은 그대로 유지).

기존 코드베이스의 모달(`QRModal`, `CodeModal`)은 구식 다크 테마 중앙정렬 팝업이라 이번 라이트 테마 바텀시트와 스타일이 맞지 않는다. 새 컴포넌트는 그 모달들을 참고하지 않고 라이트 테마 디자인 토큰(`var(--ink)`, `var(--white)` 등)으로 새로 만든다.

## 2. 신규 컴포넌트: `NumberInputModal`

**Props:** `title`(string), `initialValue`(number), `unit`(string, 선택), `maxValue`(number, 선택), `onConfirm(value: number)`, `onClose()`

**동작:**
- 내부적으로 숫자 문자열 버퍼를 관리한다(`String(initialValue)`로 초기화). 숫자 키 입력 시 기존 `IndividualPage.jsx`의 인라인 numpad와 동일한 규칙 적용: 버퍼가 `'0'`이면 새 키로 대체, 아니면 이어붙임, 결과 문자열 길이가 10자를 넘으면 무시. `←`(백스페이스)는 마지막 글자 삭제, 1글자 남았으면 `'0'`으로.
- "확인" 버튼 클릭 시 `parseInt(버퍼, 10) || 0`을 계산하고, `maxValue`가 주어졌으면 `Math.min(값, maxValue)`로 클램프한 뒤 `onConfirm(값)`을 호출하고 팝업을 닫는다.
- 배경(오버레이) 클릭 시 저장 없이 `onClose()`만 호출한다(입력 취소).
- 레이아웃: 반투명 검정 오버레이(`rgba(0,0,0,0.4)`) 위에 화면 하단에서 올라오는 시트. 상단 중앙에 드래그 핸들 바, 그 아래 `title`, 큰 숫자(현재 버퍼 값, 3자리 콤마 포맷) + `unit`(있으면 우측에 작게), 구분선, 3열 숫자패드(`1 2 3 / 4 5 6 / 7 8 9 / 00 0 ←`), 전체 너비 검정 "확인" 버튼.

**이 컴포넌트는 상태를 직접 갖고 있으며, 부모는 `initialValue`/`onConfirm`/`onClose`만 넘기면 된다** — 자릿수 입력 로직을 부모가 알 필요 없음.

## 3. 현금 스텝(step 4) 변경

`IndividualPage.jsx`의 `step === 4` 블록에서 기존 `.numpadDisplay` + `.numpad`(인라인 숫자패드)를 제거하고 아래로 교체:

- 카드(`.cashCard` 신규): 라벨 "현금 (원)" + 클릭 가능한 입력란 버튼.
  - `cashDisplay`가 `'0'`이면 회색 placeholder "예: 5000" 표시.
  - 아니면 `{Number(cashDisplay).toLocaleString()}원` 형식으로 표시.
  - 클릭 시 `NumberInputModal`을 연다(`title="현금 입력"`, `initialValue={Number(cashDisplay)}`, `unit="원"`). 확인 시 `cashDisplay`를 문자열로 갱신.
- 페이지 하단의 다음/완료 버튼(`.bottomBar`/`.nextBtn`)은 기존 그대로 유지 — 변경 없음. 팝업의 "확인"과는 별개의, 스텝 전환용 버튼이다.

## 4. 부동산/주식 카드 변경

`QuantitySelector`의 가운데 숫자(`.count`)를 `<span>`에서 클릭 가능한 `<button>`으로 변경한다. 클릭 시 `NumberInputModal`을 연다(`title="{label} 수량"` — `AssetCard`가 자신의 `label` prop을 그대로 넘겨받아 조립, `initialValue={value}`, `unit="개"`, `maxValue={10}`). 확인 시 기존 `onChange`를 그대로 호출한다(`−`/`+` 버튼과 동일한 콜백 재사용).

이를 위해 `AssetCard`가 `NumberInputModal`을 직접 열고 닫는 상태(`showModal`)를 갖거나, `QuantitySelector` 자신이 팝업 상태를 가질 수 있다 — `QuantitySelector`가 이미 `value`/`onChange`를 갖고 있고 `label`만 추가로 필요하므로, **`QuantitySelector`에 `label` prop을 추가**하고 `QuantitySelector`가 직접 팝업 상태를 관리하는 쪽이 더 응집도 높다(`AssetCard`는 그대로 `label`을 넘겨주기만 하면 됨).

## 5. 컴포넌트 인터페이스 변경 요약

- `QuantitySelector({ value, onChange, label })` — `label` prop 추가(팝업 제목 조립용). 기존 두 prop은 그대로.
- `AssetCard`는 이미 갖고 있는 `label`을 `QuantitySelector`에 그대로 전달하도록 한 줄 추가.
- `NumberInputModal({ title, initialValue, unit, maxValue, onConfirm, onClose })` 신규.

## 6. 범위 밖 (Out of scope)

- 현금 입력 팝업에서 `maxValue` 적용 — 현금은 기존처럼 자릿수(10자) 제한만 유지하고 숫자 상한은 두지 않는다(기존 동작과 동일).
- 팝업 애니메이션(슬라이드업 트랜지션 디테일) — CSS `transition`은 자연스럽게 넣되, 정교한 모션 디자인은 다루지 않는다.
- 다른 화면의 기존 모달(`QRModal`, `CodeModal`, `ConfirmModal`, `PriceSettingModal`) 스타일 통일 — 이번 작업 범위 아님, 손대지 않는다.

## 7. 파일 변경 목록

**신규**
- `src/components/NumberInputModal.jsx`
- `src/components/NumberInputModal.module.css`
- `src/components/NumberInputModal.test.jsx`

**수정**
- `src/pages/IndividualPage.jsx` — 현금 스텝 UI 교체(입력란 버튼 + 팝업), `.numpadDisplay`/`.numpad` 관련 JSX 제거
- `src/pages/IndividualPage.module.css` — 인라인 numpad 스타일(`.numpadDisplay`, `.numpad`, `.numpadKey`) 제거, `.cashCard` 등 새 스타일 추가
- `src/components/QuantitySelector.jsx` — `label` prop 추가, 가운데 숫자를 클릭 가능한 버튼으로 변경, `NumberInputModal` 연동
- `src/components/QuantitySelector.module.css` — 숫자 버튼 스타일 추가
- `src/components/QuantitySelector.test.jsx` — `label` prop 및 팝업 오픈 동작 테스트 추가
- `src/components/AssetCard.jsx` — `QuantitySelector`에 `label` 전달
