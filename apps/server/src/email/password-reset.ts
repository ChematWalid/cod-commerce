import { PRODUCT_NAME, RESET_TOKEN_TTL_MS } from '@cod/shared';
import type { AuthEmailLocale, AuthEmailVars, RenderedEmail } from '@cod/plugin-auth';
import { describeDuration, isolate, type MessageSpec, renderMessage, requireHttpUrl, requireVar } from './layout';

function spec(locale: AuthEmailLocale, name: string, link: string): MessageSpec {
  const life = describeDuration(locale, RESET_TOKEN_TTL_MS);
  if (locale === 'ar') {
    return {
      subject: `إعادة تعيين كلمة المرور في ${PRODUCT_NAME}`,
      greeting: `مرحبًا ${isolate(name)}،`,
      paragraphs: ['تلقّينا طلبًا لإعادة تعيين كلمة مرور حسابك. اضغط على الزر أدناه لاختيار كلمة مرور جديدة.'],
      action: { label: 'إعادة تعيين كلمة المرور', url: link },
      footnote: `الرابط صالح لمدة ${life} ويعمل مرة واحدة فقط. إذا لم تطلب ذلك، تجاهل هذه الرسالة: كلمة مرورك لم تتغير.`,
    };
  }
  return {
    subject: `Reset your ${PRODUCT_NAME} password`,
    greeting: `Hello ${name},`,
    paragraphs: ['We received a request to reset your account password. Use the button below to choose a new one.'],
    action: { label: 'Reset password', url: link },
    footnote: `The link is valid for ${life} and works once. If you did not ask for this, ignore this email: your password has not changed.`,
  };
}

/** The email with the password reset link. */
export function renderPasswordReset(locale: AuthEmailLocale, vars: AuthEmailVars): RenderedEmail {
  return renderMessage(locale, spec(locale, requireVar(vars, 'name'), requireHttpUrl(requireVar(vars, 'link'))));
}
