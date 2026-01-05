import { useState, useEffect } from 'react'
import { useToast } from '../../components/Toast'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { supabase } from '../../services/supabase'
import { geniusService } from '../../services/genius'
import { spotifyService } from '../../services/spotify'
import './PlaylistDetail.css'

const LIMITS = {
  playlistName: 50,
  playlistDescription: 150,
  songNote: 100,
  comment: 200
}

function PlaylistDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const toast = useToast()
  const [playlist, setPlaylist] = useState(null)
  const [songs, setSongs] = useState([])
  const [creator, setCreator] = useState(null)
  const [loading, setLoading] = useState(true)
  const [currentUser, setCurrentUser] = useState(null)
  
  const [showLyricsModal, setShowLyricsModal] = useState(false)
  const [selectedSong, setSelectedSong] = useState(null)
  const [lyrics, setLyrics] = useState('')
  const [lyricsLoading, setLyricsLoading] = useState(false)

  const [showAddModal, setShowAddModal] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [selectedTrack, setSelectedTrack] = useState(null)
  const [trackNote, setTrackNote] = useState('')
  const [searching, setSearching] = useState(false)

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [editTitle, setEditTitle] = useState('')
  const [editDescription, setEditDescription] = useState('')

  const [showEditNoteModal, setShowEditNoteModal] = useState(false)
  const [editingSong, setEditingSong] = useState(null)
  const [editNote, setEditNote] = useState('')
  const [songToRemove, setSongToRemove] = useState(null)

  // Likes & Comments state
  const [likeCount, setLikeCount] = useState(0)
  const [userLiked, setUserLiked] = useState(false)
  const [comments, setComments] = useState([])
  const [showComments, setShowComments] = useState(false)
  const [newComment, setNewComment] = useState('')

  useEffect(() => {
    fetchPlaylist()
  }, [id])

  const fetchPlaylist = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      setCurrentUser(user)

      const { data: playlistData, error: playlistError } = await supabase
        .from('playlists')
        .select('*')
        .eq('id', id)
        .single()

      if (playlistError) {
        console.error('Error fetching playlist:', playlistError)
        return
      }

      setPlaylist(playlistData)
      setEditTitle(playlistData.title || '')
      setEditDescription(playlistData.description || '')

      const { data: creatorData } = await supabase
        .from('profiles')
        .select('username, avatar_url')
        .eq('id', playlistData.user_id)
        .single()

      setCreator(creatorData)

      const { data: songsData } = await supabase
        .from('playlist_songs')
        .select('playlist_id, album_id, track_name, artist_name, album_name, album_cover, position, note')
        .eq('playlist_id', id)
        .order('position', { ascending: true })

      setSongs(songsData || [])

      // Fetch like count
      const { count } = await supabase
        .from('playlist_likes')
        .select('*', { count: 'exact', head: true })
        .eq('playlist_id', id)
      setLikeCount(count || 0)

      // Check if current user liked
      if (user) {
        const { data: likeData } = await supabase
          .from('playlist_likes')
          .select('id')
          .eq('playlist_id', id)
          .eq('user_id', user.id)
          .maybeSingle()
        setUserLiked(!!likeData)
      }

      // Fetch comments with profiles
      const { data: commentsData } = await supabase
        .from('playlist_comments')
        .select('*')
        .eq('playlist_id', id)
        .order('created_at', { ascending: true })

      if (commentsData) {
        const commentsWithProfiles = await Promise.all(
          commentsData.map(async (comment) => {
            const { data: profile } = await supabase
              .from('profiles')
              .select('username, avatar_url')
              .eq('id', comment.user_id)
              .single()
            return { ...comment, profile }
          })
        )
        setComments(commentsWithProfiles)
      }

    } catch (error) {
      console.error('Error:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleLikeClick = async () => {
    if (!currentUser) {
      toast.error('Please log in to like playlists')
      return
    }

    if (userLiked) {
      const { error } = await supabase
        .from('playlist_likes')
        .delete()
        .eq('playlist_id', id)
        .eq('user_id', currentUser.id)

      if (!error) {
        setUserLiked(false)
        setLikeCount(prev => prev - 1)
      }
    } else {
      const { error } = await supabase
        .from('playlist_likes')
        .insert({ playlist_id: id, user_id: currentUser.id })

      if (!error) {
        setUserLiked(true)
        setLikeCount(prev => prev + 1)

        // Send notification (don't notify yourself)
        if (playlist.user_id !== currentUser.id) {
          await supabase.from('notifications').insert({
            user_id: playlist.user_id,
            from_user_id: currentUser.id,
            type: 'playlist_like',
            playlist_id: id
          })
        }
      }
    }
  }

  const handleCommentSubmit = async () => {
    if (!currentUser) {
      toast.error('Please log in to comment')
      return
    }

    const text = newComment.trim()
    if (!text) return

    const { data, error } = await supabase
      .from('playlist_comments')
      .insert({
        playlist_id: id,
        user_id: currentUser.id,
        comment_text: text.slice(0, LIMITS.comment)
      })
      .select()
      .single()

    if (error) {
      console.error('Error posting comment:', error)
      return
    }

    // Send notification (don't notify yourself)
    if (playlist.user_id !== currentUser.id) {
      await supabase.from('notifications').insert({
        user_id: playlist.user_id,
        from_user_id: currentUser.id,
        type: 'playlist_comment',
        playlist_id: id,
        comment_text: text.slice(0, 100)
      })
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('username, avatar_url')
      .eq('id', currentUser.id)
      .single()

    setComments([...comments, { ...data, profile }])
    setNewComment('')
  }

  const handleDeleteComment = async (commentId) => {
    const { error } = await supabase
      .from('playlist_comments')
      .delete()
      .eq('id', commentId)

    if (!error) {
      setComments(comments.filter(c => c.id !== commentId))
    }
  }

  const handleUpdatePlaylist = async () => {
  console.log('id:', id)
  console.log('editTitle:', editTitle)
  
  if (!editTitle.trim()) {
    toast.error('Playlist name cannot be empty')
    return
  }

  const { data, error } = await supabase
    .from('playlists')
    .update({ 
      title: editTitle.slice(0, LIMITS.playlistName), 
      description: editDescription.slice(0, LIMITS.playlistDescription) 
    })
    .eq('id', id)
    .select()

  console.log('data:', data)
  console.log('error:', error)

  if (error) {
    console.error('Error updating playlist:', error)
    toast.error('Error updating playlist')
  } else {
    setPlaylist({ ...playlist, title: editTitle, description: editDescription })
    setShowEditModal(false)
    toast.success('Playlist updated!')
  }
}

  const handleRemoveSong = async (song) => {
    setSongToRemove(song)
  }

  const confirmRemoveSong = async () => {
    if (!songToRemove) return

    const { error } = await supabase
      .from('playlist_songs')
      .delete()
      .eq('playlist_id', id)
      .eq('position', songToRemove.position)

    if (error) {
  console.error('Error removing song:', error)
  toast.error('Error removing song')
} else {
  fetchPlaylist()
  toast.success('Song removed')
}
setSongToRemove(null)
  }

  const handleMoveSong = async (index, direction) => {
    const newIndex = index + direction
    if (newIndex < 0 || newIndex >= songs.length) return

    const songA = songs[index]
    const songB = songs[newIndex]

    const { error: errorA } = await supabase
      .from('playlist_songs')
      .update({ position: songB.position })
      .eq('playlist_id', id)
      .eq('album_id', songA.album_id)
      .eq('track_name', songA.track_name)

    const { error: errorB } = await supabase
      .from('playlist_songs')
      .update({ position: songA.position })
      .eq('playlist_id', id)
      .eq('album_id', songB.album_id)
      .eq('track_name', songB.track_name)

    if (errorA || errorB) {
      console.error('Error moving song:', errorA || errorB)
    } else {
      fetchPlaylist()
    }
  }

  const handleEditNote = (song) => {
    setEditingSong(song)
    setEditNote(song.note || '')
    setShowEditNoteModal(true)
  }

  const handleSaveNote = async () => {
    if (!editingSong) return

    const { error } = await supabase
      .from('playlist_songs')
      .update({ note: editNote.slice(0, LIMITS.songNote) })
      .eq('playlist_id', id)
      .eq('album_id', editingSong.album_id)
      .eq('track_name', editingSong.track_name)

    if (error) {
  console.error('Error updating note:', error)
  toast.error('Error updating note')
} else {
  setShowEditNoteModal(false)
  setEditingSong(null)
  setEditNote('')
  fetchPlaylist()
  toast.success('Note updated!')
}
  }

  const handleDeletePlaylist = async () => {
    const { error: songsError } = await supabase
      .from('playlist_songs')
      .delete()
      .eq('playlist_id', id)

    if (songsError) {
  console.error('Error deleting songs:', songsError)
  toast.error('Error deleting playlist')
  return
}
toast.success('Playlist deleted')
navigate('/playlists')

    const { error: playlistError } = await supabase
      .from('playlists')
      .delete()
      .eq('id', id)

    if (playlistError) {
      console.error('Error deleting playlist:', playlistError)
      alert('Error deleting playlist: ' + playlistError.message)
    } else {
      navigate('/playlists')
    }
  }

  const handleSongClick = async (song) => {
    setSelectedSong(song)
    setShowLyricsModal(true)
    setLyrics('')
    setLyricsLoading(true)

    try {
      const result = await geniusService.findLyrics(song.track_name, song.artist_name)
      if (result.lyrics) {
        setLyrics(result.lyrics)
      } else {
        setLyrics('lyrics not found for this track.')
      }
    } catch (error) {
      setLyrics('failed to load lyrics.')
    } finally {
      setLyricsLoading(false)
    }
  }

  const closeLyricsModal = () => {
    setShowLyricsModal(false)
    setSelectedSong(null)
    setLyrics('')
  }

  const handleSearch = async () => {
    if (!searchQuery.trim()) return
    setSearching(true)
    try {
      const results = await spotifyService.searchTracks(searchQuery, 10)
      setSearchResults(results)
    } catch (error) {
      console.error('Search error:', error)
    } finally {
      setSearching(false)
    }
  }

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') handleSearch()
  }

  const handleAddSong = async () => {
    if (!selectedTrack || !currentUser) return

    const existingSong = songs.find(s => 
      s.album_id === selectedTrack.album.id && s.track_name === selectedTrack.name
    )
    
    if (existingSong) {
      toast.error('This song is already in the playlist!')
  return
    }
    toast.success('Song added!')

    const newPosition = songs.length + 1

    const { error } = await supabase
      .from('playlist_songs')
      .insert({
        playlist_id: id,
        album_id: selectedTrack.album.id,
        track_name: selectedTrack.name,
        artist_name: selectedTrack.artists.map(a => a.name).join(', '),
        album_name: selectedTrack.album.name,
        album_cover: selectedTrack.album.images[0]?.url,
        position: newPosition,
        note: trackNote.slice(0, LIMITS.songNote)
      })

    if (!error) {
      setShowAddModal(false)
      setSearchQuery('')
      setSearchResults([])
      setSelectedTrack(null)
      setTrackNote('')
      fetchPlaylist()
    } else {
      console.error('Error adding song:', error)
      alert('Error adding song: ' + error.message)
    }
  }

  const closeAddModal = () => {
    setShowAddModal(false)
    setSearchQuery('')
    setSearchResults([])
    setSelectedTrack(null)
    setTrackNote('')
  }

  const getCoverImages = () => {
    const covers = songs.slice(0, 4).map(s => s.album_cover)
    while (covers.length < 4) covers.push(null)
    return covers
  }

  const handleAlbumClick = (e, albumId) => {
    e.stopPropagation()
    navigate(`/album/${albumId}`)
  }

  const handleShare = () => {
  const url = window.location.href
  navigator.clipboard.writeText(url)
  toast.success('Link copied to clipboard!')
}

  if (loading) {
    return <div className="playlist-detail-page"><p className="loading-text">loading playlist...</p></div>
  }

  if (!playlist) {
    return <div className="playlist-detail-page"><p className="loading-text">playlist not found</p></div>
  }

  const isOwner = currentUser?.id === playlist.user_id
  const coverImages = getCoverImages()

  return (
    <div className="playlist-detail-page">
      <div className="playlist-detail-content">
        <div className="playlist-header">
          <div className="playlist-covers">
            {coverImages.map((cover, index) => (
              cover ? (
                <img key={index} src={cover} alt="" className="playlist-cover-img" />
              ) : (
                <div key={index} className="playlist-cover-img" />
              )
            ))}
          </div>

          <div className="playlist-info">
            <h1 className="playlist-title">
              {playlist.title}
              <span className="playlist-song-count">{songs.length} songs</span>
              {isOwner && (
                <button className="edit-playlist-btn" onClick={() => setShowEditModal(true)}>
                  edit
                </button>
              )}
            </h1>
            <p className="playlist-description">{playlist.description}</p>
            
            {/* Like & Comment buttons */}
            <div className="playlist-interactions">
              <button 
                className={`playlist-like-btn ${userLiked ? 'liked' : ''}`}
                onClick={handleLikeClick}
              >
                <span>{userLiked ? '♥' : '♡'}</span>
                <span>{likeCount}</span>
              </button>
              <button 
                className="playlist-comment-btn"
                onClick={() => setShowComments(!showComments)}
              >
                <span>💬</span>
                <span>{comments.length}</span>
              </button>
              <button className="playlist-comment-btn" onClick={handleShare}>
  <span>↗</span>
  <span>share</span>
</button>
            </div>
            
            {isOwner && (
              <button className="delete-playlist-btn" onClick={() => setShowDeleteConfirm(true)}>
                delete playlist
              </button>
            )}
          </div>

          <Link to={`/profile/${playlist.user_id}`} className="playlist-creator">
            {creator?.avatar_url ? (
              <img src={creator.avatar_url} alt="" className="creator-avatar" />
            ) : (
              <div className="creator-avatar" />
            )}
            <div className="creator-info">
              <p className="creator-label">a playlist by</p>
              <p className="creator-name">{creator?.username || 'User'}</p>
            </div>
          </Link>
        </div>

        {/* Comments Section */}
        {showComments && (
          <div className="playlist-comments-section">
            <h3 className="comments-title">comments</h3>
            
            {comments.length > 0 ? (
              <div className="comments-list">
                {comments.map(comment => (
                  <div key={comment.id} className="comment-item">
                    <div 
                      className="comment-user"
                      onClick={() => navigate(`/profile/${comment.user_id}`)}
                    >
                      {comment.profile?.avatar_url ? (
                        <img src={comment.profile.avatar_url} alt="" className="comment-avatar" />
                      ) : (
                        <div className="comment-avatar" />
                      )}
                      <span className="comment-username">{comment.profile?.username || 'User'}</span>
                    </div>
                    <p className="comment-text">{comment.comment_text}</p>
                    {currentUser?.id === comment.user_id && (
                      <button 
                        className="delete-comment-btn"
                        onClick={() => handleDeleteComment(comment.id)}
                      >
                        ×
                      </button>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="no-comments">no comments yet</p>
            )}

            {currentUser && (
              <div className="comment-input-wrapper">
                <input
                  type="text"
                  className="comment-input"
                  placeholder="write a comment..."
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value.slice(0, LIMITS.comment))}
                  onKeyDown={(e) => e.key === 'Enter' && handleCommentSubmit()}
                  maxLength={LIMITS.comment}
                />
                <button 
                  className="comment-submit-btn"
                  onClick={handleCommentSubmit}
                  disabled={!newComment.trim()}
                >
                  post
                </button>
              </div>
            )}
          </div>
        )}

        {songs.length > 0 ? (
          songs.map((song, index) => (
            <div key={song.playlist_id + '-' + song.album_id + '-' + index} className="song-item">
              <img src={song.album_cover} alt={song.track_name} className="song-cover" onClick={() => handleSongClick(song)} />
              <div className="song-info">
                <h3 className="song-title">{song.track_name}</h3>
                <p className="song-artist">
                  {song.artist_name} on{' '}
                  <span className="album-name clickable" onClick={(e) => handleAlbumClick(e, song.album_id)}>
                    {song.album_name}
                  </span>
                </p>
                {song.note && <p className="song-note">{song.note}</p>}
              </div>
              <div className="song-position">{index + 1}</div>
              
              {isOwner && (
                <div className="song-actions">
                  <button className="move-song-btn" onClick={() => handleMoveSong(index, -1)} disabled={index === 0}>↑</button>
                  <button className="move-song-btn" onClick={() => handleMoveSong(index, 1)} disabled={index === songs.length - 1}>↓</button>
                  <button className="edit-note-btn" onClick={() => handleEditNote(song)}>✎</button>
                  <button className="remove-song-btn" onClick={() => handleRemoveSong(song)}>×</button>
                </div>
              )}
            </div>
          ))
        ) : (
          <p className="empty-state">No songs in this playlist yet.</p>
        )}

        {isOwner && (
          <button className="add-song-btn" onClick={() => setShowAddModal(true)}>+ add song</button>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="lyrics-modal-overlay" onClick={() => setShowDeleteConfirm(false)}>
          <div className="delete-confirm-modal" onClick={e => e.stopPropagation()}>
            <h2 className="delete-confirm-title">delete playlist?</h2>
            <p className="delete-confirm-text">Are you sure you want to delete "{playlist.title}"? This action cannot be undone.</p>
            <div className="delete-confirm-buttons">
              <button className="delete-confirm-btn cancel" onClick={() => setShowDeleteConfirm(false)}>cancel</button>
              <button className="delete-confirm-btn delete" onClick={handleDeletePlaylist}>delete</button>
            </div>
          </div>
        </div>
      )}

      {/* Remove Song Confirmation Modal */}
      {songToRemove && (
        <div className="lyrics-modal-overlay" onClick={() => setSongToRemove(null)}>
          <div className="delete-confirm-modal" onClick={e => e.stopPropagation()}>
            <h2 className="delete-confirm-title">remove song?</h2>
            <p className="delete-confirm-text">Remove "{songToRemove.track_name}" from this playlist?</p>
            <div className="delete-confirm-buttons">
              <button className="delete-confirm-btn cancel" onClick={() => setSongToRemove(null)}>cancel</button>
              <button className="delete-confirm-btn delete" onClick={confirmRemoveSong}>remove</button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Playlist Modal */}
      {showEditModal && (
        <div className="lyrics-modal-overlay" onClick={() => setShowEditModal(false)}>
          <div className="edit-playlist-modal" onClick={e => e.stopPropagation()}>
            <h2 className="edit-modal-title">edit playlist</h2>
            <div className="input-wrapper">
              <input type="text" placeholder="playlist name" className="edit-modal-input" value={editTitle} onChange={e => setEditTitle(e.target.value.slice(0, LIMITS.playlistName))} maxLength={LIMITS.playlistName} />
              <span className="char-count">{editTitle.length}/{LIMITS.playlistName}</span>
            </div>
            <div className="input-wrapper">
              <textarea placeholder="description (optional)" className="edit-modal-textarea" value={editDescription} onChange={e => setEditDescription(e.target.value.slice(0, LIMITS.playlistDescription))} maxLength={LIMITS.playlistDescription} />
              <span className="char-count">{editDescription.length}/{LIMITS.playlistDescription}</span>
            </div>
            <div className="edit-modal-buttons">
              <button className="edit-modal-btn cancel" onClick={() => setShowEditModal(false)}>cancel</button>
              <button className="edit-modal-btn save" onClick={handleUpdatePlaylist}>save</button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Note Modal */}
      {showEditNoteModal && (
        <div className="lyrics-modal-overlay" onClick={() => setShowEditNoteModal(false)}>
          <div className="edit-playlist-modal" onClick={e => e.stopPropagation()}>
            <h2 className="edit-modal-title">edit note</h2>
            {editingSong && (
              <div className="editing-song-info">
                <img src={editingSong.album_cover} alt="" className="editing-song-cover" />
                <div>
                  <p className="editing-song-name">{editingSong.track_name}</p>
                  <p className="editing-song-artist">{editingSong.artist_name}</p>
                </div>
              </div>
            )}
            <div className="input-wrapper">
              <textarea placeholder="add a note about this song..." className="edit-modal-textarea" value={editNote} onChange={e => setEditNote(e.target.value.slice(0, LIMITS.songNote))} maxLength={LIMITS.songNote} />
              <span className="char-count">{editNote.length}/{LIMITS.songNote}</span>
            </div>
            <div className="edit-modal-buttons">
              <button className="edit-modal-btn cancel" onClick={() => setShowEditNoteModal(false)}>cancel</button>
              <button className="edit-modal-btn save" onClick={handleSaveNote}>save</button>
            </div>
          </div>
        </div>
      )}

      {/* Lyrics Modal */}
      {showLyricsModal && (
        <div className="lyrics-modal-overlay" onClick={closeLyricsModal}>
          <div className="lyrics-modal" onClick={e => e.stopPropagation()}>
            <div className="lyrics-modal-header">
              <h2 className="lyrics-modal-title">lyrics from "{selectedSong?.track_name}"</h2>
              <button className="lyrics-modal-close" onClick={closeLyricsModal}>×</button>
            </div>
            <div className="lyrics-modal-content">{lyricsLoading ? <p className="lyrics-loading">loading lyrics...</p> : lyrics}</div>
          </div>
        </div>
      )}

      {/* Add Song Modal */}
      {showAddModal && (
        <div className="lyrics-modal-overlay" onClick={closeAddModal}>
          <div className="add-song-modal" onClick={e => e.stopPropagation()}>
            <div className="add-song-header">
              <h2 className="add-song-title">add song to playlist</h2>
              <button className="add-song-close" onClick={closeAddModal}>×</button>
            </div>
            <div className="search-input-container">
              <input type="text" placeholder="search for a song..." className="search-input" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} onKeyPress={handleKeyPress} />
              <button className="search-btn" onClick={handleSearch} disabled={searching}>{searching ? '...' : 'search'}</button>
            </div>
            <div className="search-results">
              {searchResults.length > 0 ? (
                searchResults.map(track => (
                  <div key={track.id} className={`search-result-item ${selectedTrack?.id === track.id ? 'selected' : ''}`} onClick={() => setSelectedTrack(track)}>
                    <img src={track.album.images[0]?.url} alt={track.name} className="search-result-cover" />
                    <div className="search-result-info">
                      <p className="search-result-title">{track.name}</p>
                      <p className="search-result-artist">{track.artists.map(a => a.name).join(', ')}</p>
                      <p className="search-result-album">{track.album.name}</p>
                    </div>
                  </div>
                ))
              ) : (
                <p className="no-results">{searchQuery ? 'no results found' : 'search for a song to add'}</p>
              )}
            </div>
            {selectedTrack && (
              <div className="input-wrapper">
                <textarea placeholder="add a note about this song (optional)" className="note-input" value={trackNote} onChange={e => setTrackNote(e.target.value.slice(0, LIMITS.songNote))} maxLength={LIMITS.songNote} rows={2} />
                <span className="char-count">{trackNote.length}/{LIMITS.songNote}</span>
              </div>
            )}
            <div className="add-song-buttons">
              <button className="add-song-modal-btn cancel" onClick={closeAddModal}>cancel</button>
              <button className="add-song-modal-btn add" onClick={handleAddSong} disabled={!selectedTrack}>add song</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default PlaylistDetail