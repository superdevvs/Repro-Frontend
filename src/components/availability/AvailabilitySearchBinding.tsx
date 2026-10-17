import { PageSearch } from '@/components/search/PageSearch';
import { pageSearchResults } from '@/components/search/pageSearchResults';
import type { Photographer } from '@/types/availability';

interface Props {
  photographers: Photographer[];
  query: string;
  onQueryChange: (value: string) => void;
  onSelect: (id: string) => void;
}

/** Remains mounted when the mobile team picker is closed. */
export function AvailabilitySearchBinding({ photographers, query, onQueryChange, onSelect }: Props) {
  return <PageSearch hidden searchId="availability-team" scope="availability" scopeLabel="Availability team" priority={40}
    value={query} onChange={event => onQueryChange(event.target.value)}
    searchResults={pageSearchResults(photographers, 'availability', '/availability?photographer={id}')}
    onResultOpen={result => onSelect(result.id)} />;
}
