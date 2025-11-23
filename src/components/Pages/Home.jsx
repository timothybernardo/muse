import { Link } from 'react-router-dom'
import './Home.css'

function Home() {
  return (
    <div className="home-container">
      <nav className="home-nav">
        <div className="logo">
          <span className="logo-icon">🎵</span>
          <span className="logo-text">muse</span>
        </div>
        <div className="nav-links">
          <a href="#features">albums</a>
          <a href="#features">find</a>
          <a href="#features">playlists</a>
          <a href="#features">profile</a>
          <a href="#features">search</a>
          <Link to="/login" className="sign-in-btn">sign in</Link>
        </div>
      </nav>

      <div className="hero-section">
        <h1>discover and review your<br />next favorite album.</h1>
        <Link to="/signup" className="cta-button">sign up</Link>
      </div>

      <div className="features-section">
        <h2>our features</h2>
        <div className="features-grid">
          <div className="feature-card">
            <h3>write and rate current listens</h3>
            <p>pick a star rating for an album and post. find other opinions on the album page.</p>
          </div>
          <div className="feature-card">
            <h3>encounter a new project</h3>
            <p>either search by genre or use our ai assistant to explore new artists.</p>
          </div>
          <div className="feature-card">
            <h3>make playlists</h3>
            <p>gather your favorite albums and singles with personalized comments.</p>
          </div>
        </div>
      </div>

      <div className="currently-spinning">
        <h3>users are now spinning:</h3>
        {/* We'll add album cards here later */}
      </div>

      <footer>
        <p>created by timothy bernardo 2025</p>
      </footer>
    </div>
  )
}

export default Home