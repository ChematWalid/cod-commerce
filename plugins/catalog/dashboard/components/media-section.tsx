import { useLingui } from '@lingui/react';
import { Badge, Button } from '@vendure/dashboard';
import { type ReactNode, useState } from 'react';
import { useMediaLibrary } from '../editor-queries';
import { withImages, withoutImage } from '../model/media-draft';
import { MediaPickerDialog } from './media-picker-dialog';
import { MediaUploadButton } from './media-upload-button';
import type { ScopedSectionProps } from './section-props';

interface MediaSectionProps extends ScopedSectionProps {
  readonly previews: ReadonlyMap<string, string>;
}

type TileProps = MediaSectionProps & { readonly assetId: string };

/** Featured, or a button that makes this image the one shown first. */
function FeaturedMark({ form, assetId, disabled, onChange }: TileProps): ReactNode {
  const { i18n } = useLingui();
  if (form.featuredAssetId === assetId) return <Badge variant="primary">{i18n._('catalog.media-featured')}</Badge>;
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      disabled={disabled}
      onClick={() => {
        onChange({ featuredAssetId: assetId });
      }}
    >
      {i18n._('catalog.media-make-featured')}
    </Button>
  );
}

function ImageTile(props: TileProps): ReactNode {
  const { i18n } = useLingui();
  const preview = props.previews.get(props.assetId);
  return (
    <li className="grid w-24 gap-1">
      {preview === undefined ? (
        <span aria-hidden className="cod-catalog-tile bg-muted" />
      ) : (
        <img src={preview} alt="" className="cod-catalog-tile" />
      )}
      <FeaturedMark {...props} />
      <Button
        type="button"
        variant="ghost"
        size="sm"
        disabled={props.disabled}
        onClick={() => {
          props.onChange(withoutImage(props.form, props.assetId));
        }}
      >
        {i18n._('catalog.remove')}
      </Button>
    </li>
  );
}

/** Choose from the library (in a dialog) or upload a new image into it. */
function MediaActions(props: MediaSectionProps): ReactNode {
  const { i18n } = useLingui();
  const [picking, setPicking] = useState(false);
  const library = useMediaLibrary(props.scope).data ?? [];
  const { form, disabled, onChange } = props;
  const close = (): void => {
    setPicking(false);
  };
  return (
    <div className="flex flex-wrap gap-2">
      <Button
        type="button"
        variant="outline"
        disabled={disabled}
        onClick={() => {
          setPicking(true);
        }}
      >
        {i18n._('catalog.media-choose')}
      </Button>
      <MediaUploadButton
        disabled={disabled}
        onUploaded={(media) => {
          onChange(withImages(form, [...form.assetIds, media.assetId]));
        }}
      />
      {picking && (
        <MediaPickerDialog
          library={library}
          chosen={form.assetIds}
          onConfirm={(assetIds) => {
            onChange(withImages(form, assetIds));
            close();
          }}
          onClose={close}
        />
      )}
    </div>
  );
}

/** The product's images from the business's library (AC7): pick, upload, feature one, remove. */
export function MediaSection(props: MediaSectionProps): ReactNode {
  const { i18n } = useLingui();
  return (
    <div className="grid gap-3">
      {props.form.assetIds.length === 0 ? (
        <p className="text-muted-foreground text-xs">{i18n._('catalog.media-none')}</p>
      ) : (
        <ul className="flex flex-wrap gap-3">
          {props.form.assetIds.map((assetId) => (
            <ImageTile key={assetId} {...props} assetId={assetId} />
          ))}
        </ul>
      )}
      <MediaActions {...props} />
    </div>
  );
}
