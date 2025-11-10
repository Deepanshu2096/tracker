import React, { useState, useEffect, useRef } from 'react';
import { Button } from './button';
import { Input } from './input';
import { Label } from './label';
import { Textarea } from './textarea';
import { Alert, AlertDescription } from './alert';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from './sheet';
import { Card, CardContent, CardHeader, CardTitle } from './card';
import { Badge } from './badge';
import { 
  Settings, 
  Plus, 
  Trash2, 
  Check, 
  X, 
  AlertCircle, 
  FileText, 
  Upload,
  Download
} from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './select';
import { Checkbox } from './checkbox';
import type { TaskTemplate, FileValidationSchema, OutputColumnDefinition } from '@/lib/fileIngestion/types';

interface TaskTemplateEditorProps {
  projectId: string;
  projectName: string;
  initialTemplate?: TaskTemplate | null;
  onSave: (template: TaskTemplate | null, versionName?: string) => Promise<void>;
  disabled?: boolean;
  inline?: boolean;
}

export function TaskTemplateEditor({
  projectId,
  projectName,
  initialTemplate,
  onSave,
  disabled = false,
  inline = false
}: TaskTemplateEditorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const renderCount = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const getDefaultTemplate = (): TaskTemplate => ({
    inputs: [],
    outputs: [],
    delimiter: ',',
    hasHeader: true,
    encoding: 'utf-8',
    skipEmptyLines: true
  });


  const [template, setTemplate] = useState<TaskTemplate>(getDefaultTemplate());
  const [jsonInput, setJsonInput] = useState('');
  const [editMode, setEditMode] = useState<'visual' | 'json'>('visual');
  const [validationError, setValidationError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [versionName, setVersionName] = useState<string>('');


  const isFirstRender = useRef(true);

  useEffect(() => {
    // Always initialize on first render
    if (isFirstRender.current) {
      isFirstRender.current = false;
    } else if (inline) {
      // In inline mode after first render, don't reset state to avoid feedback loop
      return;
    }

    if (initialTemplate) {
      setTemplate(initialTemplate);
      setJsonInput(JSON.stringify(initialTemplate, null, 2));
    } else {
      const defaultTemplate = getDefaultTemplate();
      setTemplate(defaultTemplate);
      setJsonInput(JSON.stringify(defaultTemplate, null, 2));
    }
  }, [initialTemplate, inline]);

  const validateTemplate = (templateToValidate: TaskTemplate): string | null => {
    if (!templateToValidate.inputs || !Array.isArray(templateToValidate.inputs)) {
      return 'Input columns must be an array';
    }

    if (!templateToValidate.outputs || !Array.isArray(templateToValidate.outputs)) {
      return 'Output columns must be an array';
    }

    for (let i = 0; i < templateToValidate.inputs.length; i++) {
      const col = templateToValidate.inputs[i];
      if (!col.name || typeof col.name !== 'string') {
        return `Input column ${i + 1}: Name is required and must be a string`;
      }
      if (!col.type || !['string', 'number', 'boolean', 'object', 'dropdown', 'image_url', 'resource_url'].includes(col.type)) {
        return `Input column ${i + 1}: Invalid type. Must be one of: string, number, boolean, object, dropdown, image_url, resource_url`;
      }
      if (col.type === 'dropdown' && (!col.dropdownOptions || !Array.isArray(col.dropdownOptions) || col.dropdownOptions.length === 0)) {
        return `Input column ${i + 1}: Dropdown options are required for dropdown type`;
      }
    }

    for (let i = 0; i < templateToValidate.outputs.length; i++) {
      const col = templateToValidate.outputs[i];
      if (!col.name || typeof col.name !== 'string') {
        return `Output column ${i + 1}: Name is required and must be a string`;
      }
    }

    const inputNames = templateToValidate.inputs.map(col => col.name);
    const outputNames = templateToValidate.outputs.map(col => col.name);
    const allNames = [...inputNames, ...outputNames];
    const uniqueNames = new Set(allNames);
    if (allNames.length !== uniqueNames.size) {
      return 'Duplicate column names are not allowed across inputs and outputs';
    }

    return null;
  };

  const handleJsonChange = (value: string) => {
    setJsonInput(value);
    setValidationError(null);
    
    try {
      const parsed = JSON.parse(value);
      const error = validateTemplate(parsed);
      if (error) {
        setValidationError(error);
      } else {
        setTemplate(parsed);
        // Auto-save in inline mode (no version name needed for inline mode)
        if (inline) {
          onSave(parsed);
        }
      }
    } catch (e) {
      setValidationError('Invalid JSON format');
    }
  };

  const getDefaultDescription = (type: string): string => {
    switch (type) {
      case 'string': return 'Text data field';
      case 'number': return 'Numeric value field';
      case 'boolean': return 'True/false value field';
      case 'object': return 'JSON object field';
      case 'dropdown': return 'Select from predefined options';
      case 'image_url': return 'URL link to an image file';
      case 'resource_url': return 'URL link to a resource file';
      default: return 'Data field';
    }
  };

  const addInputColumn = () => {
    const newColumn: FileValidationSchema = {
      name: `input_${template.inputs.length + 1}`,
      type: 'string',
      required: false,
      description: getDefaultDescription('string')
    };

    const newTemplate = {
      ...template,
      inputs: [...template.inputs, newColumn]
    };

    setTemplate(newTemplate);
    setJsonInput(JSON.stringify(newTemplate, null, 2));

    // Auto-save in inline mode
    if (inline) {
      onSave(newTemplate);
    }
  };

  const addOutputColumn = () => {
    const newColumn: OutputColumnDefinition = {
      name: `output_${template.outputs.length + 1}`,
      description: ''
    };
    
    const newTemplate = {
      ...template,
      outputs: [...template.outputs, newColumn]
    };
    
    setTemplate(newTemplate);
    setJsonInput(JSON.stringify(newTemplate, null, 2));
    
    // Auto-save in inline mode
    if (inline) {
      onSave(newTemplate);
    }
  };

  const removeInputColumn = (index: number) => {
    const newTemplate = {
      ...template,
      inputs: template.inputs.filter((_, i) => i !== index)
    };
    
    setTemplate(newTemplate);
    setJsonInput(JSON.stringify(newTemplate, null, 2));
    
    // Auto-save in inline mode
    if (inline) {
      onSave(newTemplate);
    }
  };

  const removeOutputColumn = (index: number) => {
    const newTemplate = {
      ...template,
      outputs: template.outputs.filter((_, i) => i !== index)
    };
    
    setTemplate(newTemplate);
    setJsonInput(JSON.stringify(newTemplate, null, 2));
    
    // Auto-save in inline mode
    if (inline) {
      onSave(newTemplate);
    }
  };

  const updateInputColumn = (index: number, updates: Partial<FileValidationSchema>) => {
    const newColumns = [...template.inputs];
    newColumns[index] = { ...newColumns[index], ...updates };

    const newTemplate = {
      ...template,
      inputs: newColumns
    };

    setTemplate(newTemplate);
    setJsonInput(JSON.stringify(newTemplate, null, 2));

    // Auto-save in inline mode
    if (inline) {
      onSave(newTemplate);
    }
  };

  const updateOutputColumn = (index: number, updates: Partial<OutputColumnDefinition>) => {
    const newColumns = [...template.outputs];
    newColumns[index] = { ...newColumns[index], ...updates };

    const newTemplate = {
      ...template,
      outputs: newColumns
    };

    setTemplate(newTemplate);
    setJsonInput(JSON.stringify(newTemplate, null, 2));

    // Auto-save in inline mode
    if (inline) {
      onSave(newTemplate);
    }
  };

  const updateGlobalSettings = (updates: Partial<TaskTemplate>) => {
    const newTemplate = { ...template, ...updates };
    setTemplate(newTemplate);
    setJsonInput(JSON.stringify(newTemplate, null, 2));
    
    // Auto-save in inline mode
    if (inline) {
      onSave(newTemplate);
    }
  };

  const handleSave = async () => {
    const error = validateTemplate(template);
    if (error) {
      setValidationError(error);
      return;
    }

    if (!inline && !versionName.trim()) {
      setValidationError('Version name is required');
      return;
    }

    setSaving(true);
    setValidationError(null);

    try {
      await onSave(template, versionName.trim() || undefined);
      setIsOpen(false);
      setVersionName(''); // Reset version name after save
    } catch (error) {
      setValidationError(error instanceof Error ? error.message : 'Failed to save configuration');
    } finally {
      setSaving(false);
    }
  };

  const handleClear = async () => {
    const defaultTemplate = getDefaultTemplate();
    setSaving(true);
    try {
      if (inline) {
        // In inline mode, just reset to default template
        setTemplate(defaultTemplate);
        setJsonInput(JSON.stringify(defaultTemplate, null, 2));
        await onSave(defaultTemplate);
      } else {
        // In sheet mode, clear completely
        await onSave(null);
        setTemplate(defaultTemplate);
        setJsonInput('{}');
        setIsOpen(false);
      }
    } catch (error) {
      setValidationError(error instanceof Error ? error.message : 'Failed to clear configuration');
    } finally {
      setSaving(false);
    }
  };

  const exportConfig = () => {
    const dataStr = JSON.stringify(template, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    const exportFileDefaultName = `${projectName.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_task_template.json`;
    
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
  };

  const hasTemplate = initialTemplate && (
    (initialTemplate.inputs && initialTemplate.inputs.length > 0) ||
    (initialTemplate.outputs && initialTemplate.outputs.length > 0)
  );

  const editorRenderCount = useRef(0);

  // Extract the main editor content into a memoized component to prevent unnecessary re-creation
  const EditorContent = React.useMemo(() => {
    return (
    <div ref={containerRef} className={inline ? "space-y-6" : "space-y-6 pb-6 px-2"}>
      {/* Mode Toggle */}
      <div className="flex items-center space-x-4">
        <Button
          variant={editMode === 'visual' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setEditMode('visual')}
        >
          Visual Editor
        </Button>
        <Button
          variant={editMode === 'json' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setEditMode('json')}
        >
          JSON Editor
        </Button>
        <div className="flex-1" />
        <Button
          variant="ghost"
          size="sm"
          onClick={exportConfig}
          className="text-blue-600 hover:text-blue-700"
        >
          <Download className="w-4 h-4 mr-1" />
          Export
        </Button>
      </div>

      {validationError && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{validationError}</AlertDescription>
        </Alert>
      )}

      {editMode === 'visual' ? (
        <div className="space-y-6">
          {/* Global Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">File Processing Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="delimiter" className="text-sm font-medium">Delimiter</Label>
                  <Select 
                    value={template.delimiter} 
                    onValueChange={(value) => updateGlobalSettings({ delimiter: value })}
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value=",">Comma (,)</SelectItem>
                      <SelectItem value=";">Semicolon (;)</SelectItem>
                      <SelectItem value="\t">Tab</SelectItem>
                      <SelectItem value="|">Pipe (|)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="encoding" className="text-sm font-medium">Encoding</Label>
                  <Select 
                    value={template.encoding} 
                    onValueChange={(value) => updateGlobalSettings({ encoding: value })}
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="utf-8">UTF-8</SelectItem>
                      <SelectItem value="utf-16">UTF-16</SelectItem>
                      <SelectItem value="latin1">Latin-1</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="hasHeader"
                    checked={template.hasHeader}
                    onCheckedChange={(checked) => updateGlobalSettings({ hasHeader: !!checked })}
                  />
                  <Label htmlFor="hasHeader" className="text-sm font-medium cursor-pointer">Has header row</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="skipEmptyLines"
                    checked={template.skipEmptyLines}
                    onCheckedChange={(checked) => updateGlobalSettings({ skipEmptyLines: !!checked })}
                  />
                  <Label htmlFor="skipEmptyLines" className="text-sm font-medium cursor-pointer">Skip empty lines</Label>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Input Columns */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">Input Columns</CardTitle>
                <Button onClick={addInputColumn} size="sm">
                  <Plus className="w-4 h-4 mr-1" />
                  Add Input Column
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {template.inputs.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <FileText className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p>No input columns defined. Click "Add Input Column" to start.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {template.inputs.map((column, index) => (
                    <Card key={index} className="border-gray-200">
                      <CardContent className="p-4">
                        <div className="space-y-4">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-2">
                              <span className="text-sm font-medium text-blue-600">Input {index + 1}</span>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => removeInputColumn(index)}
                              className="text-red-600 hover:text-red-700 h-8 w-8 p-0"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                          
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            <div className="space-y-2">
                              <Label className="text-sm font-medium">Column Name</Label>
                              <Input
                                value={column.name}
                                onChange={(e) => updateInputColumn(index, { name: e.target.value })}
                                placeholder="Enter column name"
                                className="h-9"
                              />
                            </div>
                            <div className="space-y-2">
                              <Label className="text-sm font-medium">Type</Label>
                              <Select
                                value={column.type}
                                onValueChange={(value: FileValidationSchema['type']) =>
                                  updateInputColumn(index, {
                                    type: value,
                                    description: getDefaultDescription(value)
                                  })}
                              >
                                <SelectTrigger className="h-9">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="string">String</SelectItem>
                                  <SelectItem value="number">Number</SelectItem>
                                  <SelectItem value="boolean">Boolean</SelectItem>
                                  <SelectItem value="dropdown">Dropdown</SelectItem>
                                  <SelectItem value="object">Object</SelectItem>
                                  <SelectItem value="image_url">Image URL</SelectItem>
                                  <SelectItem value="resource_url">Resource URL</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="space-y-2">
                              <Label className="text-sm font-medium">Required</Label>
                              <div className="flex items-center h-9">
                                <Checkbox
                                  checked={column.required || false}
                                  onCheckedChange={(checked) => updateInputColumn(index, { required: !!checked })}
                                />
                                <Label className="ml-2 text-sm cursor-pointer" 
                                       onClick={() => updateInputColumn(index, { required: !column.required })}>
                                  Required field
                                </Label>
                              </div>
                            </div>
                          </div>

                          {/* Description field for input columns */}
                          <div className="space-y-2">
                            <Label className="text-sm font-medium">Description (Optional)</Label>
                            <Input
                              value={column.description || ''}
                              onChange={(e) => updateInputColumn(index, { description: e.target.value })}
                              placeholder="Describe this input column"
                              className="h-9"
                            />
                          </div>

                          {column.type === 'dropdown' && (
                            <div className="space-y-2">
                              <Label className="text-sm font-medium">Dropdown Options (comma-separated)</Label>
                              <Input
                                value={column.dropdownOptions?.join(', ') || ''}
                                onChange={(e) => updateInputColumn(index, { 
                                  dropdownOptions: e.target.value.split(',').map(s => s.trim()).filter(Boolean)
                                })}
                                placeholder="Option 1, Option 2, Option 3"
                                className="h-9"
                              />
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Output Columns */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">Output Columns</CardTitle>
                <Button onClick={addOutputColumn} size="sm">
                  <Plus className="w-4 h-4 mr-1" />
                  Add Output Column
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {template.outputs.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <FileText className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p>No output columns defined. Click "Add Output Column" to start.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {template.outputs.map((column, index) => (
                    <Card key={index} className="border-gray-200">
                      <CardContent className="p-4">
                        <div className="space-y-4">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-2">
                              <span className="text-sm font-medium text-green-600">Output {index + 1}</span>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => removeOutputColumn(index)}
                              className="text-red-600 hover:text-red-700 h-8 w-8 p-0"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                          
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <Label className="text-sm font-medium">Column Name</Label>
                              <Input
                                value={column.name}
                                onChange={(e) => updateOutputColumn(index, { name: e.target.value })}
                                placeholder="Enter output column name"
                                className="h-9"
                              />
                            </div>
                            <div className="space-y-2">
                              <Label className="text-sm font-medium">Description (Optional)</Label>
                              <Input
                                value={column.description || ''}
                                onChange={(e) => updateOutputColumn(index, { description: e.target.value })}
                                placeholder="Describe this output column"
                                className="h-9"
                              />
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      ) : (
        <div className="space-y-4">
          <Label htmlFor="jsonEditor">JSON Task Template</Label>
          <Textarea
            id="jsonEditor"
            value={jsonInput}
            onChange={(e) => handleJsonChange(e.target.value)}
            className="min-h-[400px] font-mono text-sm"
            placeholder="Enter task template configuration as JSON..."
          />
          <div className="text-sm text-gray-600">
            <p>Example task template structure:</p>
            <pre className="mt-2 p-2 bg-gray-100 rounded text-xs overflow-x-auto">
{`{
  "inputs": [
    {
      "name": "input_column",
      "type": "string",
      "required": true
    }
  ],
  "outputs": [
    {
      "name": "output_column",
      "description": "Description of output"
    }
  ],
  "delimiter": ",",
  "hasHeader": true,
  "encoding": "utf-8",
  "skipEmptyLines": true
}`}
            </pre>
          </div>
        </div>
      )}

    </div>
    );
  }, [template, editMode, validationError, inline, jsonInput]);

  // Return either inline content or sheet-wrapped content
  if (inline) {
    return EditorContent;
  }

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild>
        <Button 
          variant="outline" 
          size="sm"
          disabled={disabled}
          className={hasTemplate ? "text-green-600 border-green-200 bg-green-50 hover:bg-green-100" : ""}
        >
          <Settings className="w-4 h-4 mr-1" />
          {hasTemplate ? 'Edit Task Template' : 'Set Task Template'}
        </Button>
      </SheetTrigger>
      <SheetContent className="w-[95vw] sm:w-[85vw] sm:max-w-none lg:w-[35vw] xl:w-[35vw] overflow-y-auto">
        <SheetHeader className="pb-4 border-b">
          <SheetTitle className="flex items-center space-x-2 text-lg">
            <FileText className="w-5 h-5" />
            <span>Task Template Configuration - {projectName}</span>
          </SheetTitle>
        </SheetHeader>

        <div className="mt-6">
          {EditorContent}
          
          {/* Version Name Input for Sheet mode */}
          {!inline && (
            <div className="mt-6 pt-4 border-t">
              <div className="space-y-2">
                <Label htmlFor="versionName" className="text-sm font-medium">
                  Version Name <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="versionName"
                  value={versionName}
                  onChange={(e) => setVersionName(e.target.value)}
                  placeholder="e.g., v1.0 - Initial Setup, Bug Fix - Validation Rules"
                  className={validationError === 'Version name is required' ? 'border-red-500' : ''}
                />
                <p className="text-xs text-gray-500">
                  Provide a meaningful name to track this template version
                </p>
              </div>
            </div>
          )}
          
          {/* Action Buttons for Sheet mode */}
          <div className="flex justify-between items-center pt-6 border-t bg-gray-50 -mx-8 px-8 py-4 mt-6">
            <Button
              variant="outline"
              onClick={handleClear}
              disabled={saving}
              className="text-red-600 border-red-200 hover:bg-red-50 hover:border-red-300"
            >
              <X className="w-4 h-4 mr-2" />
              Clear Template
            </Button>
            <div className="flex space-x-3">
              <Button
                variant="outline"
                onClick={() => setIsOpen(false)}
                disabled={saving}
                className="min-w-[80px]"
              >
                Cancel
              </Button>
              <Button
                onClick={handleSave}
                disabled={saving || !!validationError || (!inline && !versionName.trim())}
                className="min-w-[120px] bg-blue-600 hover:bg-blue-700"
              >
                {saving ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Saving...
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4 mr-2" />
                    Save Template
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}