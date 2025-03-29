/** @typedef {import('pear-interface')} */ 

/* global Pear */
import Hyperswarm from 'hyperswarm'
import crypto from 'hypercore-crypto'
import b4a from 'b4a'

const { teardown, updates } = Pear

// Variables globales
let swarm = null
let audioStream = null
let isRecording = false
let audioContext = null
let currentTopic = null
let scriptNode = null

// Configuración del swarm
const SWARM_OPTIONS = {
    client: true,
    server: true,
    maxPeers: 5,
    queue: {
        multiplex: true,
        flush: true
    }
}

// Configuración de audio
const AUDIO_CONFIG = {
    sampleRate: 16000,    // Aumentado para mejor calidad de voz
    bufferSize: 2048,     // Aumentado para más estabilidad
    channels: 1
}

// Sonido de radio (precargado)
let radioSound = null
async function loadRadioSound() {
    try {
        const response = await fetch('./sounds/HDC1200.mp3')
        const arrayBuffer = await response.arrayBuffer()
        if (!audioContext) {
            audioContext = new (window.AudioContext || window.webkitAudioContext)({
                sampleRate: AUDIO_CONFIG.sampleRate
            })
        }
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer)
        radioSound = audioBuffer
    } catch (error) {
        console.error('Error al cargar el sonido de radio:', error)
    }
}

// Función para reproducir sonido de radio
async function playRadioSound() {
    try {
        if (!radioSound || !audioContext) return
        const source = audioContext.createBufferSource()
        source.buffer = radioSound
        source.connect(audioContext.destination)
        source.start(0)
    } catch (error) {
        console.error('Error al reproducir sonido de radio:', error)
    }
}

// Función para actualizar el estado en la UI
function updateStatus(message) {
    const statusEl = document.getElementById('status')
    if (statusEl) {
        statusEl.textContent = message
        console.log('Estado actualizado:', message)
    }
}

// Función para actualizar el ID de la sala en la UI
function updateRoomId(id) {
    const roomIdEl = document.getElementById('roomId')
    if (roomIdEl) {
        roomIdEl.textContent = id || ''
        if (id) {
            console.log('ID de sala generado:', id)
        }
    }
}

// Función para reproducir audio
async function playAudioChunk(data) {
    try {
        if (!audioContext) {
            audioContext = new (window.AudioContext || window.webkitAudioContext)({
                sampleRate: AUDIO_CONFIG.sampleRate,
                latencyHint: 'playback'
            })
        }

        const view = new Int16Array(data)
        const audioBuffer = audioContext.createBuffer(1, view.length, AUDIO_CONFIG.sampleRate)
        const channelData = audioBuffer.getChannelData(0)
        
        // Convertir y normalizar el audio
        for (let i = 0; i < view.length; i++) {
            channelData[i] = view[i] / 32768.0
        }

        const source = audioContext.createBufferSource()
        const gainNode = audioContext.createGain()
        gainNode.gain.value = 1.5  // Aumentar volumen

        source.buffer = audioBuffer
        source.connect(gainNode)
        gainNode.connect(audioContext.destination)
        source.start(0)
    } catch (error) {
        console.error('Error al reproducir audio:', error)
    }
}

// Función para habilitar/deshabilitar el botón de grabación
function updateRecordButton(enabled) {
    const recordBtn = document.getElementById('recordBtn')
    if (recordBtn) {
        recordBtn.disabled = !enabled
        recordBtn.style.opacity = enabled ? '1' : '0.7'
        recordBtn.style.cursor = enabled ? 'pointer' : 'not-allowed'
        console.log('Botón de grabación:', enabled ? 'habilitado' : 'deshabilitado')
    }
}

// Función para limpiar la conexión actual
async function cleanupCurrentConnection() {
    if (swarm) {
        try {
            console.log('Limpiando conexión anterior...')
            swarm.removeAllListeners()
            await swarm.destroy()
            swarm = null
            currentTopic = null
            updateRoomId('')
            updateRecordButton(false)
        } catch (error) {
            console.error('Error al limpiar conexión:', error)
        }
    }
}

// Función para crear una nueva sala
async function createRoom() {
    try {
        updateStatus('Creando sala...')
        console.log('Iniciando creación de sala...')

        await cleanupCurrentConnection()

        // Generar un nuevo topic aleatorio (32 bytes)
        const topicBuffer = crypto.randomBytes(32)
        currentTopic = b4a.toString(topicBuffer, 'hex')
        updateRoomId(currentTopic)
        
        // Inicializar el swarm con opciones optimizadas
        swarm = new Hyperswarm(SWARM_OPTIONS)
        
        // Unirse al swarm con el topic
        console.log('Uniéndose al swarm con topic:', currentTopic)
        swarm.join(topicBuffer, SWARM_OPTIONS)
        
        setupSwarmEvents()
        updateStatus('Sala creada. Esperando conexión...')
        
    } catch (error) {
        console.error('Error al crear sala:', error)
        updateStatus('Error al crear sala')
        await cleanupCurrentConnection()
    }
}

// Función para unirse a una sala existente
async function joinRoom(topicStr) {
    try {
        if (!topicStr) {
            updateStatus('Por favor ingresa un ID de sala válido')
            return
        }

        updateStatus('Conectando a la sala...')
        console.log('Intentando unirse a la sala:', topicStr)

        await cleanupCurrentConnection()

        // Convertir el topic de string a buffer
        const topicBuffer = b4a.from(topicStr, 'hex')
        currentTopic = topicStr
        
        // Inicializar el swarm con opciones optimizadas
        swarm = new Hyperswarm(SWARM_OPTIONS)

        // Unirse al swarm con el topic
        console.log('Uniéndose al swarm...')
        swarm.join(topicBuffer, SWARM_OPTIONS)
        
        setupSwarmEvents()
        
    } catch (error) {
        console.error('Error al unirse a la sala:', error)
        updateStatus('Error al unirse a la sala. Verifica el ID.')
        await cleanupCurrentConnection()
    }
}

// Función para configurar los eventos del swarm
function setupSwarmEvents() {
    if (!swarm) return

    swarm.on('connection', (peer) => {
        const name = b4a.toString(peer.remotePublicKey, 'hex').substr(0, 6)
        console.log(`Nuevo peer conectado: ${name}`)
        
        // Configurar el peer para mejor rendimiento
        peer.setKeepAlive(1000)
        
        peer.on('data', async (data) => {
            try {
                console.log('Datos de audio recibidos, tamaño:', data.length)
                if (data.length > 0) {
                    await playAudioChunk(data)
                }
            } catch (error) {
                console.error('Error al procesar audio recibido:', error)
            }
        })
        
        peer.on('error', (err) => {
            console.error(`Error en la conexión con ${name}:`, err)
        })

        peer.on('close', () => {
            console.log(`Peer ${name} desconectado`)
            updateStatus('Desconectado')
            updateRecordButton(false)
        })
        
        updateStatus(`Conectado a: ${name}`)
        updateRecordButton(true)
    })
    
    swarm.on('disconnection', (peer) => {
        const name = b4a.toString(peer.remotePublicKey, 'hex').substr(0, 6)
        console.log(`Peer desconectado: ${name}`)
        updateStatus('Desconectado')
        updateRecordButton(false)
    })
}

// Función para iniciar la grabación
async function startRecording() {
    try {
        if (isRecording || !swarm) return
        
        console.log('Iniciando grabación...')
        await playRadioSound()
        
        if (!audioContext) {
            audioContext = new (window.AudioContext || window.webkitAudioContext)({
                sampleRate: AUDIO_CONFIG.sampleRate,
                latencyHint: 'interactive'
            })
        }

        audioStream = await navigator.mediaDevices.getUserMedia({ 
            audio: {
                echoCancellation: true,      // Activado para mejor calidad
                noiseSuppression: true,      // Activado para mejor calidad
                autoGainControl: true,       // Activado para mejor calidad
                channelCount: 1,
                sampleRate: AUDIO_CONFIG.sampleRate
            }
        })

        const source = audioContext.createMediaStreamSource(audioStream)
        scriptNode = audioContext.createScriptProcessor(AUDIO_CONFIG.bufferSize, 1, 1)
        
        let lastSendTime = 0
        const SEND_INTERVAL = 50  // 50ms entre envíos

        scriptNode.onaudioprocess = (e) => {
            if (!isRecording || !swarm || swarm.connections.size === 0) return
            
            const now = Date.now()
            if (now - lastSendTime < SEND_INTERVAL) return
            lastSendTime = now

            const inputData = e.inputBuffer.getChannelData(0)
            const outputData = new Int16Array(AUDIO_CONFIG.bufferSize)
            
            // Procesar y comprimir el audio
            for (let i = 0; i < inputData.length; i++) {
                // Normalización y compresión suave
                const sample = Math.max(-0.9, Math.min(0.9, inputData[i])) * 1.1
                outputData[i] = Math.floor(sample * 32767)
            }
            
            // Enviar el audio a todos los peers
            const buffer = Buffer.from(outputData.buffer)
            for (const peer of swarm.connections) {
                try {
                    peer.write(buffer)
                } catch (error) {
                    console.error('Error al enviar audio a peer:', error)
                }
            }
        }

        source.connect(scriptNode)
        scriptNode.connect(audioContext.destination)
        
        isRecording = true
        updateStatus('Grabando...')
        const recordBtn = document.getElementById('recordBtn')
        if (recordBtn) {
            recordBtn.classList.add('recording')
        }
        
    } catch (error) {
        console.error('Error al iniciar la grabación:', error)
        updateStatus('Error al acceder al micrófono')
        isRecording = false
        updateRecordButton(true)
    }
}

// Función para detener la grabación
async function stopRecording() {
    if (!isRecording) return
    
    try {
        console.log('Deteniendo grabación...')
        await playRadioSound()
        
        if (audioStream) {
            audioStream.getTracks().forEach(track => track.stop())
            audioStream = null
        }

        if (scriptNode) {
            scriptNode.disconnect()
            scriptNode = null
        }
        
        isRecording = false
        updateStatus('Conectado')
        const recordBtn = document.getElementById('recordBtn')
        if (recordBtn) {
            recordBtn.classList.remove('recording')
        }
    } catch (error) {
        console.error('Error al detener la grabación:', error)
    }
}

// Limpiar recursos al cerrar
teardown(async () => {
    await cleanupCurrentConnection()
    if (audioStream) audioStream.getTracks().forEach(track => track.stop())
    if (audioContext) audioContext.close()
})

// Habilitar recarga automática durante el desarrollo
updates(() => Pear.reload())

// Event Listeners
document.addEventListener('DOMContentLoaded', async () => {
    console.log('Inicializando aplicación...')
    
    // Cargar el sonido de radio al inicio
    await loadRadioSound()
    
    const createBtn = document.getElementById('createBtn')
    const connectBtn = document.getElementById('connectBtn')
    const recordBtn = document.getElementById('recordBtn')
    const peerIdInput = document.getElementById('peerIdInput')

    if (createBtn) {
        createBtn.addEventListener('click', (e) => {
            e.preventDefault()
            console.log('Botón crear sala clickeado')
            createRoom()
        })
    }

    if (connectBtn && peerIdInput) {
        connectBtn.addEventListener('click', (e) => {
            e.preventDefault()
            const peerId = peerIdInput.value.trim()
            if (peerId) {
                console.log('Intentando conectar con ID:', peerId)
                joinRoom(peerId)
            }
        })
    }

    if (recordBtn) {
        recordBtn.addEventListener('mousedown', startRecording)
        recordBtn.addEventListener('mouseup', stopRecording)
        recordBtn.addEventListener('mouseleave', stopRecording)
        recordBtn.addEventListener('touchstart', startRecording)
        recordBtn.addEventListener('touchend', stopRecording)
        recordBtn.disabled = true
    }

    updateStatus('Desconectado')
    updateRoomId('')
    console.log('Aplicación inicializada')
}) 
