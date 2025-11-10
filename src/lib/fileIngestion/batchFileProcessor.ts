import { parseFile } from './fileParser';
import { validateFileWithTaskTemplate } from './fileValidation';
import { uploadFileToStorage, uploadFileFromUrl, validateFileUrl, validateGoogleSheetsUrl } from './fileStorage';
import { createTasksFromFileData } from './taskCreator';
import {
  type FileSourceConfig,
  type BatchFileProcessingResult,
  type TaskTemplate,
  type FileSource,
  type ParsedRow
} from './types';

/**
 * Consolidates image URL fields into a single array
 */
function consolidateImageUrls(
  row: ParsedRow,
  taskTemplate: TaskTemplate
): ParsedRow {
  const imageUrlFields = taskTemplate.inputs
    .filter(input => input.type === 'image_url')
    .map(input => input.name);

  if (imageUrlFields.length === 0) {
    return row;
  }

  const imageUrls: string[] = [];
  const consolidatedRow: ParsedRow = { ...row };

  // Collect all image URLs
  imageUrlFields.forEach(fieldName => {
    const url = row[fieldName];
    if (url && typeof url === 'string' && url.trim()) {
      imageUrls.push(url.trim());
    }
    // Remove individual image URL fields from the row
    delete consolidatedRow[fieldName];
  });

  // Add consolidated image URLs array
  if (imageUrls.length > 0) {
    consolidatedRow.image_urls = imageUrls;
  }

  return consolidatedRow;
}

/**
 * Filters parsed data to only include input columns for task creation
 */
function filterDataForTaskCreation(
  headers: string[],
  data: ParsedRow[],
  taskTemplate: TaskTemplate
): ParsedRow[] {
  if (taskTemplate.inputs && taskTemplate.outputs) {
    const inputColumnNames = taskTemplate.inputs.map(input => input.name);

    return data.map(row => {
      const filteredRow: ParsedRow = {};
      inputColumnNames.forEach(columnName => {
        if (headers.includes(columnName)) {
          filteredRow[columnName] = row[columnName];
        }
      });

      // Consolidate image URLs after filtering
      return consolidateImageUrls(filteredRow, taskTemplate);
    });
  }

  return data;
}

/**
 * Main function to process a batch file and create tasks
 */
export async function processBatchFile(
  config: FileSourceConfig,
  batchId: string,
  createdBy: string,
  orgId: string,
  taskType: string = 'annotation',
  requiredAnnotations: number = 1,
  assignedUser?: string | null,
  taskTemplate?: TaskTemplate | null
): Promise<BatchFileProcessingResult> {
  const errors: string[] = [];
  const warnings: string[] = [];
  let fileUrl: string | undefined;
  
  try {
    // Step 1: Parse the file
    console.log('Step 1: Parsing file...');
    const parseResult = await parseFile(config);
    
    if (!parseResult.success) {
      return {
        success: false,
        tasksCreated: 0,
        errors: parseResult.errors,
        warnings: parseResult.warnings
      };
    }
    
    // Step 2: Validate the file
    console.log('Step 2: Validating file...');

    if (parseResult.data.length === 0) {
      return {
        success: false,
        tasksCreated: 0,
        errors: ['No data found in file'],
        warnings: []
      };
    }

    // Task template is required for validation
    if (!taskTemplate) {
      return {
        success: false,
        tasksCreated: 0,
        errors: ['No task template found for this project. Please configure a task template before uploading files.'],
        warnings: []
      };
    }

    // Extract headers from the first row
    const headers = Object.keys(parseResult.data[0]);

    const validationResult = validateFileWithTaskTemplate(headers, parseResult.data, taskTemplate);
    
    if (!validationResult.isValid) {
      return {
        success: false,
        tasksCreated: 0,
        errors: validationResult.errors,
        warnings: validationResult.warnings
      };
    }
    
    warnings.push(...validationResult.warnings);
    
    // Step 3: Store the file
    console.log('Step 3: Storing file...');
    const storageResult = await storeFile(config, orgId, batchId);
    
    console.log('Storage result:', storageResult);
    
    if (!storageResult.success) {
      console.log('Storage failed:', storageResult.error);
      // Continue without file storage - this is not critical for task creation
      warnings.push(`File storage failed: ${storageResult.error}. Tasks will still be created.`);
    } else {
      fileUrl = storageResult.fileUrl;
    }
    
    const taskData = taskTemplate ? filterDataForTaskCreation(headers, parseResult.data, taskTemplate) : parseResult.data;
    
    const taskResult = await createTasksFromFileData(
      taskData,
      batchId,
      createdBy,
      orgId,
      taskType,
      requiredAnnotations,
      assignedUser
    );
    
    if (!taskResult.success) {
      if (!(taskResult.errors.length === 1 && taskResult.errors[0].includes('Warning'))) {
        errors.push(...taskResult.errors);
      }
     
    }
    
    return {
      success: taskResult.success && errors.length === 0,
      tasksCreated: taskResult.tasksCreated,
      errors,
      warnings,
      fileUrl
    };
    
  } catch (error) {
    console.error('Batch file processing error:', error);
    return {
      success: false,
      tasksCreated: 0,
      errors: [`Processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`],
      warnings
    };
  }
}

/**
 * Validates a file source before processing
 */
export async function validateFileSource(config: FileSourceConfig): Promise<{ isValid: boolean; error?: string }> {
  try {
    switch (config.source) {
      case 'local':
        if (!config.file) {
          return { isValid: false, error: 'No file provided' };
        }
        
        // Check file type
        const fileExtension = getFileExtension(config.file.name);
        const supportedTypes = ['.csv', '.xlsx', '.xls'];
        
        if (!supportedTypes.includes(fileExtension)) {
          return { 
            isValid: false, 
            error: `Unsupported file type: ${fileExtension}. Supported types: ${supportedTypes.join(', ')}` 
          };
        }
        
        // Check file size (optional - you can add size limits here)
        const maxSize = 50 * 1024 * 1024; // 50MB
        if (config.file.size > maxSize) {
          return { 
            isValid: false, 
            error: `File too large: ${(config.file.size / 1024 / 1024).toFixed(2)}MB. Maximum size: ${maxSize / 1024 / 1024}MB` 
          };
        }
        
        return { isValid: true };
        
      case 'google-sheets':
        if (!config.url) {
          return { isValid: false, error: 'No Google Sheets URL provided' };
        }
        
        return await validateGoogleSheetsUrl(config.url);
        
      case 'url':
        if (!config.url) {
          return { isValid: false, error: 'No file URL provided' };
        }
        
        return await validateFileUrl(config.url);
        
      default:
        return { isValid: false, error: `Unsupported file source: ${config.source}` };
    }
  } catch (error) {
    return { 
      isValid: false, 
      error: `Validation failed: ${error instanceof Error ? error.message : 'Unknown error'}` 
    };
  }
}

/**
 * Stores the file based on the source configuration
 */
async function storeFile(
  config: FileSourceConfig, 
  orgId: string, 
  batchId: string
): Promise<{ success: boolean; fileUrl?: string; error?: string }> {
  try {
    switch (config.source) {
      case 'local':
        if (!config.file) {
          return { success: false, error: 'No file provided' };
        }
        return await uploadFileToStorage(config.file, orgId, batchId);
        
      case 'google-sheets':
      case 'url':
        if (!config.url) {
          return { success: false, error: 'No URL provided' };
        }
        return await uploadFileFromUrl(config.url, orgId, batchId);
        
      default:
        return { success: false, error: `Unsupported file source: ${config.source}` };
    }
  } catch (error) {
    return { 
      success: false, 
      error: `File storage failed: ${error instanceof Error ? error.message : 'Unknown error'}` 
    };
  }
}

/**
 * Determines the file source type from a URL
 */
export function detectFileSource(url: string): FileSource {
  if (url.includes('docs.google.com/spreadsheets') || url.includes('sheets.google.com')) {
    return 'google-sheets';
  }
  return 'url';
}

/**
 * Creates a file source configuration from different inputs
 */
export function createFileSourceConfig(
  source: FileSource,
  file?: File,
  url?: string
): FileSourceConfig {
  return {
    source,
    file,
    url,
    googleSheetId: source === 'google-sheets' && url ? extractGoogleSheetId(url) || undefined : undefined
  };
}

// Utility functions

function getFileExtension(filename: string): string {
  const lastDotIndex = filename.lastIndexOf('.');
  return lastDotIndex !== -1 ? filename.substring(lastDotIndex).toLowerCase() : '';
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
