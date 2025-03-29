# Walkie Pear

Una aplicación de walkie-talkie web utilizando Pear (Holepunch) con encriptación.

## Características

- Comunicación en tiempo real usando Pear
- Encriptación de mensajes
- Interfaz web moderna y responsive
- Grabación y reproducción de audio

## Requisitos

- Node.js (versión 14 o superior)
- Navegador web moderno con soporte para WebRTC
- Micrófono y altavoces

## Instalación

1. Clona este repositorio:
```bash
git clone [URL_DEL_REPOSITORIO]
cd walkie-pear
```

2. Instala las dependencias:
```bash
npm install
```

3. Inicia el servidor de desarrollo:
```bash
npm start
```

4. Abre tu navegador y visita `http://localhost:5173`

## Uso

1. Haz clic en "Conectar" para iniciar la conexión Pear
2. Una vez conectado, usa el botón "Grabar" para comenzar a transmitir
3. Suelta el botón para detener la transmisión
4. Los mensajes de audio recibidos se reproducirán automáticamente

## Seguridad

La aplicación utiliza encriptación de extremo a extremo para proteger las comunicaciones. Cada sesión genera una nueva clave de identidad.

## Tecnologías utilizadas

- Pear (Holepunch)
- WebRTC
- Vite
- Hypercore-crypto

## Licencia

MIT 