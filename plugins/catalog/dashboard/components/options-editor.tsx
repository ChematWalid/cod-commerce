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
  /** The catalogue id of what the form refuses in the options, such as an option without values. */
  readonly error?: string | undefined;
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

/**
 * Drag and drop reordering of a list: the props each item takes. Dropping item `from` onto item `to` moves it by
 * `to - from`, the same move as the earlier/later buttons. Events stop at the item, so dragging a value never drags
 * or drops its option too.
 */
function useReorderDrag(disabled: boolean, onMove: (from: number, delta: number) => void) {
  const [dragged, setDragged] = useState<number | null>(null);
  return (position: number) => ({
    draggable: !disabled,
    className: dragged === position ? 'cod-catalog-dragging' : undefined,
    onDragStart: (event: DragEvent) => {
      event.stopPropagation();
      setDragged(position);
    },
    onDragEnd: (event: DragEvent) => {
      event.stopPropagation();
      setDragged(null);
    },
    onDragOver: (event: DragEvent) => {
      if (dragged === null) return;
      event.preventDefault();
      event.stopPropagation();
    },
    onDrop: (event: DragEvent) => {
      if (dragged === null) return;
      event.stopPropagation();
      onMove(dragged, position - dragged);
      setDragged(null);
    },
  });
}

type ReorderDragProps = ReturnType<ReturnType<typeof useReorderDrag>>;

/** The values of one option as chips: drag one onto another, or use the earlier/later buttons, to reorder. */
function ValueChips({ group, index, editor }: GroupProps): ReactNode {
  const { options, disabled, onChange } = editor;
  const dragProps = useReorderDrag(disabled, (from, delta) => {
    onChange(moveValue(options, index, from, delta));
  });
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

/** One option: its name, move and remove buttons, its values, and the field adding one. Drag it to reorder. */
function OptionGroupCard(props: GroupProps & { readonly dragProps: ReorderDragProps }): ReactNode {
  const { group, index, editor } = props;
  const { options, disabled, onChange } = editor;
  return (
    <li {...props.dragProps}>
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
    </li>
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
  const dragProps = useReorderDrag(props.disabled, (from, delta) => {
    props.onChange(moveGroup(props.options, from, delta));
  });
  return (
    <div className="grid gap-3">
      {props.options.length === 0 && <p className="text-muted-foreground text-xs">{i18n._('catalog.options-empty')}</p>}
      {props.error !== undefined && (
        <p role="alert" className="text-destructive text-sm">
          {i18n._(props.error)}
        </p>
      )}
      <ul className="grid gap-3">
        {props.options.map((group, index) => (
          <OptionGroupCard key={group.name} group={group} index={index} editor={props} dragProps={dragProps(index)} />
        ))}
      </ul>
      <AddOption {...props} />
    </div>
  );
}
