import { PRODUCT_NAME } from '@cod/shared';
import type { AuthEmailLocale, AuthEmailVars, RenderedEmail } from '@cod/plugin-auth';
import { isolate, type MessageSpec, renderMessage, requireVar } from './layout';

function spec(locale: AuthEmailLocale, name: string): MessageSpec {
  if (locale === 'ar') {
    return {
      subject: `تم تغيير كلمة مرورك في ${PRODUCT_NAME}`,
      greeting: `مرحبًا ${isolate(name)}،`,
      paragraphs: ['تم تغيير كلمة مرور حسابك للتو.', 'إذا لم تكن أنت من قام بذلك، فأعد تعيين كلمة المرور فورًا.'],
      footnote: 'أُرسلت هذه الرسالة لإعلامك فقط.',
    };
  }
  return {
    subject: `Your ${PRODUCT_NAME} password was changed`,
    greeting: `Hello ${name},`,
    paragraphs: ['The password of your account was just changed.', 'If this was not you, reset your password now.'],
    footnote: 'This message is only a notice.',
  };
}

/** Sent after a password change or reset. */
export function renderPasswordChanged(locale: AuthEmailLocale, vars: AuthEmailVars): RenderedEmail {
  return renderMessage(locale, spec(locale, requireVar(vars, 'name')));
}
