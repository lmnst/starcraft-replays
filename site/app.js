'use strict';
const $ = id => document.getElementById(id);
const params = new URLSearchParams(location.search);
let lang = params.get('lang') === 'zh' ? 'zh' : 'en';
let matches = [], match, catalog, state = 'loading', mb = 0, errorDetail = '';
let catalogFailed = false;
const started = performance.now();
const copy = {
 en:{library:'Match library',search:'Player / Bot or map',searchPlaceholder:'Search the archive…',mapFilter:'Map',allMaps:'All maps',reset:'Clear filters',count:'matches',watch:'Watch replay',win:'{player} WIN',loss:'{player} LOSS',unknown:'RESULT UNRECORDED',local:'Local Bot test',noMatches:'No matches found. Try a different search.',aboutTitle:'A replay you can explore',about:'These are local environment tests, not tournament rankings. Match details and results come from project records. Results refer to Agnes.',dataTitle:'Open a match. Start watching.',data:'Game data (90.3 MB on the first visit) loads automatically from this website. Your browser reuses cached data when available. No account or file import needed.',admin:'Manage replays',credits:'Sources & credits',back:'← All matches',fullscreen:'Fullscreen',exitFullscreen:'Exit fullscreen',retry:'Retry',loading:'Preparing playback…',download:'Downloading game data',ready:'Game data ready. Loading replay…',playing:'Replay loaded · playing in your browser',error:'Playback could not load. Check your connection and retry.',catalogError:'The match library could not load. Check your connection and retry.',missing:'This match is unavailable',missingInfo:'It may have been unpublished. Choose another match from the library.',helpTitle:'Player controls',help:'Click inside the player first. Space: pause / resume · A: faster · D: slower · Arrow keys: move camera · Timeline: jump to a moment · + / −: zoom.',touch:'On touch screens, drag the game view to move the camera. Landscape and fullscreen offer more room.',noteTitle:'About this match',engineNote:'Game artwork, unit names and engine-rendered statistics retain their original language.',progress:'Game data loading progress',viewer:'Interactive replay player',skip:'Skip to content'},
 zh:{library:'比赛库',search:'选手 / Bot 或地图',searchPlaceholder:'搜索回放档案…',mapFilter:'地图',allMaps:'全部地图',reset:'清除筛选',count:'场比赛',watch:'观看回放',win:'{player} 胜',loss:'{player} 负',unknown:'胜负未记录',local:'本地 Bot 测试',noMatches:'没有找到比赛，请调整搜索条件。',aboutTitle:'可以自由探索的回放',about:'这些是本地环境测试，不代表正式赛事或榜单成绩。比赛资料和结果来自项目记录，胜负以 Agnes 为准。',dataTitle:'打开比赛，即可观看。',data:'首次访问会自动从本站下载 90.3 MB 游戏数据，后续优先复用浏览器缓存。无需账号或手动导入文件。',admin:'管理回放',credits:'来源与声明',back:'← 全部比赛',fullscreen:'全屏',exitFullscreen:'退出全屏',retry:'重试',loading:'正在准备播放…',download:'正在下载游戏数据',ready:'游戏数据已就绪，正在读取回放…',playing:'回放已载入 · 在浏览器内播放',error:'播放加载失败，请检查网络后重试。',catalogError:'比赛库加载失败，请检查网络后重试。',missing:'这场比赛暂不可用',missingInfo:'该比赛可能已下架，请返回比赛库选择其他对局。',helpTitle:'播放器操作',help:'先点击播放器。Space：暂停 / 继续 · A：加速 · D：减速 · 方向键：移动镜头 · 时间轴：跳转进度 · + / −：缩放。',touch:'触屏设备可拖动画面移动镜头，横屏和全屏能提供更大的观看空间。',noteTitle:'关于这场比赛',engineNote:'游戏素材、单位名称及引擎绘制的统计文字保留原始语言。',progress:'游戏数据下载进度',viewer:'交互回放播放器',skip:'跳到正文'}
};
function urlFor(id){const p=new URLSearchParams();if(id)p.set('match',id);if(lang==='zh')p.set('lang','zh');return './'+(p.size?'?'+p:'');}
function translate(){
 const c=copy[lang];document.documentElement.lang=lang==='zh'?'zh-CN':'en';
 document.querySelectorAll('[data-i18n]').forEach(el=>el.textContent=c[el.dataset.i18n]);
 $('language').textContent=lang==='en'?'中文':'English';$('search').placeholder=c.searchPlaceholder;
 $('progress').setAttribute('aria-label',c.progress);$('viewer').title=c.viewer;
 document.querySelectorAll('[data-library]').forEach(a=>a.href=urlFor());$('all-maps').textContent=c.allMaps;
 document.title=(match?match['title_'+lang]:c.library)+' · Replay Archive';
 if(match){$('title').textContent=match['title_'+lang];$('meta').textContent=`${match.map} / ${match.player1} ${lang==='zh'?'对阵':'vs'} ${match.player2} / ${(c[match.result]||c.unknown).replace('{player}',match.player1)}`;$('description').textContent=match['description_'+lang]||c.about;}
 renderCards();renderStatus();$('fullscreen').textContent=document.fullscreenElement?c.exitFullscreen:c.fullscreen;$('catalog-message').textContent=c.catalogError;document.querySelector('[data-i18n=credits]').href='credits.html'+(lang==='zh'?'?lang=zh':'');
 $('viewer').contentWindow?.postMessage({type:'replay-language',lang},location.origin);
}
function renderStatus(){const c=copy[lang];$('status').textContent=state==='download'?`${c.download} · ${mb.toFixed(1)} / 90.3 MB`:(c[state]||c.loading);$('retry').hidden=state!=='error';$('error-detail').textContent=state==='error'?errorDetail:'';}
function renderCards(){
 const c=copy[lang],query=$('search').value.trim().toLowerCase(),map=$('map-filter').value;
 const filtered=matches.filter(m=>(!map||m.map===map)&&[m.player1,m.player2,m.map,m.title_en,m.title_zh].join(' ').toLowerCase().includes(query));
 $('cards').replaceChildren();$('count').textContent=`${filtered.length} / ${matches.length} ${c.count}`;$('empty').hidden=filtered.length!==0;
 filtered.forEach(m=>{
  const a=document.createElement('a');a.className='card';a.href=urlFor(m.id);
  const top=document.createElement('div');top.className='card-top';const name=document.createElement('span');name.className='map-name';name.textContent=m.map;
  const badge=document.createElement('span');badge.className='badge '+m.result;badge.textContent=(c[m.result]||c.unknown).replace('{player}',m.player1);top.append(name,badge);
  const body=document.createElement('div');body.className='card-body';const h=document.createElement('h2');h.textContent=`${m.player1} vs ${m.player2}`;
  const p=document.createElement('p');p.textContent=`${c.local} / ${m.replay_frames?m.replay_frames.toLocaleString()+(lang==='zh'?' 帧':' frames'):m.id}`;
  const watch=document.createElement('span');watch.className='watch';watch.textContent=c.watch+' →';body.append(h,p,watch);a.append(top,body);$('cards').append(a);
 });
}
function loadPlayer(){state='loading';errorDetail='';$('progress').value=0;renderStatus();const replay=new URL(match.replay.replace(/^\//,''),location.href);replay.searchParams.set('v',match.sha256);const viewer=new URL('viewer/index.html',location.href);viewer.searchParams.set('rep',replay.href);viewer.searchParams.set('lang',lang);[1,2].forEach(index=>{if(match['replay_player'+index]){viewer.searchParams.set('nick'+index,match['replay_player'+index]);viewer.searchParams.set('name'+index,match['player'+index]);}});$('viewer').src=viewer.href;}
async function boot(){
 catalogFailed=false;$('site-error').hidden=true;translate();
 try{
  const response=await fetch('catalog.json',{cache:'no-cache'});if(!response.ok)throw new Error('HTTP '+response.status);catalog=await response.json();matches=catalog.matches;
  $('revision').textContent=`Build ${catalog.revision.slice(0,12)}`;
  [...new Set(matches.map(m=>m.map))].sort().forEach(map=>{const o=document.createElement('option');o.value=map;o.textContent=map;$('map-filter').append(o);});
  if(params.has('match')){match=matches.find(m=>m.id===params.get('match'));$('library-page').hidden=true;if(!match){$('missing').hidden=false;translate();return;}$('match-page').hidden=false;document.body.dataset.replaySha256=match.sha256;translate();loadPlayer();}else{translate();}
 }catch(error){catalogFailed=true;$('site-error').hidden=false;$('library-page').hidden=true;$('catalog-detail').textContent=error.message;}
}
$('language').onclick=()=>{lang=lang==='en'?'zh':'en';const u=new URL(location.href);u.searchParams.set('lang',lang);history.replaceState(null,'',u);translate();};
$('search').oninput=renderCards;$('map-filter').onchange=renderCards;$('reset').onclick=()=>{$('search').value='';$('map-filter').value='';renderCards();};
$('catalog-retry').onclick=()=>{if(catalogFailed){$('library-page').hidden=false;boot();}};$('retry').onclick=loadPlayer;
$('exit-fullscreen').onclick=()=>document.exitFullscreen();
$('fullscreen').onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await $('screen').requestFullscreen();}catch(error){$('error-detail').textContent=error.message;}};
document.addEventListener('fullscreenchange',()=>{$('fullscreen').textContent=copy[lang][document.fullscreenElement?'exitFullscreen':'fullscreen'];});
window.addEventListener('message',event=>{if(event.source!==$('viewer').contentWindow||event.origin!==location.origin||event.data?.type!=='pilot-status')return;state=event.data.state;mb=event.data.mb||0;errorDetail=event.data.message||'';if(Number.isFinite(event.data.percent))$('progress').value=event.data.percent;if(state==='playing'){$('progress').value=100;document.body.dataset.loadedSeconds=((performance.now()-started)/1000).toFixed(1);}renderStatus();});
boot();
