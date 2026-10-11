export interface Village {
  id: string;
  nama: string;
  kecamatan: string;
  kabupaten: string;
  provinsi: string;
  kodePos: string;
  alamat: string;
  latitude: number;
  longitude: number;
  logo?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Position {
  id: string;
  nama: string;
  active: boolean;
  effectiveFrom: string;
  effectiveTo?: string | null;
  aparaturCount?: number;
}
