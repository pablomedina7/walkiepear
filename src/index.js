// Crear una única instancia de WalkieTalkieP2P
const walkieTalkie = new WalkieTalkieP2P();

document.addEventListener('DOMContentLoaded', async () => {
    console.log('Inicializando aplicación...');
    
    const createBtn = document.getElementById('createBtn');
    const connectBtn = document.getElementById('connectBtn');
    const recordBtn = document.getElementById('recordBtn');
    const peerIdInput = document.getElementById('peerIdInput');

    // Inicializar el sistema de audio
    await walkieTalkie.initialize();

    if (createBtn) {
        createBtn.addEventListener('click', async () => {
            try {
                createBtn.disabled = true;
                const roomId = await walkieTalkie.createRoom();
                document.getElementById('roomId').textContent = roomId;
                updateStatus('Sala creada: ' + roomId);
                recordBtn.disabled = false;
            } catch (error) {
                console.error('Error al crear sala:', error);
                updateStatus('Error al crear sala');
            } finally {
                createBtn.disabled = false;
            }
        });
    }

    if (connectBtn && peerIdInput) {
        connectBtn.addEventListener('click', async () => {
            try {
                const roomId = peerIdInput.value.trim();
                if (!roomId) {
                    alert('Por favor ingresa un ID de sala válido');
                    return;
                }
                connectBtn.disabled = true;
                await walkieTalkie.joinRoom(roomId);
                updateStatus('Conectado a sala: ' + roomId);
                recordBtn.disabled = false;
            } catch (error) {
                console.error('Error al conectar:', error);
                updateStatus('Error al conectar');
            } finally {
                connectBtn.disabled = false;
            }
        });
    }
});

// Botón de hablar
const talkButton = document.getElementById('talkButton');
talkButton.addEventListener('mousedown', () => walkieTalkie.startTransmitting());
talkButton.addEventListener('mouseup', () => walkieTalkie.stopTransmitting()); 