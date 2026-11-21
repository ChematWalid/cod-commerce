import type { OfferTargetRole } from '@cod/shared';
import type { ReactNode } from 'react';
import { maxTargetsOf } from '../../model/kind-editors';
import type { KindEditorProps } from '../kind-editor-slot';
import { TargetPicker } from '../target-picker';

interface RolePickerProps {
  readonly editor: KindEditorProps;
  readonly role: OfferTargetRole;
  readonly legendId: string;
}

/**
 * The target picker of one role inside a kind's card, capped at the role's most targets (five add-on products,
 * D2505); the targets error of a refused publish is shown under the buy picker only.
 */
export function RolePicker({ editor, role, legendId }: RolePickerProps): ReactNode {
  return (
    <TargetPicker
      scope={editor.scope}
      role={role}
      legendId={legendId}
      targets={editor.targets}
      max={maxTargetsOf(role)}
      onTargets={(next) => {
        editor.onTargets([...next]);
      }}
      disabled={editor.disabled}
      errorId={role === 'buy' ? editor.targetsErrorId : undefined}
    />
  );
}
