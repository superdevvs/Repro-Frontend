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

/** EstateTour layout adapted from the Landor HTML home for a single property tour. */
export function EstateTour({ data, palette }: LandorThemeProps) {
  const model = useLandorModel(data, palette);
  if (model.locked || !model.shoot) {
    return <LandorUnavailable locked={model.locked} lockedMessage={model.lockedMessage} />;
  }

  return (
    <div className="landor-tour landor-theme landor-theme-estate" id="landor-top" data-palette={model.palette} data-theme="landor-theme-estate">
      <a className="landor-skip" href="#overview">Skip to property details</a>
      {/* index-2: overlay hero */}
      <section className="landor-theme-hero landor-theme-hero-overlay">
        {model.hero && (
          <img className="landor-theme-hero-photo" src={model.hero} alt="" loading="eager" draggable={false} onError={showMissingTourImage} onContextMenu={preventTourImageDownloadGesture} />
        )}
        <div className="landor-theme-hero-overlay-shade" aria-hidden="true" />
        <LandorHeader model={model} themeClass="landor-header-on-dark" />
        <div className="landor-container landor-theme-hero-grid">
          <div className="landor-theme-hero-copy">
            <h4>Defining the standards of real estate presentation</h4>
            {model.hasMedia && <a className="landor-button landor-button-ghost" href="#media"><span className="tp-btn-text">Discover more</span></a>}
          </div>
          <div className="landor-theme-hero-title landor-theme-hero-title-end">
            <h1>Real <span>estate</span></h1>
            <p>{model.address}</p>
          </div>
        </div>
        {model.facts.length > 0 && (
          <div className="landor-container landor-theme-feature-row">
            {model.facts.slice(0, 3).map((fact, index) => (
              <article key={fact.label} className={`landor-theme-feature-card${index === 1 ? ' is-active' : ''}`}>
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

export default EstateTour;
