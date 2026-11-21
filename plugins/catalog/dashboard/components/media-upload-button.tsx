import { MEDIA_IMAGE_MIME_TYPES } from '@cod/shared';
import { useLingui } from '@lingui/react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button, toast } from '@vendure/dashboard';
import { type ReactNode, useRef } from 'react';
import { MEDIA_LIBRARY_QUERY_KEY, MEDIA_PREVIEWS_QUERY_KEY } from '../constants';
import type { CatalogMediaDto } from '../dto';
import { uploadCatalogMedia } from '../editor-queries';
import { listErrorMessageId } from '../model/list-view';
import type { StoreScope } from '../queries';

interface MediaUploadButtonProps {
  /** The store the editor is open for: an upload is refused unsent while requests go to another one. */
  readonly scope: StoreScope | null;
  readonly disabled: boolean;
  readonly onUploaded: (media: CatalogMediaDto) => void;
}

/** Picks an image file and adds it to the business's library; the server checks its type and size (D2113). */
export function MediaUploadButton({ scope, disabled, onUploaded }: MediaUploadButtonProps): ReactNode {
  const { i18n } = useLingui();
  const input = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();
  const upload = useMutation({
    mutationFn: (file: File) => uploadCatalogMedia(scope, file),
    onSuccess: async (media) => {
      onUploaded(media);
      await queryClient.invalidateQueries({ queryKey: MEDIA_LIBRARY_QUERY_KEY });
      await queryClient.invalidateQueries({ queryKey: MEDIA_PREVIEWS_QUERY_KEY });
    },
    onError: (error: unknown) => {
      toast.error(i18n._(listErrorMessageId(error)));
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
        disabled={disabled || scope === null || upload.isPending}
        onClick={() => input.current?.click()}
      >
        {i18n._(upload.isPending ? 'catalog.media-uploading' : 'catalog.media-upload')}
      </Button>
    </>
  );
}
