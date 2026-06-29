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
  const code = searchParams.get('code') ?? ''

  function handleSubmit() {
    if (!selected) return
    const params = new URLSearchParams({ affiliation, name, character: selected })
    if (code) params.set('code', code)
    navigate(`/team?${params}`)
  }

  function getState(id) {
    return id === selected ? 'selected' : 'idle'
  }

  return (
    <div className={styles.page}>
      <BackButton />
      <div className={styles.header}>
        <p className={styles.title}>캐릭터를 선택하세요</p>
        <p className={styles.subtitle}>{name} 님, 나를 대표할 캐릭터를 골라주세요</p>
      </div>
      <div className={styles.grid}>
        {CHARACTERS.map(id => (
          <CharacterCard key={id} id={id} state={getState(id)} onSelect={setSelected} />
        ))}
      </div>
      <button className={styles.submitBtn} onClick={handleSubmit} disabled={!selected}>
        완료 → 로비 입장
      </button>
    </div>
  )
}
