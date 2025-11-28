import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../services/supabase'
import { spotifyService } from '../../services/spotify'
import './Albums.css'

function Albums() {
  const navigate = useNavigate()
  const [profile, setProfile] = useState(null)
  const [newReleases, setNewReleases] = useState([])
  const [recentlyReviewed, setRecentlyReviewed] = useState([])
  const [curatedAlbums, setCuratedAlbums] = useState([])
  const [loading, setLoading] = useState(true)

  // Placeholder stats - will come from your database later
  const getAlbumStats = (album) => ({
    listens: '1k',
    reviews: 100,
    rating: Math.floor(Math.random() * 3) + 3 // Random 3-5 for demo
  })

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Get current user profile
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
          const { data } = await supabase
            .from('profiles')
            .select('username')
            .eq('id', user.id)
            .single()
          setProfile(data)
        }

        // Fetch new releases from Spotify
        const releases = await spotifyService.getNewReleases(12)
        setNewReleases(releases)

        // For now, use same data for other sections
        // Later you'll fetch from your own database
        setRecentlyReviewed(releases.slice(0, 8))
        setCuratedAlbums(releases.slice(4, 12))

      } catch (error) {
        console.error('Error fetching data:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [])

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

  const AlbumCard = ({ album }) => {
    const stats = getAlbumStats(album)
    const coverImage = album.images?.[0]?.url || album.cover

    return (
      <div className="album-card" onClick={() => navigate(`/album/${album.id}`)}>
        <img src={coverImage} alt={album.name} className="album-cover" />
        <div className="album-stats">
          <span className="album-stat">🎧 {stats.listens}</span>
          <span className="album-stat">✎ {stats.reviews}</span>
        </div>
        <div className="album-rating">{renderStars(stats.rating)}</div>
      </div>
    )
  }

  const AlbumSection = ({ title, albums }) => {
    const [scrollIndex, setScrollIndex] = useState(0)
    const visibleCount = 4
    const maxIndex = Math.max(0, albums.length - visibleCount)

    const handleNext = () => {
      setScrollIndex(prev => Math.min(prev + 1, maxIndex))
    }

    const handlePrev = () => {
      setScrollIndex(prev => Math.max(prev - 1, 0))
    }

    const visibleAlbums = albums.slice(scrollIndex, scrollIndex + visibleCount)

    return (
      <div className="albums-section">
        <h2 className="section-title">{title}</h2>
        <div className="section-line"></div>
        <div className="albums-grid-container">
          <div className="albums-grid">
            {visibleAlbums.map(album => (
              <AlbumCard key={album.id} album={album} />
            ))}
          </div>
          <button 
            className="carousel-btn" 
            onClick={handleNext}
            disabled={scrollIndex >= maxIndex}
          >
            ›
          </button>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="albums-page">
        <p className="loading-text">loading albums...</p>
      </div>
    )
  }

  return (
    <div className="albums-page">
      <div className="albums-header">
        <h1 className="albums-greeting">
          start spinning, <span className="username">{profile?.username || 'user'}</span>
        </h1>
      </div>

      <AlbumSection title="projects released this week" albums={newReleases} />
      <AlbumSection title="recently posted by users" albums={recentlyReviewed} />
      <AlbumSection title="curated albums by the creator" albums={curatedAlbums} />
    </div>
  )
}

export default Albums