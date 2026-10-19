-- 설문 테스트 행동 로그(참여·완료·링크 클릭·공유 클릭). 관리자 "테스트 분석" 상단 지표에 쓴다.
-- 응답 테이블(efti_test_responses, efti_synergy_responses)은 제출이 끝난 응답만 남으므로
-- 접속·클릭처럼 제출 전후의 행동은 이 테이블에 따로 쌓는다.
--
-- visitor_id: 브라우저마다 한 번 만들어 localStorage에 두는 익명 ID. 유니크 참여·클릭 수(중복 제거)에 쓴다.
--             이름 등 개인정보는 넣지 않는다.
--
-- ** 적용 후 필수 **
-- survey 스키마는 이미 Exposed schemas에 들어가 있으므로 아래 GRANT만 빠뜨리지 않으면 된다.
-- 빠뜨리면 PostgREST가 "permission denied for table survey_events"(42501)로 거부한다.
CREATE TABLE survey.survey_events (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  test         text NOT NULL CHECK (test IN ('potential', 'synergy')),
  event        text NOT NULL CHECK (event IN ('visit', 'complete', 'link_click', 'share_click')),
  visitor_id   uuid NOT NULL,
  -- link_click: 누른 링크, share_click: 공유 수단(kakao, link, photo)
  target       text,
  -- complete: 첫 입력 화면(문항 화면) 진입부터 결과 저장까지 걸린 시간
  duration_ms  integer CHECK (duration_ms >= 0),
  -- 결과 행 id. 잠재력 테스트 테이블은 스모어에서 이관돼 id 형식이 정해져 있지 않아 text로 둔다.
  result_id    text,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX survey_events_test_created_at_idx ON survey.survey_events (test, created_at);

GRANT SELECT, INSERT ON survey.survey_events TO service_role;

-- 서버(service_role)만 읽고 쓴다. 공개 읽기 정책은 두지 않는다.
ALTER TABLE survey.survey_events ENABLE ROW LEVEL SECURITY;
