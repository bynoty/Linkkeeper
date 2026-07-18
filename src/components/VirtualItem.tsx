import React from 'react';

interface VirtualItemProps {
  children: React.ReactNode;
  estimatedHeight: number;
  className?: string;
}

export const VirtualItem: React.FC<VirtualItemProps> = ({ children, className = "" }) => {
  return (
    <div className={`w-full ${className}`}>
      {children}
    </div>
  );
};

