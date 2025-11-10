import {
  type FileValidationSchema,
  type FileValidationResult,
  type ParsedRow,
  type TaskTemplate,
  FILE_PROCESSING_CONFIG
} from './types';

/**
 * Validates file headers against the expected schema
 */
export function validateHeaders(
  headers: string[], 
  schema: FileValidationSchema[]
): { isValid: boolean; errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  // Get required field names from schema
  const requiredFields = schema
    .filter(field => field.required !== false)
    .map(field => field.name);
  
  // Check for missing required headers
  const missingHeaders = requiredFields.filter(
    requiredField => !headers.includes(requiredField)
  );
  
  if (missingHeaders.length > 0) {
    errors.push(`Missing required headers: ${missingHeaders.join(', ')}`);
  }
  
  // Check for extra headers (warnings only)
  const schemaFieldNames = schema.map(field => field.name);
  const extraHeaders = headers.filter(header => !schemaFieldNames.includes(header));
  
  if (extraHeaders.length > 0) {
    warnings.push(`Extra headers found (will be ignored): ${extraHeaders.join(', ')}`);
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Validates a single row against the schema
 */
export function validateRow(
  row: ParsedRow, 
  schema: FileValidationSchema[], 
  rowIndex: number
): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  for (const fieldSchema of schema) {
    const value = row[fieldSchema.name];
    
    // Skip validation for non-required fields that are empty
    if (!fieldSchema.required && (value === undefined || value === null || value === '')) {
      continue;
    }
    
    // Check if required field is missing
    if (fieldSchema.required && (value === undefined || value === null || value === '')) {
      errors.push(`Row ${rowIndex + 1}: Missing required field '${fieldSchema.name}'`);
      continue;
    }
    
    // Type validation
    if (!validateFieldType(value, fieldSchema)) {
      errors.push(`Row ${rowIndex + 1}: Invalid type for field '${fieldSchema.name}'`);
      continue;
    }
    
    // Custom validation rules
    if (fieldSchema.validation) {
      const validationErrors = validateFieldRules(value, fieldSchema, rowIndex);
      errors.push(...validationErrors);
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Validates field type according to schema
 */
function validateFieldType(value: any, schema: FileValidationSchema): boolean {
  switch (schema.type) {
    case 'string':
      return typeof value === 'string';
    case 'number':
      return typeof value === 'number' && !isNaN(value);
    case 'boolean':
      return typeof value === 'boolean';
    case 'object':
      return typeof value === 'object' && value !== null;
    case 'dropdown':
      return typeof value === 'string' &&
             schema.dropdownOptions?.includes(value) === true;
    case 'image_url':
    case 'resource_url':
      return typeof value === 'string';
    default:
      return true;
  }
}

/**
 * Validates field against custom validation rules
 */
function validateFieldRules(
  value: any, 
  schema: FileValidationSchema, 
  rowIndex: number
): string[] {
  const errors: string[] = [];
  
  if (!schema.validation) {
    return errors;
  }
  
  const validation = schema.validation;
  
  if (typeof value === 'string') {
    if (validation.minLength && value.length < validation.minLength) {
      errors.push(`Row ${rowIndex + 1}: Field '${schema.name}' must be at least ${validation.minLength} characters`);
    }
    
    if (validation.maxLength && value.length > validation.maxLength) {
      errors.push(`Row ${rowIndex + 1}: Field '${schema.name}' must be at most ${validation.maxLength} characters`);
    }
    
    if (validation.pattern && !validation.pattern.test(value)) {
      errors.push(`Row ${rowIndex + 1}: Field '${schema.name}' does not match required pattern`);
    }
  }
  
  if (validation.custom && !validation.custom(value)) {
    errors.push(`Row ${rowIndex + 1}: Field '${schema.name}' failed custom validation`);
  }
  
  return errors;
}

/**
 * Validates file size (row count)
 */
export function validateFileSize(rowCount: number): { isValid: boolean; error?: string } {
  if (rowCount > FILE_PROCESSING_CONFIG.MAX_ROWS) {
    return {
      isValid: false,
      error: `File contains ${rowCount} rows, which exceeds the maximum limit of ${FILE_PROCESSING_CONFIG.MAX_ROWS} rows`
    };
  }
  
  if (rowCount === 0) {
    return {
      isValid: false,
      error: 'File contains no data rows'
    };
  }
  
  return { isValid: true };
}

/**
 * Validates file against task template (task template is required)
 */
export function validateFileWithTaskTemplate(
  headers: string[],
  data: ParsedRow[],
  taskTemplate: TaskTemplate
): FileValidationResult {
  // Handle input/output structure
  if (taskTemplate.inputs && taskTemplate.outputs) {
    return validateFileWithInputOutput(headers, data, taskTemplate);
  }

  // Return error if task template structure is invalid
  return {
    isValid: false,
    errors: ['Task template does not have valid inputs/outputs structure'],
    warnings: [],
    headers,
    rowCount: data.length
  };
}

/**
 * Validates a single cell value against a schema
 */
function validateCell(
  value: any, 
  schema: FileValidationSchema, 
  rowIndex: number, 
  columnName: string
): { isValid: boolean; errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  if (!schema.required && (value === undefined || value === null || value === '')) {
    return { isValid: true, errors, warnings };
  }
  
  if (schema.required && (value === undefined || value === null || value === '')) {
    errors.push(`Row ${rowIndex}: Missing required field '${columnName}'`);
    return { isValid: false, errors, warnings };
  }
  
  if (value !== undefined && value !== null && value !== '') {
    if (!validateFieldType(value, schema)) {
      errors.push(`Row ${rowIndex}: Invalid type for field '${columnName}'. Expected ${schema.type}, got ${typeof value}`);
    }
    
    const rulesErrors = validateFieldRules(value, schema, rowIndex);
    if (rulesErrors.length > 0) {
      errors.push(...rulesErrors);
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Validates file with separate input and output column definitions
 */
export function validateFileWithInputOutput(
  headers: string[], 
  data: ParsedRow[], 
  taskTemplate: TaskTemplate
): FileValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  const inputNames = taskTemplate.inputs.map(input => input.name);
  const outputNames = taskTemplate.outputs.map(output => output.name);
  const allExpectedColumns = [...inputNames, ...outputNames];
  
  const missingColumns = allExpectedColumns.filter(colName => !headers.includes(colName));
  if (missingColumns.length > 0) {
    errors.push(`Missing required columns: ${missingColumns.join(', ')}`);
  }
  
  const extraColumns = headers.filter(header => !allExpectedColumns.includes(header));
  if (extraColumns.length > 0) {
    warnings.push(`Extra columns found (will be ignored): ${extraColumns.join(', ')}`);
  }
  
  for (const inputSchema of taskTemplate.inputs) {
    if (!headers.includes(inputSchema.name)) continue;
    
    for (let rowIndex = 0; rowIndex < data.length; rowIndex++) {
      const cellValue = data[rowIndex][inputSchema.name];
      const cellValidation = validateCell(cellValue, inputSchema, rowIndex + 1, inputSchema.name);
      
      if (!cellValidation.isValid) {
        errors.push(...cellValidation.errors);
      }
      if (cellValidation.warnings.length > 0) {
        warnings.push(...cellValidation.warnings);
      }
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    rowCount: data.length,
    columnCount: headers.length
  };
}

