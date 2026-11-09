import { OTP_TTL_MS, PRODUCT_NAME, VERIFY_LINK_TTL_MS } from '@cod/shared';
import type { AuthEmailLocale, AuthEmailVars, RenderedEmail } from '@cod/plugin-auth';
import { describeDuration, isolate, type MessageSpec, renderMessage, requireHttpUrl, requireVar } from './layout';

function spec(locale: AuthEmailLocale, name: string, link: string, code: string): MessageSpec {
  const linkLife = describeDuration(locale, VERIFY_LINK_TTL_MS);
  const codeLife = describeDuration(locale, OTP_TTL_MS);
  if (locale === 'ar') {
    return {
      subject: `تأكيد بريدك الإلكتروني في ${PRODUCT_NAME}`,
      greeting: `مرحبًا ${isolate(name)}،`,
      paragraphs: [
        `شكرًا لانضمامك إلى ${PRODUCT_NAME}. أكّد بريدك الإلكتروني بالضغط على الزر أدناه، أو أدخل الرمز في صفحة التأكيد.`,
      ],
      action: { label: 'تأكيد البريد الإلكتروني', url: link },
      code: { label: `رمز التأكيد (صالح لمدة ${codeLife}):`, value: code },
      footnote: `الرابط صالح لمدة ${linkLife}. إذا لم تنشئ حسابًا، تجاهل هذه الرسالة.`,
    };
  }
  return {
    subject: `Confirm your email address on ${PRODUCT_NAME}`,
    greeting: `Hello ${name},`,
    paragraphs: [
      `Thanks for joining ${PRODUCT_NAME}. Confirm your email address with the button below, or enter the code on the confirmation page.`,
    ],
    action: { label: 'Confirm email address', url: link },
    code: { label: `Your code (valid for ${codeLife}):`, value: code },
    footnote: `The link is valid for ${linkLife}. If you did not create an account, ignore this email.`,
  };
}

/** The email that confirms a new account's address: a link and a six-digit code. */
export function renderVerification(locale: AuthEmailLocale, vars: AuthEmailVars): RenderedEmail {
  return renderMessage(
    locale,
    spec(locale, requireVar(vars, 'name'), requireHttpUrl(requireVar(vars, 'link')), requireVar(vars, 'code')),
  );
}
