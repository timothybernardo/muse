import { useState, useEffect, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase, authService } from '../../services/supabase'
import logo from '../../assets/logo.png'
import './Navbar.css'

function Navbar({ user }) {
  const navigate = useNavigate()
  const [profile, setProfile] = useState(null)
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [notifOpen, setNotifOpen] = useState(false)
  const [notifications, setNotifications] = useState([])
  const [unreadCount, setUnreadCount] = useState(0)
  const notifRef = useRef(null)

  useEffect(() => {
    const fetchProfile = async () => {
      if (user) {
        const { data, error } = await supabase
          .from('profiles')
          .select('username, avatar_url')
          .eq('id', user.id)
          .single()
        if (!error && data) setProfile(data)
      }
    }
    fetchProfile()
  }, [user])

  useEffect(() => {
    if (user) {
      fetchNotifications()
      // Subscribe to new notifications
      const channel = supabase
        .channel('notifications')
        .on('postgres_changes', 
          { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` },
          () => fetchNotifications()
        )
        .subscribe()
      return () => supabase.removeChannel(channel)
    }
  }, [user])

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (notifRef.current && !notifRef.current.contains(e.target)) {
        setNotifOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const fetchNotifications = async () => {
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(20)

    if (!error && data) {
      // Fetch profiles for each notification
      const withProfiles = await Promise.all(
        data.map(async (notif) => {
          const { data: fromProfile } = await supabase
            .from('profiles')
            .select('username, avatar_url')
            .eq('id', notif.from_user_id)
            .single()
          return { ...notif, fromProfile }
        })
      )
      setNotifications(withProfiles)
      setUnreadCount(withProfiles.filter(n => !n.read).length)
    }
  }

  const handleNotifClick = async (notif) => {
    // Mark as read
    if (!notif.read) {
      await supabase
        .from('notifications')
        .update({ read: true })
        .eq('id', notif.id)
      setUnreadCount(prev => Math.max(0, prev - 1))
      setNotifications(notifications.map(n => 
        n.id === notif.id ? { ...n, read: true } : n
      ))
    }

    setNotifOpen(false)

    // Navigate based on type
    if (notif.type === 'follow') {
      navigate(`/profile/${notif.from_user_id}`)
    } else if (notif.album_id) {
      navigate(`/album/${notif.album_id}`)
    }
  }

  const markAllRead = async () => {
    await supabase
      .from('notifications')
      .update({ read: true })
      .eq('user_id', user.id)
      .eq('read', false)
    
    setNotifications(notifications.map(n => ({ ...n, read: true })))
    setUnreadCount(0)
  }

  const getNotifText = (notif) => {
    const name = notif.fromProfile?.username || 'Someone'
    switch (notif.type) {
      case 'like': return <><strong>{name}</strong> liked your review</>
      case 'comment': return <><strong>{name}</strong> commented: "{notif.comment_text?.slice(0, 30)}{notif.comment_text?.length > 30 ? '...' : ''}"</>
      case 'follow': return <><strong>{name}</strong> started following you</>
      default: return <><strong>{name}</strong> interacted with you</>
    }
  }

  const timeAgo = (date) => {
    const seconds = Math.floor((new Date() - new Date(date)) / 1000)
    if (seconds < 60) return 'now'
    const minutes = Math.floor(seconds / 60)
    if (minutes < 60) return `${minutes}m`
    const hours = Math.floor(minutes / 60)
    if (hours < 24) return `${hours}h`
    const days = Math.floor(hours / 24)
    return `${days}d`
  }

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
        
        {/* Notifications */}
        <div className="notif-container" ref={notifRef}>
          <button 
            className="notif-btn"
            onClick={() => setNotifOpen(!notifOpen)}
          >
            notifications
            {unreadCount > 0 && (
              <span className="notif-badge">{unreadCount > 9 ? '9+' : unreadCount}</span>
            )}
          </button>

          {notifOpen && (
            <div className="notif-dropdown">
              <div className="notif-header">
                <span>notifications</span>
                {unreadCount > 0 && (
                  <button className="mark-read-btn" onClick={markAllRead}>
                    mark all read
                  </button>
                )}
              </div>

              <div className="notif-list">
                {notifications.length > 0 ? (
                  notifications.map(notif => (
                    <div 
                      key={notif.id} 
                      className={`notif-item ${!notif.read ? 'unread' : ''}`}
                      onClick={() => handleNotifClick(notif)}
                    >
                      {notif.fromProfile?.avatar_url ? (
                        <img src={notif.fromProfile.avatar_url} alt="" className="notif-avatar" />
                      ) : (
                        <div className="notif-avatar" />
                      )}
                      <div className="notif-content">
                        <p className="notif-text">{getNotifText(notif)}</p>
                        <span className="notif-time">{timeAgo(notif.created_at)}</span>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="notif-empty">no notifications yet</p>
                )}
              </div>
            </div>
          )}
        </div>

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