import { useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase, authService } from '../../services/supabase'
import logo from '../../assets/logo.png'
import './Auth.css'

function SignUp() {
  const [email, setEmail] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setMessage('')

    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }

    if (!username.trim()) {
      setError('Please enter a username')
      return
    }

    setLoading(true)

    try {
      // Sign up the user
      const { data, error: signUpError } = await supabase.auth.signUp({ 
        email, 
        password,
        options: {
          data: {
            username: username
          }
        }
      })
      
      if (signUpError) throw signUpError

      // Create profile in profiles table
      if (data.user) {
        const { error: profileError } = await supabase
          .from('profiles')
          .insert({
            id: data.user.id,
            username: username,
            avatar_url: null
          })

        if (profileError && profileError.code !== '23505') {
          // 23505 is duplicate key error - profile might already exist
          console.error('Profile creation error:', profileError)
        }
      }

      setMessage('Account created! Check your email to confirm, or login if confirmation is disabled.')
    } catch (err) {
      setError(err.message || 'Failed to sign up')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-container">
      <Link to="/" className="auth-logo-link">
        <img src={logo} alt="Muse logo" className="auth-logo" />
      </Link>
      <Link to="/" className="auth-title-link">
        <h1 className="auth-title">muse</h1>
      </Link>
      <p className="auth-tagline">
        discover and review your<br />next favorite album.
      </p>

      <div className="auth-box">
        <form onSubmit={handleSubmit} style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <input
            type="email"
            placeholder="email"
            className="auth-input"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <input
            type="text"
            placeholder="username"
            className="auth-input"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
          />
          <input
            type="password"
            placeholder="password"
            className="auth-input"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <input
            type="password"
            placeholder="confirm password"
            className="auth-input"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
          />
          
          {error && <p className="auth-error">{error}</p>}
          {message && <p className="auth-message">{message}</p>}
          
          <button type="submit" className="auth-button" disabled={loading}>
            {loading ? 'signing up...' : 'sign up'}
          </button>
        </form>
        
        <p className="auth-switch">
          already have an account?
          <Link to="/login">login</Link>
        </p>
      </div>
    </div>
  )
}

export default SignUp