/**
 * Audio Debug Player
 *
 * Simple immediate playback - no queuing for smooth streaming.
 */

/**
 * Simple Audio Debug Player - plays immediately
 */
export class AudioDebugPlayer {
  private audioContext: AudioContext | null = null;
  private sampleRate: number = 16000;
  private onPlayCallback?: (source: string, duration: number) => void;

  constructor(sampleRate: number = 16000) {
    this.sampleRate = sampleRate;
  }

  async init(): Promise<void> {
    if (!this.audioContext) {
      this.audioContext = new AudioContext({ sampleRate: this.sampleRate });
    }
    if (this.audioContext.state === 'suspended') {
      await this.audioContext.resume();
    }
  }

  onPlay(callback: (source: string, duration: number) => void): void {
    this.onPlayCallback = callback;
  }

  async playChunk(
    base64Audio: string,
    source: string = 'unknown',
    format: string = 'pcm_s16le',
    sampleRate?: number
  ): Promise<void> {
    if (!this.audioContext) await this.init();
    if (!this.audioContext) return;

    const rate = sampleRate || this.sampleRate;

    try {
      const binaryString = atob(base64Audio);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      // 16-bit PCM
      const samples = new Float32Array(bytes.length / 2);
      const dataView = new DataView(bytes.buffer);
      for (let i = 0; i < samples.length; i++) {
        samples[i] = dataView.getInt16(i * 2, true) / 32768.0;
      }

      if (samples.length < 50) return;

      const audioBuffer = this.audioContext.createBuffer(1, samples.length, rate);
      audioBuffer.getChannelData(0).set(samples);

      const sourceNode = this.audioContext.createBufferSource();
      sourceNode.buffer = audioBuffer;
      sourceNode.connect(this.audioContext.destination);
      sourceNode.start();

      this.onPlayCallback?.(source, samples.length / rate);
    } catch (e) {
      // Ignore errors
    }
  }

  clearQueue(): void {
    // No queue to clear
  }

  stop(): void {
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
  }

  isActive(): boolean {
    return this.audioContext !== null && this.audioContext.state === 'running';
  }
}

// Singleton instance
let debugPlayer: AudioDebugPlayer | null = null;

export function getAudioDebugPlayer(): AudioDebugPlayer {
  if (!debugPlayer) {
    debugPlayer = new AudioDebugPlayer(16000);
  }
  return debugPlayer;
}

export function destroyAudioDebugPlayer(): void {
  if (debugPlayer) {
    debugPlayer.stop();
    debugPlayer = null;
  }
}
