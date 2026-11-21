import { MEDIA_IMAGE_MIME_TYPES } from '@cod/shared';
import { useLingui } from '@lingui/react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button, toast } from '@vendure/dashboard';
import { type ReactNode, useRef, useState } from 'react';
import { uploadCollectionImage } from '../commands';
import { CREATE_PRODUCTS_KEY, MEDIA_LIBRARY_QUERY_KEY, VIEW_PRODUCTS_KEY } from '../constants';
import type { StoreCollectionImageDto } from '../dto';
import { errorMessageIdOf } from '../model/list-view';
import { useMediaLibrary } from '../queries';
import type { ScopedCardProps } from './card-props';
import { FieldError } from './field-error';
import { ImagePickerDialog } from './image-picker-dialog';

export interface ImageCardProps extends ScopedCardProps {
  readonly held: ReadonlySet<string>;
  /** The saved image, whose preview the card shows until another is picked. */
  readonly savedImage: StoreCollectionImageDto | null;
}

/** The preview of the chosen image: the saved one's, or the library's for a newly picked one. */
function previewOf(props: ImageCardProps, library: ReadonlyMap<string, string>): string | undefined {
  const { featuredAssetId } = props.form;
  if (featuredAssetId === null) return undefined;
  if (props.savedImage?.id === featuredAssetId) return props.savedImage.preview;
  return library.get(featuredAssetId);
}

/** Picks an image file and adds it to catalog's library, then chooses it (D2320); the server checks type and size. */
function UploadButton({ props, disabled }: { readonly props: ImageCardProps; readonly disabled: boolean }) {
  const { i18n } = useLingui();
  const input = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();
  const upload = useMutation({
    mutationFn: (file: File) => uploadCollectionImage(props.scope, file),
    onSuccess: async (media) => {
      props.onChange({ featuredAssetId: media.assetId });
      await queryClient.invalidateQueries({ queryKey: MEDIA_LIBRARY_QUERY_KEY });
    },
    onError: (error: unknown) => {
      toast.error(i18n._(errorMessageIdOf(error)));
    },
  });
  return (
    <>
      <input
        ref={input}
        type="file"
        hidden
        accept={MEDIA_IMAGE_MIME_TYPES.join(',')}
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = '';
          if (file !== undefined) upload.mutate(file);
        }}
      />
      <Button
        type="button"
        variant="outline"
        disabled={disabled || upload.isPending}
        onClick={() => input.current?.click()}
      >
        {i18n._(upload.isPending ? 'collections.image-uploading' : 'collections.image-upload')}
      </Button>
    </>
  );
}

/** Choose, upload and remove; without catalog's keys only the hint shows (D2320). */
function ImageActions(props: ImageCardProps & { readonly onPick: () => void }): ReactNode {
  const { i18n } = useLingui();
  const canPick = props.held.has(VIEW_PRODUCTS_KEY);
  if (!canPick) return <p className="text-muted-foreground text-xs">{i18n._('collections.image-needs-products')}</p>;
  const disabled = props.disabled || props.scope === null;
  return (
    <div className="flex flex-wrap gap-2">
      <Button type="button" variant="outline" disabled={disabled} onClick={props.onPick}>
        {i18n._('collections.image-choose')}
      </Button>
      {props.held.has(CREATE_PRODUCTS_KEY) && <UploadButton props={props} disabled={disabled} />}
      {props.form.featuredAssetId !== null && (
        <Button
          type="button"
          variant="ghost"
          disabled={disabled}
          onClick={() => {
            props.onChange({ featuredAssetId: null });
          }}
        >
          {i18n._('collections.image-remove')}
        </Button>
      )}
    </div>
  );
}

/** The collection's image (Vendure's featured asset), picked from catalog's library (D2320). */
export function ImageCard(props: ImageCardProps): ReactNode {
  const [picking, setPicking] = useState(false);
  const library = useMediaLibrary(props.scope, props.held.has(VIEW_PRODUCTS_KEY)).data ?? [];
  const previews = new Map(library.map((media) => [media.assetId, media.previewUrl]));
  const preview = previewOf(props, previews);
  return (
    <div className="grid gap-3">
      {preview === undefined ? (
        <span aria-hidden className="cod-collections-tile bg-muted" />
      ) : (
        <img src={preview} alt="" className="cod-collections-tile" />
      )}
      <ImageActions
        {...props}
        onPick={() => {
          setPicking(true);
        }}
      />
      <FieldError messageId={props.errors.featuredAssetId} />
      {picking && (
        <ImagePickerDialog
          library={library}
          chosen={props.form.featuredAssetId}
          onConfirm={(featuredAssetId) => {
            props.onChange({ featuredAssetId });
            setPicking(false);
          }}
          onClose={() => {
            setPicking(false);
          }}
        />
      )}
    </div>
  );
}
