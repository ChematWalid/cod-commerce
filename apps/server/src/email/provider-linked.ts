import { PRODUCT_NAME } from '@cod/shared';
import type { AuthEmailLocale, AuthEmailVars, RenderedEmail } from '@cod/plugin-auth';
import { isolate, type MessageSpec, renderMessage, requireVar } from './layout';

/** How each sign-in provider is named to the reader; an unknown one is shown as sent. */
const PROVIDER_LABELS: Readonly<Record<string, string>> = { google: 'Google', facebook: 'Facebook' };

function spec(locale: AuthEmailLocale, name: string, provider: string): MessageSpec {
  if (locale === 'ar') {
    return {
      subject: `تم ربط تسجيل الدخول عبر ${provider} بحسابك في ${PRODUCT_NAME}`,
      greeting: `مرحبًا ${isolate(name)}،`,
      paragraphs: [
        `ربطتَ للتو تسجيل الدخول عبر ${isolate(provider)} بحسابك.`,
        'لحماية حسابك، أُلغيت كلمة المرور السابقة وأُنهيت كل الجلسات المفتوحة.',
        'لتسجيل الدخول بكلمة مرور مجددًا، استخدم «نسيت كلمة المرور» في صفحة تسجيل الدخول.',
      ],
      footnote: 'أُرسلت هذه الرسالة لإعلامك فقط.',
    };
  }
  return {
    subject: `${provider} sign-in was linked to your ${PRODUCT_NAME} account`,
    greeting: `Hello ${name},`,
    paragraphs: [
      `You just linked ${provider} sign-in to your account.`,
      'To protect your account, the previous password was cancelled and every open session was ended.',
      'To sign in with a password again, use "Forgot password" on the sign-in page.',
    ],
    footnote: 'This message is only a notice.',
  };
}

/** Sent when the first provider login is linked to an account and its earlier password and sessions are voided. */
export function renderProviderLinked(locale: AuthEmailLocale, vars: AuthEmailVars): RenderedEmail {
  const provider = requireVar(vars, 'provider');
  return renderMessage(locale, spec(locale, requireVar(vars, 'name'), PROVIDER_LABELS[provider] ?? provider));
}
