import { MAX_PRODUCT_ASSETS } from '@cod/shared';
import { useLingui } from '@lingui/react';
import { Button, Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@vendure/dashboard';
import { type ReactNode, useState } from 'react';
import type { CatalogMediaDto } from '../dto';

interface MediaPickerDialogProps {
  readonly library: readonly CatalogMediaDto[];
  readonly chosen: readonly string[];
  readonly onConfirm: (assetIds: readonly string[]) => void;
  readonly onClose: () => void;
}

const toggled = (ids: readonly string[], id: string): readonly string[] =>
  ids.includes(id) ? ids.filter((existing) => existing !== id) : [...ids, id];

function LibraryGrid(props: {
  readonly library: readonly CatalogMediaDto[];
  readonly picked: readonly string[];
  readonly onToggle: (assetId: string) => void;
}): ReactNode {
  const { i18n } = useLingui();
  if (props.library.length === 0)
    return <p className="text-muted-foreground text-sm">{i18n._('catalog.media-library-empty')}</p>;
  const full = props.picked.length >= MAX_PRODUCT_ASSETS;
  return (
    <ul className="grid max-h-96 grid-cols-3 gap-2 overflow-y-auto sm:grid-cols-4">
      {props.library.map((media) => {
        const picked = props.picked.includes(media.assetId);
        return (
          <li key={media.id}>
            <button
              type="button"
              aria-pressed={picked}
              aria-label={i18n._('catalog.media-pick')}
              disabled={!picked && full}
              className={picked ? 'ring-primary rounded-lg ring-2' : 'rounded-lg'}
              onClick={() => {
                props.onToggle(media.assetId);
              }}
            >
              <img src={media.previewUrl} alt="" className="cod-catalog-tile" />
            </button>
          </li>
        );
      })}
    </ul>
  );
}

/** Picks the product's images among the library's newest (up to twenty per product, D2141); mounted while open. */
export function MediaPickerDialog(props: MediaPickerDialogProps): ReactNode {
  const { i18n } = useLingui();
  const [picked, setPicked] = useState<readonly string[]>(props.chosen);
  return (
    <Dialog
      open
      onOpenChange={(next) => {
        if (!next) props.onClose();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{i18n._('catalog.media-library')}</DialogTitle>
        </DialogHeader>
        <LibraryGrid
          library={props.library}
          picked={picked}
          onToggle={(assetId) => {
            setPicked((ids) => toggled(ids, assetId));
          }}
        />
        <DialogFooter>
          <Button type="button" variant="outline" onClick={props.onClose}>
            {i18n._('catalog.cancel')}
          </Button>
          <Button
            type="button"
            onClick={() => {
              props.onConfirm(picked);
            }}
          >
            {i18n._('catalog.media-use')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
