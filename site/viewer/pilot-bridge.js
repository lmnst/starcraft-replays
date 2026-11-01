/* Public archive integration, derived from the verified pilot bridge. */
(function () {
  // Match replay nicknames, not display row order: OpenBW can sort players.
  var query = new URLSearchParams(location.search);
  var playerNames = new Map();
  [1, 2].forEach(function(index) {
    var replayName = query.get('nick' + index);
    var displayName = query.get('name' + index);
    if (replayName && displayName) playerNames.set(replayName, displayName);
  });
  var originalSetNick = set_nick;
  set_nick = function(player, nick) {
    originalSetNick(player, playerNames.get(nick) || nick);
  };
  function notify(state, extra) {
    parent.postMessage(Object.assign({type:'pilot-status',state:state},extra || {}), location.origin);
  }
  C_MUSIC_TRACKS_BY_RACE = {0:[],1:[],2:[]};
  var runtimeReady = false;
  Module.locateFile = function (path, prefix) {
    return prefix + path + (path.endsWith('.wasm') ? '?v=3fc429b76f62' : '');
  };
  var pendingRead = false;
  var runtimeInitialized = Module.onRuntimeInitialized;
  Module.onRuntimeInitialized = function () {
    runtimeReady = true;
    if (runtimeInitialized) runtimeInitialized();
    if (pendingRead) { pendingRead = false; on_read_all_done(); }
  };
  // Separate self-hosted resources from the earlier upstream-hosted cache.
  set_db_handle = function (success) {
    if (!window.indexedDB) { fetch_default_mpqs(); return; }
    var request;
    try { request = indexedDB.open('ReplayArchiveSelfHosted_DB_v1',1); }
    catch (error) { fetch_default_mpqs(); return; }
    request.onupgradeneeded = function (event) { event.target.result.createObjectStore('mpqs',{keyPath:'mpqkp'}); };
    request.onsuccess = success;
    request.onerror = function () { fetch_default_mpqs(); };
    request.onblocked = function () { fetch_default_mpqs(); };
  };
  load_mpq_from_db = function () {
    try {
      var transaction = db_handle.transaction(['mpqs']);
      var completed = 0;
      transaction.onerror = function () { fetch_default_mpqs(); };
      C_MPQ_FILENAMES.forEach(function(name, index) {
        var request = transaction.objectStore('mpqs').get(name);
        request.onsuccess = function () {
          var blob = request.result && request.result.blob;
          if (blob && blob.size === [66184491,23519727,636958][index]) files[index] = blob;
          if (++completed === 3) {
            if (has_all_files()) { console.info('Replay Archive: using cached game data'); parse_mpq_files(); }
            else fetch_default_mpqs();
          }
        };
      });
    } catch(error) { fetch_default_mpqs(); }
  };
  fetch_default_mpqs = function () {
    if (is_fetching_default_mpqs || has_all_files()) return;
    is_fetching_default_mpqs = true;
    var loaded = [0,0,0];
    var expected = [66184491,23519727,636958];
    var total = expected.reduce(function(a,b){return a+b;},0);
    function report() {
      var bytes = loaded.reduce(function(a,b){return a+b;},0);
      show_loading_files_screen('Loading game data automatically… ' + (bytes/1000000).toFixed(1) + ' MB');
      notify('download',{mb:bytes/1000000,percent:Math.min(99,100*bytes/total)});
    }
    report();
    Promise.all(C_DEFAULT_MPQ_SOURCES.map(function(url,index){
      return new Promise(function(resolve,reject){
        var req = new XMLHttpRequest();
        console.info('Replay Lab game data:',url);
        req.open('GET',url,true);
        req.responseType = 'arraybuffer';
        req.timeout = 180000;
        req.onprogress = function(event){loaded[index]=event.loaded;report();};
        req.onload = function(){
          if(req.status !== 200){reject(new Error(C_MPQ_FILENAMES[index]+': HTTP '+req.status));return;}
          if(!req.response || req.response.byteLength !== expected[index]){reject(new Error('Incomplete MPQ response'));return;}
          var signature=new Uint8Array(req.response,0,3);
          if(signature[0]!==77||signature[1]!==80||signature[2]!==81){reject(new Error('Invalid MPQ response'));return;}
          files[index]=new File([req.response],C_MPQ_FILENAMES[index]);resolve();
        };
        req.onerror=function(){reject(new Error('Game data network error'));};
        req.ontimeout=function(){reject(new Error('Game data download timed out'));};
        req.send();
      });
    })).then(function(){
      is_fetching_default_mpqs=false;
      try { store_mpq_in_db(); } catch(error) { console.warn('Cache unavailable; continuing playback',error); }
      reset_loading_files_screen();
      parse_mpq_files();
    }).catch(function(error){is_fetching_default_mpqs=false;notify('error',{message:error.message});show_loading_files_screen('Game data unavailable. Use Retry above the player.');});
  };
  var originalRead = on_read_all_done;
  on_read_all_done = function(){
    if (!runtimeReady) { pendingRead = true; return; }
    notify('ready');originalRead();
  };
  var originalStart = start_replay;
  start_replay = function(buffer,length){try{originalStart(buffer,length);notify('playing');}catch(error){notify('error',{message:String(error)});throw error;}};
  load_replay_url = function(url) {
    resume_viewer_main_loop();currentReplaySourceUrl=url;
    var req=new XMLHttpRequest();req.open('GET',url,true);req.responseType='arraybuffer';req.timeout=60000;
    req.onload=function(){
      if(req.status!==200){notify('error',{message:'Replay: HTTP '+req.status});return;}
      try{ReplayDownload.setSource(req.response,ReplayDownload.filenameFromUrl(url));var arr=new Int8Array(req.response);var buf=allocate_replay_buffer(arr);try{start_replay(buf,arr.length);}finally{_free(buf);}}
      catch(error){notify('error',{message:String(error)});}
    };
    req.onerror=function(){notify('error',{message:'Replay network error'});};
    req.ontimeout=function(){notify('error',{message:'Replay download timed out'});};req.send();
  };
  window.addEventListener('error',function(event){notify('error',{message:event.message});});
  window.addEventListener('unhandledrejection',function(event){notify('error',{message:String(event.reason)});});
  var originalFatal=js_fatal_error;
  js_fatal_error=function(ptr){notify('error',{message:UTF8ToString(ptr)});originalFatal(ptr);};
})();
