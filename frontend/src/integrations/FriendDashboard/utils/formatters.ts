/**
 * Formats a string or number value as currency
 * @param value String or number to format
 * @param locale Locale to use for formatting (default: en-US)
 * @param currency Currency code (default: USD)
 * @returns Formatted currency string
 */
export const formatCurrency = (
    value: string | number,
    locale = 'en-US',
    currency = 'USD'
  ): string => {
    // Convert string to number if needed
    const numericValue = typeof value === 'string' ? parseFloat(value) : value;
    
    // Check if the value is a valid number
    if (isNaN(numericValue)) {
      return '—'; // Return em dash for non-numeric values or parse errors
    }
    
    // Format the number as currency
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(numericValue);
  }; 