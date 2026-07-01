import { Routes, Route } from 'react-router-dom'
import LandingPage from './pages/LandingPage'
import NameInput from './pages/NameInput'
import CharacterSelect from './pages/CharacterSelect'
import Lobby from './pages/Lobby'
import Home from './pages/Home'
import IndividualPage from './pages/IndividualPage'
import RankingPage from './pages/RankingPage'
import ResultPage from './pages/ResultPage'
import AdminDashboard from './pages/AdminDashboard'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/join" element={<NameInput />} />
      <Route path="/select" element={<CharacterSelect />} />
      <Route path="/team" element={<Home />} />
      <Route path="/lobby/:code" element={<Lobby />} />
      <Route path="/lobby/:code/individual" element={<IndividualPage />} />
      <Route path="/ranking" element={<RankingPage />} />
      <Route path="/result/:sessionId" element={<RankingPage />} />
      <Route path="/result/:sessionId/player/:playerUuid" element={<ResultPage />} />
      <Route path="/admin" element={<AdminDashboard />} />
    </Routes>
  )
}
