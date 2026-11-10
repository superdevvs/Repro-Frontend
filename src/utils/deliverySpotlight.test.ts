import { describe, expect, it } from 'vitest';
import { getDeliverySpotlightDescription, getDeliverySpotlightServices } from './deliverySpotlight';

const summarize = (...labels: string[]) => getDeliverySpotlightServices(labels.map((label, id) => ({ label, type: `service_${id}` })));

describe('delivery Spotlight service summaries', () => {
  it('expands the Annapolis catalog bundle into the two services it actually includes', () => {
    expect(summarize('Premium iGuide with Floor plans').map(item => item.label)).toEqual(['iGUIDE', 'Floor plan']);
    expect(getDeliverySpotlightDescription(summarize('Premium iGuide with Floor plans'))).toBe('Tour & property layout');
  });

  it('does not add iGUIDE to floor-plan-only, video or unknown deliveries', () => {
    expect(summarize('2D Floor plans')).toEqual([{ label: 'Floor plan', illustration: 'floorplan', description: 'Property layout' }]);
    expect(summarize('Walkthrough Video', 'Drone Silver Package').map(item => item.illustration)).toEqual(['video', 'drone']);
    expect(summarize('Custom property presentation')[0]).toMatchObject({ label: 'Custom property presentation', illustration: 'media' });
  });

  it('preserves tour providers and only includes floor plans when specified', () => {
    expect(summarize('3D Matterport w/ Floor plans').map(item => item.label)).toEqual(['Matterport', 'Floor plan']);
    expect(summarize('Zillow 3D')[0].label).toBe('Zillow 3D');
    expect(summarize('iGuide Zip File').map(item => item.label)).toEqual(['iGUIDE']);
  });

  it('deduplicates deliverables across bundles and excludes billing-only adjustments', () => {
    const items = getDeliverySpotlightServices([
      { label: 'Historical package: HDR Photos, Video & 3D Matterport + Floor plans', type: 'service_1' },
      { label: '2D Floor plans', type: 'service_2' },
      { label: 'Travel Fee - 60 Miles', type: 'service_3' },
      { label: 'Rush Photo editing fee', type: 'service_4' },
      { label: 'Custom invoice charge', type: 'invoice_adjustment_4' },
    ]);
    expect(items.map(item => item.label)).toEqual(['Photos', 'Video', 'Matterport', 'Floor plan']);
    expect(getDeliverySpotlightDescription(items)).toBe('+2 more');
  });

  it('keeps real editing deliverables and does not split the ampersand entity into a service', () => {
    expect(summarize('Object removal fee - Basic')[0].label).toBe('Object removal fee - Basic');
    expect(summarize('HDR Photos &amp; Video').map(item => item.label)).toEqual(['Photos', 'Video']);
    expect(summarize('Drone Video').map(item => item.label)).toEqual(['Drone video']);
  });

  it('uses a neutral empty state rather than inferring services from missing metadata', () => {
    expect(getDeliverySpotlightServices(undefined)).toEqual([]);
    expect(summarize('', 'Travel fee')).toEqual([]);
    expect(getDeliverySpotlightDescription([])).toBe('Property media');
  });
});
