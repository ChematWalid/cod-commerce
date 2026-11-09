// Mailpit helper of scripts/evidence/P1.S2.sh. Node 24 strips the types of the imported .ts file.
//
//   node P1.S2-mailpit.mjs secrets <mailpit-url> <to> <contains|-> <min-count>        prints the token, then the code
//   node P1.S2-mailpit.mjs dump <mailpit-url> <to> <contains|-> <min-count> <out.md> <title>   appends the email, redacted
/* global process, console -- Node globals */
import { appendFileSync } from 'node:fs';
import { emailSecrets, waitForEmail } from '../../apps/server/tests/browser/mailpit.ts';

const [command, baseUrl, to, contains, minCount, out, title] = process.argv.slice(2);
if (!command || !baseUrl || !to || !contains || !minCount) throw new Error('usage: see the header of this file');
const email = await waitForEmail(baseUrl, to, {
  ...(contains !== '-' && { contains }),
  minCount: Number(minCount),
});
const { token, code } = emailSecrets(email);

/** The text as it may be committed; refuses to go on if a secret survived. */
function redact(text) {
  let shown = text;
  if (token) shown = shown.split(token).join('[REDACTED_TOKEN]');
  if (code) shown = shown.split(code).join('[REDACTED_OTP]');
  if ((token && shown.includes(token)) || (code && shown.includes(code))) throw new Error('redaction failed');
  return shown;
}

if (command === 'secrets') {
  console.log(token ?? '');
  console.log(code ?? '');
} else if (command === 'dump') {
  if (!out || !title) throw new Error('dump needs <out.md> and <title>');
  // The html part is checked to carry the same secrets, and is not written: it repeats the text.
  if (token && !email.html.includes(token)) throw new Error(`${title}: the html part lacks the link`);
  if (code && !email.html.includes(code)) throw new Error(`${title}: the html part lacks the code`);
  appendFileSync(
    out,
    `### ${title}\n\n- From: ${email.from}\n- To: ${email.to}\n- Subject: ${email.subject}\n\n\`\`\`text\n${redact(email.text).trim()}\n\`\`\`\n\n`,
  );
} else {
  throw new Error(`unknown command ${command}`);
}
