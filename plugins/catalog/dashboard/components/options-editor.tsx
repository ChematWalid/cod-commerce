import { MAX_OPTION_GROUPS, OPTION_NAME_MAX, OPTION_VALUE_MAX } from '@cod/shared';
import { useLingui } from '@lingui/react';
import { Badge, Button, Input } from '@vendure/dashboard';
import { type DragEvent, type ReactNode, useState } from 'react';
import { OPTION_NAME_INPUT_TEST_ID, OPTION_VALUE_INPUT_TEST_ID } from '../constants';
import {
  addGroup,
  addValue,
  isAddValueKey,
  moveGroup,
  moveValue,
  type OptionDraft,
  type OptionsDraft,
  removeGroup,
  removeValue,
} from '../model/options-draft';

interface OptionsEditorProps {
  readonly options: OptionsDraft;
  readonly disabled: boolean;
  readonly onChange: (options: OptionsDraft) => void;
}

interface GroupProps {
  readonly group: OptionDraft;
  readonly index: number;
  readonly editor: OptionsEditorProps;
}

/** A small button whose visible text is an arrow or a cross and whose name is translated. */
function IconButton(
  props: { readonly labelId: string; readonly glyph: string; readonly disabled: boolean } & {
    readonly onClick: () => void;
    /** A sideways arrow points the other way in a right-to-left page. */
    readonly mirrored?: boolean;
  },
): ReactNode {
  const { i18n } = useLingui();
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      aria-label={i18n._(props.labelId)}
      disabled={props.disabled}
      onClick={props.onClick}
    >
      <span aria-hidden className={props.mirrored === true ? 'inline-block rtl:-scale-x-100' : undefined}>
        {props.glyph}
      </span>
    </Button>
  );
}

/** The arrows of the earlier and later buttons. */
const SIDEWAYS_GLYPHS = ['‹', '›'] as const;
const UPRIGHT_GLYPHS = ['↑', '↓'] as const;

interface MoveButtonsProps {
  readonly position: number;
  readonly count: number;
  readonly disabled: boolean;
  /** Values move sideways, so their arrows turn in a right-to-left page; options move up and down. */
  readonly sideways: boolean;
  readonly onMove: (delta: number) => void;
  readonly onRemove: () => void;
}

/** Earlier, later and remove: the keyboard alternative to dragging. */
function MoveButtons(props: MoveButtonsProps): ReactNode {
  const [earlier, later] = props.sideways ? SIDEWAYS_GLYPHS : UPRIGHT_GLYPHS;
  return (
    <span className="flex">
      <IconButton
        labelId="catalog.move-earlier"
        glyph={earlier}
        mirrored={props.sideways}
        disabled={props.disabled || props.position === 0}
        onClick={() => {
          props.onMove(-1);
        }}
      />
      <IconButton
        labelId="catalog.move-later"
        glyph={later}
        mirrored={props.sideways}
        disabled={props.disabled || props.position === props.count - 1}
        onClick={() => {
          props.onMove(1);
        }}
      />
      <IconButton labelId="catalog.remove" glyph="×" disabled={props.disabled} onClick={props.onRemove} />
    </span>
  );
}

/** The values of one option as chips: drag one onto another, or use the earlier/later buttons, to reorder. */
/** Drag and drop of the values of option `index`: the props each value's chip takes. */
function useValueDrag({ index, editor }: Pick<GroupProps, 'index' | 'editor'>) {
  const [dragged, setDragged] = useState<number | null>(null);
  return (valueIndex: number) => ({
    draggable: !editor.disabled,
    className: dragged === valueIndex ? 'cod-catalog-dragging' : undefined,
    onDragStart: () => {
      setDragged(valueIndex);
    },
    onDragEnd: () => {
      setDragged(null);
    },
    onDragOver: (event: DragEvent) => {
      event.preventDefault();
    },
    onDrop: () => {
      if (dragged !== null) editor.onChange(moveValue(editor.options, index, dragged, valueIndex - dragged));
      setDragged(null);
    },
  });
}

function ValueChips({ group, index, editor }: GroupProps): ReactNode {
  const dragProps = useValueDrag({ index, editor });
  const { options, disabled, onChange } = editor;
  return (
    <ul className="flex flex-wrap gap-2">
      {group.values.map((value, valueIndex) => (
        <li key={value} {...dragProps(valueIndex)}>
          <Badge variant="outline" className="gap-1">
            <span className="[overflow-wrap:anywhere]">{value}</span>
            <MoveButtons
              position={valueIndex}
              count={group.values.length}
              disabled={disabled}
              sideways
              onMove={(delta) => {
                onChange(moveValue(options, index, valueIndex, delta));
              }}
              onRemove={() => {
                onChange(removeValue(options, index, valueIndex));
              }}
            />
          </Badge>
        </li>
      ))}
    </ul>
  );
}

/** The field that adds a value to its option when Enter is pressed. */
function ValueInput({ group, index, editor }: GroupProps): ReactNode {
  const { i18n } = useLingui();
  const [typed, setTyped] = useState('');
  return (
    <Input
      data-testid={OPTION_VALUE_INPUT_TEST_ID}
      data-option-index={index}
      aria-label={i18n._('catalog.option-add-value', { name: group.name })}
      placeholder={i18n._('catalog.option-value-placeholder')}
      maxLength={OPTION_VALUE_MAX}
      value={typed}
      disabled={editor.disabled}
      onChange={(event) => {
        setTyped(event.target.value);
      }}
      onKeyDown={(event) => {
        if (!isAddValueKey(event.key)) return;
        event.preventDefault();
        editor.onChange(addValue(editor.options, index, typed));
        setTyped('');
      }}
    />
  );
}

function OptionGroupCard(props: GroupProps): ReactNode {
  const { group, index, editor } = props;
  const { options, disabled, onChange } = editor;
  return (
    <div className="grid gap-2 rounded-md border p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="font-medium [overflow-wrap:anywhere]">{group.name}</span>
        <MoveButtons
          position={index}
          count={options.length}
          disabled={disabled}
          sideways={false}
          onMove={(delta) => {
            onChange(moveGroup(options, index, delta));
          }}
          onRemove={() => {
            onChange(removeGroup(options, index));
          }}
        />
      </div>
      <ValueChips {...props} />
      <ValueInput {...props} />
    </div>
  );
}

/** The field and button that add an option by name, up to three. */
function AddOption({ options, disabled, onChange }: OptionsEditorProps): ReactNode {
  const { i18n } = useLingui();
  const [typed, setTyped] = useState('');
  const add = (): void => {
    onChange(addGroup(options, typed));
    setTyped('');
  };
  if (options.length >= MAX_OPTION_GROUPS) return null;
  return (
    <div className="flex gap-2">
      <Input
        data-testid={OPTION_NAME_INPUT_TEST_ID}
        aria-label={i18n._('catalog.option-name')}
        placeholder={i18n._('catalog.option-name-placeholder')}
        maxLength={OPTION_NAME_MAX}
        value={typed}
        disabled={disabled}
        onChange={(event) => {
          setTyped(event.target.value);
        }}
        onKeyDown={(event) => {
          if (!isAddValueKey(event.key)) return;
          event.preventDefault();
          add();
        }}
      />
      <Button type="button" variant="outline" disabled={disabled} onClick={add}>
        {i18n._('catalog.option-add')}
      </Button>
    </div>
  );
}

/** The options of the variant matrix (Color, Size…); the server builds the variants from them on save (ADR 0017). */
export function OptionsEditor(props: OptionsEditorProps): ReactNode {
  const { i18n } = useLingui();
  return (
    <div className="grid gap-3">
      {props.options.length === 0 && <p className="text-muted-foreground text-xs">{i18n._('catalog.options-empty')}</p>}
      {props.options.map((group, index) => (
        <OptionGroupCard key={group.name} group={group} index={index} editor={props} />
      ))}
      <AddOption {...props} />
    </div>
  );
}
