// 입력 화면(기록지 한 장) 상태. key 는 화면용 식별자, id 는 DB 행 id(새 학생은 null).
import { emptyAnswers } from '../../../shared/eftiRecord/sheetFormat.js'

let seq = 0
const newKey = () => `s${++seq}`

export function blankStudent(questions) {
  return { key: newKey(), id: null, nickname: '', memo: '', answers: emptyAnswers(questions) }
}

export function initialSheetState(questions, teacherName) {
  return {
    original: null,
    header: { teacherName, className: '', classTime: '', completedOn: '' },
    students: [blankStudent(questions)],
    deleteIds: [],
    dirty: false,
  }
}

export function loadedSheetState(header, students) {
  return {
    original: header,
    header,
    students: students.map(s => ({ key: newKey(), id: s.id, nickname: s.nickname, memo: s.memo ?? '', answers: s.answers })),
    deleteIds: [],
    dirty: false,
  }
}

const NEXT_ANSWER = { null: 1, 1: 2, 2: null }

function updateStudent(state, key, fn) {
  return { ...state, students: state.students.map(s => (s.key === key ? fn(s) : s)), dirty: true }
}

export function sheetReducer(state, action) {
  switch (action.type) {
    case 'reset':
      return action.state
    case 'setHeader':
      return { ...state, header: { ...state.header, [action.field]: action.value }, dirty: true }
    case 'addStudent':
      return { ...state, students: [...state.students, blankStudent(action.questions)], dirty: true }
    case 'removeStudent': {
      const target = state.students.find(s => s.key === action.key)
      return {
        ...state,
        students: state.students.filter(s => s.key !== action.key),
        deleteIds: target?.id ? [...state.deleteIds, target.id] : state.deleteIds,
        dirty: true,
      }
    }
    case 'setStudentField':
      return updateStudent(state, action.key, s => ({ ...s, [action.field]: action.value }))
    case 'setAnswer':
      return updateStudent(state, action.key, s => ({ ...s, answers: { ...s.answers, [action.code]: action.value } }))
    case 'cycleAnswer':
      return updateStudent(state, action.key, s => ({
        ...s, answers: { ...s.answers, [action.code]: NEXT_ANSWER[s.answers[action.code] ?? null] ?? null },
      }))
    default:
      return state
  }
}

export function toSavePayload(state) {
  return {
    original: state.original,
    header: state.header,
    students: state.students.map(({ id, nickname, memo, answers }) => ({ ...(id ? { id } : {}), nickname, memo, answers })),
    deleteIds: state.deleteIds,
  }
}
