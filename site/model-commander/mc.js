'use strict';
const $ = id => document.getElementById(id);
const params = new URLSearchParams(location.search);
const SEC_PER_FRAME = 0.042;
let lang = 'en', data = null, item = null, run = null, detail = null;
const st = {view: 'all', viewApplied: null, frame: 0, lastRendered: -1, prodFrame: -1, prodView: null, playing: false, liveSeek: null, liveTarget: null, raf: 0};

const KEY_COLORS = {
  '1': '#76b7b2', '2': '#4e79a7', '3': '#edc948', '4': '#b07aa1', '5': '#f28e2b',
  '6': '#e15759', '7': '#ff9da7', '8': '#9c755f', '9': '#86bcb6', '0': '#59a14f', '-': '#bab0ac'
};

const KEYS = {
  zh: {'1': '探机避险', '2': '强制采矿', '3': '小队模式', '4': '全队模式', '5': '近敌／分矿建筑',
       '6': '主基地区域清场', '7': '持续区域警戒', '8': '原地集结', '9': '安全撤离集结', '0': '全军回防', '-': '全局重置'},
  en: {'1': 'Evade probe', '2': 'Force mining', '3': 'Squad mode', '4': 'All-army mode', '5': 'Attack near / expansion',
       '6': 'Clear enemy main', '7': 'Area patrol guard', '8': 'Rally in place', '9': 'Safe retreat & regroup', '0': 'Recall all to defend', '-': 'Reset to bot control'}
};

const ACTIONS = {
  zh: {attack: '进攻主基地', expansion: '攻分矿', hold: '固守', defend: '全军回防', rally: '集结', retreat: '撤退', clear_enemies: '区域警戒', baseline: 'Bot 自动控制'},
  en: {attack: 'Attack main', expansion: 'Attack expansion', hold: 'Hold', defend: 'Defend base', rally: 'Rally', retreat: 'Retreat', clear_enemies: 'Area guard', baseline: 'Bot auto control'}
};

const PHASES = {
  zh: {
    patrol_waiting: '持续警戒待敌', patrol_searching: '局部搜索敌军', patrol_engaging: '警戒区交战',
    active: '执行中', advancing: '正在推进', engaging: '正在交战',
    assembly_waiting: '原地等待援兵', assembly_joining: '援兵前来汇合', assembly_defending: '集结区还击',
    assembly_evading: '集结区避险', assembly_shared_refuge: '前往局部避险点',
    evading_cloak: '避让隐刀', waiting_detection: '等待反隐支援', detection_skirmishing: '等待反隐并迎敌',
    main_outer_pylon: '拆外围水晶', main_outer_building: '拆外围建筑', main_core: '拆主建筑',
    main_combat: '清理敌军和炮台', main_surveying: '扫查区域迷雾', main_confirming: '确认清空',
    main_blocked: '目标暂不可达', main_advancing: '逐步推进',
    standby_forming: '向空地展开', standby_waiting: '空地待命', standby_engaging: '短距迎敌', standby_returning: '返回站位', standby_blocked: '等待空位',
    gathering: '向集合点汇合', holding: '已集结待命', retreating: '正在脱战后撤', regrouping: '避险点汇合', safe: '已撤到安全点',
    returning: '正在回防', guarding: '已到基地防守', defending: '基地附近交战', intercepting: '防区拦截敌军', reforming: '收回防线',
    rally_withdrawing: '前线脱战汇合', rally_joining: '前往安全汇合点', rally_waiting: '安全点待命',
    waiting_units: '等待作战单位', waiting_reinforcements: '等待补兵', lost: '小队已损失'
  },
  en: {
    patrol_waiting: 'waiting on patrol', patrol_searching: 'searching area', patrol_engaging: 'engaging in patrol zone',
    active: 'active', advancing: 'advancing', engaging: 'engaging',
    assembly_waiting: 'waiting for reinforcements', assembly_joining: 'reinforcements joining', assembly_defending: 'defending rally point',
    assembly_evading: 'evading at rally', assembly_shared_refuge: 'moving to local refuge',
    evading_cloak: 'evading cloaked units', waiting_detection: 'waiting for detection', detection_skirmishing: 'skirmishing while awaiting detection',
    main_outer_pylon: 'clearing outer pylons', main_outer_building: 'clearing outer buildings', main_core: 'attacking main core',
    main_combat: 'fighting army / cannons', main_surveying: 'surveying main', main_confirming: 'confirming clear',
    main_blocked: 'target blocked', main_advancing: 'advancing on main',
    standby_forming: 'spreading out', standby_waiting: 'holding standby', standby_engaging: 'short-range engage', standby_returning: 'returning to post', standby_blocked: 'waiting for space',
    gathering: 'gathering', holding: 'holding', retreating: 'retreating', regrouping: 'regrouping', safe: 'safe',
    returning: 'returning home', guarding: 'guarding base', defending: 'defending base', intercepting: 'intercepting', reforming: 'reforming line',
    rally_withdrawing: 'withdrawing to rally', rally_joining: 'joining rally', rally_waiting: 'waiting at rally',
    waiting_units: 'waiting for units', waiting_reinforcements: 'waiting for reinforcements', lost: 'squad lost'
  }
};

const UNIT_ZH = {
  'Probe': '探机', 'Zealot': '狂热者', 'Dragoon': '龙骑士', 'High Templar': '圣堂武士', 'Dark Templar': '隐刀', 'Archon': '执政官',
  'Reaver': '金甲虫', 'Shuttle': '运输机', 'Observer': '叮当', 'Corsair': '海盗船', 'Carrier': '航母', 'Scout': '斥候',
  'Nexus': '主基地', 'Pylon': '水晶', 'Assimilator': '气矿', 'Gateway': '兵营', 'Forge': '升级塔', 'Photon Cannon': '炮台',
  'Cybernetics Core': 'BY', 'Robotics Facility': 'VR', 'Robotics Support Bay': '金甲建筑', 'Observatory': '叮当建筑',
  'Citadel of Adun': '提速建筑', 'Templar Archives': '圣堂建筑', 'Stargate': 'VS', 'Fleet Beacon': '航母建筑',
  'Shield Battery': '电池', 'Singularity Charge': '龙骑射程', 'Leg Enhancements': '狂热者提速',
  'Protoss Ground Weapons': '地面攻击', 'Protoss Ground Armor': '地面护甲', 'Protoss Plasma Shields': '护盾',
  'SCV': 'SCV', 'Marine': '机枪兵', 'Medic': '护士', 'Firebat': '火兵', 'Vulture': '雷车', 'Siege Tank': '坦克',
  'Goliath': '歌利亚', 'Wraith': '隐飞', 'Dropship': '运输船', 'Science Vessel': '科学球', 'Command Center': '基地',
  'Supply Depot': '人口', 'Barracks': '兵营', 'Factory': '重工', 'Starport': '机场', 'Academy': '学院',
  'Engineering Bay': 'BE', 'Armory': 'VA', 'Bunker': '地堡', 'Missile Turret': '防空', 'Comsat Station': '雷达',
  'Drone': '工蜂', 'Zergling': '小狗', 'Hydralisk': '刺蛇', 'Lurker': '地刺', 'Mutalisk': '飞龙', 'Scourge': '自杀蝠',
  'Ultralisk': '大象', 'Overlord': '房子', 'Hatchery': '基地', 'Lair': '二本', 'Hive': '三本',
  'Spawning Pool': '血池', 'Hydralisk Den': '刺蛇塔', 'Spire': '飞龙塔', 'Sunken Colony': '地堡', 'Spore Colony': '防空',
  'Creep Colony': '菌毯', 'Extractor': '气矿', 'Evolution Chamber': '进化腔', 'Metabolic Boost': '狗速'
};

const T = {
  en: {
    title: 'Model commander iteration',
    intro: 'A language model commands our Protoss bot live through the same keyboard command layer used by human commanders. After each round it reviews the match logs and edits the bot\u2019s policy, then the next round tests the new version. One original replay is published per round.',
    iterSummary: 'Iteration notes (Chinese)',
    runA: 'Run 1', runB: 'Run 2',
    runDesc: r => `${r.rounds} rounds · ${r.matches_per_round} matches per round (${r.parallel} in parallel) · ${r.map}`,
    runNoteA: 'Each round plays 2 matches; after the round the model revises the version or keeps it.',
    runNoteB: 'Each round tests the candidate version plus one re-check of the current champion; the candidate is promoted or rejected by result.',
    round: 'Round', vs: 'vs', watch: 'Watch replay →', back: '← All rounds',
    win: 'Win', loss: 'Loss', draw: 'Inconclusive',
    end: {natural: 'game ended', stalemate_zero_units: 'cut off: no army left', stalemate_one_army_or_less: 'cut off: army ≤ 1', max_frames: 'cut off: 36,000-frame cap', manual_stop: 'stopped manually', cutoff: 'cut off'},
    decision: {baseline: 'Baseline', promoted: 'Promoted', rejected: 'Rejected', revised: 'Revised', kept: 'Kept'},
    reason: {win_rate_improved: 'win rate improved', score_improved: 'score improved', win_rate_lower: 'win rate lower', insufficient_improvement: 'insufficient improvement', single_opponent_score_drop: 'score dropped on one opponent'},
    regression: o => `regression vs ${o}`,
    tested: 'Version tested', parent: 'Parent', outcome: 'Round outcome', changed: 'Changed', score: 'L0 score', duration: 'Length', models: 'Models',
    actionsCount: n => `${n} actions`,
    becomes: v => `→ ${v}`,
    viewAll: 'Full map', viewSelf: 'Our vision', fullscreen: 'Fullscreen', exitFullscreen: 'Exit fullscreen',
    loading: 'Loading replay…', ready: 'Replay ready',
    panelCmd: 'Current action', panelTask: 'Active task', panelProd: 'Building / Producing', panelRecent: 'Recent actions',
    prevCmd: '◀ Prev action', nextCmd: 'Next action ▶', play: 'Play', pause: 'Pause', speed: 'Speed',
    cmdPos: (i, n) => `Action ${i} / ${n}`,
    noCmdYet: 'No command yet — bot is running on its own.',
    noTask: 'No active override — bot is in auto control.',
    noRecent: 'None yet', none: 'None', prodLoading: 'Loading viewer…',
    ours: 'Ours', unitsCount: n => `${n} units`, arrived: n => `${n} in position`,
    ago: s => `${s}s ago`, frame: 'Frame',
    srcLlm: 'LLM', srcRule: r => `Rule (${r})`, srcEngine: 'Engine',
    keepLabel: 'Keep current plan', cutoffLabel: 'Match cut off', failedLabel: 'Model call failed',
    latestCheck: (t, r) => `Latest check (${t}, keep current): ${r}`,
    logTitle: 'Action timeline', showKeep: 'Show "keep current" checks',
    logNote: (keys, total) => `${keys} command(s) issued (${total} total checks). Click any row to jump the replay to that moment.`,
    controls: 'Click inside the player or use the buttons above. Space: pause / resume · A / D: speed · Arrow keys: camera · Click any action row to seek.',
    roundTable: 'All matches in this round', match: 'Match', opponent: 'Opponent', result: 'Result', shown: 'shown', champion: 'champion re-check',
    files: it => `Original replay: ${it.file.split('/').pop()} · ${(it.bytes / 1024).toFixed(0)} KB · SHA256 ${it.sha256.slice(0, 16)}…`,
    missing: 'Replay unavailable', loadError: 'The page could not load.',
    footer: 'Model commander experiment · data from local native match logs',
    count: n => `${n} replays`,
  },
  zh: {
    title: '模型指挥迭代',
    intro: '由大模型通过与人类指挥相同的按键指挥层实时指挥我方神族 bot；每轮结束后，模型复盘对局日志并修改 bot 策略，下一轮测试新版本。每一轮公开一局原始回放。',
    iterSummary: '迭代过程',
    runA: '第一批', runB: '第二批',
    runDesc: r => `${r.rounds} 轮 · 每轮 ${r.matches_per_round} 局（${r.parallel} 局并行）· ${r.map}`,
    runNoteA: '每轮 2 局，轮后由模型决定修改版本或保持不变。',
    runNoteB: '每轮由候选版本对阵，并复测一局当前冠军版本；按结果晋升或淘汰候选版本。',
    round: '第', roundSuffix: '轮', vs: '对阵', watch: '观看回放 →', back: '← 全部轮次',
    win: '胜', loss: '负', draw: '未分胜负',
    end: {natural: '自然结束', stalemate_zero_units: '判停：我方无部队', stalemate_one_army_or_less: '判停：部队 ≤ 1', max_frames: '判停：达到 36000 帧上限', manual_stop: '手动停止', cutoff: '判停'},
    decision: {baseline: '基线', promoted: '晋升', rejected: '淘汰', revised: '修改', kept: '保持'},
    reason: {win_rate_improved: '胜率提升', score_improved: '得分提升', win_rate_lower: '胜率下降', insufficient_improvement: '提升不足', single_opponent_score_drop: '单个对手得分下降'},
    regression: o => `对 ${o} 退步`,
    tested: '测试版本', parent: '父版本', outcome: '本轮结论', changed: '改动', score: 'L0 得分', duration: '时长', models: '模型',
    actionsCount: n => `${n} 次操作`,
    becomes: v => `→ ${v}`,
    viewAll: '全局视角', viewSelf: '我方视角', fullscreen: '全屏', exitFullscreen: '退出全屏',
    loading: '正在载入回放…', ready: '回放已就绪',
    panelCmd: '当前操作', panelTask: '指挥层正在执行', panelProd: '正在建造 / 生产', panelRecent: '最近操作',
    prevCmd: '◀ 上一操作', nextCmd: '下一操作 ▶', play: '播放', pause: '暂停', speed: '速度',
    cmdPos: (i, n) => `操作 ${i} / ${n}`,
    noCmdYet: '尚未下达指令，部队由 bot 自动控制。',
    noTask: '当前无接管任务，部队由 bot 自动控制。',
    noRecent: '暂无', none: '无', prodLoading: '播放器载入中…',
    ours: '我方', unitsCount: n => `${n} 个单位`, arrived: n => `已到位 ${n}`,
    ago: s => `${s} 秒前`, frame: '帧',
    srcLlm: '大模型', srcRule: r => `规则 (${r})`, srcEngine: '系统',
    keepLabel: '保持当前策略', cutoffLabel: '对局判停', failedLabel: '模型调用失败',
    latestCheck: (t, r) => `最近检查（${t} · 保持当前）：${r}`,
    logTitle: '操作时间线', showKeep: '显示“保持当前”检查',
    logNote: (keys, total) => `共下达 ${keys} 次指令（含保持当前共 ${total} 次检查）。点击任意一条即可跳转到回放对应时刻。`,
    controls: '点击下方操作记录或按钮可直达对应帧。Space：暂停 / 继续 · A / D：倍速 · 方向键：镜头 · 点击声音按钮开启音效。',
    roundTable: '本轮全部对局', match: '局号', opponent: '对手', result: '结果', shown: '本页回放', champion: '冠军复测',
    files: it => `原始回放：${it.file.split('/').pop()} · ${(it.bytes / 1024).toFixed(0)} KB · SHA256 ${it.sha256.slice(0, 16)}…`,
    missing: '这场回放暂不可用', loadError: '页面加载失败',
    footer: '模型指挥实验 · 数据来自本地原版对局日志',
    count: n => `${n} 局回放`,
  }
};

const t = () => T[lang];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
const clockSec = s => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
const clockFrame = f => clockSec(Math.max(0, Math.floor(f * SEC_PER_FRAME)));
const roundLabel = n => lang === 'zh' ? `${t().round} ${n} ${t().roundSuffix}` : `${t().round} ${n}`;
const runLabel = r => r.id === 'a' ? t().runA : t().runB;
const resultText = r => t()[r];
const endText = e => t().end[e] || e;
const keyName = k => KEYS[lang][k] || k;
const keyColor = k => KEY_COLORS[k] || '#9aa8a0';
const actionName = a => ACTIONS[lang][a] || a;
const phaseName = p => PHASES[lang][p] || p;

function lastAt(arr, frame, getFrame = x => x[0]) {
  let lo = 0, hi = arr.length - 1, ans = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (getFrame(arr[mid]) <= frame) { ans = mid; lo = mid + 1; } else hi = mid - 1;
  }
  return ans;
}

function sourceTag(src) {
  if (!src || src === 'llm') return `<span class="mc-src llm">${esc(t().srcLlm)}</span>`;
  if (src.startsWith('rule:')) return `<span class="mc-src rule">${esc(t().srcRule(src.slice(5)))}</span>`;
  return `<span class="mc-src">${esc(t().srcEngine)}</span>`;
}

function reasonText(reason) {
  if (!reason) return '';
  if (reason.startsWith('regression_on_')) return t().regression(reason.slice(14));
  return t().reason[reason] || reason;
}

function decisionText(it) {
  const d = t().decision[it.decision] || it.decision;
  if (it.decision === 'promoted') return `${d} ${t().becomes(it.next_version)}${it.reason ? ' · ' + reasonText(it.reason) : ''}`;
  if (it.decision === 'rejected') return `${d}${it.reason ? ' · ' + reasonText(it.reason) : ''}`;
  if (it.decision === 'revised') return `${d} ${t().becomes(it.next_version)}`;
  if (it.decision === 'kept') return `${d} ${it.next_version}`;
  return d;
}

function link(id) { const p = new URLSearchParams(); if (id) p.set('id', id); p.set('lang', lang); return './?' + p; }
function keyEvents() { return detail ? detail.events.filter(e => e.kind === 'key') : []; }

function renderLibrary() {
  const root = $('mc-runs'); root.replaceChildren();
  for (const r of data.runs) {
    const sec = el('section', 'mc-run');
    const head = el('div', 'mc-run-head');
    head.append(el('h2', null, runLabel(r)), el('p', 'mc-run-desc', `${t().runDesc(r)} · ${t().count(r.items.length)}`));
    sec.append(head, el('p', 'mc-run-note', r.id === 'a' ? t().runNoteA : t().runNoteB));
    const grid = el('div', 'mc-cards');
    for (const it of r.items) {
      const a = el('a', 'card mc-card'); a.href = link(it.id);
      const top = el('div', 'card-top');
      top.append(el('span', 'mc-round', roundLabel(it.round)), el('span', `badge ${it.result}`, resultText(it.result)));
      const body = el('div', 'card-body');
      body.append(el('h3', null, `${it.tested} ${t().vs} ${it.opponent}`));
      const meta = [clockSec(it.seconds), endText(it.end)];
      if (it.actions != null) meta.push(t().actionsCount(it.actions));
      if (it.l0_score != null) meta.push(`L0 ${it.l0_score}`);
      body.append(el('p', 'mc-card-meta', meta.join(' · ')));
      body.append(el('p', `mc-decision d-${it.decision}`, decisionText(it)));
      body.append(el('span', 'watch', t().watch));
      a.append(top, body); grid.append(a);
    }
    sec.append(grid); root.append(sec);
  }
}

function renderDetailStatic() {
  $('mc-back').href = link();
  $('mc-eyebrow').textContent = `${runLabel(run)} · ${roundLabel(item.round)}`;
  $('mc-title').textContent = `${item.tested} ${t().vs} ${item.opponent} · ${resultText(item.result)}`;
  $('mc-meta').textContent = `${item.map} · ${item.race} vs ${item.opponent_race} · ${clockSec(item.seconds)} · ${endText(item.end)}`;
  const facts = $('mc-facts'); facts.replaceChildren();
  const fact = (k, v) => { if (v == null || v === '') return; const d = el('div', 'mc-fact'); d.append(el('span', null, k), el('strong', null, v)); facts.append(d); };
  fact(t().tested, item.tested);
  if (item.parent && item.parent !== item.tested) fact(t().parent, item.parent);
  fact(t().outcome, decisionText(item));
  if (item.changed_files?.length) fact(t().changed, item.changed_files.join(', ') + (item.cpp_changed_lines ? ` (Δ${item.cpp_changed_lines} C++)` : ''));
  if (item.l0_score != null) fact(t().score, String(item.l0_score));
  fact(t().models, run.live_model === run.review_model ? run.live_model : `${run.live_model} / ${run.review_model}`);

  const table = $('mc-round'); table.replaceChildren();
  const hr = el('tr'); [t().match, t().opponent, t().result, t().duration, t().score, ''].forEach(h => hr.append(el('th', null, h))); table.append(hr);
  for (const m of item.round_matches) {
    const tr = el('tr'); if (m.match_number === item.match_number) tr.className = 'shown';
    tr.append(el('td', null, `#${m.match_number}`), el('td', null, m.opponent),
      el('td', `r-${m.result}`, `${resultText(m.result)} · ${endText(m.end)}`), el('td', null, clockSec(m.seconds)),
      el('td', null, m.l0_score != null ? String(m.l0_score) : '—'),
      el('td', 'muted', m.match_number === item.match_number ? t().shown : (m.version && m.version !== item.tested ? `${m.version} · ${t().champion}` : '')));
    table.append(tr);
  }
  $('mc-files').textContent = t().files(item);
  $('mc-seek').max = item.frame;
  document.title = `${item.tested} ${t().vs} ${item.opponent} · ${t().title} · Replay Archive`;
  renderLog();
  renderFrame();
}

function renderLog() {
  const list = $('mc-log'); list.replaceChildren();
  if (!detail) return;
  const showKeep = $('mc-show-keep').checked;
  const keys = keyEvents();
  $('mc-log-note').textContent = t().logNote(keys.length, detail.events.length);
  const rows = showKeep ? detail.events : detail.events.filter(e => e.kind === 'key' || e.kind === 'cutoff');
  rows.forEach((ev, idx) => {
    const li = el('li', 'mc-entry' + (ev.kind === 'keep' ? ' is-keep' : ''));
    li.dataset.frame = ev.frame;
    li.dataset.idx = idx;
    const time = el('div', 'mc-entry-time', clockFrame(ev.frame));
    const body = el('div');
    const head = el('div', 'mc-entry-head');
    if (ev.kind === 'key') {
      head.innerHTML = `<span class="mc-key" style="background:${keyColor(ev.key)}">${esc(ev.key)}</span><b>${esc(keyName(ev.key))}</b>${sourceTag(ev.source)}${ev.units != null ? `<span class="mc-muted mc-small"> · ${esc(t().unitsCount(ev.units))}</span>` : ''}`;
    } else if (ev.kind === 'keep') {
      head.innerHTML = `<span class="mc-muted">${esc(t().keepLabel)}</span>${sourceTag(ev.source)}`;
    } else if (ev.kind === 'cutoff') {
      head.innerHTML = `<b>${esc(t().cutoffLabel)}</b>${sourceTag('engine')}<span class="mc-muted mc-small"> · ${esc(endText(ev.reason))}</span>`;
    } else {
      head.innerHTML = `<span class="mc-muted">${esc(t().failedLabel)}</span>${sourceTag(ev.source)}`;
    }
    body.append(head);
    if (ev.reason && ev.kind !== 'cutoff') body.append(el('p', 'mc-entry-reason', ev.reason));
    li.append(time, body);
    li.onclick = () => liveSeek(ev.frame, true);
    list.append(li);
  });
  highlightLog(Math.floor(st.frame));
}

function highlightLog(f) {
  const entries = [...$('mc-log').children];
  let active = -1;
  for (let i = 0; i < entries.length; i++) {
    if (+entries[i].dataset.frame <= f) active = i; else break;
  }
  entries.forEach((li, i) => li.classList.toggle('active', i === active));
}

function renderFrame() {
  if (!item) return;
  const f = Math.max(0, Math.min(item.frame, Math.floor(st.frame)));
  st.lastRendered = f;
  $('mc-seek').value = f;
  $('mc-clock').textContent = `${clockFrame(f)} / ${clockFrame(item.frame)} · ${t().frame} ${f}`;
  if (!detail) return;

  const keys = keyEvents();
  const ci = lastAt(keys, f, e => e.frame);
  const c = keys[ci];
  $('mc-cmd-pos').textContent = t().cmdPos(ci + 1, keys.length);

  // Latest keep_current check after the last key action
  const ei = lastAt(detail.events, f, e => e.frame);
  const latestEv = detail.events[ei];
  const keepNote = latestEv && latestEv.kind === 'keep' && (!c || latestEv.frame > c.frame) && latestEv.reason
    ? `<div class="mc-keep-note">${esc(t().latestCheck(clockFrame(latestEv.frame), latestEv.reason))}</div>` : '';

  if (c) {
    const ago = Math.max(0, Math.round((f - c.frame) * SEC_PER_FRAME));
    $('mc-last-cmd').innerHTML =
      `<span class="mc-key" style="background:${keyColor(c.key)}">${esc(c.key)}</span><b>${esc(keyName(c.key))}</b>${sourceTag(c.source)}` +
      `<div class="mc-muted mc-small">${clockFrame(c.frame)} · ${esc(t().ago(ago))}${c.units != null ? ` · ${esc(t().unitsCount(c.units))}` : ''}</div>` +
      (c.reason ? `<p class="mc-reason">${esc(c.reason)}</p>` : '') + keepNote;
  } else {
    $('mc-last-cmd').innerHTML = `<span class="mc-muted">${esc(t().noCmdYet)}</span>` + keepNote;
  }

  // Active battle task from commander-layer.jsonl
  const ti = lastAt(detail.tasks, f, x => x[0]);
  const tk = detail.tasks[ti];
  const activeTask = tk && tk[1] > 0 && tk[2] !== 'baseline' && (f - tk[0] < 480);
  if (activeTask) {
    const phase = tk[3] ? ` · ${esc(phaseName(tk[3]))}` : '';
    const extra = [t().unitsCount(tk[4]), tk[5] != null ? t().arrived(tk[5]) : null].filter(Boolean).join(' · ');
    $('mc-task').innerHTML = `<b>${esc(actionName(tk[2]))}</b>${phase}<div class="mc-muted mc-small">${esc(extra)}</div>`;
  } else {
    $('mc-task').innerHTML = `<span class="mc-muted">${esc(t().noTask)}</span>`;
  }

  // Recent key actions (clickable)
  const recent = $('mc-recent'); recent.replaceChildren();
  const slice = keys.slice(Math.max(0, ci - 3), ci + 1).reverse();
  if (!slice.length) {
    recent.append(el('li', 'mc-muted', t().noRecent));
  } else {
    for (const x of slice) {
      const li = el('li');
      li.innerHTML = `<span class="mc-key" style="background:${keyColor(x.key)}">${esc(x.key)}</span>${clockFrame(x.frame)} ${esc(keyName(x.key))}${sourceTag(x.source)}`;
      li.onclick = () => liveSeek(x.frame, true);
      recent.append(li);
    }
  }
  highlightLog(f);
}

function productionAt(w) {
  const funcs = w.Module.get_util_funcs(), side = {};
  const label = (kind, id) => { const raw = w.display_name_for_icon(kind, id), n = raw.replace(/^(Protoss|Terran|Zerg)\s+/, ''); return lang === 'zh' ? (UNIT_ZH[raw] || UNIT_ZH[n] || n) : n; };
  const add = (owner, name, done) => (side[owner] = side[owner] || []).push([name, done]);
  const inc = funcs.get_all_incomplete_units();
  for (let i = 0; i < inc.length; i++) {
    const u = inc[i], ty = u.build_type() || u.unit_type();
    if (ty.id === 73 || ty.id === 85) continue;
    add(u.owner, label('unit', ty.id), 1 - u.remaining_build_time / ty.build_time);
  }
  for (const p of w.players) {
    const up = funcs.get_incomplete_upgrades(p), re = funcs.get_incomplete_research(p);
    for (let i = 0; i < up.length; i++) add(p, label('upgrade', up[i].id), 1 - up[i].remaining_time / up[i].total_time);
    for (let i = 0; i < re.length; i++) add(p, label('tech', re[i].id), 1 - re[i].remaining_time / re[i].total_time);
  }
  return side;
}

function renderProduction(w) {
  if (!w) { $('mc-prod').innerHTML = `<span class="mc-muted">${esc(t().prodLoading)}</span>`; return; }
  try {
    const side = productionAt(w);
    const rows = w.players.filter(p => st.view === 'all' || w.UTF8ToString(w._player_get_value(p, w.C_NICK)) === item.self_name).map(p => {
      const mine = w.UTF8ToString(w._player_get_value(p, w.C_NICK)) === item.self_name;
      const items = (side[p] || []).sort((a, b) => b[1] - a[1]);
      const counted = new Map();
      for (const [n, d] of items) { const c = counted.get(n) || {n, k: 0, d: 0}; c.k++; c.d = Math.max(c.d, d); counted.set(n, c); }
      const pills = [...counted.values()].map(c => `<span class="mc-pill"><i style="width:${Math.round(c.d * 100)}%"></i>${esc(c.n)}${c.k > 1 ? ` ×${c.k}` : ''}</span>`).join('') || `<span class="mc-muted">${esc(t().none)}</span>`;
      return `<div><b>${esc(mine ? t().ours : item.opponent)}</b> ${pills}</div>`;
    });
    $('mc-prod').innerHTML = rows.join('');
  } catch {}
}

function translate() {
  document.querySelectorAll('[data-i18n]').forEach(e => { const v = t()[e.dataset.i18n]; if (typeof v === 'string') e.textContent = v; });
  $('mc-fullscreen').textContent = t()[document.fullscreenElement ? 'exitFullscreen' : 'fullscreen'];
  $('mc-play').textContent = st.playing ? t().pause : t().play;
  if (!data) return;
  if (item) {
    renderDetailStatic();
    st.prodFrame = -1;
  } else renderLibrary();
}

function viewerWindow() {
  try {
    const w = $('mc-viewer').contentWindow;
    return w && w.main_has_been_called && typeof w._replay_get_value === 'function' && w._replay_get_value(4) > 0 ? w : null;
  } catch { return null; }
}

function applyView(w) {
  if (typeof w._fog_of_war_set_value !== 'function' || typeof w._fog_of_war_player_set_value !== 'function') return false;
  const self = st.view === 'self';
  w._fog_of_war_set_value(self ? 1 : 0);
  for (const p of w.players) w._fog_of_war_player_set_value(p, !self || w.UTF8ToString(w._player_get_value(p, w.C_NICK)) === item.self_name ? 1 : 0);
  if (typeof w.update_fow_button === 'function') w.update_fow_button();
  if (typeof w.update_player_vision_buttons === 'function') w.update_player_vision_buttons();
  if (typeof w.request_static_repaint_if_needed === 'function') w.request_static_repaint_if_needed();
  st.viewApplied = st.view;
  return true;
}

function liveSeek(f, pause) {
  f = Math.max(0, Math.min(item.frame, Math.round(f)));
  const w = viewerWindow();
  st.liveSeek = f; st.frame = f;
  if (w && pause && typeof w.ensure_paused === 'function') w.ensure_paused();
  renderFrame();
}

function jumpCmd(dir) {
  const keys = keyEvents(), f = Math.round(st.frame);
  if (!keys.length) return;
  let i = dir > 0 ? keys.findIndex(e => e.frame > f) : lastAt(keys, f - 1, e => e.frame);
  if (i < 0 || i >= keys.length) return;
  liveSeek(keys[i].frame, true);
}

function setPlaying(on) {
  const w = viewerWindow(); if (!w) return;
  if (on && st.frame >= item.frame) liveSeek(0, false);
  w._replay_set_value(1, on ? 0 : 1);
  if (typeof w.sync_viewer_runtime_state === 'function') w.sync_viewer_runtime_state();
  if (on && typeof w.hold_viewer_main_loop_awake === 'function') w.hold_viewer_main_loop_awake(2000);
  if (on && typeof w.resume_viewer_main_loop === 'function') w.resume_viewer_main_loop();
  st.playing = !!on;
  $('mc-play').textContent = st.playing ? t().pause : t().play;
  $('mc-play').setAttribute('aria-pressed', String(st.playing));
}

function tick(ts) {
  st.raf = requestAnimationFrame(tick);
  if (!item) return;
  const w = viewerWindow();
  $('mc-status').textContent = w ? t().ready : t().loading;
  if (!w) return;
  st.playing = !w._replay_get_value(1);
  $('mc-play').textContent = st.playing ? t().pause : t().play;
  $('mc-play').setAttribute('aria-pressed', String(st.playing));
  if (st.viewApplied !== st.view) applyView(w);
  if (st.liveSeek != null) {
    w.pendingRequestedReplayFrame = st.liveSeek;
    if (typeof w.hold_viewer_main_loop_awake === 'function') w.hold_viewer_main_loop_awake(2000);
    if (typeof w.resume_viewer_main_loop === 'function') w.resume_viewer_main_loop();
    st.liveTarget = {frame: st.liveSeek, since: ts};
    st.liveSeek = null;
  } else if (w.pendingRequestedReplayFrame == null) {
    const f = Math.min(item.frame, w._replay_get_value(2)), target = st.liveTarget;
    if (target && Math.abs(f - target.frame) > 24 && ts - target.since < 20000) return;
    st.liveTarget = null;
    if (f !== st.lastRendered) { st.frame = f; renderFrame(); }
    if (Math.abs(f - st.prodFrame) >= 8 || f < st.prodFrame || st.prodView !== st.view) {
      st.prodFrame = f; st.prodView = st.view; renderProduction(w);
    }
  }
}

function loadPlayer() {
  const v = new URL('../viewer/native.html', location.href);
  const rep = new URL(item.file, location.href); rep.searchParams.set('v', item.sha256.slice(0, 12));
  v.searchParams.set('rep', rep.href);
  v.searchParams.set('lang', lang);
  v.searchParams.set('nick1', item.self_name); v.searchParams.set('name1', lang === 'zh' ? `我方 · ${item.tested}` : `Ours · ${item.tested}`);
  v.searchParams.set('nick2', item.opponent_name); v.searchParams.set('name2', item.opponent);
  $('mc-viewer').src = v.href;
  renderProduction(null);
  cancelAnimationFrame(st.raf);
  st.raf = requestAnimationFrame(tick);
}

$('mc-view').onclick = e => {
  const b = e.target.closest('[data-view]'); if (!b) return;
  st.view = b.dataset.view; st.viewApplied = null;
  for (const x of $('mc-view').querySelectorAll('button')) x.setAttribute('aria-pressed', String(x === b));
};
$('mc-prev').onclick = () => jumpCmd(-1);
$('mc-next').onclick = () => jumpCmd(1);
$('mc-play').onclick = () => setPlaying(!st.playing);
$('mc-seek').oninput = e => liveSeek(+e.target.value, true);
$('mc-speed').onchange = () => {
  const w = viewerWindow();
  if (w) { w._replay_set_value(0, +$('mc-speed').value); if (typeof w.update_speed === 'function') w.update_speed(+$('mc-speed').value); }
};
$('mc-show-keep').onchange = renderLog;
$('mc-fullscreen').onclick = async () => { try { if (document.fullscreenElement) await document.exitFullscreen(); else await $('mc-screen').requestFullscreen(); } catch {} };
document.addEventListener('fullscreenchange', () => { $('mc-fullscreen').textContent = t()[document.fullscreenElement ? 'exitFullscreen' : 'fullscreen']; });
document.addEventListener('site-language-change', e => { lang = e.detail; translate(); });

async function boot() {
  lang = new URLSearchParams(location.search).get('lang') === 'zh' ? 'zh' : (document.documentElement.lang === 'zh-CN' ? 'zh' : 'en');
  translate();
  try {
    const r = await fetch('data/index.json', {cache: 'no-cache'}); if (!r.ok) throw new Error('HTTP ' + r.status);
    data = await r.json();
    const id = params.get('id');
    if (id) {
      for (const candidate of data.runs) { const found = candidate.items.find(x => x.id === id); if (found) { item = found; run = candidate; } }
      $('mc-library').hidden = true;
      if (!item) { $('mc-missing').hidden = false; return; }
      $('mc-detail').hidden = false;
      const dr = await fetch(`data/${encodeURIComponent(id)}.json`, {cache: 'no-cache'});
      detail = dr.ok ? await dr.json() : {end_frame: item.frame, events: [], tasks: []};
      translate();
      loadPlayer();
    } else translate();
  } catch (error) { $('mc-library').hidden = true; $('mc-error').hidden = false; $('mc-error-detail').textContent = error.message; }
}
boot();
