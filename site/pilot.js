'use strict';
const view = document.querySelector('#viewer');
const statusLine = document.querySelector('#status');
const progress = document.querySelector('#progress');
const retry = document.querySelector('#retry');
const params = new URLSearchParams(location.search);
let lang = params.get('lang') === 'zh' ? 'zh' : 'en';
let match;
let currentState = 'loading';
let lastMessage = '';
let lastMB = 0;
const startedAt = performance.now();
const copy = {
  en: {title:'Loading match…',eyebrow:'STARCRAFT: BROOD WAR / ONLINE PLAYBACK TEST',admin:'Manage replays ↗',help:'Click inside the player. Space: pause · A / D: speed · Arrow keys: camera. The first visit downloads game data automatically.',source:'Game data and replays are hosted by this website. No login or file import is needed.',loading:'Preparing playback…',download:'Downloading game data',ready:'Game data ready. Loading replay…',playing:'Replay loaded. Playback runs in your browser.',error:'Unable to load playback.',retry:'Retry',empty:'No published match.'},
  zh: {title:'正在读取比赛…',eyebrow:'星际争霸：母巢之战 / 单场线上验证',admin:'管理回放 ↗',help:'先点击播放器。Space 暂停 · A / D 调整倍速 · 方向键移动镜头。首次访问将自动下载游戏数据。',source:'游戏数据与回放由本站统一提供，无需登录或手动导入。',loading:'正在准备播放…',download:'正在下载游戏数据',ready:'游戏数据已就绪，正在读取回放…',playing:'回放已载入，在浏览器内播放。',error:'播放加载失败。',retry:'重试',empty:'暂无已发布的比赛。'}
};
function render() {
  const c = copy[lang];
  document.documentElement.lang = lang === 'zh' ? 'zh-CN' : 'en';
  for (const id of ['eyebrow','admin','help','source','retry']) document.getElementById(id).textContent = c[id];
  document.querySelector('#language').textContent = lang === 'en' ? '中文' : 'English';
  document.querySelector('#title').textContent = match ? match[`title_${lang}`] : c.title;
  if (match) document.querySelector('#meta').textContent = `${match.map} · ${match.player1} vs ${match.player2}`;
  statusLine.textContent = currentState === 'download' ? `${c.download} · ${lastMB.toFixed(1)} MB` : (c[currentState] || c.loading);
  if (currentState === 'error' && lastMessage) statusLine.textContent += ` ${lastMessage}`;
}
document.querySelector('#language').onclick = () => {
  lang = lang === 'en' ? 'zh' : 'en';
  const url = new URL(location.href); url.searchParams.set('lang',lang); history.replaceState(null,'',url); render();
};
retry.onclick = () => { retry.hidden = true; currentState = 'loading'; progress.hidden = false; progress.removeAttribute('value'); render(); view.src = view.src; };
window.addEventListener('message', event => {
  if (event.source !== view.contentWindow || event.origin !== location.origin || event.data?.type !== 'pilot-status') return;
  currentState = event.data.state;
  lastMB = event.data.mb || 0;
  lastMessage = event.data.message || '';
  if (Number.isFinite(event.data.percent)) progress.value = event.data.percent;
  if (currentState === 'playing') {
    progress.value = 100;
    document.body.dataset.loadedSeconds = ((performance.now()-startedAt)/1000).toFixed(1);
  }
  retry.hidden = currentState !== 'error';
  render();
});
async function boot() {
  render();
  try {
    const response = await fetch('catalog.json', {cache:'no-cache'});
    if (!response.ok) throw new Error(`Match list: HTTP ${response.status}`);
    const catalog = await response.json();
    match = catalog.matches.find(item => item.id === params.get('match')) || catalog.matches[0];
    document.querySelector('#revision').textContent = `Build ${catalog.revision.slice(0,12)} · ${catalog.built_at}`;
    if (!match) { currentState = 'empty'; progress.hidden = true; render(); return; }
    document.body.dataset.replaySha256 = match.sha256;
    const url = new URL(location.href); url.searchParams.set('match',match.id); history.replaceState(null,'',url);
    render();
    const replay = new URL(match.replay.replace(/^\//,''),location.href);
    const viewerURL = new URL('viewer/index.html',location.href);
    viewerURL.searchParams.set('rep',replay.href);
    view.src = viewerURL.href;
  } catch (error) { currentState = 'error'; lastMessage = error.message; render(); }
}
boot();
