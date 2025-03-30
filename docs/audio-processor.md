# Documentación del Procesador de Audio

## Descripción General
El `AudioProcessor` es una clase que extiende `AudioWorkletProcessor`, diseñada para procesar audio en tiempo real. Este procesador está optimizado para trabajar con buffers de audio de tamaño reducido para minimizar la latencia.

## Características Principales
- Procesamiento de audio en tiempo real
- Buffer de tamaño reducido (2048 muestras)
- Detección de nivel de audio
- Filtrado de señales de baja amplitud

## Estructura del Código

### Constructor
```javascript
constructor() {
    super();
    this.bufferSize = 2048;
    this.buffer = new Float32Array(this.bufferSize);
    this.bufferIndex = 0;
}
```
El constructor inicializa:
- Un buffer de 2048 muestras
- Un índice para seguimiento del buffer
- Hereda funcionalidades de AudioWorkletProcessor

### Método Process
```javascript
process(inputs, outputs, parameters)
```
Este método es el núcleo del procesamiento de audio y realiza las siguientes funciones:

1. **Validación de Entrada**
   - Verifica la existencia de datos de entrada
   - Retorna true si no hay datos para procesar

2. **Procesamiento de Buffer**
   - Copia los datos de entrada al buffer interno
   - Mantiene un seguimiento del índice del buffer

3. **Análisis de Nivel de Audio**
   - Calcula el promedio de amplitud del buffer
   - Filtra señales con amplitud menor a 0.01

4. **Envío de Datos**
   - Envía el buffer procesado a través del puerto de mensajes
   - Solo envía cuando el nivel de audio supera el umbral

## Parámetros y Umbrales
- **Tamaño del Buffer**: 2048 muestras
- **Umbral de Audio**: 0.01 (1% de la amplitud máxima)
- **Formato de Datos**: Float32Array

## Uso
Para utilizar este procesador, es necesario registrarlo en el contexto de audio:
```javascript
registerProcessor('audio-processor', AudioProcessor);
```

## Consideraciones de Rendimiento
- El tamaño reducido del buffer (2048 muestras) ayuda a minimizar la latencia
- El filtrado de señales de baja amplitud reduce el procesamiento innecesario
- El procesamiento se realiza en tiempo real en un hilo separado

## Casos de Uso
Este procesador es ideal para:
- Análisis de audio en tiempo real
- Detección de actividad de voz
- Procesamiento de señales de audio con baja latencia
- Sistemas que requieren respuesta rápida a cambios en el audio 