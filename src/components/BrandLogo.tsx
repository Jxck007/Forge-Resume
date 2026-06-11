import React from 'react';

interface BrandLogoProps {
  compact?: boolean;
  className?: string;
}

export default function BrandLogo({ compact = false, className = '' }: BrandLogoProps) {
  return (
    <div className={`forge-brand ${className}`} aria-label="Forge Resume">
      <span className="forge-brand-emblem" aria-hidden="true">
        <img src="/forge-resume-logo.png" alt="" />
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
