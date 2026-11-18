'use strict';
const SEC_PER_FRAME = 0.042, FPS = 1 / SEC_PER_FRAME, TILE = 32, PX = 4;
const KEY_COLOR = {1: '#9aa7a0', 2: '#e0c46b', 3: '#7fc8c0', 4: '#7fc8c0', 5: '#e8a06b', 6: '#e8836b', 7: '#b48be0', 8: '#8fb4d9', 9: '#c4db91', 0: '#6f7b74'};
const STATUS = {applied: '已下令', task_confirmed: '重复按键，保留原任务', auto_restored: '已交回 bot', mining_locked: '矿锁开启',
  mode_selected: '已选范围', expansion_unknown: '未找到目标，保持原任务', no_scout_probe: '未执行：没有侦察探机',
  scout_evade_applied: '已接管探机避险', squad_split: '小队已建立', mode_unchanged: '范围保持不变',
  not_enough_healthy_units: '健康兵力不足，未分队', waiting_units: '已记录，等待作战单位',
  patrol_reanchored: '警戒岗位已更新，保留有效集火', mining_unavailable: '采矿接管未成功，原控制保留'};
const ACTION = {attack: '进攻主基地', expansion: '近敌/分矿建筑', clear_enemies: '区域警戒', retreat: '撤离 / 集结', defend: '全军回防'};
const PHASE = {engaging: '接战', advancing: '前进', patrol_waiting: '警戒待命', patrol_engaging: '警戒接战', patrol_searching: '警戒搜索',
  rally_joining: '汇合', rally_withdrawing: '撤离中', rally_waiting: '集结待命', returning: '回防途中', reforming: '重整', waiting_units: '等待部队',
  evading_cloak: '避让未侦测隐形威胁', waiting_detection: '等待反隐', detection_skirmishing: '等待反隐期间安全交战',
  assembly_waiting: '原地等待援兵', assembly_joining: '援兵汇合', assembly_defending: '集结区还击', assembly_evading: '局部避险', assembly_shared_refuge: '共同局部避险',
  main_outer_pylon: '拆外围水晶', main_outer_building: '拆外围建筑', main_core: '拆主建筑', main_combat: '优先处理敌军炮台', main_surveying: '扫查主区域迷雾', main_confirming: '确认区域清空', main_blocked: '目标暂不可达', main_advancing: '从外围推进',
  standby_forming: '清理后展开待命', standby_waiting: '附近待命', standby_engaging: '待命区迎敌', standby_returning: '返回待命岗位', standby_blocked: '等待安全空位',
  gathering: '正在集结', holding: '集结待命', retreating: '脱离危险', regrouping: '安全汇合', safe: '已安全撤离', guarding: '基地防守', defending: '基地交战', intercepting: '防区拦截', waiting_reinforcements: '等待自动补兵', lost: '队伍已损失'};
const NOTICE = {base_notice: '基地提示', building_target_locked: '锁定建筑目标', building_target_confirmed: '目标确认', building_complete: '建筑目标完成',
  rendezvous_point: '设定集结点', flight_burst_start: '单位脱战', scout_probe_seen: '发现侦察探机', defence_post: '设定防守岗位', base_allocation: '多基地分兵', end: '对局结束'};
const UNIT_ZH = {'Protoss Probe': '探机', 'Protoss Zealot': '狂热者', 'Protoss Dragoon': '龙骑', 'Protoss High Templar': '高阶圣堂武士', 'Protoss Dark Templar': '黑暗圣堂武士',
  'Protoss Archon': '执政官', 'Protoss Dark Archon': '黑暗执政官', 'Protoss Shuttle': '运输机', 'Protoss Reaver': '金甲虫', 'Protoss Scarab': '圣甲虫', 'Protoss Observer': '观察者',
  'Protoss Scout': '侦察机', 'Protoss Corsair': '海盗船', 'Protoss Carrier': '航母', 'Protoss Interceptor': '截击机', 'Protoss Arbiter': '仲裁者',
  'Protoss Nexus': '星灵枢纽', 'Protoss Pylon': '水晶塔', 'Protoss Assimilator': '吸收厂', 'Protoss Gateway': '传送门', 'Protoss Forge': '熔炉',
  'Protoss Cybernetics Core': '控制核心', 'Protoss Photon Cannon': '光子炮台', 'Protoss Shield Battery': '护盾充能器', 'Protoss Robotics Facility': '机械台',
  'Protoss Robotics Support Bay': '机械辅助站', 'Protoss Observatory': '观测站', 'Protoss Citadel of Adun': '亚顿之庭', 'Protoss Templar Archives': '圣堂档案馆',
  'Protoss Stargate': '星门', 'Protoss Fleet Beacon': '舰队航标', 'Protoss Arbiter Tribunal': '仲裁者法庭',
  'Singularity Charge': '龙骑射程', 'Leg Enhancements': '狂热者速度', 'Protoss Ground Weapons': '地面武器', 'Protoss Ground Armor': '地面护甲',
  'Protoss Plasma Shields': '护盾', 'Protoss Air Weapons': '空中武器', 'Protoss Air Armor': '空中护甲', 'Psionic Storm': '灵能风暴'};
const REASON = {depot_destroyed: '目标建筑已摧毁', frontline_withdrawal: '前线撤离', cover_entrance: '守住路口', protect_threatened_assets:'保护受威胁的建筑', occupied_point:'集结点改到已占领位置'};
Object.assign(NOTICE, {main_target_selected:'选择区域清场目标', main_building_cleared:'确认建筑清除', patrol_reanchored:'更新警戒岗位', assembly_refuge:'调整共同避险点', assembly_post_adjusted:'调整堵路岗位', detection_resumed:'恢复原任务', scout_evade_lost:'避险探机损失'});
Object.assign(REASON, {main_area_cleared:'主基地区域已确认清完', site_confirmed_empty:'原址已确认清空', destroyed:'已确认被毁', footprint_checked:'原址已检查', relocated_outside:'建筑已移出区域', friendly_blockage:'友军堵路，调整单个岗位'});

const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'}[c]));
const clock = f => { const s = Math.floor(f * SEC_PER_FRAME); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
const kb = n => n > 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.round(n / 1024)} KB`;
const lastAt = (rows, f, get = r => r[0]) => { let lo = 0, hi = rows.length - 1, at = -1; while (lo <= hi) { const m = (lo + hi) >> 1; if (get(rows[m]) <= f) { at = m; lo = m + 1; } else hi = m - 1; } return at; };
const realGoal = g => g && g[0] < 30000 && g[1] < 30000;

// mode 'live' = the site's web viewer (native.html: upstream OpenBW without the archived-server gas-exit patch, which
// matches original StarCraft 1.16.1 on these matches); mode 'map' = schematic drawn from the logs only.
const st = {mode: 'live', view: 'self', centerOn: null, prodFrame: -1, frame: 0, playing: false, raf: 0, lastTs: 0, liveKey: null, liveSeek: null, liveTarget: null, viewApplied: null, lastRendered: -1};
let index, terrain, game, col, eco, profiles, routeSerial = 0, charts = [];
function profileFor(version) {
  return Object.values(profiles).find(p => p.id === version || p.aliases.includes(version));
}
const commandKey = c => c.display_key || (String(c.key) === '8' && c.modifier === 'alt' ? 'Alt+8' : String(c.key));
const commandName = c => c.display_name || profileFor(c.keymap || game.keymap)?.keys[commandKey(c)] || `按键 ${commandKey(c)}（含义未确认）`;
const commandColor = c => KEY_COLOR[c.key] || '#9aa7a0';
const recorded = x => x == null ? '未记录' : x;
function taskName(action) {
  if (action === 'attack' && (game.keymap_id === 'tenkeys_main_area_v16' || /main.area.v16/.test(game.keymap))) return '主基地区域清场';
  return ACTION[action] || {rally:'集结', hold:'就地固守', baseline:'Bot自动控制'}[action] || action;
}

async function main() {
  const get = url => fetch(url).then(r => { if (!r.ok) throw new Error(`${r.status} ${url}`); return r.json(); });
  const [list, definitions] = await Promise.all([get('data/index.json'), get('data/keymaps.json')]);
  index = list; profiles = Object.fromEntries(Object.entries(definitions.profiles).map(([id,p]) => [id, {...p, id}]));
  $('games').innerHTML = index.matches.map((m,i) => `<button class="hl" data-id="${m.id}"><span class="tag">第 ${i+1} 局 · ${esc(m.map)}</span><h3>对 ${esc(m.opponent)}</h3><p class="chips"><span class="chip ${m.result}">${m.result === 'win' ? '胜' : m.result === 'loss' ? '负' : '结果未确认'}</span><span class="chip">${clock(m.end_frame)}</span><span class="chip">${m.commands} 次按键</span>${m.record_note?'<span class="chip">短局·见记录说明</span>':''}</p></button>`).join('');
  $('games').addEventListener('click', e => { const b = e.target.closest('[data-id]'); if (b) { history.pushState(null, '', `?match=${b.dataset.id}`); route().then(() => $('detail').scrollIntoView({block:'start'})); } });
  window.addEventListener('popstate', route);
  wireControls();
  st.raf = requestAnimationFrame(tick);
  route();
}

async function route() {
  const serial = ++routeSerial;
  const id = new URLSearchParams(location.search).get('match') || index.matches[0].id;
  document.querySelectorAll('#games .hl').forEach(b => b.classList.toggle('active', b.dataset.id === id));
  if (game && game.id === id) return;
  setPlaying(false);
  const incoming = await fetch(`data/${encodeURIComponent(id)}.json`).then(r => r.ok ? r.json() : null);
  if (serial !== routeSerial) return;
  if (!incoming) { $('detail').hidden = true; return; }
  const mapFile = incoming.terrain_file || incoming.terrain || {'Benzene':'data/terrain/benzene.json','Heartbreak Ridge':'data/terrain/heartbreak-ridge.json','Destination':'data/destination-terrain.json'}[incoming.map];
  const mapData = await fetch(mapFile).then(r => {if(!r.ok)throw new Error('地图地形缺失');return r.json();});
  if (serial !== routeSerial) return;
  game = incoming; terrain = mapData; terrainImg = null;
  $('map').width=terrain.width*PX; $('map').height=terrain.height*PX;
  $('map').style.aspectRatio = `${terrain.width} / ${terrain.height}`;
  $('map').setAttribute('aria-label', `${game.map} 俯视示意图：镜头位置和我方部队`);
  col = Object.fromEntries(game.state_fields.map((k, i) => [k, i]));
  eco = Object.fromEntries(game.economy_fields.map((k, i) => [k, i]));
  st.frame = 0; st.liveKey = null; st.prodFrame = -1; st.prodView = null; st.lastRendered = -1;
  renderDetail();
  setMode(st.mode);
}

function renderDetail() {
  const g = game, me = g.players.find(p => p.id === g.self_player_id), foe = g.players.find(p => p.id !== g.self_player_id);
  $('detail').hidden = false;
  $('d-eyebrow').textContent = g.map;
  $('d-title').textContent = `人类指挥 vs ${g.opponent}`;
  $('d-sub').textContent = `我方 ${me.race}（录像内名 ${me.name}）· 对手 ${g.opponent} ${foe.race}（录像内名 ${foe.name}）· 时长 ${clock(g.end_frame)}（${g.end_frame} 帧）`;
  $('d-results').innerHTML = `<span class="chip ${g.result}">${g.result === 'win' ? '我方胜' : '我方负'}</span><span class="chip">${g.commands.length} 次按键</span>`;
  document.title = `人类指挥 vs ${g.opponent} · Replay Archive`;
  $('seek').max = g.end_frame;
  const profile = profileFor(g.keymap_id || g.keymap);
  $('keymap-title').textContent = g.keymap_label || profile?.label || '历史版本未确认';
  $('keymap-rule').textContent = g.version_rule || profile?.rule || '此版本尚无可靠释义；只展示原始记录。';
  $('keymap-keys').textContent = Object.entries(g.key_labels || profile?.keys || {}).map(([key,name])=>`${key} ${name}`).join('　');
  $('record-note').textContent = g.record_note || '';
  renderCharts(); renderLog(); renderEvents(); renderFiles();
}

// ---------- web viewer ----------
const viewerWindow = () => {
  try {
    const frame = $('viewer'), w = frame.contentWindow;
    // iframe navigation leaves the preceding document alive briefly.
    const loadedReplay = w && new URL(w.location.href).searchParams.get('rep');
    const wantedReplay = frame.src && new URL(frame.src).searchParams.get('rep');
    return w && loadedReplay && loadedReplay === wantedReplay && w.main_has_been_called && typeof w._replay_get_value === 'function' && w._replay_get_value(4) > 0 ? w : null;
  }
  catch { return null; }
};
function loadLive() {
  const g = game;
  if (st.liveKey === g.id) return;
  st.liveKey = g.id; st.viewApplied = null; st.liveSeek = null;
  st.liveTarget = {frame: Math.round(st.frame), since: performance.now()};
  const me = g.players.find(p => p.id === g.self_player_id), foe = g.players.find(p => p.id !== g.self_player_id);
  const v = new URL('../viewer/native.html', location.href);
  v.searchParams.set('rep', new URL(g.files.replay, location.href).href);
  v.searchParams.set('lang', 'zh');
  v.searchParams.set('frame', Math.round(st.frame));
  v.searchParams.set('nick1', me.name); v.searchParams.set('name1', '我方 · 人类指挥');
  v.searchParams.set('nick2', foe.name); v.searchParams.set('name2', g.opponent);
  $('viewer').src = v.href;
}
// 我方视角: fog of war on and only our player's vision; 全局视角: fog of war off.
function applyView(w) {
  if (typeof w._fog_of_war_set_value !== 'function' || typeof w._fog_of_war_player_set_value !== 'function') return false;
  const meName = game.players.find(p => p.id === game.self_player_id).name;
  const self = st.view === 'self';
  w._fog_of_war_set_value(self ? 1 : 0);
  for (const p of w.players) w._fog_of_war_player_set_value(p, !self || w.UTF8ToString(w._player_get_value(p, w.C_NICK)) === meName ? 1 : 0);
  if (typeof w.update_fow_button === 'function') w.update_fow_button();
  if (typeof w.update_player_vision_buttons === 'function') w.update_player_vision_buttons();
  if (typeof w.request_static_repaint_if_needed === 'function') w.request_static_repaint_if_needed();
  st.viewApplied = st.view;
  return true;
}
// What each side is building at the viewer's current frame (same data as the viewer's own Production dock,
// which the viewer hides below ~1480px width).
function productionAt(w) {
  const funcs = w.Module.get_util_funcs(), side = {}, name = (kind, id) => { const n = w.display_name_for_icon(kind, id); return UNIT_ZH[n] || n; };
  const add = (owner, label, done) => (side[owner] = side[owner] || []).push([label, done]);
  const inc = funcs.get_all_incomplete_units();
  for (let i = 0; i < inc.length; i++) {
    const u = inc[i], t = u.build_type() || u.unit_type();
    if (t.id === 73 || t.id === 85) continue;  // interceptors and scarabs are built continuously inside their carrier/reaver
    add(u.owner, name('unit', t.id), 1 - u.remaining_build_time / t.build_time);
  }
  for (const p of w.players) {
    const up = funcs.get_incomplete_upgrades(p), re = funcs.get_incomplete_research(p);
    for (let i = 0; i < up.length; i++) add(p, name('upgrade', up[i].id), 1 - up[i].remaining_time / up[i].total_time);
    for (let i = 0; i < re.length; i++) add(p, name('tech', re[i].id), 1 - re[i].remaining_time / re[i].total_time);
  }
  return side;
}
function renderProduction(w) {
  if (!w) { $('production').innerHTML = '<span class="muted">播放器载入中…</span>'; return; }
  const side = productionAt(w), meName = game.players.find(p => p.id === game.self_player_id).name;
  const rows = w.players.filter(p => st.view === 'all' || w.UTF8ToString(w._player_get_value(p, w.C_NICK)) === meName).map(p => {
    const mine = w.UTF8ToString(w._player_get_value(p, w.C_NICK)) === meName, items = (side[p] || []).sort((a, b) => b[1] - a[1]);
    const counted = new Map(); for (const [n, d] of items) { const c = counted.get(n) || {n, k: 0, d: 0}; c.k++; c.d = Math.max(c.d, d); counted.set(n, c); }
    const list = [...counted.values()].map(c => `<span class="hc-pill"><i style="width:${Math.round(c.d * 100)}%"></i>${esc(c.n)}${c.k > 1 ? ` ×${c.k}` : ''}</span>`).join('') || '<span class="muted">无</span>';
    return `<div><b>${mine ? '我方' : esc(game.opponent)}</b> ${list}</div>`;
  });
  $('production').innerHTML = rows.join('');
}
function centerCamera(xy) {
  const w = viewerWindow();
  if (w && realGoal(xy) && typeof w._ui_set_screen_center === 'function') { w._ui_set_screen_center(xy[0], xy[1]); if (typeof w.request_static_repaint_if_needed === 'function') w.request_static_repaint_if_needed(); }
}
function liveSeek(f, pause) {
  const w = viewerWindow();
  st.liveSeek = Math.round(f); st.frame = st.liveSeek;
  if (w && pause && typeof w.ensure_paused === 'function') w.ensure_paused();
  render();
}

// ---------- controls ----------
function wireControls() {
  $('mode-switch').onclick = e => { const b = e.target.closest('[data-mode]'); if (b) setMode(b.dataset.mode); };
  $('view-switch').onclick = e => { const b = e.target.closest('[data-view]'); if (!b) return; st.view = b.dataset.view; st.viewApplied = null; for (const x of $('view-switch').querySelectorAll('button')) x.setAttribute('aria-pressed', x === b); };
  $('play').onclick = () => setPlaying(st.mode === 'live' ? !!viewerWindow()?._replay_get_value(1) : !st.playing);
  $('seek').oninput = e => seek(+e.target.value);
  $('prev-cmd').onclick = () => jumpCmd(-1);
  $('next-cmd').onclick = () => jumpCmd(1);
  $('show-repeat').onchange = renderLog;
  $('speed').onchange = () => {const w=viewerWindow();if(st.mode==='live' && w){w._replay_set_value(0,+$('speed').value);if(typeof w.update_speed==='function')w.update_speed(+$('speed').value);}};
  $('map').onclick = () => setPlaying(!st.playing);
}
function setMode(mode) {
  setPlaying(false);
  st.mode = mode;
  for (const b of $('mode-switch').querySelectorAll('[data-mode]')) b.setAttribute('aria-pressed', b.dataset.mode === mode);
  const live = mode === 'live', w = viewerWindow();
  if (!live && w && typeof w.ensure_paused === 'function') w.ensure_paused();
  $('viewer').hidden = !live; $('map').hidden = live; $('map-legend').hidden = live; $('view-switch').hidden = !live;
  document.querySelectorAll('.hc-map-only').forEach(el => { el.hidden = false; });
  $('screen-note').textContent = live
    ? '网页播放器实时重放本局原始 .rep。播放、暂停、倍速、进度条、上一／下一操作和按键记录都与播放器帧号联动。我方视角开启我方战争迷雾，全局视角显示全部；切换视角不会改变回放内容。右侧数据来自该局自己的日志，按该局操作版本解释；未记录的数据如实标注。'
    : '战术示意图只用本局日志绘制：镜头框取自本局记录的玩家镜头轨迹，单位点取自指挥层的作战采样，不是完整单位画面。时间按"最快"游戏速度换算（每帧 0.042 秒）。';
  if (live) { loadLive(); st.liveSeek = Math.round(st.frame); }
  render();
}
function jumpCmd(dir) {
  const cmds = game.commands, f = Math.round(st.frame);
  let i = dir > 0 ? cmds.findIndex(c => c.frame > f) : lastAt(cmds, f - 1, c => c.frame);
  if (i < 0 || i >= cmds.length) return;
  seek(cmds[i].frame, true);
  st.centerOn = cmds[i].origin;
}
function setPlaying(on) {
  if (st.mode === 'live') {
    const w=viewerWindow();if(!w)return;
    if(on && st.frame>=game.end_frame)liveSeek(0,false);
    w._replay_set_value(1,on?0:1);
    if(typeof w.sync_viewer_runtime_state==='function')w.sync_viewer_runtime_state();
    if(on && typeof w.hold_viewer_main_loop_awake==='function')w.hold_viewer_main_loop_awake(2000);
    if(on && typeof w.resume_viewer_main_loop==='function')w.resume_viewer_main_loop();
    st.playing=!!on;return;
  }
  st.playing = on && !!game && st.mode === 'map';
  $('play').textContent = st.playing ? '暂停' : '播放'; $('play').setAttribute('aria-pressed', st.playing);
  if (st.playing && st.frame >= game.end_frame) st.frame = 0;
  st.lastTs = 0;
}
function seek(f, pause = false) {
  f = Math.max(0, Math.min(game.end_frame, f));
  if (st.mode === 'live') { liveSeek(f, true); return; }
  if (pause) setPlaying(false);
  st.frame = f; render();
}
function tick(ts) {
  st.raf = requestAnimationFrame(tick);
  if (!game) return;
  if (st.mode === 'live') {
    const w = viewerWindow();
    if (!w) return;
    st.playing=!w._replay_get_value(1); $('play').textContent=st.playing?'暂停':'播放'; $('play').setAttribute('aria-pressed',st.playing);
    if (st.viewApplied !== st.view) applyView(w);
    if (st.liveSeek != null) {
      w.pendingRequestedReplayFrame = st.liveSeek;
      if (typeof w.hold_viewer_main_loop_awake === 'function') w.hold_viewer_main_loop_awake(2000);
      if (typeof w.resume_viewer_main_loop === 'function') w.resume_viewer_main_loop();
      st.liveTarget = {frame: st.liveSeek, since: ts}; st.liveSeek = null;
    } else if (w.pendingRequestedReplayFrame == null) {
      const f = Math.min(game.end_frame, w._replay_get_value(2)), t = st.liveTarget;
      // A seek fast-forwards through intermediate frames; keep showing the target until the viewer gets there.
      if (t && Math.abs(f - t.frame) > 24 && ts - t.since < 20000) return;
      st.liveTarget = null;
      if (st.centerOn) { centerCamera(st.centerOn); st.centerOn = null; }
      if (f !== st.lastRendered) { st.frame = f; render(); }
      if (Math.abs(f - st.prodFrame) >= 8 || f < st.prodFrame || st.prodView !== st.view) { st.prodFrame = f; st.prodView = st.view; renderProduction(w); }
    }
  } else if (st.playing) {
    if (st.lastTs) st.frame += Math.min(250, ts - st.lastTs) / 1000 * FPS * +$('speed').value;
    st.lastTs = ts;
    if (st.frame >= game.end_frame) { st.frame = game.end_frame; setPlaying(false); }
    render();
  }
}

// ---------- side panel ----------
function render() {
  const f = Math.floor(st.frame), g = game;
  st.lastRendered = f;
  $('seek').value = f;
  $('clock').textContent = `${clock(f)} / ${clock(g.end_frame)} · 帧 ${f}`;
  const h = g.hud[lastAt(g.hud, f)];
  $('hud').textContent = h ? h[3].join('\n') : g.hud.length ? '（尚无提示记录）' : '该版日志未保存游戏内提示文字，按键释义见本局版本说明。';
  const ci = lastAt(g.commands, f, c => c.frame), c = g.commands[ci];
  $('cmd-pos').textContent = `操作 ${ci + 1} / ${g.commands.length}`;
  $('last-cmd').innerHTML = c ? `<span class="hc-key" style="background:${commandColor(c)}">${esc(commandKey(c))}</span><b>${esc(commandName(c))}</b> <span class="muted">${clock(c.frame)} · 帧 ${c.frame} · ${Math.round((f - c.frame) * SEC_PER_FRAME)} 秒前</span><br><span class="small">${esc(STATUS[c.status] || c.status)} · 范围 ${c.mode === 'all' ? '全队' : c.mode==='squad'?'小队':'该版未记录'} · 涉及 ${recorded(c.unit_count)} 个单位</span><br><span class="small muted">反馈：${esc(hudTipAfter(c.frame))}</span>` : '<span class="muted">还没有按键，全部由 bot 自己决定</span>';
  const s = g.states[lastAt(g.states, f)], e = g.economy[lastAt(g.economy, f)];
  $('stats').innerHTML = s ? [
    ['农民', recorded(s[col.workers])], ['作战单位', `${recorded(s[col.army])}（健康 ${recorded(s[col.healthy_army])}）`],
    ['累计采矿 / 气', `${recorded(s[col.gathered_minerals])} / ${recorded(s[col.gathered_gas])}`],
    e ? ['存量矿 / 气', `${e[eco.minerals]} / ${e[eco.gas]}`] : null, e ? ['基地', e[eco.nexuses]] : null,
    ['矿锁', s[col.mining_lock] == null ? '该版未记录' : s[col.mining_lock] ? '开' : '关'],
  ].filter(Boolean).map(([k, v]) => `<dt>${k}</dt><dd>${esc(v)}</dd>`).join('') : '';
  const t = g.tasks[lastAt(g.tasks, f)];
  // state rows come every 120 frames, so a battle_state newer than the last state row is trusted on its own.
  const active = t && (f - t[0] < 240 || (s && (s[col.main_task] === t[1] || s[col.squad_task] === t[1]) && f - t[0] < 1200));
  $('task').innerHTML = active ? `任务 #${t[1]} · <b>${esc(taskName(t[2]))}</b> · ${esc(PHASE[t[3]] || t[3])}<br><span class="muted small">${t[5]} 个单位，已到位 ${t[4] ?? '–'} · 状态记录于 ${clock(t[0])}</span>` : g.keymap==='eight-key-top-row-v1' && s ? `本局记录状态：${esc(taskName(s[col.stance]))}；该版未记录任务编号。` : '<span class="muted">没有人工任务，部队由 bot 自己控制</span>';
  $('recent').innerHTML = g.commands.slice(Math.max(0, ci - 3), ci + 1).reverse().map(x => `<li><span class="hc-key" style="background:${commandColor(x)}">${esc(commandKey(x))}</span>${clock(x.frame)} ${esc(commandName(x))} <span class="muted">${esc(STATUS[x.status] || x.status)}</span></li>`).join('') || '<li class="muted">无</li>';
  if (st.mode === 'map') { drawMap(f, active ? t : null); $('production').innerHTML = '<span class="muted">切换到游戏画面后显示</span>'; }
  charts.forEach(ch => ch.set(f));
  document.querySelectorAll('#log .entry').forEach(el => el.classList.toggle('active', +el.dataset.i === ci));
}

// ---------- schematic map ----------
let terrainImg = null;
function terrainLayer() {
  if (terrainImg) return terrainImg;
  const small = document.createElement('canvas'); small.width = terrain.width; small.height = terrain.height;
  const img = small.getContext('2d').createImageData(terrain.width, terrain.height);
  const level = [[29, 38, 34], [29, 38, 34], [44, 55, 49], [44, 55, 49], [60, 73, 65], [60, 73, 65]];
  terrain.terrain.forEach((row, y) => row.forEach((v, x) => {
    const hgt = Math.floor(v / 100), walk = Math.floor((v % 100) / 2) / 16, build = v % 2;
    const [r, gg, b] = level[hgt] || level[0], k = walk * (build ? 1 : .82), at = (y * terrain.width + x) * 4;
    img.data[at] = 9 + (r - 9) * k; img.data[at + 1] = 12 + (gg - 12) * k; img.data[at + 2] = 11 + (b - 11) * k; img.data[at + 3] = 255;
  }));
  small.getContext('2d').putImageData(img, 0, 0);
  terrainImg = document.createElement('canvas'); terrainImg.width = terrain.width * PX; terrainImg.height = terrain.height * PX;
  const ctx = terrainImg.getContext('2d'); ctx.imageSmoothingEnabled = true; ctx.drawImage(small, 0, 0, terrainImg.width, terrainImg.height);
  return terrainImg;
}
function drawMap(f, task) {
  const ctx = $('map').getContext('2d'), sc = PX / TILE, g = game;
  ctx.drawImage(terrainLayer(), 0, 0);
  const cam = g.camera[lastAt(g.camera, f)];
  if (cam && g.render_size) { ctx.strokeStyle = '#e7eee8'; ctx.lineWidth = 1.5; ctx.strokeRect(cam[1] * sc, cam[2] * sc, g.render_size[0] * sc, g.render_size[1] * sc); }
  const lo = lastAt(g.samples, f - 48) + 1, hi = lastAt(g.samples, f), seen = new Set();
  ctx.fillStyle = '#3d6ee0';
  for (let i = hi; i >= lo && i >= 0; i--) { const s = g.samples[i]; if (seen.has(s[1])) continue; seen.add(s[1]); ctx.beginPath(); ctx.arc(s[2] * sc, s[3] * sc, 3, 0, 7); ctx.fill(); }
  const s = g.states[lastAt(g.states, f)];
  if (s && s[col.army] > 0 && realGoal(s[col.center])) { ctx.strokeStyle = '#8fb4d9'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(s[col.center][0] * sc, s[col.center][1] * sc, 7, 0, 7); ctx.stroke(); }
  const goal = task ? task[6] : null;
  if (realGoal(goal)) { const x = goal[0] * sc, y = goal[1] * sc; ctx.strokeStyle = '#e8836b'; ctx.lineWidth = 2; ctx.strokeRect(x - 6, y - 6, 12, 12); ctx.beginPath(); ctx.moveTo(x - 4, y - 4); ctx.lineTo(x + 4, y + 4); ctx.moveTo(x + 4, y - 4); ctx.lineTo(x - 4, y + 4); ctx.stroke(); }
}

// ---------- charts ----------
function chart(el, {series, xmax, marks = [], bars = null, unit = ''}) {
  const W = 960, H = bars ? 120 : 210, L = 38, R = 10, T = 16, B = 24, iw = W - L - R, ih = H - T - B;
  const vals = bars ? bars.values : series.flatMap(s => s.rows.map(s.get));
  const raw = Math.max(1, ...vals), step = [1, 2, 5, 10, 20, 25, 50, 100, 200, 500].find(v => raw / v <= 4) || 1000, ymax = Math.ceil(raw / step) * step;
  const x = f => L + f / xmax * iw, y = v => T + ih - v / ymax * ih;
  let svg = `<svg viewBox="0 0 ${W} ${H}" role="img">`;
  for (let v = 0; v <= ymax; v += step) svg += `<line x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}" stroke="var(--grid)"/><text x="${L - 6}" y="${y(v) + 4}" text-anchor="end" font-size="10" fill="var(--muted)">${v}</text>`;
  for (let sec = 0; sec / SEC_PER_FRAME <= xmax; sec += 120) svg += `<text x="${x(sec / SEC_PER_FRAME)}" y="${H - 6}" text-anchor="middle" font-size="10" fill="var(--muted)">${sec / 60}:00</text>`;
  if (bars) bars.values.forEach((v, i) => { if (v) svg += `<rect x="${x(i * bars.bin) + 1}" y="${y(v)}" width="${Math.max(1, x(bars.bin) - x(0) - 2)}" height="${T + ih - y(v)}" fill="${bars.color}" opacity=".8"/>`; });
  for (const s of series) svg += `<path d="${s.rows.map((r, i) => `${i ? 'L' : 'M'}${x(r[0]).toFixed(1)},${y(s.get(r)).toFixed(1)}`).join('')}" fill="none" stroke="${s.color}" stroke-width="2" stroke-linejoin="round"/>`;
  for (const m of marks) svg += `<path d="M${x(m.x) - 4},${T - 10}L${x(m.x) + 4},${T - 10}L${x(m.x)},${T - 3}Z" fill="${m.color}"><title>${clock(m.x)} ${esc(m.label)}</title></path>`;
  svg += `<line class="cursor" x1="0" x2="0" y1="${T}" y2="${T + ih}" stroke="var(--text)" opacity=".5"/><rect x="${L}" y="${T}" width="${iw}" height="${ih}" fill="transparent"/></svg>`;
  el.innerHTML = svg + '<div class="tip" hidden></div>';
  const root = el.querySelector('svg'), cursor = root.querySelector('.cursor'), tip = el.querySelector('.tip');
  const fAt = e => { const b = root.getBoundingClientRect(); return Math.max(0, Math.min(xmax, ((e.clientX - b.left) / b.width * W - L) / iw * xmax)); };
  const label = f => bars ? `${bars.values[Math.floor(f / bars.bin)] || 0} ${unit}` : series.map(s => { const r = s.rows[lastAt(s.rows, f)]; return `<span style="color:${s.color}">●</span> ${s.name} ${r ? s.get(r) : '–'}`; }).join('<br>');
  root.addEventListener('mousemove', e => { const f = fAt(e); tip.innerHTML = `<b>${clock(f)}</b><br>${label(f)}`; tip.hidden = false; tip.style.left = `${Math.min(x(f) / W * el.clientWidth + 12, el.clientWidth - tip.offsetWidth - 4)}px`; });
  root.addEventListener('mouseleave', () => { tip.hidden = true; });
  root.addEventListener('click', e => seek(fAt(e), true));
  return {set: f => { cursor.setAttribute('x1', x(f)); cursor.setAttribute('x2', x(f)); }};
}
function renderCharts() {
  const g = game, marks = g.commands.filter(c => c.status !== 'task_confirmed').map(c => ({x: c.frame, color: commandColor(c), label: `${commandKey(c)} ${commandName(c)} · ${STATUS[c.status] || c.status}`}));
  charts = [
    chart($('c-units'), {xmax: g.end_frame, marks, series: [
      {name: '农民', color: '#e0c46b', rows: g.states, get: r => r[col.workers]},
      {name: '作战单位', color: '#8fb4d9', rows: g.states, get: r => r[col.army]}]}),
    chart($('c-activity'), {xmax: g.end_frame, series: [], unit: '条指令', bars: {bin: g.activity_bin, color: '#e8836b', values: g.activity.battle_order}}),
  ];
}

// ---------- logs ----------
function hudTipAfter(f) {
  const next=game.commands.find(c=>c.frame>f)?.frame ?? game.end_frame+1;
  const r = game.hud.find(x => x[0] >= f && x[0]<next);
  return r ? (r[3].find(s=>s.startsWith('提示')) || '').replace(/^提示：/, '') || '本次提示未记录' : '本次提示未记录';
}
const toScreen = () => $('hc-screen').scrollIntoView({behavior: 'smooth', block: 'center'});
function renderLog() {
  const g = game, showRepeat = $('show-repeat').checked, repeats = g.commands.filter(c => c.status === 'task_confirmed').length;
  $('log-note').textContent = `共 ${g.commands.length} 次按键，其中 ${repeats} 次是对同一任务的重复确认${showRepeat ? '' : '（已折叠）'}。"游戏反馈"是按键后游戏内提示栏显示的原文。帧号是指挥层记录指令生效的帧。点任意一条，回放跳到那一刻并暂停。`;
  $('log').innerHTML = g.commands.map((c, i) => (showRepeat || c.status !== 'task_confirmed') ? `<li class="entry${c.status === 'task_confirmed' ? ' keep' : ''}" data-i="${i}" data-f="${c.frame}"><time>${clock(c.frame)}<small>帧 ${c.frame}</small></time><div class="what"><span class="hc-key" style="background:${commandColor(c)}">${esc(commandKey(c))}</span><b>${esc(commandName(c))}</b><span class="k">涉及 <b>${recorded(c.unit_count)}</b> 个单位${c.mining_lock ? ' · 矿锁开' : ''}</span><span class="status${/unknown|no_|not_enough/.test(c.status) ? ' bad' : ''}">${esc(STATUS[c.status] || c.status)}</span></div><p class="effect">游戏反馈：${esc(hudTipAfter(c.frame))}</p></li>` : '').join('');
  $('log').onclick = e => { const li = e.target.closest('.entry'); if (li) { seek(+li.dataset.f, true); st.centerOn = g.commands[+li.dataset.i].origin; toScreen(); } };
  render();
}
function renderEvents() {
  $('events').innerHTML = game.notices.map(n => {
    const detail = n.message || (n.event === 'scout_probe_seen' ? `单位 #${n.reason}` : n.reason ? REASON[n.reason] || n.reason : '') || (n.event === 'end' ? (n.winner ? '我方胜' : '我方负') : '');
    return `<li class="entry keep" data-f="${n.frame}"><time>${clock(n.frame)}<small>帧 ${n.frame}</small></time><div class="what"><b>${esc(NOTICE[n.event] || n.event)}</b>${n.task_id != null ? `<span class="k">任务 #${n.task_id}</span>` : ''}</div>${detail ? `<p class="effect">${esc(detail)}</p>` : ''}</li>`;
  }).join('');
  $('events').onclick = e => { const li = e.target.closest('.entry'); if (li) { seek(+li.dataset.f, true); toScreen(); } };
}
function renderFiles() {
  const g = game;
  $('files').innerHTML = `<a class="button" href="${g.files.replay}" download>下载回放 .rep（${kb(g.files.replay_bytes)}）</a> <a class="button" href="${g.files.package}" download>下载完整对局包 .zip（${kb(g.files.package_bytes)}）</a><br><span class="muted">回放 SHA256 <code>${g.hashes.replay}</code></span>`;
  $('counts').innerHTML = '<caption class="muted small">指挥层日志 commander-layer.jsonl 各事件条数（页面只展示其中一部分，完整内容在对局包里）</caption>' +
    Object.entries(g.event_counts).map(([k, v]) => `<tr><td><code>${esc(k)}</code></td><td>${v}</td></tr>`).join('');
}

main().catch(err => { $('games').innerHTML = `<p class="muted">数据加载失败：${esc(err.message)}</p>`; });
