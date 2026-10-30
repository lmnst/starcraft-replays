'use strict';
let lang=new URLSearchParams(location.search).get('lang')==='zh'?'zh':'en';
function render(){document.documentElement.lang=lang==='zh'?'zh-CN':'en';document.getElementById('en').hidden=lang!=='en';document.getElementById('zh').hidden=lang!=='zh';document.getElementById('language').textContent=lang==='en'?'中文':'English';document.getElementById('back').textContent=lang==='zh'?'← 比赛库':'← Match library';document.getElementById('back').href=lang==='zh'?'./?lang=zh':'./';document.title=(lang==='zh'?'来源与声明':'Sources & credits')+' · Replay Archive';}
document.getElementById('language').onclick=()=>{lang=lang==='en'?'zh':'en';const u=new URL(location.href);u.searchParams.set('lang',lang);history.replaceState(null,'',u);render();};render();
