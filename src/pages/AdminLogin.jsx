import { useState } from 'react'
import BackButton from '../components/BackButton'
import useBodyClass from '../hooks/useBodyClass'
import styles from './NameInput.module.css'
import loginStyles from './AdminLogin.module.css'

// 팀코드 입력·이름 입력 화면과 같은 폰 프레임(onboarding-mode)과 CSS를 쓴다.
// 로그인/회원가입 탭만 이 화면 전용 스타일이다.
export default function AdminLogin({ onLogin }) {
  useBodyClass('onboarding-mode')
  const [mode, setMode] = useState('login')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    const url = mode === 'login' ? '/api/admin/login' : '/api/admin/signup'
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    })
    const data = await res.json()
    if (!res.ok) {
      setError(data.error ?? '오류가 발생했습니다')
      return
    }
    onLogin(data.token, { username: data.username, isSuper: data.isSuper })
  }

  return (
    <div className={styles.page}>
      <BackButton />
      <div className={styles.header}>
        <h1 className={styles.title}>관리자</h1>
        <p className={styles.subtitle}>선생님 계정으로 로그인해주세요</p>
      </div>
      <form className={styles.card} onSubmit={handleSubmit}>
        <div className={loginStyles.tabs}>
          <button
            type="button"
            className={`${loginStyles.tab} ${mode === 'login' ? loginStyles.tabActive : ''}`}
            onClick={() => setMode('login')}
          >
            로그인
          </button>
          <button
            type="button"
            className={`${loginStyles.tab} ${mode === 'signup' ? loginStyles.tabActive : ''}`}
            onClick={() => setMode('signup')}
          >
            회원가입
          </button>
        </div>
        <div className={styles.inputGroup}>
          <label className={styles.label} htmlFor="admin-username">아이디</label>
          <input
            id="admin-username"
            className={styles.input}
            placeholder="아이디"
            value={username}
            onChange={e => setUsername(e.target.value)}
          />
        </div>
        <div className={styles.inputGroup}>
          <label className={styles.label} htmlFor="admin-password">비밀번호</label>
          <input
            id="admin-password"
            className={styles.input}
            type="password"
            placeholder="비밀번호"
            value={password}
            onChange={e => setPassword(e.target.value)}
          />
        </div>
        {error && <p className={loginStyles.error}>{error}</p>}
        <button type="submit" className={styles.gradBtn}>
          {mode === 'login' ? '로그인하기' : '회원가입하기'}
        </button>
      </form>
    </div>
  )
}
