import React, { useEffect, useRef, useState, useCallback } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  MapPin,
  Navigation,
  Search,
  AlertTriangle,
  CheckCircle2,
  Maximize2,
  RefreshCw,
  Loader2,
  Globe,
} from 'lucide-react';

export interface MapLocation {
  id?: string;
  latitude: number;
  longitude: number;
  label?: string;
  radiusMeters?: number;
  isUserLocation?: boolean;
}

export interface LocationPickerMapProps {
  /** Latitude titik fokus/terpilih */
  latitude?: number;
  /** Longitude titik fokus/terpilih */
  longitude?: number;
  /** Radius geofence dalam meter */
  radiusMeters?: number;
  /** Callback saat titik koordinat diubah pada peta atau input manual */
  onChange?: (coords: { latitude: number; longitude: number }) => void;
  /** Callback saat radius diubah */
  onRadiusChange?: (radius: number) => void;
  /** Titik-titik lokasi tambahan (misal beberapa lokasi DL atau User vs Office) */
  locations?: MapLocation[];
  /** Posisi GPS aktual aparatur */
  userLocation?: { latitude: number; longitude: number; accuracy?: number } | null;
  /** Mode hanya lihat (read-only) atau interaktif */
  readOnly?: boolean;
  /** Tinggi container peta (default: 340px) */
  height?: number | string;
  /** Judul atau label peta */
  title?: string;
  /** Menampilkan kolom input manual latitude, longitude, dan radius */
  showManualInputs?: boolean;
  /** Menampilkan fitur pencarian alamat via Geocoding */
  showSearch?: boolean;
  /** Menampilkan tombol gunakan GPS perangkat */
  showGpsButton?: boolean;
  /** Level zoom awal (default: 16) */
  zoom?: number;
}

// Marker custom icon SVG untuk akurasi visual tanpa masalah path asset bundler
const createCustomIcon = (color: string, label?: string) => {
  return L.divIcon({
    className: 'custom-map-marker',
    html: `
      <div style="
        position: relative;
        display: flex;
        flex-direction: column;
        align-items: center;
        transform: translate(-50%, -100%);
      ">
        <div style="
          background-color: ${color};
          width: 32px;
          height: 32px;
          border-radius: 50% 50% 50% 0;
          transform: rotate(-45deg);
          box-shadow: 0 4px 10px rgba(0,0,0,0.3);
          border: 2px solid #ffffff;
          display: flex;
          align-items: center;
          justify-content: center;
        ">
          <div style="
            width: 10px;
            height: 10px;
            background-color: #ffffff;
            border-radius: 50%;
            transform: rotate(45deg);
          "></div>
        </div>
        ${
          label
            ? `<div style="
                background: rgba(15, 23, 42, 0.85);
                color: #ffffff;
                font-size: 10px;
                font-weight: 700;
                padding: 2px 6px;
                border-radius: 4px;
                margin-top: 4px;
                white-space: nowrap;
                box-shadow: 0 2px 4px rgba(0,0,0,0.2);
              ">${label}</div>`
            : ''
        }
      </div>
    `,
    iconSize: [32, 42],
    iconAnchor: [16, 42],
  });
};

const createUserGpsIcon = () => {
  return L.divIcon({
    className: 'custom-gps-marker',
    html: `
      <div style="
        position: relative;
        display: flex;
        align-items: center;
        justify-content: center;
        transform: translate(-50%, -50%);
      ">
        <div style="
          width: 22px;
          height: 22px;
          border-radius: 50%;
          background-color: #2563eb;
          border: 3px solid #ffffff;
          box-shadow: 0 0 0 4px rgba(37, 99, 235, 0.35), 0 4px 8px rgba(0,0,0,0.3);
        "></div>
      </div>
    `,
    iconSize: [22, 22],
    iconAnchor: [11, 11],
  });
};

export const LocationPickerMap: React.FC<LocationPickerMapProps> = ({
  latitude = -6.4828,
  longitude = 106.8436,
  radiusMeters,
  onChange,
  onRadiusChange,
  locations,
  userLocation,
  readOnly = false,
  height = 340,
  title,
  showManualInputs = true,
  showSearch = true,
  showGpsButton = true,
  zoom = 16,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const primaryMarkerRef = useRef<L.Marker | null>(null);
  const circleRef = useRef<L.Circle | null>(null);
  const extraMarkersRef = useRef<L.LayerGroup | null>(null);

  // State koordinat internal untuk input manual
  const [internalLat, setInternalLat] = useState<number>(latitude);
  const [internalLng, setInternalLng] = useState<number>(longitude);
  const [internalRadius, setInternalRadius] = useState<number>(radiusMeters || 100);

  // State Geocoding & GPS
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<Array<{ display_name: string; lat: string; lon: string }>>([]);
  const [isLocatingUser, setIsLocatingUser] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);
  const [tileError, setTileError] = useState(false);

  // Sync internal state jika props berubah dari luar
  useEffect(() => {
    setInternalLat(latitude);
    setInternalLng(longitude);
  }, [latitude, longitude]);

  useEffect(() => {
    if (radiusMeters !== undefined) {
      setInternalRadius(radiusMeters);
    }
  }, [radiusMeters]);

  // Inisialisasi Peta Leaflet
  useEffect(() => {
    if (!mapContainerRef.current) return;

    // Bersihkan instance lama jika ada
    if (mapInstanceRef.current) {
      mapInstanceRef.current.remove();
      mapInstanceRef.current = null;
    }

    try {
      const map = L.map(mapContainerRef.current, {
        center: [latitude, longitude],
        zoom: zoom,
        zoomControl: true,
        attributionControl: true,
      });

      // Tile Layer OpenStreetMap resmi & legal
      const tileLayer = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors',
      });

      tileLayer.on('tileerror', () => {
        setTileError(true);
      });

      tileLayer.addTo(map);

      // Layer group untuk marker tambahan
      const extraGroup = L.layerGroup().addTo(map);
      extraMarkersRef.current = extraGroup;

      // Marker Utama
      const primaryMarker = L.marker([latitude, longitude], {
        icon: createCustomIcon('#059669', title || 'Lokasi Terpilih'),
        draggable: !readOnly,
      }).addTo(map);
      primaryMarkerRef.current = primaryMarker;

      // Event drag marker utama
      if (!readOnly && onChange) {
        primaryMarker.on('dragend', () => {
          const pos = primaryMarker.getLatLng();
          const newLat = parseFloat(pos.lat.toFixed(6));
          const newLng = parseFloat(pos.lng.toFixed(6));
          setInternalLat(newLat);
          setInternalLng(newLng);
          onChange({ latitude: newLat, longitude: newLng });
        });
      }

      // Event klik peta untuk memindahkan titik
      if (!readOnly && onChange) {
        map.on('click', (e: L.LeafletMouseEvent) => {
          const newLat = parseFloat(e.latlng.lat.toFixed(6));
          const newLng = parseFloat(e.latlng.lng.toFixed(6));
          primaryMarker.setLatLng([newLat, newLng]);
          setInternalLat(newLat);
          setInternalLng(newLng);
          onChange({ latitude: newLat, longitude: newLng });
        });
      }

      // Geofence Circle
      if (radiusMeters && radiusMeters > 0) {
        const circle = L.circle([latitude, longitude], {
          radius: radiusMeters,
          color: '#059669',
          fillColor: '#10b981',
          fillOpacity: 0.15,
          weight: 2,
          dashArray: '4, 6',
        }).addTo(map);
        circleRef.current = circle;
      }

      mapInstanceRef.current = map;

      // Invalidate size setelah render selesai agar tile pas dengan container flex/grid
      setTimeout(() => {
        map.invalidateSize();
      }, 250);
    } catch (err) {
      console.error('Gagal inisialisasi Leaflet map:', err);
      setMapError('Komponen peta tidak dapat diinisialisasi pada peramban ini.');
    }

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []); // Run sekali saat mount

  // Update posisi marker utama & geofence saat koordinat berubah
  useEffect(() => {
    if (!mapInstanceRef.current || !primaryMarkerRef.current) return;

    const currentPos = primaryMarkerRef.current.getLatLng();
    if (currentPos.lat !== latitude || currentPos.lng !== longitude) {
      primaryMarkerRef.current.setLatLng([latitude, longitude]);
      mapInstanceRef.current.panTo([latitude, longitude], { animate: true });
    }

    // Update Circle Radius
    if (radiusMeters && radiusMeters > 0) {
      if (circleRef.current) {
        circleRef.current.setLatLng([latitude, longitude]);
        circleRef.current.setRadius(radiusMeters);
      } else {
        circleRef.current = L.circle([latitude, longitude], {
          radius: radiusMeters,
          color: '#059669',
          fillColor: '#10b981',
          fillOpacity: 0.15,
          weight: 2,
          dashArray: '4, 6',
        }).addTo(mapInstanceRef.current);
      }
    } else if (circleRef.current) {
      circleRef.current.remove();
      circleRef.current = null;
    }
  }, [latitude, longitude, radiusMeters]);

  // Render extra markers (multi-locations atau user position)
  useEffect(() => {
    if (!mapInstanceRef.current || !extraMarkersRef.current) return;

    extraMarkersRef.current.clearLayers();

    // 1. Render daftar lokasi tambahan jika ada
    if (locations && locations.length > 0) {
      locations.forEach((loc, index) => {
        // Jangan render jika sama dengan titik utama
        if (loc.latitude === latitude && loc.longitude === longitude) return;

        const marker = L.marker([loc.latitude, loc.longitude], {
          icon: createCustomIcon('#2563eb', loc.label || `Lokasi ${index + 1}`),
        }).addTo(extraMarkersRef.current!);

        if (loc.radiusMeters && loc.radiusMeters > 0) {
          L.circle([loc.latitude, loc.longitude], {
            radius: loc.radiusMeters,
            color: '#2563eb',
            fillColor: '#3b82f6',
            fillOpacity: 0.12,
            weight: 2,
            dashArray: '3, 5',
          }).addTo(extraMarkersRef.current!);
        }

        if (loc.label) {
          marker.bindPopup(`<strong>${loc.label}</strong><br/>Radius: ${loc.radiusMeters || 100}m`);
        }
      });
    }

    // 2. Render user live position jika ada
    if (userLocation && userLocation.latitude && userLocation.longitude) {
      const userMarker = L.marker([userLocation.latitude, userLocation.longitude], {
        icon: createUserGpsIcon(),
      }).addTo(extraMarkersRef.current);

      userMarker.bindPopup(
        `<strong>Posisi Anda (GPS)</strong><br/>Akurasi: ±${Math.round(userLocation.accuracy || 10)}m`
      );
    }
  }, [locations, userLocation, latitude, longitude]);

  // Handler input manual Latitude
  const handleManualLatChange = (valStr: string) => {
    const val = parseFloat(valStr);
    setInternalLat(isNaN(val) ? 0 : val);
    if (!isNaN(val) && val >= -90 && val <= 90 && onChange) {
      onChange({ latitude: val, longitude: internalLng });
      if (primaryMarkerRef.current && mapInstanceRef.current) {
        primaryMarkerRef.current.setLatLng([val, internalLng]);
        mapInstanceRef.current.panTo([val, internalLng]);
      }
    }
  };

  // Handler input manual Longitude
  const handleManualLngChange = (valStr: string) => {
    const val = parseFloat(valStr);
    setInternalLng(isNaN(val) ? 0 : val);
    if (!isNaN(val) && val >= -180 && val <= 180 && onChange) {
      onChange({ latitude: internalLat, longitude: val });
      if (primaryMarkerRef.current && mapInstanceRef.current) {
        primaryMarkerRef.current.setLatLng([internalLat, val]);
        mapInstanceRef.current.panTo([internalLat, val]);
      }
    }
  };

  // Handler input manual Radius
  const handleManualRadiusChange = (valStr: string) => {
    const val = parseInt(valStr, 10);
    setInternalRadius(isNaN(val) ? 0 : val);
    if (!isNaN(val) && val > 0 && onRadiusChange) {
      onRadiusChange(val);
      if (circleRef.current) {
        circleRef.current.setRadius(val);
      }
    }
  };

  // Handler Geolocation API
  const handleGetCurrentLocation = () => {
    if (!navigator.geolocation) {
      alert('Perangkat peramban Anda tidak mendukung Geolocation API');
      return;
    }

    setIsLocatingUser(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setIsLocatingUser(false);
        const newLat = parseFloat(pos.coords.latitude.toFixed(6));
        const newLng = parseFloat(pos.coords.longitude.toFixed(6));
        setInternalLat(newLat);
        setInternalLng(newLng);
        if (onChange) onChange({ latitude: newLat, longitude: newLng });
        if (mapInstanceRef.current && primaryMarkerRef.current) {
          primaryMarkerRef.current.setLatLng([newLat, newLng]);
          mapInstanceRef.current.flyTo([newLat, newLng], 17);
        }
      },
      (err) => {
        setIsLocatingUser(false);
        console.warn('Geolocation error:', err.message);
        alert(`Gagal memperoleh lokasi perangkat: ${err.message}. Pastikan izin lokasi aktif.`);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  // Handler Pencarian Tempat (Nominatim OpenStreetMap)
  const handleSearchSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    setSearchResults([]);
    try {
      const endpoint = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
        searchQuery.trim()
      )}&countrycodes=id&limit=5`;
      const res = await fetch(endpoint, {
        headers: {
          'Accept-Language': 'id',
        },
      });
      if (!res.ok) throw new Error('HTTP error ' + res.status);
      const data = await res.json();
      setSearchResults(data);
    } catch (err) {
      console.warn('Gagal mencari alamat via geocoding:', err);
      alert('Layanan pencarian alamat daring sedang tidak tersedia. Anda dapat memilih titik langsung pada peta.');
    } finally {
      setIsSearching(false);
    }
  };

  const handleSelectSearchResult = (result: { display_name: string; lat: string; lon: string }) => {
    const newLat = parseFloat(parseFloat(result.lat).toFixed(6));
    const newLng = parseFloat(parseFloat(result.lon).toFixed(6));
    setInternalLat(newLat);
    setInternalLng(newLng);
    setSearchResults([]);
    setSearchQuery('');
    if (onChange) onChange({ latitude: newLat, longitude: newLng });
    if (mapInstanceRef.current && primaryMarkerRef.current) {
      primaryMarkerRef.current.setLatLng([newLat, newLng]);
      mapInstanceRef.current.flyTo([newLat, newLng], 17);
    }
  };

  const handleRecenter = () => {
    if (mapInstanceRef.current) {
      mapInstanceRef.current.flyTo([latitude, longitude], zoom);
    }
  };

  return (
    <div
      style={{
        borderRadius: 'var(--radius-lg)',
        border: '1px solid var(--border-subtle)',
        backgroundColor: '#ffffff',
        overflow: 'hidden',
        boxShadow: 'var(--shadow-xs)',
      }}
    >
      {/* Header Bar Peta */}
      <div
        style={{
          padding: '0.75rem 1rem',
          backgroundColor: '#f8fafc',
          borderBottom: '1px solid var(--border-subtle)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '0.5rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <MapPin size={18} color="var(--color-primary-600)" />
          <strong style={{ fontSize: '0.875rem', color: 'var(--color-slate-800)' }}>
            {title || (readOnly ? 'Tinjauan Peta Lokasi' : 'Pilih Titik Lokasi pada Peta')}
          </strong>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          {/* Tombol Recenter */}
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={handleRecenter}
            title="Pusatkan Kembali Peta"
            style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem' }}
          >
            <Maximize2 size={13} /> Pusatkan
          </button>

          {/* Tombol GPS Perangkat */}
          {!readOnly && showGpsButton && (
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={handleGetCurrentLocation}
              disabled={isLocatingUser}
              title="Ambil Lokasi GPS Perangkat Ini"
              style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem' }}
            >
              {isLocatingUser ? (
                <>
                  <Loader2 size={13} className="animate-spin" /> Mendeteksi...
                </>
              ) : (
                <>
                  <Navigation size={13} color="var(--color-primary-600)" /> GPS Saya
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Bar Pencarian Alamat / Geocoding (jika aktif & interaktif) */}
      {!readOnly && showSearch && (
        <div style={{ padding: '0.5rem 1rem', backgroundColor: '#ffffff', borderBottom: '1px solid var(--border-subtle)' }}>
          <form onSubmit={handleSearchSubmit} style={{ display: 'flex', gap: '0.5rem', position: 'relative' }}>
            <div style={{ position: 'relative', flex: 1 }}>
              <input
                type="text"
                className="form-input"
                placeholder="Cari nama tempat, kantor, desa, atau jalan di Indonesia..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{ fontSize: '0.8125rem', padding: '0.35rem 0.75rem' }}
              />
            </div>
            <button
              type="submit"
              className="btn btn-secondary btn-sm"
              disabled={isSearching}
              style={{ fontSize: '0.75rem', padding: '0.35rem 0.75rem' }}
            >
              {isSearching ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />} Cari
            </button>

            {/* Dropdown Hasil Pencarian */}
            {searchResults.length > 0 && (
              <div
                style={{
                  position: 'absolute',
                  top: '100%',
                  left: 0,
                  right: 0,
                  backgroundColor: '#ffffff',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-md)',
                  boxShadow: 'var(--shadow-lg)',
                  zIndex: 1000,
                  maxHeight: 220,
                  overflowY: 'auto',
                  marginTop: 4,
                }}
              >
                {searchResults.map((item, idx) => (
                  <div
                    key={idx}
                    onClick={() => handleSelectSearchResult(item)}
                    style={{
                      padding: '0.5rem 0.75rem',
                      borderBottom: '1px solid var(--border-subtle)',
                      fontSize: '0.78rem',
                      cursor: 'pointer',
                      transition: 'background-color 0.15s',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#f1f5f9')}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#ffffff')}
                  >
                    <div style={{ fontWeight: 600, color: 'var(--color-slate-900)' }}>
                      {item.display_name.split(',')[0]}
                    </div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{item.display_name}</div>
                  </div>
                ))}
              </div>
            )}
          </form>
        </div>
      )}

      {/* Peringatan Tile Error (jika offline/terbatas) */}
      {tileError && (
        <div
          style={{
            padding: '0.35rem 0.75rem',
            backgroundColor: '#fef3c7',
            color: '#92400e',
            fontSize: '0.75rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.375rem',
          }}
        >
          <AlertTriangle size={14} />
          <span>Layanan tile peta OpenStreetMap sedang offline atau terbatas. Koordinat numerik tetap bekerja normal.</span>
        </div>
      )}

      {/* Container Leaflet DOM */}
      {mapError ? (
        <div
          style={{
            height,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#f8fafc',
            color: 'var(--text-muted)',
            padding: '1.5rem',
            textAlign: 'center',
          }}
        >
          <Globe size={32} color="var(--border-strong)" style={{ marginBottom: '0.5rem' }} />
          <p style={{ fontSize: '0.875rem' }}>{mapError}</p>
        </div>
      ) : (
        <div
          ref={mapContainerRef}
          style={{
            width: '100%',
            height,
            backgroundColor: '#e2e8f0',
            position: 'relative',
            zIndex: 1,
          }}
        />
      )}

      {/* Info Petunjuk Klik */}
      {!readOnly && (
        <div
          style={{
            padding: '0.35rem 0.75rem',
            backgroundColor: '#f8fafc',
            borderTop: '1px solid var(--border-subtle)',
            fontSize: '0.72rem',
            color: 'var(--text-muted)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <span>Klik/sentuh peta atau geser marker untuk menentukan koordinat presisi.</span>
          <span style={{ fontFamily: 'var(--font-mono)' }}>
            {internalLat.toFixed(5)}, {internalLng.toFixed(5)}
          </span>
        </div>
      )}

      {/* Kontrol Input Manual Latitude, Longitude, Radius (jika diaktifkan) */}
      {showManualInputs && (
        <div
          style={{
            padding: '0.75rem 1rem',
            backgroundColor: '#ffffff',
            borderTop: '1px solid var(--border-subtle)',
          }}
        >
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: radiusMeters !== undefined ? 'repeat(auto-fit, minmax(130px, 1fr))' : 'repeat(auto-fit, minmax(140px, 1fr))',
              gap: '0.75rem',
            }}
          >
            <div>
              <label
                htmlFor="map-manual-lat"
                style={{ display: 'block', fontSize: '0.725rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: 2 }}
              >
                Latitude
              </label>
              <input
                id="map-manual-lat"
                type="number"
                step="any"
                className="form-input"
                style={{ fontSize: '0.8125rem', padding: '0.3rem 0.5rem', fontFamily: 'var(--font-mono)' }}
                value={internalLat}
                disabled={readOnly}
                onChange={(e) => handleManualLatChange(e.target.value)}
              />
            </div>

            <div>
              <label
                htmlFor="map-manual-lng"
                style={{ display: 'block', fontSize: '0.725rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: 2 }}
              >
                Longitude
              </label>
              <input
                id="map-manual-lng"
                type="number"
                step="any"
                className="form-input"
                style={{ fontSize: '0.8125rem', padding: '0.3rem 0.5rem', fontFamily: 'var(--font-mono)' }}
                value={internalLng}
                disabled={readOnly}
                onChange={(e) => handleManualLngChange(e.target.value)}
              />
            </div>

            {radiusMeters !== undefined && (
              <div>
                <label
                  htmlFor="map-manual-radius"
                  style={{ display: 'block', fontSize: '0.725rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: 2 }}
                >
                  Radius Geofence (Meter)
                </label>
                <input
                  id="map-manual-radius"
                  type="number"
                  step="1"
                  min="10"
                  max="10000"
                  className="form-input"
                  style={{ fontSize: '0.8125rem', padding: '0.3rem 0.5rem', fontFamily: 'var(--font-mono)' }}
                  value={internalRadius}
                  disabled={readOnly || !onRadiusChange}
                  onChange={(e) => handleManualRadiusChange(e.target.value)}
                />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
