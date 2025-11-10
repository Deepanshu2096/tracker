import React, { useState, useRef } from 'react';
import { Upload, FileText, Link, X, AlertCircle, CheckCircle, Loader2 } from 'lucide-react';
import { Button } from './button';
import { Input } from './input';
import { Label } from './label';
import { Alert, AlertDescription } from './alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './tabs';
import { 
  type FileSource, 
  type FileSourceConfig, 
  validateFileSource, 
  detectFileSource 
} from '@/lib/fileIngestion';

interface FileUploadProps {
  onFileSelect: (config: FileSourceConfig) => void;
  onValidationChange?: (isValid: boolean, error?: string) => void;
  disabled?: boolean;
  className?: string;
}

export function FileUpload({ 
  onFileSelect, 
  onValidationChange, 
  disabled = false,
  className = '' 
}: FileUploadProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileUrl, setFileUrl] = useState('');
  const [validationState, setValidationState] = useState<{
    isValid: boolean;
    error?: string;
    loading: boolean;
  }>({ isValid: false, loading: false });
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (file: File) => {
    setSelectedFile(file);
    setFileUrl('');
    
    const config: FileSourceConfig = { source: 'local', file };
    onFileSelect(config);
    
    // Validate the file
    setValidationState({ isValid: false, loading: true });
    const validation = await validateFileSource(config);
    setValidationState({ 
      isValid: validation.isValid, 
      error: validation.error, 
      loading: false 
    });
    
    onValidationChange?.(validation.isValid, validation.error);
  };

  const handleUrlChange = async (url: string) => {
    setFileUrl(url);
    setSelectedFile(null);
    
    if (!url.trim()) {
      setValidationState({ isValid: false, loading: false });
      onValidationChange?.(false);
      return;
    }
    
    const source = detectFileSource(url);
    const config: FileSourceConfig = { source, url };
    onFileSelect(config);
    
    // Validate the URL
    setValidationState({ isValid: false, loading: true });
    const validation = await validateFileSource(config);
    setValidationState({ 
      isValid: validation.isValid, 
      error: validation.error, 
      loading: false 
    });
    
    onValidationChange?.(validation.isValid, validation.error);
  };

  const handleFileInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const clearSelection = () => {
    setSelectedFile(null);
    setFileUrl('');
    setValidationState({ isValid: false, loading: false });
    onValidationChange?.(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className={`space-y-4 ${className}`}>
      <Tabs defaultValue="file" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="file" disabled={disabled}>
            <FileText className="w-4 h-4 mr-2" />
            Upload File
          </TabsTrigger>
          <TabsTrigger value="url" disabled={disabled}>
            <Link className="w-4 h-4 mr-2" />
            File URL
          </TabsTrigger>
        </TabsList>

        <TabsContent value="file" className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="file-upload">Select File</Label>
            <div className="flex items-center space-x-2">
              <Input
                id="file-upload"
                type="file"
                accept=".csv,.xlsx,.xls"
                onChange={handleFileInputChange}
                ref={fileInputRef}
                disabled={disabled}
                className="flex-1"
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                disabled={disabled}
              >
                <Upload className="w-4 h-4 mr-2" />
                Browse
              </Button>
            </div>
            <p className="text-sm text-gray-500">
              Supported formats: CSV, Excel (.xlsx, .xls)
            </p>
          </div>

          {selectedFile && (
            <div className="p-4 border rounded-lg bg-gray-50">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <FileText className="w-5 h-5 text-blue-500" />
                  <div>
                    <p className="font-medium text-gray-900">{selectedFile.name}</p>
                    <p className="text-sm text-gray-500">
                      {formatFileSize(selectedFile.size)}
                    </p>
                  </div>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={clearSelection}
                  disabled={disabled}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="url" className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="file-url">File URL or Google Sheets Link</Label>
            <Input
              id="file-url"
              type="url"
              placeholder="https://example.com/file.csv or https://docs.google.com/spreadsheets/d/..."
              value={fileUrl}
              onChange={(e) => handleUrlChange(e.target.value)}
              disabled={disabled}
            />
            <p className="text-sm text-gray-500">
              Enter a direct file URL or Google Sheets link
            </p>
          </div>

          {fileUrl && (
            <div className="p-4 border rounded-lg bg-gray-50">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <Link className="w-5 h-5 text-blue-500" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 truncate">{fileUrl}</p>
                    <p className="text-sm text-gray-500">
                      {detectFileSource(fileUrl) === 'google-sheets' ? 'Google Sheets' : 'File URL'}
                    </p>
                  </div>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={clearSelection}
                  disabled={disabled}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Validation Status */}
      {validationState.loading && (
        <Alert>
          <Loader2 className="h-4 w-4 animate-spin" />
          <AlertDescription>Validating file...</AlertDescription>
        </Alert>
      )}

      {!validationState.loading && validationState.error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{validationState.error}</AlertDescription>
        </Alert>
      )}

      {!validationState.loading && validationState.isValid && (
        <Alert className="border-green-200 bg-green-50">
          <CheckCircle className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-800">
            File is valid and ready to process
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
