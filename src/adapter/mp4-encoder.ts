/// <reference types="vite/client" />
import encoderUrl from "h264-mp4-encoder/embuild/dist/h264-mp4-encoder.web.js?url";
import type { H264MP4Encoder } from "h264-mp4-encoder";

type EncoderModule = { createH264MP4Encoder: () => Promise<H264MP4Encoder> };
let loading: Promise<EncoderModule> | undefined;

// The package's web build is a classic script with the WASM bundled inside it.
// Vite serves it as a local asset: no CDN, codec download, or platform codec.
function loadEncoder(): Promise<EncoderModule> {
  if (!loading)
    loading = new Promise<EncoderModule>((resolve, reject) => {
      const script = document.createElement("script");
      const timer = setTimeout(() => fail(), 30000);
      const fail = () => {
        clearTimeout(timer);
        script.remove();
        reject(
          Error("The MP4 encoder could not load. Reload Studio and try again."),
        );
      };
      script.src = encoderUrl;
      script.onload = () => {
        clearTimeout(timer);
        const module = (window as unknown as { HME?: EncoderModule }).HME;
        if (module) resolve(module);
        else fail();
      };
      script.onerror = fail;
      document.head.append(script);
    }).catch((error) => {
      loading = undefined;
      throw error;
    });
  return loading;
}

export async function encodeMp4(
  context: CanvasRenderingContext2D,
  duration: number,
  drawFrame: (time: number) => void,
  progress: (fraction: number) => void,
  signal: AbortSignal,
): Promise<Uint8Array> {
  signal.throwIfAborted();
  const module = await loadEncoder();
  signal.throwIfAborted();
  const encoder = await module.createH264MP4Encoder();
  try {
    signal.throwIfAborted();
    encoder.width = context.canvas.width;
    encoder.height = context.canvas.height;
    encoder.frameRate = 24;
    encoder.speed = 8;
    encoder.quantizationParameter = 20;
    encoder.initialize();
    // One full cycle, with a short still at either end for presenter control.
    const frames = Math.ceil((duration + 1) * encoder.frameRate);
    for (let frame = 0; frame < frames; frame++) {
      signal.throwIfAborted();
      const time = Math.max(
        0,
        Math.min(duration, frame / encoder.frameRate - 0.5),
      );
      drawFrame(time);
      encoder.addFrameRgba(
        context.getImageData(0, 0, encoder.width, encoder.height).data,
      );
      if (frame % 3 === 0) {
        progress(frame / frames);
        await new Promise((resolve) => setTimeout(resolve, 0));
      }
    }
    signal.throwIfAborted();
    encoder.finalize();
    const bytes = new Uint8Array(encoder.FS.readFile(encoder.outputFilename));
    encoder.FS.unlink(encoder.outputFilename);
    progress(1);
    return bytes;
  } finally {
    encoder.delete();
  }
}
