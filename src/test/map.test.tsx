import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { LocationPickerMap } from '../components/common/LocationPickerMap';
import { GeofencePreview } from '../components/common/GeofencePreview';

describe('LocationPickerMap & Interactive Map Audit Tests', () => {
  it('should render interactive map with title and manual coordinate inputs', () => {
    const handleChange = vi.fn();
    const handleRadiusChange = vi.fn();

    render(
      <LocationPickerMap
        latitude={-6.4828}
        longitude={106.8436}
        radiusMeters={100}
        onChange={handleChange}
        onRadiusChange={handleRadiusChange}
        title="Peta Uji Lokasi"
        showManualInputs={true}
        showSearch={true}
        showGpsButton={true}
      />
    );

    expect(screen.getAllByText('Peta Uji Lokasi').length).toBeGreaterThan(0);
    expect(screen.getByPlaceholderText(/Cari nama tempat/i)).toBeInTheDocument();

    const latInput = screen.getByLabelText(/Latitude/i) as HTMLInputElement;
    const lngInput = screen.getByLabelText(/Longitude/i) as HTMLInputElement;
    const radiusInput = screen.getByLabelText(/Radius Geofence/i) as HTMLInputElement;

    expect(latInput.value).toBe('-6.4828');
    expect(lngInput.value).toBe('106.8436');
    expect(radiusInput.value).toBe('100');
  });

  it('should trigger onChange when manual latitude/longitude inputs are updated', () => {
    const handleChange = vi.fn();

    render(
      <LocationPickerMap
        latitude={-6.4828}
        longitude={106.8436}
        onChange={handleChange}
        showManualInputs={true}
      />
    );

    const latInput = screen.getByLabelText(/Latitude/i);
    fireEvent.change(latInput, { target: { value: '-6.4950' } });

    expect(handleChange).toHaveBeenCalledWith({
      latitude: -6.495,
      longitude: 106.8436,
    });
  });

  it('should respect readOnly mode by hiding search, GPS buttons, and manual inputs', () => {
    render(
      <LocationPickerMap
        latitude={-6.4828}
        longitude={106.8436}
        readOnly={true}
        showManualInputs={false}
        showSearch={false}
        showGpsButton={false}
        title="Tinjauan Lokasi Read-Only"
      />
    );

    expect(screen.getAllByText('Tinjauan Lokasi Read-Only').length).toBeGreaterThan(0);
    expect(screen.queryByPlaceholderText(/Cari nama tempat/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/GPS Saya/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/Latitude/i)).not.toBeInTheDocument();
  });

  it('should toggle between interactive map and SVG radar in GeofencePreview', () => {
    render(
      <GeofencePreview
        targetLat={-6.4828}
        targetLng={106.8436}
        targetRadiusMeters={100}
        userLat={-6.4829}
        userLng={106.8437}
        distanceMeters={18}
        isValid={true}
      />
    );

    // Default mode is interactive map
    expect(screen.getByText(/Peta Interaktif/i)).toBeInTheDocument();
    expect(screen.getByText(/Radar Geofence/i)).toBeInTheDocument();
    expect(screen.getByText(/Jarak: 18 meter/i)).toBeInTheDocument();

    // Switch to Radar mode
    const radarBtn = screen.getByRole('button', { name: /Radar Geofence/i });
    fireEvent.click(radarBtn);

    // SVG radar should now be active
    expect(screen.getByText(/Titik Pusat \(100m\)/i)).toBeInTheDocument();
  });

  it('should handle simulated coordinate buttons in GeofencePreview demo mode', () => {
    const handleSimulate = vi.fn();

    render(
      <GeofencePreview
        targetLat={-6.4828}
        targetLng={106.8436}
        targetRadiusMeters={100}
        userLat={-6.4828}
        userLng={106.8436}
        distanceMeters={0}
        isValid={true}
        onSimulateCoords={handleSimulate}
      />
    );

    const diLokasiBtn = screen.getByRole('button', { name: /Di Lokasi/i });
    fireEvent.click(diLokasiBtn);
    expect(handleSimulate).toHaveBeenCalledWith(-6.4827, 106.8437);
  });
});
