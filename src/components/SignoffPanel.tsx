"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { clearSignoff, saveSignoff } from "@/app/actions";
import { MAX_SIGNATURE_BYTES, formatSignedDate, type Signoff } from "@/lib/signoff";
import { useToast } from "./Toast";

type Mode = "draw" | "upload";
type Img = { url: string; width: number; height: number } | null;

const todayIso = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

/** Crops a canvas to the area that has ink, with a little padding, and returns a PNG. */
function trimmed(canvas: HTMLCanvasElement): Img {
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  const { width, height } = canvas;
  const px = ctx.getImageData(0, 0, width, height).data;
  let minX = width, minY = height, maxX = -1, maxY = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (px[(y * width + x) * 4 + 3] > 10) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0) return null;
  const pad = 8;
  const w = Math.min(width, maxX - minX + 1 + pad * 2);
  const h = Math.min(height, maxY - minY + 1 + pad * 2);
  const out = document.createElement("canvas");
  out.width = w;
  out.height = h;
  out.getContext("2d")!.drawImage(canvas, Math.max(0, minX - pad), Math.max(0, minY - pad), w, h, 0, 0, w, h);
  return { url: out.toDataURL("image/png"), width: w, height: h };
}

export function SignoffPanel(props: { initial: Signoff; semesterLabel: string; signatory: { name: string; role: string } }) {
  const { initial, semesterLabel, signatory } = props;
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const [date, setDate] = useState(initial.signedOn ?? todayIso());
  const [mode, setMode] = useState<Mode>("draw");
  const [img, setImg] = useState<Img>(
    initial.image && initial.width && initial.height ? { url: initial.image, width: initial.width, height: initial.height } : null,
  );
  const [confirmClear, setConfirmClear] = useState(false);
  const signed = !!initial.signedOn;

  function save() {
    if (img && img.url.length > MAX_SIGNATURE_BYTES) {
      toast("The signature image is too large. Use a smaller scan (under 300 KB).", true);
      return;
    }
    startTransition(async () => {
      const r = await saveSignoff({ signedOn: date || null, image: img?.url ?? null, width: img?.width ?? null, height: img?.height ?? null });
      toast(r.ok ? r.message ?? "Saved." : r.error, !r.ok);
      if (r.ok) router.refresh();
    });
  }

  function clear() {
    if (!confirmClear) return setConfirmClear(true);
    startTransition(async () => {
      const r = await clearSignoff();
      toast(r.ok ? r.message ?? "Removed." : r.error, !r.ok);
      setConfirmClear(false);
      if (r.ok) {
        setImg(null);
        router.refresh();
      }
    });
  }

  return (
    <div className="signoff">
      <section className="card">
        <h2>Sign-off · {semesterLabel}</h2>
        <p className="hint">
          The signing date and signature below are printed on the Word and PDF timetable. They don&apos;t change when the
          timetable is exported or edited. Update them here when you sign a new issue.
        </p>
        <p className={`status ${signed ? "on" : "off"}`}>
          {signed
            ? `Signed ${formatSignedDate(initial.signedOn)}${initial.image ? " with signature" : " (date only — signature line left blank)"}`
            : "Not signed yet — exports show a blank date and signature line for signing by hand."}
        </p>

        <div className="sign-grid">
          <div>
            <label className="fld">
              <span>Signing date</span>
              <input id="signed-on" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </label>

            <div className="seg" role="tablist" aria-label="How to add the signature">
              <button type="button" role="tab" aria-selected={mode === "draw"} onClick={() => setMode("draw")}>
                Draw signature
              </button>
              <button type="button" role="tab" aria-selected={mode === "upload"} onClick={() => setMode("upload")}>
                Upload a scan
              </button>
            </div>

            {mode === "draw" ? <DrawPad onDone={setImg} /> : <Upload onDone={setImg} />}

            <div className="actions" style={{ padding: 0 }}>
              <button type="button" className="btn primary" onClick={save} disabled={pending || !date}>
                {pending ? "Saving…" : "Save sign-off"}
              </button>
              {img && (
                <button type="button" className="btn" onClick={() => setImg(null)}>
                  Remove signature image
                </button>
              )}
              {signed && (
                <button type="button" className={`btn danger${confirmClear ? " sure" : ""}`} onClick={clear} disabled={pending}>
                  {confirmClear ? "Confirm: unsign" : "Unsign"}
                </button>
              )}
            </div>
          </div>

          <div>
            <span className="fld-label">How it prints</span>
            <div className="sign-preview">
              <p className="signed">Signed ({formatSignedDate(date) ?? "____/____/______"})</p>
              <div className="sig-box">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {img ? <img src={img.url} alt="Signature preview" /> : <span className="hint">No signature image — signed by hand</span>}
              </div>
              <p className="name">{signatory.name}</p>
              <p>{signatory.role}</p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

/** A signature pad: draw with a mouse, pen or finger. */
function DrawPad({ onDone }: { onDone: (img: Img) => void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const last = useRef<{ x: number; y: number } | null>(null);
  const [hasInk, setHasInk] = useState(false);

  useEffect(() => {
    const c = ref.current!;
    const ctx = c.getContext("2d")!;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.lineWidth = 3.2;
    ctx.strokeStyle = "#0b2545";
  }, []);

  const pos = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const r = ref.current!.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * ref.current!.width, y: ((e.clientY - r.top) / r.height) * ref.current!.height };
  };

  return (
    <div className="pad-wrap">
      <canvas
        ref={ref}
        width={900}
        height={300}
        className="pad"
        aria-label="Signature pad: draw your signature here"
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          drawing.current = true;
          last.current = pos(e);
        }}
        onPointerMove={(e) => {
          if (!drawing.current || !last.current) return;
          const p = pos(e);
          const ctx = ref.current!.getContext("2d")!;
          ctx.beginPath();
          ctx.moveTo(last.current.x, last.current.y);
          ctx.lineTo(p.x, p.y);
          ctx.stroke();
          last.current = p;
          if (!hasInk) setHasInk(true);
        }}
        onPointerUp={() => {
          drawing.current = false;
          last.current = null;
          if (hasInk) onDone(trimmed(ref.current!));
        }}
        onPointerLeave={() => {
          if (drawing.current && hasInk) onDone(trimmed(ref.current!));
          drawing.current = false;
          last.current = null;
        }}
      />
      <div className="pad-foot">
        <span className="hint">Sign inside the box with your mouse, pen or finger.</span>
        <button
          type="button"
          className="btn"
          onClick={() => {
            const c = ref.current!;
            c.getContext("2d")!.clearRect(0, 0, c.width, c.height);
            setHasInk(false);
            onDone(null);
          }}
        >
          Clear pad
        </button>
      </div>
    </div>
  );
}

/** Upload a photo or scan of a signature (PNG or JPEG). Large images are scaled down before saving. */
function Upload({ onDone }: { onDone: (img: Img) => void }) {
  const [err, setErr] = useState<string | null>(null);
  return (
    <div className="pad-wrap">
      <label className="fld">
        <span>Signature image (PNG or JPEG)</span>
        <input
          id="signature-file"
          type="file"
          accept="image/png,image/jpeg"
          onChange={(e) => {
            setErr(null);
            const f = e.target.files?.[0];
            if (!f) return;
            if (!/^image\/(png|jpeg)$/.test(f.type)) return setErr("Choose a PNG or JPEG image.");
            const reader = new FileReader();
            reader.onload = () => {
              const im = new Image();
              im.onload = () => {
                const scale = Math.min(900 / im.width, 300 / im.height, 1);
                const c = document.createElement("canvas");
                c.width = Math.round(im.width * scale);
                c.height = Math.round(im.height * scale);
                c.getContext("2d")!.drawImage(im, 0, 0, c.width, c.height);
                const url = f.type === "image/png" ? c.toDataURL("image/png") : c.toDataURL("image/jpeg", 0.88);
                if (url.length > MAX_SIGNATURE_BYTES) return setErr("That image is too large even after shrinking. Crop it closer to the signature.");
                onDone({ url, width: c.width, height: c.height });
              };
              im.onerror = () => setErr("That file couldn't be read as an image.");
              im.src = String(reader.result);
            };
            reader.readAsDataURL(f);
          }}
        />
      </label>
      <p className="hint">Best results: sign in dark ink on white paper, photograph or scan it, and crop close to the signature.</p>
      {err && <p className="issue">{err}</p>}
    </div>
  );
}
