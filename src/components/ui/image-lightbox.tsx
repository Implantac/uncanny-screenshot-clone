import { useEffect, useState, useCallback } from "react";
import { X, ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Download } from "lucide-react";
import { createPortal } from "react-dom";

type Props = {
  images: string[];
  openIndex: number | null;
  onClose: () => void;
};

/**
 * Full-screen lightbox with keyboard nav (←/→/Esc), zoom (+/-) and download.
 * Reusable across galleries (fit sessions, prototypes, moodboards, etc).
 */
export function ImageLightbox({ images, openIndex, onClose }: Props) {
  const [idx, setIdx] = useState(openIndex ?? 0);
  const [zoom, setZoom] = useState(1);

  useEffect(() => {
    if (openIndex !== null) {
      setIdx(openIndex);
      setZoom(1);
    }
  }, [openIndex]);

  const prev = useCallback(() => {
    setZoom(1);
    setIdx((i) => (i - 1 + images.length) % images.length);
  }, [images.length]);
  const next = useCallback(() => {
    setZoom(1);
    setIdx((i) => (i + 1) % images.length);
  }, [images.length]);

  useEffect(() => {
    if (openIndex === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowLeft") prev();
      else if (e.key === "ArrowRight") next();
      else if (e.key === "+" || e.key === "=") setZoom((z) => Math.min(z + 0.25, 4));
      else if (e.key === "-") setZoom((z) => Math.max(z - 0.25, 0.5));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [openIndex, prev, next, onClose]);

  if (openIndex === null || images.length === 0 || typeof document === "undefined") return null;
  const current = images[idx];

  return createPortal(
    <div
      className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-sm flex items-center justify-center"
      onClick={onClose}
    >
      <div
        className="absolute top-4 right-4 flex items-center gap-2 z-10"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={() => setZoom((z) => Math.max(z - 0.25, 0.5))}
          className="p-2 rounded-md bg-white/10 hover:bg-white/20 text-white"
          title="Diminuir zoom (-)"
        >
          <ZoomOut className="h-4 w-4" />
        </button>
        <span className="text-white/80 text-xs tabular-nums w-12 text-center">
          {Math.round(zoom * 100)}%
        </span>
        <button
          onClick={() => setZoom((z) => Math.min(z + 0.25, 4))}
          className="p-2 rounded-md bg-white/10 hover:bg-white/20 text-white"
          title="Aumentar zoom (+)"
        >
          <ZoomIn className="h-4 w-4" />
        </button>
        <a
          href={current}
          download
          className="p-2 rounded-md bg-white/10 hover:bg-white/20 text-white"
          title="Baixar"
        >
          <Download className="h-4 w-4" />
        </a>
        <button
          onClick={onClose}
          className="p-2 rounded-md bg-white/10 hover:bg-white/20 text-white"
          title="Fechar (Esc)"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {images.length > 1 && (
        <>
          <button
            onClick={(e) => {
              e.stopPropagation();
              prev();
            }}
            className="absolute left-4 p-3 rounded-full bg-white/10 hover:bg-white/20 text-white z-10"
          >
            <ChevronLeft className="h-6 w-6" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              next();
            }}
            className="absolute right-4 p-3 rounded-full bg-white/10 hover:bg-white/20 text-white z-10"
          >
            <ChevronRight className="h-6 w-6" />
          </button>
        </>
      )}

      <div className="max-w-[92vw] max-h-[85vh] overflow-auto" onClick={(e) => e.stopPropagation()}>
        <img
          src={current}
          alt=""
          style={{ transform: `scale(${zoom})`, transformOrigin: "center" }}
          className="max-w-[92vw] max-h-[85vh] object-contain transition-transform"
        />
      </div>

      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white/70 text-xs">
        {idx + 1} / {images.length}
      </div>
    </div>,
    document.body,
  );
}
