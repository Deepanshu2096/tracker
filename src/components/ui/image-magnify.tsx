import React, { useState, useRef, useCallback } from 'react';
import { cn } from '@/lib/utils'; // Replaced clsx with cn

/**
 * Image magnify component with zoom functionality, styled like a typical e-commerce site.
 * A magnifying glass appears on the main image, and a separate panel shows the magnified view.
 *
 * @param {string} src - The image source URL.
 * @param {string} alt - The alt text for the image.
 * @param {string} className - Optional additional class names for the container.
 * @param {number} magnifierSize - The diameter of the magnifier circle in pixels.
 * @param {number} zoomLevel - The initial zoom factor.
 * @param {boolean} showMagnifier - Whether to show the magnifier on hover.
 */
export const ImageMagnify = ({
  src,
  alt,
  className,
  magnifierSize = 200,
  zoomLevel = 2,
  showMagnifier = true,
}) => {
  // State to manage the component's behavior
  const [isHovering, setIsHovering] = useState(false);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [imageLoaded, setImageLoaded] = useState(false);
  const [currentZoomLevel, setCurrentZoomLevel] = useState(zoomLevel);

  // Refs to get the DOM elements for precise calculations
  const imageRef = useRef(null);
  const containerRef = useRef(null);
  const magnifierRef = useRef(null);
  const panelRef = useRef(null); // Added ref for the zoom panel

  // Function to handle mouse movement and update the position
  const handleMouseMove = useCallback((e) => {
    if (!imageRef.current) return;

    // Get the image's position and dimensions on the screen
    const imageRect = imageRef.current.getBoundingClientRect();
    
    // Calculate mouse position relative to the rendered image
    const imageX = e.clientX - imageRect.left;
    const imageY = e.clientY - imageRect.top;

    // Correct for the image scaling caused by 'object-contain'
    const naturalWidthRatio = imageRef.current.naturalWidth / imageRect.width;
    const naturalHeightRatio = imageRef.current.naturalHeight / imageRect.height;
    
    // Adjust mouse position to correspond to the natural image dimensions
    const naturalX = imageX * naturalWidthRatio;
    const naturalY = imageY * naturalHeightRatio;

    // Set a unified state with both natural and scaled positions
    setMousePosition({ 
      scaledX: imageX, 
      scaledY: imageY,
      naturalX: naturalX, 
      naturalY: naturalY 
    });
  }, []);

  // Event handlers for mouse enter/leave
  const handleMouseEnter = useCallback(() => {
    setIsHovering(true);
  }, []);

  const handleMouseLeave = useCallback(() => {
    setIsHovering(false);
  }, []);

  // Handler for image loading completion
  const handleImageLoad = useCallback(() => setImageLoaded(true), []);

  // Functions to handle zoom in and out
  const zoomIn = useCallback((e) => {
    e.stopPropagation();
    setCurrentZoomLevel((prev) => Math.min(prev + 0.5, 4));
  }, []);

  const zoomOut = useCallback((e) => {
    e.stopPropagation();
    setCurrentZoomLevel((prev) => Math.max(prev - 0.5, 1));
  }, []);

  // Calculate the position of the magnifying glass overlay using scaled coordinates
  const magnifierX = mousePosition.scaledX - magnifierSize / 2;
  const magnifierY = mousePosition.scaledY - magnifierSize / 2;

  // Calculate the background position for the magnified view, centering it on the panel
  const backgroundX = -(mousePosition.naturalX * currentZoomLevel) + (panelRef.current?.clientWidth / 2);
  const backgroundY = -(mousePosition.naturalY * currentZoomLevel) + (panelRef.current?.clientHeight / 2);

  return (
    <div
      ref={containerRef}
      className={cn("overflow-hidden w-full h-full flex flex-row gap-8 items-start", className)}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onMouseMove={handleMouseMove}
    >
      {/* Main Image and Magnifying Glass Container */}
      <div className="relative w-full h-full flex items-center justify-center">
        {/* Main Image */}
        <img
          ref={imageRef}
          src={src}
          alt={alt}
          className={cn(
            "w-full h-full object-contain transition-opacity duration-200",
            imageLoaded ? "opacity-100" : "opacity-0"
          )}
          onLoad={handleImageLoad}
          draggable={false}
        />

        {/* Loading State */}
        {!imageLoaded && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
          </div>
        )}

        {/* Instructions */}
        {!isHovering && imageLoaded && (
          <div className="absolute bottom-4 left-4 bg-black/50 text-white text-xs px-2 py-1 rounded-md transition-opacity duration-200 opacity-100">
            Hover to magnify.
          </div>
        )}
        
        {/* Magnifying Glass Overlay */}
        {showMagnifier && isHovering && imageLoaded && (
          <div
            ref={magnifierRef}
            className="absolute pointer-events-none border-2 border-gray-400 bg-black/30 shadow-lg"
            style={{
              left: magnifierX,
              top: magnifierY,
              width: magnifierSize,
              height: magnifierSize,
              // Add a slight blur to the magnifier itself for a nice effect
              backdropFilter: 'blur(2px)', 
            }}
          />
        )}
      </div>

      {/* Parallel Magnified View Panel */}
      {isHovering && imageLoaded && (
        <div
          ref={panelRef} // Added ref here
          className="w-[600px] h-100 p-4 bg-white/80 backdrop-blur-sm shadow-lg rounded-bl-lg transition-transform duration-300 ease-in-out absolute right-0 top-50"
        >
          <div 
            className="w-full h-full rounded-lg overflow-hidden relative"
            style={{
              backgroundImage: `url(${src})`,
              backgroundSize: `${imageRef.current?.naturalWidth * currentZoomLevel}px ${imageRef.current?.naturalHeight * currentZoomLevel}px`,
              backgroundPosition: `${backgroundX}px ${backgroundY}px`,
              backgroundRepeat: 'no-repeat',
            }}
          />

          {/* Zoom Controls */}
          <div className="absolute bottom-4 right-4 flex flex-col gap-1 opacity-100 z-20">
            <button
              className="w-8 h-8 bg-white/80 hover:bg-white rounded-full flex items-center justify-center text-sm font-bold shadow-md"
              onClick={zoomIn}
              title="Zoom In"
            >
              +
            </button>
            <button
              className="w-8 h-8 bg-white/80 hover:bg-white rounded-full flex items-center justify-center text-sm font-bold shadow-md"
              onClick={zoomOut}
              title="Zoom Out"
            >
              -
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ImageMagnify;