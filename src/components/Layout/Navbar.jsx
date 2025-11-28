import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { supabase, authService } from '../../services/supabase'
import logo from '../../assets/logo.png'
import './Navbar.css'

function Navbar({ user }) {
  const [profile, setProfile] = useState(null)
  const [dropdownOpen, setDropdownOpen] = useState(false)

  useEffect(() => {
    const fetchProfile = async () => {
      if (user) {
        const { data, error } = await supabase
          .from('profiles')
          .select('username, avatar_url')
          .eq('id', user.id)
          .single()

        if (!error && data) {
          setProfile(data)
        }
      }
    }

    fetchProfile()
  }, [user])

  const handleSignOut = async () => {
    await authService.signOut()
  }

  const displayName = profile?.username || user?.email?.split('@')[0] || 'user'
  const avatarUrl = profile?.avatar_url || null

  return (
    <nav className="navbar">
      <Link to="/albums" className="navbar-logo">
        <img src={logo} alt="Muse logo" className="navbar-logo-icon" />
        <span className="navbar-logo-text">muse</span>
      </Link>

      <div className="navbar-links">
        <Link to="/albums">albums</Link>
        <Link to="/find">find</Link>
        <Link to="/playlists">playlists</Link>
        <Link to="/profile">profile</Link>
        <Link to="/search">search</Link>

        <div className="navbar-dropdown">
          <div 
            className="navbar-profile" 
            onClick={() => setDropdownOpen(!dropdownOpen)}
          >
            {avatarUrl ? (
              <img src={avatarUrl} alt="Profile" className="navbar-avatar" />
            ) : (
              <div className="navbar-avatar" />
            )}
            <span className="navbar-username">{displayName}</span>
          </div>

          {dropdownOpen && (
            <div className="dropdown-menu">
              <Link to="/profile" onClick={() => setDropdownOpen(false)}>
                my profile
              </Link>
              <button onClick={handleSignOut}>
                sign out
              </button>
            </div>
          )}
        </div>
      </div>
    </nav>
  )
}

export default Navbar