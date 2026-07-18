import React, { useState, useEffect, useRef } from 'react';

interface VirtualItemProps {
  children: React.ReactNode;
  estimatedHeight: number; // e.g. 150 for cards, 72 for list rows
  className?: string;
}

export const VirtualItem: React.FC<VirtualItemProps> = ({ children, estimatedHeight, className = "" }) => {
  const [isVisible, setIsVisible] = useState(false);
  const [height, setHeight] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    // Use IntersectionObserver to track if item is within 400px of viewport
    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsVisible(entry.isIntersecting);
        if (entry.isIntersecting && entry.target.clientHeight) {
          setHeight(entry.target.clientHeight);
        }
      },
      {
        rootMargin: '400px 0px 400px 0px', // Buffer zone to pre-render ahead of scrolling
        threshold: 0,
      }
    );

    observer.observe(el);
    return () => {
      observer.unobserve(el);
    };
  }, []);

  // Use ResizeObserver to dynamically update saved heights when child heights change (e.g., expansion/resizing)
  useEffect(() => {
    if (isVisible && containerRef.current) {
      const observer = new ResizeObserver((entries) => {
        for (const entry of entries) {
          if (entry.contentRect.height > 0) {
            setHeight(entry.target.clientHeight);
          }
        }
      });
      observer.observe(containerRef.current);
      return () => observer.disconnect();
    }
  }, [isVisible]);

  const minHeightStyle = height ? `${height}px` : `${estimatedHeight}px`;

  return (
    <div 
      ref={containerRef} 
      style={{ minHeight: minHeightStyle }}
      className={`w-full transition-opacity duration-200 ${className} ${isVisible ? 'opacity-100' : 'opacity-0'}`}
    >
      {isVisible ? children : null}
    </div>
  );
};
