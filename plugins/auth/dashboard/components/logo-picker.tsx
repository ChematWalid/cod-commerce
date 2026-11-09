import { AUTH_ERROR_CODES, LOGO_MAX_BYTES } from '@cod/shared';
import { useLingui } from '@lingui/react';
import { Button, Label } from '@vendure/dashboard';
import { type ChangeEvent, type ReactNode, useEffect, useId, useRef, useState } from 'react';
import { IMAGE_ACCEPT } from '../constants';

interface LogoPickerProps {
  readonly label: string;
  readonly hint: string;
  readonly file: File | null;
  /** The saved image, shown while no new file is chosen. */
  readonly currentUrl?: string | null;
  readonly onChange: (file: File | null) => void;
}

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

function useImagePick(onChange: (file: File | null) => void): {
  readonly tooLarge: boolean;
  readonly onPick: (event: ChangeEvent<HTMLInputElement>) => void;
} {
  const [tooLarge, setTooLarge] = useState(false);
  const onPick = (event: ChangeEvent<HTMLInputElement>): void => {
    const picked = event.target.files?.[0] ?? null;
    const refused = picked !== null && picked.size > LOGO_MAX_BYTES;
    setTooLarge(refused);
    if (!refused) onChange(picked);
    event.target.value = '';
  };
  return { tooLarge, onPick };
}

/** Picks an image. The size check is feedback only: the server re-checks size and content (Task 8). */
export function LogoPicker({ label, hint, file, currentUrl = null, onChange }: LogoPickerProps): ReactNode {
  const { i18n } = useLingui();
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const preview = useObjectUrl(file) ?? currentUrl;
  const { tooLarge, onPick } = useImagePick(onChange);
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <div className="flex items-center gap-3">
        {preview !== null && <img src={preview} alt="" className="size-12 rounded-md object-cover" />}
        <input ref={input} id={id} type="file" accept={IMAGE_ACCEPT} className="sr-only" onChange={onPick} />
        <Button type="button" variant="outline" onClick={() => input.current?.click()}>
          {i18n._('Choose image')}
        </Button>
        {preview !== null && (
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              onChange(null);
            }}
          >
            {i18n._('Remove')}
          </Button>
        )}
      </div>
      <p className="text-muted-foreground text-xs">{hint}</p>
      {tooLarge && (
        <p role="alert" className="text-destructive text-sm">
          {i18n._(AUTH_ERROR_CODES.LOGO_TOO_LARGE)}
        </p>
      )}
    </div>
  );
}
