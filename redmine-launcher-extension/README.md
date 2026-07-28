# Redmine Editor - Abrir no Editor

Extensão de navegador que adiciona um botão nas páginas de demanda do
Redmine (interno e externo) para abrir a demanda direto no [Redmine
Editor](https://ercklima.github.io/redmine-editor/), sem precisar copiar o
número manualmente.

## Instalação (Chrome / Edge)

1. Acesse `chrome://extensions` (ou `edge://extensions`).
2. Ative o **Modo do desenvolvedor** (canto superior direito).
3. Clique em **Carregar sem compactação** (Load unpacked).
4. Selecione esta pasta (`redmine-launcher-extension/`).

## Como funciona

O botão só aparece em páginas de demanda (`/issues/NUMERO`) nos dois
endereços do Redmine (interno `net1` e externo por IP). Ao clicar, abre uma
nova aba com `https://ercklima.github.io/redmine-editor/?demanda=NUMERO`,
que carrega a demanda automaticamente no editor.

## Atualizações

Sempre que uma nova versão for baixada pelo Redmine Editor, repita o passo
4 apontando para a pasta atualizada (ou clique em recarregar ⟳ na extensão
em `chrome://extensions` se substituir os arquivos na mesma pasta).
