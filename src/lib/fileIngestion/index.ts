// Main exports
export { processBatchFile, validateFileSource, detectFileSource, createFileSourceConfig } from './batchFileProcessor';

// Individual module exports
export { parseFile } from './fileParser';
export { validateFileWithTaskTemplate, validateHeaders, validateRow, validateFileSize } from './fileValidation';
export { 
  uploadFileToStorage, 
  uploadFileFromUrl, 
  validateFileUrl, 
  validateGoogleSheetsUrl,
  deleteFileFromStorage 
} from './fileStorage';
export { 
  createTasksFromFileData, 
  createSingleTask, 
  getTasksByBatchId, 
  deleteTasksByBatchId 
} from './taskCreator';

// Task Assignment helpers
export {
  getExistingTaskCounts,
  calculateTaskDistribution,
  assignTasksToAnnotators,
  getAnnotatorWorkloadSummary
} from '../taskAssignment/taskAssignmentHelper';
export type {
  AnnotatorTaskCount,
  TaskAssignment
} from '../taskAssignment/taskAssignmentHelper';

// Types
export type {
  FileValidationSchema,
  FileValidationResult,
  ParsedRow,
  FileParseResult,
  FileUploadResult,
  TaskCreationData,
  BatchFileProcessingResult,
  FileSource,
  FileSourceConfig,
  TaskTemplate,
} from './types';

// Constants
export { FILE_PROCESSING_CONFIG } from './types';
