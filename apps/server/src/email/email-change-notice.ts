import { PRODUCT_NAME } from '@cod/shared';
import type { AuthEmailLocale, AuthEmailVars, RenderedEmail } from '@cod/plugin-auth';
import { isolate, type MessageSpec, renderMessage, requireVar } from './layout';

function spec(locale: AuthEmailLocale, name: string, newEmail: string): MessageSpec {
  if (locale === 'ar') {
    return {
      subject: `طلب تغيير بريدك الإلكتروني في ${PRODUCT_NAME}`,
      greeting: `مرحبًا ${isolate(name)}،`,
      paragraphs: [
        `طُلب تغيير بريد حسابك إلى: ${isolate(newEmail)}. لن يتغير شيء قبل تأكيد العنوان الجديد.`,
        'إذا لم تكن أنت من طلب ذلك، فغيّر كلمة مرورك فورًا.',
      ],
      footnote: 'أُرسلت هذه الرسالة إلى بريدك الحالي لإعلامك فقط.',
    };
  }
  return {
    subject: `Email change requested on ${PRODUCT_NAME}`,
    greeting: `Hello ${name},`,
    paragraphs: [
      `A request was made to change the email of your account to: ${newEmail}. Nothing changes until the new address is confirmed.`,
      'If this was not you, change your password now.',
    ],
    footnote: 'This message went to your current address to let you know.',
  };
}

/** Sent to the current address when a change is requested, so a hijack attempt is visible. */
export function renderEmailChangeNotice(locale: AuthEmailLocale, vars: AuthEmailVars): RenderedEmail {
  return renderMessage(locale, spec(locale, requireVar(vars, 'name'), requireVar(vars, 'newEmail')));
}
