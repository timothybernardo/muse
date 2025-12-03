import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../services/supabase'
import { spotifyService } from '../../services/spotify'
import './Search.css'

function Search() {
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState('albums')
  const [searchQuery, setSearchQuery] = useState('')
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [hasSearched, setHasSearched] = useState(false)

  const handleSearch = async () => {
    if (!searchQuery.trim()) return

    setLoading(true)
    setHasSearched(true)
    setResults([])

    try {
      if (activeTab === 'albums') {
        const albums = await spotifyService.searchAlbums(searchQuery, 20)
        setResults(albums)
      } else if (activeTab === 'playlists') {
        console.log('searching playlists for:', searchQuery)
        
        const { data, error } = await supabase
          .from('playlists')
          .select('*')
          .ilike('title', `%${searchQuery}%`)
          .limit(20)
        
        console.log('Playlist results:', data)
        console.log('Playlist error:', error)
        
        if (error) {
          console.error('Playlist search error:', error)
        }
        
        // Fetch creator profiles and songs separately
        if (data && data.length > 0) {
          const playlistsWithData = await Promise.all(
            data.map(async (playlist) => {
              const { data: profile } = await supabase
                .from('profiles')
                .select('username, avatar_url')
                .eq('id', playlist.user_id)
                .single()
              
              const { data: songs } = await supabase
                .from('playlist_songs')
                .select('album_cover')
                .eq('playlist_id', playlist.id)
                .order('position', { ascending: true })
                .limit(4)
              
              return { ...playlist, profiles: profile, songs: songs || [] }
            })
          )
          setResults(playlistsWithData)
        } else {
          setResults(data || [])
        }
      } else if (activeTab === 'users') {
        const { data } = await supabase
          .from('profiles')
          .select('*')
          .ilike('username', `%${searchQuery}%`)
          .limit(20)
        setResults(data || [])
      }
    } catch (error) {
      console.error('Search error:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleSearch()
    }
  }

  const handleTabChange = (tab) => {
    setActiveTab(tab)
    setResults([])
    setHasSearched(false)
  }

  const renderAlbumResults = () => (
    <div className="results-grid albums-grid">
      {results.map(album => (
        <div 
          key={album.id} 
          className="album-card"
          onClick={() => navigate(`/album/${album.id}`)}
        >
          <img 
            src={album.images?.[0]?.url} 
            alt={album.name} 
            className="album-cover"
          />
          <h3 className="album-name">{album.name}</h3>
          <p className="album-artist">{album.artists?.map(a => a.name).join(', ')}</p>
        </div>
      ))}
    </div>
  )

  const renderPlaylistResults = () => (
    <div className="results-grid playlists-grid">
      {results.map(playlist => (
        <div 
          key={playlist.id} 
          className="playlist-card"
          onClick={() => navigate(`/playlist/${playlist.id}`)}
        >
          <div className="playlist-covers">
            {playlist.songs && playlist.songs.length > 0 ? (
              playlist.songs.slice(0, 4).map((song, index) => (
                <img 
                  key={index} 
                  src={song.album_cover} 
                  alt="" 
                  className="playlist-cover-img"
                />
              ))
            ) : (
              <div className="playlist-icon">♫</div>
            )}
          </div>
          <div className="playlist-info">
            <h3 className="playlist-name">{playlist.title}</h3>
            <p className="playlist-description">{playlist.description}</p>
            <p className="playlist-creator">by {playlist.profiles?.username || 'User'}</p>
          </div>
        </div>
      ))}
    </div>
  )

  const renderUserResults = () => (
    <div className="results-grid users-grid">
      {results.map(user => (
        <div 
          key={user.id} 
          className="user-card"
          onClick={() => navigate(`/profile/${user.id}`)}
        >
          {user.avatar_url ? (
            <img src={user.avatar_url} alt={user.username} className="user-avatar" />
          ) : (
            <div className="user-avatar placeholder" />
          )}
          <h3 className="user-name">{user.username}</h3>
          {user.bio && <p className="user-bio">{user.bio}</p>}
        </div>
      ))}
    </div>
  )

  const renderResults = () => {
    if (loading) {
      return <p className="loading-text">Searching...</p>
    }

    if (!hasSearched) {
      return <p className="empty-text">Search for {activeTab}</p>
    }

    if (results.length === 0) {
      return <p className="empty-text">No {activeTab} found for "{searchQuery}"</p>
    }

    switch (activeTab) {
      case 'albums':
        return renderAlbumResults()
      case 'playlists':
        return renderPlaylistResults()
      case 'users':
        return renderUserResults()
      default:
        return null
    }
  }

  return (
    <div className="search-page">
      <div className="search-content">
        <h1 className="search-title">search</h1>

        {/* Tabs */}
        <div className="search-tabs">
          <button 
            className={`tab-btn ${activeTab === 'albums' ? 'active' : ''}`}
            onClick={() => handleTabChange('albums')}
          >
            albums
          </button>
          <button 
            className={`tab-btn ${activeTab === 'playlists' ? 'active' : ''}`}
            onClick={() => handleTabChange('playlists')}
          >
            playlists
          </button>
          <button 
            className={`tab-btn ${activeTab === 'users' ? 'active' : ''}`}
            onClick={() => handleTabChange('users')}
          >
            users
          </button>
        </div>

        {/* Search Bar */}
        <div className="search-bar">
          <input
            type="text"
            placeholder={`search for ${activeTab}...`}
            className="search-input"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyPress={handleKeyPress}
          />
          <button className="search-btn" onClick={handleSearch} disabled={loading}>
            {loading ? '...' : 'search'}
          </button>
        </div>

        {/* Results */}
        <div className="search-results">
          {renderResults()}
        </div>
      </div>
    </div>
  )
}

export default Search