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

/** LeaderTour layout adapted from the Landor HTML home for a single property tour. */
export function LeaderTour({ data, palette }: LandorThemeProps) {
  const model = useLandorModel(data, palette);
  if (model.locked || !model.shoot) {
    return <LandorUnavailable locked={model.locked} lockedMessage={model.lockedMessage} />;
  }

  return (
    <div className="landor-tour landor-theme landor-theme-leader" id="landor-top" data-palette={model.palette} data-theme="landor-theme-leader">
      <a className="landor-skip" href="#overview">Skip to property details</a>
      {/* index-6: video-backed solid hero with facts */}
      <section className="landor-theme-hero landor-theme-hero-leader">
        <div className="landor-theme-leader-panel">
          {model.hero && (
            <img className="landor-theme-hero-photo" src={model.hero} alt="" loading="eager" draggable={false} onError={showMissingTourImage} onContextMenu={preventTourImageDownloadGesture} />
          )}
          <div className="landor-theme-hero-overlay-shade" aria-hidden="true" />
          <LandorHeader model={model} themeClass="landor-header-on-dark" />
          <div className="landor-container landor-theme-leader-copy">
            <h1>We&apos;re Leader of<br />Construction</h1>
            <p>{model.property.description || `Explore ${model.address} through a refined property presentation.`}</p>
            {model.hasMedia && <a className="landor-button" href="#media">Discover more</a>}
          </div>
          <div className="landor-theme-leader-facts">
            {model.facts.slice(0, 2).map((fact) => (
              <div key={fact.label}>
                <strong>{fact.value}</strong>
                <span>{fact.label}</span>
              </div>
            ))}
            {model.price && (
              <div>
                <strong>{model.price}</strong>
                <span>Listed price</span>
              </div>
            )}
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

export default LeaderTour;
