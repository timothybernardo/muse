import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../services/supabase'
import { spotifyService } from '../../services/spotify'
import './Albums.css'

function Albums() {
  const navigate = useNavigate()
  const [profile, setProfile] = useState(null)
  const [followingReviews, setFollowingReviews] = useState([])
  const [recentlyReviewed, setRecentlyReviewed] = useState([])
  const [loading, setLoading] = useState(true)
  const [albumStats, setAlbumStats] = useState({})

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data } = await supabase
          .from('profiles')
          .select('username')
          .eq('id', user.id)
          .single()
        setProfile(data)

        // 1. RECENTLY REVIEWED BY PEOPLE YOU FOLLOW
        const { data: following } = await supabase
          .from('follows')
          .select('following_id')
          .eq('follower_id', user.id)

        if (following && following.length > 0) {
          const followingIds = following.map(f => f.following_id)
          
          const { data: followingReviewsData } = await supabase
            .from('reviews')
            .select('album_id')
            .in('user_id', followingIds)
            .order('created_at', { ascending: false })
            .limit(30)

          if (followingReviewsData && followingReviewsData.length > 0) {
            const uniqueAlbumIds = [...new Set(followingReviewsData.map(r => r.album_id))]
            const albums = await Promise.all(
              uniqueAlbumIds.slice(0, 15).map(async (albumId) => {
                try {
                  return await spotifyService.getAlbum(albumId)
                } catch (e) {
                  return null
                }
              })
            )
            setFollowingReviews(albums.filter(a => a !== null))
          }
        }
      }

      // 2. RECENTLY REVIEWED BY ALL USERS
      const { data: recentReviews } = await supabase
        .from('reviews')
        .select('album_id')
        .order('created_at', { ascending: false })
        .limit(30)

      if (recentReviews && recentReviews.length > 0) {
        const uniqueAlbumIds = [...new Set(recentReviews.map(r => r.album_id))]
        const reviewedAlbums = await Promise.all(
          uniqueAlbumIds.slice(0, 15).map(async (albumId) => {
            try {
              return await spotifyService.getAlbum(albumId)
            } catch (e) {
              return null
            }
          })
        )
        setRecentlyReviewed(reviewedAlbums.filter(a => a !== null))
      }

      // Fetch real stats for all albums
      const allAlbumIds = recentReviews?.map(r => r.album_id) || []
      const stats = {}
      const uniqueIds = [...new Set(allAlbumIds)]
      
      for (const albumId of uniqueIds) {
        const { count: listenCount } = await supabase
          .from('listens')
          .select('*', { count: 'exact', head: true })
          .eq('album_id', albumId)
        
        const { data: reviews } = await supabase
          .from('reviews')
          .select('rating')
          .eq('album_id', albumId)
        
        const reviewCount = reviews?.length || 0
        const avgRating = reviewCount > 0 
          ? reviews.reduce((sum, r) => sum + (r.rating || 0), 0) / reviewCount 
          : 0
        
        stats[albumId] = {
          listens: listenCount || 0,
          reviews: reviewCount,
          rating: avgRating
        }
      }
      
      setAlbumStats(stats)

    } catch (error) {
      console.error('Error fetching data:', error)
    } finally {
      setLoading(false)
    }
  }

  const formatListens = (count) => {
    if (count >= 1000) return (count / 1000).toFixed(1) + 'k'
    return count.toString()
  }

  const renderStars = (rating) => {
    const stars = []
    const fullStars = Math.floor(rating)
    const hasHalf = rating % 1 >= 0.5
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
    const stats = albumStats[album.id] || { listens: 0, reviews: 0, rating: 0 }
    const coverImage = album.images?.[0]?.url || album.cover

    return (
      <div className="album-card" onClick={() => navigate(`/album/${album.id}`)}>
        <img src={coverImage} alt={album.name} className="album-cover" />
        <div className="album-stats">
          <span className="album-stat">🎧 {formatListens(stats.listens)}</span>
          <span className="album-stat">✎ {stats.reviews}</span>
        </div>
        <div className="album-rating">{renderStars(stats.rating)}</div>
      </div>
    )
  }

  const AlbumSection = ({ title, albums }) => {
    const [scrollIndex, setScrollIndex] = useState(0)
    const visibleCount = 5
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
          {scrollIndex > 0 && (
            <button className="carousel-btn prev" onClick={handlePrev}>
              ‹
            </button>
          )}
          <div className="albums-grid">
            {visibleAlbums.map(album => (
              <AlbumCard key={album.id} album={album} />
            ))}
          </div>
          {scrollIndex < maxIndex && (
            <button className="carousel-btn" onClick={handleNext}>
              ›
            </button>
          )}
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

      {followingReviews.length > 0 && (
        <AlbumSection title="reviewed by people you follow" albums={followingReviews} />
      )}
      
      {recentlyReviewed.length > 0 && (
        <AlbumSection title="recently reviewed" albums={recentlyReviewed} />
      )}

      {followingReviews.length === 0 && recentlyReviewed.length === 0 && (
        <p className="loading-text">No reviews yet. Start exploring and reviewing albums!</p>
      )}
    </div>
  )
}

export default Albums