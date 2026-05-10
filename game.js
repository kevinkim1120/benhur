// 벤허 전차 레이싱 v1.0 - 모바일 프로토타입
// + 사운드, 콤보, 부스트, 픽업, 마차 선택, 보스 페이즈 4, 베스트 점수, 햅틱

const GAME_W = 540;
const GAME_H = 960;
const ROAD_LEFT = 70;
const ROAD_RIGHT = GAME_W - 70;
const ROAD_W = ROAD_RIGHT - ROAD_LEFT;

// ============================================================
//  Procedural Sound (Web Audio API, no external files)
// ============================================================
class SoundMgr {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.muted = false;
    this.bgmGain = null;
    this.bgmNodes = [];
  }
  init() {
    if (this.ctx) return;
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.4;
      this.master.connect(this.ctx.destination);
    } catch (e) { /* ignore */ }
  }
  play(type) {
    if (this.muted || !this.ctx) return;
    switch (type) {
      case 'whip':       this._zap(900, 200, 'square', 0.4, 0.10); break;
      case 'hit':        this._zap(440, 180, 'triangle', 0.3, 0.08); break;
      case 'boom':       this._noise(0.3, 240, 1200); break;
      case 'damage':     this._zap(160, 90, 'sawtooth', 0.4, 0.18); break;
      case 'pickup':     this._beep([660, 990, 1320], 0.25, 0.06); break;
      case 'heart':      this._beep([880, 1320], 0.3, 0.10); break;
      case 'boost':      this._zap(220, 90, 'square', 0.4, 0.45); break;
      case 'kill':       this._beep([523, 659, 784, 1047], 0.3, 0.08); break;
      case 'victory':    this._beep([523, 659, 784, 1047, 1319], 0.4, 0.12); break;
      case 'defeat':     this._beep([392, 311, 247, 196], 0.4, 0.18); break;
      case 'stage':      this._beep([523, 698, 880], 0.35, 0.09); break;
      case 'combo':      this._zap(1500, 60, 'square', 0.25, 0.04); break;
    }
  }
  _zap(freq, freqEnd, type, vol, dur) {
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(20, freqEnd), t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g).connect(this.master);
    o.start(t); o.stop(t + dur + 0.02);
  }
  _beep(freqs, vol, durEach) {
    const t0 = this.ctx.currentTime;
    freqs.forEach((f, i) => {
      const t = t0 + i * durEach;
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.type = 'square';
      o.frequency.setValueAtTime(f, t);
      g.gain.setValueAtTime(vol, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + durEach);
      o.connect(g).connect(this.master);
      o.start(t); o.stop(t + durEach + 0.01);
    });
  }
  _noise(vol, durMs, filterFreq) {
    const t = this.ctx.currentTime;
    const dur = durMs / 1000;
    const buf = this.ctx.createBuffer(1, this.ctx.sampleRate * dur, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
    const src = this.ctx.createBufferSource(); src.buffer = buf;
    const filt = this.ctx.createBiquadFilter(); filt.type = 'lowpass'; filt.frequency.value = filterFreq;
    const g = this.ctx.createGain(); g.gain.value = vol;
    src.connect(filt).connect(g).connect(this.master);
    src.start(t);
  }
  startBGM() {
    if (!this.ctx || this.bgmNodes.length) return;
    this.bgmGain = this.ctx.createGain();
    this.bgmGain.gain.value = 0.12;
    this.bgmGain.connect(this.master);
    // Simple looping bass + drum pattern via interval
    const ctx = this.ctx;
    this.bgmInterval = setInterval(() => {
      if (this.muted) return;
      const t = ctx.currentTime;
      // Kick drum (low thump)
      const kick = ctx.createOscillator();
      const kg = ctx.createGain();
      kick.type = 'sine';
      kick.frequency.setValueAtTime(120, t);
      kick.frequency.exponentialRampToValueAtTime(40, t + 0.15);
      kg.gain.setValueAtTime(0.6, t);
      kg.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
      kick.connect(kg).connect(this.bgmGain);
      kick.start(t); kick.stop(t + 0.2);
      // Bass note (alternating)
      const bassNote = (this._bgmStep || 0) % 4;
      const bassFreq = [110, 110, 165, 147][bassNote];
      this._bgmStep = (this._bgmStep || 0) + 1;
      const bass = ctx.createOscillator();
      const bg = ctx.createGain();
      bass.type = 'sawtooth';
      bass.frequency.value = bassFreq;
      bg.gain.setValueAtTime(0.18, t + 0.05);
      bg.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
      const filt = ctx.createBiquadFilter(); filt.type = 'lowpass'; filt.frequency.value = 600;
      bass.connect(filt).connect(bg).connect(this.bgmGain);
      bass.start(t + 0.05); bass.stop(t + 0.55);
    }, 500);
  }
  stopBGM() {
    if (this.bgmInterval) { clearInterval(this.bgmInterval); this.bgmInterval = null; }
    if (this.bgmGain) { try { this.bgmGain.disconnect(); } catch (e) {} this.bgmGain = null; }
    this.bgmNodes = [];
  }
}
const sfx = new SoundMgr();

// ============================================================
//  Haptics (mobile vibration)
// ============================================================
function vibrate(ms) {
  if (navigator.vibrate) try { navigator.vibrate(ms); } catch (e) {}
}

// ============================================================
//  Chariot types
// ============================================================
const CHARIOT_DATA = {
  speed:   { id: 'speed',   name: '신속의 마차',  desc: '빠른 채찍 / HP 적음',     sprite: 'player', maxHp: 150, boostPower: 1.5, whipReach: 420, whipCooldown: 200, whipWidth: 24 },
  balance: { id: 'balance', name: '벤허의 마차',  desc: '균형 잡힌 정통파',         sprite: 'player', maxHp: 200, boostPower: 1.2, whipReach: 400, whipCooldown: 350, whipWidth: 24 },
  tank:    { id: 'tank',    name: '강철의 마차',  desc: '느린 채찍 / 폭 3배 / HP↑', sprite: 'player', maxHp: 280, boostPower: 1.0, whipReach: 380, whipCooldown: 600, whipWidth: 72 }
};

// ============================================================
//  Stages
// ============================================================
const STAGE_DATA = [
  null,
  { id: 1, name: '로마 경기장',   goal: 900,  rivalRate: 1800, obsRate: 1100, env: 'colosseum' },
  { id: 2, name: '모래밭 (사막)', goal: 1500, rivalRate: 1500, obsRate: 900,  env: 'desert' },
  { id: 3, name: '강 부변',       goal: 2100, rivalRate: 1200, obsRate: 750,  env: 'river' },
  { id: 4, name: '최종 결전',     goal: -1,   rivalRate: 2800, obsRate: 1200, env: 'colosseum', boss: true }
];

const OBS_KEYS = ['pixobs_rock', 'pixobs_log', 'pixobs_spike', 'pixobs_pillar', 'pixobs_woodspike', 'pixobs_debris'];

// ============================================================
//  Progression save (localStorage)
// ============================================================
const PROGRESS = {
  load() {
    let bps;
    try { bps = JSON.parse(localStorage.getItem('benhur_best_stages') || '[0,0,0,0]'); }
    catch (e) { bps = [0, 0, 0, 0]; }
    if (!Array.isArray(bps) || bps.length !== 4) bps = [0, 0, 0, 0];
    return {
      maxStage: parseInt(localStorage.getItem('benhur_max_stage') || '0', 10),
      bestPerStage: bps,
      best: parseInt(localStorage.getItem('benhur_best') || '0', 10)
    };
  },
  saveClear(stageNum, score) {
    const p = this.load();
    if (stageNum > p.maxStage) localStorage.setItem('benhur_max_stage', String(stageNum));
    p.bestPerStage[stageNum - 1] = Math.max(p.bestPerStage[stageNum - 1] || 0, score);
    localStorage.setItem('benhur_best_stages', JSON.stringify(p.bestPerStage));
    if (score > p.best) localStorage.setItem('benhur_best', String(score));
  },
  reset() {
    localStorage.removeItem('benhur_max_stage');
    localStorage.removeItem('benhur_best_stages');
    // 'benhur_best' kept for nostalgia
  }
};

// ============================================================
//  Story (per stage)
// ============================================================
const STORY = {
  1: '유다 벤허, 노예의 사슬을 끊고\n로마의 흙먼지 위로 다시 올라서다.',
  2: '모래폭풍 너머, 메살라의 부하들이\n그의 길을 가로막는다.',
  3: '강가의 진흙길.\n살아남는 자만이 메살라를 마주할 수 있다.',
  4: '콜로세움의 함성.\n마침내 그와 정면으로 맞선다.'
};

// ============================================================
//  Upgrades (run-scoped, applied on stage entry)
// ============================================================
const UPGRADE_DEFS = [
  { id: 'hp',    icon: '❤',  name: 'HP +30',           apply: u => { u.hpBonus    += 30;    }, baseCost: 400 },
  { id: 'whip',  icon: '⚔',  name: '채찍 데미지 +25%', apply: u => { u.whipMul    *= 1.25;  }, baseCost: 700 },
  { id: 'boost', icon: '🔥', name: '부스트 쿨 -20%',    apply: u => { u.boostCDMul *= 0.8;   }, baseCost: 500 },
  { id: 'combo', icon: '⏰', name: '콤보 시간 +1.5s',   apply: u => { u.comboBonus += 1500;  }, baseCost: 400 }
];
const UPGRADE_MAX = 3;

function newUpgradeState() {
  return {
    hpBonus: 0, whipMul: 1.0, boostCDMul: 1.0, comboBonus: 0,
    purchases: { hp: 0, whip: 0, boost: 0, combo: 0 }
  };
}
function upgradeCost(def, lvl) {
  return def.baseCost * Math.pow(2, lvl);
}

// ============================================================
//  Boot
// ============================================================
class BootScene extends Phaser.Scene {
  constructor() { super('Boot'); }
  preload() {
    const list = ['player', 'rival_brown', 'rival_black', 'rival_gray', 'boss'];
    list.forEach(k => this.load.image(k, `assets/sprites/${k}.png`));
    const w = this.scale.width, h = this.scale.height;
    const bar = this.add.graphics();
    bar.fillStyle(0x444, 1).fillRect(w*0.2, h*0.5, w*0.6, 8);
    this.load.on('progress', p => {
      bar.clear();
      bar.fillStyle(0x444, 1).fillRect(w*0.2, h*0.5, w*0.6, 8);
      bar.fillStyle(0xd4a04c, 1).fillRect(w*0.2, h*0.5, (w*0.6)*p, 8);
    });
  }
  create() {
    this.makePixelTextures();
    this.scene.start('Title');
  }

  makePixelTextures() {
    const px = (g, x, y, w, h, color) => g.fillStyle(color, 1).fillRect(x, y, w, h);
    const make = (key, w, h, drawFn) => {
      const g = this.make.graphics({ x: 0, y: 0, add: false });
      drawFn(g, px);
      g.generateTexture(key, w, h);
      g.destroy();
    };

    // Obstacles
    make('pixobs_rock', 36, 36, (g, p) => {
      p(g, 4, 30, 28, 4, 0x000000);
      p(g, 6, 4, 24, 28, 0x4a4a4a);
      p(g, 8, 6, 20, 24, 0x6a6a6a);
      p(g, 10, 8, 8, 8, 0x9a9a9a);
      p(g, 14, 14, 4, 12, 0x3a3a3a);
      p(g, 18, 12, 2, 4, 0x3a3a3a);
      p(g, 6, 6, 2, 2, 0x2a2a2a);
      p(g, 28, 6, 2, 2, 0x2a2a2a);
      p(g, 6, 28, 2, 2, 0x2a2a2a);
      p(g, 28, 28, 2, 2, 0x2a2a2a);
    });
    make('pixobs_log', 44, 22, (g, p) => {
      p(g, 2, 19, 40, 3, 0x000000);
      p(g, 2, 4, 40, 14, 0x6a3a18);
      p(g, 4, 6, 36, 10, 0x8a4a20);
      p(g, 6, 9, 32, 1, 0x5a2a10);
      p(g, 6, 13, 32, 1, 0x5a2a10);
      p(g, 2, 6, 4, 10, 0x4a2410);
      p(g, 38, 6, 4, 10, 0x4a2410);
      p(g, 3, 9, 2, 4, 0x6a3a18);
      p(g, 39, 9, 2, 4, 0x6a3a18);
    });
    make('pixobs_spike', 40, 40, (g, p) => {
      p(g, 2, 32, 36, 6, 0x3a2a18);
      p(g, 2, 36, 36, 2, 0x000000);
      [[4,6,8,26],[16,4,8,28],[28,6,8,26]].forEach(([x,y,w,h]) => {
        p(g, x, y, w, h, 0x8a8a8a);
        p(g, x+1, y, 2, h, 0xc0c0c0);
        p(g, x+2, y, 4, 4, 0x6a6a6a);
        p(g, x, y+h-2, w, 2, 0x4a4a4a);
      });
    });
    make('pixobs_pillar', 28, 52, (g, p) => {
      p(g, 2, 50, 24, 2, 0x000000);
      p(g, 2, 44, 24, 6, 0x5a4a3a);
      p(g, 4, 46, 20, 2, 0x7a6a5a);
      p(g, 6, 6, 16, 38, 0x8a7a6a);
      p(g, 8, 8, 12, 36, 0xa09080);
      p(g, 12, 16, 2, 18, 0x4a3a2a);
      p(g, 6, 4, 4, 6, 0x6a5a4a);
      p(g, 14, 0, 6, 8, 0x6a5a4a);
      p(g, 20, 6, 2, 4, 0x6a5a4a);
    });
    make('pixobs_woodspike', 48, 36, (g, p) => {
      p(g, 0, 22, 48, 12, 0x4a2a10);
      p(g, 2, 24, 44, 8, 0x6a3a18);
      for (let i = 0; i < 4; i++) {
        const x = 4 + i * 11;
        p(g, x+2, 8, 4, 16, 0x6a3a18);
        p(g, x+3, 8, 2, 16, 0x8a4a20);
        p(g, x+1, 4, 6, 4, 0x5a2a10);
        p(g, x+2, 0, 4, 4, 0x4a2010);
      }
    });
    make('pixobs_debris', 40, 28, (g, p) => {
      p(g, 2, 24, 36, 4, 0x000000);
      p(g, 4, 8, 16, 16, 0x6a6a6a);
      p(g, 6, 10, 12, 12, 0x8a8a8a);
      p(g, 8, 12, 4, 4, 0xa0a0a0);
      p(g, 22, 14, 10, 10, 0x6a6a6a);
      p(g, 24, 16, 6, 6, 0x8a8a8a);
      p(g, 32, 18, 6, 6, 0x5a5a5a);
    });

    // Mine
    make('pix_mine', 28, 28, (g, p) => {
      p(g, 4, 24, 20, 4, 0x000000);
      p(g, 4, 4, 20, 20, 0x1a1a1a);
      p(g, 6, 6, 16, 16, 0x3a2a2a);
      p(g, 8, 8, 12, 12, 0x5a3a3a);
      p(g, 12, 0, 4, 4, 0x4a3a2a);
      p(g, 12, 24, 4, 4, 0x4a3a2a);
      p(g, 0, 12, 4, 4, 0x4a3a2a);
      p(g, 24, 12, 4, 4, 0x4a3a2a);
      p(g, 12, 12, 4, 4, 0xff2020);
      p(g, 13, 13, 2, 2, 0xff8080);
    });

    // Boss orbiting blade (phase 4)
    make('pix_blade', 36, 36, (g, p) => {
      // X-shaped blade
      p(g, 16, 4, 4, 28, 0xa0a0a0);
      p(g, 4, 16, 28, 4, 0xa0a0a0);
      p(g, 17, 4, 2, 28, 0xe0e0e0);
      p(g, 4, 17, 28, 2, 0xe0e0e0);
      p(g, 14, 14, 8, 8, 0x6a3a18);
      p(g, 16, 16, 4, 4, 0xff4020);
    });

    // Whip particle
    make('pix_whip_part', 8, 4, (g, p) => {
      p(g, 0, 0, 8, 4, 0xf4d066);
      p(g, 1, 1, 6, 2, 0xfff4a0);
    });

    // Hit spark
    make('pix_spark', 12, 12, (g, p) => {
      p(g, 5, 0, 2, 12, 0xffffff);
      p(g, 0, 5, 12, 2, 0xffffff);
      p(g, 4, 4, 4, 4, 0xfff4a0);
    });

    // Pickups: heart, gem, shield, hourglass
    make('pix_heart', 28, 28, (g, p) => {
      p(g, 4, 24, 20, 4, 0x000000);
      // heart shape
      const r = 0xff4060, hi = 0xff90a0;
      p(g, 6, 6, 6, 4, r); p(g, 16, 6, 6, 4, r);
      p(g, 4, 8, 20, 8, r);
      p(g, 6, 16, 16, 4, r);
      p(g, 8, 20, 12, 2, r);
      p(g, 11, 22, 6, 2, r);
      p(g, 13, 24, 2, 2, r);
      // highlight
      p(g, 7, 7, 3, 3, hi);
    });
    make('pix_gem', 24, 28, (g, p) => {
      p(g, 4, 24, 16, 4, 0x000000);
      // diamond
      p(g, 8, 4, 8, 4, 0x40c0ff);
      p(g, 4, 8, 16, 4, 0x80e0ff);
      p(g, 4, 12, 16, 4, 0x40c0ff);
      p(g, 6, 16, 12, 2, 0x2080d0);
      p(g, 8, 18, 8, 2, 0x2080d0);
      p(g, 10, 20, 4, 2, 0x1060a0);
      // shine
      p(g, 6, 5, 2, 2, 0xffffff);
      p(g, 8, 8, 1, 1, 0xffffff);
    });
    make('pix_shield', 28, 30, (g, p) => {
      p(g, 4, 26, 20, 4, 0x000000);
      // golden shield
      p(g, 6, 4, 16, 4, 0xc89030);
      p(g, 4, 6, 20, 16, 0xe0a040);
      p(g, 6, 22, 16, 4, 0xc89030);
      p(g, 8, 26, 12, 2, 0xa07020);
      // cross
      p(g, 12, 8, 4, 14, 0x4a2a10);
      p(g, 8, 12, 12, 4, 0x4a2a10);
      // shine
      p(g, 7, 7, 2, 4, 0xfff0a0);
    });
    make('pix_hourglass', 22, 30, (g, p) => {
      p(g, 4, 26, 14, 4, 0x000000);
      p(g, 2, 2, 18, 4, 0xc89030);
      p(g, 2, 24, 18, 4, 0xc89030);
      // glass (top)
      p(g, 4, 6, 14, 8, 0x90c0e0);
      p(g, 6, 8, 10, 6, 0xc0e0ff);
      // narrow waist
      p(g, 9, 14, 4, 2, 0x90c0e0);
      // glass (bottom)
      p(g, 4, 16, 14, 8, 0x90c0e0);
      p(g, 6, 18, 10, 6, 0xc0e0ff);
      // sand
      p(g, 8, 20, 6, 4, 0xf4d066);
    });

    // Coin (drops occasionally from rivals)
    make('pix_coin', 20, 20, (g, p) => {
      p(g, 4, 16, 12, 4, 0x000000);
      p(g, 4, 4, 12, 12, 0xc89030);
      p(g, 6, 6, 8, 8, 0xf4d066);
      p(g, 5, 7, 1, 4, 0xfff4a0);
      p(g, 8, 8, 4, 4, 0xc89030);
    });

    // Floor textures
    make('pix_floor_arena', 64, 64, (g, p) => {
      p(g, 0, 0, 64, 64, 0xc89868);
      let s = 17;
      for (let i = 0; i < 28; i++) {
        s = (s * 9301 + 49297) % 233280;
        const x = (s >> 4) % 60, y = ((s >> 2) % 60);
        const c = (i % 3 === 0) ? 0xa07840 : 0xb88858;
        p(g, x, y, 2, 2, c);
      }
      p(g, 0, 31, 64, 2, 0x9a6838);
      p(g, 31, 0, 2, 31, 0x9a6838);
      p(g, 31, 33, 2, 31, 0x9a6838);
    });
    make('pix_floor_desert', 64, 64, (g, p) => {
      p(g, 0, 0, 64, 64, 0xd4a878);
      let s = 91;
      for (let i = 0; i < 36; i++) {
        s = (s * 9301 + 49297) % 233280;
        const x = (s >> 4) % 62, y = ((s >> 2) % 62);
        const c = (i % 4 === 0) ? 0xb08850 : 0xe0b888;
        p(g, x, y, 2, 2, c);
      }
    });
    make('pix_floor_river', 64, 64, (g, p) => {
      p(g, 0, 0, 64, 64, 0xa88858);
      let s = 47;
      for (let i = 0; i < 30; i++) {
        s = (s * 9301 + 49297) % 233280;
        const x = (s >> 4) % 62, y = ((s >> 2) % 62);
        const c = (i % 3 === 0) ? 0x6a8a40 : 0x988050;
        p(g, x, y, 2, 2, c);
      }
    });

    // Walls
    make('pix_wall_arena', 32, 64, (g, p) => {
      p(g, 0, 0, 32, 64, 0x4a3a28);
      for (let row = 0; row < 4; row++) {
        const off = (row % 2) * 8;
        for (let col = 0; col < 3; col++) {
          const x = (col * 12 + off) % 32;
          const y = row * 16;
          p(g, x, y, 11, 15, 0x7a6a4a);
          p(g, x+1, y+1, 9, 13, 0x9a8a6a);
          p(g, x+2, y+2, 3, 3, 0xb0a070);
        }
      }
    });
    make('pix_wall_desert', 32, 64, (g, p) => {
      p(g, 0, 0, 32, 64, 0x8a6838);
      for (let i = 0; i < 18; i++) {
        const x = (i * 7) % 30;
        const y = (i * 11) % 60;
        p(g, x, y, 2, 2, 0x6a5028);
        p(g, x+1, y+1, 1, 1, 0xa8804a);
      }
    });
    make('pix_wall_river', 32, 64, (g, p) => {
      p(g, 0, 0, 32, 64, 0x3a5a30);
      for (let i = 0; i < 22; i++) {
        const x = (i * 5) % 30;
        const y = (i * 13) % 60;
        p(g, x, y, 2, 4, 0x2a4a20);
        p(g, x+1, y, 1, 6, 0x6a8a40);
      }
    });

    // Dust particle
    make('pix_dust', 8, 8, (g, p) => {
      p(g, 1, 1, 6, 6, 0xc0a070);
      p(g, 2, 2, 4, 4, 0xe0c890);
    });

    // Water hazard (river)
    make('pix_water', 80, 56, (g, p) => {
      p(g, 0, 0, 80, 56, 0x2a5a80);
      p(g, 4, 4, 72, 48, 0x4080b0);
      p(g, 6, 6, 68, 44, 0x60a0d0);
      for (let i = 0; i < 14; i++) {
        const x = ((i * 11 + 3) % 70) + 4;
        const y = ((i * 7 + 5) % 42) + 6;
        p(g, x, y, 6, 1, 0x90c0e0);
        p(g, x + 1, y + 1, 4, 1, 0xc0e0ff);
      }
    });
  }
}

// ============================================================
//  Title
// ============================================================
class TitleScene extends Phaser.Scene {
  constructor() { super('Title'); }
  create() {
    sfx.init();
    this.add.rectangle(0, 0, GAME_W, GAME_H, 0x2a1a0a).setOrigin(0);
    const g = this.add.graphics();
    g.lineStyle(1, 0x4a3018, 0.5);
    for (let i = 0; i < 60; i++) {
      const y = Math.random() * GAME_H, x = Math.random() * GAME_W;
      g.lineBetween(x, y, x + 30, y + 5);
    }
    this.add.text(GAME_W/2, GAME_H*0.13, 'BEN-HUR', {
      fontFamily: 'Georgia', fontSize: '76px', color: '#f4d066',
      stroke: '#3a1a05', strokeThickness: 6, fontStyle: 'bold'
    }).setOrigin(0.5);
    this.add.text(GAME_W/2, GAME_H*0.21, '전차 레이싱', {
      fontFamily: 'Georgia', fontSize: '34px', color: '#d4a04c',
      stroke: '#3a1a05', strokeThickness: 4
    }).setOrigin(0.5);

    // Best score + progress
    const prog = PROGRESS.load();
    this.add.text(GAME_W/2, GAME_H*0.265, `BEST  ${prog.best}`, {
      fontFamily: 'Georgia', fontSize: '22px', color: '#f4d066', fontStyle: 'bold'
    }).setOrigin(0.5);
    this.add.text(GAME_W/2, GAME_H*0.305, `진행도  ${Math.min(prog.maxStage, 4)} / 4 스테이지 클리어`, {
      fontFamily: 'sans-serif', fontSize: '16px', color: '#a07c4c'
    }).setOrigin(0.5);
    if (prog.maxStage > 0) {
      const reset = this.add.text(GAME_W - 20, GAME_H - 20, '진행도 초기화', {
        fontFamily: 'sans-serif', fontSize: '12px', color: '#6a4828'
      }).setOrigin(1, 1).setInteractive({ useHandCursor: true });
      reset.on('pointerdown', () => {
        PROGRESS.reset();
        this.scene.restart();
      });
    }

    this.add.image(GAME_W/2, GAME_H*0.45, 'player').setScale(0.55);

    const btn = this.add.rectangle(GAME_W/2, GAME_H*0.72, 280, 80, 0xc8902c)
      .setStrokeStyle(4, 0x5a3008).setInteractive({ useHandCursor: true });
    this.add.text(GAME_W/2, GAME_H*0.72, '▶  START', {
      fontFamily: 'Georgia', fontSize: '36px', color: '#1a0e05', fontStyle: 'bold'
    }).setOrigin(0.5);
    btn.on('pointerdown', () => {
      btn.setFillStyle(0xa07020);
      sfx.play('pickup');
      this.time.delayedCall(120, () => this.scene.start('Select'));
    });

    // Sound toggle
    this.muteIcon = this.add.text(GAME_W - 30, 30, sfx.muted ? '🔇' : '🔊', {
      fontSize: '32px'
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    this.muteIcon.on('pointerdown', () => {
      sfx.muted = !sfx.muted;
      this.muteIcon.setText(sfx.muted ? '🔇' : '🔊');
    });

    this.add.text(GAME_W/2, GAME_H*0.84, '⚔️ 채찍 (Z/Space)   🔥 부스트 (Shift)', {
      fontFamily: 'sans-serif', fontSize: '18px', color: '#a07c4c'
    }).setOrigin(0.5);
    this.add.text(GAME_W/2, GAME_H*0.89, '🌪 사막 = 모래 미끄러짐   💧 강 = 물웅덩이 위험', {
      fontFamily: 'sans-serif', fontSize: '16px', color: '#a07c4c'
    }).setOrigin(0.5);
    this.add.text(GAME_W/2, GAME_H*0.94, '연속 처치 → 콤보 보너스   |   ❤️💎🛡️⏰ 픽업', {
      fontFamily: 'sans-serif', fontSize: '15px', color: '#a07c4c'
    }).setOrigin(0.5);
    this.add.text(GAME_W/2, GAME_H*0.98, '4 스테이지 + 메살라 4페이즈   |   v1.2', {
      fontFamily: 'sans-serif', fontSize: '13px', color: '#6a4828'
    }).setOrigin(0.5);
  }
}

// ============================================================
//  Chariot Selection
// ============================================================
class SelectScene extends Phaser.Scene {
  constructor() { super('Select'); }
  create() {
    this.add.rectangle(0, 0, GAME_W, GAME_H, 0x2a1a0a).setOrigin(0);
    this.add.text(GAME_W/2, 60, '마차 선택', {
      fontFamily: 'Georgia', fontSize: '38px', color: '#f4d066', fontStyle: 'bold',
      stroke: '#000', strokeThickness: 4
    }).setOrigin(0.5);

    const types = ['speed', 'balance', 'tank'];
    const yPos = [240, 480, 720];
    const colors = [0x40a0c0, 0xc89030, 0x8a4a30];

    types.forEach((id, i) => {
      const c = CHARIOT_DATA[id];
      const y = yPos[i];
      const card = this.add.rectangle(GAME_W/2, y, GAME_W - 60, 200, 0x1a0e05)
        .setStrokeStyle(4, colors[i]).setInteractive({ useHandCursor: true });
      this.add.image(GAME_W/2 - 140, y, c.sprite).setScale(0.32);
      this.add.text(GAME_W/2 + 30, y - 60, c.name, {
        fontFamily: 'Georgia', fontSize: '26px', color: '#f4d066', fontStyle: 'bold'
      }).setOrigin(0.5);
      this.add.text(GAME_W/2 + 30, y - 25, c.desc, {
        fontFamily: 'sans-serif', fontSize: '17px', color: '#fff'
      }).setOrigin(0.5);
      this.add.text(GAME_W/2 + 30, y + 8, `HP ${c.maxHp}  /  부스트 x${c.boostPower}`, {
        fontFamily: 'sans-serif', fontSize: '15px', color: '#80ff80'
      }).setOrigin(0.5);
      this.add.text(GAME_W/2 + 30, y + 35, `채찍  길이 ${c.whipReach}  /  폭 ${c.whipWidth*2}`, {
        fontFamily: 'sans-serif', fontSize: '15px', color: '#f4d066'
      }).setOrigin(0.5);
      this.add.text(GAME_W/2 + 30, y + 60, `채찍 쿨다운 ${c.whipCooldown}ms`, {
        fontFamily: 'sans-serif', fontSize: '14px', color: '#a0e0ff'
      }).setOrigin(0.5);
      card.on('pointerdown', () => {
        sfx.play('pickup');
        this.scene.start('StageSelect', { chariot: id });
      });
    });

    // Back button
    const back = this.add.text(GAME_W/2, GAME_H - 50, '◀  돌아가기', {
      fontFamily: 'sans-serif', fontSize: '20px', color: '#a07c4c'
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    back.on('pointerdown', () => this.scene.start('Title'));
  }
}

// ============================================================
//  Stage Select
// ============================================================
class StageSelectScene extends Phaser.Scene {
  constructor() { super('StageSelect'); }
  init(data) { this.chariot = data.chariot || 'balance'; }
  create() {
    const prog = PROGRESS.load();
    const maxUnlocked = Math.min(4, prog.maxStage + 1);

    this.add.rectangle(0, 0, GAME_W, GAME_H, 0x2a1a0a).setOrigin(0);
    this.add.text(GAME_W/2, 60, '스테이지 선택', {
      fontFamily: 'Georgia', fontSize: '38px', color: '#f4d066', fontStyle: 'bold',
      stroke: '#000', strokeThickness: 4
    }).setOrigin(0.5);
    this.add.text(GAME_W/2, 105, `해금  ${maxUnlocked} / 4   |   STAGE 2+ 진입 시 시작 점수 지급`, {
      fontFamily: 'sans-serif', fontSize: '14px', color: '#a07c4c'
    }).setOrigin(0.5);

    [1, 2, 3, 4].forEach(n => {
      const stage = STAGE_DATA[n];
      const i = n - 1;
      const col = i % 2, row = Math.floor(i / 2);
      const x = (col === 0) ? GAME_W/4 + 10 : GAME_W*3/4 - 10;
      const y = 200 + row * 290;
      const unlocked = n <= maxUnlocked;
      const stroke = unlocked ? 0xc89030 : 0x4a3a18;

      const card = this.add.rectangle(x, y, GAME_W/2 - 35, 250, 0x1a0e05)
        .setStrokeStyle(4, stroke);
      this.add.text(x, y - 95, `STAGE ${n}`, {
        fontFamily: 'Georgia', fontSize: '28px', color: unlocked ? '#f4d066' : '#6a4828', fontStyle: 'bold'
      }).setOrigin(0.5);
      this.add.text(x, y - 55, stage.name, {
        fontFamily: 'sans-serif', fontSize: '16px', color: unlocked ? '#fff' : '#6a4828'
      }).setOrigin(0.5);
      if (n === 4) {
        this.add.text(x, y - 30, '⚔ 보스 ⚔', {
          fontFamily: 'Georgia', fontSize: '14px', color: unlocked ? '#ff8040' : '#6a4828'
        }).setOrigin(0.5);
      }
      const best = prog.bestPerStage[i] || 0;
      this.add.text(x, y + 5, best > 0 ? `BEST  ${best}` : '미클리어', {
        fontFamily: 'sans-serif', fontSize: '15px', color: best > 0 ? '#80ff80' : '#6a4828'
      }).setOrigin(0.5);
      const startScore = (n - 1) * 800;
      if (unlocked && n > 1) {
        this.add.text(x, y + 35, `시작 점수 +${startScore}`, {
          fontFamily: 'sans-serif', fontSize: '13px', color: '#a0e0ff'
        }).setOrigin(0.5);
      }
      if (!unlocked) {
        this.add.text(x, y + 65, '🔒 LOCKED', {
          fontFamily: 'sans-serif', fontSize: '20px', color: '#6a4828', fontStyle: 'bold'
        }).setOrigin(0.5);
      } else {
        card.setInteractive({ useHandCursor: true });
        card.on('pointerdown', () => {
          sfx.play('pickup');
          sfx.startBGM();
          if (n === 1) {
            this.scene.start('Race', { stage: 1, score: 0, chariot: this.chariot, upgrades: newUpgradeState() });
          } else {
            this.scene.start('Shop', { stage: n, score: startScore, chariot: this.chariot, upgrades: newUpgradeState() });
          }
        });
      }
    });

    const back = this.add.text(GAME_W/2, GAME_H - 35, '◀  마차 다시 선택', {
      fontFamily: 'sans-serif', fontSize: '18px', color: '#a07c4c'
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    back.on('pointerdown', () => this.scene.start('Select'));
  }
}

// ============================================================
//  Shop (between stages)
// ============================================================
class ShopScene extends Phaser.Scene {
  constructor() { super('Shop'); }
  init(data) {
    this.stageNum = data.stage;
    this.score = data.score || 0;
    this.chariotId = data.chariot;
    this.upgrades = data.upgrades || newUpgradeState();
  }
  create() {
    const cfg = STAGE_DATA[this.stageNum];
    this.add.rectangle(0, 0, GAME_W, GAME_H, 0x2a1a0a).setOrigin(0);
    this.add.text(GAME_W/2, 50, '🛒  업그레이드 상점', {
      fontFamily: 'Georgia', fontSize: '32px', color: '#f4d066', fontStyle: 'bold',
      stroke: '#000', strokeThickness: 4
    }).setOrigin(0.5);
    this.add.text(GAME_W/2, 90, `다음:  STAGE ${this.stageNum} - ${cfg.name}`, {
      fontFamily: 'sans-serif', fontSize: '17px', color: '#fff'
    }).setOrigin(0.5);

    this.scoreText = this.add.text(GAME_W/2, 130, '', {
      fontFamily: 'Georgia', fontSize: '26px', color: '#f4d066', fontStyle: 'bold'
    }).setOrigin(0.5);

    this.cards = [];
    UPGRADE_DEFS.forEach((def, i) => {
      const col = i % 2, row = Math.floor(i / 2);
      const x = (col === 0) ? GAME_W/4 + 10 : GAME_W*3/4 - 10;
      const y = 250 + row * 200;
      this.makeCard(def, x, y);
    });

    const btn = this.add.rectangle(GAME_W/2, GAME_H - 70, 320, 76, 0xc8902c)
      .setStrokeStyle(4, 0x5a3008).setInteractive({ useHandCursor: true });
    this.add.text(GAME_W/2, GAME_H - 70, `▶  STAGE ${this.stageNum} 진입`, {
      fontFamily: 'Georgia', fontSize: '24px', color: '#1a0e05', fontStyle: 'bold'
    }).setOrigin(0.5);
    btn.on('pointerdown', () => {
      sfx.play('pickup');
      this.scene.start('Race', {
        stage: this.stageNum, score: this.score, chariot: this.chariotId, upgrades: this.upgrades
      });
    });

    this.refresh();
  }
  makeCard(def, x, y) {
    const card = this.add.rectangle(x, y, GAME_W/2 - 35, 170, 0x1a0e05)
      .setStrokeStyle(3, 0xc89030).setInteractive({ useHandCursor: true });
    this.add.text(x, y - 56, def.icon, { fontSize: '38px' }).setOrigin(0.5);
    this.add.text(x, y - 12, def.name, {
      fontFamily: 'sans-serif', fontSize: '15px', color: '#fff', fontStyle: 'bold', align: 'center', wordWrap: { width: GAME_W/2 - 50 }
    }).setOrigin(0.5);
    const lvlText = this.add.text(x, y + 22, '', {
      fontFamily: 'sans-serif', fontSize: '13px', color: '#80ff80'
    }).setOrigin(0.5);
    const costText = this.add.text(x, y + 52, '', {
      fontFamily: 'Georgia', fontSize: '20px', color: '#f4d066', fontStyle: 'bold'
    }).setOrigin(0.5);
    card.on('pointerdown', () => this.buy(def));
    this.cards.push({ def, card, lvlText, costText });
  }
  buy(def) {
    const lvl = this.upgrades.purchases[def.id];
    if (lvl >= UPGRADE_MAX) { sfx.play('damage'); return; }
    const cost = upgradeCost(def, lvl);
    if (this.score < cost) { sfx.play('damage'); return; }
    this.score -= cost;
    this.upgrades.purchases[def.id]++;
    def.apply(this.upgrades);
    sfx.play('combo');
    this.refresh();
  }
  refresh() {
    this.scoreText.setText(`SCORE  ${this.score}`);
    this.cards.forEach(({ def, card, lvlText, costText }) => {
      const lvl = this.upgrades.purchases[def.id];
      const dots = '●'.repeat(lvl) + '○'.repeat(UPGRADE_MAX - lvl);
      lvlText.setText(`${dots}  (${lvl}/${UPGRADE_MAX})`);
      if (lvl >= UPGRADE_MAX) {
        costText.setText('MAX');
        costText.setColor('#80ff80');
        card.setStrokeStyle(3, 0x80ff80);
      } else {
        const c = upgradeCost(def, lvl);
        const ok = this.score >= c;
        costText.setText(`${c}`);
        costText.setColor(ok ? '#f4d066' : '#a04030');
        card.setStrokeStyle(3, ok ? 0xc89030 : 0x6a3a18);
      }
    });
  }
}

// ============================================================
//  Race
// ============================================================
class RaceScene extends Phaser.Scene {
  constructor() { super('Race'); }

  init(data) {
    this.stageNum = data.stage || 1;
    this.cfg = STAGE_DATA[this.stageNum];
    this.chariotId = data.chariot || 'balance';
    this.chariot = CHARIOT_DATA[this.chariotId];
    this.gameOver = false;
    this.stageClear = false;
    this.score = data.score || 0;
    this.distance = 0;
    this.spawnTimers = [];

    // Combo
    this.combo = 0;
    this.comboTimer = 0;
    this.bestCombo = 0;

    // Boost
    this.boostActive = false;
    this.boostCooldown = 0;
    this.boostDuration = 0;

    // Cooldowns / env
    this.whipCooldown = 0;
    this.envSlowUntil = 0;
    this._wasBoostReady = true;

    // Upgrades — applied as effective stats
    this.upgrades = data.upgrades || newUpgradeState();
    this.effectiveMaxHp     = this.chariot.maxHp + this.upgrades.hpBonus;
    this.effectiveBoostCDMs = Math.round(8000 * this.upgrades.boostCDMul);
    this.effectiveWhipMul   = this.upgrades.whipMul;
    this.effectiveComboTime = 3000 + this.upgrades.comboBonus;
  }

  create() {
    const floorKey = this.cfg.env === 'desert' ? 'pix_floor_desert'
                   : this.cfg.env === 'river'  ? 'pix_floor_river'
                   : 'pix_floor_arena';
    const wallKey  = this.cfg.env === 'desert' ? 'pix_wall_desert'
                   : this.cfg.env === 'river'  ? 'pix_wall_river'
                   : 'pix_wall_arena';
    const outerColor = this.cfg.env === 'desert' ? 0x4a3018
                     : this.cfg.env === 'river'  ? 0x1a3018
                     : 0x2a1a0a;

    this.add.rectangle(0, 0, GAME_W, GAME_H, outerColor).setOrigin(0).setDepth(-3);
    this.sideDecorL = this.add.tileSprite(ROAD_LEFT/2, GAME_H/2, ROAD_LEFT - 6, GAME_H, wallKey).setDepth(-2);
    this.sideDecorR = this.add.tileSprite(GAME_W - ROAD_LEFT/2, GAME_H/2, ROAD_LEFT - 6, GAME_H, wallKey).setDepth(-2);
    this.road = this.add.tileSprite(GAME_W/2, GAME_H/2, ROAD_W, GAME_H, floorKey).setDepth(-1);

    this.add.rectangle(ROAD_LEFT - 4, 0, 6, GAME_H, 0x1a0d05).setOrigin(0).setDepth(0);
    this.add.rectangle(ROAD_RIGHT, 0, 6, GAME_H, 0x1a0d05).setOrigin(0).setDepth(0);

    this.stripes = [];
    for (let i = 0; i < 8; i++) {
      const s = this.add.rectangle(GAME_W/2, i * 130, 6, 50, 0xf4d066, 0.55).setDepth(1);
      this.stripes.push(s);
    }

    // Speed lines (initially hidden, shown during boost)
    this.speedLines = [];
    for (let i = 0; i < 16; i++) {
      const sl = this.add.rectangle(
        ROAD_LEFT + Math.random() * ROAD_W,
        Math.random() * GAME_H,
        2, 30, 0xffffff, 0
      ).setDepth(2);
      this.speedLines.push(sl);
    }

    // Player
    this.player = this.physics.add.image(GAME_W/2, GAME_H - 200, this.chariot.sprite).setScale(0.5).setDepth(10);
    this.player.body.setSize(this.player.width * 0.55, this.player.height * 0.7);
    this.player.maxHp = this.effectiveMaxHp;
    this.player.hp = this.effectiveMaxHp;
    this.player.invincibleUntil = 0;
    this.player.shieldUntil = 0;

    // Groups
    this.rivals = this.physics.add.group();
    this.obstacles = this.physics.add.group();
    this.enemyProjectiles = this.physics.add.group();
    this.pickups = this.physics.add.group();
    this.bossBlades = this.add.group();
    this.hazards = this.physics.add.group();

    // Spawns
    if (this.cfg.boss) {
      this.time.delayedCall(1500, () => this.spawnBoss());
    }
    this.spawnTimers.push(this.time.addEvent({
      delay: this.cfg.rivalRate, loop: true, callback: () => this.spawnRival()
    }));
    this.spawnTimers.push(this.time.addEvent({
      delay: this.cfg.obsRate, loop: true, callback: () => this.spawnObstacle()
    }));
    this.spawnTimers.push(this.time.addEvent({
      delay: 4500, loop: true, callback: () => this.spawnPickup()
    }));
    if (this.cfg.env === 'river') {
      this.spawnTimers.push(this.time.addEvent({
        delay: 3500, loop: true, callback: () => this.spawnHazard()
      }));
    }

    // Collisions
    this.physics.add.overlap(this.player, this.obstacles, (p,o) => this.hitObstacle(p,o));
    this.physics.add.overlap(this.player, this.rivals, (p,r) => this.bumpRival(p,r));
    this.physics.add.overlap(this.player, this.enemyProjectiles, (p,e) => this.hitByEnemyProjectile(p,e));
    this.physics.add.overlap(this.player, this.pickups, (p,it) => this.collectPickup(p,it));
    this.physics.add.overlap(this.player, this.hazards, (p,h) => this.hitHazard(p,h));

    this.createHUD();
    this.createActionButtons();
    this.showStageBanner();

    this.input.on('pointerdown', pt => this.onPointerDown(pt));
    this.input.on('pointermove', pt => this.onPointerMove(pt));
    this.input.on('pointerup',   pt => this.onPointerUp(pt));
    this.dragId = null;
    this.cursors = this.input.keyboard.createCursorKeys();
    this.keyZ = this.input.keyboard.addKey('Z');
    this.keySpace = this.input.keyboard.addKey('SPACE');
    this.keyShift = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SHIFT);

    // Time warp factor (for hourglass pickup)
    this.timeWarp = 1.0;
  }

  showStageBanner() {
    sfx.play('stage');
    const overlay = this.add.rectangle(0, 0, GAME_W, GAME_H, 0x000000, 0.85).setOrigin(0).setDepth(149);
    overlay.alpha = 0;
    this.tweens.add({ targets: overlay, alpha: 1, duration: 250 });

    const story = STORY[this.stageNum] || '';
    const storyText = this.add.text(GAME_W/2, GAME_H/2 - 110, story, {
      fontFamily: 'Georgia', fontSize: '22px', color: '#f4d066',
      stroke: '#000', strokeThickness: 3, align: 'center', lineSpacing: 10
    }).setOrigin(0.5).setDepth(151).setAlpha(0);
    this.tweens.add({ targets: storyText, alpha: 1, duration: 500, delay: 300 });

    const b = this.add.rectangle(GAME_W/2, GAME_H/2 + 60, GAME_W, 110, 0x1a0e05, 0.95).setDepth(150).setAlpha(0);
    const t1 = this.add.text(GAME_W/2, GAME_H/2 + 38, `STAGE ${this.stageNum}`, {
      fontFamily: 'Georgia', fontSize: '38px', color: '#f4d066', fontStyle: 'bold',
      stroke: '#000', strokeThickness: 4
    }).setOrigin(0.5).setDepth(151).setAlpha(0);
    const t2 = this.add.text(GAME_W/2, GAME_H/2 + 80, this.cfg.name, {
      fontFamily: 'Georgia', fontSize: '24px', color: '#fff'
    }).setOrigin(0.5).setDepth(151).setAlpha(0);
    this.tweens.add({ targets: [b, t1, t2], alpha: 1, duration: 400, delay: 1400 });

    this.tweens.add({
      targets: [overlay, storyText, b, t1, t2], alpha: 0, delay: 3000, duration: 500,
      onComplete: () => { overlay.destroy(); storyText.destroy(); b.destroy(); t1.destroy(); t2.destroy(); }
    });
  }

  createHUD() {
    this.hpBg = this.add.rectangle(20, 20, 220, 28, 0x000, 0.6).setOrigin(0).setDepth(100);
    this.hpFill = this.add.rectangle(24, 24, 212, 20, 0x40d060).setOrigin(0).setDepth(101);
    this.hpText = this.add.text(130, 34, '', {
      fontFamily: 'sans-serif', fontSize: '16px', color: '#fff', fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(102);

    this.scoreText = this.add.text(GAME_W - 20, 22, '', {
      fontFamily: 'Georgia', fontSize: '22px', color: '#f4d066', fontStyle: 'bold',
      stroke: '#3a1a05', strokeThickness: 3
    }).setOrigin(1, 0).setDepth(102);
    this.distText = this.add.text(GAME_W - 20, 54, '', {
      fontFamily: 'sans-serif', fontSize: '16px', color: '#d4a04c'
    }).setOrigin(1, 0).setDepth(102);

    this.progressBg = this.add.rectangle(GAME_W/2, 90, 360, 14, 0x000, 0.6).setDepth(100);
    this.progressFill = this.add.rectangle(GAME_W/2 - 178, 90, 4, 10, 0xf4d066).setOrigin(0, 0.5).setDepth(101);
    this.progressLabel = this.add.text(GAME_W/2, 90, '', {
      fontFamily: 'sans-serif', fontSize: '12px', color: '#fff', fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(102);

    // Combo display
    this.comboText = this.add.text(GAME_W/2, 140, '', {
      fontFamily: 'Georgia', fontSize: '36px', color: '#ff8040', fontStyle: 'bold',
      stroke: '#000', strokeThickness: 4
    }).setOrigin(0.5).setDepth(102).setAlpha(0);
  }

  createActionButtons() {
    // Whip button (right)
    const whipY = GAME_H - 110;
    this.whipBtn = this.add.circle(GAME_W - 110, whipY, 72, 0xc8402c, 0.9)
      .setStrokeStyle(5, 0xf4d066).setDepth(100).setInteractive({ useHandCursor: true });
    this.add.text(GAME_W - 110, whipY, '⚔️', { fontSize: '52px' }).setOrigin(0.5).setDepth(101);
    this.add.text(GAME_W - 110, whipY + 78, '채찍', {
      fontFamily: 'Georgia', fontSize: '18px', color: '#f4d066', fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(101);
    this.whipBtn.on('pointerdown', (pt,lx,ly,ev) => { ev.stopPropagation(); this.attackWhip(); });

    // Boost button (left)
    const boostY = GAME_H - 110;
    this.boostBtn = this.add.circle(110, boostY, 60, 0x4080c0, 0.9)
      .setStrokeStyle(5, 0xa0e0ff).setDepth(100).setInteractive({ useHandCursor: true });
    this.add.text(110, boostY, '🔥', { fontSize: '40px' }).setOrigin(0.5).setDepth(101);
    this.add.text(110, boostY + 78, '부스트', {
      fontFamily: 'Georgia', fontSize: '16px', color: '#a0e0ff', fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(101);
    // Boost gauge: track ring (faint) + fill ring (bright) + ready glow
    this.boostTrack = this.add.graphics().setDepth(101);
    this.boostTrack.lineStyle(8, 0x143040, 0.7);
    this.boostTrack.strokeCircle(110, boostY, 70);
    this.boostRing = this.add.graphics().setDepth(102);
    this.boostReadyGlow = this.add.circle(110, boostY, 78, 0xffff80, 0).setDepth(99);
    this.boostBtn.on('pointerdown', (pt,lx,ly,ev) => { ev.stopPropagation(); this.tryBoost(); });

    this.whipRing = this.add.graphics().setDepth(102);
  }

  // ---- Input ----
  onPointerDown(pt) {
    if (this.gameOver) {
      sfx.stopBGM();
      this.scene.start('Title');
      return;
    }
    if (this.stageClear) return;
    if (this.isOnButton(pt)) return;
    if (this.dragId !== null) return;
    this.dragId = pt.id;
    this.dragStartX = pt.x;
    this.dragStartPlayerX = this.player.x;
  }
  onPointerMove(pt) {
    if (this.dragId !== pt.id) return;
    if (this.gameOver || this.stageClear) return;
    const sx = GAME_W / this.scale.width;
    const dx = (pt.x - this.dragStartX) * sx;
    let nx = this.dragStartPlayerX + dx;
    nx = Phaser.Math.Clamp(nx, ROAD_LEFT + 40, ROAD_RIGHT - 40);
    this.player.x = nx;
  }
  onPointerUp(pt) { if (this.dragId === pt.id) this.dragId = null; }
  isOnButton(pt) {
    const sx = this.scale.width / GAME_W;
    const sy = this.scale.height / GAME_H;
    const wx = (GAME_W - 110) * sx, wy = (GAME_H - 110) * sy;
    const bx = 110 * sx, by = (GAME_H - 110) * sy;
    if (Phaser.Math.Distance.Between(pt.x, pt.y, wx, wy) < 80 * sx) return true;
    if (Phaser.Math.Distance.Between(pt.x, pt.y, bx, by) < 70 * sx) return true;
    return false;
  }

  // ---- Spawning ----
  spawnRival() {
    if (this.gameOver || this.stageClear) return;
    const types = ['rival_brown', 'rival_black', 'rival_gray'];
    const key = Phaser.Math.RND.pick(types);
    const x = Phaser.Math.Between(ROAD_LEFT + 50, ROAD_RIGHT - 50);
    const r = this.physics.add.image(x, -200, key).setScale(0.45).setDepth(8);
    r.body.setSize(r.width * 0.55, r.height * 0.65);
    r.kind = 'rival';
    if (key === 'rival_brown') {
      r.hp = 22; r.aiType = 'speed'; r.scoreValue = 80; r.mineRate = 2200;
    } else if (key === 'rival_black') {
      r.hp = 42; r.aiType = 'tank'; r.scoreValue = 120; r.mineRate = 1800;
    } else {
      r.hp = 32; r.aiType = 'rammer'; r.scoreValue = 100; r.mineRate = 1500;
    }
    r.maxHp = r.hp;
    r.targetX = x;
    r.mineCooldown = r.mineRate;
    r.hpBarBg = this.add.rectangle(r.x, r.y - 70, 50, 5, 0x000, 0.6).setDepth(8.5);
    r.hpBarFill = this.add.rectangle(r.x - 24, r.y - 70, 48, 3, 0xff6060).setOrigin(0, 0.5).setDepth(8.6);
    this.rivals.add(r);
  }

  spawnBoss() {
    const x = GAME_W / 2;
    const b = this.physics.add.image(x, -250, 'boss').setScale(0.55).setDepth(9);
    b.body.setSize(b.width * 0.6, b.height * 0.7);
    b.kind = 'boss';
    b.hp = 525; b.maxHp = 525;
    b.aiType = 'boss';
    b.scoreValue = 5000;
    b.phase = 1;
    b.targetX = x;
    b.attackCooldown = 1800;
    b.spearCooldown = 5000;
    b.bladeSpawnDone = false;
    this.rivals.add(b);
    this.boss = b;
    this.bossHpBg = this.add.rectangle(GAME_W/2, 130, 380, 22, 0x000, 0.7).setDepth(100);
    this.bossHpFill = this.add.rectangle(GAME_W/2 - 188, 130, 376, 16, 0xd44040).setOrigin(0, 0.5).setDepth(101);
    this.bossLabel = this.add.text(GAME_W/2, 130, '⚔ MESSALA ⚔', {
      fontFamily: 'Georgia', fontSize: '14px', color: '#fff', fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(102);

    // Camera zoom in/out for dramatic intro
    sfx.play('boost');
    this.cameras.main.zoomTo(1.15, 400, 'Sine.easeInOut', false);
    this.time.delayedCall(900, () => this.cameras.main.zoomTo(1, 600, 'Sine.easeInOut'));
  }

  spawnObstacle() {
    if (this.gameOver || this.stageClear) return;
    const key = Phaser.Math.RND.pick(OBS_KEYS);
    const x = Phaser.Math.Between(ROAD_LEFT + 35, ROAD_RIGHT - 35);
    const o = this.physics.add.image(x, -60, key).setDepth(7);
    o.body.setSize(o.width * 0.7, o.height * 0.7);
    o.kind = 'obstacle';
    o.dmg = (key === 'pixobs_spike' || key === 'pixobs_woodspike') ? 28 : 16;
    this.obstacles.add(o);
  }

  spawnPickup() {
    if (this.gameOver || this.stageClear) return;
    const types = ['heart', 'gem', 'shield', 'hourglass'];
    const weights = [3, 5, 1, 1];
    let total = weights.reduce((a,b)=>a+b);
    let r = Math.random() * total, idx = 0;
    for (let i = 0; i < weights.length; i++) {
      if (r < weights[i]) { idx = i; break; }
      r -= weights[i];
    }
    const type = types[idx];
    const key = 'pix_' + type;
    const x = Phaser.Math.Between(ROAD_LEFT + 40, ROAD_RIGHT - 40);
    const it = this.physics.add.image(x, -40, key).setDepth(6);
    it.body.setSize(it.width * 0.7, it.height * 0.7);
    it.pickupType = type;
    it.kind = 'pickup';
    // gentle bobbing
    this.tweens.add({ targets: it, scale: 1.15, duration: 500, yoyo: true, repeat: -1 });
    this.pickups.add(it);
  }

  // ---- Combo ----
  addCombo() {
    this.combo++;
    if (this.combo > this.bestCombo) this.bestCombo = this.combo;
    this.comboTimer = this.effectiveComboTime;
    sfx.play('combo');
    this.showComboLabel();
  }
  resetCombo() {
    if (this.combo > 0) {
      this.combo = 0;
      this.comboTimer = 0;
      this.comboText.setAlpha(0);
    }
  }
  showComboLabel() {
    if (this.combo < 2) return;
    const titles = ['', '', 'NICE!', 'GREAT!', 'AWESOME!', 'AMAZING!', 'INSANE!', 'GODLIKE!'];
    const title = titles[Math.min(this.combo, titles.length - 1)];
    this.comboText.setText(`x${this.combo}  ${title}`);
    this.comboText.setAlpha(1);
    this.comboText.setScale(1.3);
    this.tweens.add({ targets: this.comboText, scale: 1, duration: 200, ease: 'Back.easeOut' });
  }
  comboMultiplier() {
    return 1 + Math.min(this.combo, 10) * 0.2;
  }

  // ---- Boost ----
  tryBoost() {
    if (this.gameOver || this.stageClear) return;
    if (this.boostCooldown > 0 || this.boostActive) return;
    this.boostActive = true;
    this.boostDuration = 1500 * this.chariot.boostPower;
    this.boostCooldown = this.effectiveBoostCDMs;
    sfx.play('boost');
    vibrate(80);
    this.player.invincibleUntil = this.time.now + this.boostDuration;
    // Visual: glow ring + flash player
    const ring = this.add.circle(this.player.x, this.player.y, 80, 0xa0e0ff, 0.4).setDepth(11);
    this.tweens.add({ targets: ring, scale: 2.5, alpha: 0, duration: 600, onComplete: () => ring.destroy() });
    // Flash player blue tint
    this.player.setTint(0xa0e0ff);
    this.time.delayedCall(this.boostDuration, () => { if (this.player.active) this.player.clearTint(); });
  }

  // ---- Combat ----
  attackWhip() {
    if (this.gameOver || this.stageClear) return;
    if (this.whipCooldown > 0) return;
    this.whipCooldown = this.chariot.whipCooldown;
    sfx.play('whip');

    const px = this.player.x;
    const py = this.player.y - 60;
    const reach = this.chariot.whipReach;
    const halfWidth = this.chariot.whipWidth;

    const glow = this.add.rectangle(px, py, halfWidth * 2.5, reach, 0xf4d066, 0.45)
      .setOrigin(0.5, 1).setDepth(11);
    glow.scaleY = 0;
    this.tweens.add({
      targets: glow, scaleY: 1, duration: 90,
      onComplete: () => this.tweens.add({
        targets: glow, alpha: 0, duration: 250, onComplete: () => glow.destroy()
      })
    });
    const core = this.add.rectangle(px, py, Math.max(8, halfWidth * 0.3), reach, 0xffffff, 0.95)
      .setOrigin(0.5, 1).setDepth(12);
    core.scaleY = 0;
    this.tweens.add({
      targets: core, scaleY: 1, duration: 70,
      onComplete: () => this.tweens.add({
        targets: core, alpha: 0, duration: 220, onComplete: () => core.destroy()
      })
    });

    this.time.delayedCall(70, () => {
      const tipY = py - reach;
      for (let i = 0; i < 10; i++) {
        const ang = Math.random() * Math.PI * 2;
        const sp = 60 + Math.random() * 80;
        const part = this.add.image(px, tipY, 'pix_whip_part').setDepth(13).setScale(1.5);
        part.setRotation(ang);
        this.tweens.add({
          targets: part, x: px + Math.cos(ang) * sp, y: tipY + Math.sin(ang) * sp,
          alpha: 0, duration: 260, onComplete: () => part.destroy()
        });
      }
    });

    let hitCount = 0;

    this.rivals.getChildren().forEach(r => {
      const halfH = (r.kind === 'boss') ? 120 : 30;
      if (Math.abs(r.x - px) < halfWidth + 30 && (r.y + halfH) > py - reach && (r.y - halfH) < py + 30) {
        const baseDmg = (r.kind === 'boss') ? 14 : 24;
        const dmg = Math.round(baseDmg * this.effectiveWhipMul);
        r.hp -= dmg;
        this.flash(r);
        this.spawnHitSpark(r.x, r.y);
        this.spawnDamageNumber(r.x, r.y - 30, dmg, '#ffd040');
        hitCount++;
        sfx.play('hit');
        if (r.hp <= 0) this.killRival(r);
      }
    });
    // (Whip cannot break obstacles — only enemies, mines, blades.)
    this.enemyProjectiles.getChildren().forEach(m => {
      if (Math.abs(m.x - px) < halfWidth + 30 && m.y > py - reach && m.y < py + 30) {
        this.detonateMine(m, false);
        this.score += Math.floor(20 * this.comboMultiplier());
        hitCount++;
      }
    });
    // Also hit boss blades
    this.bossBlades.getChildren().forEach(bl => {
      if (Math.abs(bl.x - px) < halfWidth + 30 && bl.y > py - reach && bl.y < py + 30) {
        this.spawnHitSpark(bl.x, bl.y);
        bl.hp = (bl.hp || 30) - 14;
        if (bl.hp <= 0) {
          this.score += Math.floor(50 * this.comboMultiplier());
          this.spawnDamageNumber(bl.x, bl.y, '+50', '#80ff80');
          bl.destroy();
        }
        hitCount++;
      }
    });

    this.cameras.main.shake(hitCount > 0 ? 160 : 60, hitCount > 0 ? 0.008 : 0.003);
    if (hitCount > 0) vibrate(30);
  }

  // ---- River hazards ----
  spawnHazard() {
    if (this.gameOver || this.stageClear) return;
    const x = Phaser.Math.Between(ROAD_LEFT + 60, ROAD_RIGHT - 60);
    const h = this.physics.add.image(x, -60, 'pix_water').setDepth(0.5);
    h.body.setSize(70, 50);
    h.kind = 'water';
    h.dmg = 5;
    h.lastHit = 0;
    this.hazards.add(h);
  }

  hitHazard(player, h) {
    if (this.time.now < (h.lastHit || 0) + 600) return;
    h.lastHit = this.time.now;
    if (this.time.now < player.invincibleUntil) {
      this.spawnDamageNumber(player.x, player.y - 30, '🛡', '#a0e0ff');
      return;
    }
    this.player.hp -= h.dmg;
    sfx.play('damage');
    this.spawnDamageNumber(player.x, player.y - 30, `-${h.dmg} 💧`, '#a0e0ff');
    this.envSlowUntil = this.time.now + 700;
    this.flash(player);
    if (this.player.hp <= 0) { this.player.hp = 0; this.endGame(); }
  }

  // ---- Mines ----
  dropMine(x, y, opts = {}) {
    const m = this.physics.add.image(x, y, 'pix_mine').setDepth(7);
    m.body.setSize(20, 20);
    m.kind = 'mine';
    m.dmg = opts.dmg || 22;
    m.scrollSpeed = opts.scrollSpeed || 380;
    m.body.setVelocityY(m.scrollSpeed);
    m.blinkTween = this.tweens.add({
      targets: m, alpha: 0.55, duration: 350, yoyo: true, repeat: -1
    });
    this.enemyProjectiles.add(m);
    return m;
  }

  detonateMine(m, hitPlayer) {
    if (!m.active) return;
    sfx.play('boom');
    const x = m.x, y = m.y;
    const e = this.add.circle(x, y, 30, 0xff8030, 0.95).setDepth(12);
    this.tweens.add({ targets: e, scale: 3, alpha: 0, duration: 360, onComplete: () => e.destroy() });
    for (let i = 0; i < 6; i++) {
      const ang = Math.random() * Math.PI * 2;
      const sp = 80 + Math.random() * 100;
      const part = this.add.image(x, y, 'pix_whip_part').setDepth(13).setRotation(ang);
      this.tweens.add({
        targets: part, x: x + Math.cos(ang) * sp, y: y + Math.sin(ang) * sp,
        alpha: 0, duration: 380, onComplete: () => part.destroy()
      });
    }
    if (m.blinkTween) m.blinkTween.stop();
    m.destroy();
    this.cameras.main.shake(120, hitPlayer ? 0.01 : 0.005);
    if (hitPlayer) vibrate(120);
  }

  bossSpear() {
    if (!this.boss || !this.boss.active) return;
    for (let i = -1; i <= 1; i++) {
      const offX = i * 90;
      this.dropMine(this.boss.x + offX, this.boss.y + 50, { dmg: 30 });
    }
    const w = this.add.rectangle(this.boss.x, GAME_H/2, 6, GAME_H, 0xff4040, 0.5).setDepth(2);
    this.tweens.add({ targets: w, alpha: 0, duration: 350, onComplete: () => w.destroy() });
  }

  // ---- Boss phase 4 blades ----
  spawnBossBlades() {
    if (!this.boss) return;
    const count = 4;
    for (let i = 0; i < count; i++) {
      const bl = this.add.image(this.boss.x, this.boss.y, 'pix_blade').setDepth(11);
      this.physics.add.existing(bl);
      bl.body.setSize(28, 28);
      bl.angleOff = (Math.PI * 2 * i) / count;
      bl.kind = 'blade';
      bl.hp = 30;
      bl.dmg = 25;
      this.bossBlades.add(bl);
    }
    // Add overlap
    this.physics.add.overlap(this.player, this.bossBlades, (p, bl) => {
      if (this.time.now < this.player.invincibleUntil) return;
      this.takeDamage(bl.dmg);
      this.spawnHitSpark(p.x, p.y);
    });
    // Announce
    const t = this.add.text(GAME_W/2, GAME_H/2, 'PHASE 4!\n분노의 칼날', {
      fontFamily: 'Georgia', fontSize: '36px', color: '#ff4040', fontStyle: 'bold',
      stroke: '#000', strokeThickness: 5, align: 'center'
    }).setOrigin(0.5).setDepth(150);
    sfx.play('damage');
    this.tweens.add({
      targets: t, alpha: 0, scale: 1.5, duration: 1200,
      onComplete: () => t.destroy()
    });
  }

  // ---- Hit handlers ----
  spawnHitSpark(x, y) {
    const s = this.add.image(x, y, 'pix_spark').setDepth(13).setScale(2);
    this.tweens.add({
      targets: s, alpha: 0, scale: 4, angle: 90, duration: 250,
      onComplete: () => s.destroy()
    });
  }

  spawnDamageNumber(x, y, value, color) {
    const text = (typeof value === 'number') ? `-${value}` : value;
    const t = this.add.text(x, y, text, {
      fontFamily: 'Georgia', fontSize: '24px', color: color,
      stroke: '#000', strokeThickness: 4, fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(14);
    this.tweens.add({
      targets: t, y: y - 50, alpha: 0, duration: 700,
      onComplete: () => t.destroy()
    });
  }

  killRival(r) {
    sfx.play('kill');
    const baseScore = r.scoreValue;
    const mult = this.comboMultiplier();
    const finalScore = Math.floor(baseScore * mult);
    this.score += finalScore;
    this.addCombo();

    const isBoss = (r.kind === 'boss');
    const c = this.add.circle(r.x, r.y, isBoss ? 60 : 30, 0xff8030, 0.9).setDepth(12);
    this.tweens.add({
      targets: c, scale: isBoss ? 5 : 3, alpha: 0,
      duration: isBoss ? 800 : 400, onComplete: () => c.destroy()
    });
    this.spawnDamageNumber(r.x, r.y - 50, `+${finalScore}`, '#80ff80');

    if (r.hpBarBg) r.hpBarBg.destroy();
    if (r.hpBarFill) r.hpBarFill.destroy();
    r.destroy();
    this.cameras.main.shake(isBoss ? 400 : 120, isBoss ? 0.012 : 0.006);
    if (isBoss) {
      sfx.play('victory');
      vibrate([120, 60, 120, 60, 200]);
      if (this.bossHpBg) this.bossHpBg.destroy();
      if (this.bossHpFill) this.bossHpFill.destroy();
      if (this.bossLabel) this.bossLabel.destroy();
      this.bossBlades.getChildren().forEach(b => b.destroy());
      this.boss = null;
      this.completeStage(true);
    }
  }

  hitObstacle(player, obs) {
    if (obs.hit || this.time.now < player.invincibleUntil) return;
    obs.hit = true;
    if (this.boostActive) {
      // Ram through during boost
      this.spawnHitSpark(obs.x, obs.y);
      this.spawnDamageNumber(obs.x, obs.y, 'CRUSH!', '#a0e0ff');
      this.score += Math.floor(15 * this.comboMultiplier());
      sfx.play('hit');
    } else {
      this.takeDamage(obs.dmg);
      this.spawnHitSpark(obs.x, obs.y);
    }
    this.tweens.add({
      targets: obs, scale: obs.scale * 0.5, alpha: 0, duration: 200,
      onComplete: () => obs.destroy()
    });
  }

  bumpRival(player, rival) {
    if (this.time.now < player.invincibleUntil) return;
    if (rival.bumped) return;
    rival.bumped = true;
    if (this.boostActive) {
      // Boost ram → instant kill rival, no damage
      this.spawnDamageNumber(rival.x, rival.y, 'RAMMED!', '#a0e0ff');
      this.score += Math.floor(rival.scoreValue * 0.7);
      this.killRival(rival);
      return;
    }
    const dmg = rival.kind === 'boss' ? 28 : 14;
    this.takeDamage(dmg);
    const dir = rival.x < player.x ? -1 : 1;
    this.tweens.add({ targets: rival, x: rival.x + dir * 50, duration: 200 });
    this.time.delayedCall(500, () => { if (rival.active) rival.bumped = false; });
  }

  hitByEnemyProjectile(player, proj) {
    if (this.time.now < player.invincibleUntil) return;
    this.takeDamage(proj.dmg);
    this.detonateMine(proj, true);
  }

  collectPickup(player, it) {
    sfx.play(it.pickupType === 'heart' ? 'heart' : 'pickup');
    vibrate(40);
    switch (it.pickupType) {
      case 'heart':
        this.player.hp = Math.min(this.player.maxHp, this.player.hp + 30);
        this.spawnDamageNumber(it.x, it.y, '+30 HP', '#80ff80');
        break;
      case 'gem':
        const v = Math.floor(200 * this.comboMultiplier());
        this.score += v;
        this.spawnDamageNumber(it.x, it.y, `+${v}`, '#80c0ff');
        break;
      case 'shield':
        this.player.shieldUntil = this.time.now + 4000;
        this.player.invincibleUntil = Math.max(this.player.invincibleUntil, this.player.shieldUntil);
        this.spawnDamageNumber(it.x, it.y, 'SHIELD!', '#f4d066');
        break;
      case 'hourglass':
        this.timeWarp = 0.4;
        this.spawnDamageNumber(it.x, it.y, 'SLOW TIME!', '#a0e0ff');
        this.time.delayedCall(3000, () => { this.timeWarp = 1.0; });
        break;
    }
    it.destroy();
  }

  takeDamage(amount) {
    this.player.hp -= amount;
    sfx.play('damage');
    vibrate(80);
    this.flash(this.player);
    this.spawnDamageNumber(this.player.x, this.player.y - 30, amount, '#ff4040');
    this.cameras.main.shake(150, 0.008);
    this.player.invincibleUntil = this.time.now + 900;
    this.tweens.add({
      targets: this.player, alpha: 0.3, duration: 100, yoyo: true, repeat: 4,
      onComplete: () => { if (this.player.active) this.player.alpha = 1; }
    });
    this.resetCombo();
    if (this.player.hp <= 0) {
      this.player.hp = 0;
      this.endGame();
    }
  }

  flash(obj) {
    const orig = obj.tintTopLeft;
    obj.setTint(0xff5050);
    this.time.delayedCall(120, () => { if (obj.active) obj.clearTint(); });
  }

  // ---- Stage flow ----
  completeStage() {
    if (this.stageClear) return;
    this.stageClear = true;
    this.spawnTimers.forEach(t => t.remove());
    sfx.play(this.stageNum === 4 ? 'victory' : 'stage');

    const bonus = Math.floor(this.distance) + (this.player.hp * 5) + (this.bestCombo * 50);
    this.score += bonus;

    // Save progression (max stage + per-stage best + best)
    PROGRESS.saveClear(this.stageNum, this.score);

    this.add.rectangle(0, 0, GAME_W, GAME_H, 0x000, 0.7).setOrigin(0).setDepth(200);
    const isFinal = (this.stageNum === 4);

    this.add.text(GAME_W/2, GAME_H/2 - 130, isFinal ? '🏆 VICTORY 🏆' : 'STAGE CLEAR', {
      fontFamily: 'Georgia', fontSize: isFinal ? '56px' : '48px', color: '#f4d066',
      stroke: '#000', strokeThickness: 5, fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(201);

    this.add.text(GAME_W/2, GAME_H/2 - 60, `Stage ${this.stageNum} - ${this.cfg.name}`, {
      fontFamily: 'Georgia', fontSize: '22px', color: '#fff'
    }).setOrigin(0.5).setDepth(201);

    this.add.text(GAME_W/2, GAME_H/2 - 10, `점수: ${this.score}`, {
      fontFamily: 'sans-serif', fontSize: '28px', color: '#f4d066'
    }).setOrigin(0.5).setDepth(201);

    this.add.text(GAME_W/2, GAME_H/2 + 25, `보너스 +${bonus}  |  최고 콤보 x${this.bestCombo}`, {
      fontFamily: 'sans-serif', fontSize: '18px', color: '#a0e0a0'
    }).setOrigin(0.5).setDepth(201);

    if (isFinal) {
      this.add.text(GAME_W/2, GAME_H/2 + 90, '벤허, 메살라를 무찔렀다!', {
        fontFamily: 'Georgia', fontSize: '22px', color: '#fff'
      }).setOrigin(0.5).setDepth(201);
      this.add.text(GAME_W/2, GAME_H/2 + 160, '👆 화면 터치 → 타이틀로', {
        fontFamily: 'sans-serif', fontSize: '20px', color: '#fff'
      }).setOrigin(0.5).setDepth(201);
      this.input.once('pointerdown', () => {
        sfx.stopBGM();
        this.scene.start('Title');
      });
    } else {
      const btn = this.add.rectangle(GAME_W/2, GAME_H/2 + 130, 280, 70, 0xc8902c)
        .setStrokeStyle(4, 0x5a3008).setInteractive({ useHandCursor: true }).setDepth(201);
      this.add.text(GAME_W/2, GAME_H/2 + 130, `🛒  상점 → STAGE ${this.stageNum + 1}`, {
        fontFamily: 'Georgia', fontSize: '22px', color: '#1a0e05', fontStyle: 'bold'
      }).setOrigin(0.5).setDepth(202);
      btn.on('pointerdown', () => {
        this.scene.start('Shop', {
          stage: this.stageNum + 1, score: this.score,
          chariot: this.chariotId, upgrades: this.upgrades
        });
      });
    }
  }

  endGame() {
    this.gameOver = true;
    this.spawnTimers.forEach(t => t.remove());
    sfx.play('defeat');
    vibrate([200, 100, 400]);

    const best = parseInt(localStorage.getItem('benhur_best') || '0', 10);
    if (this.score > best) localStorage.setItem('benhur_best', String(this.score));
    // Per-stage best updates even on defeat
    try {
      const arr = JSON.parse(localStorage.getItem('benhur_best_stages') || '[0,0,0,0]');
      const idx = this.stageNum - 1;
      if (Array.isArray(arr) && this.score > (arr[idx] || 0)) {
        arr[idx] = this.score;
        localStorage.setItem('benhur_best_stages', JSON.stringify(arr));
      }
    } catch (e) {}

    this.add.rectangle(0, 0, GAME_W, GAME_H, 0x000, 0.6).setOrigin(0).setDepth(200);
    this.add.text(GAME_W/2, GAME_H/2 - 80, 'DEFEATED', {
      fontFamily: 'Georgia', fontSize: '64px', color: '#d44040',
      stroke: '#000', strokeThickness: 6, fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(201);
    this.add.text(GAME_W/2, GAME_H/2 - 10, `Stage ${this.stageNum}`, {
      fontFamily: 'Georgia', fontSize: '24px', color: '#fff'
    }).setOrigin(0.5).setDepth(201);
    this.add.text(GAME_W/2, GAME_H/2 + 30, `점수 ${this.score}`, {
      fontFamily: 'sans-serif', fontSize: '24px', color: '#f4d066'
    }).setOrigin(0.5).setDepth(201);
    this.add.text(GAME_W/2, GAME_H/2 + 65, `최고 콤보 x${this.bestCombo}`, {
      fontFamily: 'sans-serif', fontSize: '20px', color: '#ff8040'
    }).setOrigin(0.5).setDepth(201);
    this.add.text(GAME_W/2, GAME_H/2 + 140, '👆 화면을 터치해 타이틀로', {
      fontFamily: 'sans-serif', fontSize: '22px', color: '#fff'
    }).setOrigin(0.5).setDepth(201);
  }

  // ---- HUD ----
  updateHUD() {
    const r = Math.max(0, this.player.hp / this.player.maxHp);
    this.hpFill.scaleX = r;
    this.hpFill.setFillStyle(r > 0.5 ? 0x40d060 : (r > 0.25 ? 0xd4a040 : 0xd44040));
    this.hpText.setText(`${Math.max(0, Math.ceil(this.player.hp))} / ${this.player.maxHp}`);
    this.scoreText.setText(`SCORE ${this.score}`);
    this.distText.setText(`Stage ${this.stageNum}  |  ${Math.floor(this.distance)} m  |  CB x${this.combo}`);

    const goal = this.cfg.goal > 0 ? this.cfg.goal : (this.boss ? this.boss.maxHp : 1);
    const cur  = this.cfg.goal > 0 ? this.distance : (this.boss ? (this.boss.maxHp - this.boss.hp) : 0);
    const ratio = Math.min(1, cur / goal);
    this.progressFill.scaleX = ratio * 89;
    this.progressLabel.setText(this.cfg.goal > 0
      ? `${Math.floor(this.distance)} / ${this.cfg.goal} m`
      : (this.boss ? `BOSS HP ${Math.max(0, Math.ceil(this.boss.hp))} / ${this.boss.maxHp}` : '...'));

    if (this.bossHpFill && this.boss && this.boss.active) {
      this.bossHpFill.scaleX = Math.max(0, this.boss.hp / this.boss.maxHp);
    }

    // Boost gauge: thick fill ring around button
    this.boostRing.clear();
    const cx = 110, cy = GAME_H - 110;
    if (this.boostActive) {
      // Active: fully lit ring + inner pulse
      this.boostRing.lineStyle(8, 0xffd060, 1);
      this.boostRing.strokeCircle(cx, cy, 70);
      this.boostBtn.fillAlpha = 1.0;
      this.boostBtn.setStrokeStyle(5, 0xffd060);
    } else if (this.boostCooldown > 0) {
      // Charging: fill arc clockwise from top
      const ratio = 1 - this.boostCooldown / this.effectiveBoostCDMs;
      this.boostRing.lineStyle(8, 0xa0e0ff, 1);
      this.boostRing.beginPath();
      this.boostRing.arc(cx, cy, 70, -Math.PI/2, -Math.PI/2 + Math.PI*2*ratio);
      this.boostRing.strokePath();
      this.boostBtn.fillAlpha = 0.35;
      this.boostBtn.setStrokeStyle(5, 0x4a6a80);
    } else {
      // Ready: full bright ring
      this.boostRing.lineStyle(8, 0xffff80, 1);
      this.boostRing.strokeCircle(cx, cy, 70);
      this.boostBtn.fillAlpha = 0.95;
      this.boostBtn.setStrokeStyle(5, 0xffff80);
    }

    // Whip cooldown ring
    this.whipRing.clear();
    if (this.whipCooldown > 0) {
      const ratio3 = 1 - this.whipCooldown / this.chariot.whipCooldown;
      this.whipRing.lineStyle(5, 0xf4d066, 0.8);
      this.whipRing.beginPath();
      this.whipRing.arc(GAME_W - 110, GAME_H - 110, 72, -Math.PI/2, -Math.PI/2 + Math.PI*2*ratio3);
      this.whipRing.strokePath();
    }
    if (this.whipBtn) this.whipBtn.fillAlpha = this.whipCooldown > 0 ? 0.5 : 0.9;
  }

  // ---- Update ----
  update(time, delta) {
    if (this.gameOver || this.stageClear) {
      this.updateHUD();
      return;
    }

    const dt = (delta / 1000) * this.timeWarp;
    const speedBase = 380;
    const envSlow = (this.time.now < this.envSlowUntil) ? 0.6 : 1.0;
    const speed = (this.boostActive ? speedBase * 1.7 : speedBase) * envSlow;
    this.distance += speed * dt * 0.1;

    // Boost timer
    if (this.boostActive) {
      this.boostDuration -= delta;
      if (this.boostDuration <= 0) {
        this.boostActive = false;
        this.player.clearTint();
      }
    }
    if (this.boostCooldown > 0) this.boostCooldown -= delta;
    if (this.whipCooldown > 0) this.whipCooldown -= delta;

    // Boost ready transition: pulse + chime
    const boostReady = !this.boostActive && this.boostCooldown <= 0;
    if (boostReady && !this._wasBoostReady) {
      sfx.play('pickup');
      this.boostReadyGlow.setAlpha(0.6);
      this.tweens.add({ targets: this.boostReadyGlow, alpha: 0, scale: 1.6, duration: 600, onComplete: () => this.boostReadyGlow.setScale(1) });
      this.tweens.add({ targets: this.boostBtn, scale: 1.25, duration: 160, yoyo: true, ease: 'Cubic.easeOut' });
    }
    this._wasBoostReady = boostReady;

    // Sand drift (desert) - lateral pull, suppressed during boost
    if (this.cfg.env === 'desert' && !this.boostActive) {
      const drift = Math.sin(time * 0.0015) * 60;
      this.player.x = Phaser.Math.Clamp(this.player.x + drift * dt, ROAD_LEFT + 40, ROAD_RIGHT - 40);
    }

    // Combo timer
    if (this.combo > 0) {
      this.comboTimer -= delta;
      if (this.comboTimer <= 0) {
        this.comboText.setAlpha(0);
        this.combo = 0;
      }
    }

    // Scroll bg
    this.road.tilePositionY -= speed * dt;
    this.sideDecorL.tilePositionY -= speed * dt;
    this.sideDecorR.tilePositionY -= speed * dt;
    this.stripes.forEach(s => {
      s.y += speed * dt;
      if (s.y > GAME_H + 30) s.y -= GAME_H + 60;
    });

    // Speed lines (visible during boost)
    const slAlpha = this.boostActive ? 0.7 : 0;
    this.speedLines.forEach((sl, i) => {
      sl.alpha = slAlpha;
      sl.y += speed * dt * 1.4;
      if (sl.y > GAME_H + 30) {
        sl.y = -30;
        sl.x = ROAD_LEFT + Math.random() * ROAD_W;
      }
    });

    // Dust trail behind player & rivals
    if (Math.random() < (this.boostActive ? 0.6 : 0.2)) {
      this.spawnDust(this.player.x + (Math.random()-0.5)*30, this.player.y + 30);
    }

    // Rival AI
    this.rivals.getChildren().forEach(r => {
      let vy = (r.kind === 'boss') ? 0 : speed * 0.55;
      if (r.aiType === 'speed') {
        if (Math.abs(r.y - this.player.y) < 280) {
          r.targetX = this.player.x + (r.x < this.player.x ? -110 : 110);
        } else r.targetX = r.x;
      } else if (r.aiType === 'tank') {
        r.targetX = this.player.x;
        vy *= 0.85;
      } else if (r.aiType === 'rammer') {
        r.targetX = Phaser.Math.Linear(r.targetX, this.player.x, 0.025);
      } else if (r.aiType === 'boss') {
        const hoverY = 300;
        if (r.y < hoverY) vy = 80;
        else vy = 0;
        const hpRatio = r.hp / r.maxHp;
        const newPhase = hpRatio > 0.66 ? 1 : (hpRatio > 0.33 ? 2 : (hpRatio > 0.15 ? 3 : 4));
        if (newPhase === 4 && !r.bladeSpawnDone) {
          r.bladeSpawnDone = true;
          this.spawnBossBlades();
        }
        r.phase = newPhase;
        r.targetX = GAME_W/2 + Math.sin(time * 0.001) * (ROAD_W * 0.32);
        r.attackCooldown -= delta;
        r.spearCooldown -= delta;
        if (r.attackCooldown <= 0) {
          this.dropMine(r.x, r.y + 50, { dmg: 24 });
          if (r.phase >= 2) this.dropMine(r.x - 70, r.y + 50, { dmg: 22 });
          if (r.phase >= 3) this.dropMine(r.x + 70, r.y + 50, { dmg: 22 });
          if (r.phase >= 4) {
            this.time.delayedCall(150, () => this.dropMine(r.x - 35, r.y + 50, { dmg: 22 }));
            this.time.delayedCall(300, () => this.dropMine(r.x + 35, r.y + 50, { dmg: 22 }));
          }
          r.attackCooldown = r.phase === 1 ? 2200 : (r.phase === 2 ? 1700 : (r.phase === 3 ? 1300 : 900));
        }
        if (r.phase >= 2 && r.spearCooldown <= 0) {
          this.bossSpear();
          r.spearCooldown = r.phase === 2 ? 5500 : (r.phase === 3 ? 4000 : 3000);
        }
      }

      // Rivals drop mines (their only attack)
      if (r.kind !== 'boss' && r.mineCooldown !== undefined) {
        r.mineCooldown -= delta;
        if (r.mineCooldown <= 0 && r.y > 0 && r.y < this.player.y - 60) {
          this.dropMine(r.x, r.y + 40, { dmg: 20 });
          r.mineCooldown = r.mineRate + Math.random() * 400;
        }
      }

      const newX = Phaser.Math.Linear(r.x, r.targetX, 0.05);
      r.x = Phaser.Math.Clamp(newX, ROAD_LEFT + 35, ROAD_RIGHT - 35);
      r.body.setVelocityY(vy);

      if (r.hpBarBg) {
        r.hpBarBg.x = r.x; r.hpBarBg.y = r.y - 70;
        r.hpBarFill.x = r.x - 24; r.hpBarFill.y = r.y - 70;
        r.hpBarFill.scaleX = Math.max(0, r.hp / r.maxHp);
      }
      if (r.kind !== 'boss' && r.y > GAME_H + 100) {
        if (r.hpBarBg) r.hpBarBg.destroy();
        if (r.hpBarFill) r.hpBarFill.destroy();
        r.destroy();
      }
    });

    // Boss orbiting blades
    if (this.boss && this.boss.active) {
      const orbitR = 110;
      this.bossBlades.getChildren().forEach(bl => {
        bl.angleOff = (bl.angleOff || 0) + dt * 3;
        bl.x = this.boss.x + Math.cos(bl.angleOff) * orbitR;
        bl.y = this.boss.y + Math.sin(bl.angleOff) * orbitR;
        bl.rotation += dt * 8;
      });
    }

    // Obstacles
    this.obstacles.getChildren().forEach(o => {
      o.body.setVelocityY(speed);
      if (o.y > GAME_H + 100) o.destroy();
    });
    // Pickups
    this.pickups.getChildren().forEach(it => {
      it.body.setVelocityY(speed);
      if (it.y > GAME_H + 60) it.destroy();
    });
    // Hazards (river water patches)
    this.hazards.getChildren().forEach(h => {
      h.body.setVelocityY(speed);
      if (h.y > GAME_H + 100) h.destroy();
    });
    // Enemy projectiles (mines): keep them flowing toward the player
    this.enemyProjectiles.getChildren().forEach(p => {
      if (p.kind === 'mine' && p.body) {
        p.body.setVelocityY(p.scrollSpeed || speed);
      }
      if (p.y > GAME_H + 50 || p.y < -50 || p.x < -50 || p.x > GAME_W + 50) p.destroy();
    });

    // Shield visual
    if (this.player.shieldUntil > this.time.now) {
      const sec = Math.ceil((this.player.shieldUntil - this.time.now) / 1000);
      // optional flicker via tint when shield about to end
    }

    // Keyboard fallback
    if (this.cursors.left.isDown)  this.player.x = Math.max(ROAD_LEFT + 40, this.player.x - 6);
    if (this.cursors.right.isDown) this.player.x = Math.min(ROAD_RIGHT - 40, this.player.x + 6);
    if (Phaser.Input.Keyboard.JustDown(this.keyZ) || Phaser.Input.Keyboard.JustDown(this.keySpace)) this.attackWhip();
    if (Phaser.Input.Keyboard.JustDown(this.keyShift)) this.tryBoost();

    this.player.y = GAME_H - 200 + Math.sin(time * 0.008) * 3;

    if (!this.cfg.boss && this.cfg.goal > 0 && this.distance >= this.cfg.goal) {
      this.completeStage();
    }

    this.updateHUD();
  }

  spawnDust(x, y) {
    const d = this.add.image(x, y, 'pix_dust').setDepth(2).setAlpha(0.7);
    this.tweens.add({
      targets: d, alpha: 0, scale: 2, y: y + 30, duration: 500,
      onComplete: () => d.destroy()
    });
  }
}

// ============================================================
//  Phaser config
// ============================================================
const config = {
  type: Phaser.AUTO,
  parent: 'game-container',
  backgroundColor: '#1a0e05',
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: GAME_W,
    height: GAME_H
  },
  physics: { default: 'arcade', arcade: { gravity: { y: 0 }, debug: false } },
  input: { activePointers: 3 },
  scene: [BootScene, TitleScene, SelectScene, StageSelectScene, ShopScene, RaceScene]
};

const game = new Phaser.Game(config);
window.game = game;
