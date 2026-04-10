/**
 * @file Catalog metadata for all built-in json-render component types.
 *
 * Each entry describes a component's props (with types and constraints),
 * slots, actions, and purpose — used by getCatalog() to generate
 * LLM-consumable schemas and prompts (aligned with json-render.dev
 * catalog spec).
 *
 * Separated from components.js (which holds render functions) to keep
 * both files under the project line-count limit.
 *
 * @module hyper-element/json-render/catalog
 */

/**
 * Map of component type name → catalog metadata object.
 * Keyed identically to the render functions in components.js so the
 * two can be zipped into BUILT_IN_COMPONENTS entries.
 *
 * @type {Object<string, { description: string, props: Object, slots: string[], actions: Object }>}
 */
export const CATALOG = {
  Card: {
    description:
      'Container for grouping related content. Use as root element or section wrapper. Pair with Row/Column children for layouts.',
    props: {
      title: { type: 'string', description: 'Card header text' },
      description: {
        type: 'string',
        nullable: true,
        description: 'Subtitle text below title',
      },
    },
    slots: ['default'],
    actions: {},
  },
  Row: {
    description:
      'Horizontal flex container. Use to place children side by side. Good for action button groups and inline layouts.',
    props: {
      gap: {
        type: 'number',
        description: 'Space between children in pixels',
      },
    },
    slots: ['default'],
    actions: {},
  },
  Column: {
    description:
      'Vertical flex container. Use to stack children top to bottom. Good for form layouts and content sections.',
    props: {
      gap: {
        type: 'number',
        description: 'Space between children in pixels',
      },
    },
    slots: ['default'],
    actions: {},
  },
  Button: {
    description:
      'Clickable action trigger. Use for confirmations, form submissions, navigation. Pair with Row for side-by-side action groups.',
    props: {
      label: { type: 'string', required: true, description: 'Button text' },
      variant: {
        type: 'string',
        enum: ['primary', 'destructive', 'success'],
        description: 'Visual style variant',
      },
      disabled: {
        type: 'boolean',
        default: false,
        description: 'Greyed out, not clickable',
      },
      loading: {
        type: 'boolean',
        default: false,
        description: 'Shows spinner, disables click',
      },
    },
    slots: [],
    actions: {
      press: {
        description: 'Fired when button is clicked',
        params: { action: { type: 'string' } },
      },
    },
  },
  Text: {
    description:
      'Styled text block. Use for paragraphs, labels, headings, and any text content.',
    props: {
      content: {
        type: 'string',
        required: true,
        description: 'The text to display',
      },
      variant: {
        type: 'string',
        enum: ['muted', 'bold', 'heading'],
        description: 'Text style variant',
      },
    },
    slots: [],
    actions: {},
  },
  Alert: {
    description:
      'Notification banner. Use for status messages, warnings, errors, and success confirmations.',
    props: {
      variant: {
        type: 'string',
        enum: ['info', 'success', 'warning', 'error'],
        description: 'Alert severity/style',
      },
      message: {
        type: 'string',
        required: true,
        description: 'Alert message text',
      },
    },
    slots: [],
    actions: {},
  },
  Progress: {
    description:
      'Horizontal progress bar. Use to show completion percentage for tasks, uploads, or processes.',
    props: {
      label: {
        type: 'string',
        description: 'Label text shown above the bar',
      },
      value: {
        type: 'number',
        required: true,
        description: 'Completion percentage (0-100)',
      },
    },
    slots: [],
    actions: {},
  },
  Divider: {
    description:
      'Horizontal rule separator. Use between content sections for visual separation.',
    props: {},
    slots: [],
    actions: {},
  },
  CodeBlock: {
    description:
      'Code display with language label. Use for showing source code, config snippets, or terminal output.',
    props: {
      language: {
        type: 'string',
        description: 'Programming language name shown in header',
      },
      code: {
        type: 'string',
        required: true,
        description: 'The code text to display',
      },
    },
    slots: [],
    actions: {},
  },
  Image: {
    description:
      'Responsive image. Use for photos, diagrams, charts, or any visual content.',
    props: {
      src: { type: 'string', required: true, description: 'Image URL' },
      alt: {
        type: 'string',
        required: true,
        description: 'Accessibility alt text',
      },
      width: {
        type: 'number',
        description: 'Maximum width constraint in pixels',
      },
      height: {
        type: 'number',
        description: 'Maximum height constraint in pixels',
      },
    },
    slots: [],
    actions: {},
  },
  Checklist: {
    description:
      'Vertical list of checkboxes. Use for task lists, multi-select options, or todo items.',
    props: {
      label: { type: 'string', description: 'Checklist heading text' },
      items: {
        type: 'array',
        required: true,
        description: 'Array of { label: string, checked: boolean } items',
      },
    },
    slots: [],
    actions: {
      checklist_toggle: {
        description: 'Fired when a checkbox is toggled',
        params: {
          index: { type: 'number' },
          checked: { type: 'boolean' },
          label: { type: 'string' },
        },
      },
    },
  },
  TextField: {
    description:
      'Text input with label. Use for single-line user input. Submits on Enter key.',
    props: {
      label: { type: 'string', description: 'Label text above the input' },
      placeholder: {
        type: 'string',
        description: 'Placeholder text inside the input',
      },
      maxLength: { type: 'number', description: 'Maximum character limit' },
    },
    slots: [],
    actions: {
      submit: {
        description: 'Fired when user presses Enter',
        params: {
          value: { type: 'string' },
        },
      },
    },
  },
};
