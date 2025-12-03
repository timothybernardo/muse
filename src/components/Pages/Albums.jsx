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
  const [popularOnMuse, setPopularOnMuse] = useState([])
  const [highlyRated, setHighlyRated] = useState([])
  const [discoverAlbums, setDiscoverAlbums] = useState([])
  const [usersToFollow, setUsersToFollow] = useState([])
  const [loading, setLoading] = useState(true)
  const [albumStats, setAlbumStats] = useState({})
  const [hasFollowing, setHasFollowing] = useState(false)

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      let followingIds = []
      
      if (user) {
        const { data } = await supabase
          .from('profiles')
          .select('username')
          .eq('id', user.id)
          .single()
        setProfile(data)

        // Check if user follows anyone
        const { data: following } = await supabase
          .from('follows')
          .select('following_id')
          .eq('follower_id', user.id)

        if (following && following.length > 0) {
          setHasFollowing(true)
          followingIds = following.map(f => f.following_id)
          
          // REVIEWED BY PEOPLE YOU FOLLOW
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

        // USERS TO FOLLOW (if not following anyone)
        if (!following || following.length === 0) {
          const { data: activeUsers } = await supabase
            .from('profiles')
            .select('id, username, avatar_url')
            .neq('id', user.id)
            .limit(10)

          if (activeUsers) {
            // Get review counts for each user
            const usersWithStats = await Promise.all(
              activeUsers.map(async (u) => {
                const { count } = await supabase
                  .from('reviews')
                  .select('*', { count: 'exact', head: true })
                  .eq('user_id', u.id)
                return { ...u, reviewCount: count || 0 }
              })
            )
            // Sort by most reviews and take top 5
            setUsersToFollow(
              usersWithStats
                .filter(u => u.reviewCount > 0)
                .sort((a, b) => b.reviewCount - a.reviewCount)
                .slice(0, 5)
            )
          }
        }
      }

      // RECENTLY REVIEWED BY ALL USERS
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

      // POPULAR ON MUSE (most listens)
      const { data: popularListens } = await supabase
        .from('listens')
        .select('album_id')
      
      if (popularListens && popularListens.length > 0) {
        // Count listens per album
        const listenCounts = {}
        popularListens.forEach(l => {
          listenCounts[l.album_id] = (listenCounts[l.album_id] || 0) + 1
        })
        
        // Sort by count and get top albums
        const sortedAlbumIds = Object.entries(listenCounts)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 15)
          .map(([id]) => id)
        
        const popularAlbums = await Promise.all(
          sortedAlbumIds.map(async (albumId) => {
            try {
              return await spotifyService.getAlbum(albumId)
            } catch (e) {
              return null
            }
          })
        )
        setPopularOnMuse(popularAlbums.filter(a => a !== null))
      }

      // HIGHLY RATED (average rating >= 4)
      const { data: allReviews } = await supabase
        .from('reviews')
        .select('album_id, rating')
      
      if (allReviews && allReviews.length > 0) {
        // Calculate average rating per album
        const albumRatings = {}
        allReviews.forEach(r => {
          if (!albumRatings[r.album_id]) {
            albumRatings[r.album_id] = { total: 0, count: 0 }
          }
          albumRatings[r.album_id].total += r.rating || 0
          albumRatings[r.album_id].count += 1
        })
        
        // Get albums with avg >= 4 and at least 1 review
        const highlyRatedIds = Object.entries(albumRatings)
          .map(([id, data]) => ({ id, avg: data.total / data.count, count: data.count }))
          .filter(a => a.avg >= 4)
          .sort((a, b) => b.avg - a.avg || b.count - a.count)
          .slice(0, 15)
          .map(a => a.id)
        
        const ratedAlbums = await Promise.all(
          highlyRatedIds.map(async (albumId) => {
            try {
              return await spotifyService.getAlbum(albumId)
            } catch (e) {
              return null
            }
          })
        )
        setHighlyRated(ratedAlbums.filter(a => a !== null))
      }

      // DISCOVER NEW MUSIC - Spotify's new releases
      try {
        const newReleases = await spotifyService.getNewReleases(20)
        setDiscoverAlbums(newReleases.slice(0, 15))
      } catch (e) {
        console.error('Error fetching new releases:', e)
      }

      // Fetch stats for all albums
      const allAlbumIds = [
        ...(recentReviews?.map(r => r.album_id) || []),
        ...popularOnMuse.map(a => a?.id).filter(Boolean),
        ...highlyRated.map(a => a?.id).filter(Boolean)
      ]
      
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

  const UserCard = ({ user }) => (
    <div className="user-card" onClick={() => navigate(`/profile/${user.id}`)}>
      {user.avatar_url ? (
        <img src={user.avatar_url} alt={user.username} className="user-card-avatar" />
      ) : (
        <div className="user-card-avatar placeholder" />
      )}
      <p className="user-card-name">{user.username}</p>
      <p className="user-card-reviews">{user.reviewCount} reviews</p>
    </div>
  )

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

      {/* Show users to follow if not following anyone */}
      {!hasFollowing && usersToFollow.length > 0 && (
        <div className="albums-section">
          <h2 className="section-title">users to follow</h2>
          <div className="section-line"></div>
          <div className="users-grid">
            {usersToFollow.map(user => (
              <UserCard key={user.id} user={user} />
            ))}
          </div>
        </div>
      )}

      {followingReviews.length > 0 && (
        <AlbumSection title="reviewed by people you follow" albums={followingReviews} />
      )}

      {popularOnMuse.length > 0 && (
        <AlbumSection title="popular on muse" albums={popularOnMuse} />
      )}

      {highlyRated.length > 0 && (
        <AlbumSection title="highly rated" albums={highlyRated} />
      )}
      
      {recentlyReviewed.length > 0 && (
        <AlbumSection title="recently reviewed" albums={recentlyReviewed} />
      )}

      {discoverAlbums.length > 0 && (
        <AlbumSection title="new releases" albums={discoverAlbums} />
      )}

      {recentlyReviewed.length === 0 && discoverAlbums.length === 0 && (
        <p className="loading-text">No albums yet. Use search to find albums to review!</p>
      )}
    </div>
  )
}

export default Albums