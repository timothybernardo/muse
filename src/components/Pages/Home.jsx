import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../../services/supabase'
import { spotifyService } from '../../services/spotify'
import './Home.css'
import logo from '../../assets/logo.png'

function Home() {
  const navigate = useNavigate()
  const [spinningAlbums, setSpinningAlbums] = useState([])
  const [albumStats, setAlbumStats] = useState({})
  const [loading, setLoading] = useState(true)
  const [reviewAlbum, setReviewAlbum] = useState(null)
  const [aiAlbums, setAiAlbums] = useState([])
  const [playlistAlbums, setPlaylistAlbums] = useState([])

  useEffect(() => {
    fetchSpinningAlbums()
    fetchFeatureAlbums()
  }, [])

  const fetchFeatureAlbums = async () => {
    try {
      // Fetch specific albums for each feature mockup
      
      // Review: Blonde by Frank Ocean
      const blondeResults = await spotifyService.searchAlbums('Blonde Frank Ocean', 1)
      if (blondeResults[0]) setReviewAlbum(blondeResults[0])
      
      // AI: Tyler, The Weeknd, Daniel Caesar
      const tylerResults = await spotifyService.searchAlbums('Tyler the Creator IGOR', 1)
      const weekndResults = await spotifyService.searchAlbums('After Hours Weeknd', 1)
      const danielResults = await spotifyService.searchAlbums('Freudian Daniel Caesar', 1)
      setAiAlbums([tylerResults[0], weekndResults[0], danielResults[0]].filter(Boolean))
      
      // Playlist: Kendrick, SZA, Ravyn Lenae
      const kendrickResults = await spotifyService.searchAlbums('good kid maad city Kendrick', 1)
      const szaResults = await spotifyService.searchAlbums('SOS SZA', 1)
      const ravynResults = await spotifyService.searchAlbums('Hypnos Ravyn Lenae', 1)
      const childishResults = await spotifyService.searchAlbums('Because The Internet Childish Gambino', 1)
      setPlaylistAlbums([kendrickResults[0], szaResults[0], ravynResults[0], childishResults[0]].filter(Boolean))
      
    } catch (e) {
      console.error('Error fetching feature albums:', e)
    }
  }

  const fetchSpinningAlbums = async () => {
    try {
      const { data: recentListens } = await supabase
        .from('listens')
        .select('album_id')
        .order('listened_at', { ascending: false })
        .limit(20)

      if (recentListens && recentListens.length > 0) {
        const uniqueAlbumIds = [...new Set(recentListens.map(l => l.album_id))]
        
        const albums = await Promise.all(
          uniqueAlbumIds.slice(0, 5).map(async (albumId) => {
            try {
              return await spotifyService.getAlbum(albumId)
            } catch (e) {
              return null
            }
          })
        )
        
        const validAlbums = albums.filter(a => a !== null)
        setSpinningAlbums(validAlbums)

        const stats = {}
        for (const album of validAlbums) {
          const { count: listenCount } = await supabase
            .from('listens')
            .select('*', { count: 'exact', head: true })
            .eq('album_id', album.id)
          
          const { data: reviews } = await supabase
            .from('reviews')
            .select('rating')
            .eq('album_id', album.id)
          
          const reviewCount = reviews?.length || 0
          const avgRating = reviewCount > 0 
            ? reviews.reduce((sum, r) => sum + (r.rating || 0), 0) / reviewCount 
            : 0
          
          stats[album.id] = { listens: listenCount || 0, reviews: reviewCount, rating: avgRating }
        }
        setAlbumStats(stats)
      }
    } catch (error) {
      console.error('Error fetching spinning albums:', error)
    } finally {
      setLoading(false)
    }
  }

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

  const formatListens = (count) => {
    if (count >= 1000) return (count / 1000).toFixed(1) + 'k'
    return count.toString()
  }

  // Animated feature mockups with real album art
  const ReviewAnimation = () => (
    <div className="feature-mockup review-mockup">
      <div className="mockup-album">
        {reviewAlbum ? (
          <img src={reviewAlbum.images?.[0]?.url} alt="" className="mockup-album-art" />
        ) : (
          <div className="mockup-album-art placeholder"></div>
        )}
        <div className="mockup-album-info">
          <div className="mockup-title">Blonde</div>
          <div className="mockup-artist">Frank Ocean</div>
        </div>
      </div>
      <div className="mockup-stars">
        {[1, 2, 3, 4, 5].map(i => (
          <span key={i} className="mockup-star">★</span>
        ))}
      </div>
      <div className="mockup-review-box">
        <div className="mockup-typing-text">A masterpiece of emotion...</div>
      </div>
    </div>
  )

  const AIAnimation = () => (
    <div className="feature-mockup ai-mockup">
      <div className="mockup-chat-bubble user">
        <span>I want something like Frank Ocean</span>
      </div>
      <div className="mockup-chat-bubble assistant">
        <span>Here are some albums you'll love:</span>
      </div>
      <div className="mockup-recommendations">
        {aiAlbums.map((album, i) => (
          album ? (
            <img key={i} src={album.images?.[0]?.url} alt="" className="mockup-rec-album" />
          ) : (
            <div key={i} className="mockup-rec-album placeholder"></div>
          )
        ))}
      </div>
    </div>
  )

  const PlaylistAnimation = () => (
    <div className="feature-mockup playlist-mockup">
      <div className="mockup-playlist-header">
        <div className="mockup-playlist-covers">
          {playlistAlbums.slice(0, 4).map((album, i) => (
            album ? (
              <img key={i} src={album.images?.[0]?.url} alt="" className="mockup-mini-album" />
            ) : (
              <div key={i} className="mockup-mini-album placeholder"></div>
            )
          ))}
          {/* Fill remaining slots if less than 4 */}
          {playlistAlbums.length < 4 && [...Array(4 - playlistAlbums.length)].map((_, i) => (
            <div key={`empty-${i}`} className="mockup-mini-album placeholder"></div>
          ))}
        </div>
        <div className="mockup-playlist-info">
          <div className="mockup-playlist-title">my favorites</div>
          <div className="mockup-playlist-count">{playlistAlbums.length} songs</div>
        </div>
      </div>
      <div className="mockup-track-list">
        {playlistAlbums.map((album, i) => (
          <div key={i} className="mockup-track">
            {album ? (
              <img src={album.images?.[0]?.url} alt="" className="mockup-track-art" />
            ) : (
              <div className="mockup-track-art placeholder"></div>
            )}
            <div className="mockup-track-info">
              <div className="mockup-track-name">{album?.name?.slice(0, 20) || 'Track'}</div>
              <div className="mockup-track-artist">{album?.artists?.[0]?.name || 'Artist'}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )

  return (
    <div className="home-container">
      <nav className="home-nav">
        <Link to="/" className="logo">
          <img src={logo} alt="Muse logo" className="logo-icon" />
          <span className="logo-text">muse</span>
        </Link>
        <div className="nav-links">
          <Link to="/albums">albums</Link>
          <Link to="/find">find</Link>
          <Link to="/playlists">playlists</Link>
          <Link to="/search">search</Link>
          <Link to="/login" className="sign-in-btn">sign in</Link>
        </div>
      </nav>

      <div className="hero-section">
        <div className="hero-box">
          <h1>discover and review your<br />next favorite album.</h1>
        </div>
        <Link to="/signup" className="cta-button">sign up</Link>
      </div>

      <div className="features-section">
        <h2 className="section-title">our features</h2>
        <div className="section-line"></div>
        <div className="features-grid">
          <div className="feature-item">
            <div className="feature-card">
              <ReviewAnimation />
            </div>
            <h3>rate and review albums</h3>
            <p>Share your thoughts on albums with star ratings and written reviews. See what others think too.</p>
          </div>
          <div className="feature-item">
            <div className="feature-card">
              <AIAnimation />
            </div>
            <h3>AI-powered discovery</h3>
            <p>Tell our AI what mood you're in and get personalized album recommendations instantly.</p>
          </div>
          <div className="feature-item">
            <div className="feature-card">
              <PlaylistAnimation />
            </div>
            <h3>create playlists</h3>
            <p>Curate your favorite tracks into playlists with personal notes about why each song matters.</p>
          </div>
        </div>
      </div>

      <div className="currently-spinning">
        <h3 className="section-title">users are now spinning</h3>
        <div className="section-line"></div>
        {loading ? (
          <p className="loading-text">loading...</p>
        ) : spinningAlbums.length > 0 ? (
          <div className="albums-carousel">
            {spinningAlbums.map(album => {
              const stats = albumStats[album.id] || { listens: 0, reviews: 0, rating: 0 }
              return (
                <div 
                  key={album.id} 
                  className="album-card"
                  onClick={() => navigate(`/album/${album.id}`)}
                >
                  <img src={album.images?.[0]?.url} alt={album.name} className="album-cover" />
                  <div className="album-stats">
                    <span className="stat">🎧 {formatListens(stats.listens)}</span>
                    <span className="stat">✎ {stats.reviews}</span>
                  </div>
                  <div className="album-rating">
                    {renderStars(stats.rating)}
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <p className="empty-text">No activity yet. Be the first to review an album!</p>
        )}
      </div>

      <footer>
        <p>created by timothy bernardo 2025</p>
      </footer>
    </div>
  )
}

export default Home