// Spotify API Service with Caching
const CLIENT_ID = import.meta.env.VITE_SPOTIFY_CLIENT_ID || 'your_client_id'
const CLIENT_SECRET = import.meta.env.VITE_SPOTIFY_CLIENT_SECRET || 'your_client_secret'

let accessToken = null
let tokenExpiry = null

// ===================
// CACHE CONFIGURATION
// ===================
const STORAGE_KEY = 'muse_spotify_cache'
const cache = new Map()

// Load cache from sessionStorage on startup
const loadCacheFromStorage = () => {
  try {
    const stored = sessionStorage.getItem(STORAGE_KEY)
    if (stored) {
      const parsed = JSON.parse(stored)
      const now = Date.now()
      let loaded = 0
      for (const [key, item] of Object.entries(parsed)) {
        if (now < item.expiry) {
          cache.set(key, item)
          loaded++
        }
      }
      console.log(`[Cache] Loaded ${loaded} items from storage`)
    }
  } catch (e) {
    console.warn('[Cache] Failed to load from storage', e)
  }
}

// Save cache to sessionStorage
const saveCacheToStorage = () => {
  try {
    const obj = Object.fromEntries(cache.entries())
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(obj))
  } catch (e) {
    // Storage full - clear old entries
    console.warn('[Cache] Storage full, clearing old entries')
    sessionStorage.removeItem(STORAGE_KEY)
  }
}

// Load on startup
loadCacheFromStorage()

// Save periodically (every 30 seconds)
setInterval(saveCacheToStorage, 30 * 1000)

// Save before page unload
window.addEventListener('beforeunload', saveCacheToStorage)

// Track in-flight requests to prevent duplicates
const pendingRequests = new Map()

const CACHE_DURATIONS = {
  album: 60 * 60 * 1000,         // 1 hour - album details rarely change
  albums: 60 * 60 * 1000,        // 1 hour - batch album fetches
  search: 10 * 60 * 1000,        // 10 min - search results
  newReleases: 30 * 60 * 1000,   // 30 min - new releases update periodically
  categories: 24 * 60 * 60 * 1000, // 24 hours - categories rarely change
  playlists: 15 * 60 * 1000,     // 15 min - playlist contents
  artist: 60 * 60 * 1000,        // 1 hour - artist info
}

// Cache helpers
const getCached = (key) => {
  const item = cache.get(key)
  if (!item) return null
  if (Date.now() > item.expiry) {
    cache.delete(key)
    return null
  }
  return item.data
}

const setCache = (key, data, duration) => {
  cache.set(key, {
    data,
    expiry: Date.now() + duration
  })
}

// Clear expired entries periodically (every 5 min)
setInterval(() => {
  const now = Date.now()
  for (const [key, item] of cache.entries()) {
    if (now > item.expiry) cache.delete(key)
  }
}, 5 * 60 * 1000)

// ===================
// AUTH
// ===================
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
    headers: { 'Authorization': `Bearer ${token}` }
  })
  if (!response.ok) {
    throw new Error(`Spotify API error: ${response.status}`)
  }
  return response.json()
}

// ===================
// CACHED API METHODS
// ===================
export const spotifyService = {
  // Get single album (NOT cached - always fetch fresh to ensure tracks are included)
  getAlbum: async (albumId) => {
    console.log(`[Fetch] album: ${albumId}`)
    const data = await spotifyFetch(`/albums/${albumId}`)
    return data
  },

  // Get multiple albums (cached individually)
  // NOTE: Batch endpoint returns albums WITHOUT full tracks, so don't cache as full albums
  getAlbums: async (albumIds) => {
    const results = {}

    console.log(`[Cache] Fetching ${albumIds.length} albums (batch - no track data)`)

    // Fetch albums in batches of 20
    for (let i = 0; i < albumIds.length; i += 20) {
      const batch = albumIds.slice(i, i + 20)
      const data = await spotifyFetch(`/albums?ids=${batch.join(',')}`)
      if (data.albums) {
        for (const album of data.albums) {
          if (album) {
            // DON'T cache these - they don't have full track info
            results[album.id] = album
          }
        }
      }
    }

    // Return in original order
    return albumIds.map(id => results[id]).filter(Boolean)
  },

  // Get new releases (cached - but don't cache as full albums)
  getNewReleases: async (limit = 20) => {
    const cacheKey = `newReleases:${limit}`
    const cached = getCached(cacheKey)
    if (cached) {
      console.log('[Cache HIT] newReleases')
      return cached
    }

    console.log('[Cache MISS] newReleases')
    const data = await spotifyFetch(`/browse/new-releases?limit=${limit}`)
    const albums = data.albums?.items || []

    // NOTE: Don't cache these as full albums - they don't have tracks!
    // Only cache the newReleases list itself

    setCache(cacheKey, albums, CACHE_DURATIONS.newReleases)
    return albums
  },

  // Get new releases with full details/popularity (cached)
  getNewReleasesWithPopularity: async (limit = 20) => {
    const cacheKey = `newReleasesPopular:${limit}`
    const cached = getCached(cacheKey)
    if (cached) {
      console.log('[Cache HIT] newReleasesWithPopularity')
      return cached
    }

    console.log('[Cache MISS] newReleasesWithPopularity')
    const data = await spotifyFetch(`/browse/new-releases?limit=${limit}`)
    const albums = data.albums?.items || []
    if (albums.length === 0) return []

    // Fetch full details for popularity
    const fullAlbums = await spotifyService.getAlbums(albums.map(a => a.id))
    const sorted = fullAlbums.sort((a, b) => (b.popularity || 0) - (a.popularity || 0))

    setCache(cacheKey, sorted, CACHE_DURATIONS.newReleases)
    return sorted
  },

  // Search albums (cached - but don't cache as full albums)
  searchAlbums: async (query, limit = 20) => {
    const cacheKey = `search:album:${query.toLowerCase()}:${limit}`
    const cached = getCached(cacheKey)
    if (cached) {
      console.log(`[Cache HIT] search: ${query}`)
      return cached
    }

    console.log(`[Cache MISS] search: ${query}`)
    const data = await spotifyFetch(`/search?q=${encodeURIComponent(query)}&type=album&limit=${limit}`)
    const albums = data.albums?.items || []

    // NOTE: Don't cache these as full albums - they don't have tracks!

    setCache(cacheKey, albums, CACHE_DURATIONS.search)
    return albums
  },

  // Search tracks (cached)
  searchTracks: async (query, limit = 20) => {
    const cacheKey = `search:track:${query.toLowerCase()}:${limit}`
    const cached = getCached(cacheKey)
    if (cached) {
      console.log(`[Cache HIT] track search: ${query}`)
      return cached
    }

    console.log(`[Cache MISS] track search: ${query}`)
    const data = await spotifyFetch(`/search?q=${encodeURIComponent(query)}&type=track&limit=${limit}`)
    const tracks = data.tracks?.items || []
    setCache(cacheKey, tracks, CACHE_DURATIONS.search)
    return tracks
  },

  // Get categories (cached - long duration)
  getCategories: async () => {
    const cacheKey = 'categories'
    const cached = getCached(cacheKey)
    if (cached) {
      console.log('[Cache HIT] categories')
      return cached
    }

    console.log('[Cache MISS] categories')
    const data = await spotifyFetch('/browse/categories?limit=50')
    const categories = data.categories?.items || []
    setCache(cacheKey, categories, CACHE_DURATIONS.categories)
    return categories
  },

  // Get featured playlists (cached)
  getFeaturedPlaylists: async (limit = 10) => {
    const cacheKey = `featuredPlaylists:${limit}`
    const cached = getCached(cacheKey)
    if (cached) {
      console.log('[Cache HIT] featuredPlaylists')
      return cached
    }

    console.log('[Cache MISS] featuredPlaylists')
    const data = await spotifyFetch(`/browse/featured-playlists?limit=${limit}`)
    const playlists = data.playlists?.items || []
    setCache(cacheKey, playlists, CACHE_DURATIONS.playlists)
    return playlists
  },

  // Get playlist tracks (cached)
  getPlaylistTracks: async (playlistId, limit = 50) => {
    const cacheKey = `playlist:${playlistId}:${limit}`
    const cached = getCached(cacheKey)
    if (cached) {
      console.log(`[Cache HIT] playlist: ${playlistId}`)
      return cached
    }

    console.log(`[Cache MISS] playlist: ${playlistId}`)
    const data = await spotifyFetch(`/playlists/${playlistId}/tracks?limit=${limit}`)
    const tracks = data.items || []
    setCache(cacheKey, tracks, CACHE_DURATIONS.playlists)
    return tracks
  },

  // Get artist (cached)
  getArtist: async (artistId) => {
    const cacheKey = `artist:${artistId}`
    const cached = getCached(cacheKey)
    if (cached) return cached

    const data = await spotifyFetch(`/artists/${artistId}`)
    setCache(cacheKey, data, CACHE_DURATIONS.artist)
    return data
  },

  // Get artist's albums (cached)
  getArtistAlbums: async (artistId, limit = 20) => {
    const cacheKey = `artistAlbums:${artistId}:${limit}`
    const cached = getCached(cacheKey)
    if (cached) return cached

    const data = await spotifyFetch(`/artists/${artistId}/albums?limit=${limit}&include_groups=album,single`)
    const albums = data.items || []
    setCache(cacheKey, albums, CACHE_DURATIONS.artist)
    return albums
  },

  // Get album tracks (cached)
  getAlbumTracks: async (albumId, limit = 50) => {
    const cacheKey = `albumTracks:${albumId}:${limit}`
    const cached = getCached(cacheKey)
    if (cached) {
      console.log(`[Cache HIT] albumTracks: ${albumId}`)
      return cached
    }

    console.log(`[Cache MISS] albumTracks: ${albumId}`)
    const data = await spotifyFetch(`/albums/${albumId}/tracks?limit=${limit}`)
    const tracks = data.items || []
    setCache(cacheKey, tracks, CACHE_DURATIONS.album)
    return tracks
  },

  // Get track details (cached) - useful for lyrics lookup
  getTrack: async (trackId) => {
    const cacheKey = `track:${trackId}`
    const cached = getCached(cacheKey)
    if (cached) return cached

    const data = await spotifyFetch(`/tracks/${trackId}`)
    setCache(cacheKey, data, CACHE_DURATIONS.album)
    return data
  },

  // ===================
  // CACHE UTILITIES
  // ===================
  clearCache: () => {
    cache.clear()
    console.log('[Cache] Cleared all cache')
  },

  getCacheStats: () => {
    let valid = 0, expired = 0
    const now = Date.now()
    for (const [, item] of cache.entries()) {
      if (now > item.expiry) expired++
      else valid++
    }
    return { total: cache.size, valid, expired }
  },

  // Prefetch common data (call on app load)
  prefetch: async () => {
    console.log('[Cache] Prefetching common data...')
    await Promise.all([
      spotifyService.getCategories(),
      spotifyService.getNewReleases(20),
    ])
    console.log('[Cache] Prefetch complete')
  }
}