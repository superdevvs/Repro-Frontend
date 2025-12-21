import React from 'react';
import { cn } from '@/lib/utils';

interface LogoProps {
  className?: string;
  isCollapsed?: boolean;
}

export function Logo({ className, isCollapsed = false }: LogoProps) {
  // When collapsed, adjust viewBox to show only the R/E logo part (red and blue)
  // R/E logo spans from approximately x=16 to x=52, so we use a viewBox that centers it nicely
  const viewBox = isCollapsed ? "0 0 56 48" : "0 0 144 48";
  
  return (
    <svg 
      width="100%" 
      height="100%" 
      viewBox={viewBox} 
      version="1.1" 
      xmlns="http://www.w3.org/2000/svg" 
      className={cn(className)}
      style={{ fillRule: 'evenodd', clipRule: 'evenodd', strokeLinejoin: 'round', strokeMiterlimit: 2 }}
    >
      <g>
        {/* R/E Logo paths - red and blue parts */}
        <path d="M51.89,21.806l0,3.274l-14.103,1.317c0,0 -1.953,-2.366 -1.908,-2.397c0.945,-0.663 1.795,-3.549 1.795,-3.549l14.216,1.355Z" style={{ fill: 'url(#_Linear1)' }} />
        <path d="M16.257,31.339l2.62,1.751l0,-17.285l7.527,-2.333c0,0 1.468,-0.414 2.333,1.204c0.866,1.618 0.866,8.28 -8.543,7.828l8.242,14.904c0,0 0.339,0.677 2.07,0.941c1.731,0.263 4.855,0.842 4.855,0.842l-7.602,-13.45c0,0 7.565,-2.518 6.963,-9.71c-0.602,-7.192 -2.258,-8.24 -5.382,-8.374c0,0 -2.07,0.204 -3.048,0.731c-0.979,0.527 -10.035,5.043 -10.035,5.043l0,17.908Z" style={{ fill: 'url(#_Linear2)' }} />
        <path d="M35.362,7.657l16.528,6.474l0,3.551l-14.937,-3.551c0,0 -0.125,-3.502 -1.592,-6.474Z" style={{ fill: 'url(#_Linear3)' }} />
        <path d="M38.376,39.191l13.514,-6.101l0,-3.924l-16.528,3.924c0,0 2.967,6.088 3.015,6.101Z" style={{ fill: 'url(#_Linear4)' }} />
        
        {/* PRO text - only show when not collapsed */}
        {!isCollapsed && (
          <g style={{ fill: 'hsl(var(--foreground))' }}>
            <path d="M59.925,23.145l0,-4.91l12.176,0c1.016,0 1.847,0.831 1.847,1.847l0,1.215c0,1.016 -0.831,1.847 -1.847,1.847l-12.176,0Zm0,4.105l12.176,0c3.273,0 5.952,-2.678 5.952,-5.952l0,-1.215c0,-3.274 -2.679,-5.952 -5.952,-5.952l-16.281,0l0,19.056l4.104,0l0,-5.937Z" style={{ fillRule: 'nonzero' }} />
            <path d="M81.387,14.131l0,19.056l4.104,0l0,-5.937l9.392,0l3.838,5.91l4.898,0l-4.043,-6.226c2.345,-0.8 4.043,-3.029 4.043,-5.636l0,-1.215c0,-3.274 -2.678,-5.952 -5.951,-5.952l-16.281,0Zm16.281,9.014l-12.177,0l0,-4.91l12.177,0c1.016,0 1.847,0.831 1.847,1.847l0,1.215c0,1.016 -0.831,1.847 -1.847,1.847Z" style={{ fillRule: 'nonzero' }} />
            <path d="M125.363,14.131l-12.574,0c-3.21,0 -5.837,2.626 -5.837,5.836l0,7.383c0,3.21 2.627,5.837 5.837,5.837l12.574,0c3.21,0 5.836,-2.627 5.836,-5.837l0,-7.383c0,-3.21 -2.626,-5.836 -5.836,-5.836Zm-14.306,13.219l0,-7.383c0,-0.952 0.779,-1.732 1.732,-1.732l12.574,0c0.952,0 1.732,0.78 1.732,1.732l0,7.383c0,0.953 -0.78,1.732 -1.732,1.732l-12.574,0c-0.953,0 -1.732,-0.78 -1.732,-1.732Z" style={{ fillRule: 'nonzero' }} />
          </g>
        )}
      </g>
      
      <defs>
        <linearGradient id="_Linear1" x1="0" y1="0" x2="1" y2="0" gradientUnits="userSpaceOnUse" gradientTransform="matrix(14.216253,0,0,5.946411,37.673637,23.423959)">
          <stop offset="0" style={{ stopColor: '#1c47d5', stopOpacity: 1 }} />
          <stop offset="1" style={{ stopColor: '#1c1869', stopOpacity: 1 }} />
        </linearGradient>
        <linearGradient id="_Linear2" x1="0" y1="0" x2="1" y2="0" gradientUnits="userSpaceOnUse" gradientTransform="matrix(19.104731,0,0,31.534449,16.256924,23.423959)">
          <stop offset="0" style={{ stopColor: '#a30000', stopOpacity: 1 }} />
          <stop offset="1" style={{ stopColor: '#f00', stopOpacity: 1 }} />
        </linearGradient>
        <linearGradient id="_Linear3" x1="0" y1="0" x2="1" y2="0" gradientUnits="userSpaceOnUse" gradientTransform="matrix(16.528236,0,0,10.024602,35.361655,12.669035)">
          <stop offset="0" style={{ stopColor: '#2154ff', stopOpacity: 1 }} />
          <stop offset="1" style={{ stopColor: '#000067', stopOpacity: 1 }} />
        </linearGradient>
        <linearGradient id="_Linear4" x1="0" y1="0" x2="1" y2="0" gradientUnits="userSpaceOnUse" gradientTransform="matrix(16.528236,0,0,-10.024602,35.361655,34.178882)">
          <stop offset="0" style={{ stopColor: '#2155ff', stopOpacity: 1 }} />
          <stop offset="1" style={{ stopColor: '#000067', stopOpacity: 1 }} />
        </linearGradient>
      </defs>
    </svg>
  );
}

