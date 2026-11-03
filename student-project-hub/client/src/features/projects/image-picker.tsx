import { ImagePlus, X } from 'lucide-react';
import { useEffect, useId, useMemo, useRef, useState, type DragEvent } from 'react';
import { cn } from '@/utils/cn';

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export const MAX_SCREENSHOTS = 8;
const ACCEPTED = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

/** Client-side checks for fast feedback; the server re-validates every file. */
export function validateImage(file: File): string | null {
  if (!ACCEPTED.includes(file.type)) return `${file.name}: only JPEG, PNG, WebP or GIF images are allowed`;
  if (file.size > MAX_IMAGE_BYTES) return `${file.name}: images must be 5 MB or smaller`;
  return null;
}

/** Object URLs for local previews, revoked when files change or unmount. */
function usePreviews(files: File[]) {
  const urls = useMemo(() => files.map((f) => URL.createObjectURL(f)), [files]);
  useEffect(() => () => urls.forEach((u) => URL.revokeObjectURL(u)), [urls]);
  return urls;
}

function DropZone({
  onFiles,
  multiple,
  label,
  hint,
  className,
}: {
  onFiles: (files: File[]) => void;
  multiple?: boolean;
  label: string;
  hint: string;
  className?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const id = useId();
  const [dragging, setDragging] = useState(false);

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    onFiles(Array.from(e.dataTransfer.files));
  };

  return (
    <label
      htmlFor={id}
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
      className={cn(
        'flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-4 py-6 text-center transition-colors hover:border-primary/60 hover:bg-primary/5 focus-within:ring-2 focus-within:ring-ring',
        dragging && 'border-primary bg-primary/5',
        className,
      )}
    >
      <ImagePlus className="size-6 text-muted-foreground" aria-hidden />
      <span className="text-sm font-medium">{label}</span>
      <span className="text-xs text-muted-foreground">{hint}</span>
      <input
        ref={inputRef}
        id={id}
        type="file"
        accept={ACCEPTED.join(',')}
        multiple={multiple}
        className="sr-only"
        onChange={(e) => {
          onFiles(Array.from(e.target.files ?? []));
          e.target.value = '';
        }}
      />
    </label>
  );
}

function RemoveButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="absolute right-2 top-2 flex size-7 items-center justify-center rounded-full bg-background/90 shadow-sm backdrop-blur transition-colors hover:bg-destructive hover:text-destructive-foreground"
    >
      <X className="size-4" />
    </button>
  );
}

interface CoverPickerProps {
  file: File | null;
  existingUrl: string | null;
  onChange: (file: File | null) => void;
  onRemoveExisting: () => void;
  onError: (message: string) => void;
}

export function CoverPicker({ file, existingUrl, onChange, onRemoveExisting, onError }: CoverPickerProps) {
  const files = useMemo(() => (file ? [file] : []), [file]);
  const [preview] = usePreviews(files);
  const shown = preview ?? existingUrl;

  if (shown) {
    return (
      <div className="relative aspect-video overflow-hidden rounded-lg border bg-muted">
        <img src={shown} alt="Cover preview" className="size-full object-cover" />
        <RemoveButton
          label="Remove cover image"
          onClick={() => (file ? onChange(null) : onRemoveExisting())}
        />
      </div>
    );
  }
  return (
    <DropZone
      className="aspect-video"
      label="Upload a cover image"
      hint="16:9 works best · JPEG, PNG, WebP or GIF · max 5 MB"
      onFiles={([f]) => {
        if (!f) return;
        const err = validateImage(f);
        if (err) onError(err);
        else onChange(f);
      }}
    />
  );
}

interface ScreenshotPickerProps {
  files: File[];
  existing: { id: string; url: string }[];
  onChange: (files: File[]) => void;
  onRemoveExisting: (id: string) => void;
  onError: (message: string) => void;
}

export function ScreenshotPicker({ files, existing, onChange, onRemoveExisting, onError }: ScreenshotPickerProps) {
  const previews = usePreviews(files);
  const remaining = MAX_SCREENSHOTS - existing.length - files.length;

  const add = (incoming: File[]) => {
    const valid: File[] = [];
    for (const f of incoming) {
      const err = validateImage(f);
      if (err) onError(err);
      else valid.push(f);
    }
    if (valid.length > remaining) {
      onError(`You can add up to ${MAX_SCREENSHOTS} screenshots`);
    }
    if (valid.length) onChange([...files, ...valid.slice(0, Math.max(0, remaining))]);
  };

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {existing.map((img) => (
        <div key={img.id} className="relative aspect-video overflow-hidden rounded-lg border bg-muted">
          <img src={img.url} alt="" className="size-full object-cover" />
          <RemoveButton label="Remove screenshot" onClick={() => onRemoveExisting(img.id)} />
        </div>
      ))}
      {files.map((f, i) => (
        <div key={`${f.name}-${i}`} className="relative aspect-video overflow-hidden rounded-lg border bg-muted">
          <img src={previews[i]} alt={f.name} className="size-full object-cover" />
          <RemoveButton
            label={`Remove ${f.name}`}
            onClick={() => onChange(files.filter((_, j) => j !== i))}
          />
        </div>
      ))}
      {remaining > 0 && (
        <DropZone
          multiple
          className="aspect-video py-2"
          label="Add screenshots"
          hint={`${remaining} remaining`}
          onFiles={add}
        />
      )}
    </div>
  );
}
