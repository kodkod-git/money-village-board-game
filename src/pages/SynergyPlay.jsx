import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import BackButton from '../components/BackButton'
import {
  MY_NAME_TITLE, CITIZEN_NAME_TITLE, NAME_SUBTITLE, NAME_LABEL,
  MY_NAME_PLACEHOLDER, CITIZEN_NAME_PLACEHOLDER,
  QUESTION_SUBTITLE, SYNERGY_QUESTIONS, TOTAL_SYNERGY_STEPS,
} from '../constants/synergyData'
import { calcSynergyType, normalizeSynergyType } from '../utils/synergyScoring'
import useBodyClass from '../hooks/useBodyClass'
import styles from './QuizPlay.module.css'

const STEP_MY_NAME = 'myName'
const STEP_CITIZEN_NAME = 'citizenName'
const STEP_QUESTION = 'question'
const STEP_ANALYZING = 'analyzing'

export default function SynergyPlay() {
  const { citizenType: rawCitizenType } = useParams()
  const citizenType = normalizeSynergyType(rawCitizenType)
  const navigate = useNavigate()
  useBodyClass('onboarding-mode')
  const [step, setStep] = useState(STEP_MY_NAME)
  const [questionIndex, setQuestionIndex] = useState(0)
  const [myName, setMyName] = useState('')
  const [citizenName, setCitizenName] = useState('')
  const [answers, setAnswers] = useState({})
  const [letters, setLetters] = useState({})

  if (!citizenType) {
    return (
      <div className={styles.page}>
        <div className={styles.center}>
          <div className={styles.card}>
            <p className={styles.questionPrompt}>올바르지 않은 시민권 링크예요.</p>
          </div>
        </div>
      </div>
    )
  }

  function submitResult() {
    setStep(STEP_ANALYZING)
    const params = new URLSearchParams({
      me: calcSynergyType(letters),
      name: myName.trim(),
      friend: citizenName.trim(),
    })
    setTimeout(() => navigate(`/synergy/${citizenType}/result?${params}`), 600)
  }

  function selectAnswer(question, option) {
    setAnswers(prev => ({ ...prev, [question.key]: option.text }))
    setLetters(prev => ({ ...prev, [question.key]: option.letter }))
  }

  function confirmAnswer() {
    if (questionIndex + 1 < SYNERGY_QUESTIONS.length) {
      setQuestionIndex(questionIndex + 1)
    } else {
      submitResult()
    }
  }

  if (step === STEP_ANALYZING) {
    return (
      <div className={styles.page}>
        <div className={styles.statusWrap}>
          <div className={styles.spinner} />
          <p className={styles.statusText}>결과 분석중</p>
        </div>
      </div>
    )
  }

  const currentStepNumber =
    step === STEP_MY_NAME ? 1
    : step === STEP_CITIZEN_NAME ? 2
    : 3 + questionIndex

  const currentQuestion = SYNERGY_QUESTIONS[questionIndex]

  const nameStep = step === STEP_MY_NAME
    ? { title: MY_NAME_TITLE, placeholder: MY_NAME_PLACEHOLDER, value: myName, onChange: setMyName, next: () => setStep(STEP_CITIZEN_NAME) }
    : { title: CITIZEN_NAME_TITLE, placeholder: CITIZEN_NAME_PLACEHOLDER, value: citizenName, onChange: setCitizenName, next: () => setStep(STEP_QUESTION) }

  return (
    <div className={styles.page}>
      <BackButton />

      <div className={styles.progressHeader}>
        <div className={styles.progressMeta}>
          <span>{currentStepNumber}/{TOTAL_SYNERGY_STEPS}</span>
          <span className={styles.progressPercent}>{Math.round((currentStepNumber / TOTAL_SYNERGY_STEPS) * 100)}%</span>
        </div>
        <div className={styles.progressTrack}>
          <div
            className={styles.progressFill}
            data-testid="quiz-progress-fill"
            style={{ width: `${(currentStepNumber / TOTAL_SYNERGY_STEPS) * 100}%` }}
          />
        </div>
      </div>

      <div className={styles.center}>
        {(step === STEP_MY_NAME || step === STEP_CITIZEN_NAME) && (
          <>
            <div className={styles.heading}>
              <h1 className={styles.stepTitle}>{nameStep.title}</h1>
              <p className={styles.stepSubtitle}>{NAME_SUBTITLE}</p>
            </div>
            <div className={styles.card}>
              <div className={styles.inputGroup}>
                <label className={styles.label} htmlFor="synergy-name">{NAME_LABEL}</label>
                <input
                  key={step}
                  id="synergy-name"
                  className={styles.input}
                  placeholder={nameStep.placeholder}
                  value={nameStep.value}
                  onChange={e => nameStep.onChange(e.target.value)}
                />
              </div>
              <button className={styles.gradBtn} onClick={nameStep.next} disabled={!nameStep.value.trim()}>
                다음
              </button>
            </div>
          </>
        )}

        {step === STEP_QUESTION && (
          <>
            <div className={styles.heading}>
              <h1 className={styles.stepTitle}>{currentQuestion.prompt}</h1>
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
