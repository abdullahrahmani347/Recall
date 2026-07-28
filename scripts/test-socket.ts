import { io } from 'socket.io-client'

async function main() {
  return new Promise<void>((resolve) => {
    const socket = io('http://localhost:3003/', {
      path: '/',
      transports: ['websocket'],
    })

    const timeout = setTimeout(() => {
      console.log('TIMEOUT')
      socket.disconnect()
      resolve()
    }, 5000)

    socket.on('connect', () => {
      console.log('Connected:', socket.id)
      socket.emit('join-note', {
        noteId: 'test-note-id',
        userId: 'test-user-1',
        name: 'Test User',
      })
    })

    socket.on('presence', (payload: { noteId: string; users: unknown[] }) => {
      console.log('Presence update:', JSON.stringify(payload))
      clearTimeout(timeout)
      socket.disconnect()
      resolve()
    })

    socket.on('connect_error', (err: Error) => {
      console.log('Connect error:', err.message)
      clearTimeout(timeout)
      resolve()
    })
  })
}

main().then(() => process.exit(0))
