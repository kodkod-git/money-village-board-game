// 테스트 전용. 문항 목록의 단일 출처인 마이그레이션 시드 SQL을 그대로 읽어 픽스처로 쓴다.
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const SEED_PATH = fileURLToPath(
  new URL('../../../supabase/migrations/2026-11-19-add-efti-record-schema.sql', import.meta.url)
)

// ( 1, '01',   'q01',   1, 'T', '질문', '①', '②', 'F', 'P')
const ROW = /\(\s*(\d+),\s*'([^']*)',\s*'([^']*)',\s*([12]),\s*'([TROD])',\s*'([^']*)',\s*'([^']*)',\s*'([^']*)',\s*'([A-Z])',\s*'([A-Z])'\s*\)/g

export function loadSeedQuestions() {
  const sql = readFileSync(SEED_PATH, 'utf8')
  return [...sql.matchAll(ROW)]
    .map(m => ({
      sortOrder: Number(m[1]),
      code: m[2],
      columnName: m[3],
      stage: Number(m[4]),
      axis: m[5],
      question: m[6],
      option1: m[7],
      option2: m[8],
      letter1: m[9],
      letter2: m[10],
    }))
    .sort((a, b) => a.sortOrder - b.sortOrder)
}

export function allAnswers(questions, value) {
  return Object.fromEntries(questions.map(q => [q.code, value]))
}
