import React, { useRef, useState, useEffect, forwardRef } from 'react';

interface LazyImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  src: string;
  alt: string;
  wrapperClassName?: string;
  containerClassName?: string;
  placeholder?: React.ReactNode;
  blurPlaceholder?: boolean;
  fadeIn?: boolean;
  rootMargin?: string;
  threshold?: number;
}

export const LazyImage = forwardRef<HTMLDivElement, LazyImageProps>(
  function LazyImage(
    {
      src,
      alt,
      wrapperClassName = '',
      containerClassName = '',
      placeholder,
      blurPlaceholder = true,
      fadeIn = true,
      rootMargin = '100px',
      threshold = 0.1,
      className = '',
      ...props
    },
    ref
  ) {
    const containerRef = useRef<HTMLDivElement>(null);
    const [isVisible, setIsVisible] = useState(false);
    const [isLoaded, setIsLoaded] = useState(false);
    const [hasError, setHasError] = useState(false);

    useEffect(() => {
      const element = containerRef.current;
      if (!element) return;

      const observer = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) {
            setIsVisible(true);
            observer.disconnect();
          }
        },
        { rootMargin, threshold }
      );

      observer.observe(element);

      return () => observer.disconnect();
    }, [rootMargin, threshold]);

    const handleLoad = () => {
      setIsLoaded(true);
    };

    const handleError = () => {
      setHasError(true);
    };

    return (
      <div
        ref={(node) => {
          (containerRef as React.MutableRefObject<HTMLDivElement | null>).current = node;
          if (typeof ref === 'function') {
            ref(node);
          } else if (ref) {
            ref.current = node;
          }
        }}
        className={`relative overflow-hidden ${wrapperClassName}`}
      >
        {!isLoaded && !hasError && placeholder && (
          <div className="absolute inset-0 flex items-center justify-center z-10">
            {placeholder}
          </div>
        )}

        {hasError && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-900/50 text-gray-600 text-xs">
            加载失败
          </div>
        )}

        {isVisible && (
          <div
            className={`${containerClassName} ${fadeIn ? 'transition-opacity duration-300' : ''} ${
              isLoaded ? 'opacity-100' : 'opacity-0'
            }`}
          >
            <img
              src={src}
              alt={alt}
              className={`${className} ${blurPlaceholder && !isLoaded ? 'blur-sm' : ''}`}
              onLoad={handleLoad}
              onError={handleError}
              loading="lazy"
              decoding="async"
              {...props}
            />
          </div>
        )}

        {!isVisible && (
          <div className={`absolute inset-0 bg-gray-900/20 ${containerClassName}`} />
        )}
      </div>
    );
  }
);

interface LazyBackgroundImageProps {
  src: string;
  alt?: string;
  className?: string;
  children?: React.ReactNode;
  rootMargin?: string;
}

export function LazyBackgroundImage({
  src,
  alt = '',
  className = '',
  children,
  rootMargin = '100px',
}: LazyBackgroundImageProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin, threshold: 0.1 }
    );

    observer.observe(element);

    return () => observer.disconnect();
  }, [rootMargin]);

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {isVisible && (
        <img
          src={src}
          alt={alt}
          className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-500 ${
            isLoaded ? 'opacity-100' : 'opacity-0'
          }`}
          onLoad={() => setIsLoaded(true)}
          loading="lazy"
          decoding="async"
        />
      )}
      {children}
    </div>
  );
}

export default LazyImage;
