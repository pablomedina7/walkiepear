document.addEventListener('DOMContentLoaded', () => {
    initializeUIEffects();
    setupCopyButton();
});

function initializeUIEffects() {
    const recordBtn = document.getElementById('recordBtn');
    const statusIndicator = document.querySelector('.status-indicator');
    const status = document.getElementById('status');

    if (recordBtn) {
        // Efectos para el botón de grabación mejorados
        recordBtn.addEventListener('mousedown', () => {
            if (!recordBtn.disabled) {
                recordBtn.classList.add('recording');
                recordBtn.classList.remove('receiving', 'idle');
                // Efecto de vibración en móviles si está disponible
                if (navigator.vibrate) {
                    navigator.vibrate(50);
                }
            }
        });

        recordBtn.addEventListener('mouseup', () => {
            recordBtn.classList.remove('recording');
            recordBtn.classList.add('idle');
        });

        recordBtn.addEventListener('mouseleave', () => {
            recordBtn.classList.remove('recording');
            if (!recordBtn.classList.contains('receiving')) {
                recordBtn.classList.add('idle');
            }
        });

        // Soporte para dispositivos táctiles
        recordBtn.addEventListener('touchstart', (e) => {
            if (!recordBtn.disabled) {
                e.preventDefault();
                recordBtn.classList.add('recording');
                recordBtn.classList.remove('receiving', 'idle');
                // Efecto de vibración en móviles si está disponible
                if (navigator.vibrate) {
                    navigator.vibrate(50);
                }
            }
        });

        recordBtn.addEventListener('touchend', (e) => {
            e.preventDefault();
            recordBtn.classList.remove('recording');
            recordBtn.classList.add('idle');
        });

        // Simulación de recepción de audio (para demostración visual)
        // Esto debe ser reemplazado por la lógica real de recepción de audio
        window.simulateReceivingAudio = (isReceiving) => {
            if (isReceiving) {
                recordBtn.classList.add('receiving');
                recordBtn.classList.remove('recording');
            } else {
                recordBtn.classList.remove('receiving');
            }
        };
    }

    // Actualizar el indicador de estado basado en el texto actual
    function updateStatusIndicator() {
        if (status) {
            const statusText = status.textContent.toLowerCase();
            
            statusIndicator.classList.remove('connected', 'connecting', 'disconnected');
            
            if (statusText.includes('conectado') && !statusText.includes('desconectado')) {
                statusIndicator.classList.add('connected');
            } else if (statusText.includes('conectando') || statusText.includes('esperando')) {
                statusIndicator.classList.add('connecting');
            } else {
                statusIndicator.classList.add('disconnected');
            }
        }
    }

    // Observer para detectar cambios en el texto de estado
    if (status) {
        const observer = new MutationObserver(updateStatusIndicator);
        observer.observe(status, { childList: true });
        
        // Actualizar el estado inicial
        updateStatusIndicator();
    }

    // Animar las ondas de audio con más variación y realismo
    function animateAudioWaves() {
        const waves = document.querySelectorAll('.wave');
        waves.forEach((wave, index) => {
            // Diferentes alturas para cada onda, creando un patrón más realista
            const baseHeight = Math.sin(Date.now() / 200 + index) * 40 + 60;
            const randomFactor = Math.random() * 20;
            wave.style.height = `${baseHeight + randomFactor}%`;
        });
    }

    // Sólo animar si el botón está en modo grabación o recepción
    setInterval(() => {
        if (recordBtn && (recordBtn.classList.contains('recording') || recordBtn.classList.contains('receiving'))) {
            animateAudioWaves();
        }
    }, 100);
}

function setupCopyButton() {
    const copyBtn = document.getElementById('copyBtn');
    const roomId = document.getElementById('roomId');

    if (copyBtn && roomId) {
        copyBtn.addEventListener('click', () => {
            const roomIdText = roomId.textContent;
            if (roomIdText) {
                navigator.clipboard.writeText(roomIdText)
                    .then(() => {
                        // Mostrar feedback al usuario mejorado
                        copyBtn.innerHTML = `
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <polyline points="20 6 9 17 4 12"></polyline>
                            </svg>
                        `;
                        copyBtn.style.color = 'var(--success-color)';
                        
                        // Mostrar un mensaje toast de confirmación
                        showToast('¡ID copiado al portapapeles!');
                        
                        setTimeout(() => {
                            copyBtn.innerHTML = `
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                                    <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"></path>
                                </svg>
                            `;
                            copyBtn.style.color = '#666';
                        }, 2000);
                    })
                    .catch(err => {
                        console.error('Error al copiar texto: ', err);
                    });
            }
        });
    }
}

// Función para mostrar mensajes toast
function showToast(message, duration = 3000) {
    // Crear elemento toast si no existe
    let toast = document.getElementById('toast-notification');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'toast-notification';
        toast.style.position = 'fixed';
        toast.style.bottom = '20px';
        toast.style.left = '50%';
        toast.style.transform = 'translateX(-50%)';
        toast.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
        toast.style.color = 'white';
        toast.style.padding = '12px 20px';
        toast.style.borderRadius = '4px';
        toast.style.zIndex = '9999';
        toast.style.opacity = '0';
        toast.style.transition = 'opacity 0.3s ease';
        document.body.appendChild(toast);
    }

    // Establecer mensaje y mostrar
    toast.textContent = message;
    setTimeout(() => {
        toast.style.opacity = '1';
    }, 10);
    
    // Ocultar después de la duración
    setTimeout(() => {
        toast.style.opacity = '0';
    }, duration);
}

// Añadir inspección de audio para visualización en tiempo real
function setupAudioVisualization() {
    if (window.p2pClient && window.p2pClient.audioContext && window.p2pClient.localStream) {
        const audioContext = window.p2pClient.audioContext;
        const source = audioContext.createMediaStreamSource(window.p2pClient.localStream);
        const analyser = audioContext.createAnalyser();
        
        analyser.fftSize = 32;
        source.connect(analyser);
        
        const bufferLength = analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        
        function updateVisualization() {
            if (window.p2pClient.isTransmitting) {
                analyser.getByteFrequencyData(dataArray);
                
                // Calcular el promedio de volumen
                let sum = 0;
                for (let i = 0; i < bufferLength; i++) {
                    sum += dataArray[i];
                }
                const average = sum / bufferLength;
                
                // Ajustar la intensidad de las ondas basado en el volumen
                const waves = document.querySelectorAll('.wave');
                waves.forEach(wave => {
                    const baseHeight = (average / 256) * 100;
                    const randomAddition = Math.random() * 20;
                    wave.style.height = `${Math.max(10, baseHeight + randomAddition)}%`;
                });
            }
            
            requestAnimationFrame(updateVisualization);
        }
        
        updateVisualization();
    }
}

// Intentar configurar la visualización de audio cuando la página esté completamente cargada
window.addEventListener('load', () => {
    // Esperar un poco para asegurarse de que p2pClient está completamente inicializado
    setTimeout(setupAudioVisualization, 2000);
});

// Exponer funciones que puedan ser llamadas desde main.js
window.uiEffects = {
    updateRecordButtonState: (state) => {
        const recordBtn = document.getElementById('recordBtn');
        if (recordBtn) {
            if (state === 'recording') {
                recordBtn.classList.add('recording');
                recordBtn.classList.remove('receiving');
            } else if (state === 'receiving') {
                recordBtn.classList.add('receiving');
                recordBtn.classList.remove('recording');
            } else {
                recordBtn.classList.remove('recording', 'receiving');
            }
        }
    },
    showToast: showToast,
    
    // Función para actualizar la interfaz cuando cambia el estado de conexión
    updateConnectionState: (state) => {
        const statusContainer = document.getElementById('status-container');
        const statusIndicator = document.querySelector('.status-indicator');
        
        if (statusContainer && statusIndicator) {
            statusContainer.classList.remove('connected', 'connecting', 'disconnected');
            statusIndicator.classList.remove('connected', 'connecting', 'disconnected');
            
            statusContainer.classList.add(state);
            statusIndicator.classList.add(state);
        }
    }
};

// Función para mostrar mensajes toast (asegurarnos de que esté definida)
if (!window.uiEffects) {
    window.uiEffects = {};
}

// Añadir la función showToast al objeto uiEffects global si no existe
if (!window.uiEffects.showToast) {
    window.uiEffects.showToast = function(message, duration = 3000) {
        // Buscar si ya existe un toast
        let toast = document.querySelector('.toast');
        
        // Si no existe, crear uno nuevo
        if (!toast) {
            toast = document.createElement('div');
            toast.className = 'toast';
            document.body.appendChild(toast);
            
            // Añadir estilo si no existe
            if (!document.querySelector('#toast-style')) {
                const style = document.createElement('style');
                style.id = 'toast-style';
                style.textContent = `
                    .toast {
                        position: fixed;
                        bottom: 20px;
                        left: 50%;
                        transform: translateX(-50%);
                        background-color: rgba(0, 0, 0, 0.8);
                        color: white;
                        padding: 12px 24px;
                        border-radius: 8px;
                        z-index: 1000;
                        font-size: 16px;
                        opacity: 0;
                        transition: opacity 0.3s;
                    }
                    .toast.visible {
                        opacity: 1;
                    }
                `;
                document.head.appendChild(style);
            }
        }
        
        // Actualizar el mensaje y mostrar
        toast.textContent = message;
        toast.classList.add('visible');
        
        // Ocultar después de la duración
        setTimeout(() => {
            toast.classList.remove('visible');
        }, duration);
    };
}

// Exponer funciones que puedan ser llamadas desde main.js
if (!window.uiEffects.updateRecordButtonState) {
    window.uiEffects.updateRecordButtonState = function(state) {
        const recordBtn = document.getElementById('recordBtn');
        if (!recordBtn) return;
        
        recordBtn.classList.remove('recording', 'receiving');
        
        if (state === 'recording') {
            recordBtn.classList.add('recording');
        } else if (state === 'receiving') {
            recordBtn.classList.add('receiving');
        }
    };
}
