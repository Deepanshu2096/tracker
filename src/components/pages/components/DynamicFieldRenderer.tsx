import { Label } from '@/components/ui/label';

// Type for dynamic task data structure
type TaskDataItem = {
  [key: string]: any;
  image_urls?: string[];
  image_url_0?: string;
};

// Dynamic Field Renderer Component
export function DynamicFieldRenderer({ data, imageUrls }: { data: TaskDataItem, imageUrls?: { imageUrls: string[], fallbackUrl: string | null } }) {
  if (!data) return null;

  const renderFieldValue = (key: string, value: any) => {
    // Skip internal fields
    if (key === 'image_urls') return null;

    // Handle different data types
    if (value === null || value === undefined || value === '') {
      return <span className="text-gray-400 text-sm">No data</span>;
    }

    // Handle URLs (resource_url fields)
    if (key.includes('url') && typeof value === 'string' && (value.startsWith('http') || value.startsWith('https'))) {
      return (
        <a
          href={value}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-600 hover:text-blue-800 underline text-sm break-all"
        >
          {value}
        </a>
      );
    }

    // Try to parse JSON strings first
    if (typeof value === 'string') {
      try {
        const parsed = JSON.parse(value);
        if (typeof parsed === 'object' && parsed !== null) {
          if (Array.isArray(parsed)) {
            return <span className="text-sm">{parsed.join(', ')}</span>;
          }

          // Render object as simple table
          return (
            <div className="overflow-x-auto">
              <table className="w-full text-xs border-collapse">
                <tbody>
                  {Object.entries(parsed).map(([k, v]) => (
                    <tr key={k} className="border-b border-gray-200">
                      <td className="py-1 pr-2 font-medium text-gray-600">{k}</td>
                      <td className="py-1 text-gray-800">
                        {Array.isArray(v) ? v.join(', ') : String(v)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        }
      } catch {
        // Not valid JSON, continue with regular string handling
      }
    }

    // Handle objects (like attrs)
    if (typeof value === 'object' && value !== null) {
      if (Array.isArray(value)) {
        return <span className="text-sm">{value.join(', ')}</span>;
      }

      // Render object as simple table
      return (
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <tbody>
              {Object.entries(value).map(([k, v]) => (
                <tr key={k} className="border-b border-gray-200">
                  <td className="py-1 pr-2 font-medium text-gray-600">{k}</td>
                  <td className="py-1 text-gray-800">
                    {Array.isArray(v) ? v.join(', ') : String(v)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }

    // Handle regular strings/numbers
    return <span className="text-sm text-gray-700">{String(value)}</span>;
  };

  // Get all image URLs for display
  const allImageUrls = imageUrls?.imageUrls || [];
  const fallbackImageUrl = imageUrls?.fallbackUrl;
  const displayImageUrls = allImageUrls.length > 0 ? allImageUrls : (fallbackImageUrl ? [fallbackImageUrl] : []);

  return (
    <div className="space-y-3">
      {/* Show Image URLs */}
      {displayImageUrls.length > 0 && (
        <div>
          <Label className="block mb-1 font-semibold text-sm">Image URLs</Label>
          <div className="space-y-1">
            {displayImageUrls.map((url, index) => (
              <a
                key={index}
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-blue-600 hover:text-blue-800 underline font-mono break-all block"
              >
                {`Image ${index + 1}: ${url}`}
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Show other fields */}
      {Object.entries(data)
        .filter(([key]) => key !== 'image_urls') // Handle images separately
        .map(([key, value]) => {
          const renderedValue = renderFieldValue(key, value);
          if (renderedValue === null) return null;

          return (
            <div key={key}>
              <Label className="block mb-1 font-semibold text-sm capitalize">
                {key.replace(/_/g, ' ')}
              </Label>
              {renderedValue}
            </div>
          );
        })}
    </div>
  );
}