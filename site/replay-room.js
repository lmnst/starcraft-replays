'use strict';
const roomElement = id => document.getElementById(id);
const roomParams = new URLSearchParams(location.search);
let roomLang = roomParams.get('lang') === 'zh' ? 'zh' : 'en';
let roomItems = [], roomItem, roomCatalog, roomState = 'loading', roomError = '', roomLoaded = false;
const roomCopy = {
 en: {room:'Replay room',library:'Match library',skip:'Skip to content',eyebrow:'WATCH / EXPLORE / REVIEW',intro:'A place for test matches, interesting moments, and a closer look at how the bots play.',tag:'MATCH NOTES IN MOTION',searchLabel:'Find a replay',searchPlaceholder:'Search title, map, bot, or version…',opponentLabel:'Opponent',allOpponents:'All opponents',interactive:'Interactive replay',video:'Video',reset:'Clear filters',emptyTitle:'The room is ready.',emptyText:'New replays and videos will appear here. Choose one to watch when it arrives.',noResults:'No matching replays. Try another search.',replayTitle:'Explore the match',replayHelp:'Interactive replays keep the game sound, free camera, playback speed, and timeline controls.',videoTitle:'Watch a video',videoHelp:'Videos play directly, with pause, seeking, volume, and fullscreen controls.',back:'← Replay room',missing:'Replay unavailable',missingHelp:'Return to the room and choose another match.',loadError:'The replay room could not load.',retry:'Retry',fullscreen:'Fullscreen',exitFullscreen:'Exit fullscreen',credits:'Sources & credits',manage:'Manage replay room',count:'replays',watch:'Watch now →',loading:'Preparing playback…',download:'Downloading game data…',ready:'Loading replay…',playing:'Replay ready',videoReady:'Video ready · press play',error:'Playback could not load.',controls:'Click inside the player first. Space: pause / resume · A / D: speed · Arrow keys: camera · Timeline: seek · + / −: zoom. Use the sound button to enable audio.',videoControls:'Press play to watch. Use the video controls for sound, seeking, and fullscreen.'},
 zh: {room:'对战效果',library:'比赛库',skip:'跳到正文',eyebrow:'观看 / 探索 / 复盘',intro:'收集测试对局与值得回看的瞬间，随时打开，看看 bot 的实际对战表现。',tag:'随时回看，自由观察',searchLabel:'查找回放',searchPlaceholder:'搜索标题、地图、对手或版本…',opponentLabel:'对手',allOpponents:'全部对手',interactive:'交互回放',video:'视频',reset:'清除筛选',emptyTitle:'回放空间已就绪',emptyText:'后续加入的回放和视频会显示在这里，选择一场即可观看。',noResults:'没有找到回放，请调整搜索条件。',replayTitle:'自由观察对局',replayHelp:'交互回放保留游戏声音、自由镜头、播放速度和时间轴操作。',videoTitle:'直接观看视频',videoHelp:'视频可直接播放，支持暂停、拖动进度、音量调节和全屏。',back:'← 对战效果',missing:'这场回放暂不可用',missingHelp:'请返回对战效果模块，选择其他回放。',loadError:'对战效果模块加载失败',retry:'重试',fullscreen:'全屏',exitFullscreen:'退出全屏',credits:'来源与声明',manage:'管理对战效果',count:'份回放',watch:'开始观看 →',loading:'正在准备播放…',download:'正在下载游戏数据…',ready:'正在载入回放…',playing:'回放已就绪',videoReady:'视频已就绪，点击播放',error:'播放加载失败。',controls:'先点击播放器。Space：暂停 / 继续 · A / D：调整速度 · 方向键：移动镜头 · 时间轴：跳转进度 · + / −：缩放。点击声音按钮可开启音效。',videoControls:'点击播放即可观看，使用视频控件调整声音、进度和全屏。'}
};
function roomUrl(id){const p=new URLSearchParams();if(id)p.set('id',id);if(roomLang==='zh')p.set('lang','zh');const opponent=roomElement('room-opponent').value;if(opponent)p.set('opponent',opponent);return 'replay-room.html'+(p.size?'?'+p:'');}
function roomText(record,field){return record[field+'_'+roomLang]||record[field+'_en']||record[field+'_zh']||'';}
function roomMeta(record){return [record.map,[record.player1,record.player2].filter(Boolean).join(' vs '),record.bot_version].filter(Boolean).join(' · ');}
function roomTranslate(){
 const c=roomCopy[roomLang];document.documentElement.lang=roomLang==='zh'?'zh-CN':'en';
 document.querySelectorAll('[data-i18n]').forEach(el=>el.textContent=c[el.dataset.i18n]);
 roomElement('language').textContent=roomLang==='en'?'中文':'English';
 document.querySelectorAll('[data-library]').forEach(a=>a.href='./'+(roomLang==='zh'?'?lang=zh':''));
 document.querySelectorAll('[data-room]').forEach(a=>a.href=roomUrl());
 roomElement('room-back').href=roomUrl();roomElement('room-credits').href='credits.html'+(roomLang==='zh'?'?lang=zh':'');
 roomElement('room-search').placeholder=c.searchPlaceholder;document.title=(roomItem?roomText(roomItem,'title'):c.room)+' · Replay Archive';
 if(roomItem){roomElement('room-title').textContent=roomText(roomItem,'title');roomElement('room-meta').textContent=roomMeta(roomItem);roomElement('room-description').textContent=roomText(roomItem,'description');roomElement('room-playback-help').textContent=roomItem.type==='replay'?c.controls:c.videoControls;roomElement('room-viewer').title=roomText(roomItem,'title');roomElement('room-video').setAttribute('aria-label',roomText(roomItem,'title'));}
 roomRenderCards();roomRenderStatus();roomElement('room-fullscreen').textContent=c[document.fullscreenElement?'exitFullscreen':'fullscreen'];
 roomElement('room-viewer').contentWindow?.postMessage({type:'replay-language',lang:roomLang},location.origin);
}
function roomRenderCards(){
 const c=roomCopy[roomLang],query=roomElement('room-search').value.trim().toLowerCase(),opponent=roomElement('room-opponent').value;
 const filtered=roomItems.filter(item=>(!opponent||item.player2===opponent)&&[item.title_en,item.title_zh,item.map,item.player1,item.player2,item.bot_version].filter(Boolean).join(' ').toLowerCase().includes(query));
 roomElement('room-cards').replaceChildren();roomElement('room-count').textContent=roomLoaded?`${filtered.length} / ${roomItems.length} ${c.count}`:'';
 roomElement('room-empty').hidden=!roomLoaded||roomItems.length!==0;roomElement('room-no-results').hidden=!roomLoaded||!roomItems.length||filtered.length!==0;
 filtered.forEach(item=>{
  const a=document.createElement('a');a.className='card room-card';a.href=roomUrl(item.id);
  const top=document.createElement('div');top.className='card-top';const badge=document.createElement('span');badge.className='badge';badge.textContent=item.type==='replay'?c.interactive:c.video;const version=document.createElement('span');version.className='version';version.textContent=item.bot_version||item.map||'';top.append(badge,version);
  const body=document.createElement('div');body.className='card-body';const title=document.createElement('h2');title.textContent=roomText(item,'title');const meta=document.createElement('p');meta.textContent=roomMeta(item);const watch=document.createElement('span');watch.className='watch';watch.textContent=c.watch;body.append(title,meta,watch);a.append(top,body);roomElement('room-cards').append(a);
 });
}
function roomRenderStatus(){const c=roomCopy[roomLang];roomElement('room-status').textContent=c[roomState]||c.loading;roomElement('room-retry').hidden=roomState!=='error';roomElement('room-playback-error').hidden=roomState!=='error';roomElement('room-playback-error').textContent=roomState==='error'?roomError:'';}
function roomLoadPlayer(){
 roomError='';roomState='loading';roomRenderStatus();const file=new URL(roomItem.file.replace(/^\//,''),location.href);file.searchParams.set('v',roomItem.sha256);
 roomElement('room-screen').dataset.format=roomItem.type;
 if(roomItem.type==='video'){
  roomElement('room-viewer').hidden=true;roomElement('room-viewer').removeAttribute('src');roomElement('room-video').hidden=false;roomElement('room-video').src=file.href;roomElement('room-video').load();
 }else{
  roomElement('room-video').pause();roomElement('room-video').hidden=true;roomElement('room-video').removeAttribute('src');roomElement('room-viewer').hidden=false;
  const viewer=new URL('viewer/index.html',location.href);viewer.searchParams.set('rep',file.href);viewer.searchParams.set('lang',roomLang);
  [1,2].forEach(i=>{if(roomItem['replay_player'+i]&&roomItem['player'+i]){viewer.searchParams.set('nick'+i,roomItem['replay_player'+i]);viewer.searchParams.set('name'+i,roomItem['player'+i]);}});
  roomElement('room-viewer').src=viewer.href;
 }
}
async function roomBoot(){
 roomElement('room-error').hidden=true;roomElement('room-detail').hidden=true;roomElement('room-missing').hidden=true;roomElement('room-library').hidden=true;
 roomLoaded=false;roomItem=undefined;roomItems=[];roomTranslate();
 try{
  const response=await fetch('room-catalog.json',{cache:'no-cache'});if(!response.ok)throw new Error('HTTP '+response.status);
  roomCatalog=await response.json();if(!Array.isArray(roomCatalog.items))throw new Error('Invalid replay catalog');
  roomItems=roomCatalog.items;roomLoaded=true;roomElement('room-revision').textContent='Build '+roomCatalog.revision.slice(0,12);
  if(roomParams.has('id')){roomItem=roomItems.find(item=>item.id===roomParams.get('id'));roomElement(roomItem?'room-detail':'room-missing').hidden=false;}else roomElement('room-library').hidden=false;
  roomTranslate();if(roomItem)roomLoadPlayer();
 }catch(error){roomElement('room-error').hidden=false;roomElement('room-error-detail').textContent=error.message;}
}
roomElement('language').onclick=()=>{roomLang=roomLang==='en'?'zh':'en';const url=new URL(location.href);url.searchParams.set('lang',roomLang);history.replaceState(null,'',url);roomTranslate();};
function roomApplyOpponent(){const url=new URL(location.href);const opponent=roomElement('room-opponent').value;if(opponent)url.searchParams.set('opponent',opponent);else url.searchParams.delete('opponent');history.replaceState(null,'',url);roomRenderCards();}
roomElement('room-search').oninput=roomRenderCards;roomElement('room-opponent').onchange=roomApplyOpponent;roomElement('room-reset').onclick=()=>{roomElement('room-search').value='';roomElement('room-opponent').value='';roomApplyOpponent();};
roomElement('room-reload').onclick=roomBoot;roomElement('room-retry').onclick=roomLoadPlayer;
roomElement('room-fullscreen').onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await roomElement('room-screen').requestFullscreen();}catch(error){roomState='error';roomError=error.message;roomRenderStatus();}};
roomElement('room-exit-fullscreen').onclick=()=>document.exitFullscreen();document.addEventListener('fullscreenchange',()=>{roomElement('room-fullscreen').textContent=roomCopy[roomLang][document.fullscreenElement?'exitFullscreen':'fullscreen'];});
roomElement('room-video').addEventListener('loadedmetadata',()=>{roomState='videoReady';roomRenderStatus();});roomElement('room-video').addEventListener('error',()=>{if(roomItem?.type==='video'){roomState='error';roomError=roomCopy[roomLang].error;roomRenderStatus();}});
window.addEventListener('message',event=>{if(roomItem?.type!=='replay'||event.source!==roomElement('room-viewer').contentWindow||event.origin!==location.origin||event.data?.type!=='pilot-status')return;roomState=event.data.state;roomError=event.data.message||'';roomRenderStatus();});
if(['PylonPuller','Steamhammer','Skynet'].includes(roomParams.get('opponent')))roomElement('room-opponent').value=roomParams.get('opponent');
roomBoot();
