import { useLingui } from '@lingui/react';
import { Button, Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@vendure/dashboard';
import { type ReactNode, useState } from 'react';
import type { CollectionMediaDto } from '../dto';

interface ImagePickerDialogProps {
  readonly library: readonly CollectionMediaDto[];
  readonly chosen: string | null;
  readonly onConfirm: (assetId: string | null) => void;
  readonly onClose: () => void;
}

function LibraryGrid(props: {
  readonly library: readonly CollectionMediaDto[];
  readonly picked: string | null;
  readonly onPick: (assetId: string) => void;
}): ReactNode {
  const { i18n } = useLingui();
  if (props.library.length === 0)
    return <p className="text-muted-foreground text-sm">{i18n._('collections.image-library-empty')}</p>;
  return (
    <ul className="grid max-h-96 grid-cols-3 gap-2 overflow-y-auto sm:grid-cols-4">
      {props.library.map((media) => {
        const picked = props.picked === media.assetId;
        return (
          <li key={media.id}>
            <button
              type="button"
              aria-pressed={picked}
              aria-label={i18n._('collections.image-pick')}
              className={picked ? 'ring-primary rounded-lg ring-2' : 'rounded-lg'}
              onClick={() => {
                props.onPick(media.assetId);
              }}
            >
              <img src={media.previewUrl} alt="" className="cod-collections-tile" />
            </button>
          </li>
        );
      })}
    </ul>
  );
}

/** Picks the collection's one image among the library's newest; mounted while open. */
export function ImagePickerDialog(props: ImagePickerDialogProps): ReactNode {
  const { i18n } = useLingui();
  const [picked, setPicked] = useState<string | null>(props.chosen);
  return (
    <Dialog
      open
      onOpenChange={(next) => {
        if (!next) props.onClose();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{i18n._('collections.image-library')}</DialogTitle>
        </DialogHeader>
        <LibraryGrid library={props.library} picked={picked} onPick={setPicked} />
        <DialogFooter>
          <Button type="button" variant="outline" onClick={props.onClose}>
            {i18n._('collections.cancel')}
          </Button>
          <Button
            type="button"
            onClick={() => {
              props.onConfirm(picked);
            }}
          >
            {i18n._('collections.image-use')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
