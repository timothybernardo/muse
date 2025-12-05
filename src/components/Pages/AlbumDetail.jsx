import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useToast } from '../../components/Toast'
import { supabase } from '../../services/supabase'
import { spotifyService } from '../../services/spotify'
import { geniusService } from '../../services/genius'
import { AlbumDetailSkeleton, ReviewCardSkeleton } from '../../components/Skeleton'
import './AlbumDetail.css'

// Character limits
const LIMITS = {
  review: 500
}

function AlbumDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const toast = useToast()
  const [album, setAlbum] = useState(null)
  const [currentUser, setCurrentUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [showMoreInfo, setShowMoreInfo] = useState(false)
  const [showReviewModal, setShowReviewModal] = useState(false)
  
  const [userRating, setUserRating] = useState(0)
  const [hoverRating, setHoverRating] = useState(0)
  const [hasListened, setHasListened] = useState(false)
  const [reviewText, setReviewText] = useState('')
  const [modalRating, setModalRating] = useState(0)
  
  const [reviews, setReviews] = useState([])
  const [listenCount, setListenCount] = useState(0)
  const [averageRating, setAverageRating] = useState(0)
  
  const [selectedTrack, setSelectedTrack] = useState(null)
  const [lyrics, setLyrics] = useState('')
  const [lyricsLoading, setLyricsLoading] = useState(false)

  // New state for likes and comments
  const [expandedComments, setExpandedComments] = useState({})
  const [commentText, setCommentText] = useState({})

  useEffect(() => {
    fetchData()
  }, [id])

  const fetchReviews = async (userId) => {
    const { data: reviewsData, error } = await supabase
      .from('reviews')
      .select('*')
      .eq('album_id', id)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching reviews:', error)
      return []
    }

    if (reviewsData && reviewsData.length > 0) {
      const reviewsWithDetails = await Promise.all(
        reviewsData.map(async (review) => {
          // Fetch profile
          const { data: profile } = await supabase
            .from('profiles')
            .select('username, avatar_url')
            .eq('id', review.user_id)
            .single()

          // Fetch like count
          const { count: likeCount } = await supabase
            .from('review_likes')
            .select('*', { count: 'exact', head: true })
            .eq('review_id', review.id)

          // Check if current user liked
          let userLiked = false
          if (userId) {
            const { data: likeData } = await supabase
              .from('review_likes')
              .select('id')
              .eq('review_id', review.id)
              .eq('user_id', userId)
              .maybeSingle()
            userLiked = !!likeData
          }

          // Fetch comments
          const { data: commentsData } = await supabase
            .from('review_comments')
            .select('*')
            .eq('review_id', review.id)
            .order('created_at', { ascending: true })

          // Fetch profiles for comments
          const commentsWithProfiles = await Promise.all(
            (commentsData || []).map(async (comment) => {
              const { data: commentProfile } = await supabase
                .from('profiles')
                .select('username, avatar_url')
                .eq('id', comment.user_id)
                .single()
              return { ...comment, profiles: commentProfile }
            })
          )

          return {
            ...review,
            profiles: profile,
            likeCount: likeCount || 0,
            userLiked,
            comments: commentsWithProfiles
          }
        })
      )
      return reviewsWithDetails
    }
    return []
  }

  const fetchData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      setCurrentUser(user)

      const albumData = await spotifyService.getAlbum(id)
      
      if (albumData.artists?.[0]?.id) {
        try {
          const artistData = await spotifyService.getArtist(albumData.artists[0].id)
          albumData.genres = artistData.genres || []
        } catch (e) {
          console.log('Could not fetch artist genres')
        }
      }
      
      setAlbum(albumData)

      const reviewsData = await fetchReviews(user?.id)
      setReviews(reviewsData)
      
      if (reviewsData.length > 0) {
        const avg = reviewsData.reduce((sum, r) => sum + (r.rating || 0), 0) / reviewsData.length
        setAverageRating(avg)
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
          setReviewText(userReview.review_text || '')
        }
      }
    } catch (error) {
      console.error('Error fetching album:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleLikeClick = async (reviewId) => {
    if (!currentUser) {
  toast.error('Please log in to like reviews')
  return
}

    const review = reviews.find(r => r.id === reviewId)
    if (!review) return

    if (review.userLiked) {
      // Unlike
      const { error } = await supabase
        .from('review_likes')
        .delete()
        .eq('review_id', reviewId)
        .eq('user_id', currentUser.id)

      if (!error) {
        setReviews(reviews.map(r => 
          r.id === reviewId 
            ? { ...r, userLiked: false, likeCount: r.likeCount - 1 }
            : r
        ))
      }
    } else {
      // Like
      const { error } = await supabase
        .from('review_likes')
        .insert({ review_id: reviewId, user_id: currentUser.id })

      if (!error) {
        setReviews(reviews.map(r => 
          r.id === reviewId 
            ? { ...r, userLiked: true, likeCount: r.likeCount + 1 }
            : r
        ))

        // Send notification (don't notify yourself)
        if (review.user_id !== currentUser.id) {
          await supabase.from('notifications').insert({
            user_id: review.user_id,
            from_user_id: currentUser.id,
            type: 'like',
            review_id: reviewId,
            album_id: id
          })
        }
      }
    }
  }

  const toggleComments = (reviewId) => {
    setExpandedComments(prev => ({
      ...prev,
      [reviewId]: !prev[reviewId]
    }))
  }

  const handleCommentSubmit = async (reviewId) => {
    if (!currentUser) {
  toast.error('Please log in to comment')
  return
}

    const text = commentText[reviewId]?.trim()
    if (!text) return

    const review = reviews.find(r => r.id === reviewId)

    const { data, error } = await supabase
      .from('review_comments')
      .insert({
        review_id: reviewId,
        user_id: currentUser.id,
        comment_text: text
      })
      .select()
      .single()

    if (error) {
      console.error('Error posting comment:', error)
      return
    }

    // Fetch the profile for the new comment
    const { data: profile } = await supabase
      .from('profiles')
      .select('username, avatar_url')
      .eq('id', currentUser.id)
      .single()

    const newComment = { ...data, profiles: profile }

    setReviews(reviews.map(r => 
      r.id === reviewId 
        ? { ...r, comments: [...r.comments, newComment] }
        : r
    ))
    setCommentText(prev => ({ ...prev, [reviewId]: '' }))

    // Send notification (don't notify yourself)
    if (review && review.user_id !== currentUser.id) {
      await supabase.from('notifications').insert({
        user_id: review.user_id,
        from_user_id: currentUser.id,
        type: 'comment',
        review_id: reviewId,
        comment_text: text,
        album_id: id
      })
    }
  }

  const handleDeleteComment = async (reviewId, commentId) => {
    const { error } = await supabase
      .from('review_comments')
      .delete()
      .eq('id', commentId)

    if (!error) {
      setReviews(reviews.map(r => 
        r.id === reviewId 
          ? { ...r, comments: r.comments.filter(c => c.id !== commentId) }
          : r
      ))
    }
  }

  const handleRatingClick = async (rating) => {
    if (!currentUser) {
  toast.error('Please log in to rate albums')
  return
}

    setUserRating(rating)
    
    if (!hasListened) {
      const { error: listenError } = await supabase.from('listens').insert({
        user_id: currentUser.id,
        album_id: id,
        listened_at: new Date().toISOString()
      })
      if (!listenError) {
        setHasListened(true)
        setListenCount(prev => prev + 1)
      }
    }

    const { data: existing } = await supabase
      .from('reviews')
      .select('id')
      .eq('album_id', id)
      .eq('user_id', currentUser.id)
      .maybeSingle()

    if (existing) {
      await supabase.from('reviews').update({ rating }).eq('id', existing.id)
    } else {
      await supabase.from('reviews').insert({
        user_id: currentUser.id,
        album_id: id,
        rating
      })
    }

    const reviewsData = await fetchReviews(currentUser.id)
    setReviews(reviewsData)
    if (reviewsData.length > 0) {
      const avg = reviewsData.reduce((sum, r) => sum + (r.rating || 0), 0) / reviewsData.length
      setAverageRating(avg)
    }
  }

  const handleListenClick = async () => {
    if (!currentUser) {
  toast.error('Please log in to mark albums as listened')
  return
}

    if (hasListened) {
      const { error } = await supabase
        .from('listens')
        .delete()
        .eq('user_id', currentUser.id)
        .eq('album_id', id)
      
      if (!error) {
        setHasListened(false)
        setListenCount(prev => prev - 1)
      }
    } else {
      const { data: existing } = await supabase
        .from('listens')
        .select('id')
        .eq('user_id', currentUser.id)
        .eq('album_id', id)
        .maybeSingle()
      
      if (existing) {
        setHasListened(true)
        return
      }

      const { error } = await supabase.from('listens').insert({
        user_id: currentUser.id,
        album_id: id,
        listened_at: new Date().toISOString()
      })
      
      if (!error) {
        setHasListened(true)
        setListenCount(prev => prev + 1)
      }
    }
  }

  const handleSubmitReview = async () => {
    if (!currentUser) {
  toast.error('Please log in to write reviews')
  return
}
    
    if (!modalRating) {
  toast.error('Please select a rating')
  return
}

    if (!hasListened) {
      const { error: listenError } = await supabase.from('listens').insert({
        user_id: currentUser.id,
        album_id: id,
        listened_at: new Date().toISOString()
      })
      if (!listenError) {
        setHasListened(true)
        setListenCount(prev => prev + 1)
      }
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
    toast.success('Review submitted!')

    const reviewsData = await fetchReviews(currentUser.id)
    setReviews(reviewsData)
    if (reviewsData.length > 0) {
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
        <span key={i} className={`review-star ${i < fullStars ? '' : 'empty'}`} style={{ fontSize: size }}>
          ★
        </span>
      )
    }
    return stars
  }

  const handleShare = () => {
  const url = window.location.href
  navigator.clipboard.writeText(url)
  toast.success('Link copied to clipboard!')
}


  const handleTrackClick = async (track) => {
    setSelectedTrack(track)
    setLyrics('')
    setLyricsLoading(true)

    try {
      const artistName = album.artists?.[0]?.name || ''
      const result = await geniusService.findLyrics(track.name, artistName)
      setLyrics(result.lyrics || 'Lyrics not available for this track.')
    } catch (error) {
      setLyrics('Failed to load lyrics.')
    } finally {
      setLyricsLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="album-detail-page">
        <div className="album-detail-content">
          <AlbumDetailSkeleton />
          <div style={{ marginTop: '60px' }}>
            <div className="skeleton skeleton-text" style={{ width: '150px', marginBottom: '25px' }} />
            <ReviewCardSkeleton />
            <ReviewCardSkeleton />
          </div>
        </div>
      </div>
    )
  }
  
  if (!album) return <div className="album-detail-page"><p className="loading-text">album not found</p></div>

  const releaseDate = new Date(album.release_date).toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric'
  })

  return (
    <div className="album-detail-page page-transition">
      <div className="album-detail-content">
        <div className="album-header">
          <div className="album-left">
            <img src={album.images?.[0]?.url} alt={album.name} className="album-cover-large" />
            <h1 className="album-title">{album.name}</h1>
            <p className="album-artist">{album.artists?.map(a => a.name).join(', ')}</p>
          </div>

          <div className="album-right">
            <div className="album-meta">
              <p className="meta-item"><span className="meta-label">release date:</span> {releaseDate}</p>
              <p className="meta-item"><span className="meta-label">format:</span> {album.album_type}</p>
              {album.genres?.length > 0 && (
                <p className="meta-item"><span className="meta-label">genres:</span> {album.genres.join(', ')}</p>
              )}
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
                  >★</span>
                ))}
              </div>
              <span className={`action-icon ${hasListened ? 'active' : ''}`} onClick={handleListenClick}>🎧</span>
              <span className="action-icon" onClick={openReviewModal}>✎</span>
              <span className="action-icon" onClick={handleShare}>↗</span>
            </div>

            <div className="album-stats">
              <div className="stat-item">
                <div className="stat-top">{renderStars(averageRating)}</div>
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
                  <li key={track.id} className={`track-item ${selectedTrack?.id === track.id ? 'active' : ''}`}
                    onClick={() => handleTrackClick(track)}>
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
                  {lyricsLoading ? <p className="lyrics-placeholder">loading lyrics...</p> : <p className="lyrics-content">{lyrics}</p>}
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
                {/* Row 1: User info and stars */}
                <div className="review-header">
                  <div className="review-user" onClick={() => navigate(`/profile/${review.user_id}`)} style={{ cursor: 'pointer' }}>
                    {review.profiles?.avatar_url ? (
                      <img src={review.profiles.avatar_url} alt="" className="review-avatar" />
                    ) : (
                      <div className="review-avatar" />
                    )}
                    <span className="review-username">{review.profiles?.username || 'User'}</span>
                  </div>
                  <div className="review-stars">{renderStars(review.rating || 0)}</div>
                </div>

                {/* Row 2: Review text */}
                {review.review_text && (
                  <p className="review-text">{review.review_text}</p>
                )}

                {/* Row 3: Like, Comment, Edit */}
                <div className="review-footer">
                  <div className="review-interactions">
                    <button 
                      className={`interaction-btn like-btn ${review.userLiked ? 'liked' : ''}`}
                      onClick={() => handleLikeClick(review.id)}
                    >
                      <span className="interaction-icon">{review.userLiked ? '♥' : '♡'}</span>
                      <span className="interaction-count">{review.likeCount}</span>
                    </button>
                    <button 
                      className="interaction-btn comment-btn"
                      onClick={() => toggleComments(review.id)}
                    >
                      <span className="interaction-icon">💬</span>
                      <span className="interaction-count">{review.comments?.length || 0}</span>
                    </button>
                  </div>
                  {currentUser?.id === review.user_id && (
                    <button className="edit-review-btn" onClick={() => {
                      setModalRating(review.rating || 0)
                      setReviewText(review.review_text || '')
                      setShowReviewModal(true)
                    }}>edit review</button>
                  )}
                </div>

                {/* Row 4: Comments (expandable) */}
                {expandedComments[review.id] && (
                  <div className="comments-section">
                    {review.comments?.length > 0 && (
                      <div className="comments-list">
                        {review.comments.map(comment => (
                          <div key={comment.id} className="comment-item">
                            <div 
                              className="comment-user"
                              onClick={() => navigate(`/profile/${comment.user_id}`)}
                              style={{ cursor: 'pointer' }}
                            >
                              {comment.profiles?.avatar_url ? (
                                <img src={comment.profiles.avatar_url} alt="" className="comment-avatar" />
                              ) : (
                                <div className="comment-avatar" />
                              )}
                              <span className="comment-username">{comment.profiles?.username || 'User'}</span>
                            </div>
                            <p className="comment-text">{comment.comment_text}</p>
                            {currentUser?.id === comment.user_id && (
                              <button 
                                className="delete-comment-btn"
                                onClick={() => handleDeleteComment(review.id, comment.id)}
                              >
                                ×
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    {currentUser && (
                      <div className="comment-input-wrapper">
                        <input
                          type="text"
                          className="comment-input"
                          placeholder="Write a comment..."
                          value={commentText[review.id] || ''}
                          onChange={(e) => setCommentText(prev => ({ ...prev, [review.id]: e.target.value }))}
                          onKeyDown={(e) => e.key === 'Enter' && handleCommentSubmit(review.id)}
                        />
                        <button 
                          className="comment-submit-btn"
                          onClick={() => handleCommentSubmit(review.id)}
                        >
                          post
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))
          ) : (
            <p className="loading-text">no reviews yet. be the first to review!</p>
          )}
        </div>
      </div>

      {showReviewModal && (
        <div className="modal-overlay" onClick={() => setShowReviewModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <h2 className="modal-title">write a review</h2>
            <div className="modal-rating">
              {[1, 2, 3, 4, 5].map(star => (
                <span key={star} className={`modal-star ${star <= modalRating ? 'active' : ''}`}
                  onClick={() => setModalRating(star)}>★</span>
              ))}
            </div>
            <div className="input-wrapper">
              <textarea
                className="modal-textarea"
                placeholder="Write your review here..."
                value={reviewText}
                onChange={e => setReviewText(e.target.value.slice(0, LIMITS.review))}
                maxLength={LIMITS.review}
              />
              <span className="char-count">{reviewText.length}/{LIMITS.review}</span>
            </div>
            <div className="modal-buttons">
              <button className="modal-btn cancel" onClick={() => setShowReviewModal(false)}>cancel</button>
              <button className="modal-btn save" onClick={handleSubmitReview}>submit</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default AlbumDetail