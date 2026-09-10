import { useEffect, useState } from 'react';
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

/** Vision layout from index-5: multi-slide hero carousel for the property. */
export function VisionTour({ data, palette }: LandorThemeProps) {
  const model = useLandorModel(data, palette);
  const slides = data.heroSlides.slice(0, 5);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (slides.length < 2) return undefined;
    const reduce = typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) return undefined;
    const timer = window.setInterval(() => setIndex((current) => (current + 1) % slides.length), 6000);
    return () => window.clearInterval(timer);
  }, [slides.length]);

  if (model.locked || !model.shoot) {
    return <LandorUnavailable locked={model.locked} lockedMessage={model.lockedMessage} />;
  }

  const headlines = [
    'Leading with vision, grow with purpose',
    "We're Leader of Construction",
    'Smart and sustainable living',
  ];

  return (
    <div className="landor-tour landor-theme landor-theme-vision" id="landor-top" data-palette={model.palette} data-theme="landor-theme-vision">
      <a className="landor-skip" href="#overview">Skip to property details</a>
      <section className="landor-theme-hero landor-theme-hero-slider" aria-roledescription="carousel" aria-label="Property highlights">
        {slides.map((slide, slideIndex) => (
          <div
            key={`${slide}-${slideIndex}`}
            className={`landor-theme-slide${slideIndex === index ? ' is-active' : ''}`}
            aria-hidden={slideIndex !== index}
          >
            <img src={slide} alt="" loading={slideIndex === 0 ? 'eager' : 'lazy'} draggable={false} onError={showMissingTourImage} onContextMenu={preventTourImageDownloadGesture} />
          </div>
        ))}
        <div className="landor-theme-hero-overlay-shade" aria-hidden="true" />
        <LandorHeader model={model} themeClass="landor-header-on-dark" />
        <div className="landor-container landor-theme-slider-copy">
          <h1>{headlines[index % headlines.length]}</h1>
          <p>{model.address}</p>
          {model.hasMedia && <a className="landor-button" href="#media">Discover more</a>}
          {slides.length > 1 && (
            <div className="landor-theme-slider-dots" role="tablist" aria-label="Hero slides">
              {slides.map((_, slideIndex) => (
                <button
                  key={slideIndex}
                  type="button"
                  role="tab"
                  aria-selected={slideIndex === index}
                  aria-label={`Show slide ${slideIndex + 1}`}
                  className={slideIndex === index ? 'is-active' : undefined}
                  onClick={() => setIndex(slideIndex)}
                />
              ))}
            </div>
          )}
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

export default VisionTour;
