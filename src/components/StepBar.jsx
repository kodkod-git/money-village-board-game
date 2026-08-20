import styles from './StepBar.module.css'

export default function StepBar({ steps, currentStep, completedUpTo = -1, onStepClick }) {
  return (
    <div className={styles.container}>
      {steps.map((label, i) => {
        const isReached = i <= currentStep || i <= completedUpTo
        const isCurrent = i === currentStep
        const isClickable = onStepClick != null && i <= completedUpTo
        return (
          <button
            key={label}
            className={`${styles.step} ${isCurrent ? styles.stepActive : styles.stepInactive}`}
            onClick={isClickable ? () => onStepClick(i) : undefined}
            disabled={!isClickable}
          >
            <div className={`${styles.line} ${isReached ? styles.lineActive : ''}`} />
            <span className={styles.label}>{label}</span>
          </button>
        )
      })}
    </div>
  )
}
