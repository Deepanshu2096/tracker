import { supabase } from '../../integrations/supabase/client';
import { type FileUploadResult } from './types';

/**
 * Uploads a file to Supabase storage
 */
export async function uploadFileToStorage(
  file: File,
  orgId: string,
  batchId: string
): Promise<FileUploadResult> {
  try {
    // Create the file path: batchfiles/org_name_<id>/batch_<id>_<timestamp>.<extension>
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const fileExtension = getFileExtension(file.name);
    const fileName = `batch_${batchId}_${timestamp}${fileExtension}`;
    const filePath = `batchfiles/org${orgId}/${fileName}`;
    
    // Upload file to Supabase storage
    const { data, error } = await supabase.storage
      .from('batchfiles')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false
      });
    
    if (error) {
      console.error('Storage upload error:', error);
      return {
        success: false,
        error: `Failed to upload file: ${error.message}`
      };
    }
    
    // Get the public URL
    const { data: urlData } = supabase.storage
      .from('batchfiles')
      .getPublicUrl(filePath);
    
    return {
      success: true,
      fileUrl: urlData.publicUrl
    };
  } catch (error) {
    console.error('File upload error:', error);
    return {
      success: false,
      error: `Upload failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }
}

/**
 * Uploads a file from URL to Supabase storage
 */
export async function uploadFileFromUrl(
  url: string,
  orgId: string,
  batchId: string,
  fileName?: string
): Promise<FileUploadResult> {
  try {
    // Fetch the file from URL
    const response = await fetch(url);
    if (!response.ok) {
      return {
        success: false,
        error: `Failed to fetch file from URL: ${response.statusText}`
      };
    }
    
    // Get file content as blob
    const blob = await response.blob();
    
    // Create file object
    const originalFileName = fileName || getFileNameFromUrl(url) || 'downloaded_file';
    const file = new File([blob], originalFileName, { type: blob.type });
    
    // Upload to storage
    return await uploadFileToStorage(file, orgId, batchId);
  } catch (error) {
    console.error('URL file upload error:', error);
    return {
      success: false,
      error: `Failed to upload file from URL: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }
}

/**
 * Validates if a URL is accessible
 */
export async function validateFileUrl(url: string): Promise<{ isValid: boolean; error?: string }> {
  try {
    const response = await fetch(url, { method: 'HEAD' });
    
    if (!response.ok) {
      return {
        isValid: false,
        error: `URL is not accessible: ${response.statusText}`
      };
    }
    
    // Check if it's a supported file type
    const contentType = response.headers.get('content-type');
    const fileName = getFileNameFromUrl(url);
    
    if (isSupportedFileType(contentType, fileName)) {
      return { isValid: true };
    } else {
      return {
        isValid: false,
        error: 'File type not supported'
      };
    }
  } catch (error) {
    return {
      isValid: false,
      error: `Failed to validate URL: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }
}

/**
 * Validates if a Google Sheets URL is accessible
 */
export async function validateGoogleSheetsUrl(url: string): Promise<{ isValid: boolean; error?: string }> {
  try {
    const sheetId = extractGoogleSheetId(url);
    if (!sheetId) {
      return {
        isValid: false,
        error: 'Invalid Google Sheets URL format'
      };
    }
    
    // Test if the sheet is accessible by trying to export as CSV
    const csvUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv`;
    const response = await fetch(csvUrl);
    
    if (!response.ok) {
      return {
        isValid: false,
        error: `Google Sheet is not accessible: ${response.statusText}`
      };
    }
    
    return { isValid: true };
  } catch (error) {
    return {
      isValid: false,
      error: `Failed to validate Google Sheets URL: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }
}

/**
 * Deletes a file from Supabase storage
 */
export async function deleteFileFromStorage(fileUrl: string): Promise<{ success: boolean; error?: string }> {
  try {
    // Extract file path from URL
    const filePath = extractFilePathFromUrl(fileUrl);
    if (!filePath) {
      return {
        success: false,
        error: 'Invalid file URL'
      };
    }
    
    const { error } = await supabase.storage
      .from('batchfiles')
      .remove([filePath]);
    
    if (error) {
      return {
        success: false,
        error: `Failed to delete file: ${error.message}`
      };
    }
    
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: `Delete failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }
}

// Utility functions

function getFileExtension(filename: string): string {
  const lastDotIndex = filename.lastIndexOf('.');
  return lastDotIndex !== -1 ? filename.substring(lastDotIndex).toLowerCase() : '';
}

function getFileNameFromUrl(url: string): string {
  try {
    const urlObj = new URL(url);
    const pathname = urlObj.pathname;
    const lastSlashIndex = pathname.lastIndexOf('/');
    return lastSlashIndex !== -1 ? pathname.substring(lastSlashIndex + 1) : '';
  } catch {
    return '';
  }
}

function extractGoogleSheetId(url: string): string | null {
  const patterns = [
    /\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/,
    /\/d\/([a-zA-Z0-9-_]+)/,
    /id=([a-zA-Z0-9-_]+)/
  ];
  
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) {
      return match[1];
    }
  }
  
  return null;
}

function isSupportedFileType(contentType: string | null, fileName: string): boolean {
  const supportedMimeTypes = [
    'text/csv',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel'
  ];
  
  const supportedExtensions = ['.csv', '.xlsx', '.xls'];
  
  // Check MIME type
  if (contentType && supportedMimeTypes.some(type => contentType.includes(type))) {
    return true;
  }
  
  // Check file extension
  const extension = getFileExtension(fileName);
  return supportedExtensions.includes(extension);
}

function extractFilePathFromUrl(fileUrl: string): string | null {
  try {
    const url = new URL(fileUrl);
    // Extract path after the bucket name
    const pathMatch = url.pathname.match(/\/storage\/v1\/object\/public\/[^\/]+\/(.+)/);
    return pathMatch ? decodeURIComponent(pathMatch[1]) : null;
  } catch {
    return null;
  }
}
