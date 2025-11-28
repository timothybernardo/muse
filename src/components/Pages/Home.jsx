import { Link } from 'react-router-dom'
import './Home.css'
import logo from '../../assets/logo.png'

function Home() {
  // Placeholder album data - replace with real data later
  const spinningAlbums = [
    { id: 1, title: 'Thriller', artist: 'Michael Jackson', cover: 'https://upload.wikimedia.org/wikipedia/en/5/55/Michael_Jackson_-_Thriller.png', listens: '1k', reviews: 100, rating: 5 },
    { id: 2, title: 'Hurry Up Tomorrow', artist: 'The Weeknd', cover: 'https://upload.wikimedia.org/wikipedia/en/f/f0/The_Weeknd_-_Hurry_Up_Tomorrow.png', listens: '1k', reviews: 100, rating: 2 },
    { id: 3, title: 'Utopia', artist: 'Travis Scott', cover: 'https://i.scdn.co/image/ab67616d00001e0204481c826dd292e5e4983b3f', listens: '1k', reviews: 100, rating: 4 },
    { id: 4, title: 'Cry', artist: 'Cigarettes After Sex', cover: 'https://images.genius.com/7f53e3ec9752c0f901d9d1370b569507.1000x1000x1.jpg', listens: '1k', reviews: 100, rating: 3.5 },
     { id: 5, title: 'Cry', artist: 'Cigarettes After Sex', cover: 'https://images.genius.com/7f53e3ec9752c0f901d9d1370b569507.1000x1000x1.jpg', listens: '1k', reviews: 100, rating: 3.5 },
  ]

  const renderStars = (rating) => {
    const stars = []
    const fullStars = Math.floor(rating)
    const hasHalf = rating % 1 !== 0
    for (let i = 0; i < fullStars; i++) {
      stars.push(<span key={i} className="star filled">★</span>)
    }
    if (hasHalf) {
      stars.push(<span key="half" className="star half">★</span>)
    }
    const empty = 5 - Math.ceil(rating)
    for (let i = 0; i < empty; i++) {
      stars.push(<span key={`empty-${i}`} className="star empty">★</span>)
    }
    return stars
  }

  return (
    <div className="home-container">
      <nav className="home-nav">
        <Link to="/" className="logo">
        <img src={logo} alt="Muse logo" className="logo-icon" />
        <span className="logo-text">muse</span>
        </Link>
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
        <div className="hero-box">
          <h1>discover and review your<br />next favorite album.</h1>
        </div>
        <Link to="/signup" className="cta-button">sign up</Link>
      </div>

      <div className="features-section">
        <h2 className="section-title">our features</h2>
        <div className="section-line"></div>
        <div className="features-grid">
          <div className="feature-item">
            <div className="feature-card"></div>
            <h3>write and rate current listens</h3>
            <p>pick a star rating for an album and post. find other opinions on the album page.</p>
          </div>
          <div className="feature-item">
            <div className="feature-card"></div>
            <h3>encounter a new project</h3>
            <p>either search by genre or use our ai assistant to explore new artists.</p>
          </div>
          <div className="feature-item">
            <div className="feature-card"></div>
            <h3>make playlists</h3>
            <p>gather your favorite albums and singles with personalized comments.</p>
          </div>
        </div>
      </div>

      <div className="currently-spinning">
        <h3 className="section-title">users are now spinning:</h3>
        <div className="section-line"></div>
        <div className="albums-carousel">
          {spinningAlbums.map(album => (
            <div key={album.id} className="album-card">
              <img src={album.cover} alt={album.title} className="album-cover" />
              <div className="album-stats">
                <span className="stat"><span className="icon">🎧</span> {album.listens}</span>
                <span className="stat"><span className="icon">✎</span> {album.reviews}</span>
              </div>
              <div className="album-rating">
                {renderStars(album.rating)}
              </div>
            </div>
          ))}
          <button className="carousel-next">›</button>
        </div>
      </div>

      <footer>
        <p>created by timothy bernardo 2025</p>
      </footer>
    </div>
  )
}

export default Home