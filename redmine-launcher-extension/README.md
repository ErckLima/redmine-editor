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

**Botão "Abrir no Editor"**: aparece em páginas de demanda (`/issues/NUMERO`)
nos dois endereços do Redmine (interno `net1` e externo por IP). Ao clicar,
abre uma nova aba com `https://ercklima.github.io/redmine-editor/?demanda=NUMERO`,
que carrega a demanda automaticamente no editor.

**Fallback automático pela rede interna**: quando o editor detecta que o link
externo do Redmine está indisponível, e esta extensão está instalada e ativa,
ele passa a buscar/atualizar demandas automaticamente pela rede interna
(`net1`) através do service worker da extensão — sem erro de CORS e sem
precisar liberar conteúdo inseguro no navegador, já que quem faz a chamada é
a extensão, não a página. Isso só funciona com a máquina conectada à
VPN/rede da empresa.

## Atualizações

Sempre que uma nova versão for baixada pelo Redmine Editor, repita o passo
4 apontando para a pasta atualizada (ou clique em recarregar ⟳ na extensão
em `chrome://extensions` se substituir os arquivos na mesma pasta).
