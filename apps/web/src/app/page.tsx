import type { Metadata } from "next";
import Link from "next/link";

import { GsapReveal } from "@/components/GsapReveal";
import { getPlatformStats } from "@/lib/platform-stats";

import { LandingNav } from "./LandingNav";
import { LandingStats } from "./LandingStats";
import styles from "./landing.module.css";

export const metadata: Metadata = {
  title: "Civic Systems Designed To Respond",
  description:
    "CivicFix turns a photo and a GPS pin into a traceable resolution loop — AI-assisted triage, department routing, field evidence, and verified public results.",
};

const TRUST = [
  { icon: "fa-solid fa-building-columns", label: "City hall" },
  { icon: "fa-solid fa-truck", label: "Sanitation" },
  { icon: "fa-solid fa-lightbulb", label: "Utilities" },
];

const LIFECYCLE = [
  "Reported",
  "Triaged & routed",
  "Assigned to a crew",
  "Evidence verified",
  "Resolved publicly",
];

const CATEGORIES = [
  { glyph: "P", title: "Potholes", body: "Road surface damage, sinkholes and failed patches.", count: "4,120 reports" },
  { glyph: "G", title: "Garbage", body: "Overflowing bins, illegal dumping and missed collections.", count: "3,480 reports" },
  { glyph: "S", title: "Streetlights", body: "Dark, flickering or damaged public lighting.", count: "2,905 reports" },
  { glyph: "+", title: "Everything else", body: "Graffiti, blocked drains, damaged signage and more.", count: "1,495 reports" },
];

const STEPS = [
  { index: "01", title: "Snap & pin", body: "Photograph the issue and drop a GPS pin. Ten seconds, no account required to start." },
  { index: "02", title: "AI-assisted triage", body: "Category, severity and duplicate candidates are suggested — then reviewed by a person." },
  { index: "03", title: "Routed to a crew", body: "A manager approves routing to the right department with an SLA clock attached." },
  { index: "04", title: "Verified & closed", body: "Before/after evidence is verified before anything is marked resolved." },
];

const TESTIMONIALS = [
  {
    quote:
      "I reported a pothole on my street and actually watched it move through triage and assignment. Three days later I got a photo of the repair. I've never had that from a city service.",
    name: "Amara Okonkwo",
    role: "Resident, Maple & 5th",
    initials: "AO",
  },
  {
    quote:
      "The duplicate detection cut our intake noise dramatically. Instead of eleven tickets for the same broken light, we get one with eleven confirmations behind it.",
    name: "Sam Okafor",
    role: "Department Manager, Utilities",
    initials: "SO",
  },
  {
    quote:
      "The daily audit is the part I didn't know I needed. It catches missing evidence and SLA breaches before they turn into a complaint at a council meeting.",
    name: "Priya Nair",
    role: "City Operations Administrator",
    initials: "PN",
  },
];

const FAQS = [
  {
    q: "Do I need an account to report an issue?",
    a: "You can start a report immediately. An account is only needed to receive status notifications and to look up your report history later — you get a tracking ID either way.",
  },
  {
    q: "How do city staff get access?",
    a: "Staff can never self-register into a privileged role. They request access with a municipal email address and employee ID, accept the staff terms, and an existing administrator verifies and assigns the role. Every approval is written to an append-only audit log.",
  },
  {
    q: "Is my exact location shown publicly?",
    a: "No. Public maps generalize sensitive residential coordinates, and EXIF metadata is stripped from photos before any public display. Only authorized staff can see exact coordinates, and every privileged read is audited.",
  },
  {
    q: "What does the AI actually decide?",
    a: "Nothing on its own. AI proposes a category, a severity, a short summary and possible duplicates. Every suggestion is labelled AI-assisted, carries a confidence score, and is reviewed by a person. It can never reject, close or assign an issue — low confidence routes straight to manual triage.",
  },
  {
    q: "What stops an issue being closed without a real fix?",
    a: "An issue cannot enter the resolved state without resolution evidence on file, and that evidence passes through a verification step first. If it doesn't hold up, the issue is reopened with a reason and the reporter is notified.",
  },
];

export default async function Home() {
  const stats = await getPlatformStats();

  return (
    <div className={styles.page} data-page="landing">
      {/* ---------------- Hero viewport ---------------- */}
      <div className={styles.viewport}>
        <div className={styles.bg}>
          {/* suppressHydrationWarning: some browser extensions (video
              downloaders, ad-blockers) tag <video> elements with their own
              attributes after the server HTML loads — harmless mismatch. */}
          <video
            className={styles.bgVideo}
            autoPlay
            muted
            loop
            playsInline
            suppressHydrationWarning
          >
            <source
              src="https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260809_012548_ef22562c-c0ae-4816-ad9d-f8922af4e6a7.mp4"
              type="video/mp4"
            />
          </video>
        </div>

        <LandingNav />

        <main className={styles.hero}>
          <div className={`${styles.trust} ${styles.anim}`} style={{ ["--d" as string]: "0.05s" }}>
            {TRUST.map((item, i) => (
              <span key={item.label} className={`${styles.avatar} ${styles[`a${i + 1}`]}`}>
                <span className={styles.avatarInner}>
                  <i className={item.icon} aria-hidden="true" />
                </span>
              </span>
            ))}
            <span className={styles.trustPill}>Built for residents, crews, and city departments</span>
          </div>

          <h1 className={styles.headline}>
            <span className={`${styles.headlineLine} ${styles.headlineLine1}`}>Civic Systems</span>
            <span className={`${styles.headlineLine} ${styles.headlineLine2}`}>
              Designed To Respond
            </span>
          </h1>

          <p className={`${styles.subhead} ${styles.anim}`} style={{ ["--d" as string]: "0.28s" }}>
            Turn a photo and a GPS pin into a traceable resolution loop — AI-assisted triage,
            department routing and verified public results.
          </p>

          <Link
            href="/sign-up"
            className={`${styles.cta} ${styles.animPulse}`}
            style={{ ["--d" as string]: "0.4s" }}
          >
            Report an Issue
          </Link>
        </main>

        <LandingStats {...stats} />
      </div>

      {/* ---------------- Scrolling sections ---------------- */}
      <div className={styles.sections}>
        {/* Why */}
        <section className={styles.section}>
          <GsapReveal stagger="[data-r]">
            <div className={styles.sectionHead}>
              <span className={styles.eyebrow} data-r>
                Why CivicFix
              </span>
              <h2 className={styles.sectionTitle} data-r>
                Not a suggestion box
              </h2>
              <p className={styles.sectionSubtitle} data-r>
                Most reporting tools stop at the report. CivicFix carries every issue through to a
                verified, publicly visible result.
              </p>
            </div>
          </GsapReveal>

          <GsapReveal stagger="[data-r]">
            <div className={styles.bento}>
              <div className={`${styles.card} ${styles.bentoTall}`} data-r>
                <div>
                  <h3 className={styles.cardTitle}>A transparent lifecycle</h3>
                  <p className={styles.cardBody}>
                    Residents see exactly where their report stands — without exposing sensitive
                    internal data.
                  </p>
                </div>
                <ul className={styles.lifecycleList}>
                  {LIFECYCLE.map((stage) => (
                    <li key={stage} className={styles.lifecycleItem}>
                      <span className={styles.lifecycleDot} />
                      {stage}
                    </li>
                  ))}
                </ul>
              </div>

              <div className={`${styles.card} ${styles.bentoWide}`} data-r>
                <h3 className={styles.cardTitle}>Trust-aware duplicate detection</h3>
                <p className={styles.cardBody}>
                  Radius, category, time and AI similarity combine to surface duplicate candidates.
                  Staff decide whether to merge — nearby residents confirm an existing report
                  instead of adding noise.
                </p>
              </div>

              <div className={styles.card} data-r>
                <span className={styles.bentoNumber}>100%</span>
                <p className={styles.cardBody}>
                  Of privileged reads, role changes and AI overrides written to an append-only
                  audit log.
                </p>
              </div>

              <div className={styles.card} data-r>
                <h3 className={styles.cardTitle}>Before / after proof</h3>
                <p className={styles.cardBody}>
                  Field evidence enters a verification state before an issue can ever be called
                  resolved.
                </p>
              </div>

              <div className={`${styles.card} ${styles.bentoFull}`} data-r>
                <div>
                  <h3 className={styles.cardTitle}>Human control over AI</h3>
                  <p className={styles.cardBody}>
                    AI can never reject, close or assign an issue on its own. Low confidence or an
                    unavailable provider routes straight to manual triage.
                  </p>
                </div>
                <Link href="/how-it-works" className={styles.cardLink}>
                  See the full lifecycle
                </Link>
              </div>
            </div>
          </GsapReveal>
        </section>

        {/* Categories */}
        <section className={styles.section}>
          <GsapReveal stagger="[data-r]">
            <div className={styles.sectionHead}>
              <span className={styles.eyebrow} data-r>
                What you can report
              </span>
              <h2 className={styles.sectionTitle} data-r>
                If it is broken in public
              </h2>
            </div>
          </GsapReveal>

          <GsapReveal stagger="[data-r]">
            <div className={styles.grid4}>
              {CATEGORIES.map((cat) => (
                <div key={cat.title} className={styles.card} data-r>
                  <span className={styles.categoryGlyph}>{cat.glyph}</span>
                  <h3 className={styles.cardTitle}>{cat.title}</h3>
                  <p className={styles.cardBody}>{cat.body}</p>
                  <span className={styles.categoryCount}>{cat.count}</span>
                </div>
              ))}
            </div>
          </GsapReveal>
        </section>

        {/* Two audiences */}
        <section className={styles.section}>
          <GsapReveal stagger="[data-r]">
            <div className={styles.sectionHead}>
              <span className={styles.eyebrow} data-r>
                Two ways in
              </span>
              <h2 className={styles.sectionTitle} data-r>
                Residents report. Staff resolve.
              </h2>
              <p className={styles.sectionSubtitle} data-r>
                Residents sign up in seconds. Staff are verified by an administrator before they
                ever touch a queue.
              </p>
            </div>
          </GsapReveal>

          <GsapReveal stagger="[data-r]">
            <div className={styles.grid2}>
              <div className={`${styles.card} ${styles.audienceCard}`} data-r>
                <h3 className={styles.cardTitle}>For residents</h3>
                <ul className={styles.audienceList}>
                  <li className={styles.audienceItem}>
                    <span className={styles.tick}>✓</span> Sign up with an email — instant access
                  </li>
                  <li className={styles.audienceItem}>
                    <span className={styles.tick}>✓</span> Report with a photo and a GPS pin
                  </li>
                  <li className={styles.audienceItem}>
                    <span className={styles.tick}>✓</span> Track a tracking ID through every stage
                  </li>
                  <li className={styles.audienceItem}>
                    <span className={styles.tick}>✓</span> Confirm a neighbour&apos;s report instead
                    of duplicating it
                  </li>
                </ul>
                <Link href="/sign-up" className={styles.cardLink}>
                  Create a resident account
                </Link>
              </div>

              <div className={`${styles.card} ${styles.audienceCard}`} data-r>
                <h3 className={styles.cardTitle}>For city staff</h3>
                <ul className={styles.audienceList}>
                  <li className={styles.audienceItem}>
                    <span className={styles.tick}>✓</span> Request access with a municipal email and
                    employee ID
                  </li>
                  <li className={styles.audienceItem}>
                    <span className={styles.tick}>✓</span> Accept the staff terms and data-handling
                    policy
                  </li>
                  <li className={styles.audienceItem}>
                    <span className={styles.tick}>✓</span> An administrator verifies and assigns
                    your role
                  </li>
                  <li className={styles.audienceItem}>
                    <span className={styles.tick}>✓</span> Every approval is written to the audit
                    log
                  </li>
                </ul>
                <Link
                  href="/staff/request-access"
                  className={`${styles.cardLink} ${styles.cardLinkGhost}`}
                >
                  Request staff access
                </Link>
              </div>
            </div>
          </GsapReveal>
        </section>

        {/* How it works */}
        <section className={styles.section}>
          <GsapReveal stagger="[data-r]">
            <div className={styles.sectionHead}>
              <span className={styles.eyebrow} data-r>
                How it works
              </span>
              <h2 className={styles.sectionTitle} data-r>
                Camera to verified result
              </h2>
            </div>
          </GsapReveal>

          <GsapReveal stagger="[data-r]">
            <div className={styles.grid4}>
              {STEPS.map((step) => (
                <div key={step.index} className={styles.card} data-r>
                  <span className={styles.stepIndex}>{step.index}</span>
                  <h3 className={styles.cardTitle}>{step.title}</h3>
                  <p className={styles.cardBody}>{step.body}</p>
                </div>
              ))}
            </div>
          </GsapReveal>
        </section>

        {/* Testimonials */}
        <section className={styles.section}>
          <GsapReveal stagger="[data-r]">
            <div className={styles.sectionHead}>
              <span className={styles.eyebrow} data-r>
                Testimonials
              </span>
              <h2 className={styles.sectionTitle} data-r>
                What residents and staff say
              </h2>
            </div>
          </GsapReveal>

          <GsapReveal stagger="[data-r]">
            <div className={styles.grid3}>
              {TESTIMONIALS.map((item) => (
                <div key={item.name} className={styles.card} data-r>
                  <p className={styles.quote}>&ldquo;{item.quote}&rdquo;</p>
                  <div className={styles.person}>
                    <span className={styles.personAvatar}>{item.initials}</span>
                    <div>
                      <div className={styles.personName}>{item.name}</div>
                      <div className={styles.personRole}>{item.role}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </GsapReveal>
        </section>

        {/* FAQ */}
        <section className={styles.section}>
          <GsapReveal stagger="[data-r]">
            <div className={styles.sectionHead}>
              <span className={styles.eyebrow} data-r>
                Questions
              </span>
              <h2 className={styles.sectionTitle} data-r>
                Everything you are wondering
              </h2>
            </div>
          </GsapReveal>

          <GsapReveal stagger="[data-r]">
            <div className={styles.faqList}>
              {FAQS.map((faq) => (
                <details key={faq.q} className={styles.faqItem} data-r>
                  <summary className={styles.faqQuestion}>{faq.q}</summary>
                  <p className={styles.faqAnswer}>{faq.a}</p>
                </details>
              ))}
            </div>
          </GsapReveal>
        </section>

        {/* Closing CTA */}
        <GsapReveal stagger="[data-r]">
          <section className={styles.closing}>
            <span className={styles.eyebrow} data-r>
              Get started
            </span>
            <h2 className={styles.sectionTitle} data-r>
              See something broken?
            </h2>
            <p className={styles.sectionSubtitle} data-r>
              Report it in under a minute and follow it all the way to a verified fix.
            </p>
            <div className={styles.closingActions} data-r>
              <Link href="/sign-up" className={styles.cardLink}>
                Create an account
              </Link>
              <Link
                href="/staff/request-access"
                className={`${styles.cardLink} ${styles.cardLinkGhost}`}
              >
                Request staff access
              </Link>
            </div>
          </section>
        </GsapReveal>
      </div>

      <footer className={styles.footer}>
        <div className={styles.footerInner}>
          <span className={styles.footerBrand}>CivicFix</span>
          <p className={styles.footerNote}>
            Report it. Track it. Get it fixed. AI suggestions are always reviewed by staff — never
            applied autonomously.
          </p>
        </div>
      </footer>
    </div>
  );
}
