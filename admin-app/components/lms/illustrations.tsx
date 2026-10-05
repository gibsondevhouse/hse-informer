import type { ReactNode } from 'react';
import type { Illustration as IllustrationId } from '@/lib/lms/schema';

/** Inline vector art keyed by the schema's Illustration ids; colors come from --lms-art-* tokens. */
export function Illustration({
  art,
  alt,
  className,
}: {
  art: IllustrationId;
  alt: string;
  className?: string;
}) {
  return (
    // oxlint-disable-next-line jsx-a11y/prefer-tag-over-role -- inline SVG needs role=img for an accessible name
    <svg role="img" aria-label={alt} className={className} viewBox="0 0 400 240" focusable="false">
      <rect width="400" height="240" fill="var(--lms-art-bg)" />
      {artwork[art]}
    </svg>
  );
}

const bread = 'var(--lms-art-bread)';
const crust = 'var(--lms-art-crust)';
const peanut = 'var(--lms-art-peanut)';
const jelly = 'var(--lms-art-jelly)';
const ink = 'var(--lms-art-ink)';
const surface = 'var(--lms-art-surface)';
const metal = 'var(--lms-art-metal)';
const water = 'var(--lms-art-water)';
const skin = 'var(--lms-art-skin)';

function Jar({
  x,
  y,
  fill,
  label,
}: {
  x: number;
  y: number;
  fill: string;
  label: string;
}) {
  return (
    <g>
      <rect x={x} y={y + 10} width="52" height="66" rx="8" fill={fill} />
      <rect x={x + 4} y={y} width="44" height="16" rx="4" fill={ink} />
      <rect
        x={x + 8}
        y={y + 30}
        width="36"
        height="26"
        rx="3"
        fill={surface}
      />
      <text
        x={x + 26}
        y={y + 47}
        textAnchor="middle"
        fontSize="11"
        fontFamily="inherit"
        fill={ink}
      >
        {label}
      </text>
    </g>
  );
}

function Slice({ x, y, spread }: { x: number; y: number; spread?: string }) {
  return (
    <g>
      <path
        d={`M${x} ${y + 14} q0 -14 14 -14 h52 q14 0 14 14 v56 h-80 z`}
        fill={crust}
      />
      <path
        d={`M${x + 6} ${y + 16} q0 -8 8 -8 h52 q8 0 8 8 v48 h-68 z`}
        fill={spread ?? bread}
      />
    </g>
  );
}

const artwork: Record<IllustrationId, ReactNode> = {
  sandwich: (
    <g>
      <ellipse cx="200" cy="170" rx="150" ry="42" fill={surface} />
      <ellipse cx="200" cy="166" rx="138" ry="34" fill="var(--lms-art-bg)" />
      <path d="M90 150 l110 -90 v110 z" fill={crust} />
      <path d="M100 148 l98 -78 v96 z" fill={bread} />
      <path d="M100 148 l98 -78 l-2 6 l-90 72 z" fill={peanut} />
      <path d="M104 150 l92 -72 l0 8 l-86 64 z" fill={jelly} />
      <path d="M210 60 l100 90 h-100 z" fill={crust} />
      <path d="M212 76 l82 74 h-82 z" fill={bread} />
      <path d="M212 76 l82 74 l-8 0 l-74 -66 z" fill={peanut} />
      <path d="M212 88 l70 62 l-8 0 l-62 -54 z" fill={jelly} />
    </g>
  ),
  workstation: (
    <g>
      <rect x="0" y="90" width="400" height="150" fill={surface} />
      <rect x="120" y="110" width="160" height="90" rx="6" fill={crust} />
      <rect x="128" y="118" width="144" height="74" rx="4" fill={bread} />
      <Slice x={138} y={125} />
      <Slice x={224} y={125} spread={peanut} />
      <rect x="130" y="208" width="140" height="10" rx="5" fill={metal} />
      <rect x="130" y="206" width="40" height="14" rx="5" fill={ink} />
      <Jar x={34} y={114} fill={peanut} label="PB" />
      <Jar x={314} y={114} fill={jelly} label="JELLY" />
      <ellipse cx="68" cy="46" rx="42" ry="14" fill={surface} />
      <ellipse cx="68" cy="44" rx="30" ry="9" fill="var(--lms-art-bg)" />
      <rect x="108" y="24" width="24" height="40" rx="5" fill={water} />
      <rect x="114" y="14" width="12" height="14" rx="2" fill={ink} />
      <rect x="236" y="30" width="56" height="8" rx="4" fill={metal} />
      <rect x="236" y="48" width="56" height="8" rx="4" fill={metal} />
      <rect x="282" y="27" width="22" height="14" rx="3" fill={peanut} />
      <rect x="282" y="45" width="22" height="14" rx="3" fill={jelly} />
      <rect x="310" y="18" width="60" height="40" rx="4" fill={water} />
      <path d="M310 32 h60 M310 44 h60" stroke={surface} strokeWidth="3" />
    </g>
  ),
  handwash: (
    <g>
      <rect x="150" y="20" width="100" height="24" rx="8" fill={metal} />
      <rect x="190" y="40" width="20" height="40" rx="6" fill={metal} />
      <path d="M200 80 q-6 30 0 60" stroke={water} strokeWidth="14" fill="none" strokeLinecap="round" />
      <ellipse cx="200" cy="190" rx="130" ry="30" fill={surface} />
      <path d="M120 150 q30 -40 70 -10 q20 20 10 40 q-40 20 -80 -30 z" fill={skin} />
      <path d="M280 150 q-30 -40 -70 -10 q-20 20 -10 40 q40 20 80 -30 z" fill={skin} />
      <circle cx="170" cy="118" r="10" fill={water} opacity="0.7" />
      <circle cx="232" cy="110" r="7" fill={water} opacity="0.7" />
      <circle cx="205" cy="100" r="5" fill={water} opacity="0.7" />
    </g>
  ),
  ingredients: (
    <g>
      <rect x="0" y="170" width="400" height="70" fill={surface} />
      <Slice x={36} y={92} />
      <Slice x={124} y={92} />
      <Jar x={222} y={96} fill={peanut} label="PB" />
      <Jar x={302} y={96} fill={jelly} label="JELLY" />
    </g>
  ),
  storage: (
    <g>
      <rect x="20" y="40" width="170" height="160" rx="8" fill={crust} />
      <rect x="30" y="110" width="150" height="6" fill={ink} opacity="0.3" />
      <Jar x={70} y={40} fill={peanut} label="PB" />
      <text x="105" y="190" textAnchor="middle" fontSize="13" fill={ink} fontFamily="inherit">
        Pantry · unopened
      </text>
      <rect x="210" y="40" width="170" height="160" rx="8" fill={water} />
      <rect x="220" y="110" width="150" height="6" fill={ink} opacity="0.3" />
      <Jar x={262} y={40} fill={jelly} label="JELLY" />
      <text x="295" y="190" textAnchor="middle" fontSize="13" fill={ink} fontFamily="inherit">
        Refrigerator · opened
      </text>
    </g>
  ),
  timer: (
    <g>
      <circle cx="200" cy="130" r="86" fill={surface} />
      <circle cx="200" cy="130" r="72" fill="var(--lms-art-bg)" />
      <rect x="186" y="24" width="28" height="18" rx="4" fill={ink} />
      <path d="M200 130 L200 70 A60 60 0 0 1 252 100 Z" fill={water} />
      <circle cx="200" cy="130" r="6" fill={ink} />
      <text x="200" y="176" textAnchor="middle" fontSize="20" fontWeight="600" fill={ink} fontFamily="inherit">
        20 s
      </text>
    </g>
  ),
};
