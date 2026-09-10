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

/** LivingTour layout adapted from the Landor HTML home for a single property tour. */
export function LivingTour({ data, palette }: LandorThemeProps) {
  const model = useLandorModel(data, palette);
  if (model.locked || !model.shoot) {
    return <LandorUnavailable locked={model.locked} lockedMessage={model.lockedMessage} />;
  }

  return (
    <div className="landor-tour landor-theme landor-theme-living" id="landor-top" data-palette={model.palette} data-theme="landor-theme-living">
      <a className="landor-skip" href="#overview">Skip to property details</a>
      {/* index-7: centered sustainable living hero */}
      <section className="landor-theme-hero landor-theme-hero-living">
        {model.hero && (
          <img className="landor-theme-living-shape" src={model.hero} alt="" loading="eager" draggable={false} onError={showMissingTourImage} onContextMenu={preventTourImageDownloadGesture} />
        )}
        <LandorHeader model={model} />
        <div className="landor-container landor-theme-living-copy">
          <h1>Smart and<br />sustainable <span>living</span></h1>
          <p>{model.address}{model.locality ? ` · ${model.locality}` : ''}</p>
          <div className="landor-theme-living-actions">
            {model.hasContact && <a className="landor-button" href="#contact">Get in touch</a>}
            {model.hasMedia && <a className="landor-button landor-button-secondary" href="#media">View gallery</a>}
          </div>
        </div>
        {model.facts.length > 0 && (
          <div className="landor-container landor-theme-feature-row">
            {model.facts.slice(0, 3).map((fact, index) => (
              <article key={fact.label} className="landor-theme-feature-card landor-theme-feature-card-dark">
                <span>0{index + 1}</span>
                <h3>{fact.label}</h3>
                <p>{fact.value}</p>
              </article>
            ))}
          </div>
        )}
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

export default LivingTour;
