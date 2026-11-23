let audioCtx: AudioContext | null = null;

const getAudioContext = (): AudioContext | null => {
  if (typeof window === 'undefined') return null;
  if (audioCtx) {
    if (audioCtx.state === 'suspended') {
      void audioCtx.resume();
    }
    return audioCtx;
  }
  const Ctor = window.AudioContext;
  if (!Ctor) return null;
  try {
    audioCtx = new Ctor();
    return audioCtx;
  } catch {
    return null;
  }
};

const playTone = (
  freq: number,
  durationSec: number,
  gainPeak: number,
  delaySec = 0,
  wave: OscillatorType = 'sine'
): void => {
  const ctx = getAudioContext();
  if (!ctx) return;
  const now = ctx.currentTime + delaySec;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = wave;
  osc.frequency.setValueAtTime(freq, now);

  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(gainPeak, now + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + durationSec);

  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(now);
  osc.stop(now + durationSec + 0.02);
};

export const playMirrorClick = (muted: boolean): void => {
  if (muted) return;
  playTone(540, 0.08, 0.06, 0, 'triangle');
  playTone(810, 0.06, 0.035, 0.015, 'sine');
};

export const playCrystalLock = (muted: boolean): void => {
  if (muted) return;
  playTone(659.25, 0.16, 0.07, 0, 'sine');
  playTone(987.77, 0.22, 0.06, 0.06, 'sine');
};

export const playSolveChord = (muted: boolean): void => {
  if (muted) return;
  const notes = [523.25, 659.25, 783.99, 1046.5];
  notes.forEach((freq, idx) => {
    playTone(freq, 0.42, 0.07, idx * 0.07, 'sine');
  });
};
