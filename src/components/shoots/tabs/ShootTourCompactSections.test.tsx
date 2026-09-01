import React from 'react';
import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ShootTourPropertySection } from './ShootTourPropertySection';
import { ShootTourSettingsSection } from './ShootTourSettingsSection';

afterEach(cleanup);

describe('compact Tours sections', () => {
  it('shows property details once in a dense expandable layout', () => {
    render(
      <ShootTourPropertySection
        showPropertyInfo
        open
        onOpenChange={vi.fn()}
        listingType="for_sale"
        propertyStatus="available"
        setPropertyStatus={vi.fn()}
        canEditPropertyInfo
        isSavingPropertyStatus={false}
        setIsSavingPropertyStatus={vi.fn()}
        propertyBedrooms="3"
        setPropertyBedrooms={vi.fn()}
        propertyBathrooms="2.5"
        setPropertyBathrooms={vi.fn()}
        propertySqft="1850"
        setPropertySqft={vi.fn()}
        isSavingPropertyDetails={false}
        propertyDescription="Bright and inviting home."
        setPropertyDescription={vi.fn()}
        isGeneratingDescription={false}
        isSavingDescription={false}
        propertyMls="R123456"
        setPropertyMls={vi.fn()}
        propertyPrice="$725,000"
        setPropertyPrice={vi.fn()}
        propertyLotSize="0.25 acre"
        setPropertyLotSize={vi.fn()}
        sourcePropertyDescription=""
        saveShootField={vi.fn()}
        savePropertyDetails={vi.fn(async () => undefined)}
        savePropertyField={vi.fn(async () => true)}
        handleGenerateDescription={vi.fn(async () => undefined)}
        handleSaveDescription={vi.fn(async () => undefined)}
      />,
    );

    const section = screen.getByTestId('property-information-section');
    const header = screen.getByRole('button', { name: /Property Information/i });

    expect(section).toHaveClass('overflow-hidden', 'rounded-lg');
    expect(header).toHaveClass('min-h-[58px]');
    expect(screen.getByText('3 bd · 2 and half ba · 1,850 sqft')).toBeInTheDocument();
    expect(screen.getAllByText('Beds')).toHaveLength(1);
    expect(screen.getByLabelText('Beds')).toHaveClass('h-8');
    expect(screen.getByLabelText('MLS number')).toHaveClass('h-8');
    expect(screen.getByRole('textbox', { name: 'Description' })).toHaveClass('min-h-[88px]');
    expect(screen.getByRole('button', { name: 'Save details' })).toHaveClass('h-8');
  });

  it('keeps advanced embed controls collapsed inside compact tour settings', () => {
    render(
      <ShootTourSettingsSection
        open
        onOpenChange={vi.fn()}
        tourStyle="default"
        setTourStyle={vi.fn()}
        saveTourStyle={vi.fn()}
        isSavingTourStyle={false}
        embeds={[{
          id: 'embed-1',
          title: 'Neighbourhood map',
          branded: 'https://example.com/map',
          mls: '',
        }]}
        embedForm={{ title: '', branded: '', mls: '' }}
        setEmbedForm={vi.fn()}
        editingEmbedId={null}
        featuredEmbedId="embed-1"
        setFeaturedEmbedId={vi.fn()}
        savingEmbeds={false}
        handleSaveEmbed={vi.fn()}
        handleEditEmbed={vi.fn()}
        handleDeleteEmbed={vi.fn()}
        persistEmbeds={vi.fn()}
        isEmbedHtml={(value) => value.trim().startsWith('<')}
        tourSettings={{
          header_position: 'center',
          tour_version: 'standard',
          realtor_info: '',
          realtor_client_id: '',
          autoplay: false,
          show_garage: true,
        }}
        updateTourSetting={vi.fn()}
        isSavingTourSettings={false}
        realtorPicker={<div data-testid="realtor-picker">Realtor picker</div>}
        isAdmin
      />,
    );

    const section = screen.getByTestId('tour-settings-section');
    const header = screen.getByRole('button', { name: /Tour Settings/i });

    expect(section).toHaveClass('overflow-hidden', 'rounded-lg');
    expect(header).toHaveClass('min-h-[58px]');
    expect(screen.getByText('Default · Center header · Standard')).toBeInTheDocument();
    expect(screen.getByLabelText('Tour style')).toHaveClass('h-8');
    expect(screen.getByLabelText('Header position')).toHaveClass('h-8');
    expect(screen.getByLabelText('Tour version')).toHaveClass('h-8');
    expect(screen.getByRole('switch', { name: 'Autoplay tour videos' })).toBeInTheDocument();
    expect(screen.getByRole('switch', { name: 'Show garage information' })).toBeChecked();
    expect(screen.queryByLabelText('Embed title')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Embeds/i }));

    expect(screen.getByLabelText('Embed title')).toBeInTheDocument();
    expect(screen.getAllByText('Neighbourhood map')).toHaveLength(2);
    expect(screen.getByRole('button', { name: 'Add embed' })).toHaveClass('h-8');
  });
});
