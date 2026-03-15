'use client';

import { useEffect, useMemo, useState } from 'react';

type BackdropImage = {
  src: string;
  label: string;
};

export default function HomeBackdrop() {
  const images: BackdropImage[] = useMemo(
    () => [
      { src: '/images/cities/cleveland.webp', label: 'Cleveland' },
      { src: '/images/cities/detroit.webp', label: 'Detroit' },
      { src: '/images/cities/pittsburgh.webp', label: 'Pittsburgh' },
      { src: '/images/cities/buffalo.webp', label: 'Buffalo' },
    ],
    []
  );

  const [active, setActive] = useState(0);

  useEffect(() => {
    // Respect reduced motion settings.
    if (typeof window !== 'undefined') {
      const mq = window.matchMedia?.('(prefers-reduced-motion: reduce)');
      if (mq?.matches) return;
    }

    const id = window.setInterval(() => {
      setActive((n) => (n + 1) % images.length);
    }, 9000);

    return () => window.clearInterval(id);
  }, [images.length]);

  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden" aria-hidden="true">
      {/* Cross-fading photo layers */}
      {images.map((img, idx) => (
        <div
          key={img.src}
          className="absolute inset-0 transition-opacity duration-[1500ms] ease-in-out"
          style={{ opacity: idx === active ? 1 : 0 }}
          title={img.label}
        >
          <div
            className="absolute inset-0 scale-[1.06] bg-cover bg-center"
            style={{
              backgroundImage: `url(${img.src})`,
              filter: 'saturate(0.85) contrast(1.05) brightness(0.7)',
            }}
          />
        </div>
      ))}

      {/* Blend into the existing site look */}
      <div className="absolute inset-0 bg-gradient-to-b from-[#050812]/75 via-[#071022]/85 to-[#050812]/90" />
      <div className="absolute inset-0 bg-[radial-gradient(1200px_circle_at_25%_20%,rgba(56,189,248,0.18),transparent_55%),radial-gradient(900px_circle_at_80%_35%,rgba(16,185,129,0.14),transparent_55%)]" />
      <div className="absolute inset-0 backdrop-blur-[1px]" />
      <div className="absolute inset-0 opacity-[0.10] [background-image:radial-gradient(rgba(255,255,255,0.15)_1px,transparent_1px)] [background-size:3px_3px]" />
    </div>
  );
}
