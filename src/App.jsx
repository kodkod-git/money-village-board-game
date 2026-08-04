import { Routes, Route } from 'react-router-dom'
import LandingPage from './pages/LandingPage'
import NameInput from './pages/NameInput'
import CharacterSelect from './pages/CharacterSelect'
import Home from './pages/Home'
import Team from './pages/Team'
import IndividualPage from './pages/IndividualPage'
import RankingPage from './pages/RankingPage'
import AdminDashboard from './pages/AdminDashboard'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/join" element={<NameInput />} />
      <Route path="/select" element={<CharacterSelect />} />
      <Route path="/team" element={<Home />} />
      <Route path="/team/:code" element={<Team />} />
      <Route path="/team/:code/individual" element={<IndividualPage />} />
      <Route path="/ranking" element={<RankingPage />} />
      <Route path="/result/:sessionId" element={<RankingPage />} />
      <Route path="/admin" element={<AdminDashboard />} />
    </Routes>
  )
}
