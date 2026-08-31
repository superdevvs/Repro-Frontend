import { cleanup, render, screen, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { afterEach, describe, expect, it } from 'vitest';
import { TourAboutSection } from './TourAboutSection';
import { TourStatsGrid, type TourStatItem } from './TourStatsGrid';
import { normalizeTourDescription } from './tourDisplayUtils';

afterEach(() => {
  cleanup();
});

const fourPropertyFacts: TourStatItem[] = [
  { icon: <span aria-hidden="true" />, label: 'Beds', value: '4' },
  { icon: <span aria-hidden="true" />, label: 'Baths', value: '3.5' },
  { icon: <span aria-hidden="true" />, label: 'Square Feet', value: '3,059' },
  { icon: <span aria-hidden="true" />, label: 'Lot Size', value: '15140' },
];

describe('TourStatsGrid', () => {
  it('places four property facts in a two-column mobile grid in the requested order', () => {
    render(<TourStatsGrid items={fourPropertyFacts} />);

    const grid = screen.getByRole('list', { name: 'Property facts' });
    const items = within(grid).getAllByRole('listitem');

    expect(grid).toHaveClass('grid-cols-2', 'md:flex');
    expect(items.map((item) => item.textContent)).toEqual([
      'Beds4',
      'Baths3.5',
      'Square Feet3,059',
      'Lot Size15140',
    ]);
    expect(items[0]).not.toHaveClass('border-l', 'border-t');
    expect(items[1]).toHaveClass('border-l');
    expect(items[1]).not.toHaveClass('border-t');
    expect(items[2]).toHaveClass('border-t');
    expect(items[2]).not.toHaveClass('border-l');
    expect(items[3]).toHaveClass('border-l', 'border-t');
  });

  it('keeps the existing three-column mobile layout when there are only three facts', () => {
    render(<TourStatsGrid items={fourPropertyFacts.slice(0, 3)} />);

    expect(screen.getByRole('list', { name: 'Property facts' })).toHaveClass('grid-cols-3');
  });
});

describe('TourAboutSection', () => {
  it.each([undefined, null, '', ' \n\t '])(
    'hides About for a missing description (%s) while preserving listing metadata',
    (description) => {
      render(
        <TourAboutSection
          description={description}
          listingType="for_sale"
          propertyStatus="available"
        />,
      );

      expect(screen.getByText('For Sale')).toBeInTheDocument();
      expect(screen.queryByRole('heading', { name: 'About' })).not.toBeInTheDocument();
      expect(normalizeTourDescription(description)).toBe('');
    },
  );

  it('shows About and its trimmed description when meaningful copy exists', () => {
    render(
      <TourAboutSection
        description="  A welcoming home near parks and schools.  "
        listingType="for_sale"
      />,
    );

    expect(screen.getByRole('heading', { name: 'About' })).toBeInTheDocument();
    expect(screen.getByText('A welcoming home near parks and schools.')).toBeInTheDocument();
  });

  it('renders nothing when description and visible metadata are absent', () => {
    const { container } = render(<TourAboutSection propertyStatus="available" />);

    expect(container).toBeEmptyDOMElement();
  });
});
