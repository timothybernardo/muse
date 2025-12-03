import './Skeleton.css'

// Base skeleton element
export const Skeleton = ({ width, height, circle, className = '' }) => (
  <div 
    className={`skeleton ${circle ? 'skeleton-circle' : ''} ${className}`}
    style={{ width, height }}
  />
)

// Album card skeleton
export const AlbumCardSkeleton = () => (
  <div className="skeleton-album-card">
    <div className="skeleton skeleton-album-cover" />
    <div className="skeleton-album-info">
      <div className="skeleton skeleton-text" style={{ width: '80%' }} />
      <div className="skeleton skeleton-text-sm" style={{ width: '60%' }} />
    </div>
  </div>
)

// Albums grid skeleton
export const AlbumsGridSkeleton = ({ count = 8 }) => (
  <div className="skeleton-albums-grid">
    {[...Array(count)].map((_, i) => (
      <AlbumCardSkeleton key={i} />
    ))}
  </div>
)

// Review card skeleton
export const ReviewCardSkeleton = () => (
  <div className="skeleton-review-card">
    <div className="skeleton-review-header">
      <div className="skeleton-review-user">
        <div className="skeleton skeleton-avatar skeleton-circle" />
        <div className="skeleton skeleton-text" style={{ width: '100px' }} />
      </div>
      <div className="skeleton skeleton-stars" />
    </div>
    <div className="skeleton-review-text">
      <div className="skeleton skeleton-text" style={{ width: '100%' }} />
      <div className="skeleton skeleton-text" style={{ width: '90%' }} />
      <div className="skeleton skeleton-text" style={{ width: '75%' }} />
    </div>
  </div>
)

// Playlist card skeleton
export const PlaylistCardSkeleton = () => (
  <div className="skeleton-playlist-card">
    <div className="skeleton-playlist-header">
      <div className="skeleton skeleton-text-lg" style={{ width: '200px' }} />
    </div>
    <div className="skeleton-playlist-content">
      <div className="skeleton-playlist-albums">
        <div className="skeleton skeleton-playlist-cover" />
        <div className="skeleton skeleton-playlist-cover" />
        <div className="skeleton skeleton-playlist-cover" />
        <div className="skeleton skeleton-playlist-cover" />
      </div>
      <div className="skeleton-playlist-user">
        <div className="skeleton skeleton-circle" style={{ width: '50px', height: '50px' }} />
        <div className="skeleton skeleton-text-sm" style={{ width: '60px' }} />
      </div>
    </div>
  </div>
)

// Profile header skeleton
export const ProfileHeaderSkeleton = () => (
  <div className="skeleton-profile-header">
    <div className="skeleton skeleton-profile-avatar skeleton-circle" />
    <div className="skeleton-profile-info">
      <div className="skeleton skeleton-title" style={{ width: '150px' }} />
      <div className="skeleton skeleton-text" style={{ width: '120px' }} />
      <div className="skeleton skeleton-text" style={{ width: '200px', marginTop: '10px' }} />
    </div>
    <div className="skeleton-profile-stats">
      <div className="skeleton-stat">
        <div className="skeleton" style={{ width: '50px', height: '32px', marginBottom: '5px' }} />
        <div className="skeleton skeleton-text-sm" style={{ width: '80px' }} />
      </div>
      <div className="skeleton-stat">
        <div className="skeleton" style={{ width: '50px', height: '32px', marginBottom: '5px' }} />
        <div className="skeleton skeleton-text-sm" style={{ width: '80px' }} />
      </div>
      <div className="skeleton-stat">
        <div className="skeleton" style={{ width: '50px', height: '32px', marginBottom: '5px' }} />
        <div className="skeleton skeleton-text-sm" style={{ width: '80px' }} />
      </div>
    </div>
  </div>
)

// Profile page skeleton
export const ProfilePageSkeleton = () => (
  <div className="skeleton-profile-page">
    <ProfileHeaderSkeleton />
    <div className="skeleton-profile-actions">
      <div className="skeleton" style={{ width: '120px', height: '40px', borderRadius: '20px' }} />
      <div className="skeleton" style={{ width: '120px', height: '40px', borderRadius: '20px' }} />
      <div className="skeleton" style={{ width: '120px', height: '40px', borderRadius: '20px' }} />
    </div>
    <div className="skeleton-profile-section">
      <div className="skeleton skeleton-text" style={{ width: '150px', marginBottom: '10px' }} />
      <div className="skeleton" style={{ width: '100%', height: '1px', marginBottom: '25px' }} />
      <div className="skeleton-albums-row">
        <div className="skeleton" style={{ width: '150px', height: '150px', borderRadius: '8px' }} />
        <div className="skeleton" style={{ width: '150px', height: '150px', borderRadius: '8px' }} />
        <div className="skeleton" style={{ width: '150px', height: '150px', borderRadius: '8px' }} />
        <div className="skeleton" style={{ width: '150px', height: '150px', borderRadius: '8px' }} />
      </div>
    </div>
  </div>
)

// Profile review card skeleton
export const ProfileReviewSkeleton = () => (
  <div className="skeleton-profile-review">
    <div className="skeleton" style={{ width: '100px', height: '100px', borderRadius: '8px' }} />
    <div className="skeleton-profile-review-content">
      <div className="skeleton skeleton-text-lg" style={{ width: '180px' }} />
      <div className="skeleton skeleton-text-sm" style={{ width: '120px' }} />
      <div className="skeleton skeleton-text" style={{ width: '100%', marginTop: '10px' }} />
      <div className="skeleton skeleton-text" style={{ width: '80%' }} />
    </div>
    <div className="skeleton" style={{ width: '100px', height: '20px' }} />
  </div>
)

// Song item skeleton
export const SongItemSkeleton = () => (
  <div style={{ display: 'flex', alignItems: 'center', gap: '20px', padding: '15px 0', borderBottom: '1px solid #3a2a1a' }}>
    <div className="skeleton" style={{ width: '120px', height: '120px', borderRadius: '8px' }} />
    <div style={{ flex: 1 }}>
      <div className="skeleton skeleton-text-lg" style={{ width: '60%' }} />
      <div className="skeleton skeleton-text" style={{ width: '40%' }} />
    </div>
    <div className="skeleton" style={{ width: '40px', height: '40px' }} />
  </div>
)

// Album detail skeleton
export const AlbumDetailSkeleton = () => (
  <div className="fade-in" style={{ display: 'flex', gap: '50px' }}>
    <div>
      <div className="skeleton" style={{ width: '280px', height: '280px', borderRadius: '10px', marginBottom: '15px' }} />
      <div className="skeleton skeleton-title" style={{ width: '200px' }} />
      <div className="skeleton skeleton-text" style={{ width: '150px' }} />
    </div>
    <div style={{ flex: 1 }}>
      <div style={{ marginBottom: '25px' }}>
        <div className="skeleton skeleton-text" style={{ width: '200px', marginBottom: '8px' }} />
        <div className="skeleton skeleton-text" style={{ width: '150px', marginBottom: '8px' }} />
        <div className="skeleton skeleton-text" style={{ width: '180px', marginBottom: '8px' }} />
      </div>
      <div className="skeleton" style={{ width: '300px', height: '80px', borderRadius: '15px', marginBottom: '25px' }} />
      <div style={{ display: 'flex', gap: '40px' }}>
        <div className="skeleton" style={{ width: '100px', height: '60px' }} />
        <div className="skeleton" style={{ width: '100px', height: '60px' }} />
        <div className="skeleton" style={{ width: '100px', height: '60px' }} />
      </div>
    </div>
  </div>
)

export default Skeleton