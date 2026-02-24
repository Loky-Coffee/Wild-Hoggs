import { useState, useRef, useEffect } from 'preact/hooks';

export interface SelectOption {
  value: string;
  label: string;
}

interface CustomSelectProps {
  id?: string;
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  label?: string;
}

export default function CustomSelect({ id, value, options, onChange, label }: CustomSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const selectedOption = options.find((o) => o.value === value) ?? options[0] ?? undefined;

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return;
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setFocusedIndex(-1);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  // Scroll focused option into view
  useEffect(() => {
    if (!isOpen || focusedIndex < 0 || !listRef.current) return;
    const item = listRef.current.children[focusedIndex] as HTMLElement;
    item?.scrollIntoView({ block: 'nearest' });
  }, [focusedIndex, isOpen]);

  function open() {
    const currentIndex = options.findIndex((o) => o.value === value);
    setFocusedIndex(currentIndex >= 0 ? currentIndex : 0);
    setIsOpen(true);
  }

  function select(optionValue: string) {
    onChange(optionValue);
    setIsOpen(false);
    setFocusedIndex(-1);
  }

  function handleKeyDown(e: KeyboardEvent) {
    if (!isOpen) {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        open();
      }
      return;
    }
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setFocusedIndex((i) => Math.min(i + 1, options.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setFocusedIndex((i) => Math.max(i - 1, 0));
        break;
      case 'Enter':
      case ' ':
        e.preventDefault();
        if (focusedIndex >= 0) select(options[focusedIndex].value);
        break;
      case 'Escape':
      case 'Tab':
        setIsOpen(false);
        setFocusedIndex(-1);
        break;
      case 'Home':
        e.preventDefault();
        setFocusedIndex(0);
        break;
      case 'End':
        e.preventDefault();
        setFocusedIndex(options.length - 1);
        break;
    }
  }

  const triggerId = id ? `${id}-trigger` : undefined;
  const listboxId = id ? `${id}-listbox` : undefined;

  return (
    <div
      ref={containerRef}
      class={`custom-select${isOpen ? ' is-open' : ''}`}
      role="combobox"
      aria-haspopup="listbox"
      aria-expanded={isOpen}
      aria-owns={listboxId}
      aria-label={label}
    >
      <button
        type="button"
        id={triggerId}
        class="custom-select-trigger"
        aria-controls={listboxId}
        disabled={options.length === 0}
        onMouseDown={(e) => {
          e.preventDefault(); // prevent focus loss
          isOpen ? setIsOpen(false) : open();
        }}
        onKeyDown={handleKeyDown}
      >
        <span class="custom-select-value">{selectedOption?.label}</span>
        <span class="custom-select-chevron" aria-hidden="true">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M4 6L8 10L12 6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </span>
      </button>

      {isOpen && (
        <ul
          ref={listRef}
          id={listboxId}
          class="custom-select-dropdown"
          role="listbox"
          aria-label={label}
        >
          {options.map((option, index) => (
            <li
              key={option.value}
              id={id ? `${id}-option-${option.value}` : undefined}
              role="option"
              aria-selected={option.value === value}
              class={`custom-select-option${option.value === value ? ' is-selected' : ''}${index === focusedIndex ? ' is-focused' : ''}`}
              onMouseDown={(e) => {
                e.preventDefault();
                select(option.value);
              }}
              onMouseEnter={() => setFocusedIndex(index)}
            >
              {option.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
