/** @typedef {import('pear-interface')} */ 

/* global Pear */
import Hyperswarm from 'hyperswarm'
import crypto from 'hypercore-crypto'
import b4a from 'b4a'

const { teardown, updates } = Pear

class WalkieTalkieP2P {
    constructor() {
        this.rtcConfig = {
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:stun1.l.google.com:19302' }
            ]
        };
        
        this.swarm = null;
        this.peerConnections = new Map();
        this.localStream = null;
        this.isRecording = false;
        this.pendingCandidates = new Map(); // Para almacenar candidatos ICE pendientes
    }

    async initialize() {
        try {
            // Solicitar permisos de audio temprano
            this.localStream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true,
                    sampleRate: 48000
                },
                video: false
            });
            
            console.log('Audio inicializado correctamente');
            return true;
    } catch (error) {
            console.error('Error al inicializar audio:', error);
            updateStatus('Error al acceder al micrófono');
            return false;
        }
    }

    async createRoom() {
        try {
            updateStatus('Creando sala...');
            
            // Generar topic para Pear
            const topicBuffer = crypto.randomBytes(32);
            const topic = b4a.toString(topicBuffer, 'hex');
            
            // Inicializar Hyperswarm
            this.swarm = new Hyperswarm();
            this.swarm.join(topicBuffer);
            
            // Configurar eventos de conexión
            this.setupSwarmEvents();
            
            updateRoomId(topic);
            updateStatus('Sala creada. Esperando conexión...');
            
            return topic;
    } catch (error) {
            console.error('Error al crear sala:', error);
            updateStatus('Error al crear sala');
            return null;
        }
    }

    async joinRoom(topic) {
        try {
            if (!topic) {
                updateStatus('ID de sala inválido');
                return false;
            }

            updateStatus('Conectando a la sala...');
            
            // Convertir topic string a buffer
            const topicBuffer = b4a.from(topic, 'hex');
            
            // Inicializar Hyperswarm
            this.swarm = new Hyperswarm();
            this.swarm.join(topicBuffer);
            
            // Configurar eventos de conexión
            this.setupSwarmEvents();
            
            return true;
    } catch (error) {
            console.error('Error al unirse a la sala:', error);
            updateStatus('Error al unirse a la sala');
            return false;
        }
    }

    setupSwarmEvents() {
        if (!this.swarm) return;

        this.swarm.on('connection', async (peer) => {
            try {
                const peerId = b4a.toString(peer.remotePublicKey, 'hex');
                console.log('Nuevo peer conectado:', peerId);

                peer.on('data', async (data) => {
                    try {
                        const message = JSON.parse(data.toString());
                        await this.handleSignalingMessage(peerId, message, peer);
                    } catch (error) {
                        console.error('Error al procesar mensaje:', error);
                    }
                });

                // Iniciar proceso de conexión WebRTC
                const peerConnection = await this.createPeerConnection(peerId, peer);
                
                // Crear oferta si somos el peer con ID más alto
                if (peerId > b4a.toString(this.swarm.keyPair.publicKey, 'hex')) {
                    const offer = await peerConnection.createOffer();
                    const offerSdp = offer.sdp;
                    const offerMessage = {
                        type: 'offer',
                        sdp: offerSdp
                    };
                    await peerConnection.setLocalDescription(offer);
                    peer.write(JSON.stringify(offerMessage));
                }

                updateStatus(`Conectado a: ${peerId.substr(0, 6)}`);
                updateRecordButton(true);
    } catch (error) {
                console.error('Error en conexión de peer:', error);
            }
        });
    }

    async createPeerConnection(peerId, peerSignaling) {
        try {
            console.log('Creando nueva conexión WebRTC');
            
            const peerConnection = new RTCPeerConnection({
                iceServers: [
                    { urls: 'stun:stun.l.google.com:19302' },
                    { urls: 'stun:stun1.l.google.com:19302' }
                ],
                iceCandidatePoolSize: 10,
                bundlePolicy: 'max-bundle',
                rtcpMuxPolicy: 'require'
            });

            this.peerConnections.set(peerId, peerConnection);

            // Configurar eventos de conexión
            peerConnection.oniceconnectionstatechange = () => {
                console.log('Estado de conexión ICE:', peerConnection.iceConnectionState);
            };

            peerConnection.onconnectionstatechange = () => {
                console.log('Estado de conexión:', peerConnection.connectionState);
            };

            peerConnection.onsignalingstatechange = () => {
                console.log('Estado de señalización:', peerConnection.signalingState);
            };

            // Agregar tracks de audio
            if (this.localStream) {
                this.localStream.getTracks().forEach(track => {
                    console.log('Agregando track de audio');
                    peerConnection.addTrack(track, this.localStream);
                });
            }

            // Manejar ICE candidates
            peerConnection.onicecandidate = (event) => {
                if (event.candidate) {
                    try {
                        const candidateMessage = JSON.stringify({
                            type: 'candidate',
                            candidate: event.candidate
                        });
                        peerSignaling.write(candidateMessage);
                        console.log('ICE candidate enviado');
        } catch (error) {
                        console.error('Error al enviar ICE candidate:', error);
                    }
                }
            };

            // Manejar stream remoto
            peerConnection.ontrack = (event) => {
                console.log('Stream remoto recibido');
                const remoteAudio = new Audio();
                remoteAudio.srcObject = event.streams[0];
                remoteAudio.play().catch(console.error);
            };

            return peerConnection;
    } catch (error) {
            console.error('Error al crear conexión WebRTC:', error);
            throw error;
        }
    }

    async handleSignalingMessage(peerId, message, peerSignaling) {
        try {
            console.log('Mensaje de señalización recibido:', message.type);
            
            let peerConnection = this.peerConnections.get(peerId);
            
            // Crear conexión si no existe
            if (!peerConnection) {
                peerConnection = await this.createPeerConnection(peerId, peerSignaling);
            }

            switch (message.type) {
                case 'offer':
                    try {
                        console.log('Procesando oferta WebRTC:', message.sdp);
                        
                        // Asegurarse de que el mensaje tiene el formato correcto
                        const sessionDescription = {
                            type: 'offer',
                            sdp: message.sdp
                        };

                        // Limpiar cualquier descripción remota existente
                        if (peerConnection.remoteDescription) {
                            console.log('Limpiando descripción remota existente');
                            await peerConnection.setRemoteDescription({type: 'rollback'});
                        }

                        // Establecer la nueva descripción remota
                        await peerConnection.setRemoteDescription(sessionDescription);
                        console.log('Descripción remota establecida');

                        // Crear y enviar respuesta
                        const answer = await peerConnection.createAnswer();
                        await peerConnection.setLocalDescription(answer);
                        
                        const answerMessage = JSON.stringify({
                            type: 'answer',
                            sdp: answer.sdp
                        });
                        
                        console.log('Enviando respuesta');
                        peerSignaling.write(answerMessage);
        
    } catch (error) {
                        console.error('Error detallado al procesar oferta:', {
                            name: error.name,
                            message: error.message,
                            stack: error.stack
                        });
                    }
                    break;

                case 'answer':
                    try {
                        console.log('Procesando respuesta WebRTC');
                        const sessionDescription = {
                            type: 'answer',
                            sdp: message.sdp
                        };
                        await peerConnection.setRemoteDescription(sessionDescription);
                    } catch (error) {
                        console.error('Error al procesar respuesta:', error);
                    }
                    break;

                case 'candidate':
                    try {
                        if (!message.candidate) {
                            console.log('Candidato ICE vacío, ignorando');
                            return;
                        }

                        const candidate = new RTCIceCandidate({
                            candidate: message.candidate.candidate,
                            sdpMid: message.candidate.sdpMid,
                            sdpMLineIndex: message.candidate.sdpMLineIndex
                        });

                        if (peerConnection.remoteDescription && peerConnection.remoteDescription.type) {
                            await peerConnection.addIceCandidate(candidate);
                            console.log('ICE candidate agregado');
                        } else {
                            if (!this.pendingCandidates.has(peerId)) {
                                this.pendingCandidates.set(peerId, []);
                            }
                            this.pendingCandidates.get(peerId).push(candidate);
                            console.log('ICE candidate almacenado para proceso posterior');
                        }
                    } catch (error) {
                        console.error('Error al procesar ICE candidate:', error);
                    }
                    break;
                }
            } catch (error) {
            console.error('Error en handleSignalingMessage:', error);
        }
    }

    async restartConnection(peerId, peerSignaling) {
        try {
            const peerConnection = this.peerConnections.get(peerId);
            if (peerConnection) {
                // Crear nueva oferta con indicador de reinicio ICE
                const offer = await peerConnection.createOffer({ iceRestart: true });
                await peerConnection.setLocalDescription(offer);
                peerSignaling.write(JSON.stringify({
                    type: 'offer',
                    sdp: offer
                }));
                }
            } catch (error) {
            console.error('Error al reiniciar conexión:', error);
        }
    }

    startTransmitting() {
        if (this.localStream) {
            this.isRecording = true;
            this.localStream.getTracks().forEach(track => track.enabled = true);
            updateStatus('Transmitiendo...');
        }
    }

    stopTransmitting() {
        if (this.localStream) {
            this.isRecording = false;
            this.localStream.getTracks().forEach(track => track.enabled = false);
            updateStatus('Conectado');
        }
    }

    async cleanup() {
        // Detener todos los tracks
        if (this.localStream) {
            this.localStream.getTracks().forEach(track => track.stop());
        }

        // Cerrar todas las conexiones WebRTC
        for (const [peerId, connection] of this.peerConnections) {
            connection.close();
        }
        this.peerConnections.clear();

        // Cerrar conexión Pear
        if (this.swarm) {
            await this.swarm.destroy();
            this.swarm = null;
        }

        this.isRecording = false;
        updateStatus('Desconectado');
        updateRoomId('');
        updateRecordButton(false);
    }
}

// Instancia global
let p2pClient = new WalkieTalkieP2P();

// Funciones de utilidad UI (mantener las existentes)
function updateStatus(message) {
    const statusEl = document.getElementById('status');
    if (statusEl) {
        statusEl.textContent = message;
        console.log('Estado:', message);
    }
}

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

// Event Listeners
document.addEventListener('DOMContentLoaded', async () => {
    console.log('Inicializando aplicación...');
    
    // Inicializar audio
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

// Cleanup al cerrar
teardown(async () => {
    await p2pClient.cleanup();
});

// Habilitar recarga en desarrollo
updates(() => Pear.reload()); 
