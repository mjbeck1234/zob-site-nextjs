'use client';

import * as React from 'react';

type Props = Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'onClick'> & {
  confirmMessage: string;
  onClick?: React.MouseEventHandler<HTMLButtonElement>;
};

export default function ConfirmSubmitButton({ confirmMessage, onClick, ...props }: Props) {
  return (
    <button
      {...props}
      onClick={(e) => {
        // Allow the caller to run custom logic, then enforce confirmation.
        onClick?.(e);
        if (e.defaultPrevented) return;

        if (!window.confirm(confirmMessage)) {
          e.preventDefault();
          e.stopPropagation();
        }
      }}
    />
  );
}
