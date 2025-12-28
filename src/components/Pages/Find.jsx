import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../services/supabase'
import { spotifyService } from '../../services/spotify'
import './Find.css'

function Find() {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [userContext, setUserContext] = useState(null)
  const [chatHistory, setChatHistory] = useState([])

  useEffect(() => {
    fetchUserContext()
  }, [])

  const fetchUserContext = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data: reviews } = await supabase
          .from('reviews')
          .select('album_id, rating')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(10)

        if (reviews && reviews.length > 0) {
          const albumDetails = await Promise.all(
            reviews.map(async (r) => {
              try {
                const album = await spotifyService.getAlbum(r.album_id)
                return { name: album.name, artist: album.artists?.[0]?.name, rating: r.rating }
              } catch (e) {
                return null
              }
            })
          )
          setUserContext(albumDetails.filter(a => a !== null))
        }
      }
    } catch (error) {
      console.error('Error fetching user context:', error)
    }
  }

  const handleSubmit = async () => {
    if (!query.trim() || loading) return

    setLoading(true)
    const userMessage = query
    setQuery('')
    
    // Add user message to chat
    setChatHistory(prev => [...prev, { role: 'user', content: userMessage }])

    try {
      let contextPrompt = ''
      if (userContext && userContext.length > 0) {
        contextPrompt = `\n\nFor context, here are some albums this user has listened to and rated:\n${userContext.map(a => `- ${a.name} by ${a.artist} (rated ${a.rating}/5)`).join('\n')}`
      }

      const systemPrompt = `You are a music expert assistant for Muse, a music review app. Help users discover new albums based on their taste. 

When recommending albums, ALWAYS format each recommendation like this:
[ALBUM: Album Name | Artist Name]

For example:
[ALBUM: After Hours | The Weeknd]
[ALBUM: Blonde | Frank Ocean]

Keep responses conversational but include 3-5 album recommendations when appropriate. Be enthusiastic about music!${contextPrompt}`

      // Build messages for API (exclude albums from history)
      const apiMessages = chatHistory.map(m => ({ 
        role: m.role, 
        content: m.content 
      }))

      const messages = [
        { role: 'system', content: systemPrompt },
        ...apiMessages,
        { role: 'user', content: userMessage }
      ]

      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_GROQ_API_KEY}`
        },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          messages: messages,
          max_tokens: 1000
        })
      })

      const data = await response.json()
      const aiResponse = data.choices?.[0]?.message?.content || 'Sorry, I had trouble responding. Try again!'

      // Extract album recommendations from response
      const albumMatches = aiResponse.matchAll(/\[ALBUM:\s*([^|]+)\s*\|\s*([^\]]+)\]/g)
      const albumsToSearch = []
      
      for (const match of albumMatches) {
        albumsToSearch.push({ name: match[1].trim(), artist: match[2].trim() })
      }

      // Search Spotify for each recommended album
      let albums = []
      if (albumsToSearch.length > 0) {
        const foundAlbums = await Promise.all(
          albumsToSearch.map(async ({ name, artist }) => {
            try {
              const results = await spotifyService.searchAlbums(`${name} ${artist}`, 1)
              return results[0] || null
            } catch (e) {
              return null
            }
          })
        )
        albums = foundAlbums.filter(a => a !== null)
      }

      // Add AI response with its albums to chat history
      setChatHistory(prev => [...prev, { 
        role: 'assistant', 
        content: aiResponse,
        albums: albums
      }])

    } catch (error) {
      console.error('Error:', error)
      setChatHistory(prev => [...prev, { 
        role: 'assistant', 
        content: 'Sorry, I had trouble connecting. Please try again!',
        albums: []
      }])
    } finally {
      setLoading(false)
    }
  }

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  const suggestedPrompts = [
    "I'm feeling sad, what should I listen to?",
    "Recommend some albums like Frank Ocean",
    "What's a good album for a road trip?",
    "I want to discover some 90s hip-hop classics",
    "Suggest some underrated indie albums"
  ]

  return (
    <div className="find-page">
      <div className="find-content">
        <div className="find-header">
          <h1 className="find-title">discover your next favorite album</h1>
          <p className="find-subtitle">tell me what you're in the mood for</p>
        </div>

        <div className="chat-container">
          {chatHistory.length === 0 ? (
            <div className="suggestions">
              <p className="suggestions-label">try asking:</p>
              <div className="suggestion-chips">
                {suggestedPrompts.map((prompt, index) => (
                  <button
                    key={index}
                    className="suggestion-chip"
                    onClick={() => setQuery(prompt)}
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="chat-messages">
              {chatHistory.map((message, index) => (
                <div key={index} className={`chat-message ${message.role}`}>
                  <div className="message-content">
                    {message.role === 'assistant' 
                      ? message.content.replace(/\[ALBUM:[^\]]+\]/g, '').trim()
                      : message.content
                    }
                  </div>
                  
                  {/* Inline album recommendations for this message */}
                  {message.albums && message.albums.length > 0 && (
                    <div className="message-recommendations">
                      {message.albums.map(album => (
                        <div 
                          key={album.id} 
                          className="recommendation-card"
                          onClick={() => navigate(`/album/${album.id}`)}
                        >
                          <img 
                            src={album.images?.[0]?.url} 
                            alt={album.name} 
                            className="recommendation-cover"
                          />
                          <div className="recommendation-info">
                            <p className="recommendation-name">{album.name}</p>
                            <p className="recommendation-artist">
                              {album.artists?.map(a => a.name).join(', ')}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
              {loading && (
                <div className="chat-message assistant">
                  <div className="message-content loading-dots">
                    thinking<span>.</span><span>.</span><span>.</span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="find-input-container">
          <input
            type="text"
            placeholder="ask me anything about music..."
            className="find-input"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyPress={handleKeyPress}
            disabled={loading}
          />
          <button 
            className="find-submit" 
            onClick={handleSubmit}
            disabled={loading || !query.trim()}
          >
            {loading ? '...' : '→'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default Find