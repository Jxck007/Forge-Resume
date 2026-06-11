import React from 'react';

interface BrandLogoProps {
  compact?: boolean;
  className?: string;
}

export default function BrandLogo({ compact = false, className = '' }: BrandLogoProps) {
  return (
    <div className={`forge-brand ${className}`} aria-label="Forge Resume">
      <span className="forge-mark" aria-hidden="true">
        <span className="forge-mark-bar forge-mark-bar-top" />
        <span className="forge-mark-bar forge-mark-bar-middle" />
        <span className="forge-mark-stem" />
      </span>
      {!compact && (
        <span className="forge-wordmark">
          <strong>Forge</strong>
          <span>Resume</span>
        </span>
      )}
    </div>
  );
}
