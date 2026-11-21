import { LOGO_MAX_BYTES } from '@cod/shared';
import { useLingui } from '@lingui/react';
import { Button, Label } from '@vendure/dashboard';
import { type ChangeEvent, type ReactNode, useEffect, useId, useRef, useState } from 'react';
import { LOGO_IMAGE_ACCEPT } from '../constants';
import { useUploadLogo } from '../hooks/use-settings-mutations';
import { logoErrorMessageId } from '../model/api-error';

const LOGO_TOO_LARGE_MESSAGE_ID = 'shell.settings.logo-too-large';

interface LogoFieldProps {
  readonly label: string;
  /** The saved logo, shown until a new image is uploaded. */
  readonly currentUrl: string | null;
  /** Whether the caller may upload (`settings.business.edit`, D2120); otherwise the logo only shows. */
  readonly canUpload: boolean;
  readonly imageTestId: string;
  readonly inputTestId: string;
  /** Called with the new image's asset id; the card's Save sets it. */
  readonly onUploaded: (assetId: string) => void;
}

/** A local preview of the picked file, released when it changes or the field goes away. */
function useObjectUrl(file: File | null): string | null {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (file === null) {
      setUrl(null);
      return undefined;
    }
    const objectUrl = URL.createObjectURL(file);
    setUrl(objectUrl);
    return () => {
      URL.revokeObjectURL(objectUrl);
    };
  }, [file]);
  return url;
}

/** The upload of one picked file: its preview once stored, and the line to show when it was refused. */
function useLogoUpload(onUploaded: (assetId: string) => void): {
  readonly preview: string | null;
  readonly errorId: string | undefined;
  readonly uploading: boolean;
  readonly pick: (event: ChangeEvent<HTMLInputElement>) => void;
} {
  const [file, setFile] = useState<File | null>(null);
  const [errorId, setErrorId] = useState<string | undefined>(undefined);
  const upload = useUploadLogo();
  const pick = (event: ChangeEvent<HTMLInputElement>): void => {
    const picked = event.target.files?.[0];
    event.target.value = '';
    if (picked === undefined) return;
    // Feedback only: the server bounds and sniffs the file again.
    if (picked.size > LOGO_MAX_BYTES) {
      setErrorId(LOGO_TOO_LARGE_MESSAGE_ID);
      return;
    }
    setErrorId(undefined);
    upload.mutate(picked, {
      onSuccess: (assetId) => {
        setFile(picked);
        onUploaded(assetId);
      },
      onError: (error: unknown) => {
        setErrorId(logoErrorMessageId(error));
      },
    });
  };
  return { preview: useObjectUrl(file), errorId, uploading: upload.isPending, pick };
}

/** The logo's image, or a placeholder without one. */
function LogoImage({
  url,
  label,
  testId,
}: {
  readonly url: string | null;
  readonly label: string;
  readonly testId: string;
}): ReactNode {
  const { i18n } = useLingui();
  if (url === null) {
    return (
      <div className="bg-muted text-muted-foreground flex size-16 items-center justify-center rounded-md text-xs">
        {i18n._('shell.settings.logo-none')}
      </div>
    );
  }
  return <img data-testid={testId} src={url} alt={label} className="size-16 rounded-md border object-contain" />;
}

/** A logo: its image, and for whoever may change it an upload button. Nothing is saved until the card's Save. */
export function LogoField(props: LogoFieldProps): ReactNode {
  const { label, currentUrl, canUpload, imageTestId, inputTestId, onUploaded } = props;
  const { i18n } = useLingui();
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const { preview, errorId, uploading, pick } = useLogoUpload(onUploaded);
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={canUpload ? id : undefined}>{label}</Label>
      <div className="flex items-center gap-3">
        <LogoImage url={preview ?? currentUrl} label={label} testId={imageTestId} />
        {canUpload && (
          <>
            <input
              ref={input}
              id={id}
              data-testid={inputTestId}
              type="file"
              accept={LOGO_IMAGE_ACCEPT}
              className="sr-only"
              onChange={pick}
            />
            <Button type="button" variant="outline" disabled={uploading} onClick={() => input.current?.click()}>
              {i18n._(uploading ? 'shell.settings.logo-uploading' : 'shell.settings.logo-upload')}
            </Button>
          </>
        )}
      </div>
      {errorId !== undefined && (
        <p role="alert" className="text-destructive text-sm">
          {i18n._(errorId)}
        </p>
      )}
    </div>
  );
}
