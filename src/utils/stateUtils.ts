/**
 * US State name to abbreviation mapping
 */
const STATE_NAME_TO_ABBREV: Record<string, string> = {
  'alabama': 'AL',
  'alaska': 'AK',
  'arizona': 'AZ',
  'arkansas': 'AR',
  'california': 'CA',
  'colorado': 'CO',
  'connecticut': 'CT',
  'delaware': 'DE',
  'florida': 'FL',
  'georgia': 'GA',
  'hawaii': 'HI',
  'idaho': 'ID',
  'illinois': 'IL',
  'indiana': 'IN',
  'iowa': 'IA',
  'kansas': 'KS',
  'kentucky': 'KY',
  'louisiana': 'LA',
  'maine': 'ME',
  'maryland': 'MD',
  'massachusetts': 'MA',
  'michigan': 'MI',
  'minnesota': 'MN',
  'mississippi': 'MS',
  'missouri': 'MO',
  'montana': 'MT',
  'nebraska': 'NE',
  'nevada': 'NV',
  'new hampshire': 'NH',
  'new jersey': 'NJ',
  'new mexico': 'NM',
  'new york': 'NY',
  'north carolina': 'NC',
  'north dakota': 'ND',
  'ohio': 'OH',
  'oklahoma': 'OK',
  'oregon': 'OR',
  'pennsylvania': 'PA',
  'rhode island': 'RI',
  'south carolina': 'SC',
  'south dakota': 'SD',
  'tennessee': 'TN',
  'texas': 'TX',
  'utah': 'UT',
  'vermont': 'VT',
  'virginia': 'VA',
  'washington': 'WA',
  'west virginia': 'WV',
  'wisconsin': 'WI',
  'wyoming': 'WY',
  'district of columbia': 'DC',
  'washington dc': 'DC',
  'dc': 'DC',
};

/**
 * Normalizes a state value to a 2-letter abbreviation.
 * - If already 2 characters, returns uppercase
 * - If full state name, converts to abbreviation
 * - Returns null if cannot be normalized
 */
export function normalizeState(state: string | null | undefined): string | null {
  if (!state) return null;
  
  const trimmed = state.trim();
  if (trimmed.length === 0) return null;
  
  // If already 2 characters, just uppercase it
  if (trimmed.length === 2) {
    return trimmed.toUpperCase();
  }
  
  // Try to find abbreviation from full state name
  const normalized = trimmed.toLowerCase();
  const abbrev = STATE_NAME_TO_ABBREV[normalized];
  
  if (abbrev) {
    return abbrev;
  }
  
  // If not found and not 2 chars, return null (invalid)
  return null;
}

/**
 * Validates that a state is a valid 2-letter abbreviation
 */
export function isValidState(state: string | null | undefined): boolean {
  if (!state) return false;
  const normalized = normalizeState(state);
  return normalized !== null && normalized.length === 2;
}

/**
 * US State abbreviation to full name mapping
 */
const STATE_ABBREV_TO_NAME: Record<string, string> = {
  'AL': 'Alabama',
  'AK': 'Alaska',
  'AZ': 'Arizona',
  'AR': 'Arkansas',
  'CA': 'California',
  'CO': 'Colorado',
  'CT': 'Connecticut',
  'DE': 'Delaware',
  'FL': 'Florida',
  'GA': 'Georgia',
  'HI': 'Hawaii',
  'ID': 'Idaho',
  'IL': 'Illinois',
  'IN': 'Indiana',
  'IA': 'Iowa',
  'KS': 'Kansas',
  'KY': 'Kentucky',
  'LA': 'Louisiana',
  'ME': 'Maine',
  'MD': 'Maryland',
  'MA': 'Massachusetts',
  'MI': 'Michigan',
  'MN': 'Minnesota',
  'MS': 'Mississippi',
  'MO': 'Missouri',
  'MT': 'Montana',
  'NE': 'Nebraska',
  'NV': 'Nevada',
  'NH': 'New Hampshire',
  'NJ': 'New Jersey',
  'NM': 'New Mexico',
  'NY': 'New York',
  'NC': 'North Carolina',
  'ND': 'North Dakota',
  'OH': 'Ohio',
  'OK': 'Oklahoma',
  'OR': 'Oregon',
  'PA': 'Pennsylvania',
  'RI': 'Rhode Island',
  'SC': 'South Carolina',
  'SD': 'South Dakota',
  'TN': 'Tennessee',
  'TX': 'Texas',
  'UT': 'Utah',
  'VT': 'Vermont',
  'VA': 'Virginia',
  'WA': 'Washington',
  'WV': 'West Virginia',
  'WI': 'Wisconsin',
  'WY': 'Wyoming',
  'DC': 'District of Columbia',
};

export const STATE_OPTIONS = Object.entries(STATE_ABBREV_TO_NAME)
  .map(([value, label]) => ({ value, label }))
  .sort((a, b) => a.label.localeCompare(b.label));

/**
 * Converts a state abbreviation to its full name for display purposes.
 * - 2-letter abbreviations (like "MD", "CA") are converted to full names (like "Maryland", "California")
 * - "DC" stays as "DC" (not converted to "District of Columbia")
 * - If the input is already a full name, returns it as-is
 * - Returns the original value if not found
 */
export function getStateFullName(state: string | null | undefined): string {
  if (!state) return '';
  
  const trimmed = state.trim();
  if (trimmed.length === 0) return '';
  
  const upperTrimmed = trimmed.toUpperCase();
  
  // Special case: DC stays as DC (not "District of Columbia")
  if (upperTrimmed === 'DC') {
    return 'DC';
  }
  
  // If it's a 2-letter abbreviation, convert to full name
  if (trimmed.length === 2) {
    const fullName = STATE_ABBREV_TO_NAME[upperTrimmed];
    return fullName || trimmed;
  }
  
  // If it's already a full name, try to normalize and get full name
  const abbrev = normalizeState(trimmed);
  if (abbrev && abbrev !== 'DC') {
    return STATE_ABBREV_TO_NAME[abbrev] || trimmed;
  }
  
  // Return as-is if we can't determine
  return trimmed;
}

