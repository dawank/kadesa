import React, { useState } from 'react';
import { MapPin, Navigation, CheckCircle2, XCircle, Layers, Radar } from 'lucide-react';
import { IS_DEMO_MODE } from '../../services/apiClient';
import { LocationPickerMap, MapLocation } from './LocationPickerMap';

export interface GeofencePreviewProps {
  targetLat: number;
  targetLng: number;
  targetRadiusMeters: number;
  userLat?: number | null;
  userLng?: number | null;
  distanceMeters?: number;
  isValid?: boolean;
  onSimulateCoords?: (lat: number, lng: number) => void;
  locations?: MapLocation[];
  title?: string;
}

export const GeofencePreview: React.FC<GeofencePreviewProps> = ({
  targetLat,
  targetLng,
  targetRadiusMeters,
  userLat,
  userLng,
  distanceMeters,
  isValid,
  onSimulateCoords,
  locations,
  title = 'Geofence & Peta Lokasi',
}) => {
  const [viewMode, setViewMode] = useState<'map' | 'radar'>('map');

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
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '1rem',
          flexWrap: 'wrap',
          gap: '0.5rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <MapPin size={18} color="var(--color-primary-600)" />
          <h4 style={{ fontSize: '0.9375rem', fontWeight: 700 }}>{title}</h4>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          {/* View mode toggle: Peta vs Radar */}
          <div
            style={{
              display: 'flex',
              backgroundColor: '#f1f5f9',
              padding: '2px',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-subtle)',
            }}
          >
            <button
              type="button"
              onClick={() => setViewMode('map')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                padding: '3px 8px',
                fontSize: '0.75rem',
                fontWeight: 600,
                border: 'none',
                borderRadius: 'var(--radius-sm)',
                backgroundColor: viewMode === 'map' ? '#ffffff' : 'transparent',
                color: viewMode === 'map' ? 'var(--color-primary-700)' : 'var(--text-muted)',
                boxShadow: viewMode === 'map' ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
                cursor: 'pointer',
              }}
            >
              <Layers size={13} /> Peta Interaktif
            </button>
            <button
              type="button"
              onClick={() => setViewMode('radar')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                padding: '3px 8px',
                fontSize: '0.75rem',
                fontWeight: 600,
                border: 'none',
                borderRadius: 'var(--radius-sm)',
                backgroundColor: viewMode === 'radar' ? '#ffffff' : 'transparent',
                color: viewMode === 'radar' ? 'var(--color-primary-700)' : 'var(--text-muted)',
                boxShadow: viewMode === 'radar' ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
                cursor: 'pointer',
              }}
            >
              <Radar size={13} /> Radar Geofence
            </button>
          </div>

          {distanceMeters !== undefined && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.375rem',
                fontSize: '0.8125rem',
                fontWeight: 700,
                color: isValid ? 'var(--color-primary-700)' : 'var(--color-accent-rose)',
              }}
            >
              {isValid ? <CheckCircle2 size={16} /> : <XCircle size={16} />}
              <span>
                Jarak: {distanceMeters} meter ({isValid ? 'Di dalam radius' : 'Di luar radius'})
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Main visualization: Map or Radar */}
      {viewMode === 'map' ? (
        <LocationPickerMap
          latitude={targetLat}
          longitude={targetLng}
          radiusMeters={targetRadiusMeters}
          userLocation={
            userLat !== undefined && userLat !== null && userLng !== undefined && userLng !== null
              ? { latitude: userLat, longitude: userLng }
              : null
          }
          locations={locations}
          readOnly={true}
          showManualInputs={false}
          showSearch={false}
          showGpsButton={false}
          height={240}
          title={title}
        />
      ) : (
        /* SVG Radar Visualization */
        <div
          style={{
            width: '100%',
            height: 240,
            backgroundColor: '#f8fafc',
            borderRadius: 'var(--radius-md)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            position: 'relative',
            overflow: 'hidden',
            border: '1px dashed var(--border-subtle)',
          }}
        >
          <svg width="100%" height="100%" viewBox="0 0 400 240">
            {/* Grid lines */}
            <line x1="0" y1="120" x2="400" y2="120" stroke="#e2e8f0" strokeDasharray="3 3" />
            <line x1="200" y1="0" x2="200" y2="240" stroke="#e2e8f0" strokeDasharray="3 3" />

            {/* Outer circle (Max boundary) */}
            <circle cx="200" cy="120" r="95" fill="none" stroke="#cbd5e1" strokeWidth="1" strokeDasharray="4 4" />

            {/* Geofence Zone Circle */}
            <circle
              cx="200"
              cy="120"
              r="60"
              fill="rgba(16, 185, 129, 0.12)"
              stroke="var(--color-primary-500)"
              strokeWidth="2"
            />

            {/* Office center point */}
            <circle cx="200" cy="120" r="5" fill="var(--color-primary-700)" />
            <text x="200" y="145" fontSize="11" fontWeight="bold" textAnchor="middle" fill="#047857">
              Titik Pusat ({targetRadiusMeters}m)
            </text>

            {/* User Location Indicator */}
            {userLat !== undefined && userLat !== null && userLng !== undefined && userLng !== null && (
              <g
                transform={
                  isValid
                    ? 'translate(225, 105)' // inside circle
                    : 'translate(310, 70)' // outside circle
                }
              >
                <circle cx="0" cy="0" r="8" fill={isValid ? '#10b981' : '#e11d48'} />
                <circle cx="0" cy="0" r="16" fill="none" stroke={isValid ? '#10b981' : '#e11d48'} strokeWidth="1" opacity="0.6">
                  <animate attributeName="r" values="8;20" dur="1.5s" repeatCount="indefinite" />
                  <animate attributeName="opacity" values="0.8;0" dur="1.5s" repeatCount="indefinite" />
                </circle>
                <text x="0" y="-12" fontSize="10" fontWeight="bold" textAnchor="middle" fill={isValid ? '#065f46' : '#991b1b'}>
                  Posisi Anda
                </text>
              </g>
            )}
          </svg>
        </div>
      )}

      {/* Target and current coordinates summary */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 180px), 1fr))',
          gap: '0.75rem',
          marginTop: '1rem',
          fontSize: '0.8125rem',
          color: 'var(--text-muted)',
        }}
      >
        <div>
          <strong>Pusat Geofence:</strong> {targetLat.toFixed(5)}, {targetLng.toFixed(5)} (Radius {targetRadiusMeters}m)
        </div>
        <div>
          <strong>Koordinat Terdeteksi:</strong>{' '}
          {userLat !== undefined && userLat !== null && userLng !== undefined && userLng !== null
            ? `${userLat.toFixed(5)}, ${userLng.toFixed(5)}`
            : 'Menunggu sinyal GPS browser'}
        </div>
      </div>

      {/* Simulation triggers for testing environments without physical GPS (Demo Mode Only) */}
      {IS_DEMO_MODE && onSimulateCoords && (
        <div style={{ marginTop: '0.875rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', alignSelf: 'center' }}>
            Simulasi Pengujian:
          </span>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => onSimulateCoords(targetLat + 0.0001, targetLng + 0.0001)}
          >
            <Navigation size={12} /> Di Lokasi (Jarak ~15m)
          </button>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => onSimulateCoords(targetLat + 0.0035, targetLng + 0.0035)}
          >
            <Navigation size={12} /> Di Luar Radius (Jarak ~450m)
          </button>
        </div>
      )}
    </div>
  );
};

