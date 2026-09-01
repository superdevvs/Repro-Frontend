import { describe, expect, it } from 'vitest';
import {
  calculateSelectedReturnRepStandard,
  currencyInputValue,
  findUnassignedCompensatedServices,
  getCompReshootSuggestedPolicy,
  normalizeCompReshootTemplate,
  repCompensationHasRecipient,
  resolveStandardPhotographerPay,
} from './model';

describe('complimentary reshoot policy', () => {
  it.each([
    ['missed_area', 'none', 'none', 'photographer'],
    ['quality_correction', 'none', 'none', 'photographer'],
    ['company_error', 'standard', 'none', 'company'],
    ['weather_access', 'standard', 'none', 'weather_access'],
  ] as const)('applies %s defaults', (reason, photographerMode, repMode, responsibility) => {
    expect(getCompReshootSuggestedPolicy(reason)).toMatchObject({
      photographerMode,
      repMode,
      responsibility,
    });
  });

  it('requires an explicit rep choice for client accommodation while visually suggesting None', () => {
    expect(getCompReshootSuggestedPolicy('client_accommodation')).toEqual({
      photographerMode: 'standard',
      repMode: null,
      suggestedRepMode: 'none',
      responsibility: 'client',
    });
  });

  it('requires explicit choices for Other', () => {
    expect(getCompReshootSuggestedPolicy('other')).toEqual({
      photographerMode: null,
      repMode: null,
      suggestedRepMode: null,
      responsibility: null,
    });
  });
});

describe('complimentary reshoot template normalization', () => {
  it('preserves service-level source identity and source photographer', () => {
    const template = normalizeCompReshootTemplate({
      data: {
        policy_version: 'comp-reshoot-v1',
        source: {
          id: 42,
          address: '10 Main Street',
          city: 'Leesburg',
          state: 'VA',
          zip: '20175',
        },
        client: { id: 8, name: 'Client' },
        property: {
          address: '10 Main Street',
          city: 'Leesburg',
          state: 'VA',
          zip: '20175',
          property_details: { sqft: 2400 },
        },
        source_service_items: [{
          id: 901,
          service_id: 17,
          name: 'Interior photos',
          nominal_unit_price: 225,
          nominal_total: 225,
          standard_photographer_pay: 85,
          photographer: { id: 31, name: 'Alex Camera' },
        }],
        parent: { id: 41, address: '10 Main Street' },
        root: { id: 40, address: '10 Main Street' },
        sales_rep: { id: 4, name: 'Robin Rep' },
        sales_rep_standard: { basis_amount: 250, rate: 5, amount: 12.5 },
        reason_options: [{
          code: 'client_accommodation',
          label: 'Client accommodation',
          suggested_responsibility: 'client',
          suggested_photographer_mode: 'standard',
          suggested_sales_rep_mode: 'none',
          requires_explicit_sales_rep_choice: true,
        }],
      },
    });

    expect(template.source.id).toBe('42');
    expect(template.policyVersion).toBe('comp-reshoot-v1');
    expect(template.root.id).toBe('40');
    expect(template.parent.id).toBe('41');
    expect(template.client.id).toBe('8');
    expect(template.property.details).toMatchObject({ sqft: 2400 });
    expect(template.sourceServices[0]).toMatchObject({
      shootServiceId: '901',
      serviceId: '17',
      photographerId: '31',
      photographerName: 'Alex Camera',
      nominalPrice: 225,
      standardPhotographerPay: 85,
    });
    expect(template.rep).toMatchObject({ name: 'Robin Rep', basisAmount: 250, rate: 5, standardCompensation: 12.5 });
    expect(getCompReshootSuggestedPolicy('client_accommodation', template.reasonOptions)).toMatchObject({
      photographerMode: 'standard',
      repMode: null,
      suggestedRepMode: 'none',
    });
  });
});

describe('compensation values', () => {
  it('uses the selected return service rate instead of the mapped source pay snapshot', () => {
    expect(resolveStandardPhotographerPay({
      id: '17',
      name: 'Interior photos',
      description: '',
      price: 225,
      photographer_pay: 70,
    }, 2500)).toBe(70);
  });

  it('calculates standard rep compensation from selected commissionable return items only', () => {
    expect(calculateSelectedReturnRepStandard([
      {
        id: '17',
        name: 'Interior photos',
        description: '',
        price: 200,
        photographer_pay: 70,
      },
      {
        id: '18',
        name: 'Pass-through fee',
        description: '',
        price: 100,
        exclude_from_sales_commission: true,
      },
    ], 2500, 15)).toBe(30);
  });

  it('requires positive custom compensation and rejects incomplete or non-positive values', () => {
    expect(currencyInputValue('0')).toBeNull();
    expect(currencyInputValue('12.345')).toBe(12.35);
    expect(currencyInputValue('')).toBeNull();
    expect(currencyInputValue('-1')).toBeNull();
  });

  it('requires an assigned photographer for every service receiving compensation', () => {
    const services = [
      { id: '17', name: 'Photography', description: '', price: 200 },
      { id: '18', name: 'Drone', description: '', price: 100 },
    ];

    expect(findUnassignedCompensatedServices(
      services,
      'custom',
      {
        '17': { mode: 'standard', customAmount: '' },
        '18': { mode: 'none', customAmount: '' },
      },
      '',
      {},
    ).map((service) => service.id)).toEqual(['17']);

    expect(findUnassignedCompensatedServices(
      services,
      'standard',
      {},
      '31',
      {},
    )).toEqual([]);
  });

  it('allows only explicit None rep compensation when the source has no rep', () => {
    expect(repCompensationHasRecipient('none', null)).toBe(true);
    expect(repCompensationHasRecipient('standard', null)).toBe(false);
    expect(repCompensationHasRecipient('custom', '')).toBe(false);
    expect(repCompensationHasRecipient('standard', '44')).toBe(true);
  });
});
