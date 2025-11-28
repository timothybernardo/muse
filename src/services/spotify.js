// Spotify API Service
const CLIENT_ID = import.meta.env.VITE_SPOTIFY_CLIENT_ID
const CLIENT_SECRET = import.meta.env.VITE_SPOTIFY_CLIENT_SECRET
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
  tokenExpiry = Date.now() + (data.expires_in * 1000) - 60000 // Refresh 1 min early
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
  // Get new releases
  getNewReleases: async (limit = 20) => {
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

  // Get album details
  getAlbum: async (albumId) => {
    return spotifyFetch(`/albums/${albumId}`)
  },

  // Get artist's albums
  getArtistAlbums: async (artistId, limit = 20) => {
    const data = await spotifyFetch(`/albums?ids=${artistId}&limit=${limit}`)
    return data.items || []
  },

  // Get several albums by IDs
  getAlbums: async (albumIds) => {
    const data = await spotifyFetch(`/albums?ids=${albumIds.join(',')}`)
    return data.albums || []
  }
}