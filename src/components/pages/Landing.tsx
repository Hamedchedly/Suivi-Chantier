import { LogIn, ArrowRight, Building2, LineChart, HardHat, CalendarRange, ClipboardCheck, Wallet, LayoutGrid, TriangleAlert, ShieldCheck, Lock, RefreshCw, Check } from 'lucide-react'

interface Props {
  onConnect: () => void
  onRequestDemo: () => void
  /** Fausse la démo publique quand le serveur n'est pas configuré (mode local). */
  remote: boolean
}

function Mark({ size = 21 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 56 56" aria-hidden="true">
      <rect x="6" y="16" width="40" height="7" rx="3.5" fill="#fff" opacity=".22" />
      <rect x="6" y="16" width="29" height="7" rx="3.5" fill="#97CADB" />
      <rect x="6" y="26" width="40" height="7" rx="3.5" fill="#fff" opacity=".22" />
      <rect x="6" y="26" width="22" height="7" rx="3.5" fill="#fff" />
      <rect x="6" y="36" width="40" height="7" rx="3.5" fill="#fff" opacity=".22" />
      <rect x="6" y="36" width="35" height="7" rx="3.5" fill="#56B6D6" />
      <rect x="32" y="12" width="3" height="35" rx="1.5" fill="#fff" opacity=".9" />
    </svg>
  )
}

const ROLES = [
  { icon: Building2, tag: "Maîtrise d'ouvrage (MOA)", title: 'La vision, sans le détail technique',
    items: ['Avancement global et dérive en un coup d’œil', 'Budget engagé, facturé, avenants', 'Consultation claire, sans jargon'] },
  { icon: LineChart, tag: "Maîtrise d'œuvre (MOE / MOEX)", title: 'Le pilotage, réserve par réserve',
    items: ['Visites, réserves et comptes rendus', 'Dérive réelle vs planning contractuel', 'Engagements des entreprises tenus ou non'] },
  { icon: HardHat, tag: 'Conducteur de travaux', title: 'Le terrain, jour après jour',
    items: ['Planning éditable et avancement par tâche', 'Réserves prises sur mobile, avec photos', 'Bâtiments, niveaux et logements par zone'] },
]

const FEATURES = [
  { icon: CalendarRange, t: 'Planning & Gantt', d: 'Barres déplaçables, liens entre tâches, dates contractuelles et dérive réelle calculée sur l’avancement.' },
  { icon: ClipboardCheck, t: 'Visites & réserves', d: 'Sessions de contrôle terrain, réserves suivies jusqu’à la levée, comptes rendus prêts à diffuser.' },
  { icon: Wallet, t: 'Finances', d: 'Marchés, avenants et situations. Budget engagé, facturé et payé — sans ressaisie dans un tableur.' },
  { icon: LayoutGrid, t: 'Bâtiments & zones', d: 'Décrivez l’opération — bâtiments, niveaux, logements — et rattachez chaque tâche à sa zone.' },
  { icon: TriangleAlert, t: 'Alertes & dérives', d: 'Retards, engagements non tenus et points à vérifier remontent d’eux-mêmes. Vous voyez où agir.' },
  { icon: LayoutGrid, t: 'Plusieurs opérations', d: 'Chaque chantier a ses données. Basculez d’une opération à l’autre depuis votre espace.' },
]

const SECU = [
  { icon: Lock, t: 'Connexion sécurisée', d: 'Authentification e-mail / identifiant, mots de passe chiffrés, chaque compte cloisonné à ses données.' },
  { icon: ShieldCheck, t: 'Accès par rôle', d: 'Un super-administrateur gère les comptes et ouvre exactement les modules utiles à chacun.' },
  { icon: RefreshCw, t: 'Synchronisé, multi-appareils', d: 'Le travail suit l’utilisateur ; une édition hors-ligne se resynchronise au retour du réseau.' },
  { icon: ShieldCheck, t: 'Installable, hors-ligne', d: 'Application web installable (PWA), consultable même sans connexion.' },
]

export function Landing({ onConnect, onRequestDemo, remote }: Props) {
  return (
    <div className="lp-root">
      <style>{LP_CSS}</style>

      <header className="lp-nav">
        <div className="lp-wrap lp-nav-in">
          <div className="lp-brand"><span className="lp-chip"><Mark /></span>Suivi Chantier</div>
          <nav className="lp-links">
            <a href="#lp-roles" className="lp-lnk">Pour qui</a>
            <a href="#lp-fn" className="lp-lnk">Fonctions</a>
            <a href="#lp-sec" className="lp-lnk">Sécurité</a>
            <button className="lp-btn lp-ghost lp-sm" onClick={onConnect}><LogIn size={15} /> Se connecter</button>
            {remote && <button className="lp-btn lp-primary lp-sm" onClick={onRequestDemo}>Demander une démo</button>}
          </nav>
        </div>
      </header>

      <section className="lp-hero">
        <div className="lp-wrap lp-hero-grid">
          <div>
            <div className="lp-eyebrow">Application PWA de suivi de chantier bâtiment</div>
            <h1>Le chantier au clair, pour tous ceux qui le pilotent.</h1>
            <p className="lp-lead">Planning, visites, réserves, entreprises et finances d’une opération, réunis dans un même outil. Pensé pour le maître d’ouvrage, la maîtrise d’œuvre et le conducteur de travaux.</p>
            <div className="lp-cta">
              <button className="lp-btn lp-primary" onClick={remote ? onRequestDemo : onConnect}>
                {remote ? 'Demander une démo' : 'Se connecter'} <ArrowRight size={17} />
              </button>
              <a className="lp-btn lp-ghost" href="#lp-fn">Voir les fonctions</a>
            </div>
            <div className="lp-micro">
              <span><i className="lp-dot" />Synchronisé multi-appareils</span>
              <span><i className="lp-dot" />Fonctionne hors-ligne</span>
              <span><i className="lp-dot" />Données chiffrées</span>
            </div>
          </div>

          <div className="lp-mock" role="img" aria-label="Tableau de bord d’une opération : 48 % d’avancement, dérive maximale de 114 jours, 2 réserves ouvertes, 53 % de budget facturé.">
            <div className="lp-mock-top">
              <span className="lp-tl" style={{ background: '#e2564a' }} />
              <span className="lp-tl" style={{ background: '#f2b23e' }} />
              <span className="lp-tl" style={{ background: '#39b76a' }} />
              <span className="lp-mtt">Résidence Les Tilleuls — RT-2026</span>
              <span className="lp-mrt">Épernay (51)</span>
            </div>
            <div className="lp-mock-body">
              <div className="lp-kpis">
                <div className="lp-kpi"><div className="lp-lab">Avancement</div><div className="lp-val">48 %</div></div>
                <div className="lp-kpi"><div className="lp-lab">Dérive max</div><div className="lp-val lp-warn">+114 j</div></div>
                <div className="lp-kpi"><div className="lp-lab">Réserves ouvertes</div><div className="lp-val">2</div></div>
                <div className="lp-kpi"><div className="lp-lab">Budget facturé</div><div className="lp-val lp-amber">53 %</div></div>
              </div>
              <div className="lp-lots">
                <div className="lp-lot"><span className="lp-nm">LOT 01 · Gros œuvre</span><span className="lp-bar"><i style={{ width: '87%' }} /></span><span className="lp-pc">87 %</span></div>
                <div className="lp-lot"><span className="lp-nm">LOT 03 · Menuiseries</span><span className="lp-bar"><i style={{ width: '47%' }} /></span><span className="lp-pc">47 %</span></div>
                <div className="lp-lot"><span className="lp-nm">LOT 06 · Électricité</span><span className="lp-bar"><i style={{ width: '10%' }} /></span><span className="lp-pc">10 %</span></div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="lp-roles" className="lp-sec">
        <div className="lp-wrap">
          <div className="lp-head">
            <div className="lp-eyebrow">Un outil, trois métiers</div>
            <h2>Chacun y voit ce qui le concerne.</h2>
            <p>Le même suivi, lu selon votre rôle sur l’opération — sans tableur partagé ni allers-retours par e-mail.</p>
          </div>
          <div className="lp-roles">
            {ROLES.map(r => (
              <div className="lp-role" key={r.tag}>
                <div className="lp-ic"><r.icon size={22} /></div>
                <div className="lp-tag">{r.tag}</div>
                <h3>{r.title}</h3>
                <ul>{r.items.map(it => <li key={it}><Check size={16} /> {it}</li>)}</ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="lp-fn" className="lp-sec">
        <div className="lp-wrap">
          <div className="lp-head">
            <div className="lp-eyebrow">Fonctions</div>
            <h2>Tout le suivi d’une opération, au même endroit.</h2>
            <p>De l’ordre de service à la réception, chaque volet du chantier a sa place — relié aux autres.</p>
          </div>
          <div className="lp-feat">
            {FEATURES.map(f => (
              <div className="lp-card" key={f.t}>
                <div className="lp-ic sm"><f.icon size={20} /></div>
                <h3>{f.t}</h3><p>{f.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="lp-sec">
        <div className="lp-wrap">
          <div className="lp-band">
            <div>
              <div className="lp-eyebrow" style={{ color: '#8fd0ea' }}>Un tableau de bord qui va à l’essentiel</div>
              <h2 style={{ color: '#fff' }}>Dès l’ouverture, vous savez où en est le chantier.</h2>
              <p style={{ color: '#bcd7ea' }}>Avancement, dérive, réserves ouvertes et budget facturé, avant même de dérouler le détail. Exemple sur une opération de démonstration.</p>
            </div>
            <div className="lp-stats">
              <div className="lp-st"><div className="v">48 %</div><div className="l">Avancement global</div></div>
              <div className="lp-st"><div className="v">+114 j</div><div className="l">Dérive maximale (LOT 01)</div></div>
              <div className="lp-st"><div className="v">3</div><div className="l">Lots en retard signalés</div></div>
              <div className="lp-st"><div className="v">190 k€</div><div className="l">Facturé · 53 % du marché</div></div>
            </div>
          </div>
        </div>
      </section>

      <section id="lp-sec" className="lp-sec">
        <div className="lp-wrap">
          <div className="lp-head">
            <div className="lp-eyebrow">Sécurité & accès</div>
            <h2>Vos données restent les vôtres.</h2>
            <p>Comptes gérés côté serveur, accès par rôle, synchronisation chiffrée — et le chantier consultable même sans réseau.</p>
          </div>
          <div className="lp-secgrid">
            {SECU.map(s => (
              <div className="lp-item" key={s.t}>
                <span className="lp-si"><s.icon size={20} /></span>
                <div><h3>{s.t}</h3><p>{s.d}</p></div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="lp-final">
        <div className="lp-wrap">
          <h2>Reprenez la main sur vos chantiers.</h2>
          <p>{remote ? 'Créez votre accès en quelques secondes — il sera activé après validation.' : 'Connectez-vous pour ouvrir vos opérations.'}</p>
          <div className="lp-cta" style={{ justifyContent: 'center' }}>
            <button className="lp-btn lp-primary" onClick={remote ? onRequestDemo : onConnect}>
              {remote ? 'Demander une démo' : 'Se connecter'} <ArrowRight size={17} />
            </button>
            <button className="lp-btn lp-ghost" onClick={onConnect}><LogIn size={16} /> Se connecter</button>
          </div>
        </div>
      </section>

      <footer className="lp-foot">
        <div className="lp-wrap lp-foot-in">
          <div className="lp-brand" style={{ fontSize: '15px' }}><span className="lp-chip sm"><Mark size={16} /></span>Suivi Chantier</div>
          <span className="lp-sp">Suivi de chantier bâtiment — MOA · MOE / MOEX · conduite de travaux</span>
        </div>
      </footer>
    </div>
  )
}

const LP_CSS = `
.lp-root{--bg:#f4f8fc;--surface:#fff;--surface-2:#eaf2fa;--surface-3:#e0ecf7;--ink:#0a1a2b;--ink-2:#425f7c;--ink-3:#6c85a0;--line:#d8e6f2;--navy:#02457A;--sky:#018ABE;--accent:#F2A900;--accent-2:#c9720a;--on-accent:#3a2700;--good:#128a5a;--warn:#c2410c;
  position:fixed;inset:0;overflow-y:auto;background:var(--bg);color:var(--ink);
  font-family:'Inter',system-ui,-apple-system,sans-serif;line-height:1.6;z-index:1}
.lp-root h1,.lp-root h2,.lp-root h3{font-family:'Bricolage Grotesque','Inter',system-ui,sans-serif;font-weight:600;line-height:1.1;letter-spacing:-.02em;margin:0}
.lp-root p{margin:0}
.lp-wrap{max-width:1120px;margin:0 auto;padding:0 24px}
.lp-eyebrow{font-size:12px;font-weight:600;letter-spacing:.13em;text-transform:uppercase;color:var(--sky)}
.lp-btn{display:inline-flex;align-items:center;gap:8px;font-family:inherit;font-weight:600;font-size:15px;padding:13px 22px;border-radius:12px;cursor:pointer;border:1px solid transparent;transition:transform .12s ease}
.lp-btn:hover{transform:translateY(-1px)}
.lp-btn.lp-sm{padding:9px 16px;font-size:14px}
.lp-primary{background:var(--accent);color:var(--on-accent)}
.lp-ghost{background:transparent;color:var(--ink);border-color:var(--line)}
.lp-ghost:hover{background:var(--surface-2)}
.lp-nav{position:sticky;top:0;z-index:5;background:rgba(244,248,252,.86);backdrop-filter:blur(12px);border-bottom:1px solid var(--line)}
.lp-nav-in{display:flex;align-items:center;gap:20px;height:64px}
.lp-brand{display:flex;align-items:center;gap:11px;font-family:'Bricolage Grotesque',sans-serif;font-weight:700;font-size:17px}
.lp-chip{width:34px;height:34px;border-radius:9px;background:linear-gradient(150deg,#0a5c93,#02457a 55%,#001b48);display:grid;place-items:center;flex:0 0 auto}
.lp-chip.sm{width:28px;height:28px;border-radius:8px}
.lp-links{margin-left:auto;display:flex;gap:20px;align-items:center}
.lp-lnk{font-size:14px;color:var(--ink-2);font-weight:500;text-decoration:none}
.lp-lnk:hover{color:var(--ink)}
@media(max-width:760px){.lp-lnk{display:none}}
.lp-hero{padding:72px 0 40px}
.lp-hero-grid{display:grid;grid-template-columns:1.05fr .95fr;gap:48px;align-items:center}
@media(max-width:900px){.lp-hero-grid{grid-template-columns:1fr;gap:34px}.lp-hero{padding:44px 0 16px}}
.lp-root h1{font-size:clamp(32px,5vw,54px);text-wrap:balance;margin-top:14px}
.lp-lead{margin-top:18px;font-size:clamp(16px,2vw,19px);color:var(--ink-2);max-width:34ch}
.lp-cta{margin-top:28px;display:flex;gap:12px;flex-wrap:wrap}
.lp-cta a.lp-btn{text-decoration:none}
.lp-micro{margin-top:16px;font-size:13px;color:var(--ink-3);display:flex;gap:16px;flex-wrap:wrap}
.lp-micro span{display:inline-flex;align-items:center;gap:6px}
.lp-dot{width:6px;height:6px;border-radius:50%;background:var(--good);display:inline-block}
.lp-mock{background:var(--surface);border:1px solid var(--line);border-radius:16px;box-shadow:0 30px 70px -30px rgba(2,27,72,.45);overflow:hidden}
.lp-mock-top{display:flex;align-items:center;gap:8px;padding:12px 16px;border-bottom:1px solid var(--line);background:var(--surface-2)}
.lp-tl{width:11px;height:11px;border-radius:50%}
.lp-mtt{margin-left:6px;font-weight:600;font-size:13px}
.lp-mrt{margin-left:auto;font-size:11px;color:var(--ink-3)}
.lp-mock-body{padding:16px}
.lp-kpis{display:grid;grid-template-columns:repeat(2,1fr);gap:10px}
.lp-kpi{background:var(--surface-2);border-radius:12px;padding:12px 13px}
.lp-lab{font-size:11px;color:var(--ink-3);font-weight:600;letter-spacing:.02em;text-transform:uppercase}
.lp-val{font-family:'Bricolage Grotesque',sans-serif;font-weight:700;font-size:26px;margin-top:3px;letter-spacing:-.02em}
.lp-val.lp-amber{color:var(--accent-2)}
.lp-val.lp-warn{color:var(--warn)}
.lp-lots{margin-top:12px;display:flex;flex-direction:column;gap:9px}
.lp-lot{display:grid;grid-template-columns:96px 1fr 38px;gap:10px;align-items:center;font-size:12px}
.lp-nm{color:var(--ink-2);font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.lp-bar{height:8px;border-radius:6px;background:var(--surface-3);overflow:hidden}
.lp-bar>i{display:block;height:100%;border-radius:6px;background:linear-gradient(90deg,var(--sky),var(--navy))}
.lp-pc{text-align:right;font-weight:600;color:var(--ink-2)}
.lp-sec{padding:52px 0}
.lp-head{max-width:60ch;margin-bottom:32px}
.lp-head h2{font-size:clamp(25px,3.3vw,35px)}
.lp-head p{margin-top:12px;color:var(--ink-2);font-size:16.5px}
.lp-roles{display:grid;grid-template-columns:repeat(3,1fr);gap:16px}
@media(max-width:820px){.lp-roles{grid-template-columns:1fr}}
.lp-role{background:var(--surface);border:1px solid var(--line);border-radius:16px;padding:24px;box-shadow:0 12px 32px -12px rgba(2,27,72,.14)}
.lp-role .lp-ic{width:44px;height:44px;border-radius:11px;background:var(--surface-2);display:grid;place-items:center;color:var(--sky);margin-bottom:14px}
.lp-role h3{font-size:18px;margin-top:4px}
.lp-tag{font-size:12px;font-weight:600;color:var(--sky)}
.lp-role ul{margin:12px 0 0;padding:0;list-style:none;display:flex;flex-direction:column;gap:9px}
.lp-role li{display:flex;gap:9px;font-size:14px;color:var(--ink-2);line-height:1.5}
.lp-role li svg{flex:0 0 auto;margin-top:3px;color:var(--good)}
.lp-feat{display:grid;grid-template-columns:repeat(3,1fr);gap:14px}
@media(max-width:900px){.lp-feat{grid-template-columns:repeat(2,1fr)}}
@media(max-width:600px){.lp-feat{grid-template-columns:1fr}}
.lp-card{background:var(--surface);border:1px solid var(--line);border-radius:14px;padding:20px}
.lp-card .lp-ic{width:38px;height:38px;border-radius:10px;background:var(--surface-2);display:grid;place-items:center;color:var(--navy);margin-bottom:12px}
.lp-card h3{font-size:16px}
.lp-card p{margin-top:6px;font-size:13.5px;color:var(--ink-2);line-height:1.55}
.lp-band{background:linear-gradient(155deg,#0a5c93,#02457a 52%,#001b48);color:#eaf4fb;border-radius:24px;padding:44px;display:grid;grid-template-columns:1.1fr 1fr;gap:40px;align-items:center}
@media(max-width:820px){.lp-band{grid-template-columns:1fr;padding:28px}}
.lp-band h2{font-size:clamp(23px,3vw,31px)}
.lp-band p{margin-top:12px;font-size:16px}
.lp-stats{display:grid;grid-template-columns:1fr 1fr;gap:14px}
.lp-st{background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.14);border-radius:14px;padding:16px}
.lp-st .v{font-family:'Bricolage Grotesque',sans-serif;font-weight:700;font-size:29px;color:#fff}
.lp-st .l{font-size:12.5px;color:#bcd7ea;margin-top:2px}
.lp-secgrid{display:grid;grid-template-columns:repeat(2,1fr);gap:14px}
@media(max-width:700px){.lp-secgrid{grid-template-columns:1fr}}
.lp-item{display:flex;gap:13px;background:var(--surface);border:1px solid var(--line);border-radius:14px;padding:18px}
.lp-si{color:var(--good);flex:0 0 auto;margin-top:1px}
.lp-item h3{font-size:15px}
.lp-item p{font-size:13px;color:var(--ink-2);margin-top:4px;line-height:1.5}
.lp-final{text-align:center;padding:66px 0}
.lp-final h2{font-size:clamp(27px,4vw,40px);max-width:18ch;margin:0 auto}
.lp-final p{color:var(--ink-2);font-size:16.5px;margin:16px auto 24px;max-width:46ch}
.lp-foot{border-top:1px solid var(--line);padding:30px 0;color:var(--ink-3);font-size:13px}
.lp-foot-in{display:flex;align-items:center;gap:14px;flex-wrap:wrap}
.lp-sp{margin-left:auto}
@media(max-width:640px){.lp-sp{margin-left:0}}
`
