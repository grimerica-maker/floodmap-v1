// app/success/page.js
// Place at: app/success/page.js in your Next.js project
// Add to next.config.js robots: noindex this route, or use the meta tag below

export const metadata = {
  title: 'Payment Successful — DisasterMap',
  robots: { index: false, follow: false },
};

export default function SuccessPage() {
  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,700;1,700&family=DM+Sans:wght@400;500&display=swap');

        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        body {
          background: #090d1a;
          color: #e8e4dc;
          font-family: 'DM Sans', sans-serif;
          min-height: 100vh;
          overflow-x: hidden;
        }

        .stars {
          position: fixed;
          inset: 0;
          z-index: 0;
          background:
            radial-gradient(ellipse at 20% 50%, rgba(255,90,20,0.04) 0%, transparent 60%),
            radial-gradient(ellipse at 80% 20%, rgba(20,60,120,0.08) 0%, transparent 50%),
            #090d1a;
        }
        .stars::before {
          content: '';
          position: absolute;
          inset: 0;
          background-image:
            radial-gradient(1px 1px at 10% 15%, rgba(255,255,255,0.6) 0%, transparent 100%),
            radial-gradient(1px 1px at 25% 40%, rgba(255,255,255,0.4) 0%, transparent 100%),
            radial-gradient(1.5px 1.5px at 40% 8%, rgba(255,255,255,0.5) 0%, transparent 100%),
            radial-gradient(1px 1px at 55% 65%, rgba(255,255,255,0.3) 0%, transparent 100%),
            radial-gradient(1px 1px at 70% 30%, rgba(255,255,255,0.5) 0%, transparent 100%),
            radial-gradient(1.5px 1.5px at 85% 55%, rgba(255,255,255,0.4) 0%, transparent 100%),
            radial-gradient(1px 1px at 15% 75%, rgba(255,255,255,0.3) 0%, transparent 100%),
            radial-gradient(1px 1px at 92% 10%, rgba(255,255,255,0.6) 0%, transparent 100%),
            radial-gradient(1px 1px at 60% 85%, rgba(255,255,255,0.3) 0%, transparent 100%),
            radial-gradient(1px 1px at 35% 92%, rgba(255,255,255,0.4) 0%, transparent 100%),
            radial-gradient(1px 1px at 78% 78%, rgba(255,255,255,0.5) 0%, transparent 100%),
            radial-gradient(1px 1px at 5% 55%, rgba(255,255,255,0.3) 0%, transparent 100%),
            radial-gradient(1.5px 1.5px at 48% 48%, rgba(255,255,255,0.4) 0%, transparent 100%),
            radial-gradient(1px 1px at 90% 88%, rgba(255,255,255,0.3) 0%, transparent 100%),
            radial-gradient(1px 1px at 30% 20%, rgba(255,255,255,0.5) 0%, transparent 100%);
        }

        .page {
          position: relative;
          z-index: 1;
          min-height: 100vh;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 48px 24px;
        }

        .logo-wrap {
          margin-bottom: 40px;
          text-align: center;
          animation: fadeDown 0.6s ease both;
        }
        .logo-wrap img {
          width: 72px;
          height: auto;
        }
        .logo-label {
          font-family: 'Playfair Display', serif;
          font-size: 13px;
          letter-spacing: 0.2em;
          color: rgba(255,255,255,0.3);
          text-transform: uppercase;
          margin-top: 8px;
        }

        .card {
          background: rgba(255,255,255,0.035);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 16px;
          max-width: 560px;
          width: 100%;
          padding: 48px 44px;
          backdrop-filter: blur(12px);
          animation: fadeUp 0.7s ease 0.1s both;
        }

        .badge {
          display: inline-block;
          font-size: 11px;
          font-weight: 500;
          letter-spacing: 0.18em;
          text-transform: uppercase;
          color: #e85d20;
          border: 1px solid rgba(232,93,32,0.4);
          border-radius: 4px;
          padding: 4px 10px;
          margin-bottom: 20px;
        }

        h1 {
          font-family: 'Playfair Display', serif;
          font-size: clamp(28px, 5vw, 38px);
          font-weight: 700;
          font-style: italic;
          line-height: 1.15;
          color: #fff;
          margin-bottom: 12px;
        }

        .subtitle {
          font-size: 15px;
          color: rgba(232,228,220,0.6);
          line-height: 1.6;
          margin-bottom: 36px;
        }

        /* Link box */
        .link-section {
          background: rgba(232,93,32,0.08);
          border: 1px solid rgba(232,93,32,0.25);
          border-radius: 10px;
          padding: 20px 22px;
          margin-bottom: 32px;
        }
        .link-label {
          font-size: 11px;
          letter-spacing: 0.15em;
          text-transform: uppercase;
          color: #e85d20;
          margin-bottom: 10px;
          font-weight: 500;
        }
        .link-row {
          display: flex;
          align-items: center;
          gap: 10px;
          background: rgba(0,0,0,0.3);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 8px;
          padding: 10px 14px;
        }
        .link-url {
          flex: 1;
          font-size: 13px;
          color: #c8d4e8;
          font-family: 'DM Sans', monospace;
          word-break: break-all;
          line-height: 1.4;
        }
        .copy-btn {
          flex-shrink: 0;
          background: rgba(232,93,32,0.15);
          border: 1px solid rgba(232,93,32,0.4);
          color: #e85d20;
          border-radius: 6px;
          padding: 6px 14px;
          font-size: 12px;
          font-weight: 500;
          cursor: pointer;
          transition: background 0.2s, color 0.2s;
          font-family: 'DM Sans', sans-serif;
          white-space: nowrap;
        }
        .copy-btn:hover { background: rgba(232,93,32,0.28); }
        .copy-btn.copied { color: #4cda7a; border-color: rgba(76,218,122,0.4); background: rgba(76,218,122,0.08); }

        .link-warn {
          font-size: 12px;
          color: rgba(232,228,220,0.45);
          margin-top: 10px;
          line-height: 1.5;
        }
        .link-warn strong { color: rgba(232,93,32,0.8); font-weight: 500; }

        /* Steps */
        .steps-label {
          font-size: 11px;
          letter-spacing: 0.15em;
          text-transform: uppercase;
          color: rgba(255,255,255,0.3);
          margin-bottom: 16px;
          font-weight: 500;
        }
        .steps {
          display: flex;
          flex-direction: column;
          gap: 14px;
          margin-bottom: 32px;
        }
        .step {
          display: flex;
          gap: 14px;
          align-items: flex-start;
        }
        .step-num {
          flex-shrink: 0;
          width: 26px;
          height: 26px;
          border-radius: 50%;
          border: 1px solid rgba(232,93,32,0.45);
          color: #e85d20;
          font-size: 12px;
          font-weight: 600;
          display: flex;
          align-items: center;
          justify-content: center;
          margin-top: 1px;
        }
        .step-text {
          font-size: 14px;
          color: rgba(232,228,220,0.75);
          line-height: 1.55;
        }
        .step-text strong { color: #e8e4dc; font-weight: 500; }
        .step-text a { color: #e85d20; text-decoration: none; }
        .step-text a:hover { text-decoration: underline; }

        /* CTA button */
        .launch-btn {
          display: block;
          width: 100%;
          background: #e85d20;
          color: #fff;
          font-family: 'Playfair Display', serif;
          font-size: 17px;
          font-weight: 700;
          font-style: italic;
          text-align: center;
          text-decoration: none;
          border-radius: 8px;
          padding: 16px 24px;
          letter-spacing: 0.01em;
          transition: background 0.2s, transform 0.15s;
          border: none;
          cursor: pointer;
        }
        .launch-btn:hover { background: #d44e14; transform: translateY(-1px); }

        .divider {
          border: none;
          border-top: 1px solid rgba(255,255,255,0.07);
          margin: 28px 0;
        }

        .footer-links {
          text-align: center;
          font-size: 12px;
          color: rgba(232,228,220,0.3);
          margin-top: 32px;
          animation: fadeUp 0.7s ease 0.25s both;
        }
        .footer-links a {
          color: rgba(232,228,220,0.35);
          text-decoration: none;
          margin: 0 8px;
        }
        .footer-links a:hover { color: rgba(232,228,220,0.6); }

        @keyframes fadeDown {
          from { opacity: 0; transform: translateY(-12px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(16px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        @media (max-width: 520px) {
          .card { padding: 32px 22px; }
          .link-row { flex-direction: column; align-items: stretch; }
          .copy-btn { text-align: center; }
        }
      `}</style>

      <div className="stars" aria-hidden="true" />

      <main className="page">
        <div className="logo-wrap">
          {/* Replace src with your actual logo path */}
          <img src="/logo.png" alt="DisasterMap" />
          <div className="logo-label">DisasterMap.ca</div>
        </div>

        <div className="card">
          <div className="badge">✓ Pro Access Unlocked</div>

          <h1>Welcome to the inner circle.</h1>
          <p className="subtitle">
            Thank you — genuinely — for supporting DisasterMap. Your Pro access
            is permanent and lives in the link below. Bookmark it. Save it
            somewhere safe.
          </p>

          <div className="link-section">
            <div className="link-label">Your permanent Pro link</div>
            <div className="link-row">
              <span className="link-url" id="pro-link">
                https://www.disastermap.ca/map?pro=1
              </span>
              <button
                className="copy-btn"
                id="copy-btn"
                onClick={`
                  navigator.clipboard.writeText('https://www.disastermap.ca/map?pro=1');
                  this.textContent = '✓ Copied';
                  this.classList.add('copied');
                  setTimeout(() => { this.textContent = 'Copy'; this.classList.remove('copied'); }, 2000);
                `}
              >
                Copy
              </button>
            </div>
            <p className="link-warn">
              <strong>⚠ Keep this link private.</strong> It is tied to your
              purchase. Sharing it publicly may result in loss of Pro access.
            </p>
          </div>

          <div className="steps-label">Getting started</div>
          <div className="steps">
            <div className="step">
              <div className="step-num">1</div>
              <div className="step-text">
                <strong>Use the link above</strong> to launch DisasterMap with
                Pro enabled — no account required. Access is IP-based and
                instant.
              </div>
            </div>
            <div className="step">
              <div className="step-num">2</div>
              <div className="step-text">
                <strong>Save the link</strong> in your bookmarks, notes, or
                password manager. It will always work, from any device, any
                time.
              </div>
            </div>
            <div className="step">
              <div className="step-num">3</div>
              <div className="step-text">
                <strong>Optional — create an account</strong> to sync access
                across devices. Click <strong>Sign In / Sign Up</strong> in the
                left panel when you're on the map.
              </div>
            </div>
            <div className="step">
              <div className="step-num">4</div>
              <div className="step-text">
                Need to manage your purchase? Visit the{' '}
                <a
                  href="https://billing.stripe.com/p/login/00w28rcyY4bM8Oy1b7a3u00"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  billing portal →
                </a>
              </div>
            </div>
          </div>

          <hr className="divider" />

          <a href="https://www.disastermap.ca/map?pro=1" className="launch-btn">
            Launch DisasterMap Pro →
          </a>
        </div>

        <div className="footer-links">
          <a href="/privacy">Privacy</a>
          <a href="/terms">Terms</a>
          <a href="mailto:support@disastermap.ca">Support</a>
        </div>
      </main>

      <script dangerouslySetInnerHTML={{ __html: `
        document.getElementById('copy-btn').addEventListener('click', function() {
          navigator.clipboard.writeText('https://www.disastermap.ca/map?pro=1').then(() => {
            this.textContent = '✓ Copied';
            this.classList.add('copied');
            setTimeout(() => {
              this.textContent = 'Copy';
              this.classList.remove('copied');
            }, 2000);
          });
        });
      `}} />
    </>
  );
}
