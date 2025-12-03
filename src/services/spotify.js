// Spotify API Service
const CLIENT_ID = import.meta.env.VITE_SPOTIFY_CLIENT_ID || 'your_client_id'
const CLIENT_SECRET = import.meta.env.VITE_SPOTIFY_CLIENT_SECRET || 'your_client_secret'

let accessToken = null
let tokenExpiry = null

// Get access token using Client Credentials flow
const getAccessToken = async () => {
  if (accessToken && tokenExpiry && Date.now() < tokenExpiry) {
    return accessToken
  }

  const response = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': 'Basic ' + btoa(CLIENT_ID + ':' + CLIENT_SECRET)
    },
    body: 'grant_type=client_credentials'
  })

  const data = await response.json()
  accessToken = data.access_token
  tokenExpiry = Date.now() + (data.expires_in * 1000) - 60000
  return accessToken
}

// Generic fetch with auth
const spotifyFetch = async (endpoint) => {
  const token = await getAccessToken()
  const response = await fetch(`https://api.spotify.com/v1${endpoint}`, {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  })
  return response.json()
}

export const spotifyService = {
  // Get recent album releases sorted by popularity
  getNewMusicFriday: async (limit = 20) => {
    // Use Spotify's new releases endpoint
    const data = await spotifyFetch(`/browse/new-releases?limit=50`)
    const albums = data.albums?.items || []
    
    if (albums.length === 0) return []
    
    // Get full album details with popularity and release date
    const albumIds = albums.map(a => a.id)
    const chunks = []
    for (let i = 0; i < albumIds.length; i += 20) {
      chunks.push(albumIds.slice(i, i + 20))
    }
    
    const fullAlbums = []
    for (const chunk of chunks) {
      const details = await spotifyFetch(`/albums?ids=${chunk.join(',')}`)
      if (details.albums) {
        fullAlbums.push(...details.albums.filter(a => a !== null))
      }
    }
    
    // Log release dates to see what we're getting
    console.log('Album release dates:', fullAlbums.map(a => ({ name: a.name, date: a.release_date })))
    
    // Filter to only albums released in the last 30 days
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
    
    const recentAlbums = fullAlbums.filter(album => {
      if (!album.release_date) return false
      // Handle different date formats (YYYY, YYYY-MM, YYYY-MM-DD)
      let releaseDate
      if (album.release_date.length === 4) {
        // Just year, assume Jan 1
        releaseDate = new Date(`${album.release_date}-01-01`)
      } else if (album.release_date.length === 7) {
        // Year-month, assume 1st of month
        releaseDate = new Date(`${album.release_date}-01`)
      } else {
        releaseDate = new Date(album.release_date)
      }
      return releaseDate >= thirtyDaysAgo
    })
    
    console.log('Filtered albums:', recentAlbums.length)
    
    // If no recent albums, just return all sorted by release date then popularity
    if (recentAlbums.length === 0) {
      return fullAlbums
        .sort((a, b) => new Date(b.release_date) - new Date(a.release_date))
        .slice(0, 20)
    }
    
    // Sort by popularity (most popular first)
    return recentAlbums.sort((a, b) => (b.popularity || 0) - (a.popularity || 0))
  },

  // Get new releases with popularity (fetches full album details)
  getNewReleases: async (limit = 20) => {
    const data = await spotifyFetch(`/browse/new-releases?limit=${limit}`)
    const albums = data.albums?.items || []
    
    // Fetch full details for each album to get popularity
    // Spotify allows up to 20 albums per request
    if (albums.length === 0) return []
    
    const albumIds = albums.map(a => a.id)
    const chunks = []
    
    // Split into chunks of 20
    for (let i = 0; i < albumIds.length; i += 20) {
      chunks.push(albumIds.slice(i, i + 20))
    }
    
    const fullAlbums = []
    for (const chunk of chunks) {
      const details = await spotifyFetch(`/albums?ids=${chunk.join(',')}`)
      if (details.albums) {
        fullAlbums.push(...details.albums)
      }
    }
    
    return fullAlbums
  },

  // Get new releases simple (without popularity, faster)
  getNewReleasesSimple: async (limit = 20) => {
    const data = await spotifyFetch(`/browse/new-releases?limit=${limit}`)
    return data.albums?.items || []
  },

  // Get featured playlists (for trending)
  getFeaturedPlaylists: async (limit = 10) => {
    const data = await spotifyFetch(`/browse/featured-playlists?limit=${limit}`)
    return data.playlists?.items || []
  },

  // Get albums by genre/category
  getCategories: async () => {
    const data = await spotifyFetch('/browse/categories?limit=50')
    return data.categories?.items || []
  },

  // Get category playlists
  getCategoryPlaylists: async (categoryId, limit = 10) => {
    const data = await spotifyFetch(`/browse/categories/${categoryId}/playlists?limit=${limit}`)
    return data.playlists?.items || []
  },

  // Search for albums
  searchAlbums: async (query, limit = 20) => {
    const data = await spotifyFetch(`/search?q=${encodeURIComponent(query)}&type=album&limit=${limit}`)
    return data.albums?.items || []
  },

  // Search for tracks
  searchTracks: async (query, limit = 20) => {
    const data = await spotifyFetch(`/search?q=${encodeURIComponent(query)}&type=track&limit=${limit}`)
    return data.tracks?.items || []
  },

  // Get album details
  getAlbum: async (albumId) => {
    return spotifyFetch(`/albums/${albumId}`)
  },

  // Get several albums by IDs (max 20)
  getAlbums: async (albumIds) => {
    const data = await spotifyFetch(`/albums?ids=${albumIds.join(',')}`)
    return data.albums || []
  },

  // Get artist details
  getArtist: async (artistId) => {
    return spotifyFetch(`/artists/${artistId}`)
  },

  // Get artist's albums
  getArtistAlbums: async (artistId, limit = 20) => {
    const data = await spotifyFetch(`/artists/${artistId}/albums?limit=${limit}`)
    return data.items || []
  }
}