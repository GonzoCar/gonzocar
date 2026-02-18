/**
 * Human-readable labels for Fluent Forms field keys.
 * Mapping derived from the GonzoCar driver application form.
 */
export const FIELD_LABELS: Record<string, string> = {
    // Personal Info
    'names': 'Full Name',
    'email': 'Email',
    'phone': 'Phone Number',
    'address_1': 'Address',
    'input_text': 'Age',
    'datetime_5': 'Desired Start Date',

    // Rental
    'dropdown': 'Rental Duration',

    // Employment
    'input_radio_1': 'Has Other Job',
    'input_text_2': 'Job Title',

    // Insurance
    'input_radio_2': 'Has Vehicle Insurance',
    'input_text_8': 'Insurance Company',

    // Driving
    'input_text_3': 'Driving Platform',
    'input_text_4': 'Driving Experience',
    'input_text_5': 'Weekly Income',

    // Driving Record
    'input_radio_3': 'Had Accidents (Last 4 Years)',
    'dropdown_1': 'Number of Accidents',
    'input_radio_4': 'Had Moving Violations',
    'dropdown_2': 'Number of Violations',

    // Rental History
    'input_text_6': 'Previous Rental Companies',

    // Deposit
    'input_radio_5': 'Has Security Deposit',
    'input_text_10': 'Available Funds for Deposit',

    // Documents
    'image-upload': 'Driver License',
    'image-upload_1': 'Proof of Income',

    // Notes
    'description_3': 'Additional Notes',
};

/**
 * Fields to display in order (most important first).
 * Fields not listed here will appear at the end.
 */
export const FIELD_ORDER: string[] = [
    'names', 'email', 'phone', 'address_1',
    'input_text', 'datetime_5', 'dropdown',
    'input_radio_1', 'input_text_2',
    'input_radio_2', 'input_text_8',
    'input_text_3', 'input_text_4', 'input_text_5',
    'input_radio_3', 'dropdown_1',
    'input_radio_4', 'dropdown_2',
    'input_text_6',
    'input_radio_5', 'input_text_10',
    'image-upload', 'image-upload_1',
    'description_3',
];

/**
 * Internal/metadata fields that should be hidden from display.
 */
export const HIDDEN_FIELDS = new Set([
    '__submission',
    '_fluentform_3_fluentformnonce',
    '_wp_http_referer',
]);

/**
 * Get a human-readable label for a form field key.
 * Falls back to formatting the raw key if no label is defined.
 */
export function getFieldLabel(key: string): string {
    if (FIELD_LABELS[key]) return FIELD_LABELS[key];
    // Fallback: replace underscores/hyphens with spaces, title case
    return key
        .replace(/[-_]/g, ' ')
        .replace(/\b\w/g, c => c.toUpperCase());
}

/**
 * Sort form data entries by the defined field order.
 * Known fields come first in order, unknown fields come after.
 */
export function sortFormEntries(entries: [string, unknown][]): [string, unknown][] {
    return [...entries].sort((a, b) => {
        const indexA = FIELD_ORDER.indexOf(a[0]);
        const indexB = FIELD_ORDER.indexOf(b[0]);
        if (indexA === -1 && indexB === -1) return 0;
        if (indexA === -1) return 1;
        if (indexB === -1) return -1;
        return indexA - indexB;
    });
}
