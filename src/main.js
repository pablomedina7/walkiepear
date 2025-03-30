/** @typedef {import('pear-interface')} */ 

/* global Pear */
import Hyperswarm from 'hyperswarm' // Librería para comunicación P2P
import crypto from 'hypercore-crypto' // Criptografía para IDs únicos
import b4a from 'b4a' // Utilidades para manejo de buffers

const { teardown, updates } = Pear

class WalkieTalkieP2P {
    constructor() {
        // Todas estas propiedades pertenecen a la instancia de la clase
        this.swarm = null;            // Para gestionar la red P2P
        this.peers = new Map();       // Para almacenar conexiones
        this.localStream = null;      // Para el stream de audio
        this.isTransmitting = false;  // Estado de transmisión
        this.audioContext = null;     // Contexto de Web Audio API
        this.audioWorklet = null;     // Procesador de audio
        this.debugInfo = {            // Información de depuración
            audioLevel: 0,
            peersConnected: 0,
            lastTransmission: null,
            lastReceived: null
        };
    }

    async initialize() {
        try {
            console.log('Iniciando sistema de audio...');
            
            // Configuración del micrófono con parámetros optimizados
            this.localStream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    sampleRate: 48000,
                    channelCount: 1,
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true
                },
                video: false
            });

            // Inicialización del contexto de audio con baja latencia
            this.audioContext = new AudioContext({
                sampleRate: 48000,
                latencyHint: 'interactive'
            });

            await this.audioContext.audioWorklet.addModule('src/audio-processor.js');
            
            const source = this.audioContext.createMediaStreamSource(this.localStream);
            this.audioWorklet = new AudioWorkletNode(this.audioContext, 'audio-processor');
            
            // Manejo de eventos de audio para transmisión
            this.audioWorklet.port.onmessage = (event) => {
                if (this.isTransmitting) {
                    this.broadcastAudio(event.data);
                }
            };
            
            source.connect(this.audioWorklet);
            this.audioWorklet.connect(this.audioContext.destination);
            
            console.log('Audio inicializado correctamente');
            return true;
        } catch (error) {
            console.error('Error al inicializar:', error);
            return false;
        }
    }

    async createRoom() {
        try {
            // Genera ID único para la sala
            const topicBuffer = crypto.randomBytes(32);
            const topic = b4a.toString(topicBuffer, 'hex');
            
            // Configura red P2P
            this.swarm = new Hyperswarm();
            await this.swarm.join(topicBuffer, {
                client: true,
                server: true
            });
            
            this.setupSwarmEvents();
            updateStatus('Sala creada. Esperando conexiones...');
            updateRoomId(topic);
            
            return topic;
        } catch (error) {
            console.error('Error al crear sala:', error);
            return null;
        }
    }

    setupSwarmEvents() {
        // Maneja eventos de conexión P2P
        this.swarm.on('connection', (peer) => {
            const peerId = b4a.toString(peer.remotePublicKey, 'hex');
            console.log('Nuevo peer conectado:', peerId);
            
            this.peers.set(peerId, peer);
            
            peer.on('data', (data) => {
                this.handleAudioData(data);
            });
            
            peer.on('close', () => {
                console.log('Peer desconectado:', peerId);
                this.peers.delete(peerId);
                if (this.peers.size === 0) {
                    updateStatus('Desconectado');
                }
            });

            updateStatus(`Conectado a: ${peerId.substr(0, 6)}`);
            updateRecordButton(true);
        });
    }

    async joinRoom(roomId) {
        try {
            if (!roomId) {
                updateStatus('ID de sala inválido');
                return false;
            }

            console.log('Intentando unirse a la sala:', roomId);
            
            // Prepara conexión a sala existente
            const topicBuffer = b4a.from(roomId, 'hex');
            
            this.swarm = new Hyperswarm();

            // Une al swarm como cliente
            await this.swarm.join(topicBuffer, {
                client: true,
                server: false  // Solo cliente cuando nos unimos
            });
            
            this.setupSwarmEvents();
            
            updateStatus('Conectando a la sala...');
            return true;
    } catch (error) {
            console.error('Error al unirse a la sala:', error);
            updateStatus('Error al unirse a la sala');
            return false;
        }
    }

    startTransmitting() {
        // Inicia transmisión de audio
        if (this.localStream && this.audioContext) {
            console.log('Iniciando transmisión...');//en el caso de que el audioContext esta disponible, se inicia la transmisión
            
            if (this.audioContext.state === 'suspended') {
                this.audioContext.resume();
            }
            
            this.isTransmitting = true;
            this.localStream.getTracks().forEach(track => {
                track.enabled = true;
            });
            
            updateStatus('Transmitiendo...');
        }
    }

    stopTransmitting() {
        // Detiene transmisión de audio
        if (this.localStream) {
            console.log('Deteniendo transmisión...');
            this.isTransmitting = false;
            this.localStream.getTracks().forEach(track => {
                track.enabled = false;
            });
            updateStatus('Conectado');
        }
    }

    async cleanup() {
        // Limpia recursos y conexiones
        if (this.localStream) {
            this.localStream.getTracks().forEach(track => track.stop());//detiene el stream de audio y libera los recursos
        }
        //cierra el contexto de audio
        if (this.audioContext) {
            await this.audioContext.close();
        }
        
        if (this.swarm) {
            await this.swarm.destroy();
        }
        //limpia la lista de peers y establece el estado de transmisión en apagado 
        this.peers.clear();
        this.isTransmitting = false;
        updateStatus('Desconectado');
        updateRoomId('');
        updateRecordButton(false);
    }

    startDebugMonitor() {
        // Monitoreo periódico del estado del sistema
        setInterval(() => {
            console.log('=== Estado del Sistema ===');
            console.log('Audio:', {
                contextState: this.audioContext?.state,
                transmitiendo: this.isTransmitting,
                streamActivo: this.localStream?.active
            });
            console.log('Conexión:', {
                swarmActivo: !!this.swarm,
                peersConectados: this.peers.size,
                peersIds: Array.from(this.peers.keys()).map(id => id.substr(0, 6))
            });
        }, 2000);
    }

    broadcastAudio(audioData) {
        // Transmite audio a todos los peers conectados
        if (!this.isTransmitting || this.peers.size === 0) return;

        try {
            const dataArray = audioData instanceof Float32Array ? audioData : new Float32Array(audioData);
            
            if (dataArray.length === 0) {
                console.log('No hay datos de audio para transmitir');
                return;
            }

            const audioDataArray = Array.from(dataArray);
            
            const message = {
                type: 'audio',
                data: audioDataArray,
                timestamp: Date.now()
            };

            for (const [peerId, peer] of this.peers) {
                if (peer.writable) {
                    peer.write(Buffer.from(JSON.stringify(message)));
                    this.debugInfo.lastTransmission = Date.now();
                    console.log(`Audio enviado a peer ${peerId.substr(0, 6)}, longitud: ${audioDataArray.length}`);
                }
            }
        } catch (error) {
            console.error('Error al transmitir audio:', error);
        }
    }

    handleAudioData(data) {
        // Procesa y reproduce audio recibido
        try {
            const message = JSON.parse(data.toString());
            
            if (message.type === 'audio' && message.data && message.data.length > 0) {
                const audioData = new Float32Array(Object.values(message.data));
                
                if (audioData.length === 0) {
                    console.log('Datos de audio recibidos vacíos');
                    return;
                }

                console.log('Longitud de datos de audio recibidos:', audioData.length);
                
                // Configura buffer de audio
                const audioBuffer = this.audioContext.createBuffer(
                    1, // mono
                    audioData.length,
                    48000 // sample rate
                );
                
                const channelData = audioBuffer.getChannelData(0);
                channelData.set(audioData);
                
                // Configura nodos de audio para reproducción
                const source = this.audioContext.createBufferSource();
                source.buffer = audioBuffer;
                
                const gainNode = this.audioContext.createGain();
                gainNode.gain.value = 2.0; // Amplifica volumen
                
                // Compresión para evitar distorsión
                const compressor = this.audioContext.createDynamicsCompressor();
                compressor.threshold.value = -24;
                compressor.knee.value = 30;
                compressor.ratio.value = 12;
                compressor.attack.value = 0.003;
                compressor.release.value = 0.25;
                
                // Conecta cadena de audio
                source.connect(gainNode);
                gainNode.connect(compressor);
                compressor.connect(this.audioContext.destination);
                
                source.start();
                
                console.log('Audio procesado y reproducido correctamente');
                this.debugInfo.lastReceived = Date.now();
            }
    } catch (error) {
            console.error('Error al procesar audio recibido:', error);
        }
    }
}

// Instancia global del cliente P2P
let p2pClient = new WalkieTalkieP2P();

// Funciones de actualización UI
function updateStatus(message) {
    const statusEl = document.getElementById('status');
    if (statusEl) {
        statusEl.textContent = message;
        console.log('Estado:', message);
    }
}
//actualiza el id de la sala
function updateRoomId(id) {
    const roomIdEl = document.getElementById('roomId');
    if (roomIdEl) {
        roomIdEl.textContent = id || '';
    }
}

function updateRecordButton(enabled) {
        const recordBtn = document.getElementById('recordBtn');
        if (recordBtn) {
        recordBtn.disabled = !enabled;
        recordBtn.style.opacity = enabled ? '1' : '0.7';
    }
}

// Inicialización y eventos de la aplicación
document.addEventListener('DOMContentLoaded', async () => {
    console.log('Inicializando aplicación...');
    
    await p2pClient.initialize();
    
    const createBtn = document.getElementById('createBtn');
    const connectBtn = document.getElementById('connectBtn');
    const recordBtn = document.getElementById('recordBtn');
    const peerIdInput = document.getElementById('peerIdInput');

    if (createBtn) {
        createBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            await p2pClient.createRoom();
        });
    }

    if (connectBtn && peerIdInput) {
        connectBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            const peerId = peerIdInput.value.trim();
            await p2pClient.joinRoom(peerId);
        });
    }

    if (recordBtn) {
        recordBtn.addEventListener('mousedown', () => p2pClient.startTransmitting());
        recordBtn.addEventListener('mouseup', () => p2pClient.stopTransmitting());
        recordBtn.addEventListener('mouseleave', () => p2pClient.stopTransmitting());
        recordBtn.addEventListener('touchstart', (e) => {
            e.preventDefault();
            p2pClient.startTransmitting();
        });
        recordBtn.addEventListener('touchend', (e) => {
            e.preventDefault();
            p2pClient.stopTransmitting();
        });
        recordBtn.disabled = true;
    }

    updateStatus('Desconectado');
    console.log('Aplicación inicializada');
});

// Limpieza al cerrar
teardown(async () => {
    await p2pClient.cleanup();
});

updates(() => Pear.reload()); 

// Funciones de debug
window.debugAudio = () => {
    const audioTrack = p2pClient.localStream?.getAudioTracks()[0];
    console.log('=== Debug de Audio ===');
    console.log('Estado del micrófono:', audioTrack?.enabled);
    console.log('Label del micrófono:', audioTrack?.label);
    console.log('Estado del AudioContext:', p2pClient.audioContext?.state);
    console.log('Peers conectados:', p2pClient.peers.size);
    console.log('Estado de transmisión:', p2pClient.isTransmitting);
    console.log('Último nivel de audio:', p2pClient.debugInfo.audioLevel);
};

setInterval(() => window.debugAudio(), 5000); 
