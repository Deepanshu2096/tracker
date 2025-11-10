import * as React from "react"

// Multiple selector component for selecting multiple options
export interface Option {
  label: string
  value: string
}

interface MultipleSelectorProps {
  value: Option[]
  onChange: (value: Option[]) => void
  defaultOptions?: Option[]
  options?: Option[]
  placeholder?: string
  emptyIndicator?: React.ReactNode
  className?: string
}

export function MultipleSelector({
  value = [],
  onChange,
  defaultOptions = [],
  options = [],
  placeholder = "Select items...",
  emptyIndicator,
  className = "",
}: MultipleSelectorProps) {
  // Use options prop if provided, otherwise use defaultOptions
  const availableOptions = options.length > 0 ? options : defaultOptions

  const handleSelect = (option: Option) => {
    const isSelected = value.some(item => item.value === option.value)
    let newValue: Option[]
    
    if (isSelected) {
      newValue = value.filter(item => item.value !== option.value)
    } else {
      newValue = [...value, option]
    }
    
    onChange(newValue)
  }

  const handleRemove = (optionValue: string) => {
    const newValue = value.filter(item => item.value !== optionValue)
    onChange(newValue)
  }

  return (
    <div className={`w-full ${className}`}>
      {/* Selected items display */}
      <div className="min-h-10 p-2 border border-gray-300 rounded-md bg-white">
        <div className="flex flex-wrap gap-1">
          {value.length === 0 ? (
            <span className="text-gray-500 text-sm">{placeholder}</span>
          ) : (
            value.map((option) => (
              <span
                key={option.value}
                className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-blue-100 text-blue-800 mr-1 mb-1"
              >
                {option.label}
                <button
                  className="ml-1 text-blue-600 hover:text-blue-800"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      handleRemove(option.value)
                    }
                  }}
                  onMouseDown={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                  }}
                  onClick={() => handleRemove(option.value)}
                >
                  ×
                </button>
              </span>
            ))
          )}
        </div>
      </div>

      {/* Options list */}
      <div className="mt-2 max-h-60 overflow-auto border border-gray-300 rounded-md bg-white">
        {availableOptions.length === 0 ? (
          <div className="p-4 text-center text-gray-500">
            {emptyIndicator || "No items found."}
          </div>
        ) : (
          <div className="p-2">
            {availableOptions.map((option) => {
              const isSelected = value.some(item => item.value === option.value)
              return (
                <div
                  key={option.value}
                  className="flex items-center space-x-2 p-2 hover:bg-gray-100 rounded-sm cursor-pointer"
                  onClick={() => handleSelect(option)}
                >
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => handleSelect(option)}
                    className="rounded border-gray-300"
                  />
                  <span className="text-sm">{option.label}</span>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}