import {
  type AreaLevel,
  areaLevelOf,
  PERMISSION_CATALOG,
  type PermissionAreaEntry,
  type PermissionKey,
} from '@cod/shared';
import { useLingui } from '@lingui/react';
import { AccordionContent, AccordionItem, AccordionTrigger, RadioGroup, RadioGroupItem } from '@vendure/dashboard';
import { type ReactNode, useId } from 'react';
import { labelIn, useUiLanguage } from '../labels';
import { LtrRun } from './ltr-run';
import { PermissionRow } from './permission-row';

const AREA_LEVELS: readonly AreaLevel[] = ['none', 'view', 'full'];
const LEVEL_MESSAGE_IDS: Readonly<Record<AreaLevel | 'custom', string>> = {
  none: 'rbac.level-none',
  view: 'rbac.level-view',
  full: 'rbac.level-full',
  custom: 'rbac.level-custom',
};

interface AreaPermissionsProps {
  readonly area: PermissionAreaEntry;
  readonly held: readonly PermissionKey[];
  readonly onLevel: (level: AreaLevel) => void;
  readonly onPermission: (key: PermissionKey, on: boolean) => void;
}

function LevelChoice({ level, current }: { readonly level: AreaLevel; readonly current: string }): ReactNode {
  const { i18n } = useLingui();
  const id = useId();
  return (
    <label htmlFor={id} className="flex items-center gap-2 text-sm" data-current={current === level}>
      <RadioGroupItem id={id} value={level} />
      {i18n._(LEVEL_MESSAGE_IDS[level])}
    </label>
  );
}

interface AreaHeaderProps {
  readonly title: string;
  readonly level: AreaLevel | 'custom';
  readonly heldCount: number;
  readonly total: number;
}

function AreaHeader({ title, level, heldCount, total }: AreaHeaderProps): ReactNode {
  const { i18n } = useLingui();
  return (
    <AccordionTrigger>
      <span className="flex flex-1 flex-wrap items-center justify-between gap-2 pe-2">
        <span>{title}</span>
        <span className="text-muted-foreground flex items-center gap-2 text-xs font-normal">
          {i18n._(LEVEL_MESSAGE_IDS[level])}
          <LtrRun>{`${String(heldCount)} / ${String(total)}`}</LtrRun>
        </span>
      </span>
    </AccordionTrigger>
  );
}

/** One area of the role editor: its level, how much is held, and a switch per permission. */
export function AreaPermissions({ area, held, onLevel, onPermission }: AreaPermissionsProps): ReactNode {
  const language = useUiLanguage();
  const permissions = PERMISSION_CATALOG.filter((entry) => entry.area === area.id);
  const level = areaLevelOf(area.id, held);
  const heldCount = permissions.filter((entry) => held.includes(entry.key)).length;
  return (
    <AccordionItem value={area.id}>
      <AreaHeader
        title={labelIn(area.label, language)}
        level={level}
        heldCount={heldCount}
        total={permissions.length}
      />
      <AccordionContent>
        <RadioGroup
          className="flex flex-wrap gap-4 pb-2"
          value={level}
          aria-label={labelIn(area.label, language)}
          onValueChange={(next) => {
            onLevel(next as AreaLevel);
          }}
        >
          {AREA_LEVELS.map((choice) => (
            <LevelChoice key={choice} level={choice} current={level} />
          ))}
        </RadioGroup>
        {permissions.map((permission) => (
          <PermissionRow
            key={permission.key}
            permission={permission}
            checked={held.includes(permission.key)}
            onChange={onPermission}
          />
        ))}
      </AccordionContent>
    </AccordionItem>
  );
}
