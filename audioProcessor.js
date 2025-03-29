class AudioProcessor extends AudioWorkletProcessor {
    constructor(options) {
        super()
        this.bufferSize = options.processorOptions.bufferSize || 2048
        this.bitRate = options.processorOptions.bitRate || 16000
        this.sampleBuffer = new Float32Array(this.bufferSize)
        this.bufferIndex = 0
        this.skipFrames = 2  // Aumentado para reducir más la carga
        this.frameCount = 0
        this.lastProcessTime = 0
        this.processInterval = 1000 / (this.bitRate / this.bufferSize) // Intervalo basado en bitRate
    }

    process(inputs, outputs, parameters) {
        const input = inputs[0]
        if (!input || !input[0]) return true

        const now = currentTime * 1000 // Convertir a milisegundos
        if (now - this.lastProcessTime < this.processInterval) return true

        // Saltar frames para reducir la carga de procesamiento
        this.frameCount++
        if (this.frameCount % this.skipFrames !== 0) return true

        const inputChannel = input[0]
        
        // Procesar cada muestra de audio con downsampling más agresivo
        for (let i = 0; i < inputChannel.length; i += 3) {  // Procesar cada tercera muestra
            const avg = (inputChannel[i] + (inputChannel[i + 1] || 0) + (inputChannel[i + 2] || 0)) / 3
            this.sampleBuffer[this.bufferIndex] = avg
            this.bufferIndex++

            // Cuando el buffer está lleno, enviarlo
            if (this.bufferIndex >= this.bufferSize) {
                const pcmData = new Int16Array(this.bufferSize)
                
                // Convertir de Float32 a Int16 con compresión más agresiva
                for (let j = 0; j < this.bufferSize; j++) {
                    // Aplicar compresión más agresiva y normalización
                    const sample = Math.max(-0.7, Math.min(0.7, this.sampleBuffer[j])) * 1.4
                    pcmData[j] = Math.floor(sample * 16384) // Reducido a 15 bits para menor calidad pero más estabilidad
                }

                // Enviar los datos al hilo principal
                this.port.postMessage({
                    buffer: pcmData.buffer
                }, [pcmData.buffer])

                // Reiniciar el buffer
                this.sampleBuffer = new Float32Array(this.bufferSize)
                this.bufferIndex = 0
                this.lastProcessTime = now
            }
        }

        return true
    }
}

registerProcessor('audio-processor', AudioProcessor) 