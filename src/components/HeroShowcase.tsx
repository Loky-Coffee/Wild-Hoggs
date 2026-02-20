import './HeroShowcase.css';

const IMGS = [
  '/images/heroes/athena1.png',
  '/images/heroes/athena2.png',
  '/images/heroes/athena3.png',
];
const img = (n: number) => IMGS[(n - 1) % 3];

const NAME  = 'Guard of Order';
const TYPE  = 'Gathering';

function Num({ n }: { n: number }) {
  return <span className="sc-num">{n}</span>;
}

function BlueBadge() {
  return <span className="sc-badge">Blue</span>;
}

export default function HeroShowcase() {
  return (
    <div className="sc-grid">

      {/* ── 1: Bottom gradient (baseline) ── */}
      <div className="sc-card sc-s1">
        <Num n={1} />
        <img src={img(1)} alt={NAME} className="sc-img" />
        <div className="sc-overlay-bottom">
          <BlueBadge />
          <span className="sc-name">{NAME}</span>
          <span className="sc-type">{TYPE}</span>
        </div>
      </div>

      {/* ── 2: Frosted glass panel below image ── */}
      <div className="sc-card sc-s2">
        <Num n={2} />
        <div className="sc-s2-imgwrap">
          <img src={img(2)} alt={NAME} className="sc-img" />
        </div>
        <div className="sc-s2-glass">
          <BlueBadge />
          <span className="sc-name">{NAME}</span>
          <span className="sc-type">{TYPE}</span>
        </div>
      </div>

      {/* ── 3: Outline transparent ── */}
      <div className="sc-card sc-s3">
        <Num n={3} />
        <img src={img(3)} alt={NAME} className="sc-img" />
        <div className="sc-overlay-bottom sc-overlay-minimal">
          <span className="sc-name">{NAME}</span>
          <span className="sc-type">{TYPE}</span>
        </div>
      </div>

      {/* ── 4: Top dark overlay ── */}
      <div className="sc-card sc-s4">
        <Num n={4} />
        <img src={img(1)} alt={NAME} className="sc-img" />
        <div className="sc-overlay-top">
          <BlueBadge />
          <span className="sc-name">{NAME}</span>
          <span className="sc-type">{TYPE}</span>
        </div>
      </div>

      {/* ── 5: Solid nameplate band ── */}
      <div className="sc-card sc-s5">
        <Num n={5} />
        <img src={img(2)} alt={NAME} className="sc-img" />
        <div className="sc-nameplate">
          <BlueBadge />
          <span className="sc-name">{NAME}</span>
        </div>
      </div>

      {/* ── 6: Neon dark moody ── */}
      <div className="sc-card sc-s6">
        <Num n={6} />
        <img src={img(3)} alt={NAME} className="sc-img sc-img-tint" />
        <div className="sc-overlay-bottom">
          <BlueBadge />
          <span className="sc-name">{NAME}</span>
          <span className="sc-type">{TYPE}</span>
        </div>
        <div className="sc-scanlines" />
      </div>

      {/* ── 7: Horizontal banner ── */}
      <div className="sc-card sc-s7">
        <Num n={7} />
        <div className="sc-s7-imgcol">
          <img src={img(1)} alt={NAME} className="sc-img" />
        </div>
        <div className="sc-s7-info">
          <BlueBadge />
          <span className="sc-name">{NAME}</span>
          <span className="sc-type">{TYPE}</span>
          <span className="sc-s7-tag">Global Passive</span>
        </div>
      </div>

      {/* ── 8: Circle portrait on dark card ── */}
      <div className="sc-card sc-s8">
        <Num n={8} />
        <div className="sc-s8-circle">
          <img src={img(2)} alt={NAME} className="sc-img" />
        </div>
        <div className="sc-s8-info">
          <BlueBadge />
          <span className="sc-name">{NAME}</span>
          <span className="sc-type">{TYPE}</span>
        </div>
      </div>

      {/* ── 9: Polaroid ── */}
      <div className="sc-card sc-s9">
        <Num n={9} />
        <div className="sc-s9-imgwrap">
          <img src={img(3)} alt={NAME} className="sc-img" />
        </div>
        <div className="sc-s9-caption">
          <span className="sc-name sc-name-dark">{NAME}</span>
          <span className="sc-type sc-type-dark">{TYPE} · Blue</span>
        </div>
      </div>

      {/* ── 10: Diagonal accent stripe ── */}
      <div className="sc-card sc-s10">
        <Num n={10} />
        <img src={img(1)} alt={NAME} className="sc-img" />
        <div className="sc-s10-stripe" />
        <div className="sc-s10-info">
          <span className="sc-name">{NAME}</span>
          <BlueBadge />
        </div>
      </div>

      {/* ── 11: Clean card with info below image ── */}
      <div className="sc-card sc-s11">
        <Num n={11} />
        <div className="sc-s11-imgwrap">
          <img src={img(2)} alt={NAME} className="sc-img" />
        </div>
        <div className="sc-s11-info">
          <span className="sc-name">{NAME}</span>
          <div className="sc-s11-tags">
            <BlueBadge />
            <span className="sc-s11-type">{TYPE}</span>
          </div>
        </div>
      </div>

      {/* ── 12: Full color wash overlay ── */}
      <div className="sc-card sc-s12">
        <Num n={12} />
        <img src={img(3)} alt={NAME} className="sc-img" />
        <div className="sc-s12-wash" />
        <div className="sc-overlay-bottom">
          <BlueBadge />
          <span className="sc-name">{NAME}</span>
          <span className="sc-type">{TYPE}</span>
        </div>
      </div>

      {/* ── 13: Cinematic film bars ── */}
      <div className="sc-card sc-s13">
        <Num n={13} />
        <img src={img(1)} alt={NAME} className="sc-img" />
        <div className="sc-s13-bar sc-s13-top" />
        <div className="sc-s13-bar sc-s13-bottom">
          <span className="sc-name">{NAME}</span>
          <span className="sc-type sc-type-muted">{TYPE} · Blue</span>
        </div>
      </div>

      {/* ── 14: Trophy achievement plate ── */}
      <div className="sc-card sc-s14">
        <Num n={14} />
        <div className="sc-s14-imgwrap">
          <img src={img(2)} alt={NAME} className="sc-img" />
        </div>
        <div className="sc-s14-plate">
          <span className="sc-s14-platename">{NAME}</span>
          <div className="sc-s14-row">
            <BlueBadge />
            <span className="sc-s14-type">{TYPE}</span>
          </div>
        </div>
      </div>

      {/* ── 15: Vertical diagonal split ── */}
      <div className="sc-card sc-s15">
        <Num n={15} />
        <img src={img(3)} alt={NAME} className="sc-img" />
        <div className="sc-s15-panel">
          <span className="sc-name">{NAME}</span>
          <BlueBadge />
          <span className="sc-type">{TYPE}</span>
        </div>
      </div>

      {/* ── 16: Just the photo + border, fully transparent ── */}
      <div className="sc-card sc-s16">
        <Num n={16} />
        <img src={img(2)} alt={NAME} className="sc-img" />
      </div>

    </div>
  );
}
