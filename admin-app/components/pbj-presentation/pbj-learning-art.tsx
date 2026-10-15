import {
  Droplets,
  Hand,
  UserRound,
  Smartphone,
  Ban,
  Check,
  ArrowRight,
  Utensils,
} from 'lucide-react';

const breadPath = 'M-72 65V-36C-99-91-26-108 0-78C30-108 98-89 72-36V65Z';
function Bread({
  x,
  y,
  scale = 1,
  fill = '#f1d8a3',
}: {
  x: number;
  y: number;
  scale?: number;
  fill?: string;
}) {
  return (
    <g transform={`translate(${x} ${y}) scale(${scale})`}>
      <path
        d={breadPath}
        fill={fill}
        stroke="#b6814c"
        strokeWidth="9"
        strokeLinejoin="round"
      />
    </g>
  );
}
function Jar({
  x,
  y,
  fill,
  mark,
}: {
  x: number;
  y: number;
  fill: string;
  mark: string;
}) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <rect
        x="-48"
        y="-60"
        width="96"
        height="132"
        rx="22"
        fill={fill}
        stroke="#dac8e1"
        strokeWidth="2"
      />
      <rect x="-51" y="-73" width="102" height="24" rx="6" fill="#aaa5c0" />
      <rect x="-39" y="-12" width="78" height="44" rx="4" fill="#f1e8d6" />
      <text
        textAnchor="middle"
        y="18"
        fill="#392c40"
        fontSize="21"
        fontWeight="700"
      >
        {mark}
      </text>
    </g>
  );
}
function Link({ x, y, width = 60 }: { x: number; y: number; width?: number }) {
  return (
    <ArrowRight
      x={x}
      y={y}
      width={width}
      height="40"
      color="#c7b5ed"
      strokeWidth="1.5"
    />
  );
}

/** Course-specific instructional artwork. Full equivalents live in slide data. */
export function PBJLearningArt({ kind }: { kind: string }) {
  if (!kind.startsWith('learn-')) return null;
  const key = kind.slice(6);
  return (
    <svg
      viewBox="0 0 600 400"
      preserveAspectRatio="xMidYMid meet"
      aria-hidden="true"
      focusable="false"
    >
      <ellipse cx="300" cy="337" rx="265" ry="28" fill="#302b3a" />
      {key === 'ingredients' && (
        <>
          <Bread x={128} y={215} />
          <Bread x={166} y={246} scale={0.9} />
          <Jar x={324} y={212} fill="#ad7547" mark="PB" />
          <Jar x={485} y={212} fill="#875379" mark="FRUIT" />
        </>
      )}
      {key.startsWith('bread-') && (
        <>
          <Bread x={190} y={211} />
          <Bread
            x={390}
            y={key === 'bread-match' ? 211 : 260}
            scale={key === 'bread-match' ? 1 : 0.7}
          />
          <path
            d="M100 306H500"
            stroke="#b7a2d2"
            strokeWidth="2"
            strokeDasharray="7 7"
          />
          {key === 'bread-match' ? (
            <Check x="266" y="75" width="68" height="68" color="#aad3ba" />
          ) : (
            <path
              d="M286 106L314 134M314 106L286 134"
              stroke="#dfbd8e"
              strokeWidth="5"
            />
          )}
        </>
      )}
      {key.startsWith('spread-') && (
        <>
          <Bread x={300} y={218} scale={1.45} />
          <path
            d="M218 164Q208 133 243 138Q268 147 290 138Q321 151 348 137Q396 134 381 170L379 291Q344 279 312 292Q271 280 222 292Z"
            fill={
              key.includes('smooth') || key.includes('crunchy')
                ? '#b27a43'
                : '#894c78'
            }
          />
          {['crunchy', 'jam', 'preserves'].some((v) => key.includes(v)) &&
            Array.from(
              { length: key.includes('preserves') ? 6 : 15 },
              (_, i) => (
                <ellipse
                  key={i}
                  cx={240 + ((i * 37) % 124)}
                  cy={160 + ((i * 53) % 111)}
                  rx={key.includes('preserves') ? 16 : 6}
                  ry={key.includes('preserves') ? 12 : 5}
                  fill={key.includes('crunchy') ? '#e4bf7b' : '#ba7ca5'}
                />
              ),
            )}
          <path
            d="M466 118L395 268"
            stroke="#a9b3c6"
            strokeWidth="23"
            strokeLinecap="round"
          />
        </>
      )}
      {key === 'label' && (
        <g transform="translate(150 18)">
          <rect width="300" height="355" rx="15" fill="#eee9df" />
          <text x="25" y="40" fill="#5e4e6a" fontSize="19" fontWeight="700">
            TRAINING EXAMPLE
          </text>
          <text x="25" y="83" fill="#28232d" fontSize="29" fontWeight="700">
            SAMPLE BREAD
          </text>
          <path d="M25 102H275" stroke="#75657d" />
          <text x="25" y="137" fill="#302835" fontSize="21">
            Ingredients
          </text>
          <text x="25" y="166" fill="#534759" fontSize="18">
            Wheat flour, water, yeast…
          </text>
          <text x="25" y="209" fill="#302835" fontSize="21" fontWeight="700">
            Contains: wheat
          </text>
          <text x="25" y="267" fill="#534759" fontSize="20">
            Date: check package
          </text>
          <text x="25" y="320" fill="#534759" fontSize="20">
            Storage: follow label
          </text>
        </g>
      )}
      {key === 'recipient' && (
        <>
          <UserRound x="34" y="145" width="110" height="110" color="#d3bfec" />
          <Link x={158} y={180} />
          <Jar x={278} y={202} fill="#aa794c" mark="PB" />
          <Link x={340} y={180} />
          <Utensils x="432" y="142" width="105" height="105" color="#acc5d6" />
          <path
            d="M218 301H562"
            stroke="#81758e"
            strokeWidth="8"
            strokeLinecap="round"
          />
        </>
      )}
      {key === 'transfer' && (
        <>
          <Jar x={83} y={203} fill="#af7847" mark="PB" />
          <Link x={141} y={180} />
          <path
            d="M225 128L245 267"
            stroke="#acb6c9"
            strokeWidth="22"
            strokeLinecap="round"
          />
          <circle cx="243" cy="246" r="15" fill="#bd884b" />
          <Link x={275} y={180} />
          <Bread x={397} y={220} scale={0.7} />
          <Link x={451} y={180} width={40} />
          <UserRound x="499" y="162" width="75" height="75" color="#d8c4ed" />
        </>
      )}
      {(key === 'uncertain' || key === 'interrupt') && (
        <>
          <Jar x={165} y={227} fill="#895676" mark="?" />
          {key === 'interrupt' ? (
            <Smartphone
              x="348"
              y="100"
              width="140"
              height="210"
              color="#b6b1d8"
            />
          ) : (
            <>
              <path
                d="M295 95L516 315H295Z"
                fill="#44382b"
                stroke="#e1ba7f"
                strokeWidth="4"
              />
              <text x="375" y="260" fontSize="90" fill="#e9cd98">
                !
              </text>
            </>
          )}
        </>
      )}
      {['wet', 'lather', 'scrub', 'rinse', 'dry', 'pause'].includes(key) && (
        <>
          {key === 'pause' ? (
            <Ban x="207" y="112" width="186" height="186" color="#deb987" />
          ) : (
            <>
              <Hand
                x="185"
                y="117"
                width="185"
                height="215"
                color="#d8ad91"
                strokeWidth="1.3"
              />
              {key === 'wet' || key === 'rinse' ? (
                <>
                  <path
                    d="M285 38H390V85"
                    fill="none"
                    stroke="#a3acbf"
                    strokeWidth="20"
                    strokeLinecap="round"
                  />
                  <Droplets
                    x="342"
                    y="87"
                    width="100"
                    height="145"
                    color="#acd6e8"
                    strokeWidth="1.2"
                  />
                </>
              ) : key === 'dry' ? (
                <path
                  d="M349 97L454 128L411 311L319 285Z"
                  fill="#a5c8d3"
                  stroke="#d1e5eb"
                  strokeWidth="4"
                />
              ) : (
                <>
                  {Array.from({ length: 8 }, (_, i) => (
                    <circle
                      key={i}
                      cx={238 + ((i * 29) % 110)}
                      cy={155 + ((i * 41) % 117)}
                      r={7 + (i % 3) * 4}
                      fill="#c2e0ed"
                      fillOpacity=".55"
                      stroke="#dceef6"
                    />
                  ))}
                  {key === 'scrub' && (
                    <>
                      <circle
                        cx="452"
                        cy="123"
                        r="57"
                        fill="#22353e"
                        stroke="#9fc9da"
                        strokeWidth="3"
                      />
                      <text
                        x="452"
                        y="124"
                        textAnchor="middle"
                        fill="#cce8f3"
                        fontSize="33"
                      >
                        20
                      </text>
                      <text
                        x="452"
                        y="151"
                        textAnchor="middle"
                        fill="#cce8f3"
                        fontSize="19"
                      >
                        seconds
                      </text>
                    </>
                  )}
                </>
              )}
            </>
          )}
        </>
      )}
    </svg>
  );
}
