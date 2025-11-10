import * as XLSX from 'xlsx';
import Papa from 'papaparse';
import type { ParsedRow, FileParseResult, FileSourceConfig } from './types';

/**
 * Parses a local file (CSV or Excel)
 */
export async function parseLocalFile(file: File): Promise<FileParseResult> {
  try {
    const fileExtension = getFileExtension(file.name);
    
    if (fileExtension === '.csv') {
      return parseCSVFile(file);
    } else if (fileExtension === '.xlsx' || fileExtension === '.xls') {
      return parseExcelFile(file);
    } else {
      return {
        success: false,
        data: [],
        errors: [`Unsupported file type: ${fileExtension}`],
        warnings: [],
        totalRows: 0,
        validRows: 0
      };
    }
  } catch (error) {
    return {
      success: false,
      data: [],
      errors: [`Failed to parse file: ${error instanceof Error ? error.message : 'Unknown error'}`],
      warnings: [],
      totalRows: 0,
      validRows: 0
    };
  }
}

/**
 * Parses a CSV file using PapaParse
 */
function parseCSVFile(file: File): Promise<FileParseResult> {
  return new Promise((resolve) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        if (results.errors.length > 0) {
          resolve({
            success: false,
            data: [],
            errors: results.errors.map(error => `Row ${error.row}: ${error.message}`),
            warnings: [],
            totalRows: 0,
            validRows: 0
          });
        } else {
          const data = results.data as ParsedRow[];
          resolve({
            success: true,
            data,
            errors: [],
            warnings: [],
            totalRows: data.length,
            validRows: data.length
          });
        }
      },
      error: (error) => {
        resolve({
          success: false,
          data: [],
          errors: [`CSV parsing error: ${error.message}`],
          warnings: [],
          totalRows: 0,
          validRows: 0
        });
      }
    });
  });
}

/**
 * Parses an Excel file using SheetJS
 */
async function parseExcelFile(file: File): Promise<FileParseResult> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const workbook = XLSX.read(arrayBuffer, { type: 'array' });
    
    // Get the first sheet
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    
    // Convert to JSON with defval to preserve empty cells
    const data = XLSX.utils.sheet_to_json(worksheet, { 
      defval: '', // Preserve empty cells as empty strings instead of skipping them
      raw: false  // Convert all values to strings for consistency
    }) as ParsedRow[];
    console.log('data', data);
    
    // Log the headers to verify all columns are preserved
    if (data.length > 0) {
      console.log('Headers found in Excel file:', Object.keys(data[0]));
    }
    
    return {
      success: true,
      data,
      errors: [],
      warnings: [],
      totalRows: data.length,
      validRows: data.length
    };
  } catch (error) {
    return {
      success: false,
      data: [],
      errors: [`Excel parsing error: ${error instanceof Error ? error.message : 'Unknown error'}`],
      warnings: [],
      totalRows: 0,
      validRows: 0
    };
  }
}

/**
 * Parses a Google Sheets URL
 */
export async function parseGoogleSheets(url: string): Promise<FileParseResult> {
  try {
    const sheetId = extractGoogleSheetId(url);
    if (!sheetId) {
      return {
        success: false,
        data: [],
        errors: ['Invalid Google Sheets URL'],
        warnings: [],
        totalRows: 0,
        validRows: 0
      };
    }
    
    // Convert Google Sheets to CSV format
    const csvUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv`;
    
    const response = await fetch(csvUrl);
    if (!response.ok) {
      return {
        success: false,
        data: [],
        errors: [`Failed to fetch Google Sheet: ${response.statusText}`],
        warnings: [],
        totalRows: 0,
        validRows: 0
      };
    }
    
    const csvText = await response.text();
    
    // Parse CSV text
    return new Promise((resolve) => {
      Papa.parse(csvText, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          if (results.errors.length > 0) {
            resolve({
              success: false,
              data: [],
              errors: results.errors.map(error => `Row ${error.row}: ${error.message}`),
              warnings: [],
              totalRows: 0,
              validRows: 0
            });
          } else {
            const data = results.data as ParsedRow[];
            resolve({
              success: true,
              data,
              errors: [],
              warnings: [],
              totalRows: data.length,
              validRows: data.length
            });
          }
        },
        error: (error: any) => {
          resolve({
            success: false,
            data: [],
            errors: [`Google Sheets parsing error: ${error.message}`],
            warnings: [],
            totalRows: 0,
            validRows: 0
          });
        }
      });
    });
  } catch (error) {
    return {
      success: false,
      data: [],
      errors: [`Google Sheets error: ${error instanceof Error ? error.message : 'Unknown error'}`],
      warnings: [],
      totalRows: 0,
      validRows: 0
    };
  }
}

/**
 * Parses a file from a URL
 */
export async function parseFileFromUrl(url: string): Promise<FileParseResult> {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      return {
        success: false,
        data: [],
        errors: [`Failed to fetch file: ${response.statusText}`],
        warnings: [],
        totalRows: 0,
        validRows: 0
      };
    }
    
    const contentType = response.headers.get('content-type');
    const fileName = getFileNameFromUrl(url);
    
    if (contentType?.includes('text/csv') || fileName.endsWith('.csv')) {
      const csvText = await response.text();
      return parseCSVText(csvText);
    } else if (contentType?.includes('spreadsheet') || fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
      const arrayBuffer = await response.arrayBuffer();
      return parseExcelBuffer(arrayBuffer);
    } else {
      return {
        success: false,
        data: [],
        errors: ['Unsupported file type from URL'],
        warnings: [],
        totalRows: 0,
        validRows: 0
      };
    }
  } catch (error) {
    return {
      success: false,
      data: [],
      errors: [`URL parsing error: ${error instanceof Error ? error.message : 'Unknown error'}`],
      warnings: [],
      totalRows: 0,
      validRows: 0
    };
  }
}

/**
 * Parses CSV text
 */
function parseCSVText(csvText: string): Promise<FileParseResult> {
  return new Promise((resolve) => {
    Papa.parse(csvText, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        if (results.errors.length > 0) {
          resolve({
            success: false,
            data: [],
            errors: results.errors.map(error => `Row ${error.row}: ${error.message}`),
            warnings: [],
            totalRows: 0,
            validRows: 0
          });
        } else {
          const data = results.data as ParsedRow[];
          resolve({
            success: true,
            data,
            errors: [],
            warnings: [],
            totalRows: data.length,
            validRows: data.length
          });
        }
      },
      error: (error: any) => {
        resolve({
          success: false,
          data: [],
          errors: [`CSV parsing error: ${error.message}`],
          warnings: [],
          totalRows: 0,
          validRows: 0
        });
      }
    });
  });
}

/**
 * Parses Excel buffer
 */
function parseExcelBuffer(arrayBuffer: ArrayBuffer): FileParseResult {
  try {
    const workbook = XLSX.read(arrayBuffer, { type: 'array' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(worksheet, { 
      defval: '', // Preserve empty cells as empty strings instead of skipping them
      raw: false  // Convert all values to strings for consistency
    }) as ParsedRow[];
    
    // Log the headers to verify all columns are preserved
    if (data.length > 0) {
      console.log('Headers found in Excel buffer:', Object.keys(data[0]));
    }
    
    return {
      success: true,
      data,
      errors: [],
      warnings: [],
      totalRows: data.length,
      validRows: data.length
    };
  } catch (error) {
    return {
      success: false,
      data: [],
      errors: [`Excel parsing error: ${error instanceof Error ? error.message : 'Unknown error'}`],
      warnings: [],
      totalRows: 0,
      validRows: 0
    };
  }
}

/**
 * Main parsing function that handles different file sources
 */
export async function parseFile(config: FileSourceConfig): Promise<FileParseResult> {
  switch (config.source) {
    case 'local':
      if (!config.file) {
        return {
          success: false,
          data: [],
          errors: ['No file provided for local parsing'],
          warnings: [],
          totalRows: 0,
          validRows: 0
        };
      }
      return parseLocalFile(config.file);
      
    case 'google-sheets':
      if (!config.url) {
        return {
          success: false,
          data: [],
          errors: ['No URL provided for Google Sheets parsing'],
          warnings: [],
          totalRows: 0,
          validRows: 0
        };
      }
      return parseGoogleSheets(config.url);
      
    case 'url':
      if (!config.url) {
        return {
          success: false,
          data: [],
          errors: ['No URL provided for file parsing'],
          warnings: [],
          totalRows: 0,
          validRows: 0
        };
      }
      return parseFileFromUrl(config.url);
      
    default:
      return {
        success: false,
        data: [],
        errors: [`Unsupported file source: ${config.source}`],
        warnings: [],
        totalRows: 0,
        validRows: 0
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
