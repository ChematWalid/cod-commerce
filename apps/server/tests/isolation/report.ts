import type { Exchange } from './http';
import type { IsolationAccess, IsolationEntity } from './matrix';
import type { Outcome } from './run';
import type { TenantTable } from './tenant-tables';
import { CATALOG_WORLDS } from './catalog-world';
import { TEAM_WORLDS } from './team-world';
import type { BusinessWorld, World } from './world-types';

const ACCESS_COLUMNS: readonly IsolationAccess[] = ['read by id', 'list', 'write', 'victim channel'];

/** The team rows' ids (P1.S4) as placeholders. */
function teamPlaceholdersOf(label: 'A' | 'B'): [string, string][] {
  const team = TEAM_WORLDS.get(label);
  if (team === undefined) return [];
  return [
    [team.ownerMemberId, `<TEAM_MEMBER_${label}_OWNER>`],
    [team.invited.memberId, `<TEAM_MEMBER_${label}_INVITED>`],
    [team.commission.id, `<COMMISSION_${label}>`],
  ];
}

/** The catalog rows' ids (P2.S1) as placeholders. */
function catalogPlaceholdersOf(label: 'A' | 'B'): [string, string][] {
  const catalog = CATALOG_WORLDS.get(label);
  if (catalog === undefined) return [];
  return [
    [catalog.brand.id, `<BRAND_${label}>`],
    [catalog.tag.id, `<TAG_${label}>`],
    [catalog.highlight.id, `<HIGHLIGHT_${label}>`],
    [catalog.media.id, `<MEDIA_${label}1>`],
    [catalog.otherStoreMedia.id, `<MEDIA_${label}2>`],
    [catalog.catalogRole.id, `<CATALOG_ROLE_${label}>`],
  ];
}

/** Each run value of the world and the placeholder a transcript shows instead; secrets become `[REDACTED]`. */
export function placeholdersOf(world: World): [string, string][] {
  const of = (business: BusinessWorld): [string, string][] => {
    const l = business.label;
    return [
      [business.secret.value, '[REDACTED]'],
      [business.businessId, `<BUSINESS_${l}>`],
      [business.owner.administratorId, `<ADMIN_${l}_OWNER>`],
      [business.member.administratorId, `<ADMIN_${l}_MEMBER>`],
      [business.role.id, `<ROLE_${l}>`],
      [business.secret.id, `<SECRET_${l}>`],
      [business.note.id, `<NOTE_${l}>`],
      [business.logoAssetId, `<LOGO_${l}>`],
      ...teamPlaceholdersOf(l),
      ...catalogPlaceholdersOf(l),
      ...business.stores.flatMap((store): [string, string][] => [
        [store.channelToken, `<TOKEN_${store.label}>`],
        [store.id, `<STORE_${store.label}>`],
      ]),
    ];
  };
  // Longest first, so a value never loses a part to a shorter one it contains.
  return [...of(world.a), ...of(world.b)].sort(([left], [right]) => right.length - left.length);
}

/** Below this length a value (a Vendure integer id) is replaced only where it stands as a quoted string. */
const MIN_BARE_PLACEHOLDER_LENGTH = 8;

const replaced = (text: string, placeholders: readonly [string, string][]): string =>
  placeholders.reduce(
    (result, [value, label]) =>
      value.length >= MIN_BARE_PLACEHOLDER_LENGTH
        ? result.split(value).join(label)
        : result.split(JSON.stringify(value)).join(JSON.stringify(label)),
    text,
  );

const pretty = (value: unknown): string => (typeof value === 'string' ? value : JSON.stringify(value, null, 2));

/** One exchange as a transcript block: the request as sent (session named, not shown) and the live answer. */
export function transcriptOf(exchange: Exchange, placeholders: readonly [string, string][]): string {
  const { request } = exchange;
  const headers = [
    request.caller.token === undefined ? undefined : `authorization: Bearer [session of ${request.caller.label}]`,
    request.channel === undefined ? undefined : `vendure-token: ${request.channel.token}`,
    ...Object.entries(request.headers ?? {}).map(([name, value]) => `${name}: ${value}`),
  ].filter((line): line is string => line !== undefined);
  const body = request.rawBody ?? (request.body as { query?: string; variables?: unknown } | undefined);
  const shownBody =
    body === undefined
      ? ''
      : typeof body === 'string'
        ? `\n\n${body}`
        : `\n\n${body.query ?? pretty(body)}${body.variables === undefined ? '' : `\n\nvariables: ${pretty(body.variables)}`}`;
  const text = [
    '```http',
    `${request.method} ${request.path}`,
    ...headers,
    shownBody.trimEnd(),
    ...(request.upload === undefined
      ? []
      : ['', `file: ${request.upload.name} (${String(request.upload.bytes.length)} bytes)`]),
    '```',
    '',
    `**HTTP ${String(exchange.status)}**`,
    '',
    '```json',
    pretty(exchange.body),
    '```',
  ].join('\n');
  return replaced(text, placeholders);
}

/** A file name for an entity's transcript, e.g. `tenant-secret.md`. */
export const transcriptFileOf = (entity: IsolationEntity): string => `${entity.replaceAll(' ', '-')}.md`;

/** The anchor GitHub gives a `### <heading>` line. */
export const anchorOf = (heading: string): string =>
  heading
    .toLowerCase()
    .replace(/[^\p{L}\p{N} -]/gu, '')
    .replaceAll(' ', '-');

/** The heading of one run of a case in its transcript file. */
export const headingOf = (outcome: Outcome): string =>
  `${outcome.case.id} (${outcome.attacker} attacks ${outcome.attacker === 'A' ? 'B' : 'A'})`;

/** The entity × access matrix, each cell linking to the runs that checked it. */
export function matrixTable(outcomes: readonly Outcome[]): string {
  const entities = [...new Set(outcomes.map((outcome) => outcome.case.entity))];
  const rows = entities.map((entity) => {
    const cells = ACCESS_COLUMNS.map((access) => {
      const runs = outcomes.filter((outcome) => outcome.case.entity === entity && outcome.case.access === access);
      if (runs.length === 0) return '—';
      return runs
        .map((run) => {
          const mark = run.failures.length === 0 ? '✅' : '❌';
          return `[${mark} ${run.case.endpoint}${run.attacker === 'B' ? ' (B→A)' : ''}](api/${transcriptFileOf(entity)}#${anchorOf(headingOf(run))})`;
        })
        .join('<br>');
    });
    return `| ${entity} | ${cells.join(' | ')} |`;
  });
  return [
    `| Entity | ${ACCESS_COLUMNS.join(' | ')} |`,
    `|---|${ACCESS_COLUMNS.map(() => '---').join('|')}|`,
    ...rows,
  ].join('\n');
}

/** The census table: both businesses' rows in every tenant table. */
export const censusTable = (counts: Partial<Record<TenantTable, { a: number; b: number }>>): string =>
  [
    '| Table | Rows of A | Rows of B |',
    '|---|---|---|',
    ...Object.entries(counts).map(([table, { a, b }]) => `| \`${table}\` | ${String(a)} | ${String(b)} |`),
  ].join('\n');
