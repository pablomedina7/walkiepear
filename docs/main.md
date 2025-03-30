# Documentación del Walkie-Talkie P2P  (WALKPEAR)

## Descripción General
El archivo `main.js` implementa un sistema de comunicación de audio en tiempo real utilizando una red P2P (peer-to-peer) basada en Hyperswarm. Este sistema permite la transmisión de audio entre múltiples usuarios en una sala virtual.

## Clase Principal: WalkieTalkieP2P

### Propiedades
```javascript
{
    swarm: null,              // Instancia de Hyperswarm para la red P2P
    peers: new Map(),         // Mapa de peers conectados
    localStream: null,        // Stream de audio local
    isTransmitting: false,    // Estado de transmisión
    audioContext: null,       // Contexto de audio Web Audio API
    audioWorklet: null,       // Nodo de procesamiento de audio
    debugInfo: {              // Información de depuración
        audioLevel: 0,
        peersConnected: 0,
        lastTransmission: null,
        lastReceived: null
    }
}
```

### Métodos Principales
#### initialize()
Inicializa el sistema de audio y configura el procesamiento de audio.
- Configura el micrófono con parámetros optimizados
- Inicializa el contexto de audio
- Configura el AudioWorklet para procesamiento
- Retorna `true` si la inicialización fue exitosa

#### createRoom()
Crea una nueva sala de comunicación.
- Genera un ID único para la sala
- Inicializa una nueva instancia de Hyperswarm
- Configura los eventos de la red
- Retorna el ID de la sala creada

#### joinRoom(roomId)
Permite unirse a una sala existente.
- Valida el ID de la sala
- Conecta al swarm existente
- Configura los eventos de conexión
- Retorna `true` si la conexión fue exitosa

#### startTransmitting() y stopTransmitting()
Controlan el inicio y fin de la transmisión de audio.
- Habilitan/deshabilitan las pistas de audio
- Actualizan el estado de transmisión
- Manejan el contexto de audio

#### broadcastAudio(audioData)
Transmite datos de audio a todos los peers conectados.
- Procesa los datos de audio
- Convierte los datos al formato adecuado
- Envía los datos a través de la red P2P

#### handleAudioData(data)
Procesa los datos de audio recibidos.
- Decodifica los datos recibidos
- Crea un buffer de audio
- Aplica procesamiento de audio (ganancia y compresión)
- Reproduce el audio recibido

### Configuración de Audio
```javascript
{
    sampleRate: 48000,
    channelCount: 1,
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true
}
```

### Procesamiento de Audio
- Utiliza AudioWorklet para procesamiento en tiempo real
- Implementa compresión de audio para evitar distorsión
- Aplica ganancia para mejor control del volumen
- Filtra señales de baja amplitud

## Funciones de Utilidad

### updateStatus(message)
Actualiza el estado en la interfaz de usuario.

### updateRoomId(id)
Actualiza el ID de la sala en la interfaz.

### updateRecordButton(enabled)
Actualiza el estado del botón de grabación.

### debugAudio()
Función de depuración que muestra información del sistema.

## Eventos del DOM
- `DOMContentLoaded`: Inicializa la aplicación
- Eventos del botón de creación de sala
- Eventos del botón de conexión
- Eventos del botón de grabación (mouse y touch)

## Consideraciones de Rendimiento
- Utiliza buffers de audio optimizados
- Implementa compresión para reducir el ancho de banda
- Maneja desconexiones y reconexiones automáticamente
- Incluye sistema de depuración integrado

## Manejo de Errores
- Implementa try-catch en operaciones críticas
- Proporciona feedback al usuario sobre errores
- Maneja casos de desconexión y reconexión

## Integración con Pear
- Utiliza el sistema de actualización de Pear
- Implementa teardown para limpieza de recursos
- Maneja recargas de la aplicación

## Requisitos del Sistema
- Navegador con soporte para Web Audio API
- Soporte para AudioWorklet
- Acceso al micrófono del dispositivo
- Conexión a internet para comunicación P2P 