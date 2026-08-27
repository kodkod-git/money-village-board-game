-- 퀴즈(우리 아이 경제 잠재력 테스트)에 성별 문항이 추가됐다. 이름 입력 다음,
-- 나이 입력 앞에 오는 필수 문항이며 응답은 'male' / 'female' 로 저장된다.
--
-- survey.efti_test_responses는 스모어에서 이관된 기존 테이블이라 앱이 스키마를
-- 소유하지 않는다. 이 컬럼을 추가하기 전에는 POST /api/quiz/results 가
-- PGRST204("Could not find the 'child_gender' column")로 실패한다.
ALTER TABLE survey.efti_test_responses
  ADD COLUMN child_gender text CHECK (child_gender IN ('male', 'female'));
