import { EMAIL_CHANGE_TTL_MS, PRODUCT_NAME } from '@cod/shared';
import type { AuthEmailLocale, AuthEmailVars, RenderedEmail } from '@cod/plugin-auth';
import { describeDuration, isolate, type MessageSpec, renderMessage, requireHttpUrl, requireVar } from './layout';

function spec(locale: AuthEmailLocale, name: string, link: string, newEmail: string): MessageSpec {
  const life = describeDuration(locale, EMAIL_CHANGE_TTL_MS);
  if (locale === 'ar') {
    return {
      subject: `تأكيد عنوان بريدك الإلكتروني الجديد في ${PRODUCT_NAME}`,
      greeting: `مرحبًا ${isolate(name)}،`,
      paragraphs: [
        `طُلب تغيير بريد حسابك في ${PRODUCT_NAME} إلى هذا العنوان: ${isolate(newEmail)}. اضغط على الزر أدناه لتأكيد التغيير.`,
      ],
      action: { label: 'تأكيد البريد الجديد', url: link },
      footnote: `الرابط صالح لمدة ${life}. إذا لم تطلب ذلك، تجاهل هذه الرسالة ولن يتغير شيء.`,
    };
  }
  return {
    subject: `Confirm your new email address on ${PRODUCT_NAME}`,
    greeting: `Hello ${name},`,
    paragraphs: [
      `A request was made to change the email of your ${PRODUCT_NAME} account to this address: ${newEmail}. Use the button below to confirm the change.`,
    ],
    action: { label: 'Confirm new email address', url: link },
    footnote: `The link is valid for ${life}. If you did not ask for this, ignore this email and nothing will change.`,
  };
}

/** Sent to the new address of an email change, with the link that confirms it. */
export function renderEmailChangeConfirm(locale: AuthEmailLocale, vars: AuthEmailVars): RenderedEmail {
  return renderMessage(
    locale,
    spec(locale, requireVar(vars, 'name'), requireHttpUrl(requireVar(vars, 'link')), requireVar(vars, 'newEmail')),
  );
}
