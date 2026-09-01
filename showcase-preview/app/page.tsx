const applications = [
  {
    id: 'age',
    eyebrow: 'Identity and access',
    title: 'Privacy-preserving age verification',
    summary:
      'Prove an age condition without exposing a complete identity document or exact date of birth.',
    actors: ['Citizen', 'Identity authority', 'Wallet', 'Age-restricted service'],
    outcome: 'Trusted age decision with minimum disclosure',
    accent: 'blue',
  },
  {
    id: 'agriculture',
    eyebrow: 'Agriculture and finance',
    title: 'Farmer and land credentials for rural credit',
    summary:
      'Bring trusted farmer and land evidence from independent registries into a lender’s digital journey.',
    actors: ['Farmer', 'Farmer Registry', 'Land Registry', 'Lender'],
    outcome: 'Verified eligibility and maximum loan',
    accent: 'green',
  },
  {
    id: 'education',
    eyebrow: 'Learning and opportunity',
    title: 'Education credentials for admission and employment',
    summary:
      'Reuse credentials from School, College and University for different admission and employment purposes.',
    actors: ['Learner', 'School', 'College', 'University', 'Verifier'],
    outcome: 'Purpose-specific eligibility from trusted records',
    accent: 'violet',
  },
];

const capabilities = [
  'Configurable domain registries',
  'Independent credential issuers',
  'Standards-based credential exchange',
  'Holder consent and selective disclosure',
  'Reusable verification before domain decisions',
];

export default function Home() {
  return (
    <div className="site-shell">
      <header className="topbar">
        <a className="brand" href="#top" aria-label="Sunbird RC applications home">
          <span className="brand-mark" aria-hidden="true">rc</span>
          <span>Sunbird RC</span>
        </a>
        <div className="top-actions">
          <a href="#applications">Applications</a>
          <a href="#capabilities">Capabilities</a>
          <a className="repo-link" href="https://github.com/pallakartheekreddy/sunbird-rc-reference-implementations">
            Reference implementation ↗
          </a>
        </div>
      </header>

      <div className="page-grid" id="top">
        <aside className="sidebar" aria-label="Page navigation">
          <p className="nav-label">EXPLORE</p>
          <a className="active" href="#introduction">Applications of Sunbird RC</a>
          <a href="#applications">Reference applications</a>
          <a href="#capabilities">Reusable capabilities</a>
          <a href="#extend">Imagine another domain</a>
          <p className="nav-label second">USE CASES</p>
          <a href="#age">Age verification</a>
          <a href="#agriculture">Rural credit</a>
          <a href="#education">Education and employment</a>
        </aside>

        <main className="content">
          <section className="hero" id="introduction">
            <p className="breadcrumb">Applications · Sunbird RC in action</p>
            <h1>Trusted registries.<br />Portable credentials.<br /><span>Any domain.</span></h1>
            <p className="lead">
              Sunbird RC is a configurable, domain-neutral foundation for building trusted
              digital registries and credential ecosystems. The applications below are
              reference patterns designed to expand what implementers can imagine—not to
              limit where Sunbird RC can be used.
            </p>
            <div className="hero-actions">
              <a className="primary" href="#applications">Explore applications</a>
              <a className="secondary" href="#extend">See how the pattern extends</a>
            </div>
          </section>

          <section className="system-map" aria-labelledby="system-title">
            <div className="section-kicker">A REUSABLE PATTERN</div>
            <h2 id="system-title">From authoritative records to trusted services</h2>
            <div className="flow">
              <div className="flow-node">
                <span className="node-number">01</span>
                <strong>Registry</strong>
                <small>Authoritative domain records</small>
              </div>
              <span className="flow-arrow">→</span>
              <div className="flow-node primary-node">
                <span className="node-number">02</span>
                <strong>Credentials</strong>
                <small>Trusted, portable evidence</small>
              </div>
              <span className="flow-arrow">→</span>
              <div className="flow-node">
                <span className="node-number">03</span>
                <strong>Wallet</strong>
                <small>Holder control and consent</small>
              </div>
              <span className="flow-arrow">→</span>
              <div className="flow-node">
                <span className="node-number">04</span>
                <strong>Service</strong>
                <small>Verify, then decide</small>
              </div>
            </div>
          </section>

          <section id="applications">
            <div className="section-heading">
              <div>
                <p className="section-kicker">REFERENCE APPLICATIONS</p>
                <h2>Three examples. A much wider possibility.</h2>
              </div>
              <p>Each application combines the same foundation differently as the ecosystem becomes richer.</p>
            </div>

            <div className="application-list">
              {applications.map((app, index) => (
                <article className={`application-card ${app.accent}`} id={app.id} key={app.id}>
                  <div className="card-index">0{index + 1}</div>
                  <div className="card-body">
                    <p className="eyebrow">{app.eyebrow}</p>
                    <h3>{app.title}</h3>
                    <p>{app.summary}</p>
                    <div className="actor-row" aria-label="Ecosystem actors">
                      {app.actors.map((actor) => <span key={actor}>{actor}</span>)}
                    </div>
                    <div className="outcome"><span>Outcome</span>{app.outcome}</div>
                  </div>
                  <a className="card-link" href={`#${app.id}-detail`} aria-label={`Explore ${app.title}`}>→</a>
                </article>
              ))}
            </div>
          </section>

          <section className="capabilities" id="capabilities">
            <div>
              <p className="section-kicker">WHAT SUNBIRD RC CONTRIBUTES</p>
              <h2>A foundation ecosystems configure for themselves</h2>
              <p>
                Authorities define the records, identifiers, governance, credentials,
                trust and service rules appropriate to their context. Sunbird RC supplies
                reusable Registry and Credential building blocks.
              </p>
            </div>
            <ul>
              {capabilities.map((capability, index) => (
                <li key={capability}><span>0{index + 1}</span>{capability}</li>
              ))}
            </ul>
          </section>

          <section className="possibilities" id="extend">
            <p className="section-kicker">EXPAND THE IMAGINATION</p>
            <h2>What could your ecosystem make portable and trustworthy?</h2>
            <div className="possibility-grid">
              {['Professional licences', 'Health workers and facilities', 'Business registrations', 'Social-protection entitlements', 'Skills and training', 'Property and assets', 'Memberships', 'Supply chains'].map((item) => (
                <span key={item}>{item}</span>
              ))}
            </div>
            <p className="note">
              These are possibilities, not product boundaries. Any implementation must
              establish its own governance, privacy, security and standards compatibility.
            </p>
          </section>

          <section className="video-panel">
            <div className="video-art" aria-hidden="true"><span>▶</span></div>
            <div>
              <p className="section-kicker">VIDEO OVERVIEW</p>
              <h2>See Sunbird RC across sectors</h2>
              <p>The final public video will introduce the common pattern, show the three working applications and open out to additional domains.</p>
              <span className="coming-soon">Public showcase video · coming soon</span>
            </div>
          </section>
        </main>

        <aside className="right-rail">
          <div className="rail-card">
            <p className="section-kicker">ON THIS PAGE</p>
            <a href="#introduction">Introduction</a>
            <a href="#applications">Applications</a>
            <a href="#capabilities">Capabilities</a>
            <a href="#extend">Extend the pattern</a>
          </div>
          <div className="rail-card soft">
            <strong>Reference, not restriction</strong>
            <p>Age, Agriculture and Education demonstrate the pattern. Sunbird RC remains domain-neutral.</p>
          </div>
        </aside>
      </div>
    </div>
  );
}
