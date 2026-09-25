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

    // Logo abaixo do assunto da demanda, num bloco próprio FORA do <h3>: se o botão
    // ficar dentro do título, outras extensões que leem o texto do assunto passam a
    // enxergar "Abrir no Editor" junto com o nome da demanda.
    var subjectBlock = document.querySelector('div.subject');
    if (subjectBlock && subjectBlock.parentNode) {
      var wrapper = document.createElement('div');
      wrapper.className = 'redmine-editor-launcher-wrapper';
      wrapper.appendChild(button);
      subjectBlock.parentNode.insertBefore(wrapper, subjectBlock.nextSibling);
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
