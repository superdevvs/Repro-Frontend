import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Logo } from '@/components/layout/Logo';
import { BRAND_NAME } from '@/config/brand';
import './NotFound.css';

const SERVICES_URL = 'https://reprophotos.com/services/';
const PAGE_TITLE = `Page not found · ${BRAND_NAME}`;

type PageTheme = 'light' | 'dark';

const NotFound = () => {
  const location = useLocation();
  const [theme, setTheme] = useState<PageTheme>('dark');

  useEffect(() => {
    console.error('404 Error: User attempted to access non-existent route:', location.pathname);
  }, [location.pathname]);

  useEffect(() => {
    const previousTitle = document.title;
    document.title = PAGE_TITLE;
    return () => {
      document.title = previousTitle;
    };
  }, []);

  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    const previousHtml = html.style.backgroundColor;
    const previousBody = body.style.backgroundColor;
    const paper = theme === 'dark' ? '#071018' : '#f4f7fb';
    html.style.backgroundColor = paper;
    body.style.backgroundColor = paper;
    return () => {
      html.style.backgroundColor = previousHtml;
      body.style.backgroundColor = previousBody;
    };
  }, [theme]);

  return (
    <div className="not-found draw" data-theme={theme}>
      <div className="not-found-chrome">
        <button
          type="button"
          data-theme="light"
          aria-pressed={theme === 'light'}
          onClick={() => setTheme('light')}
        >
          Light
        </button>
        <button
          type="button"
          data-theme="dark"
          aria-pressed={theme === 'dark'}
          onClick={() => setTheme('dark')}
        >
          Dark
        </button>
      </div>

      <main className="not-found-page">
        <Link className="not-found-brand" to="/" aria-label={BRAND_NAME}>
          <Logo variant={theme === 'dark' ? 'light' : 'dark'} />
        </Link>

        <div className="not-found-drawing" aria-hidden="true">
          <svg viewBox="0 0 1040 400">
            <defs>
              <linearGradient id="nf-room-sky" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="var(--room-sky-a)" />
                <stop offset="1" stopColor="var(--room-sky-b)" />
              </linearGradient>
              <linearGradient id="nf-city-fade" x1="0" y1="348" x2="0" y2="197" gradientUnits="userSpaceOnUse">
                <stop offset="0" stopColor="#fff" />
                <stop offset=".35" stopColor="#fff" stopOpacity=".95" />
                <stop offset=".65" stopColor="#fff" stopOpacity=".5" />
                <stop offset="1" stopColor="#fff" stopOpacity=".18" />
              </linearGradient>
              <mask id="nf-city-mask" maskUnits="userSpaceOnUse">
                <rect x="450" y="124" width="140" height="224" fill="url(#nf-city-fade)" />
              </mask>
              <clipPath id="nf-door">
                <rect x="450" y="124" width="140" height="224" />
              </clipPath>
            </defs>

            <g className="guide">
              <line x1="24" y1="200" x2="1016" y2="200" />
              <line x1="216" y1="22" x2="216" y2="378" />
              <line x1="520" y1="22" x2="520" y2="378" />
              <line x1="824" y1="22" x2="824" y2="378" />
            </g>

            <rect className="plinth" x="98" y="348" width="844" height="2" />
            <line className="plinth-edge" x1="98" y1="348" x2="942" y2="348" />

            <g className="glyph four-a">
              <rect x="294" y="68" width="56" height="280" />
              <rect x="98" y="228" width="196" height="56" />
              <path d="M98 228 L294 68 L294 124 L170 228 Z" />
            </g>

            <g className="room" clipPath="url(#nf-door)">
              <rect className="room-sky" x="450" y="124" width="140" height="224" />

              <g className="skyline" mask="url(#nf-city-mask)">
                <g className="room-city-far">
                  <rect x="478" y="270" width="10" height="78" />
                  <rect x="548" y="272" width="12" height="76" />
                </g>
                <g className="room-city">
                  <rect x="454" y="264" width="10" height="84" />
                  <rect x="466" y="249" width="14" height="99" />
                  <rect className="city-win" x="468" y="251" width="3" height="6" />
                  <rect className="city-win" x="473" y="256" width="3" height="6" />
                  <rect className="city-win" x="468" y="263" width="3" height="6" />
                  <rect className="city-win" x="473" y="267" width="3" height="6" />
                  <rect x="482" y="228" width="14" height="120" />
                  <rect x="485" y="218" width="8" height="10" />
                  <rect x="487" y="208" width="4" height="10" />
                  <rect x="488.2" y="197" width="1.6" height="11" />
                  <rect className="city-win" x="484" y="232" width="3.2" height="6" />
                  <rect className="city-win" x="490" y="240" width="3.2" height="6" />
                  <rect className="city-win" x="484" y="249" width="3.2" height="6" />
                  <rect className="city-win" x="490" y="257" width="3.2" height="6" />
                  <rect x="498" y="258" width="18" height="90" />
                  <rect x="518" y="239" width="12" height="109" />
                  <rect x="521" y="229" width="6" height="10" />
                  <path d="M524 229 L520 221 L528 221 Z" />
                  <rect x="523.2" y="209" width="1.6" height="11" />
                  <rect x="532" y="254" width="16" height="94" />
                  <rect className="city-win" x="535" y="258" width="4" height="6" />
                  <rect className="city-win" x="541" y="264" width="4" height="6" />
                  <rect className="city-win" x="535" y="271" width="4" height="6" />
                  <rect x="550" y="244" width="10" height="104" />
                  <rect x="552" y="235" width="6" height="10" />
                  <rect x="562" y="263" width="14" height="85" />
                  <rect x="578" y="272" width="8" height="76" />
                </g>
              </g>

              <g className="glass-door">
                <path className="door-handle" d="M450 224 H458" />
                <circle className="door-handle" cx="450" cy="224" r="1.8" />
              </g>

              <g className="furn">
                <rect className="room-seat-fill room-furn" x="504" y="322" width="60" height="8" rx="2.5" />
                <g className="room-furn">
                  <line x1="514" y1="330" x2="510" y2="346" />
                  <line x1="524" y1="330" x2="522" y2="348" />
                  <line x1="544" y1="330" x2="546" y2="348" />
                  <line x1="554" y1="330" x2="558" y2="346" />
                </g>
                <g className="camera-idle">
                  <rect className="cam-body" x="516" y="304" width="32" height="18" rx="2.6" />
                  <rect className="cam-body" x="526" y="298" width="12" height="6.5" rx="1" />
                  <circle className="cam-lens" cx="532" cy="313" r="6.4" />
                  <circle className="cam-lens-in" cx="532" cy="313" r="3.4" />
                  <circle className="cam-glint" cx="530" cy="311" r="1.15" />
                </g>
              </g>
            </g>
            <path className="glyph gate" d="M394 68 H646 V348 H590 V124 H450 V348 H394 Z" />

            <g className="glyph four-b">
              <rect x="886" y="68" width="56" height="280" />
              <rect x="690" y="228" width="196" height="56" />
              <path d="M690 228 L886 68 L886 124 L762 228 Z" />
            </g>

            <g className="ink">
              <line className="ink-dash" x1="322" y1="68" x2="322" y2="348" />
              <line className="ink-dash" x1="98" y1="256" x2="350" y2="256" />
              <line className="ink-dash" x1="98" y1="228" x2="294" y2="68" />
              <line x1="316" y1="250" x2="328" y2="262" />
              <line x1="316" y1="262" x2="328" y2="250" />
              <line className="ink-dash" x1="914" y1="68" x2="914" y2="348" />
              <line className="ink-dash" x1="690" y1="256" x2="942" y2="256" />
              <line className="ink-dash" x1="690" y1="228" x2="886" y2="68" />
              <line x1="908" y1="250" x2="920" y2="262" />
              <line x1="908" y1="262" x2="920" y2="250" />
            </g>

            <g className="dim">
              <line x1="98" y1="36" x2="350" y2="36" />
              <line x1="98" y1="30" x2="98" y2="42" />
              <line x1="350" y1="30" x2="350" y2="42" />
              <line x1="394" y1="36" x2="646" y2="36" />
              <line x1="394" y1="30" x2="394" y2="42" />
              <line x1="646" y1="30" x2="646" y2="42" />
              <line x1="690" y1="36" x2="942" y2="36" />
              <line x1="690" y1="30" x2="690" y2="42" />
              <line x1="942" y1="30" x2="942" y2="42" />
              <line x1="28" y1="68" x2="28" y2="348" />
              <line x1="22" y1="68" x2="34" y2="68" />
              <line x1="22" y1="348" x2="34" y2="348" />
              <line x1="1012" y1="68" x2="1012" y2="348" />
              <line x1="1006" y1="68" x2="1018" y2="68" />
              <line x1="1006" y1="348" x2="1018" y2="348" />
            </g>
            <g className="tick">
              <line x1="210" y1="194" x2="222" y2="206" />
              <line x1="210" y1="206" x2="222" y2="194" />
              <line x1="514" y1="194" x2="526" y2="206" />
              <line x1="514" y1="206" x2="526" y2="194" />
              <line x1="818" y1="194" x2="830" y2="206" />
              <line x1="818" y1="206" x2="830" y2="194" />
            </g>
            <text className="label" x="224" y="28" textAnchor="middle">24′-0″</text>
            <text className="label" x="816" y="28" textAnchor="middle">24′-0″</text>
            <text className="label" x="16" y="214" textAnchor="middle" transform="rotate(-90 16 214)">18′-0″</text>
            <text className="label" x="1024" y="214" textAnchor="middle" transform="rotate(90 1024 214)">18′-0″</text>
          </svg>
        </div>

        <div className="not-found-copy">
          <h1>This page is under a different plan</h1>
          <p>It might have been moved, renamed, or doesn’t exist.</p>
          <div className="not-found-actions">
            <Link className="not-found-cta" to="/">
              Go to Homepage <span aria-hidden="true">→</span>
            </Link>
            <a
              className="not-found-ghost"
              href={SERVICES_URL}
              target="_blank"
              rel="noopener noreferrer"
            >
              Explore Our Services
            </a>
          </div>
        </div>
        <div className="not-found-foot">Spaces · People · Stories · Possibilities</div>
      </main>
    </div>
  );
};

export default NotFound;
