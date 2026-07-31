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

// Repete os mesmos 4 passos que o proxy Supabase (upload-image) faz: busca os
// anexos atuais, sobe o arquivo em /uploads.json, associa o token à issue via
// PUT, e busca os anexos de novo para descobrir o nome final gerado pelo Redmine.
function uploadImageToRedmine(message) {
  var apiKey = message.apiKey;
  var issueId = message.issueId;
  var filename = message.filename;
  var imageBytes = message.imageBytes;

  function redmineJson(path, opts) {
    return fetch(REDMINE_INTRANET_BASE + path, opts).then(function (resp) {
      return resp.json().then(function (data) { return { resp: resp, data: data }; });
    });
  }

  return redmineJson('/issues/' + issueId + '.json?include=attachments', {
    headers: { 'Content-Type': 'application/json', 'X-Redmine-API-Key': apiKey }
  }).then(function (before) {
    var attachmentsBefore = ((before.resp.ok && before.data.issue && before.data.issue.attachments) || [])
      .map(function (a) { return a.filename; });

    return fetch(REDMINE_INTRANET_BASE + '/uploads.json?filename=' + encodeURIComponent(filename), {
      method: 'POST',
      headers: { 'Content-Type': 'application/octet-stream', 'X-Redmine-API-Key': apiKey },
      body: imageBytes
    }).then(function (uploadRes) {
      if (!uploadRes.ok) {
        return uploadRes.text().then(function (t) { throw new Error('Falha no upload (' + uploadRes.status + '): ' + t); });
      }
      return uploadRes.json();
    }).then(function (uploadData) {
      var token = uploadData && uploadData.upload && uploadData.upload.token;
      if (!token) throw new Error('Token de upload não retornado pelo Redmine.');

      return fetch(REDMINE_INTRANET_BASE + '/issues/' + issueId + '.json', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'X-Redmine-API-Key': apiKey },
        body: JSON.stringify({ issue: { uploads: [{ token: token, filename: filename, content_type: 'image/png' }] } })
      });
    }).then(function (attachRes) {
      if (!attachRes.ok && attachRes.status !== 204) {
        return attachRes.text().then(function (t) { throw new Error('Falha ao associar imagem (' + attachRes.status + '): ' + t); });
      }
      return new Promise(function (resolve) { setTimeout(resolve, 500); });
    }).then(function () {
      return redmineJson('/issues/' + issueId + '.json?include=attachments', {
        headers: { 'Content-Type': 'application/json', 'X-Redmine-API-Key': apiKey }
      });
    }).then(function (after) {
      if (!after.resp.ok) throw new Error('Upload feito, mas não foi possível confirmar o nome do arquivo.');
      var attachmentsAfter = (after.data.issue && after.data.issue.attachments) || [];
      var newAttachment = attachmentsAfter.filter(function (a) { return attachmentsBefore.indexOf(a.filename) === -1; })[0];
      var chosen = newAttachment || attachmentsAfter[attachmentsAfter.length - 1];
      return {
        success: true,
        filename: chosen ? chosen.filename : filename,
        content_url: chosen ? chosen.content_url : '',
        attachment_id: chosen ? chosen.id : null
      };
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

  if (message.type === 'REDMINE_UPLOAD_IMAGE') {
    uploadImageToRedmine(message)
      .then(function (result) { sendResponse({ ok: true, data: result }); })
      .catch(function (err) { sendResponse({ ok: false, error: String(err && err.message || err) }); });
    return true;
  }

  return false;
});
