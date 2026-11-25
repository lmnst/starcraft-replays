'use strict';
const $ = id => document.getElementById(id);
const params = new URLSearchParams(location.search);
let lang = 'en', data = null, item = null, run = null, view = 'all', viewApplied = null, pollTimer = 0;

const T = {
  en: {
    title: 'Model commander iteration',
    intro: 'A language model commands our Protoss bot live through the same keyboard command layer used by human commanders. After each round it reviews the match logs and edits the bot\u2019s policy, then the next round tests the new version. One original replay is published per round.',
    runA: 'Run 1', runB: 'Run 2',
    runDesc: (r) => `${r.rounds} rounds · ${r.matches_per_round} matches per round (${r.parallel} in parallel) · ${r.map}`,
    runNoteA: 'Each round plays 2 matches; after the round the model revises the version or keeps it.',
    runNoteB: 'Each round plays the candidate version against the 3 core opponents plus one re-check of the current champion; the candidate is promoted or rejected by result.',
    round: 'Round', vs: 'vs', watch: 'Watch replay →', back: '← All rounds',
    win: 'Win', loss: 'Loss', draw: 'Inconclusive',
    end: {natural: 'game ended', stalemate_zero_units: 'cut off: no army left', stalemate_one_army_or_less: 'cut off: army ≤ 1', max_frames: 'cut off: 36,000-frame cap', manual_stop: 'stopped manually', cutoff: 'cut off'},
    decision: {baseline: 'Baseline', promoted: 'Promoted', rejected: 'Rejected', revised: 'Revised', kept: 'Kept'},
    reason: {win_rate_improved: 'win rate improved', score_improved: 'score improved', win_rate_lower: 'win rate lower', insufficient_improvement: 'insufficient improvement', single_opponent_score_drop: 'score dropped on one opponent'},
    regression: o => `regression vs ${o}`,
    tested: 'Version tested', parent: 'Parent', outcome: 'Round outcome', changed: 'Changed', score: 'L0 score', duration: 'Length', models: 'Models',
    becomes: v => `→ ${v}`,
    viewAll: 'Full map', viewSelf: 'Our vision', fullscreen: 'Fullscreen', exitFullscreen: 'Exit fullscreen',
    loading: 'Loading replay…', ready: 'Replay ready',
    controls: 'Click inside the player first. Space: pause / resume · A / D: speed · Arrow keys: camera · Timeline: seek. Use the sound button to enable audio.',
    roundTable: 'All matches in this round', match: 'Match', opponent: 'Opponent', result: 'Result', shown: 'shown',
    champion: 'champion re-check',
    files: (it) => `Original replay: ${it.file.split('/').pop()} · ${(it.bytes / 1024).toFixed(0)} KB · SHA256 ${it.sha256.slice(0, 16)}…`,
    missing: 'Replay unavailable', loadError: 'The page could not load.',
    footer: 'Model commander experiment · data from local native match logs',
    count: n => `${n} replays`,
  },
  zh: {
    title: '模型指挥迭代',
    intro: '由大模型通过与人类指挥相同的按键指挥层实时指挥我方神族 bot；每轮结束后，模型复盘对局日志并修改 bot 策略，下一轮测试新版本。每一轮公开一局原始回放。',
    runA: '第一批', runB: '第二批',
    runDesc: (r) => `${r.rounds} 轮 · 每轮 ${r.matches_per_round} 局（${r.parallel} 局并行）· ${r.map}`,
    runNoteA: '每轮 2 局，轮后由模型决定修改版本或保持不变。',
    runNoteB: '每轮由候选版本对阵 3 个核心对手，并复测一局当前冠军版本；按结果晋升或淘汰候选版本。',
    round: '第', roundSuffix: '轮', vs: '对阵', watch: '观看回放 →', back: '← 全部轮次',
    win: '胜', loss: '负', draw: '未分胜负',
    end: {natural: '自然结束', stalemate_zero_units: '判停：我方无部队', stalemate_one_army_or_less: '判停：部队 ≤ 1', max_frames: '判停：达到 36000 帧上限', manual_stop: '手动停止', cutoff: '判停'},
    decision: {baseline: '基线', promoted: '晋升', rejected: '淘汰', revised: '修改', kept: '保持'},
    reason: {win_rate_improved: '胜率提升', score_improved: '得分提升', win_rate_lower: '胜率下降', insufficient_improvement: '提升不足', single_opponent_score_drop: '单个对手得分下降'},
    regression: o => `对 ${o} 退步`,
    tested: '测试版本', parent: '父版本', outcome: '本轮结论', changed: '改动', score: 'L0 得分', duration: '时长', models: '模型',
    becomes: v => `→ ${v}`,
    viewAll: '全局视角', viewSelf: '我方视角', fullscreen: '全屏', exitFullscreen: '退出全屏',
    loading: '正在载入回放…', ready: '回放已就绪',
    controls: '先点击播放器。Space：暂停 / 继续 · A / D：调整速度 · 方向键：移动镜头 · 时间轴：跳转进度。点击声音按钮可开启音效。',
    roundTable: '本轮全部对局', match: '局号', opponent: '对手', result: '结果', shown: '本页回放',
    champion: '冠军复测',
    files: (it) => `原始回放：${it.file.split('/').pop()} · ${(it.bytes / 1024).toFixed(0)} KB · SHA256 ${it.sha256.slice(0, 16)}…`,
    missing: '这场回放暂不可用', loadError: '页面加载失败',
    footer: '模型指挥实验 · 数据来自本地原版对局日志',
    count: n => `${n} 局回放`,
  }
};
const t = () => T[lang];
const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
const clock = s => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
const roundLabel = n => lang === 'zh' ? `${t().round} ${n} ${t().roundSuffix}` : `${t().round} ${n}`;
const runLabel = r => r.id === 'a' ? t().runA : t().runB;
const resultText = r => t()[r];
const endText = e => t().end[e] || e;
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
      body.append(el('p', 'mc-card-meta', `${clock(it.seconds)} · ${endText(it.end)}${it.l0_score != null ? ` · L0 ${it.l0_score}` : ''}`));
      body.append(el('p', `mc-decision d-${it.decision}`, decisionText(it)));
      body.append(el('span', 'watch', t().watch));
      a.append(top, body); grid.append(a);
    }
    sec.append(grid); root.append(sec);
  }
}

function renderDetail() {
  $('mc-back').href = link();
  $('mc-eyebrow').textContent = `${runLabel(run)} · ${roundLabel(item.round)}`;
  $('mc-title').textContent = `${item.tested} ${t().vs} ${item.opponent} · ${resultText(item.result)}`;
  $('mc-meta').textContent = `${item.map} · ${item.race} vs ${item.opponent_race} · ${clock(item.seconds)} · ${endText(item.end)}`;
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
      el('td', `r-${m.result}`, `${resultText(m.result)} · ${endText(m.end)}`), el('td', null, clock(m.seconds)),
      el('td', null, m.l0_score != null ? String(m.l0_score) : '—'),
      el('td', 'muted', m.match_number === item.match_number ? t().shown : (m.version && m.version !== item.tested ? `${m.version} · ${t().champion}` : '')));
    table.append(tr);
  }
  $('mc-files').textContent = t().files(item);
  document.title = `${item.tested} ${t().vs} ${item.opponent} · ${t().title} · Replay Archive`;
}

function translate() {
  document.querySelectorAll('[data-i18n]').forEach(e => { const v = t()[e.dataset.i18n]; if (typeof v === 'string') e.textContent = v; });
  $('mc-fullscreen').textContent = t()[document.fullscreenElement ? 'exitFullscreen' : 'fullscreen'];
  if (!data) return;
  if (item) renderDetail(); else renderLibrary();
}

function viewerWindow() {
  try {
    const w = $('mc-viewer').contentWindow;
    return w && w.main_has_been_called && typeof w._replay_get_value === 'function' && w._replay_get_value(4) > 0 ? w : null;
  } catch { return null; }
}
function applyView(w) {
  if (typeof w._fog_of_war_set_value !== 'function' || typeof w._fog_of_war_player_set_value !== 'function') return false;
  const self = view === 'self';
  w._fog_of_war_set_value(self ? 1 : 0);
  for (const p of w.players) w._fog_of_war_player_set_value(p, !self || w.UTF8ToString(w._player_get_value(p, w.C_NICK)) === item.self_name ? 1 : 0);
  if (typeof w.update_fow_button === 'function') w.update_fow_button();
  if (typeof w.update_player_vision_buttons === 'function') w.update_player_vision_buttons();
  if (typeof w.request_static_repaint_if_needed === 'function') w.request_static_repaint_if_needed();
  viewApplied = view; return true;
}
function poll() {
  const w = viewerWindow();
  $('mc-status').textContent = w ? t().ready : t().loading;
  if (w && viewApplied !== view) applyView(w);
}
function loadPlayer() {
  const v = new URL('../viewer/native.html', location.href);
  const rep = new URL(item.file, location.href); rep.searchParams.set('v', item.sha256.slice(0, 12));
  v.searchParams.set('rep', rep.href);
  v.searchParams.set('lang', lang);
  v.searchParams.set('nick1', item.self_name); v.searchParams.set('name1', lang === 'zh' ? `我方 · ${item.tested}` : `Ours · ${item.tested}`);
  v.searchParams.set('nick2', item.opponent_name); v.searchParams.set('name2', item.opponent);
  $('mc-viewer').src = v.href;
  clearInterval(pollTimer); pollTimer = setInterval(poll, 500); poll();
}

$('mc-view').onclick = e => {
  const b = e.target.closest('[data-view]'); if (!b) return;
  view = b.dataset.view; viewApplied = null;
  for (const x of $('mc-view').querySelectorAll('button')) x.setAttribute('aria-pressed', String(x === b));
  poll();
};
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
      $('mc-detail').hidden = false; translate(); loadPlayer();
    } else translate();
  } catch (error) { $('mc-library').hidden = true; $('mc-error').hidden = false; $('mc-error-detail').textContent = error.message; }
}
boot();
