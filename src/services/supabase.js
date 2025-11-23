import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Auth functions
export const authService = {
  signUp: async (email, password, username) => {
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
    })
    
    if (authError) throw authError
    
    // Update profile with username
    if (authData.user) {
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ username })
        .eq('id', authData.user.id)
      
      if (profileError) throw profileError
    }
    
    return authData
  },
  
  signIn: async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })
    if (error) throw error
    return data
  },
  
  signOut: async () => {
    const { error } = await supabase.auth.signOut()
    if (error) throw error
  },
  
  getUser: async () => {
    const { data: { user } } = await supabase.auth.getUser()
    return user
  },
  
  getSession: async () => {
    const { data: { session } } = await supabase.auth.getSession()
    return session
  }
}

// Database functions
export const db = {
  // Albums
  getAlbums: async () => {
    const { data, error } = await supabase
      .from('albums')
      .select('*')
      .order('created_at', { ascending: false })
    
    if (error) throw error
    return data
  },
  
  getAlbum: async (id) => {
    const { data, error } = await supabase
      .from('albums')
      .select('*')
      .eq('id', id)
      .single()
    
    if (error) throw error
    return data
  },
  
  // Reviews
  getReviews: async (albumId) => {
    const { data, error } = await supabase
      .from('reviews')
      .select(`
        *,
        profiles (username, avatar_url)
      `)
      .eq('album_id', albumId)
      .order('created_at', { ascending: false })
    
    if (error) throw error
    return data
  },
  
  addReview: async (albumId, rating, reviewText) => {
    const user = await authService.getUser()
    
    const { data, error } = await supabase
      .from('reviews')
      .insert([
        { 
          user_id: user.id, 
          album_id: albumId, 
          rating, 
          review_text: reviewText 
        }
      ])
    
    if (error) throw error
    return data
  },
  
  // Listens
  addListen: async (albumId) => {
    const user = await authService.getUser()
    
    const { data, error } = await supabase
      .from('listens')
      .insert([
        { user_id: user.id, album_id: albumId }
      ])
    
    if (error) throw error
    return data
  },
  
  getListenCount: async (albumId) => {
    const { count, error } = await supabase
      .from('listens')
      .select('*', { count: 'exact', head: true })
      .eq('album_id', albumId)
    
    if (error) throw error
    return count
  },
  
  // User Profile
  getProfile: async (userId) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()
    
    if (error) throw error
    return data
  },
  
  updateProfile: async (userId, updates) => {
    const { data, error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', userId)
    
    if (error) throw error
    return data
  },
  
  // Favorites
  getFavorites: async (userId) => {
    const { data, error } = await supabase
      .from('user_favorites')
      .select(`
        *,
        albums (*)
      `)
      .eq('user_id', userId)
      .order('position')
    
    if (error) throw error
    return data
  },
  
  // Playlists
  getPlaylists: async () => {
    const { data, error } = await supabase
      .from('playlists')
      .select(`
        *,
        profiles (username, avatar_url)
      `)
      .order('created_at', { ascending: false })
    
    if (error) throw error
    return data
  },
  
  createPlaylist: async (title, description) => {
    const user = await authService.getUser()
    
    const { data, error } = await supabase
      .from('playlists')
      .insert([
        { user_id: user.id, title, description }
      ])
    
    if (error) throw error
    return data
  }
}