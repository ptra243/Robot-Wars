/** For `<img src>`; `filter: url()` does not key `background-image` the same in most browsers. */
export function PocKnockoutCardFilter() {
  return (
    <svg width="0" height="0" aria-hidden="true" style={{ position: 'absolute' }}>
      <defs>
        <filter
          id="poc-knockout-card-art"
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
          <feMorphology in="keyed" operator="dilate" radius="2" result="dilated" />
          <feFlood floodColor="#000000" result="ink" />
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
