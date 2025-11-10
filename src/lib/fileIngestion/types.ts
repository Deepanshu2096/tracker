// File ingestion types and interfaces

export interface FileValidationSchema {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'object' | 'dropdown' | 'image_url' | 'resource_url';
  required?: boolean;
  description?: string;
  dropdownOptions?: string[];
  validation?: {
    minLength?: number;
    maxLength?: number;
    pattern?: RegExp;
    custom?: (value: any) => boolean;
  };
}

// Column definition for output columns (simpler, only name validation)
export interface OutputColumnDefinition {
  name: string;
  description?: string;
}

// Task Template types with input/output separation
export interface TaskTemplate {
  inputs: FileValidationSchema[];
  outputs: OutputColumnDefinition[];
  delimiter?: string;
  hasHeader?: boolean;
  encoding?: string;
  skipEmptyLines?: boolean;
}


export interface FileValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  headers: string[];
  rowCount: number;
}

export interface ParsedRow {
  [key: string]: any;
}

export interface FileParseResult {
  success: boolean;
  data: ParsedRow[];
  errors: string[];
  warnings: string[];
  totalRows: number;
  validRows: number;
}

export interface FileUploadResult {
  success: boolean;
  fileUrl?: string;
  error?: string;
}

export interface TaskCreationData {
  batch_id: string;
  created_by: string;
  org_id: string;
  required_annotations: number;
  type: string;
  task_data: any;
  assigned_user?: string | null;
}

export interface BatchFileProcessingResult {
  success: boolean;
  tasksCreated: number;
  errors: string[];
  warnings: string[];
  fileUrl?: string;
}

export type FileSource = 'local' | 'google-sheets' | 'url';

export interface FileSourceConfig {
  source: FileSource;
  file?: File;
  url?: string;
  googleSheetId?: string;
}


// Configuration constants
export const FILE_PROCESSING_CONFIG = {
  MAX_ROWS: 10000,
  BATCH_SIZE: 100, // Number of tasks to create in a single batch
  SUPPORTED_FILE_TYPES: ['.csv', '.xlsx', '.xls'],
  SUPPORTED_MIME_TYPES: [
    'text/csv',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel',
  ],
} as const;
