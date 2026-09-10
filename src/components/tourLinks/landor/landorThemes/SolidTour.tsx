import { LandorMedia } from '../LandorMedia';
import type { LandorThemeProps } from '../landorRegistry';
import { useLandorModel } from '../useLandorModel';
import {
  LandorContactSection,
  LandorFooter,
  LandorHeader,
  LandorLocationSection,
  LandorOverviewFacts,
  LandorUnavailable,
} from '../LandorSharedSections';
import { showMissingTourImage, preventTourImageDownloadGesture } from '../../shared/publicTourImage';
import '../landor.css';
import './landorThemes.css';

/** SolidTour layout adapted from the Landor HTML home for a single property tour. */
export function SolidTour({ data, palette }: LandorThemeProps) {
  const model = useLandorModel(data, palette);
  if (model.locked || !model.shoot) {
    return <LandorUnavailable locked={model.locked} lockedMessage={model.lockedMessage} />;
  }

  return (
    <div className="landor-tour landor-theme landor-theme-solid" id="landor-top" data-palette={model.palette} data-theme="landor-theme-solid">
      <a className="landor-skip" href="#overview">Skip to property details</a>
      {/* index-3: solid hero panel */}
      <section className="landor-theme-hero landor-theme-hero-solid">
        <div className="landor-theme-solid-panel" style={model.hero ? { backgroundImage: `url(${model.hero})` } : undefined}>
          <LandorHeader model={model} themeClass="landor-header-on-dark" />
          {model.hasContact && <a className="landor-theme-badge" href="#contact">Get<br />in<br />touch</a>}
          <div className="landor-container landor-theme-solid-copy">
            <h1>Innovation<br />Excellence<br />Growth.</h1>
            <p>{model.address}{model.locality ? ` · ${model.locality}` : ''}</p>
            {model.price && <strong className="landor-theme-price-pill">{model.price}</strong>}
          </div>
        </div>
      </section>
      <main>
        <LandorOverviewFacts model={model} />
        <LandorMedia data={data} />
        <LandorLocationSection model={model} branding={model.branding} />
        <LandorContactSection model={model} data={data} photo={model.secondary} />
      </main>
      <LandorFooter model={model} />
    </div>
  );
}

export default SolidTour;
