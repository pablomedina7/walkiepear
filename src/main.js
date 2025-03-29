/** @typedef {import('pear-interface')} */ 

/* global Pear */
import Hyperswarm from 'hyperswarm'
import crypto from 'hypercore-crypto'
import b4a from 'b4a'
import { Noise } from '@holepunch/noise'
import Corestore from 'corestore'
import Hypercore from 'hypercore'

const { teardown, updates } = Pear

class WalkieTalkieP2P {
    constructor() {
        this.swarm = null;
        this.peers = new Map();
        this.store = new Corestore('./storage'); // Almacenamiento persistente
        this.audioCore = null;
        this.localStream = null;
        this.isTransmitting = false;
        this.audioContext = null;
        this.audioWorklet = null;
        this.noise = new Noise(); // Para encriptación de datos
        this.debugInfo = {
            audioLevel: 0,
            peersConnected: 0,
            lastTransmission: null,
            lastReceived: null
        };
    }

    async initialize() {
        try {
            console.log('Iniciando sistema de audio...');
            
            // Inicializar el store
            await this.store.ready();
            
            // Crear un hypercore para los datos de audio
            this.audioCore = this.store.get({ name: 'audio' });
            await this.audioCore.ready();
            
            // Configuración de audio optimizada
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

            // Inicializar contexto de audio
            this.audioContext = new AudioContext({
                sampleRate: 48000,
                latencyHint: 'interactive'
            });

            await this.audioContext.audioWorklet.addModule('src/audio-processor.js');
            
            const source = this.audioContext.createMediaStreamSource(this.localStream);
            this.audioWorklet = new AudioWorkletNode(this.audioContext, 'audio-processor');
            
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
            const keyPair = crypto.keyPair();
            const topic = crypto.randomBytes(32);
            
            this.swarm = new Hyperswarm({
                keyPair,
                bootstrap: true
            });

            await this.swarm.join(topic, {
                client: true,
                server: true
            });
            
            this.setupSwarmEvents();
            
            const roomId = b4a.toString(topic, 'hex');
            updateStatus('Sala creada. Esperando conexiones...');
            updateRoomId(roomId);
            
            return roomId;
        } catch (error) {
            console.error('Error al crear sala:', error);
            return null;
        }
    }

    setupSwarmEvents() {
        this.swarm.on('connection', async (socket, info) => {
            try {
                // Establecer conexión segura
                const noiseSocket = this.noise.connect(socket, {
                    publicKey: info.publicKey,
                    autoStart: true
                });

                await noiseSocket.ready();
                
                const peerId = b4a.toString(info.publicKey, 'hex');
                console.log('Nuevo peer conectado:', peerId);
                
                this.peers.set(peerId, noiseSocket);
                
                // Replicar el hypercore con el peer
                const stream = this.audioCore.replicate(noiseSocket);
                
                noiseSocket.on('data', (data) => {
                    this.handleAudioData(data);
                });
                
                noiseSocket.on('close', () => {
                    console.log('Peer desconectado:', peerId);
                    this.peers.delete(peerId);
                    if (this.peers.size === 0) {
                        updateStatus('Desconectado');
                    }
                });

                updateStatus(`Conectado a: ${peerId.substr(0, 6)}`);
                updateRecordButton(true);
    } catch (error) {
                console.error('Error en la conexión:', error);
            }
        });
    }

    async joinRoom(roomId) {
        try {
            if (!roomId) {
                updateStatus('ID de sala inválido');
                return false;
            }

            console.log('Intentando unirse a la sala:', roomId);
            
            // Convertir el ID de la sala a buffer
            const topicBuffer = b4a.from(roomId, 'hex');
            
            // Crear nueva instancia de Hyperswarm
            this.swarm = new Hyperswarm();

        // Unirse al swarm con el topic
            await this.swarm.join(topicBuffer, {
                client: true,
                server: false  // Solo cliente cuando nos unimos
            });
            
            // Configurar eventos de conexión
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
        if (this.localStream && this.audioContext) {
            console.log('Iniciando transmisión...');
            
            // Asegurar que el contexto de audio está activo
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
        if (this.localStream) {
            this.localStream.getTracks().forEach(track => track.stop());
        }
        
        if (this.audioContext) {
            await this.audioContext.close();
        }
        
        if (this.swarm) {
            await this.swarm.destroy();
        }
        
        if (this.store) {
            await this.store.close();
        }
        
        this.peers.clear();
        this.isTransmitting = false;
        updateStatus('Desconectado');
        updateRoomId('');
        updateRecordButton(false);
    }

    startDebugMonitor() {
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

    async broadcastAudio(audioData) {
        if (!this.isTransmitting || this.peers.size === 0) return;

        try {
            const dataArray = audioData instanceof Float32Array ? audioData : new Float32Array(audioData);
            
            if (dataArray.length === 0) return;

            // Almacenar en el hypercore
            await this.audioCore.append(Buffer.from(dataArray.buffer));
            
            // Transmitir a los peers
            for (const [peerId, socket] of this.peers) {
                if (socket.writable) {
                    socket.write(Buffer.from(dataArray.buffer));
                    console.log(`Audio enviado a peer ${peerId.substr(0, 6)}`);
                }
            }
        } catch (error) {
            console.error('Error al transmitir audio:', error);
        }
    }

    handleAudioData(data) {
        try {
            const message = JSON.parse(data.toString());
            
            if (message.type === 'audio' && message.data && message.data.length > 0) {
                // Convertir los datos recibidos a Float32Array
                const audioData = new Float32Array(Object.values(message.data));
                
                if (audioData.length === 0) {
                    console.log('Datos de audio recibidos vacíos');
                    return;
                }

                console.log('Longitud de datos de audio recibidos:', audioData.length);
                
                // Crear buffer de audio con la longitud correcta
                const audioBuffer = this.audioContext.createBuffer(
                    1, // mono
                    audioData.length,
                    48000 // sample rate
                );
                
                // Copiar los datos al buffer
                const channelData = audioBuffer.getChannelData(0);
                channelData.set(audioData);
                
                // Crear y configurar source
                const source = this.audioContext.createBufferSource();
                source.buffer = audioBuffer;
                
                // Añadir ganancia para mejor control del volumen
                const gainNode = this.audioContext.createGain();
                gainNode.gain.value = 2.0; // Aumentar el volumen
                
                // Añadir un compresor para evitar distorsión
                const compressor = this.audioContext.createDynamicsCompressor();
                compressor.threshold.value = -24;
                compressor.knee.value = 30;
                compressor.ratio.value = 12;
                compressor.attack.value = 0.003;
                compressor.release.value = 0.25;
                
                // Conectar la cadena de audio
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

let p2pClient = new WalkieTalkieP2P();

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

teardown(async () => {
    await p2pClient.cleanup();
});

updates(() => Pear.reload()); 

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
