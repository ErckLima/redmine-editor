var REDMINE_INTRANET_BASE = 'http://net1/redmine';

// Faz a chamada ao Redmine interno em nome do editor (rodando em outra origem,
// no GitHub Pages). Como é o service worker da extensão que executa o fetch,
// as regras de CORS e conteúdo misto (HTTPS -> HTTP) da página não se aplicam aqui.
function fetchRedmine(message) {
  var url = REDMINE_INTRANET_BASE + message.path;

  var opts = {
    method: message.method || 'GET',
    headers: {
      'Content-Type': 'application/json',
      'X-Redmine-API-Key': message.apiKey
    }
  };
  if (message.body !== undefined && message.body !== null) {
    opts.body = message.body;
  }

  return fetch(url, opts).then(function (resp) {
    return resp.text().then(function (text) {
      return { ok: resp.ok, status: resp.status, body: text };
    });
  });
}

chrome.runtime.onMessage.addListener(function (message, sender, sendResponse) {
  if (!message) return false;

  if (message.type === 'PING') {
    sendResponse({ pong: true });
    return false;
  }

  if (message.type === 'REDMINE_FETCH') {
    fetchRedmine(message)
      .then(function (result) { sendResponse(result); })
      .catch(function (err) { sendResponse({ ok: false, status: 0, body: '', error: String(err) }); });
    return true; // mantém o canal aberto para a resposta assíncrona
  }

  return false;
});
