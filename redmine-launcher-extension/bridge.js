(function () {
  var APP_SOURCE = 'redmine-editor-app';
  var EXT_SOURCE = 'redmine-editor-extension';

  console.log('[RedmineEditor Extension] bridge.js carregado em', location.href);

  window.addEventListener('message', function (event) {
    if (event.source !== window || event.origin !== location.origin) return;
    var data = event.data;
    if (!data || data.source !== APP_SOURCE) return;

    if (data.type === 'REDMINE_EDITOR_PING') {
      window.postMessage({ source: EXT_SOURCE, type: 'EXTENSION_READY', requestId: data.requestId }, location.origin);
      return;
    }

    if (data.type === 'REDMINE_FETCH_REQUEST') {
      chrome.runtime.sendMessage({
        type: 'REDMINE_FETCH',
        path: data.path,
        method: data.method,
        apiKey: data.apiKey,
        body: data.body
      }, function (result) {
        window.postMessage({
          source: EXT_SOURCE,
          type: 'REDMINE_FETCH_RESPONSE',
          requestId: data.requestId,
          result: result || null
        }, location.origin);
      });
    }
  });

  // Anuncia presença assim que a página carrega, sem esperar um ping.
  window.postMessage({ source: EXT_SOURCE, type: 'EXTENSION_READY' }, location.origin);
})();
