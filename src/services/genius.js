// Lyrics API Service
const GENIUS_TOKEN = import.meta.env.VITE_GENIUS_ACCESS_TOKEN
const CORS_PROXY = 'https://corsproxy.io/?'

export const geniusService = {
  // Search using Genius API
  searchSong: async (title, artist) => {
    try {
      const query = encodeURIComponent(`${title} ${artist}`)
      const response = await fetch(
        `${CORS_PROXY}${encodeURIComponent(`https://api.genius.com/search?q=${query}`)}`,
        {
          headers: {
            'Authorization': `Bearer ${GENIUS_TOKEN}`
          }
        }
      )
      
      const data = await response.json()
      
      if (data.response?.hits?.length > 0) {
        const artistLower = artist.toLowerCase()
        
        // Find best match by artist
        const match = data.response.hits.find(hit => {
          const resultArtist = hit.result.primary_artist?.name?.toLowerCase() || ''
          return resultArtist.includes(artistLower) || artistLower.includes(resultArtist)
        })
        
        return match?.result || data.response.hits[0].result
      }
      return null
    } catch (error) {
      console.error('Search error:', error)
      return null
    }
  },

  // Get lyrics using lyrics.ovh (free, no API key needed)
  getLyricsFromOvh: async (artist, title) => {
    try {
      const response = await fetch(
        `${CORS_PROXY}${encodeURIComponent(`https://api.lyrics.ovh/v1/${artist}/${title}`)}`
      )
      const data = await response.json()
      
      if (data.lyrics) {
        return data.lyrics.trim()
      }
      return null
    } catch (error) {
      console.error('Lyrics.ovh error:', error)
      return null
    }
  },

  // Fallback: scrape from Genius
  getLyricsFromGenius: async (geniusUrl) => {
    try {
      const response = await fetch(`${CORS_PROXY}${encodeURIComponent(geniusUrl)}`)
      const html = await response.text()
      
      const parser = new DOMParser()
      const doc = parser.parseFromString(html, 'text/html')
      
      const lyricsContainers = doc.querySelectorAll('[data-lyrics-container="true"]')
      
      if (lyricsContainers.length > 0) {
        let lyrics = ''
        lyricsContainers.forEach(container => {
          let text = container.innerHTML
          // Replace <br> with newlines
          text = text.replace(/<br\s*\/?>/gi, '\n')
          // Remove all HTML tags
          text = text.replace(/<[^>]*>/g, '')
          // Decode HTML entities
          const textarea = document.createElement('textarea')
          textarea.innerHTML = text
          text = textarea.value
          
          lyrics += text + '\n'
        })
        
        // Clean up
        return lyrics
          .split('\n')
          .map(line => line.trim())
          .filter(line => {
            // Filter out common non-lyric lines
            const lower = line.toLowerCase()
            if (lower.includes('contributor')) return false
            if (lower.includes('translation')) return false
            if (lower.includes('embed')) return false
            if (lower.match(/^\d+$/)) return false
            return true
          })
          .join('\n')
          .replace(/\n{3,}/g, '\n\n')
          .trim()
      }
      
      return null
    } catch (error) {
      console.error('Genius scrape error:', error)
      return null
    }
  },

  // Main function: try multiple sources
  findLyrics: async (trackName, artistName) => {
    try {
      console.log('Finding lyrics for:', trackName, 'by', artistName)
      
      // Try lyrics.ovh first (cleanest)
      let lyrics = await geniusService.getLyricsFromOvh(artistName, trackName)
      
      if (lyrics) {
        console.log('Found lyrics from lyrics.ovh')
        return { lyrics, source: 'lyrics.ovh' }
      }
      
      // Fallback to Genius scraping
      console.log('Trying Genius fallback...')
      const searchResult = await geniusService.searchSong(trackName, artistName)
      
      if (searchResult) {
        lyrics = await geniusService.getLyricsFromGenius(searchResult.url)
        if (lyrics) {
          console.log('Found lyrics from Genius')
          return { lyrics, source: 'genius' }
        }
      }
      
      return { error: 'Lyrics not found' }
    } catch (error) {
      console.error('Find lyrics error:', error)
      return { error: 'Failed to fetch lyrics' }
    }
  }
}