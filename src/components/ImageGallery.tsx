import { useState, useMemo } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';

interface ImageGalleryProps {
  imageUrls?: string[];
  fallbackUrl?: string;
}

export function ImageGallery({ imageUrls, fallbackUrl }: ImageGalleryProps) {
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const allImageUrls = useMemo(() => {
    const urls: string[] = [];

    if (imageUrls && imageUrls.length > 0) {
      urls.push(...imageUrls);
    } else if (fallbackUrl) {
      urls.push(fallbackUrl);
    }

    return urls.filter(url => url && url.trim());
  }, [imageUrls, fallbackUrl]);

  const currentImageUrl = allImageUrls[currentImageIndex];

  if (!currentImageUrl) {
    return <div className="text-gray-500">No image available</div>;
  }

  return (
    <div className="h-full flex flex-col">
      <button className="relative flex-1 flex items-center justify-center min-h-0 mb-2 group" onClick={() => setIsModalOpen(true)}>
        <div className="w-full h-full flex-col items-center justify-center hidden transition group-hover:flex text-xs font-mono absolute top-0 right-0 bg-black/30">
          <span className="text-white text-lg">Click to view full size</span>
        </div>
        <img
          src={currentImageUrl}
          alt="Task image"
          className="max-w-full max-h-full object-contain rounded-md cursor-pointer hover:opacity-90 transition-opacity"
        />
      </button>

      {allImageUrls.length > 1 && (
        <div className="flex gap-1.5 overflow-x-auto pb-1 flex-shrink-0">
          {allImageUrls.map((url, index) => (
            <button
              key={index}
              onClick={() => setCurrentImageIndex(index)}
              className={`flex-shrink-0 w-12 h-12 rounded border-2 overflow-hidden ${index === currentImageIndex ? 'border-blue-500' : 'border-gray-300'
                }`}
            >
              <img
                src={url}
                alt={`Thumbnail ${index + 1}`}
                className="w-full h-full object-cover"
              />
            </button>
          ))}
        </div>
      )}

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-7xl max-h-[95vh] w-[95vw] h-[95vh] p-2">
          <div className="w-full h-full flex items-center justify-center">
            <img
              src={currentImageUrl}
              alt="Full size image"
              className="max-w-full max-h-[85vh] object-contain"
            />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}