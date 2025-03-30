/** @typedef {import('pear-interface')} */ 

/* global Pear */
import Hyperswarm from 'hyperswarm'
import crypto from 'hypercore-crypto'
import b4a from 'b4a'

const { teardown, updates } = Pear

class WalkieTalkieP2P {
    constructor() {
        this.swarm = null;
        this.peers = new Map();
        this.localStream = null;
        this.isTransmitting = false;
        this.audioContext = null;
        this.audioWorklet = null;
        this.debugInfo = {
            audioLevel: 0,
            peersConnected: 0,
            lastTransmission: null,
            lastReceived: null
        };
        
        // Generar un nombre de usuario predeterminado y cargarlo del almacenamiento local
        const randomNum = Math.floor(Math.random() * 1000);
        this.username = localStorage.getItem('walkie-pear-username') || `Usuario_${randomNum}`;
        
        // Guardar el nombre de usuario si es la primera vez
        if (!localStorage.getItem('walkie-pear-username')) {
            localStorage.setItem('walkie-pear-username', this.username);
        }
        
        // Mapa para almacenar los usuarios conectados: ID del peer -> {username, active}
        this.connectedUsers = new Map();
        
        // ID del usuario que está hablando actualmente (o null si nadie está hablando)
        this.currentSpeaker = null;
        
        // Timeout para restablecer el indicador de hablante después de un periodo sin audio
        this.speakerTimeout = null;
    }

    async initialize() {
        try {
            console.log('Iniciando sistema de audio...');
            
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
            
            // Configurar el procesamiento de audio
            this.audioWorklet.port.onmessage = (event) => {
                if (this.isTransmitting) {
                    this.broadcastAudio(event.data);
                }
            };
            
            source.connect(this.audioWorklet);
            this.audioWorklet.connect(this.audioContext.destination);
            
            console.log('Audio inicializado correctamente');
            
            // Restaurar nombre de usuario del localStorage
            const savedUsername = localStorage.getItem('walkie-pear-username');
            if (savedUsername) {
                this.username = savedUsername;
                this.updateUsernameDisplay();
            }
            
            return true;
        } catch (error) {
            console.error('Error al inicializar:', error);
            return false;
        }
    }

    // Método para actualizar el nombre de usuario
    setUsername(username) {
        if (!username || username.trim() === '') return false;
        
        const newUsername = username.trim().substring(0, 20);
        this.username = newUsername;
        
        // Guardar en localStorage
        localStorage.setItem('walkie-pear-username', newUsername);
        
        // Actualizar la interfaz y ocultar el panel
        this.updateUsernameDisplay();
        
        // Ocultar el panel de entrada
        const userInfoPanel = document.getElementById('user-info-panel');
        if (userInfoPanel) {
            userInfoPanel.classList.add('hidden');
        }
        
        // Si ya estamos conectados a algún peer, notificamos el cambio de nombre
        if (this.peers.size > 0) {
            this.broadcastUserInfo();
        }
        
        console.log('Nombre de usuario actualizado:', newUsername);
        return true;
    }

    updateUsernameDisplay() {
        const usernameDisplay = document.getElementById('display-username');
        if (usernameDisplay) {
            usernameDisplay.textContent = this.username;
        }
        
        const usernameInput = document.getElementById('username-input');
        if (usernameInput && !usernameInput.matches(':focus')) {
            usernameInput.value = this.username;
        }
    }

    // Actualizar la lista de usuarios conectados en la interfaz
    updateConnectedUsersList() {
        const usersList = document.getElementById('connected-users-list');
        if (!usersList) return;
        
        // Limpiar la lista
        usersList.innerHTML = '';
        
        // Añadir usuario local primero
        const localUserItem = document.createElement('li');
        localUserItem.className = 'user-item local-user';
        
        let speakerClass = '';
        if (this.isTransmitting) {
            speakerClass = 'speaking';
        }
        
        localUserItem.innerHTML = `
            <span class="user-name ${speakerClass}">${this.username}</span>
            <span class="user-badge">Tú</span>
        `;
        usersList.appendChild(localUserItem);
        
        // Añadir usuarios remotos
        this.connectedUsers.forEach((userData, peerId) => {
            const userItem = document.createElement('li');
            userItem.className = 'user-item';
            userItem.dataset.peerId = peerId.substring(0, 8);
            
            // Verificar si este usuario está hablando
            const isSpeaking = (this.currentSpeaker === peerId) ? 'speaking' : '';
            
            userItem.innerHTML = `
                <span class="user-name ${isSpeaking}">${userData.username}</span>
                <span class="user-status online"></span>
            `;
            usersList.appendChild(userItem);
        });
        
        // Actualizar contador
        const usersCounter = document.getElementById('connected-users-count');
        if (usersCounter) {
            const count = this.connectedUsers.size;
            usersCounter.textContent = count + (count === 1 ? ' usuario conectado' : ' usuarios conectados');
        }
        
        // Mostrar el panel si hay usuarios conectados
        const usersPanel = document.getElementById('connected-users-panel');
        const toggleUsersBtn = document.getElementById('toggle-users-btn');
        
        if (this.connectedUsers.size > 0 && usersPanel && !usersPanel.classList.contains('expanded')) {
            usersPanel.classList.add('expanded');
            if (toggleUsersBtn) toggleUsersBtn.classList.add('active');
        }
    }

    broadcastUserInfo() {
        if (this.peers.size === 0) return;
        
        const message = {
            type: 'user-info',
            username: this.username,
            timestamp: Date.now()
        };

        for (const [peerId, peer] of this.peers) {
            if (peer.writable) {
                peer.write(Buffer.from(JSON.stringify(message)));
                console.log(`Información de usuario enviada a ${peerId.substr(0, 6)}`);
            }
        }
    }

    async createRoom() {
        try {
            const topicBuffer = crypto.randomBytes(32);
            const topic = b4a.toString(topicBuffer, 'hex');
            
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
        this.swarm.on('connection', (peer) => {
            const peerId = b4a.toString(peer.remotePublicKey, 'hex');
            console.log('Nuevo peer conectado:', peerId);
            
            this.peers.set(peerId, peer);
            
            // Inicialmente añadimos el peer con un nombre genérico
            this.connectedUsers.set(peerId, {
                username: `Usuario_${peerId.substr(0, 4)}`,
                active: true
            });
            
            // Actualizar la lista de usuarios inmediatamente
            this.updateConnectedUsersList();
            
            peer.on('data', (data) => {
                this.handleIncomingData(data, peerId);
            });
            
            peer.on('close', () => {
                console.log('Peer desconectado:', peerId);
                // Eliminar usuario de la lista de conectados
                this.connectedUsers.delete(peerId);
                this.peers.delete(peerId);
                
                // Si el usuario que se desconectó estaba hablando, resetear el speaker
                if (this.currentSpeaker === peerId) {
                    this.currentSpeaker = null;
                }
                
                // Actualizar UI
                this.updateConnectedUsersList();
                
                if (this.peers.size === 0) {
                    updateStatus('Desconectado');
                }
            });

            updateStatus(`Conectado a un usuario`);
            updateRecordButton(true);
            
            // Enviar información de usuario al nuevo peer
            setTimeout(() => {
                this.broadcastUserInfo();
            }, 500);
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
            
            // Actualizar el estado del botón
            const recordBtn = document.getElementById('recordBtn');
            if (recordBtn) {
                recordBtn.classList.remove('idle');
                recordBtn.classList.add('recording');
            }
            
            // Activar el efecto de grabación en la UI
            if (window.uiEffects && window.uiEffects.updateRecordButtonState) {
                window.uiEffects.updateRecordButtonState('recording');
            }
            
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
            
            // Restaurar el estado del botón a idle
            const recordBtn = document.getElementById('recordBtn');
            if (recordBtn) {
                recordBtn.classList.remove('recording');
                recordBtn.classList.add('idle');
            }
            
            // Desactivar el efecto de grabación en la UI
            if (window.uiEffects && window.uiEffects.updateRecordButtonState) {
                window.uiEffects.updateRecordButtonState('idle');
            }
            
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

    broadcastAudio(audioData) {
        if (!this.isTransmitting || this.peers.size === 0) return;

        try {
            // Asegurarse de que audioData sea un Float32Array
            const dataArray = audioData instanceof Float32Array ? audioData : new Float32Array(audioData);
            
            if (dataArray.length === 0) {
                console.log('No hay datos de audio para transmitir');
                return;
            }

            // Convertir Float32Array a Array regular para JSON
            const audioDataArray = Array.from(dataArray);
            
            // Agregar el nombre de usuario al mensaje de audio
            const message = {
                type: 'audio',
                data: audioDataArray,
                username: this.username,
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

    // Manejar todos los tipos de datos entrantes
    handleIncomingData(data, senderId) {
        try {
            const message = JSON.parse(data.toString());
            
            switch (message.type) {
                case 'audio':
                    // Añadir el remitente al mensaje de audio
                    message.senderId = senderId;
                    this.handleAudioData(message);
                    break;
                case 'user-info':
                    this.handleUserInfo(message, senderId);
                    break;
                default:
                    console.log('Mensaje desconocido recibido:', message.type);
            }
        } catch (error) {
            console.error('Error al procesar datos recibidos:', error);
        }
    }
    
    // Manejar información de usuario recibida
    handleUserInfo(message, senderId) {
        if (!message.username) return;
        
        // Actualizar el nombre de usuario para este peer
        if (this.connectedUsers.has(senderId)) {
            const userData = this.connectedUsers.get(senderId);
            userData.username = message.username;
            this.connectedUsers.set(senderId, userData);
        } else {
            this.connectedUsers.set(senderId, {
                username: message.username,
                active: true
            });
        }
        
        // Actualizar la UI
        this.updateConnectedUsersList();
        
        console.log(`Usuario actualizado: ${senderId.substr(0, 6)} -> ${message.username}`);
    }

    // Método actualizado para manejar datos de audio
    handleAudioData(message) {
        if (message.data && message.data.length > 0) {
            const recordBtn = document.getElementById('recordBtn');
            if (recordBtn) {
                recordBtn.classList.remove('idle');
                recordBtn.classList.add('receiving');
                
                // Aplicar efecto de pulsación más intenso
                recordBtn.style.transform = 'scale(1.05)';
                setTimeout(() => {
                    if (recordBtn.classList.contains('receiving')) {
                        recordBtn.style.transform = 'scale(1)';
                    }
                }, 150);
            }
            
            // Actualizar el estado sobre el círculo
            const statusPill = document.querySelector('.status-pill');
            if (statusPill) {
                statusPill.textContent = `${message.username || 'Alguien'} está hablando...`;
                statusPill.style.backgroundColor = 'var(--success-color)';
                statusPill.style.color = 'white';
            }
            
            // Establecer quién está hablando actualmente
            this.currentSpeaker = message.senderId;
            
            // Obtener el nombre de usuario del remitente
            const senderUsername = message.username || 
                (this.connectedUsers.has(message.senderId) ? 
                    this.connectedUsers.get(message.senderId).username : 
                    `Usuario_${message.senderId.substr(0, 4)}`);
            
            // Mostrar quién está hablando
            updateStatus(`${senderUsername} está hablando...`);
            
            // Actualizar la lista de usuarios para mostrar quién está hablando
            this.updateConnectedUsersList();
            
            // Limpiar cualquier temporizador existente
            if (this.speakerTimeout) {
                clearTimeout(this.speakerTimeout);
            }
            
            // Configurar un temporizador para restablecer el estado después de un tiempo
            this.speakerTimeout = setTimeout(() => {
                this.currentSpeaker = null;
                updateStatus('Conectado');
                this.updateConnectedUsersList();
            }, 1000); // 1 segundo después de recibir el último paquete de audio
            
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
            
            source.onended = () => {
                // Desactivar el efecto de recepción cuando termina el audio
                if (window.uiEffects && window.uiEffects.updateRecordButtonState) {
                    window.uiEffects.updateRecordButtonState('idle');
                }
            };
            
            source.start();
            
            console.log('Audio procesado y reproducido correctamente');
            this.debugInfo.lastReceived = Date.now();
        }
    }
}

let p2pClient = new WalkieTalkieP2P();

function updateStatus(message) {
    // Actualizar solo el estado en la píldora sobre el círculo
    const statusPill = document.querySelector('.status-pill');
    if (statusPill) {
        statusPill.textContent = message;
        statusPill.classList.remove('connected', 'connecting', 'disconnected');
        
        if (message.toLowerCase().includes('conectado') && !message.toLowerCase().includes('desconectado')) {
            statusPill.classList.add('connected');
        } else if (message.toLowerCase().includes('conectando') || message.toLowerCase().includes('esperando')) {
            statusPill.classList.add('connecting');
        } else {
            statusPill.classList.add('disconnected');
        }
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
        
        // Actualizar las clases para el estilo
        if (enabled) {
            recordBtn.classList.add('idle');
            recordBtn.classList.remove('disabled');
        } else {
            recordBtn.classList.remove('idle', 'recording', 'receiving');
            recordBtn.classList.add('disabled');
        }
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    console.log('Inicializando aplicación...');
    
    await p2pClient.initialize();
    
    const createBtn = document.getElementById('createBtn');
    const connectBtn = document.getElementById('connectBtn');
    const recordBtn = document.getElementById('recordBtn');
    const peerIdInput = document.getElementById('peerIdInput');
    const copyBtn = document.getElementById('copyBtn');
    const usernameInput = document.getElementById('username-input');
    const setUsernameBtn = document.getElementById('set-username-btn');
    const toggleUsersBtn = document.getElementById('toggle-users-btn');

    if (createBtn) {
        createBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            createBtn.disabled = true;
            createBtn.textContent = 'Creando...';
            await p2pClient.createRoom();
            createBtn.disabled = false;
            createBtn.textContent = 'Crear Nueva Sala';
        });
    }

    if (connectBtn && peerIdInput) {
        connectBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            const peerId = peerIdInput.value.trim();
            if (!peerId) {
                // Resaltar el input si está vacío
                peerIdInput.classList.add('error');
                setTimeout(() => {
                    peerIdInput.classList.remove('error');
                }, 1000);
                return;
            }
            
            connectBtn.disabled = true;
            connectBtn.textContent = 'Conectando...';
            const success = await p2pClient.joinRoom(peerId);
            connectBtn.disabled = false;
            connectBtn.textContent = 'Conectar';
            
            if (success) {
                peerIdInput.value = '';
            }
        });

        // Quitar la clase de error cuando se empiece a escribir
        peerIdInput.addEventListener('input', () => {
            peerIdInput.classList.remove('error');
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
    
    // Manejo de nombre de usuario
    if (usernameInput && setUsernameBtn) {
        // Establecer el valor inicial del input
        usernameInput.value = p2pClient.username;
        
        setUsernameBtn.addEventListener('click', () => {
            const newUsername = usernameInput.value.trim();
            if (newUsername) {
                p2pClient.setUsername(newUsername);
                
                // Mostrar feedback
                window.uiEffects?.showToast('Nombre actualizado');
            }
        });
        
        // También permitir presionar Enter
        usernameInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                setUsernameBtn.click();
            }
        });
    }
    
    // Toggle panel de usuarios - Mejorar la interacción
    if (toggleUsersBtn) {
        const usersPanel = document.getElementById('connected-users-panel');
        
        toggleUsersBtn.addEventListener('click', () => {
            if (usersPanel) {
                usersPanel.classList.toggle('expanded');
                toggleUsersBtn.classList.toggle('active');
                
                // Si el panel está expandido y hay usuarios conectados, mostrar un toast
                if (usersPanel.classList.contains('expanded') && p2pClient.connectedUsers.size > 0) {
                    window.uiEffects?.showToast(`${p2pClient.connectedUsers.size} usuario(s) conectado(s)`);
                }
            }
        });
    }

    // Manejo del panel de alias y banner
    const userInfoPanel = document.getElementById('user-info-panel');
    const usernameBanner = document.getElementById('username-banner');
    const editUsernameBtn = document.getElementById('edit-username-btn');

    // Mostrar banner por defecto si hay username guardado
    if (localStorage.getItem('walkie-pear-username')) {
        userInfoPanel.classList.remove('visible');
    } else {
        userInfoPanel.classList.add('visible');
        usernameBanner.style.display = 'none';
    }

    if (editUsernameBtn) {
        editUsernameBtn.addEventListener('click', () => {
            userInfoPanel.classList.add('visible');
            usernameBanner.style.display = 'none';
        });
    }

    if (setUsernameBtn) {
        setUsernameBtn.addEventListener('click', () => {
            const newUsername = usernameInput.value.trim();
            if (newUsername) {
                p2pClient.setUsername(newUsername);
                userInfoPanel.classList.remove('visible');
                usernameBanner.style.display = 'flex';
                window.uiEffects?.showToast('Nombre actualizado');
            }
        });
    }

    // Verificar si ya existe un nombre de usuario y ocultar el panel
    const savedUsername = localStorage.getItem('walkie-pear-username');
    if (savedUsername) {
        const userInfoPanel = document.getElementById('user-info-panel');
        if (userInfoPanel) {
            userInfoPanel.classList.add('hidden');
        }
    }

    // Mostrar el nombre de usuario actual
    p2pClient.updateUsernameDisplay();
    
    // Inicializar el panel de usuarios
    p2pClient.updateConnectedUsersList();

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
