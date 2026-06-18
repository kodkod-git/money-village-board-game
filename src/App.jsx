import { Routes, Route } from 'react-router-dom'
import Home from './pages/Home'
import NameInput from './pages/NameInput'
import CharacterSelect from './pages/CharacterSelect'
import Lobby from './pages/Lobby'
import IndividualPage from './pages/IndividualPage'
import ResultPage from './pages/ResultPage'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<NameInput />} />
      <Route path="/join" element={<NameInput />} />
      <Route path="/select" element={<CharacterSelect />} />
      <Route path="/team" element={<Home />} />
      <Route path="/lobby/:code" element={<Lobby />} />
      <Route path="/lobby/:code/individual" element={<IndividualPage />} />
      <Route path="/result/:sessionId" element={<ResultPage />} />
    </Routes>
  )
}
