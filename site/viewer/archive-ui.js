/* Translate DOM controls; engine-rendered game text remains original. */
(function(){
 var lang=new URLSearchParams(location.search).get('lang')==='zh'?'zh':'en';
 var words={
 'SUPPLY':'人口','MINERALS':'矿物','GAS':'瓦斯','WORKERS':'工人','ARMY':'军队','APM':'每分钟操作','Toggle player vision':'切换选手视野',
 'Production':'生产','Army':'军队','Tech':'科技','Research':'研究','Hotkeys':'快捷键','Key':'按键','Description':'说明',
 'No-spoiler mode.':'隐藏剧透。','Double playback speed.':'播放速度加倍。','Halve playback speed.':'播放速度减半。','Pause/unpause.':'暂停 / 继续。',
 'Pause, then jump -10/-1/+1/+10 frames.':'暂停并跳转 -10/-1/+1/+10 帧。','Jump -30/-10/+10/+30 seconds.':'跳转 -30/-10/+10/+30 秒。','Pan camera.':'移动镜头。','Zoom out/in.':'缩小 / 放大。','Show/hide info graphs.':'显示 / 隐藏统计图。','Open the jump dialog.':'打开跳转窗口。',
 'Goto frame/time':'跳转到帧 / 时间','Frame':'帧','Time':'时间','Go!':'跳转','Settings':'设置','Audio':'音频','Video Clips':'视频片段',
 'Overall':'整体','Combat':'战斗','Acknowledgements':'单位回应','Music':'音乐','Reset':'重置','Width':'宽度','Height':'高度','FPS':'帧率','Bitrate':'码率',
 'Zoom in':'放大','Zoom out':'缩小','Force red vs blue colors':'强制红蓝配色','Toggle auto observer':'切换自动观战','Toggle fog of war':'切换战争迷雾',
 'Download replay':'下载回放','Open replay':'打开回放','Copy replay link for current frame':'复制当前进度链接','Export replay video':'导出回放视频',
 'Close reveal':'关闭窗口','Close':'关闭','Play':'播放','Pause':'暂停','Mute':'静音','Unmute':'取消静音',
 'Toggle overall audio':'切换整体声音','Toggle combat audio':'切换战斗声音','Toggle acknowledgement audio':'切换单位回应','Toggle music audio':'切换音乐',
 'Loading files':'正在载入文件','Checking cached files...':'正在检查缓存…','Watch replays':'观看回放','StarCraft 1.16.1 (not Remastered)':'星际争霸 1.16.1（非重制版）','Built-in AI not supported':'不支持内置 AI','Report bugs':'报告问题',
 'Loading replay':'正在读取回放','Loading game data automatically…':'正在自动载入游戏数据…','Game data unavailable. Use Retry above the player.':'游戏数据不可用，请点击播放器上方的重试。'
 };
 var originals=new WeakMap();
 function translate(){
  document.documentElement.lang=lang==='zh'?'zh-CN':'en';
  var walker=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);var node;
  while((node=walker.nextNode())){
   if(/^(SCRIPT|STYLE)$/.test(node.parentElement.tagName))continue;
   var original=originals.get(node)||node.nodeValue;
   if(words[original.trim()]){originals.set(node,original);var value=lang==='zh'?original.replace(original.trim(),words[original.trim()]):original;if(node.nodeValue!==value)node.nodeValue=value;}
   else if(/^(time: |speed: )/.test(original)){originals.set(node,original);var value=lang==='zh'?original.replace(/^time: /,'时间：').replace(/^speed: /,'倍速：'):original;if(node.nodeValue!==value)node.nodeValue=value;}
  }
  document.querySelectorAll('[title],[aria-label],input[type=submit]').forEach(function(el){
   ['title','aria-label','value'].forEach(function(attr){if(!el.hasAttribute(attr))return;var key='data-original-'+attr;var text=el.getAttribute(key)||el.getAttribute(attr);if(words[text]){el.setAttribute(key,text);var value=lang==='zh'?words[text]:text;if(el.getAttribute(attr)!==value)el.setAttribute(attr,value);}else if(/^Frame \d+$/.test(text)){var value=lang==='zh'?text.replace('Frame ','帧 '):text;if(el.getAttribute(attr)!==value){el.setAttribute(key,text);el.setAttribute(attr,value);}}});
  });
  var controls={'rv-rc-play':lang==='zh'?'暂停 / 继续':'Pause / resume','rv-rc-slower':lang==='zh'?'减速':'Slower','rv-rc-faster':lang==='zh'?'加速':'Faster','rv-rc-sound':lang==='zh'?'切换声音':'Toggle sound','game-slider-handle':lang==='zh'?'回放进度':'Replay timeline'};
  Object.keys(controls).forEach(function(id){var el=document.getElementById(id);if(el){el.setAttribute('aria-label',controls[id]);el.title=controls[id];}});
 }
 window.addEventListener('message',function(e){if(e.source===parent&&e.origin===location.origin&&e.data?.type==='replay-language'){lang=e.data.lang==='zh'?'zh':'en';translate();}});
 document.addEventListener('DOMContentLoaded',function(){
  translate();var scheduled=false;
  new MutationObserver(function(){if(scheduled)return;scheduled=true;requestAnimationFrame(function(){scheduled=false;translate();});}).observe(document.body,{childList:true,subtree:true,characterData:true});
 });
})();
