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

/** BeyondTour layout adapted from the Landor HTML home for a single property tour. */
export function BeyondTour({ data, palette }: LandorThemeProps) {
  const model = useLandorModel(data, palette);
  if (model.locked || !model.shoot) {
    return <LandorUnavailable locked={model.locked} lockedMessage={model.lockedMessage} />;
  }

  return (
    <div className="landor-tour landor-theme landor-theme-beyond" id="landor-top" data-palette={model.palette} data-theme="landor-theme-beyond">
      <a className="landor-skip" href="#overview">Skip to property details</a>
      {/* index-4: gray banner with oversized type */}
      <section className="landor-theme-hero landor-theme-hero-beyond">
        <LandorHeader model={model} />
        <div className="landor-container landor-theme-beyond-main">
          <div className="landor-theme-beyond-copy">
            <h3>Defining the standards of real estate presentation</h3>
            {model.hasMedia && <a className="landor-button" href="#media">Discover more</a>}
          </div>
          <div className="landor-theme-beyond-title">
            <h1>BUILD <span>BEYOND</span></h1>
            <p>{model.address}</p>
          </div>
        </div>
        {model.hero && (
          <div className="landor-container">
            <img className="landor-theme-beyond-photo" src={model.hero} alt={`${model.address} hero`} loading="eager" draggable={false} onError={showMissingTourImage} onContextMenu={preventTourImageDownloadGesture} />
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

export default BeyondTour;
