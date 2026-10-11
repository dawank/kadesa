import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Camera, RefreshCw, Check, Upload, AlertCircle } from 'lucide-react';

interface CameraCaptureProps {
  onCapture: (base64Image: string) => void;
  maxSizeMb?: number;
}

export const CameraCapture: React.FC<CameraCaptureProps> = ({
  onCapture,
  maxSizeMb = 5,
}) => {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [photo, setPhoto] = useState<string | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isInitializing, setIsInitializing] = useState<boolean>(true);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const startCamera = useCallback(async () => {
    setIsInitializing(true);
    setCameraError(null);
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Browser tidak mendukung akses kamera secara langsung');
      }
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false,
      });
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
    } catch (err: unknown) {
      console.warn('Camera access unavailable:', err);
      setCameraError(
        'Kamera tidak dapat diakses atau izin ditolak. Anda dapat menggunakan opsi unggah foto selfie di bawah.'
      );
    } finally {
      setIsInitializing(false);
    }
  }, []);

  const stopCamera = useCallback(() => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
    }
  }, [stream]);

  useEffect(() => {
    startCamera();
    return () => {
      stopCamera();
    };
  }, [startCamera, stopCamera]);

  const takeSnapshot = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;

    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
      setPhoto(dataUrl);
      onCapture(dataUrl);
    }
  };

  const retakePhoto = () => {
    setPhoto(null);
    startCamera();
  };

  // Fallback file upload for environments without webcams
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      alert('Format file harus JPEG, PNG, atau WebP');
      return;
    }
    if (file.size > maxSizeMb * 1024 * 1024) {
      alert(`Ukuran file melebihi batas maksimal ${maxSizeMb} MB`);
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      setPhoto(result);
      onCapture(result);
    };
    reader.readAsDataURL(file);
  };

  return (
    <div
      style={{
        borderRadius: 'var(--radius-lg)',
        border: '1px solid var(--border-subtle)',
        backgroundColor: '#ffffff',
        padding: '1.25rem',
        marginTop: '1rem',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
        <Camera size={18} color="var(--color-primary-600)" />
        <h4 style={{ fontSize: '0.9375rem', fontWeight: 700 }}>Foto Selfie Presensi Dinas Luar</h4>
      </div>
      <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
        Presensi Dinas Luar memerlukan bukti foto selfie di lokasi tugas. Maksimal ukuran file: {maxSizeMb}MB.
      </p>

      {/* Snapshot Preview if taken */}
      {photo ? (
        <div style={{ textAlign: 'center' }}>
          <div
            style={{
              width: '100%',
              maxHeight: 280,
              overflow: 'hidden',
              borderRadius: 'var(--radius-md)',
              border: '2px solid var(--color-primary-500)',
              marginBottom: '1rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: '#000',
            }}
          >
            <img src={photo} alt="Bukti Selfie DL" style={{ maxWidth: '100%', maxHeight: 280, objectFit: 'contain' }} />
          </div>
          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
            <button type="button" className="btn btn-secondary btn-sm" onClick={retakePhoto}>
              <RefreshCw size={14} /> Ambil Ulang Foto
            </button>
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.25rem',
                fontSize: '0.8125rem',
                color: 'var(--color-primary-700)',
                fontWeight: 600,
              }}
            >
              <Check size={16} /> Foto Siap Digunakan
            </div>
          </div>
        </div>
      ) : (
        <div>
          {/* Live Video Feed or Error Banner */}
          {cameraError ? (
            <div
              style={{
                padding: '1rem',
                borderRadius: 'var(--radius-md)',
                backgroundColor: '#fffbeb',
                border: '1px solid #fef3c7',
                marginBottom: '1rem',
                fontSize: '0.8125rem',
                color: '#92400e',
                display: 'flex',
                gap: '0.5rem',
                alignItems: 'flex-start',
              }}
            >
              <AlertCircle size={18} style={{ flexShrink: 0, marginTop: 2 }} />
              <div>
                <strong>Akses Kamera Tidak Aktif:</strong> {cameraError}
              </div>
            </div>
          ) : (
            <div
              style={{
                width: '100%',
                height: 240,
                backgroundColor: '#0f172a',
                borderRadius: 'var(--radius-md)',
                overflow: 'hidden',
                position: 'relative',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '1rem',
              }}
            >
              {isInitializing && (
                <div style={{ color: '#ffffff', fontSize: '0.875rem' }}>Menginisialisasi kamera...</div>
              )}
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
              <canvas ref={canvasRef} style={{ display: 'none' }} />
            </div>
          )}

          {/* Controls: Take Photo or Upload File */}
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
            {!cameraError && (
              <button
                type="button"
                className="btn btn-primary"
                onClick={takeSnapshot}
                disabled={isInitializing}
              >
                <Camera size={16} /> Ambil Foto Selfie Sekarang
              </button>
            )}

            <label className="btn btn-secondary" style={{ cursor: 'pointer' }}>
              <Upload size={16} /> Unggah File Foto
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                style={{ display: 'none' }}
                onChange={handleFileUpload}
              />
            </label>
          </div>
        </div>
      )}
    </div>
  );
};
