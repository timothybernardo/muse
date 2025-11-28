import { useState } from 'react'
import { Link } from 'react-router-dom'
import { authService } from '../../services/supabase'
import logo from '../../assets/logo.png'
import './Auth.css'

function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [forgotMode, setForgotMode] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setMessage('')
    setLoading(true)

    try {
      await authService.signIn(email, password)
    } catch (err) {
      setError(err.message || 'Failed to sign in')
    } finally {
      setLoading(false)
    }
  }

  const handleForgotPassword = async (e) => {
    e.preventDefault()
    setError('')
    setMessage('')
    
    if (!email) {
      setError('Please enter your email address')
      return
    }

    setLoading(true)

    try {
      await authService.resetPassword(email)
      setMessage('Check your email for a password reset link!')
      setForgotMode(false)
    } catch (err) {
      setError(err.message || 'Failed to send reset email')
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
        {forgotMode ? (
          <form onSubmit={handleForgotPassword} style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <input
              type="email"
              placeholder="email"
              className="auth-input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            
            {error && <p className="auth-error">{error}</p>}
            {message && <p className="auth-message">{message}</p>}
            
            <button type="submit" className="auth-button" disabled={loading}>
              {loading ? 'sending...' : 'reset password'}
            </button>
            
            <span className="forgot-password" onClick={() => setForgotMode(false)}>
              back to login
            </span>
          </form>
        ) : (
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
              type="password"
              placeholder="password"
              className="auth-input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            
            <span className="forgot-password" onClick={() => setForgotMode(true)}>
              forgot password?
            </span>
            
            {error && <p className="auth-error">{error}</p>}
            {message && <p className="auth-message">{message}</p>}
            
            <button type="submit" className="auth-button" disabled={loading}>
              {loading ? 'logging in...' : 'login'}
            </button>
          </form>
        )}
        
        <p className="auth-switch">
          don't have an account?
          <Link to="/signup">sign up</Link>
        </p>
      </div>
    </div>
  )
}

export default Login