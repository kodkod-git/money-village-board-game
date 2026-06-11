import { useEffect, useRef, useState } from 'react'
import { io } from 'socket.io-client'

let sharedSocket = null

export default function useSocket() {
  const [isConnected, setIsConnected] = useState(false)
  const socketRef = useRef(null)

  useEffect(() => {
    if (!sharedSocket) {
      sharedSocket = io({ transports: ['websocket'] })
    }
    socketRef.current = sharedSocket

    const onConnect = () => setIsConnected(true)
    const onDisconnect = () => setIsConnected(false)

    socketRef.current.on('connect', onConnect)
    socketRef.current.on('disconnect', onDisconnect)
    if (socketRef.current.connected) setIsConnected(true)

    return () => {
      socketRef.current.off('connect', onConnect)
      socketRef.current.off('disconnect', onDisconnect)
    }
  }, [])

  return { socket: socketRef.current, isConnected }
}
