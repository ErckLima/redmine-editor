(function () {
  var EDITOR_BASE_URL = 'https://ercklima.github.io/redmine-editor/';
  var BUTTON_ID = 'redmine-editor-launcher-btn';

  function getIssueNumber() {
    var match = location.pathname.match(/\/issues\/(\d+)/);
    return match ? match[1] : null;
  }

  function buildEditorUrl(issueNumber) {
    return EDITOR_BASE_URL + '?demanda=' + encodeURIComponent(issueNumber);
  }

  function createButton(issueNumber) {
    var link = document.createElement('a');
    link.id = BUTTON_ID;
    link.className = 'redmine-editor-launcher-btn icon icon-edit';
    link.href = buildEditorUrl(issueNumber);
    link.target = '_blank';
    link.rel = 'noopener';
    link.title = 'Abrir a demanda #' + issueNumber + ' no Redmine Editor';
    link.textContent = '📋 Abrir no Editor';
    return link;
  }

  function injectButton() {
    if (document.getElementById(BUTTON_ID)) return;

    var issueNumber = getIssueNumber();
    if (!issueNumber) return;

    var button = createButton(issueNumber);

    // Local pedido: ao lado do assunto da demanda (título dentro da caixa amarela).
    var subjectHeading = document.querySelector('div.subject h3');
    if (subjectHeading) {
      subjectHeading.appendChild(button);
      return;
    }

    // Fallback: barra de ações do topo da issue (Editar / Copiar / etc).
    var contextual = document.querySelector('.contextual');
    if (contextual) {
      contextual.insertBefore(button, contextual.firstChild);
    }
  }

  injectButton();
})();
