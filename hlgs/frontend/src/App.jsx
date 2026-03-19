import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Navbar from './components/Navbar'
import Dashboard from './pages/Dashboard'
import GradeAnswer from './pages/GradeAnswer'
import Results from './pages/Results'
import History from './pages/History'

export default function App() {
  return (
    <BrowserRouter>
      <div className="bg-[#0a0a0f] min-h-screen">
        <Navbar />
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/grade" element={<GradeAnswer />} />
          <Route path="/results/:id" element={<Results />} />
          <Route path="/history" element={<History />} />
        </Routes>
      </div>
    </BrowserRouter>
  )
}
