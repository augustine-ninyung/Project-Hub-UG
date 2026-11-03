import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader } from '@/components/ui/dialog';

interface GalleryProps {
  images: { id: string; url: string }[];
  title: string;
}

export function ScreenshotGallery({ images, title }: GalleryProps) {
  const [index, setIndex] = useState<number | null>(null);
  if (images.length === 0) return null;

  const go = (delta: number) =>
    setIndex((i) => (i === null ? null : (i + delta + images.length) % images.length));

  return (
    <>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {images.map((img, i) => (
          <button
            key={img.id}
            type="button"
            onClick={() => setIndex(i)}
            className="group aspect-video overflow-hidden rounded-lg border bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label={`Open screenshot ${i + 1} of ${images.length}`}
          >
            <img
              src={img.url}
              alt=""
              loading="lazy"
              className="size-full object-cover transition-transform group-hover:scale-[1.03]"
            />
          </button>
        ))}
      </div>

      <Dialog open={index !== null} onOpenChange={(o) => !o && setIndex(null)}>
        <DialogContent
          className="max-w-5xl gap-3 p-3 sm:p-4"
          onKeyDown={(e) => {
            if (e.key === 'ArrowRight') go(1);
            if (e.key === 'ArrowLeft') go(-1);
          }}
        >
          <div className="px-1">
            <DialogHeader
              title={`${title} — screenshot ${(index ?? 0) + 1} of ${images.length}`}
            />
          </div>
          {index !== null && (
            <div className="relative flex items-center justify-center rounded-md bg-muted">
              <img
                src={images[index]!.url}
                alt={`${title} screenshot ${index + 1}`}
                className="max-h-[75vh] w-auto rounded-md object-contain"
              />
              {images.length > 1 && (
                <>
                  <Button
                    variant="secondary"
                    size="icon"
                    className="absolute left-2 top-1/2 -translate-y-1/2 shadow"
                    onClick={() => go(-1)}
                    aria-label="Previous screenshot"
                  >
                    <ChevronLeft />
                  </Button>
                  <Button
                    variant="secondary"
                    size="icon"
                    className="absolute right-2 top-1/2 -translate-y-1/2 shadow"
                    onClick={() => go(1)}
                    aria-label="Next screenshot"
                  >
                    <ChevronRight />
                  </Button>
                </>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
