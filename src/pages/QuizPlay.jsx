import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import BackButton from '../components/BackButton'
import { GUIDE_TEXT, NAME_LABEL, NAME_PLACEHOLDER, GENDER_LABEL, GENDER_OPTIONS, AGE_LABEL, AGE_PLACEHOLDER, QUESTIONS } from '../constants/quizData'
import { calcQuizResult } from '../utils/quizScoring'
import useBodyClass from '../hooks/useBodyClass'
import styles from './QuizPlay.module.css'

const STEP_GUIDE = 'guide'
const STEP_NAME = 'name'
const STEP_GENDER = 'gender'
const STEP_AGE = 'age'
const STEP_QUESTION = 'question'
const STEP_ANALYZING = 'analyzing'
const STEP_DONE = 'done'
const STEP_ERROR = 'error'
const TOTAL_STEPS = 4 + QUESTIONS.length // 안내 + 이름 + 성별 + 나이 + 문항 수

export default function QuizPlay() {
  const navigate = useNavigate()
  useBodyClass('quiz-mode')
  const [step, setStep] = useState(STEP_GUIDE)
  const [questionIndex, setQuestionIndex] = useState(0)
  const [childName, setChildName] = useState('')
  const [childGender, setChildGender] = useState('')
  const [childAge, setChildAge] = useState('')
  const [answers, setAnswers] = useState({})
  const [polarities, setPolarities] = useState({})
  const [lastPolarities, setLastPolarities] = useState(null)

  function submitResult(finalPolarities) {
    setStep(STEP_ANALYZING)
    setLastPolarities(finalPolarities)
    const { axisTodayTomorrow, axisSafetyAdventure, resultGroup } = calcQuizResult(finalPolarities)

    fetch('/api/quiz/results', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        childName, childGender, childAge: Number(childAge), answers, axisTodayTomorrow, axisSafetyAdventure, resultGroup,
      }),
    })
      .then(r => { if (!r.ok) throw new Error('save failed'); return r.json() })
      .then(data => {
        setStep(STEP_DONE)
        setTimeout(() => navigate(`/quiz/result/${data.id}`), 600)
      })
      .catch(() => setStep(STEP_ERROR))
  }

  function handleAnswer(question, option) {
    const nextAnswers = { ...answers, [question.key]: option.text }
    const nextPolarities = { ...polarities, [question.key]: option.polarity }
    setAnswers(nextAnswers)
    setPolarities(nextPolarities)

    if (questionIndex + 1 < QUESTIONS.length) {
      setQuestionIndex(questionIndex + 1)
    } else {
      submitResult(nextPolarities)
    }
  }

  if (step === STEP_ANALYZING || step === STEP_DONE) {
    return (
      <div className={styles.page}>
        <div className={styles.statusWrap}>
          {step === STEP_ANALYZING && <div className={styles.spinner} />}
          <p className={styles.statusText}>{step === STEP_ANALYZING ? '결과 분석중' : '완료'}</p>
        </div>
      </div>
    )
  }

  const currentStepNumber =
    step === STEP_GUIDE ? 1
    : step === STEP_NAME ? 2
    : step === STEP_GENDER ? 3
    : step === STEP_AGE ? 4
    : 5 + questionIndex

  return (
    <div className={styles.page}>
      <BackButton />
      <div className={styles.header}>
        <h1 className={styles.title}>우리 아이 경제 잠재력 테스트</h1>
        <div className={styles.progressTrack}>
          <div
            className={styles.progressFill}
            data-testid="quiz-progress-fill"
            style={{ width: `${(currentStepNumber / TOTAL_STEPS) * 100}%` }}
          />
        </div>
        <p className={styles.subtitle}>{step === STEP_ERROR ? '문제가 발생했어요' : `${currentStepNumber}/${TOTAL_STEPS}`}</p>
      </div>

      {step === STEP_ERROR && (
        <div className={styles.card}>
          <p className={styles.questionPrompt}>결과 저장에 실패했어요.</p>
          <button className={styles.gradBtn} onClick={() => submitResult(lastPolarities)}>다시 시도하기</button>
        </div>
      )}

      {step === STEP_GUIDE && (
        <div className={styles.card}>
          <p className={styles.guideText}>{GUIDE_TEXT}</p>
          <button className={styles.gradBtn} onClick={() => setStep(STEP_NAME)}>다음 문제</button>
        </div>
      )}

      {step === STEP_NAME && (
        <div className={styles.card}>
          <div className={styles.inputGroup}>
            <label className={styles.label}>{NAME_LABEL}</label>
            <input
              className={styles.input}
              placeholder={NAME_PLACEHOLDER}
              value={childName}
              onChange={e => setChildName(e.target.value)}
            />
          </div>
          <button className={styles.gradBtn} onClick={() => childName.trim() && setStep(STEP_GENDER)} disabled={!childName.trim()}>
            다음 문제
          </button>
        </div>
      )}

      {step === STEP_GENDER && (
        <div className={styles.card}>
          <div className={styles.inputGroup}>
            <label className={styles.label}>{GENDER_LABEL}</label>
            <div className={styles.genderRow}>
              {GENDER_OPTIONS.map(option => (
                <button
                  key={option.value}
                  type="button"
                  className={`${styles.genderBtn} ${childGender === option.value ? styles.genderBtnActive : ''}`}
                  aria-pressed={childGender === option.value}
                  onClick={() => setChildGender(option.value)}
                >
                  <span className={styles.genderEmoji} aria-hidden="true">{option.emoji}</span>
                  {option.label}
                </button>
              ))}
            </div>
          </div>
          <button className={styles.gradBtn} onClick={() => childGender && setStep(STEP_AGE)} disabled={!childGender}>
            다음 문제
          </button>
        </div>
      )}

      {step === STEP_AGE && (
        <div className={styles.card}>
          <div className={styles.inputGroup}>
            <label className={styles.label}>{AGE_LABEL}</label>
            <input
              className={styles.input}
              type="number"
              placeholder={AGE_PLACEHOLDER}
              value={childAge}
              onChange={e => setChildAge(e.target.value)}
            />
          </div>
          <button className={styles.gradBtn} onClick={() => childAge && setStep(STEP_QUESTION)} disabled={!childAge}>
            다음 문제
          </button>
        </div>
      )}

      {step === STEP_QUESTION && (
        <div className={styles.card}>
          <p className={styles.questionPrompt}>{QUESTIONS[questionIndex].prompt}</p>
          <div className={styles.optionList}>
            {QUESTIONS[questionIndex].options.map(option => (
              <button
                key={option.text}
                data-quiz-option="true"
                className={styles.optionBtn}
                onClick={() => handleAnswer(QUESTIONS[questionIndex], option)}
              >
                {option.text}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
