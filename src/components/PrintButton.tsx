'use client';

import React from 'react';

type Props = {
  label?: string;
  className?: string;
};

export default function PrintButton({ label = 'Print', className }: Props) {
  return (
    <button
      type="button"
      className={className ?? 'ui-btn no-print'}
      onClick={() => {
        try {
          window.print();
        } catch {
          // no-op
        }
      }}
    >
      {label}
    </button>
  );
}
