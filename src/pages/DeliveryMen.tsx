// This page is replaced by Agents.tsx in the new architecture.
// Kept as redirect for backwards compatibility.
import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

export default function DeliveryMen() {
  const navigate = useNavigate()
  useEffect(() => { navigate('/agents', { replace: true }) }, [navigate])
  return null
}
