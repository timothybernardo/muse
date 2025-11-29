import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../services/supabase'
import './Playlists.css'

function Playlists() {
  const navigate = useNavigate()
  const [currentUser, setCurrentUser] = useState(null)
  const [userPlaylists, setUserPlaylists] = useState([])
  const [favoritePlaylists, setFavoritePlaylists] = useState([])
  const [recentPlaylists, setRecentPlaylists] = useState([])
  const [loading, setLoading] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [newPlaylistName, setNewPlaylistName] = useState('')
  const [newPlaylistDescription, setNewPlaylistDescription] = useState('')

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      setCurrentUser(user)

      const { data: allPlaylists, error } = await supabase
        .from('playlists')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Error fetching playlists:', error)
        return
      }

      if (allPlaylists) {
        const playlistsWithData = await Promise.all(
          allPlaylists.map(async (playlist) => {
            const { data: songs } = await supabase
              .from('playlist_songs')
              .select('album_id, track_name, album_cover, artist_name, album_name')
              .eq('playlist_id', playlist.id)
              .order('position', { ascending: true })
              .limit(4)
            
            const { data: profile } = await supabase
              .from('profiles')
              .select('username, avatar_url')
              .eq('id', playlist.user_id)
              .single()
            
            return {
              ...playlist,
              playlist_songs: songs || [],
              profiles: profile
            }
          })
        )

        const playlistCounts = {}
        playlistsWithData.forEach(p => {
          playlistCounts[p.user_id] = (playlistCounts[p.user_id] || 0) + 1
        })

        const playlistsWithCounts = playlistsWithData.map(p => ({
          ...p,
          userPlaylistCount: playlistCounts[p.user_id]
        }))

        if (user) {
          setUserPlaylists(playlistsWithCounts.filter(p => p.user_id === user.id))
        }

        setFavoritePlaylists(playlistsWithCounts.slice(0, 5))
        setRecentPlaylists(playlistsWithCounts.slice(0, 5))
      }
    } catch (error) {
      console.error('Error:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleCreatePlaylist = async () => {
    if (!newPlaylistName.trim() || !currentUser) return

    const { data, error } = await supabase
      .from('playlists')
      .insert({
        user_id: currentUser.id,
        title: newPlaylistName,
        description: newPlaylistDescription
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating playlist:', error)
      alert('Error creating playlist: ' + error.message)
      return
    }

    if (data) {
      setShowCreateModal(false)
      setNewPlaylistName('')
      setNewPlaylistDescription('')
      fetchData()
      navigate(`/playlist/${data.id}`)
    }
  }

  // Handle clicking on the playlist card
  const handlePlaylistClick = (playlistId) => {
    navigate(`/playlist/${playlistId}`)
  }

  // Handle clicking on user profile (stop propagation to prevent card click)
  const handleUserClick = (e, userId) => {
    e.stopPropagation()
    navigate(`/profile/${userId}`)
  }

  const PlaylistCard = ({ playlist }) => (
    <div 
      className="playlist-card"
      onClick={() => handlePlaylistClick(playlist.id)}
    >
      <div className="playlist-header">
        <span className="playlist-name">{playlist.title}</span>
        {playlist.description && (
          <span className="playlist-description">{playlist.description}</span>
        )}
      </div>
      <div className="playlist-content">
        <div className="playlist-albums">
          {playlist.playlist_songs?.slice(0, 4).map((song, index) => (
            <img
              key={index}
              src={song.album_cover}
              alt={song.track_name}
              className="playlist-album-cover"
            />
          ))}
          {(!playlist.playlist_songs || playlist.playlist_songs.length === 0) && (
            <div className="empty-state" style={{ padding: '20px' }}>No songs yet</div>
          )}
        </div>
        <div 
          className="playlist-user"
          onClick={(e) => handleUserClick(e, playlist.user_id)}
        >
          {playlist.profiles?.avatar_url ? (
            <img src={playlist.profiles.avatar_url} alt="" className="playlist-user-avatar" />
          ) : (
            <div className="playlist-user-avatar" />
          )}
          <span className="playlist-user-name">{playlist.profiles?.username || 'User'}</span>
          <span className="playlist-user-count">{playlist.userPlaylistCount} playlists</span>
        </div>
      </div>
    </div>
  )

  if (loading) {
    return <div className="playlists-page"><p className="loading-text">Loading playlists...</p></div>
  }

  return (
    <div className="playlists-page">
      <div className="playlists-content">
        <button className="create-playlist-btn" onClick={() => setShowCreateModal(true)}>
          + create new playlist
        </button>

        {userPlaylists.length > 0 && (
          <div className="playlists-section">
            <h2 className="section-title">your playlists</h2>
            <div className="section-line"></div>
            {userPlaylists.map(playlist => (
              <PlaylistCard key={playlist.id} playlist={playlist} />
            ))}
          </div>
        )}

        <div className="playlists-section">
          <h2 className="section-title">user-favorite playlists</h2>
          <div className="section-line"></div>
          {favoritePlaylists.length > 0 ? (
            favoritePlaylists.map(playlist => (
              <PlaylistCard key={playlist.id} playlist={playlist} />
            ))
          ) : (
            <p className="empty-state">No playlists yet. Create the first one!</p>
          )}
        </div>

        <div className="playlists-section">
          <h2 className="section-title">recently-made playlists</h2>
          <div className="section-line"></div>
          {recentPlaylists.length > 0 ? (
            recentPlaylists.map(playlist => (
              <PlaylistCard key={playlist.id} playlist={playlist} />
            ))
          ) : (
            <p className="empty-state">No playlists yet</p>
          )}
        </div>
      </div>

      {showCreateModal && (
        <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <h2 className="modal-title">create playlist</h2>
            <input
              type="text"
              placeholder="playlist name"
              className="modal-input"
              value={newPlaylistName}
              onChange={e => setNewPlaylistName(e.target.value)}
            />
            <textarea
              placeholder="description (optional)"
              className="modal-textarea"
              value={newPlaylistDescription}
              onChange={e => setNewPlaylistDescription(e.target.value)}
            />
            <div className="modal-buttons">
              <button className="modal-btn cancel" onClick={() => setShowCreateModal(false)}>
                cancel
              </button>
              <button className="modal-btn save" onClick={handleCreatePlaylist}>
                create
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default Playlists