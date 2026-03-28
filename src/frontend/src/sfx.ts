// Retro 8-bit chiptune sound effects synthesized via Web Audio API

export function createSFX(
  audioCtx: AudioContext,
  getVolume: () => number,
): { play: (event: string) => void } {
  let footstepToggle = 0;

  function masterGain(): GainNode {
    const g = audioCtx.createGain();
    g.gain.setValueAtTime(getVolume(), audioCtx.currentTime);
    g.connect(audioCtx.destination);
    return g;
  }

  function playTone(
    freq: number,
    endFreq: number,
    duration: number,
    type: OscillatorType,
    gainPeak: number,
    startTime = audioCtx.currentTime,
  ) {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    const mg = masterGain();
    osc.connect(gain);
    gain.connect(mg);
    osc.type = type;
    osc.frequency.setValueAtTime(freq, startTime);
    if (endFreq !== freq) {
      osc.frequency.exponentialRampToValueAtTime(endFreq, startTime + duration);
    }
    gain.gain.setValueAtTime(gainPeak, startTime);
    gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
    osc.start(startTime);
    osc.stop(startTime + duration + 0.01);
    osc.onended = () => {
      mg.disconnect();
    };
  }

  function playNoise(
    duration: number,
    gainPeak: number,
    lowpass = 4000,
    startTime = audioCtx.currentTime,
  ) {
    const bufLen = Math.ceil(audioCtx.sampleRate * duration);
    const buf = audioCtx.createBuffer(1, bufLen, audioCtx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < bufLen; i++) data[i] = Math.random() * 2 - 1;
    const src = audioCtx.createBufferSource();
    src.buffer = buf;
    const filter = audioCtx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(lowpass, startTime);
    const gain = audioCtx.createGain();
    const mg = masterGain();
    src.connect(filter);
    filter.connect(gain);
    gain.connect(mg);
    gain.gain.setValueAtTime(gainPeak, startTime);
    gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
    src.start(startTime);
    src.stop(startTime + duration + 0.01);
    src.onended = () => {
      mg.disconnect();
    };
  }

  const sounds: Record<string, () => void> = {
    footstep() {
      const pitch = footstepToggle % 2 === 0 ? 120 : 100;
      footstepToggle++;
      playTone(pitch, pitch * 0.8, 0.05, "square", 0.15);
    },
    jump() {
      playTone(280, 580, 0.08, "square", 0.3);
    },
    land() {
      playNoise(0.06, 0.4, 800);
      playTone(80, 40, 0.06, "square", 0.25);
    },
    climb() {
      playTone(200, 180, 0.04, "square", 0.1);
    },
    hit() {
      playNoise(0.2, 0.6, 3000);
      playTone(300, 80, 0.2, "sawtooth", 0.3);
    },
    lose_life() {
      const t = audioCtx.currentTime;
      playTone(523, 523, 0.1, "square", 0.4, t);
      playTone(392, 392, 0.1, "square", 0.4, t + 0.12);
      playTone(330, 180, 0.2, "square", 0.4, t + 0.24);
    },
    axe_swing() {
      playNoise(0.15, 0.5, 6000);
      playTone(600, 120, 0.15, "sawtooth", 0.2);
    },
    axe_smash() {
      playNoise(0.2, 0.7, 5000);
      playTone(200, 200, 0.12, "square", 0.4);
      playTone(400, 200, 0.2, "square", 0.3);
    },
    axe_whoosh() {
      playNoise(0.12, 0.6, 8000);
      playTone(900, 200, 0.15, "sawtooth", 0.3);
    },
    axe_clang() {
      playNoise(0.25, 0.8, 2000);
      playTone(180, 80, 0.2, "square", 0.5);
      playTone(300, 150, 0.15, "sawtooth", 0.3, audioCtx.currentTime + 0.02);
    },
    chest_good() {
      const t = audioCtx.currentTime;
      const notes = [523, 659, 784, 1047];
      notes.forEach((f, i) => {
        playTone(f, f, 0.08, "square", 0.35, t + i * 0.075);
      });
    },
    chest_bad() {
      const t = audioCtx.currentTime;
      const notes = [523, 466, 415, 392];
      notes.forEach((f, i) => {
        playTone(f, f * 0.95, 0.1, "sawtooth", 0.3, t + i * 0.1);
      });
    },
    powerup() {
      playTone(440, 880, 0.2, "square", 0.4);
    },
    bear_throw() {
      playTone(80, 60, 0.15, "sawtooth", 0.5);
      playNoise(0.1, 0.3, 400);
    },
    level_complete() {
      const t = audioCtx.currentTime;
      const notes = [523, 659, 784, 784, 1047];
      const durs = [0.08, 0.08, 0.08, 0.08, 0.25];
      let offset = 0;
      notes.forEach((f, i) => {
        playTone(f, f, durs[i], "square", 0.4, t + offset);
        offset += durs[i] + 0.02;
      });
    },
    game_over() {
      const t = audioCtx.currentTime;
      const notes = [392, 330, 294, 220];
      notes.forEach((f, i) => {
        playTone(f, f * 0.85, 0.18, "sawtooth", 0.45, t + i * 0.2);
      });
    },
  };

  return {
    play(event: string) {
      const fn = sounds[event];
      if (fn) {
        try {
          fn();
        } catch (_e) {
          /* ignore audio errors */
        }
      }
    },
  };
}
