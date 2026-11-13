import { INVITATION_TTL_MS, PRODUCT_NAME } from '@cod/shared';
import type { AuthEmailLocale, AuthEmailVars, RenderedEmail } from '@cod/plugin-auth';
import { describeDuration, isolate, type MessageSpec, renderMessage, requireHttpUrl, requireVar } from './layout';

/** The names Team passes in: who invited and to which business. */
interface Invitation {
  readonly inviter: string;
  readonly business: string;
  readonly link: string;
}

/** A merchant-typed business name goes into the subject header: a line break there must not start a new header. */
function singleLine(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function spec(locale: AuthEmailLocale, { inviter, business, link }: Invitation): MessageSpec {
  const life = describeDuration(locale, INVITATION_TTL_MS);
  const subjectBusiness = singleLine(business);
  if (locale === 'ar') {
    return {
      subject: `دعوة للانضمام إلى فريق ${isolate(subjectBusiness)} على ${PRODUCT_NAME}`,
      greeting: 'مرحبًا،',
      paragraphs: [
        `دعاك ${isolate(inviter)} للانضمام إلى فريق ${isolate(business)} على ${PRODUCT_NAME}. اضغط على الزر أدناه لإنشاء حسابك وقبول الدعوة.`,
      ],
      action: { label: 'قبول الدعوة', url: link },
      footnote: `الرابط صالح لمدة ${life} ويعمل مرة واحدة فقط. إذا لم تكن تتوقع هذه الدعوة، تجاهل هذه الرسالة.`,
    };
  }
  return {
    subject: `Join the ${subjectBusiness} team on ${PRODUCT_NAME}`,
    greeting: 'Hello,',
    paragraphs: [
      `${inviter} invited you to join the ${business} team on ${PRODUCT_NAME}. Use the button below to create your account and accept the invitation.`,
    ],
    action: { label: 'Accept invitation', url: link },
    footnote: `The link is valid for ${life} and works once. If you did not expect this invitation, ignore this email.`,
  };
}

/** The email that invites a person to a business's team (D203): a one-time link to the accept page. */
export function renderTeamInvitation(locale: AuthEmailLocale, vars: AuthEmailVars): RenderedEmail {
  return renderMessage(
    locale,
    spec(locale, {
      inviter: requireVar(vars, 'inviter'),
      business: requireVar(vars, 'business'),
      link: requireHttpUrl(requireVar(vars, 'link')),
    }),
  );
}
