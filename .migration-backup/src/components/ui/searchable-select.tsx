'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { Input } from './input';

export interface SearchableSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
  placeholder?: string;
  searchPlaceholder?: string;
  className?: string;
  disabled?: boolean;
}

const SearchableSelect = React.forwardRef<HTMLDivElement, SearchableSelectProps>(
  ({ value, onChange, options, placeholder = 'Select an option', searchPlaceholder = 'Search...', className, disabled = false }, ref) => {
    const [isOpen, setIsOpen] = React.useState(false);
    const [searchQuery, setSearchQuery] = React.useState('');
    const dropdownRef = React.useRef<HTMLDivElement>(null);

    // Filter options based on search query
    const filteredOptions = React.useMemo(() => {
      if (!searchQuery.trim()) return options;
      
      const query = searchQuery.toLowerCase();
      return options.filter(option => 
        option.label.toLowerCase().includes(query) || 
        option.value.toLowerCase().includes(query)
      );
    }, [options, searchQuery]);

    // Get selected option label
    const selectedOption = React.useMemo(() => {
      return options.find(option => option.value === value);
    }, [options, value]);

    // Close dropdown when clicking outside
    React.useEffect(() => {
      const handleClickOutside = (event: MouseEvent) => {
        if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
          setIsOpen(false);
        }
      };

      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleSelect = (optionValue: string) => {
      onChange(optionValue);
      setIsOpen(false);
      setSearchQuery('');
    };

    const handleToggle = () => {
      if (disabled) return;
      setIsOpen(!isOpen);
      if (!isOpen) {
        setSearchQuery('');
      }
    };

    return (
      <div className={cn('relative w-full', className)} ref={ref}>
        {/* Trigger button */}
        <button
          type="button"
          onClick={handleToggle}
          disabled={disabled}
          className={cn(
            'flex h-9 w-full items-center justify-between rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-400 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100 dark:focus-visible:ring-zinc-600',
            isOpen && 'ring-1 ring-zinc-400 dark:ring-zinc-600'
          )}
        >
          <span className="truncate">
            {selectedOption ? selectedOption.label : placeholder}
          </span>
          <svg
            className="h-4 w-4 opacity-50"
            fill="none"
            height="24"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            viewBox="0 0 24 24"
            width="24"
            xmlns="http://www.w3.org/2000/svg"
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>

        {/* Dropdown */}
        {isOpen && (
          <div
            ref={dropdownRef}
            className="absolute z-50 mt-1 w-full rounded-md border border-zinc-200 bg-white shadow-lg dark:border-zinc-800 dark:bg-zinc-900"
          >
            {/* Search input */}
            <div className="border-b border-zinc-200 p-2 dark:border-zinc-800">
              <Input
                type="text"
                placeholder={searchPlaceholder}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-8 text-sm"
                autoFocus
              />
            </div>

            {/* Options list */}
            <div className="max-h-60 overflow-y-auto py-1">
              {filteredOptions.length === 0 ? (
                <div className="px-3 py-2 text-sm text-zinc-500 dark:text-zinc-400">
                  No options found
                </div>
              ) : (
                filteredOptions.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => handleSelect(option.value)}
                    className={cn(
                      'flex w-full items-center px-3 py-2 text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800',
                      option.value === value && 'bg-zinc-100 dark:bg-zinc-800'
                    )}
                  >
                    <span className="truncate">{option.label}</span>
                  </button>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    );
  }
);

SearchableSelect.displayName = 'SearchableSelect';

export { SearchableSelect };