// Helper compartilhado para buscar uma issue no Redmine, com o mesmo
// tratamento de timeout/502 usado no proxy principal (rapid-worker).

export const REDMINE_BASE = "http://177.69.209.157:65080/redmine";

export type RedmineFetchResult =
  | { ok: true; status: number; data: any }
  | { ok: false; status: number; error: string; detail?: string };

export async function fetchRedmineIssue(
  issueId: string | number,
  redmineApiKey: string
): Promise<RedmineFetchResult> {
  const url = `${REDMINE_BASE}/issues/${issueId}.json`;

  let response: Response;
  try {
    response = await fetch(url, {
      headers: {
        "Content-Type": "application/json",
        "X-Redmine-API-Key": redmineApiKey,
      },
      signal: AbortSignal.timeout(15000),
    });
  } catch (fetchErr) {
    const msg = String(fetchErr);
    const isTimeout = msg.includes("Timeout") || msg.includes("timeout") || msg.includes("AbortError");
    return {
      ok: false,
      status: 502,
      error: isTimeout
        ? "Timeout ao conectar ao Redmine (servidor demorou mais de 15s para responder)."
        : "Não foi possível conectar ao Redmine. Verifique se o servidor está acessível.",
      detail: msg,
    };
  }

  if (response.status === 404) {
    return { ok: false, status: 404, error: "Demanda não encontrada no Redmine." };
  }

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    return { ok: false, status: response.status, error: "Erro ao buscar demanda no Redmine.", detail };
  }

  const data = await response.json();
  return { ok: true, status: 200, data };
}
