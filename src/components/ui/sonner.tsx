'use client';

import React from 'react';
import {
  CircleCheckIcon,
  InfoIcon,
  Loader2Icon,
  OctagonXIcon,
  TriangleAlertIcon,
} from 'lucide-react';
import { Toaster as Sonner, type ToasterProps } from 'sonner';

// We run a dark UI site-wide, so keep notifications consistent.
export function Toaster(props: ToasterProps) {
  return (
    <Sonner
      theme="dark"
      className="toaster group"
      icons={{
        success: <CircleCheckIcon className="size-4" />,
        info: <InfoIcon className="size-4" />,
        warning: <TriangleAlertIcon className="size-4" />,
        error: <OctagonXIcon className="size-4" />,
        loading: <Loader2Icon className="size-4 animate-spin" />,
      }}
      style={{
        // Match the site's glassy cards.
        '--normal-bg': 'rgba(13, 18, 32, 0.95)',
        '--normal-text': 'rgba(255,255,255,0.92)',
        '--normal-border': 'rgba(255,255,255,0.12)',
        '--border-radius': '16px',
      } as React.CSSProperties}
      {...props}
    />
  );
}
