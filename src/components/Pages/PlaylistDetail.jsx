import { useState, useEffect } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { supabase } from '../../services/supabase'
import { geniusService } from '../../services/genius'
import { spotifyService } from '../../services/spotify'
import './PlaylistDetail.css'

function PlaylistDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [playlist, setPlaylist] = useState(null)
  const [songs, setSongs] = useState([])
  const [creator, setCreator] = useState(null)
  const [loading, setLoading] = useState(true)
  const [currentUser, setCurrentUser] = useState(null)
  
  // Lyrics modal
  const [showLyricsModal, setShowLyricsModal] = useState(false)
  const [selectedSong, setSelectedSong] = useState(null)
  const [lyrics, setLyrics] = useState('')
  const [lyricsLoading, setLyricsLoading] = useState(false)

  // Add song modal
  const [showAddModal, setShowAddModal] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [selectedTrack, setSelectedTrack] = useState(null)
  const [trackNote, setTrackNote] = useState('')
  const [searching, setSearching] = useState(false)

  // Delete confirmation
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  // Edit playlist modal
  const [showEditModal, setShowEditModal] = useState(false)
  const [editTitle, setEditTitle] = useState('')
  const [editDescription, setEditDescription] = useState('')

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

    } catch (error) {
      console.error('Error:', error)
    } finally {
      setLoading(false)
    }
  }

  // Update playlist title/description
  const handleUpdatePlaylist = async () => {
    if (!editTitle.trim()) {
      alert('Playlist name cannot be empty')
      return
    }

    const { error } = await supabase
      .from('playlists')
      .update({ 
        title: editTitle, 
        description: editDescription 
      })
      .eq('id', id)

    if (error) {
      console.error('Error updating playlist:', error)
      alert('Error updating playlist: ' + error.message)
    } else {
      setPlaylist({ ...playlist, title: editTitle, description: editDescription })
      setShowEditModal(false)
    }
  }

  // Remove song from playlist
  const handleRemoveSong = async (song, index) => {
    if (!confirm(`Remove "${song.track_name}" from this playlist?`)) return

    const { error } = await supabase
      .from('playlist_songs')
      .delete()
      .eq('playlist_id', id)
      .eq('position', song.position)

    if (error) {
      console.error('Error removing song:', error)
      alert('Error removing song: ' + error.message)
    } else {
      fetchPlaylist()
    }
  }

  // Delete entire playlist
  const handleDeletePlaylist = async () => {
    const { error: songsError } = await supabase
      .from('playlist_songs')
      .delete()
      .eq('playlist_id', id)

    if (songsError) {
      console.error('Error deleting songs:', songsError)
      alert('Error deleting playlist: ' + songsError.message)
      return
    }

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
        setLyrics('Lyrics not found for this track.')
      }
    } catch (error) {
      setLyrics('Failed to load lyrics.')
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
    if (e.key === 'Enter') {
      handleSearch()
    }
  }

  const handleAddSong = async () => {
    if (!selectedTrack || !currentUser) return

    const existingSong = songs.find(s => 
      s.album_id === selectedTrack.album.id && s.track_name === selectedTrack.name
    )
    
    if (existingSong) {
      alert('This song is already in the playlist!')
      return
    }

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
        note: trackNote
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
      if (error.code === '23505' || error.code === '409') {
        alert('This song is already in the playlist!')
      } else {
        alert('Error adding song: ' + error.message)
      }
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
    while (covers.length < 4) {
      covers.push(null)
    }
    return covers
  }

  // Navigate to album page
  const handleAlbumClick = (e, albumId) => {
    e.stopPropagation()
    navigate(`/album/${albumId}`)
  }

  if (loading) {
    return <div className="playlist-detail-page"><p className="loading-text">Loading playlist...</p></div>
  }

  if (!playlist) {
    return <div className="playlist-detail-page"><p className="loading-text">Playlist not found</p></div>
  }

  const isOwner = currentUser?.id === playlist.user_id
  const coverImages = getCoverImages()

  return (
    <div className="playlist-detail-page">
      <div className="playlist-detail-content">
        {/* Playlist Header */}
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
                <button 
                  className="edit-playlist-btn"
                  onClick={() => setShowEditModal(true)}
                >
                  edit
                </button>
              )}
            </h1>
            <p className="playlist-description">{playlist.description}</p>
            
            {isOwner && (
              <button 
                className="delete-playlist-btn"
                onClick={() => setShowDeleteConfirm(true)}
              >
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

        {/* Song List */}
        {songs.length > 0 ? (
          songs.map((song, index) => (
            <div key={song.playlist_id + '-' + song.album_id + '-' + index} className="song-item">
              <img
                src={song.album_cover}
                alt={song.track_name}
                className="song-cover"
                onClick={() => handleSongClick(song)}
              />
              <div className="song-info">
                <h3 className="song-title">{song.track_name}</h3>
                <p className="song-artist">
                  {song.artist_name} on{' '}
                  <span 
                    className="album-name clickable"
                    onClick={(e) => handleAlbumClick(e, song.album_id)}
                  >
                    {song.album_name}
                  </span>
                </p>
                {song.note && <p className="song-note">{song.note}</p>}
              </div>
              <div className="song-position">{index + 1}</div>
              
              {isOwner && (
                <button 
                  className="remove-song-btn"
                  onClick={() => handleRemoveSong(song, index)}
                  title="Remove song"
                >
                  ×
                </button>
              )}
            </div>
          ))
        ) : (
          <p className="empty-state">No songs in this playlist yet.</p>
        )}

        {isOwner && (
          <button className="add-song-btn" onClick={() => setShowAddModal(true)}>
            + add song
          </button>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="lyrics-modal-overlay" onClick={() => setShowDeleteConfirm(false)}>
          <div className="delete-confirm-modal" onClick={e => e.stopPropagation()}>
            <h2 className="delete-confirm-title">delete playlist?</h2>
            <p className="delete-confirm-text">
              Are you sure you want to delete "{playlist.title}"? This action cannot be undone.
            </p>
            <div className="delete-confirm-buttons">
              <button 
                className="delete-confirm-btn cancel" 
                onClick={() => setShowDeleteConfirm(false)}
              >
                cancel
              </button>
              <button 
                className="delete-confirm-btn delete" 
                onClick={handleDeletePlaylist}
              >
                delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Playlist Modal */}
      {showEditModal && (
        <div className="lyrics-modal-overlay" onClick={() => setShowEditModal(false)}>
          <div className="edit-playlist-modal" onClick={e => e.stopPropagation()}>
            <h2 className="edit-modal-title">edit playlist</h2>
            <input
              type="text"
              placeholder="playlist name"
              className="edit-modal-input"
              value={editTitle}
              onChange={e => setEditTitle(e.target.value)}
            />
            <textarea
              placeholder="description (optional)"
              className="edit-modal-textarea"
              value={editDescription}
              onChange={e => setEditDescription(e.target.value)}
            />
            <div className="edit-modal-buttons">
              <button 
                className="edit-modal-btn cancel" 
                onClick={() => setShowEditModal(false)}
              >
                cancel
              </button>
              <button 
                className="edit-modal-btn save" 
                onClick={handleUpdatePlaylist}
              >
                save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Lyrics Modal */}
      {showLyricsModal && (
        <div className="lyrics-modal-overlay" onClick={closeLyricsModal}>
          <div className="lyrics-modal" onClick={e => e.stopPropagation()}>
            <div className="lyrics-modal-header">
              <h2 className="lyrics-modal-title">
                lyrics from "{selectedSong?.track_name}"
              </h2>
              <button className="lyrics-modal-close" onClick={closeLyricsModal}>
                ×
              </button>
            </div>
            <div className="lyrics-modal-content">
              {lyricsLoading ? (
                <p className="lyrics-loading">Loading lyrics...</p>
              ) : (
                lyrics
              )}
            </div>
          </div>
        </div>
      )}

      {/* Add Song Modal */}
      {showAddModal && (
        <div className="lyrics-modal-overlay" onClick={closeAddModal}>
          <div className="add-song-modal" onClick={e => e.stopPropagation()}>
            <div className="add-song-header">
              <h2 className="add-song-title">add song to playlist</h2>
              <button className="add-song-close" onClick={closeAddModal}>
                ×
              </button>
            </div>

            <div className="search-input-container">
              <input
                type="text"
                placeholder="search for a song..."
                className="search-input"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                onKeyPress={handleKeyPress}
              />
              <button className="search-btn" onClick={handleSearch} disabled={searching}>
                {searching ? '...' : 'search'}
              </button>
            </div>

            <div className="search-results">
              {searchResults.length > 0 ? (
                searchResults.map(track => (
                  <div
                    key={track.id}
                    className={`search-result-item ${selectedTrack?.id === track.id ? 'selected' : ''}`}
                    onClick={() => setSelectedTrack(track)}
                  >
                    <img
                      src={track.album.images[0]?.url}
                      alt={track.name}
                      className="search-result-cover"
                    />
                    <div className="search-result-info">
                      <p className="search-result-title">{track.name}</p>
                      <p className="search-result-artist">
                        {track.artists.map(a => a.name).join(', ')}
                      </p>
                      <p className="search-result-album">{track.album.name}</p>
                    </div>
                  </div>
                ))
              ) : (
                <p className="no-results">
                  {searchQuery ? 'No results found' : 'Search for a song to add'}
                </p>
              )}
            </div>

            {selectedTrack && (
              <textarea
                placeholder="add a note about why you added this song (optional)"
                className="note-input"
                value={trackNote}
                onChange={e => setTrackNote(e.target.value)}
                rows={2}
              />
            )}

            <div className="add-song-buttons">
              <button className="add-song-modal-btn cancel" onClick={closeAddModal}>
                cancel
              </button>
              <button
                className="add-song-modal-btn add"
                onClick={handleAddSong}
                disabled={!selectedTrack}
              >
                add song
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default PlaylistDetail