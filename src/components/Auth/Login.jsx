import { useState } from 'react'
import { Link } from 'react-router-dom'

function Login() {
  return (
    <div style={{ 
      backgroundColor: '#2b1a00',
      minHeight: '100vh',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      color: 'white'
    }}>
      <div style={{
        backgroundColor: '#7b4739',
        padding: '40px',
        borderRadius: '20px',
        textAlign: 'center'
      }}>
        <h1 style={{ fontWeight: 'normal' }}>muse</h1>
        <p style={{ fontStyle: 'italic', fontWeight: 'normal' }}>
          discover and review your<br />next favorite album.
        </p>
        <form style={{ marginTop: '20px' }}>
          <input 
            type="email" 
            placeholder="email"
            style={{
              width: '100%',
              padding: '10px',
              marginBottom: '10px',
              borderRadius: '20px',
              border: 'none',
              backgroundColor: '#4a3a2a',
              color: 'white'
            }}
          />
          <input 
            type="password" 
            placeholder="password"
            style={{
              width: '100%',
              padding: '10px',
              marginBottom: '20px',
              borderRadius: '20px',
              border: 'none',
              backgroundColor: '#4a3a2a',
              color: 'white'
            }}
          />
          <button style={{
            padding: '10px 40px',
            borderRadius: '20px',
            border: 'none',
            backgroundColor: '#af9d82',
            color: '#2b1a00',
            cursor: 'pointer',
            fontFamily: 'inherit'
          }}>
            login
          </button>
        </form>
        <p style={{ marginTop: '20px' }}>
          don't have an account? <Link to="/signup" style={{ color: '#af9d82' }}>sign up</Link>
        </p>
      </div>
    </div>
  )
}

export default Login