class AudioProcessor extends AudioWorkletProcessor {
    constructor() {
        super();
        this.bufferSize = 2048; // Tamaño del buffer más pequeño para menor latencia
        this.buffer = new Float32Array(this.bufferSize);
        this.bufferIndex = 0;
    }

    process(inputs, outputs, parameters) {
        const input = inputs[0];
        if (!input || !input[0]) return true;

        const inputData = input[0];
        
        // Copiar datos al buffer
        for (let i = 0; i < inputData.length; i++) {
            this.buffer[this.bufferIndex++] = inputData[i];
            
            // Cuando el buffer está lleno, enviarlo
            if (this.bufferIndex >= this.bufferSize) {
                // Calcular nivel de audio
                let sum = 0;
                for (let j = 0; j < this.bufferSize; j++) {
                    sum += Math.abs(this.buffer[j]);
                }
                const average = sum / this.bufferSize;
                
                // Solo enviar si hay suficiente nivel de audio
                if (average > 0.01) {
                    this.port.postMessage(new Float32Array(this.buffer));
                }
                
                // Reiniciar buffer
                this.bufferIndex = 0;
            }
        }

        return true;
    }
}

registerProcessor('audio-processor', AudioProcessor); 