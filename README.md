# WALKPEAR

Una aplicación de walkie-talkie completamente descentralizada (P2P) que utiliza Hyperswarm para comunicación de audio en tiempo real, sin necesidad de servidores centrales.

## Características

- Comunicación P2P descentralizada usando Hyperswarm
- Sin necesidad de servidores centrales
- Transmisión de audio directa entre pares
- Interfaz web intuitiva tipo "presionar para hablar"
- Creación y unión a salas de comunicación P2P
- Monitoreo en tiempo real del estado de las conexiones

## Requisitos Técnicos

- Node.js (versión 16 o superior)
- Navegador web moderno con soporte para:
  - AudioContext
  - AudioWorklet API
  - getUserMedia API
- Micrófono funcional
- Altavoces o auriculares

## Instalación Local

1. Clona este repositorio:
```bash
git clone https://github.com/pablomedina7/walkiepear.git
cd walkpear
```

2. Instala las dependencias:
```bash
npm install
```

3. Inicia la aplicación localmente:
```bash
npm start
```

## Guía de Uso

### Crear una Nueva Sala P2P

1. Abre la aplicación en tu navegador
2. Haz clic en el botón "Crear Sala"
3. Se generará un ID único para tu sala P2P
4. Comparte este ID con otros usuarios para que puedan unirse directamente

### Unirse a una Sala P2P Existente

1. Obtén el ID de la sala P2P a la que deseas unirte
2. Pega el ID en el campo de texto
3. Haz clic en "Conectar"
4. La conexión P2P se establecerá directamente con los otros participantes

### Transmitir Audio

1. Una vez establecida la conexión P2P, verás el botón de transmisión habilitado
2. Mantén presionado el botón para hablar
3. Suelta el botón para dejar de transmitir
4. El indicador de estado mostrará cuando estés transmitiendo

## Solución de Problemas

### El Micrófono no Funciona

1. Verifica que has dado permisos de micrófono al navegador
2. Comprueba que el micrófono está seleccionado como dispositivo de entrada
3. Revisa la consola del navegador para mensajes de error

### Problemas de Conexión P2P

1. Asegúrate de que el ID de la sala es correcto
2. Verifica tu conexión a internet
3. Revisa el panel de debug para el estado de las conexiones P2P

## Arquitectura Técnica

- **Frontend**: HTML5, JavaScript Vanilla
- **Red P2P**: Hyperswarm (comunicación descentralizada)
- **Audio**: AudioContext, AudioWorklet
- **Empaquetado**: Pear Interface

## Dependencias Principales

```json
{
  "hyperswarm": "^4.7.3",
  "b4a": "^1.6.4",
  "hypercore-crypto": "^3.3.1",
  "pear-interface": "^1.0.0"
}
```

## Debug y Monitoreo

La aplicación incluye herramientas de debug integradas:

1. Abre la consola del navegador
2. El estado del sistema se actualiza cada 5 segundos
3. Monitorea:
   - Estado del micrófono
   - Conexiones P2P activas
   - Estado del procesamiento de audio
   - Niveles de audio

## Contribuir

1. Haz fork del repositorio
2. Crea una rama para tu feature (`git checkout -b feature/NuevaCaracteristica`)
3. Commit tus cambios (`git commit -am 'Añade nueva característica'`)
4. Push a la rama (`git push origin feature/NuevaCaracteristica`)
5. Crea un Pull Request

## Licencia

MIT

## Contacto

[Tu información de contacto o la del proyecto] 