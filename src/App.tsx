import { useEffect } from 'react'
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useStore } from './store'
import Layout from './components/Layout'
import Login from './pages/Login'
import Home from './pages/Home'
import Problems from './pages/Problems'
import ProblemDetail from './pages/ProblemDetail'
import Submissions from './pages/Submissions'
import Settings from './pages/Settings'

function App() {
  const { isAuthenticated, settings, loadSettings, loadSolvedProblems, loadBookmarkedProblems } = useStore()

  useEffect(() => {
    loadSettings()
    loadSolvedProblems()
    loadBookmarkedProblems()
  }, [loadSettings, loadSolvedProblems, loadBookmarkedProblems])

  useEffect(() => {
    document.documentElement.classList.remove('dark', 'light')
    document.documentElement.classList.add(settings.theme)
  }, [settings.theme])

  return (
    <HashRouter>
      <Routes>
        <Route path="/login" element={isAuthenticated ? <Navigate to="/" /> : <Login />} />
        <Route path="/" element={isAuthenticated ? <Layout /> : <Navigate to="/login" />}>
          <Route index element={<Home />} />
          <Route path="problems" element={<Problems />} />
          <Route path="problems/:slug" element={<ProblemDetail />} />
          <Route path="submissions" element={<Submissions />} />
          <Route path="settings" element={<Settings />} />
        </Route>
      </Routes>
    </HashRouter>
  )
}

export default App
