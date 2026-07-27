import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import BackButton from '../components/BackButton'
import CharacterCard from '../components/CharacterCard'
import { CHARACTERS } from '../constants/characters'
import styles from './CharacterSelect.module.css'

export default function CharacterSelect() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [selected, setSelected] = useState(null)

  const name = searchParams.get('name') ?? ''
  const affiliation = searchParams.get('affiliation') ?? ''
  const classId = searchParams.get('classId') ?? ''
  const code = searchParams.get('code') ?? ''

  function handleSubmit() {
    if (!selected) return
    const params = new URLSearchParams({ affiliation, name, character: selected })
    if (code) params.set('code', code)
    if (classId) params.set('classId', classId)
    navigate(`/team?${params}`)
  }

  function getState(id) {
    return id === selected ? 'selected' : 'idle'
  }

  return (
    <div className={styles.page}>
      <BackButton />
      <div className={styles.header}>
        <h2 className={styles.title}>캐릭터 선택</h2>
        <p className={styles.subtitle}>나를 대표할 동물 캐릭터를 골라보세요</p>
      </div>
      <hr className={styles.divider} />
      <div className={styles.gridWrapper}>
        <div className={styles.grid}>
          {CHARACTERS.map(id => (
            <CharacterCard key={id} id={id} state={getState(id)} onSelect={setSelected} />
          ))}
        </div>
      </div>
      <div className={styles.bottomBar}>
        <button className={styles.ctaBtn} onClick={handleSubmit} disabled={!selected}>
          이 캐릭터로 시작하기
        </button>
      </div>
    </div>
  )
}
