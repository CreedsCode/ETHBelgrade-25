import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import FriendDashboardPage from './pages/FriendDashboardPage.tsx'
import PayPage from './pages/PayPage.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Router>
      <Routes>
        <Route path="/" element={<App />} />
        <Route path="/stats" element={<FriendDashboardPage />} />
        <Route path="/pay" element={<PayPage />} />
      </Routes>
    </Router>
  </StrictMode>,
)
