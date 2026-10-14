import { useId } from 'react';

type ArtKind =
  | 'sandwich'
  | 'ingredients'
  | 'handwash'
  | 'workstation'
  | 'spread'
  | 'cut'
  | 'storage';
type ArtIds = {
  bread: string;
  crust: string;
  peanut: string;
  jelly: string;
  metal: string;
  glass: string;
};

const color = {
  background: 'var(--pbj-art-background, #15171e)',
  surface: 'var(--pbj-art-surface, #242833)',
  line: 'var(--pbj-art-line, #404555)',
  bread: 'var(--pbj-art-bread, #f1d8a3)',
  crumb: 'var(--pbj-art-crumb, #cfac74)',
  crust: 'var(--pbj-art-crust, #b87b43)',
  peanut: 'var(--pbj-art-peanut, #c88d56)',
  jelly: 'var(--pbj-art-jelly, #875079)',
  indigo: 'var(--pbj-art-indigo, #9699ec)',
  water: 'var(--pbj-art-water, #a4c7db)',
  skin: 'var(--pbj-art-skin, #d1a488)',
  skinShade: 'var(--pbj-art-skin-shade, #ae7d67)',
};

const breadShape =
  'M-101-78C-116-91-112-114-91-124C-67-139-34-135-16-121C2-135 33-139 58-127C84-129 107-111 104-89L100 89Q100 103 86 103H-88Q-102 103-102 88Z';
const spreadShape =
  'M-79-75Q-88-91-70-98Q-41-112-19-95Q3-111 25-103Q42-97 61-103Q87-104 85-79L82 72Q88 91 65 89Q42 83 21 91Q-6 85-30 90Q-48 82-70 90Q-91 90-83 69Z';

/** Decorative course artwork. The slide heading and body provide its accessible meaning. */
export function PBJArt({
  kind,
  className,
}: {
  kind: ArtKind;
  className?: string;
}) {
  const id = useId().replace(/:/g, '');
  const ids: ArtIds = {
    bread: `${id}-bread`,
    crust: `${id}-crust`,
    peanut: `${id}-peanut`,
    jelly: `${id}-jelly`,
    metal: `${id}-metal`,
    glass: `${id}-glass`,
  };

  return (
    <svg
      className={className}
      viewBox="0 0 600 480"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <linearGradient id={ids.bread} x1="0" y1="0" x2="1" y2="1">
          <stop stopColor="var(--pbj-art-bread-light, #fae8bd)" />
          <stop offset="1" stopColor={color.bread} />
        </linearGradient>
        <linearGradient id={ids.crust} x1="0" y1="0" x2="0" y2="1">
          <stop stopColor="var(--pbj-art-crust-light, #d9a367)" />
          <stop offset="1" stopColor={color.crust} />
        </linearGradient>
        <linearGradient id={ids.peanut} x1="0" y1="0" x2="1" y2="1">
          <stop stopColor="var(--pbj-art-peanut-light, #e2b67c)" />
          <stop offset="1" stopColor={color.peanut} />
        </linearGradient>
        <linearGradient id={ids.jelly} x1="0" y1="0" x2="1" y2="1">
          <stop stopColor="var(--pbj-art-jelly-light, #b77999)" />
          <stop offset="1" stopColor={color.jelly} />
        </linearGradient>
        <linearGradient id={ids.metal} x1="0" y1="0" x2="0.8" y2="1">
          <stop stopColor="var(--pbj-art-metal-light, #e5e7ed)" />
          <stop offset="0.45" stopColor="var(--pbj-art-metal, #a5afc1)" />
          <stop offset="1" stopColor="var(--pbj-art-metal-shade, #69788f)" />
        </linearGradient>
        <linearGradient id={ids.glass} x1="0" y1="0" x2="1" y2="0">
          <stop stopColor="#ffffff" stopOpacity="0.18" />
          <stop offset="0.4" stopColor="#ffffff" stopOpacity="0.02" />
          <stop offset="1" stopColor="#ffffff" stopOpacity="0.1" />
        </linearGradient>
      </defs>
      <circle cx="305" cy="233" r="193" fill={color.indigo} opacity="0.035" />
      <circle
        cx="305"
        cy="233"
        r="158"
        fill="none"
        stroke={color.line}
        strokeOpacity="0.34"
      />
      {kind === 'sandwich' && <Sandwich ids={ids} />}
      {kind === 'ingredients' && <Ingredients ids={ids} />}
      {kind === 'handwash' && <Handwash ids={ids} />}
      {kind === 'workstation' && <Workstation ids={ids} />}
      {kind === 'spread' && <Spread ids={ids} />}
      {kind === 'cut' && <Cut ids={ids} />}
      {kind === 'storage' && <Storage ids={ids} />}
    </svg>
  );
}

function Crumbs() {
  return (
    <g fill={color.crumb}>
      <ellipse cx="-62" cy="-75" rx="4" ry="2.5" opacity="0.5" />
      <ellipse cx="27" cy="-67" rx="2.5" ry="4" opacity="0.45" />
      <ellipse cx="62" cy="-18" rx="3.5" ry="2" opacity="0.45" />
      <ellipse cx="-39" cy="16" rx="3" ry="4" opacity="0.3" />
      <ellipse cx="19" cy="41" rx="4" ry="2" opacity="0.4" />
      <ellipse cx="-64" cy="64" rx="2.5" ry="2" opacity="0.55" />
      <circle cx="59" cy="73" r="2" opacity="0.5" />
      <circle cx="-8" cy="-41" r="2" opacity="0.45" />
      <circle cx="71" cy="-80" r="1.5" opacity="0.45" />
    </g>
  );
}

function Bread({ ids, spread }: { ids: ArtIds; spread?: 'peanut' | 'jelly' }) {
  return (
    <g>
      <path d={breadShape} transform="translate(0 9)" fill={color.crust} />
      <path d={breadShape} fill={`url(#${ids.crust})`} />
      <path
        d={breadShape}
        transform="scale(.915 .92)"
        fill={`url(#${ids.bread})`}
      />
      {spread ? <SpreadLayer ids={ids} kind={spread} /> : <Crumbs />}
    </g>
  );
}

function SpreadLayer({ ids, kind }: { ids: ArtIds; kind: 'peanut' | 'jelly' }) {
  return (
    <g>
      <path d={spreadShape} fill={`url(#${ids[kind]})`} />
      <path
        d="M-62-53Q-21-76 55-58M-65-14Q-9-35 64-16M-59 28Q-4 7 62 30M-42 65Q9 47 53 61"
        fill="none"
        stroke={kind === 'peanut' ? '#f3d1a0' : '#e0a2bb'}
        strokeWidth="4"
        strokeLinecap="round"
        opacity="0.35"
      />
      {kind === 'jelly' && (
        <g fill="#4b304c" opacity="0.32">
          <ellipse cx="-37" cy="-41" rx="2" ry="3" />
          <ellipse cx="29" cy="12" rx="3" ry="2" />
          <ellipse cx="-26" cy="53" rx="2" ry="3" />
          <ellipse cx="54" cy="-70" rx="2" ry="3" />
        </g>
      )}
    </g>
  );
}

function Sandwich({ ids }: { ids: ArtIds }) {
  return (
    <g>
      <ellipse
        cx="300"
        cy="410"
        rx="216"
        ry="37"
        fill="#050609"
        opacity="0.3"
      />
      <ellipse cx="300" cy="399" rx="224" ry="40" fill={color.surface} />
      <ellipse cx="300" cy="394" rx="199" ry="28" fill={color.background} />
      <path
        d="M118 163V298M486 162V296"
        stroke={color.indigo}
        strokeOpacity="0.22"
        strokeDasharray="3 8"
      />
      <g transform="matrix(.98 .43 -.98 .43 302 321)">
        <Bread ids={ids} />
      </g>
      <g transform="matrix(1.08 .46 -1.08 .46 299 259)">
        <path d={spreadShape} transform="translate(0 8)" fill="#673958" />
        <SpreadLayer ids={ids} kind="jelly" />
      </g>
      <g transform="matrix(1.08 .46 -1.08 .46 301 216)">
        <path d={spreadShape} transform="translate(0 8)" fill="#aa7144" />
        <SpreadLayer ids={ids} kind="peanut" />
      </g>
      <g transform="matrix(.98 .43 -.98 .43 300 133)">
        <Bread ids={ids} />
      </g>
      <g fill={color.crumb}>
        <path d="m132 378 7-3 4 5-7 3z" />
        <path d="m425 395 5-3 5 5-5 2z" />
        <circle cx="151" cy="391" r="2" />
        <circle cx="439" cy="381" r="2.5" />
        <circle cx="164" cy="373" r="1.5" />
      </g>
      <path d="M466 361q28-21 46-13-7 23-38 22" fill="#788e76" />
      <path
        d="m466 373 40-22"
        stroke="#a4b194"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </g>
  );
}

function Jar({
  ids,
  kind,
  transform,
}: {
  ids: ArtIds;
  kind: 'peanut' | 'jelly';
  transform: string;
}) {
  return (
    <g transform={transform}>
      <ellipse cx="49" cy="147" rx="57" ry="10" fill="#050609" opacity="0.22" />
      <rect
        x="5"
        y="16"
        width="88"
        height="129"
        rx="19"
        fill={`url(#${ids[kind]})`}
      />
      <rect
        x="5"
        y="16"
        width="88"
        height="129"
        rx="19"
        fill={`url(#${ids.glass})`}
        stroke="#ffffff"
        strokeOpacity="0.15"
      />
      <path
        d="M17 46v69q0 17 10 20"
        fill="none"
        stroke="#ffffff"
        strokeWidth="4"
        strokeOpacity="0.18"
        strokeLinecap="round"
      />
      <rect
        x="3"
        y="9"
        width="92"
        height="20"
        rx="6"
        fill={kind === 'peanut' ? '#e6c697' : '#a9a7cf'}
      />
      <path
        d="M15 13v12m11-12v12m11-12v12m11-12v12m11-12v12m11-12v12m11-12v12"
        stroke={color.background}
        strokeOpacity="0.15"
        strokeWidth="2"
      />
      <rect x="16" y="58" width="67" height="60" rx="8" fill="#f5e8cc" />
      <path
        d="M26 68h46M31 108h36"
        stroke="#bda68d"
        strokeWidth="2"
        strokeLinecap="round"
        opacity="0.5"
      />
      {kind === 'peanut' ? (
        <g transform="translate(49 88) rotate(32)">
          <path
            d="M-8-16q-11 3-7 14 3 6 0 12-3 11 8 15 11 0 14-9 2-6-1-12 7-15-4-19-5-2-10-1"
            fill={color.peanut}
          />
          <path
            d="M-7-11q9 10 0 30M-12-6l16 5M-12 11l15 5"
            stroke="#966437"
            strokeWidth="1.5"
            fill="none"
            opacity="0.55"
          />
        </g>
      ) : (
        <g fill={color.jelly}>
          <circle cx="42" cy="85" r="8" />
          <circle cx="55" cy="85" r="8" />
          <circle cx="49" cy="97" r="8" />
          <path d="M49 79q-6-13 5-15 5 9-5 15" fill="#7b8e72" />
          <circle cx="39" cy="82" r="2" fill="#d3a1b2" />
        </g>
      )}
    </g>
  );
}

function Ingredients({ ids }: { ids: ArtIds }) {
  return (
    <g>
      <ellipse
        cx="304"
        cy="396"
        rx="237"
        ry="29"
        fill="#050609"
        opacity="0.25"
      />
      <path d="M62 336 254 279 422 362 228 423Z" fill="#8d613f" />
      <path d="M62 326 254 269 422 352 228 413Z" fill="#bb9062" />
      <path
        d="m95 333 151-44m-113 60 151-44m-112 62 151-44"
        stroke="#e9bd87"
        strokeWidth="2"
        opacity="0.35"
      />
      <g transform="translate(177 266) rotate(-14) scale(.84)">
        <Bread ids={ids} />
      </g>
      <g transform="translate(246 288) rotate(14) scale(.82)">
        <Bread ids={ids} />
      </g>
      <Jar ids={ids} kind="peanut" transform="translate(330 203) scale(1.08)" />
      <Jar ids={ids} kind="jelly" transform="translate(447 233) scale(.83)" />
      <g transform="translate(361 138) rotate(-13)">
        <ellipse cx="0" cy="0" rx="12" ry="20" fill={color.peanut} />
        <path
          d="M0-16q-6 14 0 31m-9-21 17 6m-18 4 17 6"
          fill="none"
          stroke="#946137"
          strokeWidth="1.5"
        />
      </g>
      <g fill={color.jelly}>
        <circle cx="475" cy="165" r="13" />
        <circle cx="497" cy="165" r="13" />
        <circle cx="486" cy="185" r="13" />
      </g>
      <path d="M485 154q-15-28 9-31 8 18-9 31" fill="#7b8e72" />
    </g>
  );
}

function Handwash({ ids }: { ids: ArtIds }) {
  return (
    <g>
      <ellipse
        cx="297"
        cy="395"
        rx="223"
        ry="42"
        fill="#050609"
        opacity="0.22"
      />
      <path d="M82 340q-12 83 217 91 226-8 219-91Z" fill={color.surface} />
      <ellipse cx="300" cy="337" rx="218" ry="58" fill="#444d5e" />
      <ellipse cx="300" cy="337" rx="187" ry="42" fill={color.background} />
      <ellipse cx="302" cy="352" rx="37" ry="9" fill={color.surface} />
      <ellipse cx="302" cy="352" rx="16" ry="4" fill="#07090d" />
      <path
        d="M349 138V94q0-31-37-31h-66q-36 0-36 31v25"
        fill="none"
        stroke="#69788f"
        strokeWidth="31"
        strokeLinecap="round"
      />
      <path
        d="M345 135V95q0-27-33-27h-64q-32 0-32 27v20"
        fill="none"
        stroke={`url(#${ids.metal})`}
        strokeWidth="22"
        strokeLinecap="round"
      />
      <rect
        x="191"
        y="114"
        width="47"
        height="16"
        rx="5"
        fill={`url(#${ids.metal})`}
      />
      <rect x="324" y="139" width="44" height="13" rx="5" fill="#8390a3" />
      <path
        d="M349 132h43"
        stroke={`url(#${ids.metal})`}
        strokeWidth="9"
        strokeLinecap="round"
      />
      <g stroke={color.water} strokeLinecap="round">
        <path
          d="M202 145v68m12-66v80m12-78v50"
          strokeWidth="4"
          strokeOpacity="0.6"
        />
        <path
          d="M207 248v10m26-39v12m-42 61v8"
          strokeWidth="3"
          strokeOpacity="0.65"
        />
      </g>
      <path
        d="m104 262 57-49q25-18 52-5l59 27q12 7 8 16-5 9-16 5l-35-12 64 32q13 6 7 17-6 10-19 5l-51-21 51 26q12 7 5 17-6 8-19 2l-46-21 32 20q12 8 5 17-6 8-18 1l-49-27q-22-10-37-27l-25 18Z"
        fill={color.skinShade}
      />
      <path
        d="m475 289-58-65q-17-21-39-29l-55-21q-15-5-19 7-3 10 11 16l30 15-93 16q-14 3-12 14 2 10 16 8l62-8-64 17q-13 4-10 15 3 9 17 6l63-15-48 20q-14 6-9 17 5 9 18 4l55-20-30 19q-12 8-6 17 6 8 17 2l50-27q29 6 44 23l20 26Z"
        fill={color.skin}
      />
      <path
        d="m412 237 29 32m-110-48-58 13m59 20-52 15m59 4-39 16"
        stroke={color.skinShade}
        strokeWidth="2.5"
        fill="none"
        strokeLinecap="round"
        opacity="0.65"
      />
      <g
        fill={color.water}
        fillOpacity="0.16"
        stroke="#cee3ec"
        strokeOpacity="0.65"
        strokeWidth="2"
      >
        <circle cx="245" cy="193" r="15" />
        <circle cx="265" cy="211" r="9" />
        <circle cx="292" cy="164" r="8" />
        <circle cx="220" cy="237" r="8" />
        <circle cx="313" cy="195" r="12" />
        <circle cx="238" cy="281" r="5" />
      </g>
      <g stroke="#deedf2" strokeWidth="2" strokeLinecap="round">
        <path d="M239 189q3-5 7-4m62 6q2-3 5-3" />
      </g>
    </g>
  );
}

function Workstation({ ids }: { ids: ArtIds }) {
  return (
    <g>
      <ellipse
        cx="305"
        cy="392"
        rx="240"
        ry="27"
        fill="#050609"
        opacity="0.25"
      />
      <path d="m70 270 272-69 211 99v18l-276 84L70 288Z" fill="#916541" />
      <path d="m70 270 272-69 211 99-276 85Z" fill="#c29b6f" />
      <path
        d="m99 274 240-59 181 84-245 71Z"
        fill="none"
        stroke="#e0b98a"
        strokeWidth="2"
      />
      <path
        d="m136 273 161 73m-125-89 161 77m-125-89 161 76m-127-90 164 76"
        stroke="#946a46"
        strokeOpacity="0.18"
        strokeWidth="2"
      />
      <g transform="matrix(.67 .29 -.67 .29 286 278)">
        <Bread ids={ids} />
      </g>
      <g transform="matrix(.64 .28 -.64 .28 405 314)">
        <Bread ids={ids} />
      </g>
      <Jar ids={ids} kind="peanut" transform="translate(93 131) scale(.87)" />
      <Jar ids={ids} kind="jelly" transform="translate(199 108) scale(.78)" />
      <g transform="translate(430 149) rotate(26)">
        <rect width="81" height="110" rx="8" fill="#aebdcc" />
        <path
          d="M8 15h65M8 34h65M8 53h65M8 72h65M8 91h65"
          stroke="#e2e6ed"
          strokeWidth="2"
          opacity="0.38"
        />
        <path
          d="M13 0v110M31 0v110M50 0v110M68 0v110"
          stroke="#66778e"
          strokeWidth="2"
          opacity="0.3"
        />
      </g>
      <g transform="translate(113 352) rotate(24)">
        <Knife ids={ids} />
      </g>
      <g transform="translate(149 388) rotate(24) scale(.9)">
        <Knife ids={ids} />
      </g>
    </g>
  );
}

function Knife({ ids }: { ids: ArtIds }) {
  return (
    <g>
      <path d="M0-9h125q24 0 25 14l-150 5Z" fill={`url(#${ids.metal})`} />
      <path d="M10 7h130" stroke="#e3e8f0" strokeWidth="1.5" opacity="0.7" />
      <rect
        x="-67"
        y="-11"
        width="73"
        height="24"
        rx="10"
        fill="#424959"
        stroke="#71798a"
        strokeWidth="1.5"
      />
      <circle cx="-51" cy="1" r="2.5" fill="#a6afbd" />
      <circle cx="-13" cy="1" r="2.5" fill="#a6afbd" />
    </g>
  );
}

function Spread({ ids }: { ids: ArtIds }) {
  return (
    <g>
      <ellipse
        cx="298"
        cy="391"
        rx="219"
        ry="32"
        fill="#050609"
        opacity="0.22"
      />
      <g transform="translate(314 269) rotate(-9)">
        <rect
          x="-173"
          y="-142"
          width="327"
          height="282"
          rx="22"
          fill="#8a603e"
        />
        <rect
          x="-173"
          y="-150"
          width="327"
          height="282"
          rx="22"
          fill="#bc9364"
        />
        <rect
          x="-160"
          y="-137"
          width="301"
          height="256"
          rx="15"
          fill="none"
          stroke="#e0b789"
          strokeWidth="2"
          opacity="0.7"
        />
        <path
          d="M-130-130v242m38-242v242m39-242v242m38-242v242m39-242v242m38-242v242m38-242v242"
          stroke="#8f6644"
          strokeOpacity="0.15"
          strokeWidth="2"
        />
        <g transform="scale(1.12)">
          <Bread ids={ids} spread="peanut" />
        </g>
      </g>
      <Jar ids={ids} kind="peanut" transform="translate(67 263) scale(.87)" />
      <g transform="translate(434 152) rotate(140)">
        <Knife ids={ids} />
        <path
          d="M55-7q24-17 41-5 16-4 26 9-37 17-67 9Z"
          fill={`url(#${ids.peanut})`}
        />
        <path
          d="M62-3q32-7 53 2"
          fill="none"
          stroke="#f3d1a0"
          strokeWidth="3"
          strokeLinecap="round"
          opacity="0.65"
        />
      </g>
      <path
        d="M434 253q-7 42-44 64"
        fill="none"
        stroke={color.indigo}
        strokeWidth="2"
        strokeDasharray="4 7"
        opacity="0.7"
      />
      <path
        d="m389 304-2 15 16-3"
        fill="none"
        stroke={color.indigo}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.7"
      />
    </g>
  );
}

function Cut({ ids }: { ids: ArtIds }) {
  return (
    <g>
      <ellipse
        cx="300"
        cy="399"
        rx="211"
        ry="32"
        fill="#050609"
        opacity="0.25"
      />
      <g transform="translate(288 264) rotate(-10)">
        <rect
          x="-179"
          y="-145"
          width="359"
          height="286"
          rx="24"
          fill="#8a603e"
        />
        <rect
          x="-179"
          y="-154"
          width="359"
          height="286"
          rx="24"
          fill="#bd9466"
        />
        <rect
          x="-165"
          y="-141"
          width="331"
          height="259"
          rx="16"
          fill="none"
          stroke="#e2ba88"
          strokeWidth="2"
        />
        <path
          d="M-121-126v228m43-228v228m43-228v228m43-228v228m43-228v228m43-228v228m43-228v228"
          stroke="#8a603e"
          strokeOpacity="0.15"
          strokeWidth="2"
        />
        <g transform="translate(-9 12)">
          <path d="M-117-91V99H97Z" fill={color.crust} />
          <path d="M-117-105V85H97Z" fill={color.jelly} />
          <path d="M-117-112V78H97Z" fill={color.peanut} />
          <path d="M-117-124V66H97Z" fill={`url(#${ids.crust})`} />
          <path d="M-105-100V55H70Z" fill={`url(#${ids.bread})`} />
          <g transform="translate(-27 5) scale(.7)">
            <Crumbs />
          </g>
        </g>
        <g transform="translate(17 -7)">
          <path d="M-107-91H109V99Z" fill={color.crust} />
          <path d="M-107-105H109V85Z" fill={color.jelly} />
          <path d="M-107-112H109V78Z" fill={color.peanut} />
          <path d="M-107-124H109V66Z" fill={`url(#${ids.crust})`} />
          <path d="M-76-113H97V39Z" fill={`url(#${ids.bread})`} />
          <g fill={color.crumb} opacity="0.5">
            <ellipse cx="22" cy="-79" rx="3" ry="2" />
            <ellipse cx="72" cy="-56" rx="2" ry="3" />
            <circle cx="70" cy="-95" r="2" />
          </g>
        </g>
      </g>
      <g transform="translate(416 133) rotate(52)">
        <Knife ids={ids} />
      </g>
      <g fill={color.crumb}>
        <path d="m348 364 7 1-2 6-6-2z" />
        <circle cx="364" cy="371" r="2" />
        <circle cx="332" cy="364" r="2" />
      </g>
    </g>
  );
}

function Storage({ ids }: { ids: ArtIds }) {
  return (
    <g>
      <ellipse
        cx="297"
        cy="400"
        rx="226"
        ry="29"
        fill="#050609"
        opacity="0.24"
      />
      <rect
        x="79"
        y="88"
        width="250"
        height="309"
        rx="23"
        fill="#343d4b"
        stroke="#596575"
        strokeWidth="2"
      />
      <rect x="94" y="106" width="221" height="260" rx="11" fill="#222b37" />
      <path d="M104 232h201v10H104Z" fill="#76879b" />
      <path
        d="M104 245h201M104 352h201"
        stroke="#b8c7d6"
        strokeOpacity="0.17"
        strokeWidth="2"
      />
      <rect
        x="187"
        y="92"
        width="36"
        height="6"
        rx="3"
        fill="#bdd1e2"
        opacity="0.65"
      />
      <Jar ids={ids} kind="jelly" transform="translate(171 111) scale(.8)" />
      <rect
        x="122"
        y="281"
        width="105"
        height="53"
        rx="10"
        fill="#b4c3cb"
        fillOpacity="0.25"
        stroke="#c6d4dc"
        strokeOpacity="0.7"
        strokeWidth="2"
      />
      <path d="M132 306h85v19h-85Z" fill={color.bread} />
      <path d="M132 305h85" stroke={color.jelly} strokeWidth="5" />
      <rect x="118" y="273" width="113" height="13" rx="5" fill="#a6b8c7" />
      <path
        d="m260 285 7 12h14l-7 12 7 12h-14l-7 12-7-12h-14l7-12-7-12h14Z"
        fill="none"
        stroke={color.water}
        strokeOpacity="0.6"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path
        d="m332 156 177 20v219l-177-2Z"
        fill="#363943"
        stroke="#555b69"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path d="m346 172 146 16v94l-146-7Z" fill={color.background} />
      <path d="m346 292 146 5v79l-146-1Z" fill={color.background} />
      <path d="m347 263 146 7v15l-146-7Z" fill="#626776" />
      <path d="m347 357 146 1v18l-146-1Z" fill="#626776" />
      <g transform="translate(415 188)">
        <rect
          x="-26"
          y="17"
          width="51"
          height="57"
          rx="7"
          fill={color.water}
          fillOpacity="0.3"
          stroke={color.water}
          strokeOpacity="0.4"
        />
        <rect x="-18" y="7" width="35" height="13" rx="4" fill="#b9c9d6" />
        <path
          d="M-17 34v23"
          stroke="#d0e0e8"
          strokeOpacity="0.4"
          strokeWidth="3"
          strokeLinecap="round"
        />
      </g>
      <path
        d="M530 253v72"
        stroke="#8993a4"
        strokeWidth="8"
        strokeLinecap="round"
      />
      <path
        d="M531 254v70"
        stroke="#c6ceda"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </g>
  );
}
