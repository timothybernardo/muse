import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../../services/supabase'
import { spotifyService } from '../../services/spotify'
import { geniusService } from '../../services/genius'
import './AlbumDetail.css'

function AlbumDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [album, setAlbum] = useState(null)
  const [currentUser, setCurrentUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [showMoreInfo, setShowMoreInfo] = useState(false)
  const [showReviewModal, setShowReviewModal] = useState(false)
  
  // User interactions
  const [userRating, setUserRating] = useState(0)
  const [hoverRating, setHoverRating] = useState(0)
  const [hasListened, setHasListened] = useState(false)
  const [reviewText, setReviewText] = useState('')
  const [modalRating, setModalRating] = useState(0)
  
  // Album stats
  const [reviews, setReviews] = useState([])
  const [listenCount, setListenCount] = useState(0)
  const [averageRating, setAverageRating] = useState(0)
  
  // Lyrics
  const [selectedTrack, setSelectedTrack] = useState(null)
  const [lyrics, setLyrics] = useState('')
  const [lyricsLoading, setLyricsLoading] = useState(false)
  const [lyricsPage, setLyricsPage] = useState(0)
  const lyricsPerPage = 500

  useEffect(() => {
    const fetchData = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        setCurrentUser(user)

        const albumData = await spotifyService.getAlbum(id)
        setAlbum(albumData)

        const { data: reviewsData } = await supabase
          .from('reviews')
          .select(`*, profiles:user_id (username, avatar_url)`)
          .eq('album_id', id)
          .order('created_at', { ascending: false })

        if (reviewsData) {
          setReviews(reviewsData)
          if (reviewsData.length > 0) {
            const avg = reviewsData.reduce((sum, r) => sum + (r.rating || 0), 0) / reviewsData.length
            setAverageRating(avg)
          }
        }

        const { count } = await supabase
          .from('listens')
          .select('*', { count: 'exact', head: true })
          .eq('album_id', id)
        setListenCount(count || 0)

        if (user) {
          const { data: listenData } = await supabase
            .from('listens')
            .select('id')
            .eq('album_id', id)
            .eq('user_id', user.id)
            .maybeSingle()
          setHasListened(!!listenData)

          const { data: userReview } = await supabase
            .from('reviews')
            .select('rating, review_text')
            .eq('album_id', id)
            .eq('user_id', user.id)
            .maybeSingle()
          if (userReview) {
            setUserRating(userReview.rating || 0)
          }
        }

      } catch (error) {
        console.error('Error fetching album:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [id])

  const handleRatingClick = async (rating) => {
    if (!currentUser) return

    setUserRating(rating)
    
    if (!hasListened) {
      await supabase.from('listens').insert({
        user_id: currentUser.id,
        album_id: id
      })
      setHasListened(true)
      setListenCount(prev => prev + 1)
    }

    const { data: existing } = await supabase
      .from('reviews')
      .select('id')
      .eq('album_id', id)
      .eq('user_id', currentUser.id)
      .maybeSingle()

    if (existing) {
      await supabase
        .from('reviews')
        .update({ rating })
        .eq('id', existing.id)
    } else {
      await supabase.from('reviews').insert({
        user_id: currentUser.id,
        album_id: id,
        rating
      })
    }

    const { data: reviewsData } = await supabase
      .from('reviews')
      .select(`*, profiles:user_id (username, avatar_url)`)
      .eq('album_id', id)
      .order('created_at', { ascending: false })
    
    if (reviewsData) {
      setReviews(reviewsData)
      const avg = reviewsData.reduce((sum, r) => sum + (r.rating || 0), 0) / reviewsData.length
      setAverageRating(avg)
    }
  }

  const handleListenClick = async () => {
    if (!currentUser) return

    if (hasListened) {
      await supabase
        .from('listens')
        .delete()
        .eq('user_id', currentUser.id)
        .eq('album_id', id)
      setHasListened(false)
      setListenCount(prev => prev - 1)
    } else {
      await supabase.from('listens').insert({
        user_id: currentUser.id,
        album_id: id
      })
      setHasListened(true)
      setListenCount(prev => prev + 1)
    }
  }

  const handleSubmitReview = async () => {
    if (!currentUser || !modalRating) return

    if (!hasListened) {
      await supabase.from('listens').insert({
        user_id: currentUser.id,
        album_id: id
      })
      setHasListened(true)
      setListenCount(prev => prev + 1)
    }

    const { data: existing } = await supabase
      .from('reviews')
      .select('id')
      .eq('album_id', id)
      .eq('user_id', currentUser.id)
      .maybeSingle()

    if (existing) {
      await supabase
        .from('reviews')
        .update({ rating: modalRating, review_text: reviewText })
        .eq('id', existing.id)
    } else {
      await supabase.from('reviews').insert({
        user_id: currentUser.id,
        album_id: id,
        rating: modalRating,
        review_text: reviewText
      })
    }

    setUserRating(modalRating)
    setShowReviewModal(false)
    setReviewText('')

    const { data: reviewsData } = await supabase
      .from('reviews')
      .select(`*, profiles:user_id (username, avatar_url)`)
      .eq('album_id', id)
      .order('created_at', { ascending: false })
    
    if (reviewsData) {
      setReviews(reviewsData)
      const avg = reviewsData.reduce((sum, r) => sum + (r.rating || 0), 0) / reviewsData.length
      setAverageRating(avg)
    }
  }

  const openReviewModal = () => {
    setModalRating(userRating)
    setShowReviewModal(true)
  }

  const renderStars = (rating, size = 24) => {
    const stars = []
    const fullStars = Math.floor(rating)
    for (let i = 0; i < 5; i++) {
      stars.push(
        <span 
          key={i} 
          className={`review-star ${i < fullStars ? '' : 'empty'}`}
          style={{ fontSize: size }}
        >
          ★
        </span>
      )
    }
    return stars
  }

  const handleTrackClick = async (track) => {
    setSelectedTrack(track)
    setLyricsPage(0)
    setLyrics('')
    setLyricsLoading(true)

    try {
      const artistName = album.artists?.[0]?.name || ''
      const result = await geniusService.findLyrics(track.name, artistName)
      
      if (result.lyrics) {
        setLyrics(result.lyrics)
      } else {
        setLyrics('Lyrics not available for this track.')
      }
    } catch (error) {
      console.error('Lyrics error:', error)
      setLyrics('Failed to load lyrics.')
    } finally {
      setLyricsLoading(false)
    }
  }

  const getCurrentLyricsPage = () => {
    if (!lyrics) return ''
    const start = lyricsPage * lyricsPerPage
    const end = start + lyricsPerPage
    return lyrics.slice(start, end)
  }

  const hasMoreLyrics = () => {
    return lyrics && (lyricsPage + 1) * lyricsPerPage < lyrics.length
  }

  const hasPrevLyrics = () => {
    return lyricsPage > 0
  }

  if (loading) {
    return <div className="album-detail-page"><p className="loading-text">Loading album...</p></div>
  }

  if (!album) {
    return <div className="album-detail-page"><p className="loading-text">Album not found</p></div>
  }

  const releaseDate = new Date(album.release_date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })

  return (
    <div className="album-detail-page">
      <div className="album-detail-content">
        <div className="album-header">
          <div className="album-left">
            <img 
              src={album.images?.[0]?.url} 
              alt={album.name} 
              className="album-cover-large" 
            />
            <h1 className="album-title">{album.name}</h1>
            <p className="album-artist">{album.artists?.map(a => a.name).join(', ')}</p>
          </div>

          <div className="album-right">
            <div className="album-meta">
              <p className="meta-item"><span className="meta-label">release date:</span> {releaseDate}</p>
              <p className="meta-item"><span className="meta-label">format:</span> {album.album_type}</p>
              <p className="meta-item"><span className="meta-label">genres:</span> {album.genres?.join(', ') || 'N/A'}</p>
              <p className="meta-item"><span className="meta-label">label:</span> {album.label || 'N/A'}</p>
              <p className="meta-item"><span className="meta-label">tracks:</span> {album.total_tracks}</p>
            </div>

            <div className="user-actions-box">
              <div className="rating-stars">
                {[1, 2, 3, 4, 5].map(star => (
                  <span
                    key={star}
                    className={`rating-star ${star <= (hoverRating || userRating) ? 'active' : ''}`}
                    onClick={() => handleRatingClick(star)}
                    onMouseEnter={() => setHoverRating(star)}
                    onMouseLeave={() => setHoverRating(0)}
                  >
                    ★
                  </span>
                ))}
              </div>
              <span 
                className={`action-icon ${hasListened ? 'active' : ''}`}
                onClick={handleListenClick}
              >
                🎧
              </span>
              <span 
                className="action-icon"
                onClick={openReviewModal}
              >
                ✎
              </span>
            </div>

            <div className="album-stats">
              <div className="stat-item">
                <div className="stat-top">
                  {renderStars(averageRating)}
                </div>
                <p className="stat-label">☆ average rating</p>
              </div>
              <div className="stat-item">
                <div className="stat-number">{listenCount}</div>
                <p className="stat-label">🎧 listens</p>
              </div>
              <div className="stat-item">
                <div className="stat-number">{reviews.length}</div>
                <p className="stat-label">✎ reviews</p>
              </div>
            </div>
          </div>
        </div>

        <div className="reveal-section">
          <button className="reveal-btn" onClick={() => setShowMoreInfo(!showMoreInfo)}>
            {showMoreInfo ? 'hide information' : 'reveal more information'}
          </button>
          <div className="reveal-line"></div>
        </div>

        {showMoreInfo && (
          <div className="expanded-content">
            <div className="tracklist">
              <h3 className="tracklist-title">tracklist</h3>
              <ol className="track-list">
                {album.tracks?.items?.map((track, index) => (
                  <li 
                    key={track.id} 
                    className={`track-item ${selectedTrack?.id === track.id ? 'active' : ''}`}
                    onClick={() => handleTrackClick(track)}
                  >
                    <span className="track-number">{index + 1}.</span>
                    <span className="track-name">{track.name}</span>
                  </li>
                ))}
              </ol>
            </div>

            <div className="lyrics-box">
              {selectedTrack ? (
                <>
                  <h3 className="lyrics-title">lyrics from "{selectedTrack.name}"</h3>
                  {lyricsLoading ? (
                    <p className="lyrics-placeholder">loading lyrics...</p>
                  ) : (
                    <p className="lyrics-content">{lyrics}</p>
                  )}
                </>
              ) : (
                <p className="lyrics-placeholder">select a track to view lyrics</p>
              )}
            </div>
          </div>
        )}

        <div className="reviews-section">
          <h2 className="reviews-title">user reviews</h2>
          <div className="reviews-line"></div>
          
          {reviews.length > 0 ? (
            reviews.map(review => (
              <div key={review.id} className="review-card">
                <div className="review-header">
                  <div className="review-user">
                    {review.profiles?.avatar_url ? (
                      <img src={review.profiles.avatar_url} alt="" className="review-avatar" />
                    ) : (
                      <div className="review-avatar" />
                    )}
                    <span className="review-username">
                      {review.profiles?.username || 'User'}
                      <span className="review-count">{reviews.filter(r => r.user_id === review.user_id).length} reviews</span>
                    </span>
                  </div>
                  <div className="review-stars">
                    {renderStars(review.rating || 0)}
                  </div>
                </div>
                {review.review_text && (
                  <p className="review-text">{review.review_text}</p>
                )}
              </div>
            ))
          ) : (
            <p className="loading-text">No reviews yet. Be the first to review!</p>
          )}
        </div>
      </div>

      {showReviewModal && (
        <div className="modal-overlay" onClick={() => setShowReviewModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <h2 className="modal-title">write a review</h2>
            
            <div className="modal-rating">
              {[1, 2, 3, 4, 5].map(star => (
                <span
                  key={star}
                  className={`modal-star ${star <= modalRating ? 'active' : ''}`}
                  onClick={() => setModalRating(star)}
                >
                  ★
                </span>
              ))}
            </div>

            <textarea
              className="modal-textarea"
              placeholder="Write your review here..."
              value={reviewText}
              onChange={e => setReviewText(e.target.value)}
            />

            <div className="modal-buttons">
              <button className="modal-btn cancel" onClick={() => setShowReviewModal(false)}>
                cancel
              </button>
              <button className="modal-btn save" onClick={handleSubmitReview}>
                submit
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default AlbumDetail