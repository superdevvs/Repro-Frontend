import { createContext, useContext } from 'react';

export type PhotographerGuideId = 'uploads' | 'cubicasa';
export type PhotographerHelpState = 'library' | PhotographerGuideId | null;

export interface PhotographerHelpContextValue {
  overlayOpen: boolean;
  openHelp: () => void;
  openGuide: (guide: PhotographerGuideId) => void;
  setTourActive: (active: boolean) => void;
}

export const PhotographerHelpContext = createContext<PhotographerHelpContextValue | null>(null);
export const usePhotographerHelp = () => useContext(PhotographerHelpContext);

export function getPhotographerGuide(value: string | null): PhotographerGuideId | null {
  return value === 'uploads' || value === 'cubicasa' ? value : null;
}
