# FordEngage — Outstanding Work (2026-09-30)
Use GPT-6 Astra subagent for all of this. Read each section carefully before touching anything.

---

## 1. Nav — All Inner Pages
**Problem:** enroll.html, contact.html, how-it-works.html, product.html all have broken/missing nav.
**Root cause:** Each page has 2000+ lines of conflicting CSS in <head> from prior editing sessions.
**Fix approach:**
- Read index.html — extract exact working nav HTML and nav CSS (source of truth)
- For each inner page: strip ALL existing nav CSS rules, inject clean nav HTML after <body>, inject nav CSS as a single clean block
- Verify in browser via playwright before committing anything
- Deploy ONCE at the end via: `env -u CLOUDFLARE_API_TOKEN wrangler pages deploy . --project-name=ford-demo --branch=main`

**DO NOT touch index.html — homepage nav is working.**
**DO NOT wipe how-it-works.html content — it was restored to commit 8ea6f72.**

---

## 2. Dealer Location Field on Enroll Page
**Problem:** dealer-data.js has the full national Ford dealer database (zip-keyed JSON) but is NOT wired into the enroll form.
**What's needed:**
- Zip code input on enroll form
- On zip entry: lookup dealer-data.js, show matching dealer name + address
- Selected dealer submitted with form
- Label: "Find Your Dealership"

**Files:** enroll.html, dealer-data.js (already in repo)

---

## 3. H2 Headline Consistency
**Problem:** "Accessories are the hero" headline (h2#fe-demo-heading) renders in Barlow Condensed, not matching "A complete ecosystem" style.
**Target:** Match .engage-intro h2 exactly — Ford Antenna, clamp(1.25rem,2.8vw,1.75rem), weight 700, line-height 1.5
**Fix:** CSS rule targeting #fe-demo-heading — inline styles do NOT work due to specificity

---

## Key Facts
- Cloudflare cache is aggressive — always deploy via wrangler directly, not just git push
- Playwright is available to verify before/after
- Repo: /Users/scottanderson/Projects/fordengage
