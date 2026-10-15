import { Droplets, Hand, Trash2, Shirt } from 'lucide-react';

const crust =
  'M145 315V134C100 76 186 41 225 67C263 32 342 42 375 76C437 59 476 98 443 137V315Z';
function Slice({ kind }: { kind: string }) {
  const before = kind.endsWith('before');
  const fruit = kind.startsWith('thickness');
  return (
    <>
      <ellipse cx="300" cy="344" rx="242" ry="29" fill="#37303e" />
      <path
        d={crust}
        fill="#edcf92"
        stroke="#ad7947"
        strokeWidth="12"
        strokeLinejoin="round"
      />
      <path
        d={
          kind === 'coverage-before'
            ? 'M252 165Q339 105 362 185Q380 252 268 257Q213 223 252 165Z'
            : 'M164 297V145Q129 97 223 89Q270 63 373 97Q443 86 425 146V297Z'
        }
        fill={fruit ? '#985077' : '#b47742'}
      />
      {!fruit && kind !== 'coverage-before' && (
        <path
          d="M198 174Q286 141 390 165M189 226Q298 206 394 219M198 273Q290 250 392 266"
          stroke="#d6a36d"
          strokeWidth="8"
          strokeLinecap="round"
          fill="none"
        />
      )}
      {kind === 'pressure-before' && (
        <path
          d="M310 107L284 165L322 186L280 236L315 250L297 315H346L334 265L358 233L339 199L365 158Z"
          fill="#211c28"
          stroke="#c19c6a"
          strokeWidth="5"
        />
      )}
      {fruit && (
        <path
          d="M197 161Q290 138 390 159M193 219Q296 200 396 214M199 269Q288 249 390 271"
          stroke="#c4779d"
          strokeWidth={before ? '18' : '8'}
          strokeLinecap="round"
          fill="none"
        />
      )}
      {fruit && before && (
        <>
          <path
            d="M165 290Q220 269 234 313Q221 343 201 333Q165 330 165 290M372 282Q426 274 438 314Q430 344 398 329Z"
            fill="#985077"
          />
          <ellipse cx="263" cy="349" rx="21" ry="9" fill="#985077" />
        </>
      )}
    </>
  );
}
function Sandwich({ imperfect = false }: { imperfect?: boolean }) {
  return (
    <>
      <ellipse
        cx="300"
        cy="291"
        rx="258"
        ry="84"
        fill="#cbd0df"
        stroke="#f3f0f5"
        strokeWidth="4"
      />
      <ellipse cx="300" cy="288" rx="228" ry="62" fill="#e1deea" />
      <g strokeLinejoin="round">
        <path
          d={
            imperfect
              ? 'M91 175L297 151L312 292L100 300Z'
              : 'M104 173L283 154L282 293L103 294Z'
          }
          fill="#d3aa68"
          stroke="#a57140"
          strokeWidth="7"
        />
        <path
          d={
            imperfect
              ? 'M91 180L297 157L309 271L101 284Z'
              : 'M104 180L282 161L281 272L104 277Z'
          }
          fill="#e8c991"
        />
        <path
          d={
            imperfect
              ? 'M94 254L308 239L312 262L99 278Z'
              : 'M105 252L282 239V256L105 270Z'
          }
          fill="#a36b3d"
        />
        <path
          d={
            imperfect
              ? 'M93 267L310 253L314 280L99 291Z'
              : 'M105 267L282 253V263L105 280Z'
          }
          fill="#975070"
        />
        <path
          d={
            imperfect
              ? 'M348 173L472 181L484 289L347 283Z'
              : 'M321 156L499 175L499 293L321 292Z'
          }
          fill="#e8c991"
          stroke="#a57140"
          strokeWidth="7"
        />
        <path
          d={
            imperfect
              ? 'M348 246L480 254L483 271L348 263Z'
              : 'M323 240L498 255V271L323 257Z'
          }
          fill="#a36b3d"
        />
        <path
          d={
            imperfect
              ? 'M347 261L484 269L485 282L348 277Z'
              : 'M323 257L498 269V280L323 268Z'
          }
          fill="#975070"
        />
      </g>
      {imperfect && (
        <>
          <path
            d="M177 280Q206 269 229 288Q247 310 229 324Q207 345 194 319Q175 310 177 280Z"
            fill="#975070"
          />
          <ellipse cx="248" cy="328" rx="20" ry="9" fill="#975070" />
        </>
      )}
    </>
  );
}
function Tools({ used }: { used: boolean }) {
  return (
    <>
      <rect
        x="45"
        y="58"
        width="510"
        height="284"
        rx="20"
        fill="#31303b"
        stroke="#65596f"
        strokeWidth="3"
      />
      {[150, 300, 450].map((x, i) => (
        <g key={x} transform={`translate(${x} 83)`}>
          <rect
            x="-15"
            y="116"
            width="30"
            height="114"
            rx="12"
            fill={i === 2 ? '#7e8596' : '#b3a4ce'}
          />
          <path
            d={
              i === 2
                ? 'M-13 118V5Q40 5 27 116Z'
                : 'M-14 122Q-38 17 0 7Q38 17 14 122Z'
            }
            fill="#c6ccd5"
            stroke="#e4e5e9"
            strokeWidth="3"
          />
          {used && i < 2 && (
            <path
              d="M-18 32Q24 8 22 55L12 111L-9 94Z"
              fill={i === 0 ? '#ab7442' : '#945170'}
            />
          )}
        </g>
      ))}
      {!used && (
        <path
          d="M82 319H518"
          stroke="#a6c9be"
          strokeWidth="3"
          strokeDasharray="6 8"
        />
      )}
    </>
  );
}
function Board({ clean }: { clean: boolean }) {
  return (
    <>
      <path
        d="M34 304L566 304L577 365H24Z"
        fill="#38333e"
        stroke="#65576e"
        strokeWidth="3"
      />
      <rect
        x={clean ? '179' : '96'}
        y={clean ? '50' : '151'}
        width={clean ? '250' : '407'}
        height={clean ? '272' : '177'}
        rx="20"
        fill="#ba9668"
        stroke="#e6cba2"
        strokeWidth="5"
      />
      <circle
        cx={clean ? '389' : '462'}
        cy={clean ? '85' : '184'}
        r="11"
        fill="#413645"
      />
      {clean ? (
        <>
          <path
            d="M149 333L169 280M441 333L424 282"
            stroke="#a8c4ba"
            strokeWidth="7"
            strokeLinecap="round"
          />
          <path
            d="M140 140V251M459 140V251"
            stroke="#a8c4ba"
            strokeWidth="3"
            strokeDasharray="8 8"
          />
        </>
      ) : (
        <>
          {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
            <circle
              key={i}
              cx={143 + ((i * 61) % 310)}
              cy={194 + ((i * 37) % 104)}
              r={4 + (i % 3)}
              fill="#ead3a4"
            />
          ))}
          <path d="M261 194Q316 195 350 235L327 257L258 230Z" fill="#975572" />
          <path
            d="M66 329L87 341M476 344L499 338"
            stroke="#dbba8c"
            strokeWidth="8"
          />
        </>
      )}
    </>
  );
}
function Towels({ cleared }: { cleared: boolean }) {
  return cleared ? (
    <>
      <Trash2
        x="65"
        y="193"
        width="130"
        height="142"
        color="#b4bdcf"
        strokeWidth="1.5"
      />
      <path d="M95 243L146 216L166 262L112 274Z" fill="#d4cedc" />
      <rect
        x="240"
        y="226"
        width="130"
        height="110"
        rx="12"
        fill="#514658"
        stroke="#b7a0c9"
        strokeWidth="3"
      />
      <Shirt
        x="253"
        y="163"
        width="104"
        height="112"
        color="#b7a0c9"
        fill="#4c405a"
      />
      <Hand
        x="427"
        y="183"
        width="114"
        height="149"
        color="#dfbaa4"
        strokeWidth="1.4"
      />
      <Droplets
        x="446"
        y="80"
        width="91"
        height="93"
        color="#a9d5e8"
        strokeWidth="1.6"
      />
    </>
  ) : (
    <>
      <rect x="55" y="118" width="490" height="214" rx="20" fill="#35303c" />
      <path
        d="M104 154L238 139L271 277L130 295Z"
        fill="#c9c4d2"
        stroke="#f1eaf4"
        strokeWidth="3"
      />
      <path d="M147 193L198 175L219 231L164 246Z" fill="#9a754e" />
      <path
        d="M323 138Q362 159 456 127L504 298Q391 282 350 314Z"
        fill="#8f7da5"
        stroke="#bca9d0"
        strokeWidth="3"
      />
      <path d="M380 187Q411 172 435 198L430 251L385 241Z" fill="#985778" />
    </>
  );
}
/** These illustrations show observable quality; they never establish allergen suitability. */
export function PBJQualityArt({ kind }: { kind: string }) {
  const key = kind.replace('quality-', '');
  return (
    <svg viewBox="0 0 600 400" aria-hidden="true" focusable="false">
      {key === 'inspect' && <Sandwich imperfect />}
      {key === 'serve' && <Sandwich />}
      {key === 'pack' && (
        <>
          <ellipse cx="300" cy="328" rx="219" ry="29" fill="#302c38" />
          <path
            d="M108 121L376 85L489 161L479 291L213 323L105 247Z"
            fill="#c6baa7"
            stroke="#eee4d3"
            strokeWidth="5"
            strokeLinejoin="round"
          />
          <path
            d="M108 121L296 226L489 161M296 226L213 323M376 85L318 191"
            fill="none"
            stroke="#918879"
            strokeWidth="4"
          />
        </>
      )}
      {['pressure', 'thickness', 'coverage'].some((prefix) =>
        key.startsWith(prefix),
      ) && <Slice kind={key} />}
      {key.startsWith('tools-') && <Tools used={key.endsWith('before')} />}
      {key.startsWith('board-') && <Board clean={key.endsWith('after')} />}
      {key.startsWith('towels-') && <Towels cleared={key.endsWith('after')} />}
    </svg>
  );
}
