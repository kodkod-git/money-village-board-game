# 우리 아이 경제 잠재력 테스트 자체 구현 — 설계 스펙 (2026-08-24)

> 기반 문서: `proposal/20260824_smore.md` (스모어 서비스 분석, 기존 데이터 검증, 채점 알고리즘 확정 포함)
> 이 스펙은 위 제안서를 바탕으로 브레인스토밍을 통해 남은 논의 사항(11장)을 확정한 결과다.

## 1. 목적

스모어(smore.im)의 유료 퀴즈 기능으로 운영 중인 "우리 아이 경제 잠재력(색깔편)" 테스트를 머니빌리지 웹앱 자체 기능으로 대체한다. 구독료 절감이 목적이며, 결과는 기존에 스모어 데이터가 이관되어 있는 Supabase `survey.efti_test_responses` 테이블에 이어서 저장한다.

## 2. 브레인스토밍으로 확정된 결정 사항

제안서 11장의 논의 항목을 다음과 같이 확정한다.

- **콘텐츠 저작권**: "우리 아이 경제 잠재력(색깔편)" 콘텐츠(문항 선택지, 그룹명, 태그라인, 설명 카피)의 저작권은 머니빌리지 측이 보유한다. 따라서 제안서 2장이 우려했던 저작권 문제는 해당하지 않으며, **스모어 원문 카피를 그대로 사용**한다. 신규 카피 창작이 필요 없다.
- **로그인/세션 연계**: 스모어와 동일하게 **완전 비로그인 공개 기능**으로 제공한다. 게임 세션·반·플레이어와 무관한 독립 기능이며, `LandingPage.jsx`에서 진입점만 연결한다.
- **대표 동물 일러스트**: 기존 `src/constants/characters.js`의 16종 캐릭터·4개 성향군(Adventurer/Guardian/Innovator/Planner)과는 **매핑하지 않는다**. 4개 결과 그룹(Green/Red/Orange/Blue) 각각에 대해 별도로 전달받는 일러스트를 사용한다. 구현 시점에는 자리표시자를 넣어두고 전달받는 대로 교체한다.
- **MVP 범위**: 제안서 4.2장에 명시된 항목은 모두 이번 범위에서 제외한다 — 관리자(반/클래스) 통계 대시보드 연동, 카카오톡 공유 SDK/결과 이미지 카드 다운로드, 4그룹→16유형(EFTI) 확장, `referrer`/`browser`/`device`/`country`/`region` 자동 수집.

## 3. 화면 흐름 및 라우트

제안서 5장 그대로 확정.

| # | 화면 | route | 파일 |
|---|---|---|---|
| 1 | 테스트 인트로 | `/quiz` | `src/pages/QuizIntro.jsx` |
| 2 | 문항 진행 (이름·나이·6문항) | `/quiz/play` | `src/pages/QuizPlay.jsx` |
| 3 | 결과 | `/quiz/result/:resultId` | `src/pages/QuizResult.jsx` |

- `QuizPlay.jsx` 내부에서 `step` state로 이름 입력 → 나이 입력 → 문항 1~6 → 분석 연출을 전환한다(실제 라우트 이동 없음).
- 기존 라이트 테마 디자인 토큰(`20260630_design_proposal.md`: GlassCard/GlassInput/PrimaryButton, 퍼플·블루 그라데이션, Nunito)을 재사용한다. 그룹별 강조색(Green/Red/Orange/Blue)은 결과 화면에서만 별도 사용한다.
- `LandingPage.jsx`에 "우리 아이 경제 잠재력 테스트" 진입 버튼을 기존 `primaryBtn`/`secondaryBtn`과 동일한 스타일로 추가한다.

## 4. 콘텐츠 (quizData.js)

- 문항 6개, 각 2지선다 선택지, 결과 그룹 4종(Green/Red/Orange/Blue Group)의 그룹명·태그라인·설명 체크리스트 문구는 스모어 원본(smore.im/quiz/JFWXFqyQVv)을 그대로 전사한다.
- 각 선택지 문구에는 극성(`'today'|'tomorrow'` 또는 `'safety'|'adventure'`)을 매핑해 `quizScoring.js`에 바로 연결한다.
- 그룹별 대표 일러스트는 자리표시자로 시작하고, 전달받는 자산으로 교체한다(파일 위치는 구현 계획에서 결정).

## 5. 채점 로직 (제안서 7장, 확정)

```js
// src/utils/quizScoring.js
const AXIS_A_KEYS = ['q_pocket_money', 'q_want_something', 'q_choosing_item']   // 오늘 vs 내일
const AXIS_B_KEYS = ['q_new_activity', 'q_hard_task', 'q_problem_solving']       // 안전 vs 모험

const RESULT_GROUP = {
  today_safety: 'Green Group',
  today_adventure: 'Red Group',
  tomorrow_safety: 'Orange Group',
  tomorrow_adventure: 'Blue Group',
}

export function calcQuizResult(poles) {
  const todayCount = AXIS_A_KEYS.filter(k => poles[k] === 'today').length
  const adventureCount = AXIS_B_KEYS.filter(k => poles[k] === 'adventure').length

  const axisTodayTomorrow = todayCount >= 2 ? 'today' : 'tomorrow'
  const axisSafetyAdventure = adventureCount >= 2 ? 'adventure' : 'safety'
  const resultGroup = RESULT_GROUP[`${axisTodayTomorrow}_${axisSafetyAdventure}`]

  return { axisTodayTomorrow, axisSafetyAdventure, resultGroup }
}
```

순수 함수로 작성하며 `src/utils/calculateAssets.js`와 동일한 패턴을 따른다. 유닛 테스트를 포함한다.

## 6. 데이터 모델 (Supabase `survey` 스키마)

새 테이블을 만들지 않고 `survey.efti_test_responses`를 이어서 사용한다.

```sql
-- 1) 정규화된 축 컬럼 + 데이터 출처 컬럼 추가
ALTER TABLE survey.efti_test_responses
  ADD COLUMN axis_today_tomorrow   text CHECK (axis_today_tomorrow IN ('today', 'tomorrow')),
  ADD COLUMN axis_safety_adventure text CHECK (axis_safety_adventure IN ('safety', 'adventure')),
  ADD COLUMN source text NOT NULL DEFAULT 'app';  -- 'smore_import' | 'app'

-- 2) 기존 이관 데이터는 출처를 smore_import로 표시
UPDATE survey.efti_test_responses
SET source = 'smore_import'
WHERE smore_token IS NOT NULL;

-- 3) 과거 데이터 축 값 백필 — result_group을 역산 (문항 텍스트 매칭은 신뢰 불가, 제안서 3.2 참고)
UPDATE survey.efti_test_responses
SET
  axis_today_tomorrow = CASE
    WHEN result_group IN ('Green Group', 'Red Group')   THEN 'today'
    WHEN result_group IN ('Orange Group', 'Blue Group') THEN 'tomorrow'
  END,
  axis_safety_adventure = CASE
    WHEN result_group IN ('Green Group', 'Orange Group') THEN 'safety'
    WHEN result_group IN ('Red Group', 'Blue Group')     THEN 'adventure'
  END
WHERE result_group IS NOT NULL;
```

착수 전 확인: `id`(uuid), `created_at`에 `DEFAULT gen_random_uuid()` / `DEFAULT now()`가 이미 걸려있는지 `information_schema.columns.column_default`로 확인한다. 없으면 앱에서 직접 채운다.

### RLS

기존 정책 여부를 먼저 확인한다. 없다면 `game_results`와 동일한 컨벤션으로 공개 SELECT + service INSERT 정책을 추가한다.

```sql
ALTER TABLE survey.efti_test_responses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read efti_test_responses"
  ON survey.efti_test_responses FOR SELECT USING (true);

CREATE POLICY "Service insert efti_test_responses"
  ON survey.efti_test_responses FOR INSERT WITH CHECK (true);
```

### 신규 행 저장 시 값

| 컬럼 | 값 |
|---|---|
| `child_name`, `child_age` | 사용자 입력 |
| `q_pocket_money` … `q_problem_solving` | 사용자가 실제 선택한 옵션의 텍스트(스모어 원문) |
| `axis_today_tomorrow`, `axis_safety_adventure` | `calcQuizResult`로 계산 |
| `result_group` | 위 매핑표대로 산출(`"Green Group"` 등 기존과 동일한 문자열 형식 유지) |
| `source` | `'app'` |
| `smore_token`, `referrer`, `browser`, `device`, `country`, `region` | NULL (자동 수집 범위 외) |

## 7. 백엔드

기존 프로젝트는 Express 서버(`server/`)가 서비스 롤 키로 DB에 접근한다(`server/supabase.js`는 `schema: 'boardgame'` 고정). `survey` 스키마 전용 클라이언트를 추가한다.

```js
// server/supabaseSurvey.js
import { createClient } from '@supabase/supabase-js'
const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env

export const supabaseSurvey = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  db: { schema: 'survey' },
})
```

- `server/quiz.js` (신규)
  - `POST /api/quiz/results` — 결과 저장(insert), `id` 반환
  - `GET /api/quiz/results/:id` — 공유 링크로 결과 조회
- `server/index.js`에 라우터 등록.
- 두 엔드포인트 모두 인증 불필요(비로그인 공개 기능).

## 8. 프론트엔드 신규 파일

| 파일 | 역할 |
|---|---|
| `src/pages/QuizIntro.jsx` | 인트로 화면 |
| `src/pages/QuizPlay.jsx` | 이름/나이 입력 + 6문항 진행(내부 step state) + 분석 연출(Supabase insert 비동기 처리) |
| `src/pages/QuizResult.jsx` | 결과 화면(완료 직후 / 공유 링크 재방문 겸용) |
| `src/constants/quizData.js` | 문항 텍스트, 선택지, 극성, 그룹별 라벨·색·태그라인·설명 |
| `src/utils/quizScoring.js` | 채점 로직(순수 함수) |

`App.jsx`에 라우트 3개 추가, `LandingPage.jsx`에 진입 버튼 추가.

## 9. 테스트

- `quizScoring.js`: 8가지 극성 조합 → 4개 그룹 매핑에 대한 유닛 테스트.
- 기존 이관 데이터 30건에 대해 신규 채점 로직이 `result_group`과 일치하는지 회귀 검증(제안서 3.2 매핑표 기준 25/30건 일치, 나머지 5건은 원본 데이터 자체의 문항 텍스트 유실로 설명됨 — 신규 로직 결함이 아님을 확인).
- `server/quiz.js` 라우트: 저장/조회 API에 대한 서버 테스트(`rooms.test.js` 패턴 참고).

## 10. 구현 우선순위

1. `efti_test_responses` 마이그레이션 + RLS 확인 + 백엔드 라우트(`server/supabaseSurvey.js`, `server/quiz.js`)
2. `quizData.js`(스모어 원문 전사) + `quizScoring.js`(유닛 테스트 포함)
3. `QuizIntro` → `QuizPlay` → 분석 연출 → `QuizResult` 화면 구현(일러스트는 자리표시자)
4. 랜딩 페이지 진입점 연결 + 공유 링크 테스트
5. 기존 30건 이관 데이터 회귀 검증
6. 그룹별 일러스트 자산 전달받는 대로 자리표시자 교체
