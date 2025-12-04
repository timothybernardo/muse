import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../services/supabase'
import { PlaylistCardSkeleton } from '../../components/Skeleton'
import './Playlists.css'

const LIMITS = {
  playlistName: 50,
  playlistDescription: 150
}

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

            // Get like count for this playlist
            const { count: likeCount } = await supabase
              .from('playlist_likes')
              .select('*', { count: 'exact', head: true })
              .eq('playlist_id', playlist.id)

            // Get comment count for this playlist
            const { count: commentCount } = await supabase
              .from('playlist_comments')
              .select('*', { count: 'exact', head: true })
              .eq('playlist_id', playlist.id)
            
            return { 
              ...playlist, 
              playlist_songs: songs || [], 
              profiles: profile,
              likeCount: likeCount || 0,
              commentCount: commentCount || 0
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

        // Sort by like count for favorites (most liked first)
        const sortedByLikes = [...playlistsWithCounts].sort((a, b) => b.likeCount - a.likeCount)
        setFavoritePlaylists(sortedByLikes.slice(0, 5))

        // Recent playlists stay sorted by created_at (already sorted from query)
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
        title: newPlaylistName.slice(0, LIMITS.playlistName),
        description: newPlaylistDescription.slice(0, LIMITS.playlistDescription)
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

  const handlePlaylistClick = (playlistId) => {
    navigate(`/playlist/${playlistId}`)
  }

  const handleUserClick = (e, userId) => {
    e.stopPropagation()
    navigate(`/profile/${userId}`)
  }

  const PlaylistCard = ({ playlist }) => (
    <div className="playlist-card" onClick={() => handlePlaylistClick(playlist.id)}>
      <div className="playlist-card-left">
        <div className="playlist-albums">
          {playlist.playlist_songs?.slice(0, 4).map((song, index) => (
            <img key={index} src={song.album_cover} alt={song.track_name} className="playlist-album-cover" />
          ))}
          {(!playlist.playlist_songs || playlist.playlist_songs.length === 0) && (
            <>
              <div className="playlist-album-cover empty" />
              <div className="playlist-album-cover empty" />
              <div className="playlist-album-cover empty" />
              <div className="playlist-album-cover empty" />
            </>
          )}
        </div>
      </div>
      <div className="playlist-card-right">
        <span className="playlist-name">{playlist.title}</span>
        {playlist.description && (
          <p className="playlist-bio">{playlist.description}</p>
        )}
        <div className="playlist-stats">
          <span className="playlist-stat">♥ {playlist.likeCount || 0}</span>
          <span className="playlist-stat">💬 {playlist.commentCount || 0}</span>
        </div>
        <div className="playlist-user" onClick={(e) => handleUserClick(e, playlist.user_id)}>
          {playlist.profiles?.avatar_url ? (
            <img src={playlist.profiles.avatar_url} alt="" className="playlist-user-avatar" />
          ) : (
            <div className="playlist-user-avatar" />
          )}
          <span className="playlist-user-name">{playlist.profiles?.username || 'User'}</span>
        </div>
      </div>
    </div>
  )

  if (loading) {
    return (
      <div className="playlists-page">
        <div className="playlists-content">
          <div className="skeleton" style={{ width: '200px', height: '50px', borderRadius: '25px', marginBottom: '30px' }} />
          <div className="playlists-section">
            <div className="skeleton skeleton-text-lg" style={{ width: '180px', marginBottom: '10px' }} />
            <div className="section-line"></div>
            <PlaylistCardSkeleton />
            <PlaylistCardSkeleton />
            <PlaylistCardSkeleton />
          </div>
        </div>
      </div>
    )
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
          <h2 className="section-title">most-loved playlists</h2>
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
            
            <div className="input-wrapper">
              <input
                type="text"
                placeholder="playlist name"
                className="modal-input"
                value={newPlaylistName}
                onChange={e => setNewPlaylistName(e.target.value.slice(0, LIMITS.playlistName))}
                maxLength={LIMITS.playlistName}
              />
              <span className="char-count">{newPlaylistName.length}/{LIMITS.playlistName}</span>
            </div>

            <div className="input-wrapper">
              <textarea
                placeholder="description (optional)"
                className="modal-textarea"
                value={newPlaylistDescription}
                onChange={e => setNewPlaylistDescription(e.target.value.slice(0, LIMITS.playlistDescription))}
                maxLength={LIMITS.playlistDescription}
              />
              <span className="char-count">{newPlaylistDescription.length}/{LIMITS.playlistDescription}</span>
            </div>

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