import { useState, useEffect, useRef } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../../services/supabase'
import './Profile.css'

function Profile() {
  const { userId } = useParams()
  const [currentUser, setCurrentUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [showEditModal, setShowEditModal] = useState(false)
  const [editUsername, setEditUsername] = useState('')
  const [editBio, setEditBio] = useState('')
  const [avatarFile, setAvatarFile] = useState(null)
  const [avatarPreview, setAvatarPreview] = useState(null)
  const fileInputRef = useRef(null)

  // Placeholder data - replace with real data from Supabase later
  const [stats, setStats] = useState({
    albumsListened: 0,
    averageRating: 0,
    playlistCount: 0
  })

  const [favoriteAlbums, setFavoriteAlbums] = useState([
    { id: 1, title: 'Thriller', cover: 'https://upload.wikimedia.org/wikipedia/en/5/55/Michael_Jackson_-_Thriller.png', listens: '1k', reviews: 100, rating: 5 },
    { id: 2, title: 'Hurry Up Tomorrow', cover: 'https://upload.wikimedia.org/wikipedia/en/f/f0/The_Weeknd_-_Hurry_Up_Tomorrow.png', listens: '1k', reviews: 100, rating: 3 },
    { id: 3, title: 'Utopia', cover: 'https://i.scdn.co/image/ab67616d00001e0204481c826dd292e5e4983b3f', listens: '1k', reviews: 100, rating: 4 },
    { id: 4, title: 'Cry', cover: 'https://images.genius.com/7f53e3ec9752c0f901d9d1370b569507.1000x1000x1.jpg', listens: '1k', reviews: 100, rating: 3.5 },
  ])

  const [recentlyListened, setRecentlyListened] = useState([
    { id: 1, title: 'Thriller', cover: 'https://upload.wikimedia.org/wikipedia/en/5/55/Michael_Jackson_-_Thriller.png', listens: '1k', reviews: 100, rating: 5 },
    { id: 2, title: 'Hurry Up Tomorrow', cover: 'https://upload.wikimedia.org/wikipedia/en/f/f0/The_Weeknd_-_Hurry_Up_Tomorrow.png', listens: '1k', reviews: 100, rating: 3 },
    { id: 3, title: 'Utopia', cover: 'https://i.scdn.co/image/ab67616d00001e0204481c826dd292e5e4983b3f', listens: '1k', reviews: 100, rating: 4 },
    { id: 4, title: 'Cry', cover: 'https://images.genius.com/7f53e3ec9752c0f901d9d1370b569507.1000x1000x1.jpg', listens: '1k', reviews: 100, rating: 3.5 },
  ])

  const [playlists, setPlaylists] = useState([
    {
      id: 1,
      name: '2025 highlights',
      description: 'playlist description',
      albums: [
        'https://upload.wikimedia.org/wikipedia/en/5/55/Michael_Jackson_-_Thriller.png',
        'https://upload.wikimedia.org/wikipedia/en/f/f0/The_Weeknd_-_Hurry_Up_Tomorrow.png',
        'https://i.scdn.co/image/ab67616d00001e0204481c826dd292e5e4983b3f',
        'https://images.genius.com/7f53e3ec9752c0f901d9d1370b569507.1000x1000x1.jpg',
      ]
    }
  ])

  useEffect(() => {
    const fetchData = async () => {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser()
      setCurrentUser(user)

      // Determine which profile to load
      const profileId = userId || user?.id

      if (profileId) {
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', profileId)
          .single()

        if (!error && data) {
          setProfile(data)
          setEditUsername(data.username || '')
          setEditBio(data.bio || '')
        }
      }

      setLoading(false)
    }

    fetchData()
  }, [userId])

  const isOwnProfile = currentUser?.id === (userId || currentUser?.id)

  const renderStars = (rating) => {
    const stars = []
    const fullStars = Math.floor(rating)
    const hasHalf = rating % 1 !== 0
    for (let i = 0; i < fullStars; i++) {
      stars.push(<span key={i} className="star filled">★</span>)
    }
    if (hasHalf) {
      stars.push(<span key="half" className="star half">★</span>)
    }
    const empty = 5 - Math.ceil(rating)
    for (let i = 0; i < empty; i++) {
      stars.push(<span key={`empty-${i}`} className="star empty">★</span>)
    }
    return stars
  }

  const handleAvatarChange = (e) => {
    const file = e.target.files[0]
    if (file) {
      setAvatarFile(file)
      setAvatarPreview(URL.createObjectURL(file))
    }
  }

  const handleSaveProfile = async () => {
    let avatarUrl = profile?.avatar_url

    // Upload avatar if changed
    if (avatarFile) {
      const fileExt = avatarFile.name.split('.').pop()
      const fileName = `${currentUser.id}.${fileExt}`
      
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(fileName, avatarFile, { upsert: true })

      if (!uploadError) {
        const { data } = supabase.storage
          .from('avatars')
          .getPublicUrl(fileName)
        avatarUrl = data.publicUrl
      }
    }

    // Update profile
    const { error } = await supabase
      .from('profiles')
      .update({
        username: editUsername,
        bio: editBio,
        avatar_url: avatarUrl
      })
      .eq('id', currentUser.id)

    if (!error) {
      setProfile({
        ...profile,
        username: editUsername,
        bio: editBio,
        avatar_url: avatarUrl
      })
      setShowEditModal(false)
      setAvatarFile(null)
      setAvatarPreview(null)
    }
  }

  if (loading) {
    return <div className="profile-page">Loading...</div>
  }

  return (
    <div className="profile-page">
      {/* Profile Header */}
      <div className="profile-header">
        {profile?.avatar_url ? (
          <img src={profile.avatar_url} alt="Avatar" className="profile-avatar" />
        ) : (
          <div className="profile-avatar" />
        )}
        
        <div className="profile-info">
          <h1 className="profile-username">{profile?.username || 'User'}</h1>
          <p className="profile-bio">{profile?.bio || 'No bio yet'}</p>
        </div>

        <div className="profile-stats">
          <div className="stat-item">
            <div className="stat-number">{stats.albumsListened}</div>
            <div className="stat-label">albums listened</div>
          </div>
          <div className="stat-item">
            <div className="stat-number">{stats.averageRating.toFixed(1)}</div>
            <div className="stat-label">average rating</div>
          </div>
          <div className="stat-item">
            <div className="stat-number">{stats.playlistCount}</div>
            <div className="stat-label">playlists</div>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      {isOwnProfile && (
        <div className="profile-actions">
          <button className="action-btn">post review</button>
          <button className="action-btn">make playlist</button>
          <button className="action-btn" onClick={() => setShowEditModal(true)}>edit profile</button>
        </div>
      )}

      {/* Favorite Albums */}
      <div className="profile-section">
        <h2 className="section-title">favorite albums</h2>
        <div className="section-line"></div>
        <div className="albums-grid-container">
          <div className="albums-grid">
            {favoriteAlbums.map(album => (
              <div key={album.id} className="album-card">
                <img src={album.cover} alt={album.title} className="album-cover" />
                <div className="album-stats">
                  <span className="album-stat">🎧 {album.listens}</span>
                  <span className="album-stat">✎ {album.reviews}</span>
                </div>
                <div className="album-rating">{renderStars(album.rating)}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recently Listened */}
      <div className="profile-section">
        <h2 className="section-title">recently listened</h2>
        <div className="section-line"></div>
        <div className="albums-grid-container">
          <div className="albums-grid">
            {recentlyListened.map(album => (
              <div key={album.id} className="album-card">
                <img src={album.cover} alt={album.title} className="album-cover" />
                <div className="album-stats">
                  <span className="album-stat">🎧 {album.listens}</span>
                  <span className="album-stat">✎ {album.reviews}</span>
                </div>
                <div className="album-rating">{renderStars(album.rating)}</div>
              </div>
            ))}
          </div>
          <button className="carousel-next-btn">›</button>
        </div>
      </div>

      {/* Playlists */}
      <div className="profile-section">
        <h2 className="section-title">playlists</h2>
        <div className="section-line"></div>
        {playlists.map(playlist => (
          <div key={playlist.id} className="playlist-item">
            <div className="playlist-header">
              <span className="playlist-name">{playlist.name}</span>
              <span className="playlist-description">{playlist.description}</span>
            </div>
            <div className="playlist-albums">
              {playlist.albums.map((cover, index) => (
                <img key={index} src={cover} alt="Album" className="playlist-album-cover" />
              ))}
              {isOwnProfile && (
                <button className="add-playlist-btn">+</button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Edit Profile Modal */}
      {showEditModal && (
        <div className="modal-overlay" onClick={() => setShowEditModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2 className="modal-title">edit profile</h2>
            
            <div className="avatar-upload">
              {avatarPreview || profile?.avatar_url ? (
                <img src={avatarPreview || profile.avatar_url} alt="Avatar" className="avatar-preview" />
              ) : (
                <div className="avatar-preview" />
              )}
              <button className="avatar-upload-btn" onClick={() => fileInputRef.current?.click()}>
                change photo
              </button>
              <input
                type="file"
                ref={fileInputRef}
                className="hidden-input"
                accept="image/*"
                onChange={handleAvatarChange}
              />
            </div>

            <input
              type="text"
              placeholder="username"
              className="modal-input"
              value={editUsername}
              onChange={(e) => setEditUsername(e.target.value)}
            />
            <textarea
              placeholder="bio"
              className="modal-textarea"
              value={editBio}
              onChange={(e) => setEditBio(e.target.value)}
            />

            <div className="modal-buttons">
              <button className="modal-btn cancel" onClick={() => setShowEditModal(false)}>
                cancel
              </button>
              <button className="modal-btn save" onClick={handleSaveProfile}>
                save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default Profile