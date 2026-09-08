import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight, Check, Instagram, MapPin, Mail } from 'lucide-react';

const LAUNCH_DATE = new Date('2025-04-19T08:00:00');

function getTimeLeft() {
  const now = new Date();
  const diff = Math.max(0, LAUNCH_DATE.getTime() - now.getTime());
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
  const minutes = Math.floor((diff / (1000 * 60)) % 60);
  const seconds = Math.floor((diff / 1000) % 60);
  return { days, hours, minutes, seconds };
}

const pad = (n) => String(n).padStart(2, '0');

export default function App() {
  const [time, setTime] = useState(getTimeLeft());
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState('idle'); // idle | done

  useEffect(() => {
    const t = setInterval(() => setTime(getTimeLeft()), 1000);
    return () => clearInterval(t);
  }, []);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!email.includes('@')) return;
    setStatus('done');
  };

  const tickerItems = useMemo(
    () => [
      'Single-origin · Huila, Colombia',
      'Roasted at 1,200m',
      'Opening April 19',
      'SE Division St, Portland',
      'Espresso · Filter · Pastry',
      'First 100 guests drink free',
    ],
    []
  );

  return (
    <div className="solstice-root relative min-h-screen w-full overflow-hidden bg-[#F3ECE1] text-[#211912] selection:bg-[#C8552B] selection:text-[#F3ECE1]">
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link
        href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght,SOFT@9..144,300..700,100&family=Instrument+Sans:wght@400;500;600&display=swap"
        rel="stylesheet"
      />
      <style
        dangerouslySetInnerHTML={{
          __html: `
        .solstice-root { font-family: 'Instrument Sans', sans-serif; }
        .font-display { font-family: 'Fraunces', serif; }

        .grain::after {
          content: "";
          position: fixed;
          inset: -50%;
          width: 200%;
          height: 200%;
          pointer-events: none;
          background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.5'/%3E%3C/svg%3E");
          opacity: 0.06;
          z-index: 50;
          animation: grainShift 1.2s steps(4) infinite;
        }
        @keyframes grainShift {
          0% { transform: translate(0,0); }
          25% { transform: translate(-2%,1%); }
          50% { transform: translate(1%,-2%); }
          75% { transform: translate(-1%,2%); }
          100% { transform: translate(0,0); }
        }

        @keyframes marquee {
          from { transform: translateX(0); }
          to { transform: translateX(-50%); }
        }
        .marquee-track { animation: marquee 32s linear infinite; }

        @keyframes spinSlow {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .spin-slow { animation: spinSlow 22s linear infinite; }

        @keyframes pulseDot {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.4; transform: scale(0.8); }
        }
        .pulse-dot { animation: pulseDot 2s ease-in-out infinite; }

        .input-line:focus { outline: none; }
        .input-line::placeholder { color: rgba(33,25,18,0.35); }

        @media (max-height: 700px) {
          .headline { font-size: clamp(2.4rem, 11vw, 4rem) !important; }
        }
      `,
        }}
      />

      <div className="grain" />

      {/* ---- top bar ---- */}
      <header className="relative z-10 flex items-center justify-between px-5 pt-5 sm:px-10 sm:pt-7">
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="flex items-center gap-2.5"
        >
          {/* sun mark */}
          <svg width="26" height="26" viewBox="0 0 26 26" className="text-[#C8552B]">
            <circle cx="13" cy="13" r="6" fill="currentColor" />
            {[...Array(8)].map((_, i) => (
              <rect
                key={i}
                x="12.25"
                y="0.5"
                width="1.5"
                height="4.5"
                rx="0.75"
                fill="currentColor"
                transform={`rotate(${i * 45} 13 13)`}
              />
            ))}
          </svg>
          <span className="font-display text-lg font-semibold tracking-tight">Solstice</span>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="flex items-center gap-2 rounded-full border border-[#211912]/15 px-3.5 py-1.5 text-[11px] font-medium uppercase tracking-[0.14em] sm:text-xs"
        >
          <span className="pulse-dot inline-block h-1.5 w-1.5 rounded-full bg-[#C8552B]" />
          Roastery in build
        </motion.div>
      </header>

      {/* ---- main ---- */}
      <main className="relative z-10 mx-auto flex w-full max-w-5xl flex-col px-5 pb-36 pt-10 sm:px-10 sm:pt-16">
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="mb-4 text-[11px] font-semibold uppercase tracking-[0.28em] text-[#C8552B] sm:text-xs"
        >
          A new café &amp; roastery — Portland, OR
        </motion.p>

        <h1 className="headline font-display font-light leading-[0.95] tracking-[-0.02em] text-[clamp(2.9rem,12vw,7.5rem)]">
          <motion.span
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.25 }}
            className="block"
          >
            Good things
          </motion.span>
          <motion.span
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.4 }}
            className="block italic text-[#C8552B]"
          >
            take time
          </motion.span>
          <motion.span
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.55 }}
            className="block"
          >
            to roast.
          </motion.span>
        </h1>

        <div className="mt-10 flex flex-col gap-10 sm:mt-14 sm:flex-row sm:items-end sm:justify-between">
          {/* left column: copy + countdown + form */}
          <div className="max-w-md">
            <motion.p
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.7 }}
              className="text-[15px] leading-relaxed text-[#211912]/70"
            >
              We're building a corner on SE Division where the espresso is pulled
              slow and the light comes in low. Doors open this spring — leave your
              email and your first cup is on us.
            </motion.p>

            {/* countdown */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.85 }}
              className="mt-8 grid grid-cols-4 divide-x divide-[#211912]/12 border-y border-[#211912]/15"
            >
              {[
                { label: 'Days', value: time.days },
                { label: 'Hours', value: pad(time.hours) },
                { label: 'Min', value: pad(time.minutes) },
                { label: 'Sec', value: pad(time.seconds) },
              ].map((u) => (
                <div key={u.label} className="flex flex-col items-center py-4">
                  <span className="font-display text-3xl font-light tabular-nums sm:text-4xl">
                    {u.value}
                  </span>
                  <span className="mt-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-[#211912]/50">
                    {u.label}
                  </span>
                </div>
              ))}
            </motion.div>

            {/* email form */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 1 }}
              className="mt-8"
            >
              <AnimatePresence mode="wait">
                {status === 'idle' ? (
                  <motion.form
                    key="form"
                    onSubmit={handleSubmit}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.3 }}
                    className="flex items-center gap-3 border-b-2 border-[#211912] pb-3"
                  >
                    <Mail size={18} className="shrink-0 text-[#211912]/40" />
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@somewhere.com"
                      className="input-line w-full bg-transparent text-[15px] font-medium"
                    />
                    <button
                      type="submit"
                      aria-label="Notify me"
                      className="group flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#211912] text-[#F3ECE1] transition-colors duration-300 hover:bg-[#C8552B] active:scale-95"
                    >
                      <ArrowRight
                        size={18}
                        className="transition-transform duration-300 group-hover:translate-x-0.5"
                      />
                    </button>
                  </motion.form>
                ) : (
                  <motion.div
                    key="done"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4 }}
                    className="flex items-center gap-3 rounded-xl bg-[#211912] px-5 py-4 text-[#F3ECE1]"
                  >
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#C8552B]">
                      <Check size={15} strokeWidth={3} />
                    </span>
                    <p className="text-sm">
                      You're on the list — <span className="font-semibold">{email}</span>.
                      First pour's on us.
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>
              {status === 'idle' && (
                <p className="mt-3 text-xs text-[#211912]/45">
                  No spam. One email when the doors open, maybe two.
                </p>
              )}
            </motion.div>
          </div>

          {/* right column: rotating badge */}
          <motion.div
            initial={{ opacity: 0, scale: 0.85 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, delay: 1.05 }}
            className="hidden shrink-0 self-end sm:block"
          >
            <div className="relative h-36 w-36">
              <svg viewBox="0 0 144 144" className="spin-slow absolute inset-0 h-full w-full">
                <defs>
                  <path
                    id="circlePath"
                    d="M 72,72 m -54,0 a 54,54 0 1,1 108,0 a 54,54 0 1,1 -108,0"
                  />
                </defs>
                <text className="fill-[#211912]" style={{ fontSize: '12.5px', letterSpacing: '3px', fontFamily: "'Instrument Sans', sans-serif", fontWeight: 600 }}>
                  <textPath href="#circlePath">
                    OPENING APRIL 2025 · SOLSTICE ROASTERS ·
                  </textPath>
                </text>
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <svg width="44" height="44" viewBox="0 0 26 26" className="text-[#C8552B]">
                  <circle cx="13" cy="13" r="6" fill="currentColor" />
                  {[...Array(8)].map((_, i) => (
                    <rect
                      key={i}
                      x="12.25"
                      y="0.5"
                      width="1.5"
                      height="4.5"
                      rx="0.75"
                      fill="currentColor"
                      transform={`rotate(${i * 45} 13 13)`}
                    />
                  ))}
                </svg>
              </div>
            </div>
          </motion.div>
        </div>

        {/* footer meta */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, delay: 1.2 }}
          className="mt-12 flex flex-wrap items-center gap-x-6 gap-y-3 text-xs font-medium text-[#211912]/55 sm:mt-16"
        >
          <span className="flex items-center gap-1.5">
            <MapPin size={14} className="text-[#C8552B]" />
            3415 SE Division St
          </span>
          <a
            href="#"
            className="flex items-center gap-1.5 transition-colors hover:text-[#C8552B]"
          >
            <Instagram size={14} />
            @solstice.pdx
          </a>
          <span className="hidden sm:inline">Mon–Sun · 7a–4p (soon)</span>
        </motion.div>
      </main>

      {/* ---- bottom marquee ---- */}
      <div className="fixed bottom-0 left-0 right-0 z-20 border-t border-[#F3ECE1]/10 bg-[#211912] py-3.5 text-[#F3ECE1]">
        <div className="marquee-track flex w-max items-center whitespace-nowrap">
          {[...Array(2)].map((_, dup) => (
            <div key={dup} className="flex items-center">
              {tickerItems.map((item, i) => (
                <span key={`${dup}-${i}`} className="flex items-center text-[12px] font-medium uppercase tracking-[0.18em]">
                  <span className="px-6">{item}</span>
                  <span className="text-[#C8552B]">✺</span>
                </span>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* warm sun glow, top-right */}
      <div
        className="pointer-events-none absolute -right-32 -top-32 h-[420px] w-[420px] rounded-full opacity-60 sm:-right-20 sm:-top-20"
        style={{
          background:
            'radial-gradient(circle, rgba(200,85,43,0.28) 0%, rgba(200,85,43,0.08) 45%, transparent 70%)',
        }}
      />
    </div>
  );
}