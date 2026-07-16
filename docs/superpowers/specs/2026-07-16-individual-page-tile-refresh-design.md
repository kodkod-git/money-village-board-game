# 직업/성공카드 선택 & 자산 카드 리디자인 (2026-07-16)

> 참고 디자인: `design/부동산.png`
> 범위: `IndividualPage.jsx`의 직업/성공카드 선택 타일 색상, 부동산/주식 수량 입력 UI(`AssetRow`→`AssetCard`, `QuantitySelector`) 재구성.

---

## 1. 직업/성공카드 선택 타일 — 선택 상태 색상

`IndividualPage.module.css`의 `.tileSelected`가 현재는 보라색 테두리 + 그림자로만 선택 상태를 표시한다. 이를 배경 검정 + 텍스트 흰색으로 변경한다.

```css
.tileSelected {
  background: var(--ink);
  border-color: var(--ink);
}
.tileSelected .tileLabel {
  color: var(--white);
}
```

기존 `box-shadow: 0 0 0 3px rgba(108,125,229,0.2);` 강조 효과는 제거한다. 뱃지 이미지(`badgeImg`)는 PNG 파일이라 재색상되지 않으며, 라벨 텍스트만 흰색으로 바뀐다. 이 스타일은 직업 타일과 성공카드 타일에 공통으로 적용된다(`.jobTile`/`.badgeTile` 모두 `.tileSelected` 클래스를 공유).

## 2. 부동산/주식 수량 입력 — 카드 + 스테퍼

### 2.1 배경

현재 `QuantitySelector`는 1~10까지의 숫자 버튼을 나열해 값 이하를 채우는 방식이고, `AssetRow`는 아이콘+라벨+가격+선택바+합계를 가로 한 줄로 배치한다. `design/부동산.png`는 항목별로 카드(아이콘+라벨+가격이 상단, `− 숫자 +` 스테퍼가 하단)를 3열 그리드로 배치하는 형태다. 이 설계는 그 형태로 재구성한다.

### 2.2 컴포넌트 변경

- **`AssetRow` → `AssetCard`로 리네임** (`AssetRow.jsx`/`.module.css`/`.test.jsx` → `AssetCard.jsx`/`.module.css`/`.test.jsx`). props 인터페이스(`image`, `label`, `price`, `value`, `onChange`)는 그대로 유지한다.
  - 렌더링을 가로 행에서 세로 카드로 변경: 상단에 아이콘+라벨+가격, 하단에 `QuantitySelector`.
  - 기존 우측 "N개" 텍스트(`.total`)는 제거한다 — 스테퍼 안의 숫자가 값을 직접 보여주므로 중복이다.
- **`QuantitySelector.jsx` 내부를 스테퍼로 완전히 교체** (props 인터페이스 `value`/`onChange`는 유지):
  - `−` 버튼(흰 배경 + 테두리 원형) · 가운데 숫자 · `+` 버튼(검정 배경 원형), 목업과 동일하게 `+`는 항상 채워진 원, `−`는 항상 테두리만 있는 원(값에 따라 스타일이 바뀌지 않음).
  - 값이 0이면 숫자 대신 `—`(대시)를 표시한다 — 목업에서 미선택 카드가 그렇게 표시되어 있음.
  - 값 범위는 기존과 동일하게 0~10 유지. `value <= 0`이면 `−` 비활성화, `value >= 10`이면 `+` 비활성화.
  - 클릭 시 `onChange(다음 값)`을 호출한다(기존처럼 `onChange(0)`으로 토글하는 방식이 아니라 1씩 증減).

### 2.3 레이아웃 변경

`IndividualPage.module.css`의 `.assetList`(세로 `flex` 리스트)를 3열 그리드로 변경한다. 같은 페이지의 직업 선택 그리드(`.jobGrid`)와 동일한 3열 구성을 사용한다.

```css
.assetList {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
  padding-bottom: 24px;
}
```

### 2.4 영향 범위

`AssetCard`(구 `AssetRow`)와 `QuantitySelector`는 `IndividualPage.jsx`의 부동산(step 2)·주식(step 3) 스텝에서만 사용된다(레포 전체 검색으로 확인). 다른 화면에는 영향이 없다.

## 3. 범위 밖 (Out of scope)

- 수량 최대값(10)을 바꾸는 것 — 기존 게임 밸런스 값을 그대로 유지한다.
- `가격 설정` 텍스트(주식 카드의 가격 표시) 로직 변경 — 그대로 유지.
- 데스크탑/반응형 대응 — 기존과 동일하게 모바일 프레임(최대 430px) 전용.

## 4. 파일 변경 목록

**리네임**
- `src/components/AssetRow.jsx` → `src/components/AssetCard.jsx`
- `src/components/AssetRow.module.css` → `src/components/AssetCard.module.css`
- `src/components/AssetRow.test.jsx` → `src/components/AssetCard.test.jsx`

**수정**
- `src/components/AssetCard.jsx` (구 `AssetRow.jsx`) — 카드 레이아웃으로 변경
- `src/components/AssetCard.module.css` (구 `AssetRow.module.css`) — 카드 스타일로 전체 교체
- `src/components/QuantitySelector.jsx` — `−/+` 스테퍼로 전체 교체
- `src/components/QuantitySelector.module.css` — 스테퍼 스타일로 전체 교체
- `src/components/QuantitySelector.test.jsx` — 스테퍼 동작에 맞게 테스트 교체
- `src/pages/IndividualPage.jsx` — `AssetRow` import를 `AssetCard`로 변경
- `src/pages/IndividualPage.module.css` — `.tileSelected` 색상 변경, `.assetList` 그리드로 변경
