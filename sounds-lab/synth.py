"""Synthesizes candidate UI sounds for Görev Defteri (EU4 / medieval theme).

Everything is generated from scratch (sines, noise, Karplus-Strong plucked strings),
so there are no licensing questions. Output: 44.1 kHz mono 16-bit WAV files next to
this script, plus index.html (built separately) to listen and choose.

Run:  python synth.py
"""
import os

import numpy as np
from scipy.io import wavfile
from scipy.signal import butter, sosfilt

SR = 44100
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "wav")
rng = np.random.default_rng(7)


# ---------- building blocks ----------
def t(dur):
    return np.arange(int(SR * dur)) / SR


def env_exp(dur, decay, attack=0.002):
    x = t(dur)
    a = np.clip(x / attack, 0, 1) if attack > 0 else 1
    return a * np.exp(-x / decay)


def noise(dur):
    return rng.standard_normal(int(SR * dur))


def bandpass(x, lo, hi, order=2):
    return sosfilt(butter(order, [lo, hi], btype="band", fs=SR, output="sos"), x)


def lowpass(x, f, order=2):
    return sosfilt(butter(order, f, btype="low", fs=SR, output="sos"), x)


def highpass(x, f, order=2):
    return sosfilt(butter(order, f, btype="high", fs=SR, output="sos"), x)


def modal(freqs, decays, amps, dur):
    """Sum of exponentially decaying sines — wood, metal, bell bodies."""
    x = t(dur)
    out = np.zeros_like(x)
    for f, d, a in zip(freqs, decays, amps):
        out += a * np.sin(2 * np.pi * f * x + rng.uniform(0, 6.28)) * np.exp(-x / d)
    return out


def pluck(freq, dur, damping=0.996, bright=0.5):
    """Karplus-Strong plucked string (lute-like)."""
    n = int(SR * dur)
    period = int(SR / freq)
    buf = rng.uniform(-1, 1, period)
    buf = lowpass(buf, 1500 + 6000 * bright) if bright < 1 else buf
    out = np.zeros(n)
    for i in range(n):
        j = i % period
        out[i] = buf[j]
        buf[j] = damping * 0.5 * (buf[j] + buf[(j + 1) % period])
    # body resonance
    body = bandpass(out, 180, 2500) * 0.6 + out * 0.4
    return body * np.exp(-t(dur) / (dur * 0.45))


def sweep_noise(dur, f0, f1, width=0.6):
    """Noise through a bandpass whose centre glides f0 → f1 (block-wise)."""
    x = noise(dur)
    out = np.zeros_like(x)
    blocks = 40
    size = len(x) // blocks + 1
    for b in range(blocks):
        s = slice(b * size, min((b + 1) * size, len(x)))
        if s.start >= len(x):
            break
        fc = f0 * (f1 / f0) ** (b / (blocks - 1))
        lo, hi = fc * (1 - width / 2), min(fc * (1 + width / 2), SR / 2 - 100)
        out[s] = bandpass(x, lo, hi)[s]
    return out


def grains(dur, rate, glen, lo, hi):
    """Random short noise grains — crackle, crumple, scratch."""
    out = np.zeros(int(SR * dur))
    count = int(rate * dur)
    for _ in range(count):
        st = rng.integers(0, max(1, len(out) - int(SR * glen)))
        g = bandpass(noise(glen), lo, hi) * env_exp(glen, glen / 3, 0.0005) * rng.uniform(0.3, 1.0)
        out[st:st + len(g)] += g
    return out


def thud(f0=110, f1=55, dur=0.18, decay=0.05):
    x = t(dur)
    f = f1 + (f0 - f1) * np.exp(-x / 0.03)
    phase = 2 * np.pi * np.cumsum(f) / SR
    return np.sin(phase) * env_exp(dur, decay, 0.001)


def room(x, size=0.25, mix=0.18):
    """Tiny room: convolution with exponentially decaying filtered noise."""
    ir = lowpass(noise(size), 3500) * np.exp(-t(size) / (size / 5))
    ir /= np.sqrt(np.sum(ir ** 2)) + 1e-9
    wet = np.convolve(x, ir)[: len(x) + int(SR * size * 0.6)]
    dry = np.concatenate([x, np.zeros(len(wet) - len(x))])
    return dry * (1 - mix) + wet * mix


def place(total, *parts):
    """Mix (offset_seconds, signal) parts into one buffer."""
    out = np.zeros(int(SR * total))
    for off, sig in parts:
        s = int(SR * off)
        e = min(len(out), s + len(sig))
        out[s:e] += sig[: e - s]
    return out


def finish(x, peak_db, fade=0.004):
    x = x - np.mean(x)
    n = int(SR * fade)
    x[:n] *= np.linspace(0, 1, n)
    x[-n * 3:] *= np.linspace(1, 0, n * 3)
    p = np.max(np.abs(x)) + 1e-9
    return x / p * 10 ** (peak_db / 20)


def save(name, x, peak_db=-3.0):
    os.makedirs(OUT, exist_ok=True)
    y = finish(x, peak_db)
    wavfile.write(os.path.join(OUT, name + ".wav"), SR, (y * 32767).astype(np.int16))
    print(f"{name:28s} {len(y) / SR * 1000:5.0f} ms")


# ---------- 1. tap: generic button press (frequent → quiet, short) ----------
def wood_knock(pitch=1.0, dur=0.12):
    body = modal([520 * pitch, 1190 * pitch, 2210 * pitch], [0.018, 0.010, 0.006], [1, 0.5, 0.25], dur)
    click = highpass(noise(0.004), 2000) * 0.4
    return place(dur, (0, body), (0, click))


save("tap_a_ahsap", room(wood_knock(), 0.12, 0.10), -12)
save("tap_b_parsomen", room(highpass(noise(0.03), 2500) * env_exp(0.03, 0.006, 0.0005) + 0.25 * thud(240, 160, 0.03, 0.01), 0.1, 0.1), -14)
save("tap_c_pirinc", room(place(0.1, (0, modal([2400, 3710, 5230], [0.025, 0.015, 0.008], [1, 0.6, 0.3], 0.1)), (0, highpass(noise(0.003), 4000) * 0.3)), 0.12, 0.12), -15)

# ---------- 2. open: an event popup opens ----------
unroll = sweep_noise(0.32, 700, 2800, 0.7) * np.sin(np.pi * t(0.32) / 0.32) ** 1.5
unroll += 0.25 * grains(0.32, 60, 0.006, 1500, 5000) * np.sin(np.pi * t(0.32) / 0.32)
save("open_a_ferman_acilir", room(unroll, 0.25, 0.15), -8)
drum = thud(130, 62, 0.5, 0.16) + 0.5 * lowpass(noise(0.5), 400) * env_exp(0.5, 0.05)
save("open_b_davul", room(place(0.62, (0, drum), (0.11, 0.45 * thud(120, 60, 0.4, 0.12))), 0.3, 0.2), -6)
bell = modal([880, 880 * 2.76, 880 * 5.4, 880 * 8.93], [0.6, 0.25, 0.12, 0.06], [1, 0.45, 0.25, 0.1], 0.9)
save("open_c_can", room(bell, 0.4, 0.2), -10)

# ---------- 3. add: task written into the ledger ----------
scratch = grains(0.2, 260, 0.004, 3000, 7500) * np.linspace(0.6, 1, int(SR * 0.2))
save("add_a_tuy_kalem", room(place(0.34, (0, scratch), (0.21, 0.9 * thud(140, 70, 0.13, 0.04))), 0.2, 0.15), -6)
seal = thud(180, 80, 0.2, 0.05) + 0.35 * lowpass(noise(0.2), 900) * env_exp(0.2, 0.02) + 0.15 * modal([620, 1400], [0.03, 0.015], [1, 0.4], 0.2)
save("add_b_muhur", room(seal, 0.25, 0.18), -5)
save("add_c_ud_yukselen", room(place(0.75, (0, pluck(293.66, 0.6, 0.995)), (0.11, pluck(440.0, 0.62, 0.995))), 0.3, 0.15), -6)

# ---------- 4. delete: task removed ----------
_n = int(SR * 0.35)
tear_env = np.concatenate([np.linspace(0.2, 1, int(SR * 0.22)), np.linspace(1, 0, _n - int(SR * 0.22))])
tear = grains(0.35, 520, 0.003, 1200, 6000) * tear_env + 0.3 * bandpass(noise(0.35), 800, 3000) * tear_env
save("del_a_kagit_yirtma", room(tear, 0.2, 0.12), -6)
crumple = grains(0.42, 140, 0.012, 600, 4500) * np.sin(np.pi * t(0.42) / 0.42) ** 0.7
save("del_b_burusturma", room(crumple, 0.2, 0.12), -6)
save("del_c_ud_inen", room(place(0.75, (0, pluck(440.0, 0.55, 0.993)), (0.12, pluck(293.66, 0.6, 0.993))), 0.3, 0.15), -7)

# ---------- 5. undo: a done task un-ticked ----------
save("undo_a_tahta_inen", room(place(0.24, (0, wood_knock(1.15, 0.12)), (0.09, 0.8 * wood_knock(0.85, 0.14))), 0.15, 0.1), -10)
sw = sweep_noise(0.22, 3200, 900, 0.6) * np.sin(np.pi * t(0.22) / 0.22) ** 2
save("undo_b_ters_hisirti", room(sw, 0.15, 0.1), -11)

# ---------- 6. week change: swipe / ‹ › ----------
flutter = 0.65 + 0.35 * np.sin(2 * np.pi * 22 * t(0.36))
page = sweep_noise(0.36, 2600, 900, 0.8) * np.sin(np.pi * t(0.36) / 0.36) ** 1.2 * flutter
save("week_a_sayfa_cevir", room(page, 0.2, 0.12), -10)
whoosh = lowpass(noise(0.3), 1400) * np.sin(np.pi * t(0.3) / 0.3) ** 2
save("week_b_ruzgar", room(whoosh, 0.2, 0.1), -12)

# ---------- 7. error: e.g. empty title ----------
save("err_a_cift_vurus", room(place(0.3, (0, wood_knock(0.42, 0.14)), (0.12, wood_knock(0.42, 0.16))), 0.15, 0.1), -9)
mute = place(0.32, (0, pluck(146.83, 0.14, 0.97, 0.3)), (0.13, pluck(138.59, 0.18, 0.97, 0.3)))
save("err_b_boguk_tel", room(mute, 0.15, 0.1), -9)

# ---------- 8. fail: a task marked as failed (long press) ----------
# A: a wax seal / wooden tally cracking, then a dull thud.
crack = grains(0.07, 900, 0.002, 1500, 7000) * env_exp(0.07, 0.02, 0.0005)
snap_body = modal([310, 760, 1530], [0.03, 0.015, 0.008], [1, 0.45, 0.2], 0.14)
save("fail_a_kirik_muhur", room(place(0.5, (0, crack), (0, 0.6 * snap_body), (0.07, 0.9 * thud(120, 50, 0.35, 0.09))), 0.25, 0.16), -6)
# B: lute, a dark descending minor arpeggio (A3 → F3 → D3).
save("fail_b_ud_minor", room(place(1.0, (0, pluck(220.0, 0.5, 0.994, 0.4)), (0.13, pluck(174.61, 0.5, 0.994, 0.4)), (0.26, pluck(146.83, 0.7, 0.995, 0.4))), 0.3, 0.16), -7)
# C: a muffled war drum, then a low tolling bell (defeat).
toll = modal([196, 196 * 2.76, 196 * 5.4], [0.7, 0.25, 0.1], [1, 0.35, 0.12], 1.1)
drum2 = thud(95, 45, 0.45, 0.14) + 0.4 * lowpass(noise(0.45), 300) * env_exp(0.45, 0.05)
save("fail_c_davul_can", room(place(1.3, (0, drum2), (0.16, 0.55 * toll)), 0.35, 0.2), -6)
