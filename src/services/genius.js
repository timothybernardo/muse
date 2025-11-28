// Lyrics Service using lrclib.net (free, no API key needed)

export const geniusService = {
  findLyrics: async (trackName, artistName) => {
    try {
      // Clean up track name
      const cleanTrackName = trackName
        .replace(/\(feat\..*?\)/gi, '')
        .replace(/\(ft\..*?\)/gi, '')
        .replace(/\[feat\..*?\]/gi, '')
        .replace(/\[ft\..*?\]/gi, '')
        .replace(/\(.*?remix.*?\)/gi, '')
        .replace(/\(.*?version.*?\)/gi, '')
        .replace(/\(.*?remaster.*?\)/gi, '')
        .trim()
      
      console.log('Finding lyrics for:', cleanTrackName, 'by', artistName)
      
      // Try lrclib.net
      const url = `https://lrclib.net/api/search?track_name=${encodeURIComponent(cleanTrackName)}&artist_name=${encodeURIComponent(artistName)}`
      
      const response = await fetch(url)
      
      if (!response.ok) {
        console.error('API response error:', response.status)
        return { error: 'Failed to fetch lyrics' }
      }
      
      const data = await response.json()
      console.log('Lyrics response:', data)
      
      if (data && data.length > 0) {
        // Get the first result that has plain lyrics
        const result = data.find(item => item.plainLyrics) || data[0]
        
        if (result.plainLyrics) {
          return { 
            lyrics: result.plainLyrics,
            title: result.trackName,
            artist: result.artistName
          }
        }
        
        // If only synced lyrics available, strip timestamps
        if (result.syncedLyrics) {
          const plainLyrics = result.syncedLyrics
            .split('\n')
            .map(line => line.replace(/\[\d{2}:\d{2}\.\d{2,3}\]/g, '').trim())
            .filter(line => line)
            .join('\n')
          
          return {
            lyrics: plainLyrics,
            title: result.trackName,
            artist: result.artistName
          }
        }
      }
      
      return { error: 'Lyrics not found for this track' }
    } catch (error) {
      console.error('Lyrics error:', error)
      return { error: 'Failed to fetch lyrics' }
    }
  }
}