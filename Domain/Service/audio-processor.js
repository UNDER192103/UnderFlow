class AudioDataProcessor extends AudioWorkletProcessor {
  process(inputs, outputs, parameters) {
    const input = inputs[0];
    const output = outputs[0];

    if (input.length > 0) {
      const inputChannelData = input[0]; // Assuming mono audio
      const outputChannelData = new Int16Array(inputChannelData.length);

      for (let i = 0; i < inputChannelData.length; i++) {
        let s = Math.max(-1, Math.min(1, inputChannelData[i]));
        outputChannelData[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
      }

      // Add logging here
      // console.log('AudioWorkletProcessor: outputChannelData sample (first 10):', outputChannelData.slice(0, 10));
      // console.log('AudioWorkletProcessor: outputChannelData length:', outputChannelData.length);

      this.port.postMessage(outputChannelData.buffer, [outputChannelData.buffer]);
    }

    // Keep the processor alive
    return true;
  }
}

registerProcessor('audio-data-processor', AudioDataProcessor);