import type { ReactElement } from 'react';

/** SVG chroma-key filters for mech sprites (defs only). */
export function BattlePocKnockoutSvg(): ReactElement {
  return (
    <svg width="0" height="0" aria-hidden="true" style={{ position: 'absolute' }}>
      <defs>
        <filter
          id="bp-knockout-alley"
          colorInterpolationFilters="sRGB"
          x="-10%"
          y="-10%"
          width="120%"
          height="120%"
        >
          <feColorMatrix
            type="matrix"
            values="1 0 0 0 0
                      0 1 0 0 0
                      0 0 1 0 0
                      -1 -1 -1 2.2 0"
            result="keyed"
          />
          <feMorphology in="keyed" operator="dilate" radius="2.2" result="dilated" />
          <feFlood floodColor="#2a2228" result="ink" />
          <feComposite in="ink" in2="dilated" operator="in" result="outline" />
          <feMerge>
            <feMergeNode in="outline" />
            <feMergeNode in="keyed" />
          </feMerge>
        </filter>
        <filter
          id="bp-knockout-neon"
          colorInterpolationFilters="sRGB"
          x="-10%"
          y="-10%"
          width="120%"
          height="120%"
        >
          <feColorMatrix
            type="matrix"
            values="1 0 0 0 0
                      0 1 0 0 0
                      0 0 1 0 0
                      -1 -1 -1 2.2 0"
            result="keyed"
          />
          <feMorphology in="keyed" operator="dilate" radius="2.5" result="dilated" />
          <feFlood floodColor="#070709" result="ink" />
          <feComposite in="ink" in2="dilated" operator="in" result="outline" />
          <feMerge>
            <feMergeNode in="outline" />
            <feMergeNode in="keyed" />
          </feMerge>
        </filter>
        <filter
          id="bp-knockout-market"
          colorInterpolationFilters="sRGB"
          x="-10%"
          y="-10%"
          width="120%"
          height="120%"
        >
          <feColorMatrix
            type="matrix"
            values="1 0 0 0 0
                      0 1 0 0 0
                      0 0 1 0 0
                      -1 -1 -1 2.2 0"
            result="keyed"
          />
          <feMorphology in="keyed" operator="dilate" radius="1.6" result="dilated" />
          <feFlood floodColor="#3d2e26" result="ink" />
          <feComposite in="ink" in2="dilated" operator="in" result="outline" />
          <feMerge>
            <feMergeNode in="outline" />
            <feMergeNode in="keyed" />
          </feMerge>
        </filter>
      </defs>
    </svg>
  );
}
