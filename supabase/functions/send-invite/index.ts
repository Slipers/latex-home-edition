// LaTeX Home Edition — e-mail d'invitation « Live Modification »
//
// Fonction Supabase Edge (Deno). Appelée par l'application juste après une
// invitation. Elle vérifie auprès de la base (fonction lhe_invite_info, avec
// les droits de la personne connectée) que l'appelant est bien propriétaire
// du document et que l'adresse est invitée, puis envoie l'e-mail par SMTP.
//
// Secrets à définir (Edge Functions → Secrets) :
//   SMTP_HOST  ex. smtp.gmail.com        SMTP_PORT  465
//   SMTP_USER  adresse du compte          SMTP_PASS  mot de passe d'application
//   SMTP_FROM  ex. LaTeX Home Edition <adresse@gmail.com>
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { SMTPClient } from 'https://deno.land/x/denomailer@1.6.0/mod.ts';

const SITE = 'https://slipers.github.io/latex-home-edition/';
const APP = 'https://github.com/Slipers/latex-home-edition/releases/latest';
const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
const esc = (s: string) => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
const VERB: Record<string, string> = { editor: 'modifier', commenter: 'commenter', viewer: 'lire' };
const ROLE: Record<string, string> = { editor: 'Éditeur', commenter: 'Commentateur', viewer: 'Lecteur' };

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'method' }, 405);
  try {
    const auth = req.headers.get('Authorization') || '';
    const { doc_id, email } = await req.json();
    if (!doc_id || !email) return json({ error: 'LHE_ARGS' }, 400);

    // Vérification des droits avec l'identité de l'appelant (RLS + fonction SQL)
    const key = Deno.env.get('SUPABASE_ANON_KEY') || Deno.env.get('SUPABASE_PUBLISHABLE_KEY') || '';
    const sb = createClient(Deno.env.get('SUPABASE_URL')!, key, { global: { headers: { Authorization: auth } } });
    const { data: info, error } = await sb.rpc('lhe_invite_info', { p_doc: doc_id, p_email: email });
    if (error || !info) return json({ error: error ? error.message : 'LHE_FORBIDDEN' }, 403);

    const title = info.title || 'Sans titre';
    const from = info.from || 'Quelqu\'un';
    const link = SITE + 'd/#' + info.doc;
    const verb = VERB[info.role] || 'lire';
    const accountLine = info.has_account
      ? 'Ouvrez le lien : le document apparaît aussi dans « Documents en ligne » de l\'application.'
      : 'Pour y accéder, créez un compte LaTeX Home Edition avec cette adresse e-mail (' + info.email + ') : dans l\'application, bouton « Se connecter » → « Créer un compte ».';
    const subject = from + ' vous invite à ' + verb + ' « ' + title + ' »';
    const text = 'Bonjour,\n\n' + from + ' vous invite à ' + verb + ' le document « ' + title + ' » dans LaTeX Home Edition, en direct (rôle : ' + (ROLE[info.role] || info.role) + ').\n\n'
      + 'Ouvrir le document : ' + link + '\n\n' + accountLine + '\n\n'
      + 'Pas encore l\'application ? Elle est gratuite (Windows et Mac) : ' + APP + '\n\n'
      + 'Si vous ne connaissez pas ' + from + ', vous pouvez ignorer cet e-mail.\n';
    const html = `<!doctype html><html lang="fr"><body style="margin:0;background:#f5f6f8;font-family:Segoe UI,Arial,sans-serif;color:#1f2430">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:28px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#fff;border:1px solid #e1e4ea;border-radius:14px">
<tr><td style="padding:26px 28px">
<div style="font-size:13px;color:#6b7385;margin-bottom:14px"><span style="display:inline-block;width:26px;height:26px;border-radius:7px;background:#2b4c7e;color:#fff;text-align:center;line-height:26px;font-family:Cambria,serif;margin-right:8px">∑</span>LaTeX Home Edition</div>
<h1 style="font-size:19px;margin:0 0 10px;line-height:1.35">${esc(from)} vous invite à ${esc(verb)} « ${esc(title)} »</h1>
<p style="margin:0 0 18px;line-height:1.55;color:#3b4456">Modification en direct, à plusieurs : chacun voit les changements des autres au moment où ils sont faits. Votre rôle : <b>${esc(ROLE[info.role] || info.role)}</b>.</p>
<p style="margin:0 0 20px"><a href="${link}" style="display:inline-block;background:#2b4c7e;color:#fff;text-decoration:none;font-weight:600;padding:12px 20px;border-radius:9px">Ouvrir le document</a></p>
<p style="margin:0 0 10px;line-height:1.55;font-size:13.5px;color:#3b4456">${esc(accountLine)}</p>
<p style="margin:0;line-height:1.55;font-size:12.5px;color:#6b7385">Pas encore l'application ? Elle est gratuite (Windows et Mac) : <a href="${APP}" style="color:#2b4c7e">télécharger LaTeX Home Edition</a>.<br>Si vous ne connaissez pas ${esc(from)}, vous pouvez ignorer cet e-mail.</p>
</td></tr></table></td></tr></table></body></html>`;

    const port = Number(Deno.env.get('SMTP_PORT') || '465');
    const client = new SMTPClient({
      connection: {
        hostname: Deno.env.get('SMTP_HOST')!, port, tls: port === 465,
        auth: { username: Deno.env.get('SMTP_USER')!, password: Deno.env.get('SMTP_PASS')! },
      },
    });
    await client.send({ from: Deno.env.get('SMTP_FROM') || Deno.env.get('SMTP_USER')!, to: info.email, subject, content: text, html });
    await client.close();
    return json({ ok: true });
  } catch (e) {
    return json({ error: String((e && (e as Error).message) || e) }, 500);
  }
});
