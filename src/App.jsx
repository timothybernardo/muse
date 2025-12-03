import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { supabase, authService } from './services/supabase'
import { spotifyService } from './services/spotify'
import "./styles/App.css";

// Import components
import Login from './components/Auth/Login'
import SignUp from './components/Auth/SignUp'
import Home from './components/Pages/Home'
import Albums from './components/Pages/Albums'
import AlbumDetail from './components/Pages/AlbumDetail'
import Profile from './components/Pages/Profile'
import Playlists from './components/Pages/Playlists'
import PlaylistDetail from './components/Pages/PlaylistDetail'
import Search from './components/Pages/Search'
import Find from './components/Pages/Find'
import Navbar from './components/Layout/Navbar'
import './components/Skeleton.css'

function App() {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Check for existing session
    authService.getSession().then(session => {
      setUser(session?.user ?? null)
      setLoading(false)
      
      // Prefetch Spotify data if already logged in
      if (session?.user) {
        spotifyService.prefetch()
      }
    })

    // Listen for auth changes
    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null)
      
      // Prefetch when user logs in
      if (event === 'SIGNED_IN' && session) {
        spotifyService.prefetch()
      }
    })

    return () => {
      authListener.subscription.unsubscribe()
    }
  }, [])

  if (loading) {
    return <div className="loading">Loading...</div>
  }

  return (
    <Router>
      <div className="App">
        {user && <Navbar user={user} />}
        
        <Routes>
          {/* Public routes */}
          <Route path="/" element={!user ? <Home /> : <Navigate to="/albums" />} />
          <Route path="/login" element={!user ? <Login /> : <Navigate to="/albums" />} />
          <Route path="/signup" element={!user ? <SignUp /> : <Navigate to="/albums" />} />
          
          {/* Protected routes */}
          <Route path="/albums" element={user ? <Albums /> : <Navigate to="/login" />} />
          <Route path="/album/:id" element={user ? <AlbumDetail /> : <Navigate to="/login" />} />
          <Route path="/profile/:userId" element={user ? <Profile /> : <Navigate to="/login" />} />
          <Route path="/profile" element={user ? <Profile /> : <Navigate to="/login" />} />
          <Route path="/playlists" element={user ? <Playlists /> : <Navigate to="/login" />} />
          <Route path="/playlist/:id" element={user ? <PlaylistDetail /> : <Navigate to="/login" />} />
          <Route path="/search" element={user ? <Search /> : <Navigate to="/login" />} />
          <Route path="/find" element={user ? <Find /> : <Navigate to="/login" />} />
        </Routes>
      </div>
    </Router>
  )
}

export default App