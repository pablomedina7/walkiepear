import Peer from 'peerjs'

// Esperar a que el DOM esté completamente cargado
document.addEventListener('DOMContentLoaded', () => {
    // Elementos del DOM
    const connectBtn = document.getElementById('connectBtn')
    const recordBtn = document.getElementById('recordBtn')
    const stopBtn = document.getElementById('stopBtn')
    const statusDiv = document.getElementById('status')
    const messagesDiv = document.getElementById('messages')
    const peerIdInput = document.getElementById('peerId')

    // Variables globales
    let peer = null
    let mediaRecorder = null
    let audioStream = null
    let isRecording = false
    let currentConnection = null
    let audioContext = null

    // Función para actualizar el estado en la UI
    function updateStatus(message) {
        statusDiv.textContent = `Estado: ${message}`
    }

    // Función para reproducir audio
    async function playAudioChunk(arrayBuffer) {
        try {
            if (!audioContext) {
                audioContext = new (window.AudioContext || window.webkitAudioContext)()
            }
            const audioBuffer = await audioContext.decodeAudioData(arrayBuffer)
            const source = audioContext.createBufferSource()
            source.buffer = audioBuffer
            source.connect(audioContext.destination)
            source.start(0)
        } catch (error) {
            console.error('Error reproduciendo audio:', error)
        }
    }

    // Función para habilitar/deshabilitar el botón de grabación
    function updateRecordButton(enabled) {
        recordBtn.disabled = !enabled
        if (enabled) {
            recordBtn.classList.remove('recording')
        }
    }

    // Función para agregar mensajes al chat
    function addMessage(message, isSent = false) {
        console.log('Mensaje agregado:', message)
        const messageDiv = document.createElement('div')
        messageDiv.className = `message ${isSent ? 'sent' : 'received'}`
        messageDiv.textContent = message
        messagesDiv.appendChild(messageDiv)
        messagesDiv.scrollTop = messagesDiv.scrollHeight
    }

    // Función para manejar la conexión con otro peer
    function connectToPeer(targetPeerId) {
        if (!peer) return;
        
        updateStatus('Conectando...')
        const conn = peer.connect(targetPeerId, {
            reliable: true
        })
        
        conn.on('open', () => {
            currentConnection = conn
            updateStatus(`Conectado a: ${targetPeerId}`)
            updateRecordButton(true)
        })

        conn.on('data', async (data) => {
            await playAudioChunk(data)
        })

        conn.on('close', () => {
            currentConnection = null
            updateStatus('Desconectado')
            updateRecordButton(false)
        })

        conn.on('error', (err) => {
            console.error('Error en la conexión:', err)
            currentConnection = null
            updateStatus('Error en la conexión')
            updateRecordButton(false)
        })
    }

    // Función para inicializar PeerJS
    async function initializePeer() {
        try {
            const peerId = Math.random().toString(36).substr(2, 9)
            
            peer = new Peer(peerId, {
                config: {
                    iceServers: [
                        { urls: 'stun:stun.l.google.com:19302' },
                        { urls: 'stun:global.stun.twilio.com:3478' }
                    ]
                }
            })

            peer.on('open', (id) => {
                updateStatus(`Tu ID: ${id}`)
                connectBtn.disabled = true

                const targetPeerId = peerIdInput.value.trim()
                if (targetPeerId) {
                    connectToPeer(targetPeerId)
                }
            })

            peer.on('connection', (conn) => {
                currentConnection = conn
                updateStatus('Conexión establecida')
                updateRecordButton(true)
                
                conn.on('data', async (data) => {
                    await playAudioChunk(data)
                })

                conn.on('close', () => {
                    currentConnection = null
                    updateStatus('Desconectado')
                    updateRecordButton(false)
                })
            })

            peer.on('error', (err) => {
                console.error('Error en PeerJS:', err)
                updateStatus('Error en la conexión')
                updateRecordButton(false)
            })

        } catch (error) {
            console.error('Error al inicializar PeerJS:', error)
            updateStatus('Error de conexión')
            updateRecordButton(false)
        }
    }

    // Función para iniciar la grabación
    async function startRecording() {
        try {
            if (isRecording || !currentConnection) return;
            
            audioStream = await navigator.mediaDevices.getUserMedia({ 
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true,
                    channelCount: 1,
                    sampleRate: 44100
                }
            })

            mediaRecorder = new MediaRecorder(audioStream, {
                mimeType: 'audio/webm;codecs=opus',
                audioBitsPerSecond: 64000
            })

            let audioChunks = []
            
            mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    audioChunks.push(event.data)
                }
            }

            mediaRecorder.onstop = async () => {
                if (audioChunks.length > 0) {
                    const blob = new Blob(audioChunks, { type: 'audio/webm;codecs=opus' })
                    const arrayBuffer = await blob.arrayBuffer()
                    if (currentConnection && currentConnection.open) {
                        currentConnection.send(arrayBuffer)
                    }
                    audioChunks = []
                }
            }

            mediaRecorder.start(50)
            isRecording = true
            updateStatus('Grabando...')
            recordBtn.classList.add('recording')
            
            const intervalId = setInterval(() => {
                if (isRecording) {
                    mediaRecorder.stop()
                    mediaRecorder.start(50)
                } else {
                    clearInterval(intervalId)
                }
            }, 200)

        } catch (error) {
            console.error('Error al iniciar la grabación:', error)
            updateStatus('Error al acceder al micrófono')
            isRecording = false
            updateRecordButton(true)
        }
    }

    // Función para detener la grabación
    function stopRecording() {
        if (!isRecording) return;
        
        try {
            mediaRecorder.stop()
            audioStream.getTracks().forEach(track => track.stop())
            audioStream = null
            mediaRecorder = null
            isRecording = false
            updateStatus('Conectado')
            recordBtn.classList.remove('recording')
        } catch (error) {
            console.error('Error al detener la grabación:', error)
        }
    }

    // Event Listeners
    connectBtn.addEventListener('click', initializePeer)

    // Eventos de pulsar y soltar para el botón de grabación
    recordBtn.addEventListener('mousedown', startRecording)
    recordBtn.addEventListener('mouseup', stopRecording)
    recordBtn.addEventListener('mouseleave', stopRecording)

    // Para dispositivos táctiles
    recordBtn.addEventListener('touchstart', (e) => {
        e.preventDefault()
        startRecording()
    })
    recordBtn.addEventListener('touchend', (e) => {
        e.preventDefault()
        stopRecording()
    })

    // Manejar la conexión cuando se ingresa un ID
    peerIdInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            const targetPeerId = peerIdInput.value.trim()
            if (targetPeerId && peer) {
                connectToPeer(targetPeerId)
            }
        }
    })

    // Inicialización
    updateStatus('Desconectado')
    updateRecordButton(false)
    stopBtn.style.display = 'none'
}) 
