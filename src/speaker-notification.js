/**
 * Sistema de notificaciones para mostrar quién está hablando
 */

let notificationTimeout;

// Crear el elemento de notificación si no existe
function createSpeakerNotification() {
    let notification = document.getElementById('speaker-notification');
    
    if (!notification) {
        notification = document.createElement('div');
        notification.id = 'speaker-notification';
        notification.className = 'speaking-notification';
        document.body.appendChild(notification);
    }
    
    return notification;
}

// Mostrar notificación de quién está hablando
export function showSpeakerNotification(username) {
    const notification = createSpeakerNotification();
    
    notification.textContent = `${username} está hablando...`;
    notification.classList.add('visible');
    
    // Limpiar cualquier timeout anterior
    if (notificationTimeout) {
        clearTimeout(notificationTimeout);
    }
    
    // Ocultar la notificación después de un tiempo
    notificationTimeout = setTimeout(() => {
        notification.classList.remove('visible');
    }, 2000);
}

// Inicializar
export function initSpeakerNotifications() {
    // Crear el elemento de notificación al inicio
    createSpeakerNotification();
    
    // Añadir estilos si no existen
    if (!document.getElementById('speaker-notification-styles')) {
        const styles = document.createElement('style');
        styles.id = 'speaker-notification-styles';
        styles.textContent = `
            .speaking-notification {
                position: fixed;
                bottom: 80px;
                left: 50%;
                transform: translateX(-50%);
                background-color: rgba(0, 123, 255, 0.85);
                color: white;
                padding: 8px 16px;
                border-radius: 20px;
                font-size: 14px;
                font-weight: 600;
                opacity: 0;
                transition: opacity 0.3s ease;
                z-index: 1000;
                pointer-events: none;
                box-shadow: 0 3px 10px rgba(0, 0, 0, 0.2);
            }
            
            .speaking-notification.visible {
                opacity: 1;
            }
        `;
        document.head.appendChild(styles);
    }
}
