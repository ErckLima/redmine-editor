const REDMINE_BASE = "http://177.69.209.157:65080/redmine";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-redmine-api-key, x-filename, x-issue-id",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Obter a chave API do Redmine e metadados do header
    const redmineApiKey = req.headers.get("x-redmine-api-key");
    const filename = req.headers.get("x-filename") || "image.png";
    const issueId = req.headers.get("x-issue-id");

    if (!redmineApiKey) {
      return new Response(JSON.stringify({ error: "Chave API do Redmine ausente." }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!issueId) {
      return new Response(JSON.stringify({ error: "ID da issue ausente." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Ler o corpo da requisição (bytes da imagem)
    const imageBytes = await req.arrayBuffer();

    if (!imageBytes || imageBytes.byteLength === 0) {
      return new Response(JSON.stringify({ error: "Nenhum dado de imagem recebido." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ─── PASSO 1: Buscar attachments atuais da issue (para comparar depois) ───
    const beforeRes = await fetch(`${REDMINE_BASE}/issues/${issueId}.json?include=attachments`, {
      headers: {
        "Content-Type": "application/json",
        "X-Redmine-API-Key": redmineApiKey,
      },
    });

    let attachmentsBefore: string[] = [];
    if (beforeRes.ok) {
      const beforeData = await beforeRes.json();
      attachmentsBefore = (beforeData.issue?.attachments || []).map((a: { filename: string }) => a.filename);
    }

    // ─── PASSO 2: Upload do arquivo para o Redmine ────────────────────────────
    const uploadRes = await fetch(`${REDMINE_BASE}/uploads.json?filename=${encodeURIComponent(filename)}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/octet-stream",
        "X-Redmine-API-Key": redmineApiKey,
      },
      body: imageBytes,
    });

    if (!uploadRes.ok) {
      const errText = await uploadRes.text();
      return new Response(JSON.stringify({
        error: `Falha no upload para o Redmine (${uploadRes.status}).`,
        detail: errText,
      }), {
        status: uploadRes.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const uploadData = await uploadRes.json();
    const token = uploadData?.upload?.token;

    if (!token) {
      return new Response(JSON.stringify({ error: "Token de upload não retornado pelo Redmine." }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ─── PASSO 3: Associar o token à issue via PUT ────────────────────────────
    const attachRes = await fetch(`${REDMINE_BASE}/issues/${issueId}.json`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        "X-Redmine-API-Key": redmineApiKey,
      },
      body: JSON.stringify({
        issue: {
          uploads: [
            {
              token: token,
              filename: filename,
              content_type: "image/png",
            },
          ],
        },
      }),
    });

    if (!attachRes.ok && attachRes.status !== 204) {
      const errText = await attachRes.text();
      return new Response(JSON.stringify({
        error: `Falha ao associar imagem à issue (${attachRes.status}).`,
        detail: errText,
      }), {
        status: attachRes.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ─── PASSO 4: Buscar attachments após o upload para obter o nome gerado ───
    // Aguardar um momento para o Redmine processar
    await new Promise(resolve => setTimeout(resolve, 500));

    const afterRes = await fetch(`${REDMINE_BASE}/issues/${issueId}.json?include=attachments`, {
      headers: {
        "Content-Type": "application/json",
        "X-Redmine-API-Key": redmineApiKey,
      },
    });

    if (!afterRes.ok) {
      return new Response(JSON.stringify({
        error: "Upload realizado, mas não foi possível obter o nome do arquivo gerado.",
        token: token,
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const afterData = await afterRes.json();
    const attachmentsAfter: Array<{ filename: string; content_url: string; id: number }> =
      afterData.issue?.attachments || [];

    // Encontrar o novo attachment (que não estava na lista anterior)
    const newAttachment = attachmentsAfter.find(
      (a) => !attachmentsBefore.includes(a.filename)
    );

    if (!newAttachment) {
      // Fallback: pegar o attachment mais recente
      const latest = attachmentsAfter[attachmentsAfter.length - 1];
      return new Response(JSON.stringify({
        success: true,
        filename: latest?.filename || filename,
        content_url: latest?.content_url || "",
        attachment_id: latest?.id || null,
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({
      success: true,
      filename: newAttachment.filename,
      content_url: newAttachment.content_url,
      attachment_id: newAttachment.id,
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err) {
    return new Response(JSON.stringify({
      error: "Erro interno no upload.",
      detail: String(err),
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
