// Tiny WebAudio sound effects (no assets needed)
let ctx;
const ac = () => (ctx ||= new (window.AudioContext || window.webkitAudioContext)());

function tone(freq, start, dur, type = 'sine', gain = 0.15) {
  try {
    const a = ac();
    const o = a.createOscillator();
    const g = a.createGain();
    o.type = type; o.frequency.value = freq;
    g.gain.setValueAtTime(gain, a.currentTime + start);
    g.gain.exponentialRampToValueAtTime(0.001, a.currentTime + start + dur);
    o.connect(g).connect(a.destination);
    o.start(a.currentTime + start); o.stop(a.currentTime + start + dur);
  } catch { /* audio not available */ }
}

export const sfx = {
  enabled: true,
  correct() { if (!this.enabled) return; tone(660, 0, 0.12, 'triangle'); tone(880, 0.1, 0.18, 'triangle'); },
  wrong() { if (!this.enabled) return; tone(220, 0, 0.25, 'sawtooth', 0.08); },
  tick() { if (!this.enabled) return; tone(1200, 0, 0.04, 'square', 0.04); },
  start() { if (!this.enabled) return; [523, 659, 784, 1046].forEach((f, i) => tone(f, i * 0.09, 0.15, 'triangle')); },
  join() { if (!this.enabled) return; tone(988, 0, 0.08, 'sine', 0.08); },
};
