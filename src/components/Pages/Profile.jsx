import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../../services/supabase'
import { spotifyService } from '../../services/spotify'
import './Profile.css'
import FollowsModal from './FollowsModal'

function Profile() {
  const { userId } = useParams()
  const navigate = useNavigate()
  const [currentUser, setCurrentUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [showEditModal, setShowEditModal] = useState(false)
  const [editUsername, setEditUsername] = useState('')
  const [editBio, setEditBio] = useState('')
  const [avatarFile, setAvatarFile] = useState(null)
  const [avatarPreview, setAvatarPreview] = useState(null)
  const fileInputRef = useRef(null)
  const [showFollowsModal, setShowFollowsModal] = useState(false)
  const [followsTab, setFollowsTab] = useState('followers')

  const [stats, setStats] = useState({
    albumsListened: 0,
    averageRating: 0,
    playlistCount: 0,
    followersCount: 0,
    followingCount: 0
  })
  const [reviews, setReviews] = useState([])
  const [recentlyListened, setRecentlyListened] = useState([])
  const [playlists, setPlaylists] = useState([])
  const [favoriteAlbums, setFavoriteAlbums] = useState([])
  const [isFollowing, setIsFollowing] = useState(false)
  const [showFavoritesModal, setShowFavoritesModal] = useState(false)
  const [favSearchQuery, setFavSearchQuery] = useState('')
  const [favSearchResults, setFavSearchResults] = useState([])
  const [favSearching, setFavSearching] = useState(false)
  const [showReviewModal, setShowReviewModal] = useState(false)
  const [editingReview, setEditingReview] = useState(null)
  const [modalRating, setModalRating] = useState(0)
  const [reviewText, setReviewText] = useState('')

  useEffect(() => {
    setProfile(null)
    setReviews([])
    setRecentlyListened([])
    setPlaylists([])
    setFavoriteAlbums([])
    setStats({ albumsListened: 0, averageRating: 0, playlistCount: 0, followersCount: 0, followingCount: 0 })
    setIsFollowing(false)
    setLoading(true)
    fetchData()
  }, [userId])

  const fetchData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      setCurrentUser(user)
      const profileId = userId || user?.id

      if (profileId) {
        const { data: profileData } = await supabase.from('profiles').select('*').eq('id', profileId).single()
        if (profileData) {
          setProfile(profileData)
          setEditUsername(profileData.username || '')
          setEditBio(profileData.bio || '')
        }

        const { data: reviewsData } = await supabase.from('reviews').select('*').eq('user_id', profileId).order('created_at', { ascending: false })
        if (reviewsData && reviewsData.length > 0) {
          const reviewsWithAlbums = await Promise.all(
            reviewsData.map(async (review) => {
              try {
                const album = await spotifyService.getAlbum(review.album_id)
                return { ...review, album }
              } catch (e) { return { ...review, album: null } }
            })
          )
          setReviews(reviewsWithAlbums.filter(r => r.album))
        } else { setReviews([]) }

        const { data: listensData } = await supabase.from('listens').select('*').eq('user_id', profileId).order('listened_at', { ascending: false }).limit(10)
        if (listensData && listensData.length > 0) {
          const listensWithAlbums = await Promise.all(
            listensData.map(async (listen) => {
              try {
                const album = await spotifyService.getAlbum(listen.album_id)
                return { ...listen, album }
              } catch (e) { return { ...listen, album: null } }
            })
          )
          setRecentlyListened(listensWithAlbums.filter(l => l.album))
        }

        const { data: playlistsData } = await supabase.from('playlists').select('*').eq('user_id', profileId).order('created_at', { ascending: false })
        if (playlistsData) {
          const playlistsWithSongs = await Promise.all(
            playlistsData.map(async (playlist) => {
              const { data: songs } = await supabase.from('playlist_songs').select('album_cover').eq('playlist_id', playlist.id).order('position', { ascending: true }).limit(4)
              return { ...playlist, songs: songs || [] }
            })
          )
          setPlaylists(playlistsWithSongs)
        }

        const { data: favoritesData } = await supabase.from('favorite_albums').select('*').eq('user_id', profileId).order('position', { ascending: true })
        if (favoritesData && favoritesData.length > 0) {
          const favoritesWithAlbums = await Promise.all(
            favoritesData.map(async (fav) => {
              try {
                const album = await spotifyService.getAlbum(fav.album_id)
                return { ...fav, album }
              } catch (e) { return { ...fav, album: null } }
            })
          )
          setFavoriteAlbums(favoritesWithAlbums.filter(f => f.album))
        }

        const { count: followersCount } = await supabase.from('follows').select('*', { count: 'exact', head: true }).eq('following_id', profileId)
        const { count: followingCount } = await supabase.from('follows').select('*', { count: 'exact', head: true }).eq('follower_id', profileId)

        if (user && profileId !== user.id) {
          const { data: followData } = await supabase.from('follows').select('id').eq('follower_id', user.id).eq('following_id', profileId).maybeSingle()
          setIsFollowing(!!followData)
        }

        const listenCount = listensData?.length || 0
        const playlistCount = playlistsData?.length || 0
        const avgRating = reviewsData && reviewsData.length > 0 ? reviewsData.reduce((sum, r) => sum + (r.rating || 0), 0) / reviewsData.length : 0

        setStats({ albumsListened: listenCount, averageRating: avgRating, playlistCount, followersCount: followersCount || 0, followingCount: followingCount || 0 })
      }
    } catch (error) { console.error('Error fetching profile data:', error) }
    finally { setLoading(false) }
  }

  const isOwnProfile = currentUser?.id === (userId || currentUser?.id)

  const renderStars = (rating) => {
    const stars = []
    const fullStars = Math.floor(rating)
    const hasHalf = rating % 1 !== 0
    for (let i = 0; i < fullStars; i++) stars.push(<span key={i} className="star filled">★</span>)
    if (hasHalf) stars.push(<span key="half" className="star half">★</span>)
    const empty = 5 - Math.ceil(rating)
    for (let i = 0; i < empty; i++) stars.push(<span key={`empty-${i}`} className="star empty">★</span>)
    return stars
  }

  const handleAvatarChange = (e) => {
    const file = e.target.files[0]
    if (file) { setAvatarFile(file); setAvatarPreview(URL.createObjectURL(file)) }
  }

  const handleSaveProfile = async () => {
    let avatarUrl = profile?.avatar_url
    if (avatarFile) {
      const fileExt = avatarFile.name.split('.').pop()
      const fileName = `${currentUser.id}.${fileExt}`
      const { error: uploadError } = await supabase.storage.from('avatars').upload(fileName, avatarFile, { upsert: true })
      if (!uploadError) {
        const { data } = supabase.storage.from('avatars').getPublicUrl(fileName)
        avatarUrl = data.publicUrl
      }
    }
    const { error } = await supabase.from('profiles').update({ username: editUsername, bio: editBio, avatar_url: avatarUrl }).eq('id', currentUser.id)
    if (!error) {
      setProfile({ ...profile, username: editUsername, bio: editBio, avatar_url: avatarUrl })
      setShowEditModal(false); setAvatarFile(null); setAvatarPreview(null)
    }
  }

  const handleFavSearch = async () => {
    if (!favSearchQuery.trim()) return
    setFavSearching(true)
    try { const albums = await spotifyService.searchAlbums(favSearchQuery, 10); setFavSearchResults(albums) }
    catch (error) { console.error('Search error:', error) }
    finally { setFavSearching(false) }
  }

  const handleAddFavorite = async (album) => {
    if (!currentUser) return
    const exists = favoriteAlbums.find(f => f.album_id === album.id)
    if (exists) { alert('This album is already in your favorites!'); return }
    if (favoriteAlbums.length >= 4) { alert('You can only have 4 favorite albums. Remove one first.'); return }
    const { error } = await supabase.from('favorite_albums').insert({ user_id: currentUser.id, album_id: album.id, album_name: album.name, album_cover: album.images?.[0]?.url, artist_name: album.artists?.map(a => a.name).join(', '), position: favoriteAlbums.length + 1 })
    if (!error) { setFavoriteAlbums([...favoriteAlbums, { album_id: album.id, album }]); setShowFavoritesModal(false); setFavSearchQuery(''); setFavSearchResults([]) }
  }

  const handleRemoveFavorite = async (albumId) => {
    if (!currentUser) return
    const { error } = await supabase.from('favorite_albums').delete().eq('user_id', currentUser.id).eq('album_id', albumId)
    if (!error) setFavoriteAlbums(favoriteAlbums.filter(f => f.album_id !== albumId))
  }

  const handleFollowClick = async () => {
    if (!currentUser) { alert('Please log in to follow users'); return }
    const profileId = userId || profile?.id
    
    if (isFollowing) {
      // Unfollow
      const { error } = await supabase.from('follows').delete().eq('follower_id', currentUser.id).eq('following_id', profileId)
      if (!error) { 
        setIsFollowing(false)
        setStats(prev => ({ ...prev, followersCount: prev.followersCount - 1 }))
      }
    } else {
      // Follow
      const { error } = await supabase.from('follows').insert({ follower_id: currentUser.id, following_id: profileId })
      if (!error) { 
        setIsFollowing(true)
        setStats(prev => ({ ...prev, followersCount: prev.followersCount + 1 }))
        
        // Send follow notification
        await supabase.from('notifications').insert({
          user_id: profileId,
          from_user_id: currentUser.id,
          type: 'follow'
        })
      }
    }
  }

  const handleEditReview = (review) => { setEditingReview(review); setModalRating(review.rating || 0); setReviewText(review.review_text || ''); setShowReviewModal(true) }

  const handleSaveReview = async () => {
    if (!editingReview || !modalRating) return
    const { error } = await supabase.from('reviews').update({ rating: modalRating, review_text: reviewText }).eq('id', editingReview.id)
    if (!error) { setShowReviewModal(false); setEditingReview(null); fetchData() }
    else alert('Error updating review: ' + error.message)
  }

  const handleDeleteReview = async () => {
    if (!editingReview) return
    if (!confirm('Are you sure you want to delete this review?')) return
    const { error } = await supabase.from('reviews').delete().eq('id', editingReview.id)
    if (!error) { setShowReviewModal(false); setEditingReview(null); fetchData() }
    else alert('Error deleting review: ' + error.message)
  }

  const formatDate = (dateString) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }

  if (loading) return <div className="profile-page">Loading...</div>

  return (
    <div className="profile-page">
      <div className="profile-header">
        {profile?.avatar_url ? (
          <img src={profile.avatar_url} alt="Avatar" className="profile-avatar" />
        ) : (
          <div className="profile-avatar" />
        )}
        
        <div className="profile-info">
          <h1 className="profile-username">{profile?.username || 'User'}</h1>
          <div className="profile-follow-stats">
            <span onClick={() => { setFollowsTab('followers'); setShowFollowsModal(true) }} style={{ cursor: 'pointer' }}>
              <strong>{stats.followersCount}</strong> followers
            </span>
            <span onClick={() => { setFollowsTab('following'); setShowFollowsModal(true) }} style={{ cursor: 'pointer' }}>
              <strong>{stats.followingCount}</strong> following
            </span>
          </div>
          {profile?.bio && <p className="profile-bio">{profile.bio}</p>}
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

      {isOwnProfile ? (
        <div className="profile-actions">
          <button className="action-btn" onClick={() => navigate('/albums')}>post review</button>
          <button className="action-btn" onClick={() => navigate('/playlists')}>make playlist</button>
          <button className="action-btn" onClick={() => setShowEditModal(true)}>edit profile</button>
        </div>
      ) : (
        <div className="profile-actions">
          <button className={`action-btn ${isFollowing ? 'following' : ''}`} onClick={handleFollowClick}>
            {isFollowing ? 'following' : 'follow'}
          </button>
        </div>
      )}

      <div className="profile-section">
        <div className="section-header">
          <h2 className="section-title">favorite albums</h2>
          {isOwnProfile && <button className="edit-section-btn" onClick={() => setShowFavoritesModal(true)}>+ add</button>}
        </div>
        <div className="section-line"></div>
        <div className="albums-grid-container">
          <div className="albums-grid">
            {favoriteAlbums.length > 0 ? favoriteAlbums.map(fav => (
              <div key={fav.album_id} className="album-card" onClick={() => navigate(`/album/${fav.album_id}`)}>
                <div className="album-cover-wrapper">
                  <img src={fav.album?.images?.[0]?.url || fav.album_cover} alt={fav.album?.name} className="album-cover" />
                  {isOwnProfile && <button className="remove-fav-btn" onClick={(e) => { e.stopPropagation(); handleRemoveFavorite(fav.album_id) }}>×</button>}
                </div>
                <p className="album-title">{fav.album?.name}</p>
                <p className="album-artist">{fav.album?.artists?.map(a => a.name).join(', ')}</p>
              </div>
            )) : <p className="empty-text">No favorite albums yet</p>}
          </div>
        </div>
      </div>

      <div className="profile-section">
        <h2 className="section-title">recently listened</h2>
        <div className="section-line"></div>
        <div className="albums-grid-container">
          <div className="albums-grid">
            {recentlyListened.length > 0 ? recentlyListened.map(listen => (
              <div key={listen.id} className="album-card" onClick={() => navigate(`/album/${listen.album_id}`)}>
                <img src={listen.album?.images?.[0]?.url} alt={listen.album?.name} className="album-cover" />
                <p className="album-title">{listen.album?.name}</p>
                <p className="album-artist">{listen.album?.artists?.map(a => a.name).join(', ')}</p>
              </div>
            )) : <p className="empty-text">No listens yet</p>}
          </div>
        </div>
      </div>

      <div className="profile-section">
        <h2 className="section-title">reviews</h2>
        <div className="section-line"></div>
        <div className="reviews-list">
          {reviews.length > 0 ? reviews.map(review => (
            <div key={review.id} className="profile-review-card">
              <img src={review.album?.images?.[0]?.url} alt={review.album?.name} className="profile-review-cover" onClick={() => navigate(`/album/${review.album_id}`)} />
              <div className="profile-review-content">
                <div className="profile-review-header">
                  <div className="profile-review-info" onClick={() => navigate(`/album/${review.album_id}`)}>
                    <h3 className="profile-review-album">{review.album?.name}</h3>
                    <p className="profile-review-artist">{review.album?.artists?.map(a => a.name).join(', ')}</p>
                    <span className="profile-review-date">{formatDate(review.created_at)}</span>
                  </div>
                  <div className="profile-review-stars">{renderStars(review.rating)}</div>
                </div>
                {review.review_text && <p className="profile-review-text">{review.review_text}</p>}
                {isOwnProfile && <button className="edit-review-btn" onClick={(e) => { e.stopPropagation(); handleEditReview(review) }}>edit</button>}
              </div>
            </div>
          )) : <p className="empty-text">No reviews yet</p>}
        </div>
      </div>

      <div className="profile-section">
        <h2 className="section-title">playlists</h2>
        <div className="section-line"></div>
        {playlists.length > 0 ? playlists.map(playlist => (
          <div key={playlist.id} className="playlist-item" onClick={() => navigate(`/playlist/${playlist.id}`)}>
            <div className="playlist-header">
              <span className="playlist-name">{playlist.title}</span>
              <span className="playlist-description">{playlist.description}</span>
            </div>
            <div className="playlist-albums">
              {playlist.songs?.slice(0, 4).map((song, index) => <img key={index} src={song.album_cover} alt="Album" className="playlist-album-cover" />)}
              {playlist.songs?.length === 0 && <p className="empty-text">No songs yet</p>}
            </div>
          </div>
        )) : <p className="empty-text">No playlists yet</p>}
      </div>

      {showEditModal && (
        <div className="modal-overlay" onClick={() => setShowEditModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2 className="modal-title">edit profile</h2>
            <div className="avatar-upload">
              {avatarPreview || profile?.avatar_url ? <img src={avatarPreview || profile.avatar_url} alt="Avatar" className="avatar-preview" /> : <div className="avatar-preview" />}
              <button className="avatar-upload-btn" onClick={() => fileInputRef.current?.click()}>change photo</button>
              <input type="file" ref={fileInputRef} className="hidden-input" accept="image/*" onChange={handleAvatarChange} />
            </div>
            <input type="text" placeholder="username" className="modal-input" value={editUsername} onChange={(e) => setEditUsername(e.target.value)} />
            <textarea placeholder="bio" className="modal-textarea" value={editBio} onChange={(e) => setEditBio(e.target.value)} />
            <div className="modal-buttons">
              <button className="modal-btn cancel" onClick={() => setShowEditModal(false)}>cancel</button>
              <button className="modal-btn save" onClick={handleSaveProfile}>save</button>
            </div>
          </div>
        </div>
      )}

      {showFavoritesModal && (
        <div className="modal-overlay" onClick={() => setShowFavoritesModal(false)}>
          <div className="modal-content fav-modal" onClick={(e) => e.stopPropagation()}>
            <h2 className="modal-title">add favorite album</h2>
            <div className="fav-search-bar">
              <input type="text" placeholder="search for an album..." className="modal-input" value={favSearchQuery} onChange={(e) => setFavSearchQuery(e.target.value)} onKeyPress={(e) => e.key === 'Enter' && handleFavSearch()} />
              <button className="search-btn" onClick={handleFavSearch} disabled={favSearching}>{favSearching ? '...' : 'search'}</button>
            </div>
            <div className="fav-search-results">
              {favSearchResults.map(album => (
                <div key={album.id} className="fav-search-item" onClick={() => handleAddFavorite(album)}>
                  <img src={album.images?.[0]?.url} alt={album.name} className="fav-search-cover" />
                  <div className="fav-search-info">
                    <p className="fav-search-name">{album.name}</p>
                    <p className="fav-search-artist">{album.artists?.map(a => a.name).join(', ')}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="modal-buttons"><button className="modal-btn cancel" onClick={() => setShowFavoritesModal(false)}>close</button></div>
          </div>
        </div>
      )}

      {showReviewModal && (
        <div className="modal-overlay" onClick={() => setShowReviewModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2 className="modal-title">edit review</h2>
            {editingReview && (
              <div className="editing-album-info">
                <img src={editingReview.album?.images?.[0]?.url} alt="" className="editing-album-cover" />
                <div>
                  <p className="editing-album-name">{editingReview.album?.name}</p>
                  <p className="editing-album-artist">{editingReview.album?.artists?.map(a => a.name).join(', ')}</p>
                </div>
              </div>
            )}
            <div className="modal-rating">
              {[1, 2, 3, 4, 5].map(star => <span key={star} className={`modal-star ${star <= modalRating ? 'active' : ''}`} onClick={() => setModalRating(star)}>★</span>)}
            </div>
            <textarea placeholder="Write your review here..." className="modal-textarea" value={reviewText} onChange={(e) => setReviewText(e.target.value)} />
            <div className="modal-buttons">
              <button className="modal-btn delete" onClick={handleDeleteReview}>delete</button>
              <button className="modal-btn cancel" onClick={() => setShowReviewModal(false)}>cancel</button>
              <button className="modal-btn save" onClick={handleSaveReview}>save</button>
            </div>
          </div>
        </div>
      )}

      {showFollowsModal && (
        <FollowsModal 
          userId={userId || currentUser?.id}
          initialTab={followsTab}
          onClose={() => setShowFollowsModal(false)}
        />
      )}
    </div>
  )
}

export default Profile