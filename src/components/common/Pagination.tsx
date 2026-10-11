import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  totalItems?: number;
  itemsPerPage?: number;
}

export const Pagination: React.FC<PaginationProps> = ({
  currentPage,
  totalPages,
  onPageChange,
  totalItems,
  itemsPerPage,
}) => {
  if (totalPages <= 1) return null;

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0.875rem 1rem',
        borderTop: '1px solid var(--border-subtle)',
        fontSize: '0.8125rem',
        color: 'var(--text-muted)',
      }}
    >
      <div>
        {totalItems !== undefined && itemsPerPage !== undefined && (
          <span>
            Menampilkan {Math.min((currentPage - 1) * itemsPerPage + 1, totalItems)} -{' '}
            {Math.min(currentPage * itemsPerPage, totalItems)} dari {totalItems} data
          </span>
        )}
      </div>
      <div style={{ display: 'flex', gap: '0.375rem', alignItems: 'center' }}>
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage <= 1}
          aria-label="Halaman Sebelumnya"
        >
          <ChevronLeft size={16} />
        </button>
        <span style={{ padding: '0 0.5rem', fontWeight: 600 }}>
          {currentPage} / {totalPages}
        </span>
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage >= totalPages}
          aria-label="Halaman Selanjutnya"
        >
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
};
