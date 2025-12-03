import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../services/supabase'
import './FollowsModal.css'

function FollowsModal({ userId, initialTab, onClose }) {
  const navigate = useNavigate()
  const [tab, setTab] = useState(initialTab || 'followers')
  const [followers, setFollowers] = useState([])
  const [following, setFollowing] = useState([])
  const [currentUser, setCurrentUser] = useState(null)
  const [followingStatus, setFollowingStatus] = useState({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchData()
  }, [userId])

  const fetchData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      setCurrentUser(user)

      // Get followers
      const { data: followersData } = await supabase
        .from('follows')
        .select('follower_id')
        .eq('following_id', userId)

      if (followersData) {
        const followerProfiles = await Promise.all(
          followersData.map(async (f) => {
            const { data: profile } = await supabase
              .from('profiles')
              .select('id, username, avatar_url, bio')
              .eq('id', f.follower_id)
              .single()
            return profile
          })
        )
        setFollowers(followerProfiles.filter(p => p !== null))
      }

      // Get following
      const { data: followingData } = await supabase
        .from('follows')
        .select('following_id')
        .eq('follower_id', userId)

      if (followingData) {
        const followingProfiles = await Promise.all(
          followingData.map(async (f) => {
            const { data: profile } = await supabase
              .from('profiles')
              .select('id, username, avatar_url, bio')
              .eq('id', f.following_id)
              .single()
            return profile
          })
        )
        setFollowing(followingProfiles.filter(p => p !== null))
      }

      // Check which users current user is following
      if (user) {
        const { data: userFollowing } = await supabase
          .from('follows')
          .select('following_id')
          .eq('follower_id', user.id)

        if (userFollowing) {
          const status = {}
          userFollowing.forEach(f => {
            status[f.following_id] = true
          })
          setFollowingStatus(status)
        }
      }

    } catch (error) {
      console.error('Error fetching follows:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleFollowToggle = async (e, targetUserId) => {
    e.stopPropagation()
    if (!currentUser || currentUser.id === targetUserId) return

    if (followingStatus[targetUserId]) {
      // Unfollow
      const { error } = await supabase
        .from('follows')
        .delete()
        .eq('follower_id', currentUser.id)
        .eq('following_id', targetUserId)

      if (!error) {
        setFollowingStatus(prev => ({ ...prev, [targetUserId]: false }))
      }
    } else {
      // Follow
      const { error } = await supabase
        .from('follows')
        .insert({ follower_id: currentUser.id, following_id: targetUserId })

      if (!error) {
        setFollowingStatus(prev => ({ ...prev, [targetUserId]: true }))
      }
    }
  }

  const handleUserClick = (profileId) => {
    onClose()
    navigate(`/profile/${profileId}`)
  }

  const displayList = tab === 'followers' ? followers : following

  return (
    <div className="follows-modal-overlay" onClick={onClose}>
      <div className="follows-modal" onClick={e => e.stopPropagation()}>
        <div className="follows-modal-header">
          <h2 className="follows-modal-title">
            {tab === 'followers' ? 'Followers' : 'Following'}
          </h2>
          <button className="follows-modal-close" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="follows-tabs">
          <button 
            className={`follows-tab ${tab === 'followers' ? 'active' : ''}`}
            onClick={() => setTab('followers')}
          >
            Followers ({followers.length})
          </button>
          <button 
            className={`follows-tab ${tab === 'following' ? 'active' : ''}`}
            onClick={() => setTab('following')}
          >
            Following ({following.length})
          </button>
        </div>

        <div className="follows-list">
          {loading ? (
            <p className="follows-empty">Loading...</p>
          ) : displayList.length > 0 ? (
            displayList.map(user => (
              <div 
                key={user.id} 
                className="follows-user"
                onClick={() => handleUserClick(user.id)}
              >
                {user.avatar_url ? (
                  <img src={user.avatar_url} alt="" className="follows-avatar" />
                ) : (
                  <div className="follows-avatar" />
                )}
                <div className="follows-user-info">
                  <p className="follows-username">{user.username}</p>
                  {user.bio && <p className="follows-bio">{user.bio}</p>}
                </div>
                {currentUser && currentUser.id !== user.id && (
                  <button 
                    className={`follows-action-btn ${followingStatus[user.id] ? 'following' : 'follow'}`}
                    onClick={(e) => handleFollowToggle(e, user.id)}
                  >
                    {followingStatus[user.id] ? 'Following' : 'Follow'}
                  </button>
                )}
              </div>
            ))
          ) : (
            <p className="follows-empty">
              {tab === 'followers' ? 'No followers yet' : 'Not following anyone yet'}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

export default FollowsModal