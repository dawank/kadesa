import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StatusBadge } from '../components/common/StatusBadge';

describe('Component Unit Tests', () => {
  it('should render StatusBadge with correct labels and classes', () => {
    const { rerender } = render(<StatusBadge status="HADIR" />);
    expect(screen.getByText('Hadir')).toBeDefined();

    rerender(<StatusBadge status="TERLAMBAT" />);
    expect(screen.getByText('Terlambat')).toBeDefined();

    rerender(<StatusBadge status="DINAS_LUAR" />);
    expect(screen.getByText('Dinas Luar')).toBeDefined();

    rerender(<StatusBadge status="RATIFICATION_OVERDUE" />);
    expect(screen.getByText('Overdue Ratifikasi')).toBeDefined();
  });
});
