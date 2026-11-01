/* Explicit acceptance mode: compare actual WASM frame fingerprints to a live match. */
(function () {
  var name = new URLSearchParams(location.search).get('verify');
  if (!name) return;
  var reference = fetch('../validation/' + name).then(function (r) {
    if (!r.ok) throw new Error('Reference trace unavailable');
    return r.json();
  });
  var previous = Module.onRuntimeInitialized;
  Module.onRuntimeInitialized = function () {
    ENV.UNIFIED_TRACE_PATH = '/state.trace';
    if (previous) previous();
    var status = document.createElement('output');
    status.id = 'trace-verification';
    status.style.cssText = 'position:fixed;top:4px;left:4px;z-index:10000;background:#111;color:#fff;padding:8px;font:14px monospace';
    status.textContent = 'Waiting for final replay frame';
    document.body.appendChild(status);
    var timer = setInterval(function () {
      if (!main_has_been_called || _replay_get_value(4) <= 0 || _replay_get_value(2) < _replay_get_value(4)) return;
      clearInterval(timer);
      reference.then(async function (expected) {
        var actual = FS.readFile('/state.trace', {encoding: 'utf8'}).replace(/\r\n/g, '\n');
        var digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(actual));
        var sha256 = Array.from(new Uint8Array(digest), function (b) { return b.toString(16).padStart(2, '0'); }).join('');
        var frames = actual.trim().split(/\n/).length;
        status.textContent = JSON.stringify({passed: sha256 === expected.sha256 && frames === expected.frames,
          comparedFrames: frames, expectedFrames: expected.frames, finalFrame: _replay_get_value(2), sha256: sha256});
      }).catch(function (error) { status.textContent = error.message; });
    }, 250);
  };
})();
