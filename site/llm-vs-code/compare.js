'use strict';
const SEC_PER_FRAME = 0.042;
const COL = {frame: 0, workers: 1, army: 2, bases: 3, own: 4, seen: 5, ownLost: 6, enemyLost: 7, threat: 8, cloak: 9, detectors: 10};
const POSTURE = {attack: '进攻', defend: '防守', rally: '集结', retreat: '撤退', auto: '交给 bot'};
const FOCUS = {economy: '经济', army: '兵力', tech: '科技', expand: '开矿', auto: null};
const UNIT = {zealot: '狂热者', dragoon: '龙骑', auto: null};
const RESULT = {win: '胜', loss: '负', draw: '平', anomaly: '异常'};
const END = {superseded: '被下一条指令替换', expired: '到期', end_condition: '结束条件成立', target_cleared: '目标已清除',
  target_lost: '防守的基地丢失', released: '交还 bot', game_end: '对局结束', expired_unstarted: '没等到启动条件就到期'};
const DELIVERY = {keep: '不干预', keep_same: '与当前指令相同，不重发', model_error: '模型输出无法解析', game_ended: '对局已结束'};
const KIND = {llm_only: '只有 LLM 组赢', code_only: '只有代码组赢', both_win: '两组都赢', both_loss: '两组都输'};
const GAMES = [
  {id: 'm117', tag: 'LLM 做得好', text: '暗黑圣堂出现后，LLM 没让部队硬打，而是撤退、集结并优先科技等反隐，兵力从 4 保住到 9；12664 帧判断占优后改为进攻、出龙骑，兵力涨到 35。代码组兵力最高只有 12。'},
  {id: 'm016', tag: 'LLM 做得差', text: 'LLM 在撤退和进攻之间每 500–1000 帧来回切换，部队一直在路上，第二片矿始终没开，兵力最高 12（代码组 24）。'},
  {id: 'm106', tag: '随机性', text: '这一局 LLM 一条指令都没下，整局等于和代码组同一套打法，结果却是代码组输、LLM 组赢。单局胜负本身就有很大随机性。'},
];
const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'}[c]));
const clock = f => { const s = Math.floor(f * SEC_PER_FRAME); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
const kindOf = g => ({'loss|win': 'llm_only', 'win|loss': 'code_only', 'win|win': 'both_win', 'loss|loss': 'both_loss'})[`${g.code.outcome}|${g.llm.outcome}`];
const chip = (res, arm, extra = '') => `<span class="chip ${res} ${arm}">${arm === 'code' ? '代码组' : 'LLM 组'} ${RESULT[res] || res}${extra}</span>`;
// Replays. The site's web OpenBW build desyncs on these server-recorded replays, so both views come from the match
// engine itself (OpenBWData.dll, same binary as the server): videos/*.mp4 are rendered by it, and tracks/*.json +
// *.bin.gz hold every unit every 8 frames for the whole-map view. Both were checked against the live match logs.
const REPLAYS = new Set(GAMES.map(x => x.id));
const FPS = 1 / SEC_PER_FRAME;
const GAME_DATA = {};
let charts = [], chartHover = false;
const replay = {game: null, arm: 'llm', frame: 0, playing: false, speed: 8, tracks: null, cache: {}, raf: 0, lastTs: 0,
  dirty: false, lastFrame: null, captionKey: null, token: 0, mode: 'video'};
// Local videos: ReplayCinema writes one video frame per 4 game frames at 12 fps.
const VIDEO_FRAMES_PER_SECOND = 48;
const video = () => $('replay-video');
const videoRate = () => Math.min(16, replay.speed * FPS / VIDEO_FRAMES_PER_SECOND);


async function main() {
  const loaded = await Promise.all(GAMES.map(x => fetch(`data/games/${x.id}.json`).then(r => {
    if (!r.ok) throw new Error(`${r.status} data/games/${x.id}.json`); return r.json();
  })));
  for (const g of loaded) GAME_DATA[g.id] = g;
  $('games').innerHTML = GAMES.map(x => {
    const g = GAME_DATA[x.id];
    return `<a class="hl" href="#${x.id}" data-id="${x.id}"><span class="tag">${x.tag}</span><h3>${x.id} · ${esc(g.opponent)} · ${esc(g.map)}</h3>
      <div class="chips">${chip(g.code.outcome, 'code')}${chip(g.llm.outcome, 'llm')}<span class="chip" title="LLM 指令处于生效状态的时间占整局的比例">LLM 控制 ${Math.round((g.llm.share || 0) * 100)}%</span></div><p>${esc(x.text)}</p></a>`;
  }).join('');
  addEventListener('hashchange', route);
  route();
}

function route() {
  const hash = location.hash.slice(1), id = GAME_DATA[hash] ? hash : GAMES[0].id;
  for (const a of $('games').querySelectorAll('.hl')) a.classList.toggle('active', a.dataset.id === id);
  renderDetail(GAME_DATA[id]);
  $('detail').hidden = false;
  if (GAME_DATA[hash]) $('detail').scrollIntoView({behavior: 'smooth', block: 'start'});
}

function stateAt(states, frame) {
  let lo = 0, hi = states.length - 1, best = states[0];
  while (lo <= hi) { const mid = (lo + hi) >> 1; if (states[mid][0] <= frame) { best = states[mid]; lo = mid + 1; } else hi = mid - 1; }
  return best;
}

function renderDetail(g) {
  const kind = kindOf(g);
  $('d-eyebrow').textContent = kind ? KIND[kind] : '含异常局';
  $('d-title').textContent = `${g.id} · ${g.opponent} · ${g.map}`;
  $('d-sub').textContent = `种子 ${g.seed} · 两组双方出生位置${g.same_starts ? '相同' : '不同'}`;
  const adj = a => a.adjudication === 'frame_cap_score' ? ' · 按分数' : '';
  $('d-results').innerHTML = chip(g.code.outcome, 'code', ` · ${clock(g.code.end_frame)}${adj(g.code)}`) +
    chip(g.llm.outcome, 'llm', ` · ${clock(g.llm.end_frame)}${adj(g.llm)}`);
  const h = GAMES.find(x => x.id === g.id);
  $('d-reading').hidden = !h;
  if (h) $('d-reading').innerHTML = `<b>解读</b>${esc(h.text)}`;
  $('d-legend').innerHTML = `<span><i style="background:var(--code)"></i>代码组</span><span><i style="background:var(--llm)"></i>LLM 组</span>` +
    Object.entries(POSTURE).filter(([k]) => k !== 'auto').map(([k, l]) => `<span><i class="sq" style="background:var(--${k})"></i>${l}</span>`).join('') +
    '<span>▼ LLM 下达指令　┆ 虚线：见到隐形单位 / 反隐就位</span>';
  const xmax = Math.max(g.code.end_frame, g.llm.end_frame, 1);
  const series = col => [{name: '代码组', color: 'var(--code)', states: g.code.states, col}, {name: 'LLM 组', color: 'var(--llm)', states: g.llm.states, col}];
  const sent = (g.llm.decisions || []).filter(d => d.delivery === 'sent' && d.status === 'accepted');
  const orderMarks = sent.map(d => ({x: d.started ?? d.applied ?? d.f, color: `var(--${d.order.posture})`, label: POSTURE[d.order.posture]}));
  const milestones = [['code', g.code], ['llm', g.llm]].flatMap(([arm, a]) => [
    a.milestones.cloak_seen != null && {x: a.milestones.cloak_seen, color: `var(--${arm})`, text: '隐'},
    a.milestones.detector != null && {x: a.milestones.detector, color: `var(--${arm})`, text: '反'}]).filter(Boolean);
  charts = [
    lineChart($('c-army'), {series: series(COL.army), xmax, marks: orderMarks, milestones, unit: '个单位'}),
    lineChart($('c-workers'), {series: series(COL.workers), xmax, marks: orderMarks, unit: '个农民'}),
    lineChart($('c-strength'), {series: [{name: '我方战力', color: 'var(--llm)', states: g.llm.states, col: COL.own},
      {name: '已见敌军', color: 'var(--attack)', states: g.llm.states, col: COL.seen}], xmax, marks: orderMarks, unit: ''}),
    bands($('c-bands'), g, xmax),
  ];
  renderLog(g);
  $('show-keep').onchange = () => renderLog(g);
  setupReplay(g);
}

function setupReplay(g) {
  stopReplay();
  const has = REPLAYS.has(g.id);
  $('replay').hidden = !has;
  if (!has) return;
  replay.game = g; replay.frame = 0;
  $('replay').querySelector('.arm-switch').onclick = e => {
    const b = e.target.closest('[data-arm]');
    if (b && b.dataset.arm !== replay.arm) loadReplay(b.dataset.arm);
  };
  $('replay-play').onclick = () => setPlaying(!replay.playing);
  $('replay-speed').value = String(replay.speed);
  $('replay-speed').onchange = e => { replay.speed = +e.target.value; video().playbackRate = videoRate(); };
  $('replay-seek').oninput = e => seekReplay(+e.target.value);
  $('replay-canvas').onclick = () => setPlaying(!replay.playing);
  video().onclick = () => setPlaying(!replay.playing);
  video().onended = () => setPlaying(false);
  $('replay-full').onclick = () => { const s = $('replay-screen'); document.fullscreenElement ? document.exitFullscreen() : s.requestFullscreen(); };
  $('mode-switch').onclick = e => { const b = e.target.closest('[data-mode]'); if (b) setMode(b.dataset.mode); };
  setMode(replay.mode);
  loadReplay('llm');
  replay.raf = requestAnimationFrame(tick);
}

// StarCraft player colours in the rendered video (player slot colour 0 = red, 1 = blue).
const GAME_COLOR = {0: ['红色', '#e0382c'], 1: ['蓝色', '#3d6ee0']};
function updateLegend() {
  const T = replay.tracks, g = replay.game; if (!T || !g) return;
  const own = replay.arm === 'llm' ? 'LLM 组' : '代码组';
  if (replay.mode === 'video') {
    const ours = GAME_COLOR[T.meta.players.find(p => p.name === 'compat1').color], theirs = GAME_COLOR[T.meta.players.find(p => p.name !== 'compat1').color];
    $('replay-legend').innerHTML = `<span><i style="background:${ours[1]}"></i><b>我方 bot（${own}）= ${ours[0]}</b></span><span><i style="background:${theirs[1]}"></i><b>对手 ${esc(g.opponent)} = ${theirs[0]}</b></span>` +
      '<span>镜头自动跟随交战，左下角小地图显示全图</span><span>点画面或"播放"开始/暂停</span>';
    return;
  }
  $('replay-legend').innerHTML = `<span><i style="background:${T.colors.own}"></i>我方 bot（${own}）</span><span><i style="background:${T.colors.enemy}"></i>对手 ${esc(g.opponent)}</span>` +
    `<span><i class="sq" style="background:${T.colors.own}"></i>方块 = 建筑，虚线 = 未完工</span><span>圆点 = 单位，小点 = 农民，空心圈 = 空中单位</span><span>连线 = 正在攻击</span><span>× = 刚被消灭</span>`;
}

function setMode(mode) {
  const wasPlaying = replay.playing;
  setPlaying(false);
  replay.mode = mode;
  for (const b of $('mode-switch').querySelectorAll('[data-mode]')) b.setAttribute('aria-pressed', b.dataset.mode === mode);
  video().hidden = mode !== 'video'; $('replay-canvas').hidden = mode !== 'map';
  updateLegend();
  if (mode === 'video' && video().readyState) video().currentTime = replay.frame / VIDEO_FRAMES_PER_SECOND;
  replay.dirty = true; renderReplay();
  if (wasPlaying) setPlaying(true);
}

function stopReplay() {
  video().pause();
  cancelAnimationFrame(replay.raf); replay.raf = 0;
  replay.game = null; replay.tracks = null; replay.lastFrame = null; replay.token++;
  setPlaying(false);
}

async function loadReplay(arm) {
  const g = replay.game, token = ++replay.token;
  replay.arm = arm; replay.tracks = null; replay.captionKey = null;
  for (const b of $('replay').querySelectorAll('[data-arm]')) b.setAttribute('aria-pressed', b.dataset.arm === arm);
  $('replay-loading').hidden = false; $('replay-loading').textContent = '正在载入回放…';
  const wasPlaying = replay.playing;
  setPlaying(false);
  const v = video();
  v.src = `videos/${g.id}-${arm}.mp4`;
  v.onloadedmetadata = () => {
    if (token !== replay.token) return;
    v.currentTime = Math.min(replay.frame, replay.tracks ? replay.tracks.end : replay.frame) / VIDEO_FRAMES_PER_SECOND;
    v.playbackRate = videoRate();
    if (wasPlaying) setPlaying(true);
  };
  try {
    const tracks = await loadTracks(`${g.id}-${arm}`);
    if (token !== replay.token) return;
    replay.tracks = tracks;
    const cv = $('replay-canvas');
    cv.width = tracks.terrain.width; cv.height = tracks.terrain.height;
    $('replay-seek').max = tracks.end;
    replay.frame = Math.min(replay.frame, tracks.end);
    updateLegend();
    $('replay-loading').hidden = true;
    renderReplay();
  } catch (error) {
    if (token === replay.token) $('replay-loading').textContent = `回放载入失败：${error.message}`;
  }
}

async function loadTracks(key) {
  if (!replay.cache[key]) replay.cache[key] = (async () => {
    const [meta, raw] = await Promise.all([
      fetch(`tracks/${key}.json`).then(r => { if (!r.ok) throw new Error(`${r.status} tracks/${key}.json`); return r.json(); }),
      fetch(`tracks/${key}.bin.gz`).then(r => { if (!r.ok) throw new Error(`${r.status} tracks/${key}.bin.gz`); return r.arrayBuffer(); })]);
    const head = new Uint8Array(raw, 0, 2);
    const bin = head[0] === 0x1f && head[1] === 0x8b
      ? await new Response(new Blob([raw]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer() : raw;
    return parseTracks(meta, bin);
  })().catch(error => { delete replay.cache[key]; throw error; });
  return replay.cache[key];
}

function parseTracks(meta, bin) {
  const view = new DataView(bin), starts = [], counts = [];
  for (let at = 0; at < bin.byteLength;) { const n = view.getUint16(at, true); starts.push(at + 2); counts.push(n); at += 2 + n * 11; }
  if (starts.length !== meta.frames.length) throw new Error('回放数据不完整');
  const snap = i => {
    const units = [];
    for (let k = 0, at = starts[i]; k < counts[i]; k++, at += 11) {
      const b = view.getUint8(at + 3), target = view.getUint16(at + 9, true);
      units.push({id: view.getUint16(at, true), type: meta.types[view.getUint8(at + 2)], owner: b & 3, flags: b >> 2,
        x: view.getUint16(at + 4, true), y: view.getUint16(at + 6, true), hp: view.getUint8(at + 8), target: target === 0xffff ? -1 : target});
    }
    return units;
  };
  const css = getComputedStyle(document.documentElement);
  const color = v => css.getPropertyValue(v).trim();
  const ownId = meta.players.find(p => p.name === 'compat1').id;
  const colors = {own: color(replay.arm === 'llm' ? '--llm' : '--code'), enemy: color('--attack')};
  return {meta, frames: meta.frames, end: meta.end_frame, snap, ownId, colors, terrain: terrainCanvas(meta), cacheIndex: -1, cache: null};
}

const TILE_PX = 8, SCALE = TILE_PX / 32;
function terrainCanvas(meta) {
  const small = document.createElement('canvas');
  small.width = meta.width; small.height = meta.height;
  const img = small.getContext('2d').createImageData(meta.width, meta.height);
  const level = [[29, 38, 34], [29, 38, 34], [44, 55, 49], [44, 55, 49], [60, 73, 65], [60, 73, 65]];
  meta.terrain.forEach((row, y) => row.forEach((v, x) => {
    const h = Math.floor(v / 100), walk = Math.floor((v % 100) / 2) / 16, build = v % 2;
    const [r, g, b] = level[h] || level[0], k = walk * (build ? 1 : .82), at = (y * meta.width + x) * 4;
    img.data[at] = 9 + (r - 9) * k; img.data[at + 1] = 12 + (g - 12) * k; img.data[at + 2] = 11 + (b - 11) * k; img.data[at + 3] = 255;
  }));
  small.getContext('2d').putImageData(img, 0, 0);
  const cv = document.createElement('canvas');
  cv.width = meta.width * TILE_PX; cv.height = meta.height * TILE_PX;
  const ctx = cv.getContext('2d');
  ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(small, 0, 0, cv.width, cv.height);
  return cv;
}

function snapAt(T, frame) {
  let lo = 0, hi = T.frames.length - 1;
  while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (T.frames[mid] <= frame) lo = mid; else hi = mid - 1; }
  if (T.cacheIndex !== lo) {
    const a = T.snap(lo), b = lo + 1 < T.frames.length ? T.snap(lo + 1) : null;
    T.cacheIndex = lo; T.cache = {a, next: b ? new Map(b.map(u => [u.id, u])) : null, byId: new Map(a.map(u => [u.id, u]))};
  }
  const span = lo + 1 < T.frames.length ? T.frames[lo + 1] - T.frames[lo] : 1;
  return {...T.cache, t: Math.max(0, Math.min(1, (frame - T.frames[lo]) / span))};
}

function drawReplay() {
  const T = replay.tracks; if (!T) return;
  const ctx = $('replay-canvas').getContext('2d'), frame = replay.frame;
  const {a, next, byId, t} = snapAt(T, frame);
  const pos = u => { const n = next && next.get(u.id); return n && !u.type.building ? [u.x + (n.x - u.x) * t, u.y + (n.y - u.y) * t] : [u.x, u.y]; };
  const colorOf = u => u.owner === 2 ? null : (u.owner === T.ownId ? T.colors.own : T.colors.enemy);
  ctx.drawImage(T.terrain, 0, 0);
  ctx.lineWidth = 1;
  for (const u of a) if (u.owner === 2) {
    ctx.fillStyle = u.type.name.includes('Mineral') ? 'rgba(110,180,230,.75)' : 'rgba(90,170,110,.8)';
    ctx.fillRect((u.x - u.type.tw * 16) * SCALE, (u.y - u.type.th * 16) * SCALE, u.type.tw * TILE_PX, u.type.th * TILE_PX);
  }
  for (const u of a) if (u.owner !== 2 && u.type.building) {
    const c = colorOf(u), x = (u.x - u.type.tw * 16) * SCALE, y = (u.y - u.type.th * 16) * SCALE, w = u.type.tw * TILE_PX, h = u.type.th * TILE_PX;
    ctx.globalAlpha = u.flags & 1 ? .55 : .2; ctx.fillStyle = c; ctx.fillRect(x, y, w, h);
    ctx.globalAlpha = 1; ctx.strokeStyle = c; ctx.setLineDash(u.flags & 1 ? [] : [3, 2]); ctx.strokeRect(x + .5, y + .5, w - 1, h - 1); ctx.setLineDash([]);
    if (u.hp < 100) { ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.fillRect(x, y + h - 2, w, 2); ctx.fillStyle = c; ctx.fillRect(x, y + h - 2, w * u.hp / 100, 2); }
  }
  ctx.lineWidth = 1;
  for (const u of a) if (u.owner !== 2 && !u.type.building && u.target >= 0 && (u.flags & 2)) {
    const v = byId.get(u.target); if (!v) continue;
    const [x1, y1] = pos(u), [x2, y2] = pos(v);
    ctx.strokeStyle = colorOf(u); ctx.globalAlpha = .55;
    ctx.beginPath(); ctx.moveTo(x1 * SCALE, y1 * SCALE); ctx.lineTo(x2 * SCALE, y2 * SCALE); ctx.stroke();
  }
  ctx.globalAlpha = 1;
  for (const u of a) if (u.owner !== 2 && !u.type.building) {
    const c = colorOf(u), [x, y] = pos(u), r = u.type.worker ? 2.4 : Math.max(3.6, Math.max(u.type.w, u.type.h) * SCALE * .75);
    ctx.beginPath(); ctx.arc(x * SCALE, y * SCALE, r, 0, Math.PI * 2);
    if (u.type.flyer) { ctx.globalAlpha = .35; ctx.fillStyle = c; ctx.fill(); ctx.globalAlpha = 1; ctx.strokeStyle = c; ctx.lineWidth = 1.5; ctx.stroke(); ctx.lineWidth = 1; }
    else if (u.flags & 8) { ctx.setLineDash([2, 2]); ctx.strokeStyle = c; ctx.stroke(); ctx.setLineDash([]); }
    else { ctx.globalAlpha = u.type.worker ? .7 : 1; ctx.fillStyle = c; ctx.fill(); ctx.globalAlpha = 1; }
    if (!u.type.worker && u.hp < 100) { ctx.strokeStyle = 'rgba(0,0,0,.7)'; ctx.beginPath(); ctx.arc(x * SCALE, y * SCALE, r * .45, 0, Math.PI * 2 * (1 - u.hp / 100)); ctx.stroke(); }
  }
  const deaths = T.meta.deaths;
  for (let i = deaths.length - 1; i >= 0 && deaths[i][0] > frame - 72; i--) {
    const [f, , typeIndex, owner, dx, dy] = deaths[i]; if (f > frame) continue;
    const type = T.meta.types[typeIndex] || {}, s = type.building ? 7 : 4, x = dx * SCALE, y = dy * SCALE;
    ctx.globalAlpha = 1 - (frame - f) / 72; ctx.strokeStyle = owner === T.ownId ? T.colors.own : T.colors.enemy; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(x - s, y - s); ctx.lineTo(x + s, y + s); ctx.moveTo(x + s, y - s); ctx.lineTo(x - s, y + s); ctx.stroke();
  }
  ctx.globalAlpha = 1; ctx.lineWidth = 1;
  const side = owner => {
    const us = a.filter(u => u.owner === owner && (u.flags & 1));
    return `农民 <b>${us.filter(u => u.type.worker).length}</b> · 部队 <b>${us.filter(u => !u.type.worker && !u.type.building).length}</b> · 建筑 <b>${us.filter(u => u.type.building).length}</b>`;
  };
  const enemyId = T.meta.players.find(p => p.id !== T.ownId).id;
  const hue = id => replay.mode === 'video' ? GAME_COLOR[T.meta.players.find(p => p.id === id).color][1] : (id === T.ownId ? T.colors.own : T.colors.enemy);
  $('replay-hud').innerHTML = `<span><span style="color:${hue(T.ownId)}">我方</span> ${side(T.ownId)}</span><span><span style="color:${hue(enemyId)}">对手</span> ${side(enemyId)}</span>`;
}

function tick(ts) {
  replay.raf = requestAnimationFrame(tick);
  const T = replay.tracks;
  if (!T) { replay.lastTs = ts; return; }
  if (replay.mode === 'video') {
    const v = video();
    if (v.readyState && !v.seeking) {
      const f = Math.min(T.end, v.currentTime * VIDEO_FRAMES_PER_SECOND);
      if (Math.abs(f - replay.frame) >= 1) { replay.frame = f; replay.dirty = true; }
    }
  } else if (replay.playing) {
    const dt = replay.lastTs ? Math.min(250, ts - replay.lastTs) : 0;
    replay.frame = Math.min(T.end, replay.frame + dt / 1000 * FPS * replay.speed);
    if (replay.frame >= T.end) setPlaying(false);
    replay.dirty = true;
  }
  replay.lastTs = ts;
  if (replay.dirty) renderReplay();
}

function renderReplay() {
  const T = replay.tracks; if (!T) return;
  replay.dirty = false;
  drawReplay();
  const frame = Math.round(replay.frame);
  replay.lastFrame = frame;
  $('replay-clock').textContent = `${clock(frame)} · 帧 ${frame} / ${T.end}`;
  $('replay-seek').value = frame;
  if (!chartHover) charts.forEach(c => c.set(frame));
  const key = Math.floor(frame / 12);
  if (key !== replay.captionKey) { replay.captionKey = key; $('replay-caption').innerHTML = captionAt(replay.game, replay.arm, frame); }
}

function setPlaying(on) {
  replay.playing = on && !!replay.tracks;
  if (replay.playing && replay.frame >= replay.tracks.end) { replay.frame = 0; video().currentTime = 0; }
  if (replay.playing && replay.mode === 'video') { video().playbackRate = videoRate(); video().play().catch(() => {}); }
  else video().pause();
  $('replay-play').textContent = replay.playing ? '暂停' : '播放';
  $('replay-play').setAttribute('aria-pressed', replay.playing);
}

function seekReplay(frame) {
  if ($('replay').hidden || !replay.game) return;
  replay.frame = Math.max(0, Math.min(replay.tracks ? replay.tracks.end : frame, frame));
  if (replay.mode === 'video' && video().readyState) video().currentTime = replay.frame / VIDEO_FRAMES_PER_SECOND;
  replay.dirty = true;
  renderReplay();
}

function captionAt(g, arm, frame) {
  const seg = (g[arm].postures || []).find(([s, e]) => s <= frame && frame < e);
  const posture = seg ? seg[2] : 'rally', source = seg ? seg[3] : 'bot';
  const badge = p => `<span class="p" style="background:var(--${p})">${POSTURE[p]}</span>`;
  if (arm === 'code') return `${badge(posture)}代码组：bot 自己决定<small>代码组没有 LLM，所有决定都来自内置策略。</small>`;
  const order = (g.llm.decisions || []).filter(d => d.delivery === 'sent' && d.status === 'accepted' && d.started != null && d.started <= frame &&
    frame < (d.ended ?? Infinity)).pop();
  if (!order) {
    const last = (g.llm.decisions || []).filter(d => d.f <= frame && d.i).pop();
    return `${badge(posture)}${source === 'override' ? '家里受威胁，bot 接管' : 'bot 自己决定（没有生效的 LLM 指令）'}` +
      (last ? `<small>LLM 最近一次判断（${clock(last.f)}，${DELIVERY[last.delivery] || '下达指令'}）：${esc(last.i)}</small>` : '');
  }
  const o = order.order, extra = [FOCUS[o.focus] && `发展 ${FOCUS[o.focus]}`, UNIT[o.unit] && `兵种 ${UNIT[o.unit]}`, o.scout != null && `侦察 基地 ${o.scout}`].filter(Boolean);
  const shown = source === 'override' ? `${badge(posture)}家里受威胁，bot 暂时接管姿态；LLM 指令其余部分仍生效` : `${badge(o.posture)}LLM 指令生效中`;
  return `${shown}${extra.length ? '　' + extra.join(' · ') : ''}　<span class="muted">${clock(order.started)} 下达</span><small>理由（模型原文）：${esc(order.i)}</small>`;
}

function lineChart(el, {series, xmax, marks = [], milestones = [], unit}) {
  const W = 960, H = 210, L = 38, R = 10, T = 16, B = 24, iw = W - L - R, ih = H - T - B;
  const ymaxRaw = Math.max(1, ...series.flatMap(s => s.states.map(r => r[s.col])));
  const step = [1, 2, 5, 10, 20, 25, 50, 100][[1, 2, 5, 10, 20, 25, 50, 100].findIndex(v => ymaxRaw / v <= 5)] || 200;
  const ymax = Math.ceil(ymaxRaw / step) * step;
  const x = f => L + f / xmax * iw, y = v => T + ih - v / ymax * ih;
  let svg = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(series.map(s => s.name).join('、'))}">`;
  for (let v = 0; v <= ymax; v += step) svg += `<line x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}" stroke="var(--grid)"/><text x="${L - 6}" y="${y(v) + 4}" text-anchor="end" font-size="10" fill="var(--muted)">${v}</text>`;
  for (let sec = 0; sec / SEC_PER_FRAME <= xmax; sec += 120) svg += `<text x="${x(sec / SEC_PER_FRAME)}" y="${H - 6}" text-anchor="middle" font-size="10" fill="var(--muted)">${sec / 60}:00</text>`;
  for (const m of milestones) svg += `<line x1="${x(m.x)}" x2="${x(m.x)}" y1="${T}" y2="${T + ih}" style="stroke:${m.color}" stroke-dasharray="3 3" opacity=".7"/><text x="${x(m.x) + 3}" y="${T + 9}" font-size="10" style="fill:${m.color}">${m.text}</text>`;
  for (const s of series) {
    const d = s.states.map((r, i) => `${i ? 'L' : 'M'}${x(r[0]).toFixed(1)},${y(r[s.col]).toFixed(1)}`).join('');
    svg += `<path d="${d}" fill="none" style="stroke:${s.color}" stroke-width="2" stroke-linejoin="round"/>`;
  }
  for (const m of marks) svg += `<path d="M${x(m.x) - 4},${T - 10}L${x(m.x) + 4},${T - 10}L${x(m.x)},${T - 3}Z" style="fill:${m.color}"><title>${clock(m.x)} ${m.label}</title></path>`;
  svg += `<line class="cursor" x1="0" x2="0" y1="${T}" y2="${T + ih}" stroke="var(--text)" opacity="0" stroke-width="1"/>`;
  svg += `<rect x="${L}" y="${T}" width="${iw}" height="${ih}" fill="transparent"/></svg>`;
  el.innerHTML = svg + '<div class="tip" hidden></div>';
  const root = el.querySelector('svg'), cursor = root.querySelector('.cursor'), tip = el.querySelector('.tip');
  const set = f => {
    if (f == null) { cursor.setAttribute('opacity', 0); tip.hidden = true; return; }
    cursor.setAttribute('x1', x(f)); cursor.setAttribute('x2', x(f)); cursor.setAttribute('opacity', .5);
    tip.innerHTML = `<b>${clock(f)}</b> <span class="muted">帧 ${Math.round(f)}</span><br>` + series.map(s => {
      const r = stateAt(s.states, f); return `<span style="color:${s.color}">●</span> ${s.name} ${r ? r[s.col] : '–'} ${unit}`;
    }).join('<br>');
    tip.hidden = false;
    const px = x(f) / W * el.clientWidth;
    tip.style.left = `${Math.min(px + 12, el.clientWidth - tip.offsetWidth - 4)}px`;
  };
  root.addEventListener('mousemove', e => {
    const box = root.getBoundingClientRect(), vx = (e.clientX - box.left) / box.width * W;
    const f = Math.max(0, Math.min(xmax, (vx - L) / iw * xmax));
    chartHover = true;
    charts.forEach(c => c.set(f));
  });
  root.addEventListener('mouseleave', () => { chartHover = false; charts.forEach(c => c.set(replay.lastFrame)); });
  root.addEventListener('click', e => {
    const box = root.getBoundingClientRect(), vx = (e.clientX - box.left) / box.width * W;
    seekReplay(Math.max(0, Math.min(xmax, (vx - L) / iw * xmax)));
  });
  return {set};
}

function bands(el, g, xmax) {
  const W = 960, L = 0;
  const row = (arm, a) => {
    let s = `<svg viewBox="0 0 ${W} 22" preserveAspectRatio="none">`;
    for (const [start, end, posture, source] of a.postures) {
      const x0 = start / xmax * W, w = Math.max(.5, (end - start) / xmax * W);
      const op = source === 'llm' ? 1 : source === 'override' ? .6 : .32;
      s += `<rect x="${x0}" y="2" width="${w}" height="18" style="fill:var(--${posture})" opacity="${op}"${source === 'override' ? ' stroke="var(--text)" stroke-width=".8"' : ''}><title>${clock(start)}–${clock(end)} ${POSTURE[posture]}（${source === 'llm' ? 'LLM 指令' : source === 'override' ? '受威胁时 bot 接管' : 'bot 自己'}）</title></rect>`;
    }
    return s + `<line class="cursor" x1="0" x2="0" y1="0" y2="22" stroke="var(--text)" opacity="0"/></svg>`;
  };
  el.innerHTML = `<span>代码组</span>${row('code', g.code)}<span>LLM 组</span>${row('llm', g.llm)}`;
  const cursors = el.querySelectorAll('.cursor');
  return {set: f => cursors.forEach(c => { c.setAttribute('opacity', f == null ? 0 : .7); if (f != null) { c.setAttribute('x1', f / xmax * W); c.setAttribute('x2', f / xmax * W); } })};
}

function renderLog(g) {
  const all = g.llm.decisions || [], showKeep = $('show-keep').checked;
  const sent = all.filter(d => d.delivery === 'sent');
  const lat = all.map(d => d.t).filter(Boolean).sort((a, b) => a - b);
  const status = k => sent.filter(d => d.status === k).length;
  $('log-note').textContent = `LLM 在这一局一共做了 ${all.length} 次判断：${sent.length} 次下了指令（bot 执行 ${status('accepted')}，交还 bot ${status('released')}，拒绝 ${status('rejected')}），其余 ${all.length - sent.length} 次选择不干预。模型回复中位 ${lat.length ? lat[lat.length >> 1].toFixed(1) : '–'} 秒。`;
  const items = all.filter(d => showKeep || d.delivery === 'sent');
  if (!items.length) { $('d-log').innerHTML = '<li class="muted">这一局 LLM 没有下过指令，整局都由 bot 自己决定。勾选上面的选项可以看它每次不干预的理由。</li>'; return; }
  $('d-log').innerHTML = items.map(d => {
    const when = d.started ?? d.applied ?? d.f;
    if (d.delivery !== 'sent') {
      return `<li class="entry keep" data-f="${d.f}"><time>${clock(d.f)}<small>帧 ${d.f}</small></time><div class="what"><span class="k">${DELIVERY[d.delivery] || d.delivery}</span></div>
        ${d.a ? `<p class="assess">${esc(d.a)}</p>` : ''}${d.i ? `<p class="why">${esc(d.i)}</p>` : ''}${d.error ? `<p class="assess">${esc(d.error)}</p>` : ''}</li>`;
    }
    const o = d.order, parts = [];
    if (FOCUS[o.focus]) parts.push(`发展 <b>${FOCUS[o.focus]}</b>`);
    if (UNIT[o.unit]) parts.push(`兵种 <b>${UNIT[o.unit]}</b>`);
    if (o.scout != null) parts.push(`侦察 <b>基地 ${o.scout}</b>`);
    if (o.target != null) parts.push(`目标 <b>基地 ${o.target}</b>`);
    if (o.start !== 'now') parts.push(`启动条件 <b>${esc(o.start)}</b>`);
    if (o.end !== 'ttl') parts.push(`结束条件 <b>${esc(o.end)}</b>`);
    parts.push(`有效期 <b>${Math.round(o.ttl * SEC_PER_FRAME)} 秒</b>`);
    const st = d.status === 'accepted' ? `已执行${d.reason ? '（' + esc(d.reason) + '）' : ''}` : d.status === 'released' ? '交还 bot' : `被拒：${esc(d.reason)}`;
    let effect = '';
    if (d.started != null && d.ended != null) {
      const a = stateAt(g.llm.states, d.started), b = stateAt(g.llm.states, d.ended);
      effect = `<p class="effect">生效 ${clock(d.started)}–${clock(d.ended)}（${END[d.end_reason] || d.end_reason}） · 兵力 ${a[COL.army]}→${b[COL.army]} · 农民 ${a[COL.workers]}→${b[COL.workers]} · 已见敌军战力 ${a[COL.seen]}→${b[COL.seen]}</p>`;
    }
    return `<li class="entry" data-f="${when}"><time>${clock(when)}<small>帧 ${when}</small></time><div class="what"><span class="p" style="background:var(--${o.posture})">${POSTURE[o.posture]}</span>${parts.map(x => `<span class="k">${x}</span>`).join('')}<span class="status ${d.status === 'rejected' ? 'bad' : ''}">${st}</span></div>
      ${d.a ? `<p class="assess">${esc(d.a)}</p>` : ''}<p class="why">${esc(d.i)}</p>${effect}</li>`;
  }).join('');
  $('d-log').onclick = e => {
    const li = e.target.closest('.entry'); if (!li) return;
    $('d-log').querySelectorAll('.entry.active').forEach(x => x.classList.remove('active')); li.classList.add('active');
    charts.forEach(c => c.set(+li.dataset.f));
    if (!$('replay').hidden) { seekReplay(+li.dataset.f); $('replay').scrollIntoView({behavior: 'smooth', block: 'start'}); }
  };
}

main().catch(error => { document.querySelector('main').insertAdjacentHTML('afterbegin', `<p class="error">数据加载失败：${esc(error.message)}</p>`); });
