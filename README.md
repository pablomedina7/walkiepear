# Walkie-Pear

Una aplicación de comunicación por voz en tiempo real basada en P2P (peer-to-peer) utilizando Pear Runtime y Hyperswarm.

## Características

- Comunicación de voz en tiempo real con tecnología Push-to-Talk (PTT)
- Creación y unión a salas de comunicación con IDs únicos
- Conexión directa entre usuarios sin servidores centrales
- Interfaz de usuario moderna y adaptable a diferentes dispositivos
- Gestión de perfiles de usuario con nombres personalizados
- Lista de participantes conectados en tiempo real
- Indicadores visuales de quién está hablando

## Tecnologías utilizadas

- **Pear Runtime**: Entorno de ejecución para aplicaciones P2P
- **Hyperswarm**: Sistema de descubrimiento y conexión distribuido
- **Web Audio API**: Para procesamiento y transmisión de audio de baja latencia
- **AudioWorklet**: Procesamiento de audio en un hilo separado
- **Hypercore-crypto**: Generación segura de identificadores únicos
- **B4A**: Manipulación eficiente de buffers binarios

## Requisitos

- Navegador web moderno con soporte para AudioWorklet API
- Micrófono para transmisión de voz
- Conexión a Internet

## Instalación

1. Clona este repositorio:
```bash
git clone https://github.com/tu-usuario/walkie-pear.git
cd walkie-pear
```

2. Instala Pear Runtime si aún no lo tienes:
```bash
npm install -g @pears/cli
```

3. Instala las dependencias del proyecto:
```bash
npm install
```

4. Inicia la aplicación con Pear Runtime:
```bash
pear run --dev .
```

> **Nota:** Para más información sobre Pear Runtime y su ecosistema, visita la [documentación oficial de Pears](https://docs.pears.com/) o el [sitio web principal](https://pears.com/).

## Uso

### Crear una sala
1. Haz clic en el botón "Crear Sala"
2. Se generará un ID único para tu sala
3. Comparte este ID con las personas que quieres que se unan

### Unirse a una sala
1. Pega el ID de la sala en el campo de texto
2. Haz clic en el botón "Unirse a Sala"
3. La conexión se establecerá automáticamente

### Comunicación
1. Cuando quieras hablar, mantén presionado el botón circular grande
2. Suelta el botón cuando termines de hablar
3. Cuando otra persona hable, el botón cambiará de color a verde

### Personalización
- Para cambiar tu nombre de usuario, haz clic en el icono de edición junto a tu nombre
- Ingresa un nuevo nombre y confirma

## Estructura del proyecto
```bash
walkiepear/
├── index.html            # Estructura HTML principal
├── src/
│   ├── main.js           # Lógica principal de P2P y audio
│   ├── audio-processor.js # Procesamiento de audio optimizado
│   ├── style.css         # Estilos de la interfaz
│   ├── style.js          # Efectos visuales y animaciones
│   └── speaker-notification.js # Sistema de notificaciones
├── documentation.html    # Documentación técnica detallada
└── package.json         # Dependencias y configuración
```

## Componentes principales

### WalkieTalkieP2P (main.js)
Clase principal que implementa la comunicación P2P y el procesamiento de audio:
- Gestión de salas y conexiones mediante Hyperswarm
- Captura y transmisión de audio con Web Audio API
- Manejo de usuarios y sus estados en tiempo real
- Interfaz del sistema de comunicación con la UI

### AudioProcessor (audio-processor.js)
Procesador de audio optimizado para reducir latencia y mejorar calidad:
- Tamaño de buffer de 2048 muestras para equilibrar latencia y calidad
- Detección de nivel de audio para filtrar silencio y ruido de fondo
- Procesamiento en tiempo real en un hilo separado mediante AudioWorklet
- Optimización para comunicaciones de voz

## Consideraciones de rendimiento
- El tamaño del buffer de audio está optimizado para minimizar la latencia
- Se implementan compresores de audio para mejorar la calidad de voz
- El procesamiento de audio ocurre en un hilo separado para no bloquear la UI
- Los datos de audio se filtran antes de transmitir para reducir uso de red

## Licencia
Este proyecto está bajo la Licencia MIT - ver el archivo LICENSE para más detalles.

## Contribuir
Las contribuciones son bienvenidas. Por favor, abre un issue para discutir cambios importantes antes de enviar un pull request.
