export interface SearchResult {
  type: string;
  id: string;
  title: string;
  subtitle?: string;
  destination: string;
  badges?: string[];
  metadata?: Record<string, string | number | null>;
  excerpt?: string;
}

export interface SearchGroup {
  scope: string;
  label: string;
  results: SearchResult[];
  hasMore: boolean;
  total?: number;
  error?: string;
}

export interface SearchResponse { groups: SearchGroup[]; }
export interface SearchScope { id: string; label: string; local?: boolean; }

export interface PageSearchAdapter {
  id: string;
  scope: string;
  label: string;
  query: string;
  onQueryChange: (query: string) => void;
  filters?: Record<string, unknown>;
  results?: SearchResult[];
  loading?: boolean;
  error?: boolean;
  priority?: number;
  onResultOpen?: (result: SearchResult) => void;
}
