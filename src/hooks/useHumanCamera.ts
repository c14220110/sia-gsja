'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

export interface FaceCaptureResult {
  photoBase64: string;
  descriptor: number[];
  detectionScore: number;
}

let cachedHumanPromise: Promise<any> | null = null;

async function getBrowserHuman() {
  if (!cachedHumanPromise) {
    cachedHumanPromise = (async () => {
      const HumanModule = await import('@vladmandic/human');
      const Human = HumanModule.Human || (HumanModule as any).default;
      const human = new Human({
        modelBasePath: '/models/human/',
        backend: 'webgl',
        async: true,
        warmup: 'none',
        debug: false,
        face: {
          enabled: true,
          detector: { enabled: true, rotation: true, maxDetected: 3, minConfidence: 0.45 },
          mesh: { enabled: true },
          description: { enabled: true },
          iris: { enabled: false },
          emotion: { enabled: false },
        },
        body: { enabled: false },
        hand: { enabled: false },
        object: { enabled: false },
        gesture: { enabled: false },
        segmentation: { enabled: false },
      });
      await human.load();
      return human;
    })();
  }
  return cachedHumanPromise;
}

export function useHumanCamera(isOpen: boolean) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [modelLoading, setModelLoading] = useState(false);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraReady(false);
  }, []);

  const startCamera = useCallback(async () => {
    setCameraError(null);
    setCameraReady(false);
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error('Browser tidak mendukung akses kamera.');
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 720 }, height: { ideal: 960 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCameraReady(true);
    } catch (err: any) {
      setCameraError(err?.message || 'Kamera gagal dibuka. Pastikan izin kamera aktif.');
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      startCamera();
    } else {
      stopCamera();
    }
    return () => {
      stopCamera();
    };
  }, [isOpen, startCamera, stopCamera]);

  const captureFrameCanvas = useCallback((): HTMLCanvasElement => {
    const video = videoRef.current;
    if (!video || video.videoWidth === 0 || video.videoHeight === 0) {
      throw new Error('Kamera belum siap. Tunggu sebentar lalu coba lagi.');
    }
    const maxDim = 720;
    const scale = Math.min(1, maxDim / Math.max(video.videoWidth, video.videoHeight));
    const width = Math.round(video.videoWidth * scale);
    const height = Math.round(video.videoHeight * scale);
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Gagal memproses frame kamera.');
    ctx.drawImage(video, 0, 0, width, height);
    return canvas;
  }, []);

  const captureLiveSelfieOnly = useCallback((): string => {
    const canvas = captureFrameCanvas();
    return canvas.toDataURL('image/jpeg', 0.85);
  }, [captureFrameCanvas]);

  const captureAndExtractFace = useCallback(async (): Promise<FaceCaptureResult> => {
    const canvas = captureFrameCanvas();
    const photoBase64 = canvas.toDataURL('image/jpeg', 0.88);
    setModelLoading(true);
    try {
      const human = await getBrowserHuman();
      const result = await human.detect(canvas);
      const faces = result?.face || [];

      if (faces.length === 0) {
        throw new Error('Wajah tidak terdeteksi. Pastikan wajah terlihat jelas di dalam bingkai.');
      }
      if (faces.length > 1) {
        throw new Error('Terdeteksi lebih dari 1 wajah. Pastikan hanya Anda di depan kamera.');
      }
      const face = faces[0];
      if (!face.embedding || face.embedding.length !== 1024) {
        throw new Error('Gagal membaca fitur biometrik wajah. Coba pencahayaan lebih terang.');
      }
      return {
        photoBase64,
        descriptor: Array.from(face.embedding),
        detectionScore: Number(face.boxScore ?? face.score ?? 0.9),
      };
    } finally {
      setModelLoading(false);
    }
  }, [captureFrameCanvas]);

  return {
    videoRef,
    cameraReady,
    cameraError,
    modelLoading,
    restartCamera: startCamera,
    captureLiveSelfieOnly,
    captureAndExtractFace,
  };
}
