import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import BackButton from '../components/BackButton'
import {
  NAME_TITLE, NAME_SUBTITLE, NAME_LABEL, NAME_PLACEHOLDER,
  GENDER_TITLE, GENDER_OPTIONS, AGE_SUBTITLE, AGE_LABEL, AGE_PLACEHOLDER,
  QUESTION_SUBTITLE, QUESTIONS, TOTAL_QUIZ_STEPS,
} from '../constants/quizData'
import { calcQuizResult } from '../utils/quizScoring'
import useBodyClass from '../hooks/useBodyClass'
import styles from './QuizPlay.module.css'

const STEP_NAME = 'name'
const STEP_GENDER = 'gender'
const STEP_AGE = 'age'
const STEP_QUESTION = 'question'
const STEP_ANALYZING = 'analyzing'
const STEP_DONE = 'done'
const STEP_ERROR = 'error'

export default function QuizPlay() {
  const navigate = useNavigate()
  useBodyClass('onboarding-mode')
  const [step, setStep] = useState(STEP_NAME)
  const [questionIndex, setQuestionIndex] = useState(0)
  const [childName, setChildName] = useState('')
  const [childGender, setChildGender] = useState('')
  const [childAge, setChildAge] = useState('')
  const [answers, setAnswers] = useState({})
  const [polarities, setPolarities] = useState({})

  function submitResult() {
    setStep(STEP_ANALYZING)
    const { axisTodayTomorrow, axisSafetyAdventure, resultGroup } = calcQuizResult(polarities)

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

  function selectGender(value) {
    setChildGender(value)
  }

  function confirmGender() {
    setStep(STEP_AGE)
  }

  function selectAnswer(question, option) {
    setAnswers(prev => ({ ...prev, [question.key]: option.text }))
    setPolarities(prev => ({ ...prev, [question.key]: option.polarity }))
  }

  function confirmAnswer() {
    if (questionIndex + 1 < QUESTIONS.length) {
      setQuestionIndex(questionIndex + 1)
    } else {
      submitResult()
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
    step === STEP_NAME ? 1
    : step === STEP_GENDER ? 2
    : step === STEP_AGE ? 3
    : 4 + questionIndex // STEP_QUESTION or STEP_ERROR

  const currentQuestion = QUESTIONS[questionIndex]

  return (
    <div className={styles.page}>
      <BackButton />

      <div className={styles.progressHeader}>
        <div className={styles.progressMeta}>
          <span>{currentStepNumber}/{TOTAL_QUIZ_STEPS}</span>
          <span className={styles.progressPercent}>{Math.round((currentStepNumber / TOTAL_QUIZ_STEPS) * 100)}%</span>
        </div>
        <div className={styles.progressTrack}>
          <div
            className={styles.progressFill}
            data-testid="quiz-progress-fill"
            style={{ width: `${(currentStepNumber / TOTAL_QUIZ_STEPS) * 100}%` }}
          />
        </div>
      </div>

      <div className={styles.center}>
        {step === STEP_ERROR && (
          <div className={styles.card}>
            <p className={styles.questionPrompt}>결과 저장에 실패했어요.</p>
            <button className={styles.gradBtn} onClick={submitResult}>다시 시도하기</button>
          </div>
        )}

        {step === STEP_NAME && (
          <>
            <div className={styles.heading}>
              <h1 className={styles.stepTitle}>{NAME_TITLE}</h1>
              <p className={styles.stepSubtitle}>{NAME_SUBTITLE}</p>
            </div>
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
                다음
              </button>
            </div>
          </>
        )}

        {step === STEP_GENDER && (
          <>
            <div className={styles.heading}>
              <h1 className={styles.stepTitle}>{GENDER_TITLE}</h1>
            </div>
            <div className={styles.card}>
              <div className={styles.optionList}>
                {GENDER_OPTIONS.map(option => (
                  <button
                    key={option.value}
                    type="button"
                    className={`${styles.choiceCard} ${option.value === childGender ? styles.choiceCardSelected : ''}`}
                    onClick={() => selectGender(option.value)}
                  >
                    <span>{option.label}</span>
                    {option.value === childGender && <span aria-hidden="true">✓</span>}
                  </button>
                ))}
              </div>
              <button className={styles.gradBtn} onClick={confirmGender} disabled={!childGender}>
                다음
              </button>
            </div>
          </>
        )}

        {step === STEP_AGE && (
          <>
            <div className={styles.heading}>
              <h1 className={styles.stepTitle}>{childName}는 몇 살인가요?</h1>
              <p className={styles.stepSubtitle}>{AGE_SUBTITLE}</p>
            </div>
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
                다음
              </button>
            </div>
          </>
        )}

        {step === STEP_QUESTION && (
          <>
            <div className={styles.heading}>
              <h1 className={styles.stepTitle}>{currentQuestion.prompt.replace('{name}', childName)}</h1>
              <p className={styles.stepSubtitle}>{QUESTION_SUBTITLE}</p>
            </div>
            <div className={styles.card}>
              <div className={styles.optionList}>
                {currentQuestion.options.map(option => (
                  <button
                    key={option.text}
                    data-quiz-option="true"
                    type="button"
                    className={`${styles.choiceCard} ${answers[currentQuestion.key] === option.text ? styles.choiceCardSelected : ''}`}
                    onClick={() => selectAnswer(currentQuestion, option)}
                  >
                    <span>{option.text}</span>
                    {answers[currentQuestion.key] === option.text && <span aria-hidden="true">✓</span>}
                  </button>
                ))}
              </div>
              <button className={styles.gradBtn} onClick={confirmAnswer} disabled={!answers[currentQuestion.key]}>
                다음
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
