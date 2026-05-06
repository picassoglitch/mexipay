// MexiPay × Arteria/Cuenca Pitch Deck Generator
// Generates: mexipay_arteria_pitch.pptx

const path = require("path");
const GLOBAL_MODULES = "/opt/node22/lib/node_modules";

const PptxGenJS = require(path.join(GLOBAL_MODULES, "pptxgenjs"));
const React = require(path.join(GLOBAL_MODULES, "react"));
const ReactDOMServer = require(path.join(GLOBAL_MODULES, "react-dom/server"));
const sharp = require(path.join(GLOBAL_MODULES, "sharp"));
const FA = require(path.join(GLOBAL_MODULES, "react-icons/fa"));

// ---------- Color palette (NO # prefix anywhere in pptxgenjs args) ----------
const C = {
  navy:  "0A1628",
  teal:  "00B4D8",
  mint:  "02C39A",
  gold:  "FFB703",
  white: "FFFFFF",
  ink:   "111827",
  slate: "475569",
  cloud: "F1F5F9",
  line:  "E2E8F0",
};

// ---------- Shadow factory (never reuse object — pptxgenjs mutates it) ----------
const makeShadow = () => ({
  type: "outer",
  blur: 8,
  offset: 3,
  angle: 135,
  color: "000000",
  opacity: 0.12,
});

// ---------- Icon renderer: react-icons -> SVG -> PNG -> base64 data URI ----------
async function iconPng(IconComponent, color = "FFFFFF", size = 256) {
  const hex = color.startsWith("#") ? color : "#" + color;
  const svg = ReactDOMServer.renderToStaticMarkup(
    React.createElement(IconComponent, { color: hex, size: String(size) })
  );
  const buf = await sharp(Buffer.from(svg)).png().toBuffer();
  return "data:image/png;base64," + buf.toString("base64");
}

// ---------- Slide dimensions (16:9, 13.333 x 7.5 in) ----------
const W = 13.333;
const H = 7.5;

// =========================================================================
async function build() {
  const pptx = new PptxGenJS();
  pptx.layout = "LAYOUT_WIDE";
  pptx.title = "MexiPay × Arteria / Cuenca — Partnership Proposal";
  pptx.company = "Quantor";
  pptx.author = "MexiPay";

  // Pre-render icons we'll use
  const ic = {
    qr:        await iconPng(FA.FaQrcode,        C.teal),
    mobile:    await iconPng(FA.FaMobileAlt,     C.mint),
    store:     await iconPng(FA.FaStore,         C.gold),
    check:     await iconPng(FA.FaCheckCircle,   C.mint),
    card:      await iconPng(FA.FaCreditCard,    C.teal),
    shield:    await iconPng(FA.FaShieldAlt,     C.mint),
    rocket:    await iconPng(FA.FaRocket,        C.gold),
    handshake: await iconPng(FA.FaHandshake,     C.teal),
    money:     await iconPng(FA.FaMoneyBillWave, C.mint),
    bolt:      await iconPng(FA.FaBolt,          C.gold),
    // White / dark variants
    qrW:    await iconPng(FA.FaQrcode,      C.white),
    boltW:  await iconPng(FA.FaBolt,        C.white),
    shieldW: await iconPng(FA.FaShieldAlt,  C.white),
    globeW:  await iconPng(FA.FaGlobeAmericas, C.white),
    mobileW: await iconPng(FA.FaMobileAlt,  C.white),
    storeW:  await iconPng(FA.FaStore,      C.white),
    checkW:  await iconPng(FA.FaCheckCircle, C.white),
  };

  // ---------------------------------------------------------------- 1. COVER
  {
    const s = pptx.addSlide();
    s.background = { color: C.navy };

    // Subtle accent shapes (no full-width bars)
    s.addShape(pptx.ShapeType.ellipse, {
      x: -2, y: -2, w: 5, h: 5,
      fill: { color: C.teal }, line: { type: "none" },
      // simulate soft glow via opacity prop (NOT 8-char hex)
    });
    s.addShape(pptx.ShapeType.ellipse, {
      x: -2, y: -2, w: 5, h: 5,
      fill: { color: C.teal, transparency: 85 }, line: { type: "none" },
    });
    s.addShape(pptx.ShapeType.ellipse, {
      x: W - 3, y: H - 3, w: 5, h: 5,
      fill: { color: C.mint, transparency: 88 }, line: { type: "none" },
    });

    // FIFA 2026 ready badge (top right)
    s.addShape(pptx.ShapeType.roundRect, {
      x: W - 3.0, y: 0.5, w: 2.5, h: 0.5,
      fill: { color: C.gold }, line: { type: "none" },
      rectRadius: 0.25,
    });
    s.addText("★ FIFA 2026 READY", {
      x: W - 3.0, y: 0.5, w: 2.5, h: 0.5,
      fontFace: "Arial Black", fontSize: 12, color: C.navy,
      align: "center", valign: "middle", bold: true,
    });

    // Brand mark
    s.addText("MEXIPAY", {
      x: 0.7, y: 0.5, w: 4, h: 0.6,
      fontFace: "Arial Black", fontSize: 22, color: C.teal,
      bold: true, charSpacing: 4,
    });

    // QR icon (large, faint)
    s.addImage({ data: ic.qrW, x: W - 4.2, y: H - 4.2, w: 3.6, h: 3.6,
      transparency: 78 });

    // Headline
    s.addText("Pay Anywhere.\nNo Hardware. No Commission.", {
      x: 0.7, y: 2.2, w: 10, h: 2.2,
      fontFace: "Arial Black", fontSize: 54, color: C.white,
      bold: true, valign: "top",
    });

    s.addText("Partnership Proposal for Arteria / Cuenca", {
      x: 0.7, y: 4.6, w: 10, h: 0.6,
      fontFace: "Arial", fontSize: 22, color: C.teal,
    });

    s.addText("White-Label IFPE Wallet Infrastructure for Mexico's First Cashless World Cup", {
      x: 0.7, y: 5.2, w: 10, h: 0.5,
      fontFace: "Arial", fontSize: 14, color: C.white, italic: true,
    });

    // Footer
    s.addText("Quantor · Mexico City · 2026", {
      x: 0.7, y: H - 0.6, w: 6, h: 0.3,
      fontFace: "Arial", fontSize: 10, color: C.white,
    });
    s.addText("picassoglitch/mexipay", {
      x: W - 4.2, y: H - 0.6, w: 3.5, h: 0.3,
      fontFace: "Arial", fontSize: 10, color: C.teal, align: "right",
    });
  }

  // ------------------------------------------------------------ 2. PROBLEM
  {
    const s = pptx.addSlide();
    s.background = { color: C.white };

    s.addText("The Problem", {
      x: 0.7, y: 0.4, w: 8, h: 0.6,
      fontFace: "Arial Black", fontSize: 32, color: C.navy, bold: true,
    });
    s.addText("Mexico's merchant payment stack is broken — and FIFA 2026 will expose it.", {
      x: 0.7, y: 1.05, w: 11, h: 0.5,
      fontFace: "Arial", fontSize: 16, color: C.slate,
    });

    const cards = [
      {
        icon: ic.money, color: C.gold,
        title: "High Fees",
        stat: "3.6%",
        body: "Clip charges up to 3.6% per transaction — eating directly into thin merchant margins on every sale.",
      },
      {
        icon: ic.store, color: C.teal,
        title: "Hardware Cost",
        stat: "$500–2,000",
        body: "Every Clip-style POS requires hardware ranging $600–$2,500 MXN, blocking small merchants from going cashless.",
      },
      {
        icon: ic.bolt, color: C.mint,
        title: "FIFA 2026 Gap",
        stat: "5.5M tourists",
        body: "Foreign visitors will arrive with no QR option that works without hardware — and merchants without contactless lose them.",
      },
    ];

    const cardY = 1.85, cardH = 3.6, cardW = 3.95, gap = 0.25;
    cards.forEach((c, i) => {
      const x = 0.7 + i * (cardW + gap);
      s.addShape(pptx.ShapeType.roundRect, {
        x, y: cardY, w: cardW, h: cardH,
        fill: { color: C.cloud }, line: { color: C.line, width: 1 },
        rectRadius: 0.15, shadow: makeShadow(),
      });
      s.addImage({ data: c.icon, x: x + 0.35, y: cardY + 0.35, w: 0.7, h: 0.7 });
      s.addText(c.title, {
        x: x + 1.2, y: cardY + 0.35, w: cardW - 1.4, h: 0.7,
        fontFace: "Arial Black", fontSize: 18, color: C.navy, bold: true, valign: "middle",
      });
      s.addText(c.stat, {
        x: x + 0.35, y: cardY + 1.25, w: cardW - 0.7, h: 0.9,
        fontFace: "Arial Black", fontSize: 38, color: c.color, bold: true,
      });
      s.addText(c.body, {
        x: x + 0.35, y: cardY + 2.25, w: cardW - 0.7, h: 1.2,
        fontFace: "Arial", fontSize: 12, color: C.slate, valign: "top",
      });
    });

    // Bottom stat bar
    const barY = 5.8;
    s.addShape(pptx.ShapeType.roundRect, {
      x: 0.7, y: barY, w: W - 1.4, h: 1.1,
      fill: { color: C.navy }, line: { type: "none" },
      rectRadius: 0.12, shadow: makeShadow(),
    });
    const stats = [
      { v: "1.2M",   l: "Mexican merchants without POS" },
      { v: "78%",    l: "of small merchants still cash-only" },
      { v: "$11B",   l: "in tourism spend at FIFA 2026" },
    ];
    stats.forEach((st, i) => {
      const sx = 0.9 + i * ((W - 1.8) / 3);
      s.addText(st.v, {
        x: sx, y: barY + 0.12, w: (W - 1.8) / 3, h: 0.45,
        fontFace: "Arial Black", fontSize: 22, color: C.gold, bold: true, align: "center",
      });
      s.addText(st.l, {
        x: sx, y: barY + 0.55, w: (W - 1.8) / 3, h: 0.45,
        fontFace: "Arial", fontSize: 11, color: C.white, align: "center",
      });
    });
  }

  // ----------------------------------------------------------- 3. SOLUTION
  {
    const s = pptx.addSlide();
    s.background = { color: C.navy };

    s.addText("The Solution", {
      x: 0.7, y: 0.4, w: 8, h: 0.6,
      fontFace: "Arial Black", fontSize: 32, color: C.white, bold: true,
    });
    s.addText("One app. One scan. Money lands in the merchant's wallet — instantly.", {
      x: 0.7, y: 1.05, w: 11, h: 0.5,
      fontFace: "Arial", fontSize: 16, color: C.teal,
    });

    // 4-step circular flow
    const steps = [
      { icon: ic.mobileW, title: "Open MexiPay", body: "Buyer launches the app — no card, no terminal." },
      { icon: ic.qrW,     title: "Scan QR",      body: "Point camera at merchant's QR sticker." },
      { icon: ic.checkW,  title: "Confirm",      body: "Tap to authorize. Biometric secured." },
      { icon: ic.storeW,  title: "Merchant Paid", body: "SPEI settles in seconds via Cuenca." },
    ];
    const flowY = 2.1, circleSize = 1.4;
    const slotW = (W - 1.4) / 4;
    steps.forEach((st, i) => {
      const cx = 0.7 + slotW * i + slotW / 2;
      // Connecting line (between, not under title)
      if (i > 0) {
        const prevCx = 0.7 + slotW * (i - 1) + slotW / 2;
        s.addShape(pptx.ShapeType.line, {
          x: prevCx + circleSize / 2, y: flowY + circleSize / 2,
          w: cx - prevCx - circleSize, h: 0,
          line: { color: C.teal, width: 2, dashType: "dash" },
        });
      }
      // Circle
      s.addShape(pptx.ShapeType.ellipse, {
        x: cx - circleSize / 2, y: flowY, w: circleSize, h: circleSize,
        fill: { color: C.teal }, line: { color: C.white, width: 3 },
      });
      s.addImage({
        data: st.icon,
        x: cx - 0.4, y: flowY + 0.3, w: 0.8, h: 0.8,
      });
      // Step number
      s.addShape(pptx.ShapeType.ellipse, {
        x: cx + circleSize / 2 - 0.4, y: flowY - 0.15, w: 0.5, h: 0.5,
        fill: { color: C.gold }, line: { type: "none" },
      });
      s.addText(String(i + 1), {
        x: cx + circleSize / 2 - 0.4, y: flowY - 0.15, w: 0.5, h: 0.5,
        fontFace: "Arial Black", fontSize: 14, color: C.navy, bold: true,
        align: "center", valign: "middle",
      });
      // Title + body
      s.addText(st.title, {
        x: cx - slotW / 2 + 0.2, y: flowY + circleSize + 0.2, w: slotW - 0.4, h: 0.4,
        fontFace: "Arial Black", fontSize: 14, color: C.white, bold: true, align: "center",
      });
      s.addText(st.body, {
        x: cx - slotW / 2 + 0.2, y: flowY + circleSize + 0.6, w: slotW - 0.4, h: 0.7,
        fontFace: "Arial", fontSize: 11, color: C.cloud, align: "center", valign: "top",
      });
    });

    // 4 feature callout cards
    const feats = [
      { icon: ic.money, color: C.mint, title: "0% Commission", body: "Merchants keep 100%." },
      { icon: ic.mobile, color: C.teal, title: "100% In-App", body: "No POS, no hardware." },
      { icon: ic.bolt,   color: C.gold, title: "Real-Time SPEI", body: "Funds settle in seconds." },
      { icon: ic.shield, color: C.mint, title: "Foreign Tourists", body: "Works for FIFA visitors." },
    ];
    const fY = 5.4, fH = 1.7, fW = 2.95, gap = 0.2;
    const totalW = feats.length * fW + (feats.length - 1) * gap;
    const startX = (W - totalW) / 2;
    feats.forEach((f, i) => {
      const x = startX + i * (fW + gap);
      s.addShape(pptx.ShapeType.roundRect, {
        x, y: fY, w: fW, h: fH,
        fill: { color: "0F2440" }, line: { color: f.color, width: 1 },
        rectRadius: 0.12,
      });
      s.addImage({ data: f.icon, x: x + 0.25, y: fY + 0.3, w: 0.6, h: 0.6 });
      s.addText(f.title, {
        x: x + 0.95, y: fY + 0.3, w: fW - 1.1, h: 0.6,
        fontFace: "Arial Black", fontSize: 14, color: f.color, bold: true, valign: "middle",
      });
      s.addText(f.body, {
        x: x + 0.25, y: fY + 1.0, w: fW - 0.5, h: 0.6,
        fontFace: "Arial", fontSize: 11, color: C.white, valign: "top",
      });
    });
  }

  // -------------------------------------------------- 4. WHY ARTERIA × CUENCA
  {
    const s = pptx.addSlide();
    s.background = { color: C.white };

    s.addText("Why Arteria × Cuenca", {
      x: 0.7, y: 0.4, w: 10, h: 0.6,
      fontFace: "Arial Black", fontSize: 32, color: C.navy, bold: true,
    });
    s.addText("MexiPay needs an IFPE. Arteria Connect ships one as an API. The fit is exact.", {
      x: 0.7, y: 1.05, w: 12, h: 0.5,
      fontFace: "Arial", fontSize: 16, color: C.slate,
    });

    // ----- Left card: Cuenca via Arteria Connect (light)
    const lx = 0.7, ly = 1.85, lw = 5.95, lh = 5.0;
    s.addShape(pptx.ShapeType.roundRect, {
      x: lx, y: ly, w: lw, h: lh,
      fill: { color: C.cloud }, line: { color: C.line, width: 1 },
      rectRadius: 0.15, shadow: makeShadow(),
    });
    s.addImage({ data: ic.shield, x: lx + 0.4, y: ly + 0.4, w: 0.6, h: 0.6 });
    s.addText("Cuenca via Arteria Connect", {
      x: lx + 1.1, y: ly + 0.35, w: lw - 1.3, h: 0.7,
      fontFace: "Arial Black", fontSize: 20, color: C.navy, bold: true, valign: "middle",
    });
    s.addText("What they bring", {
      x: lx + 0.4, y: ly + 1.1, w: lw - 0.8, h: 0.4,
      fontFace: "Arial", fontSize: 12, color: C.teal, italic: true,
    });

    const leftItems = [
      "Regulated IFPE under Mexico's Ley Fintech",
      "500K+ active end-user accounts",
      "$1B+ MXN processed annually",
      "REST API for embedded wallet creation",
      "SPEI transfers + Mastercard issuance",
      "KYC / AML / compliance fully handled",
    ];
    leftItems.forEach((t, i) => {
      const ry = ly + 1.6 + i * 0.5;
      s.addImage({ data: ic.check, x: lx + 0.4, y: ry + 0.05, w: 0.3, h: 0.3 });
      s.addText(t, {
        x: lx + 0.85, y: ry, w: lw - 1.0, h: 0.4,
        fontFace: "Arial", fontSize: 13, color: C.ink, valign: "middle",
      });
    });

    // ----- Right card: What MexiPay Brings (dark)
    const rx = 6.85, ry = 1.85, rw = 5.8, rh = 5.0;
    s.addShape(pptx.ShapeType.roundRect, {
      x: rx, y: ry, w: rw, h: rh,
      fill: { color: C.navy }, line: { type: "none" },
      rectRadius: 0.15, shadow: makeShadow(),
    });
    s.addImage({ data: ic.handshake, x: rx + 0.4, y: ry + 0.4, w: 0.6, h: 0.6 });
    s.addText("What MexiPay Brings to Arteria", {
      x: rx + 1.1, y: ry + 0.35, w: rw - 1.3, h: 0.7,
      fontFace: "Arial Black", fontSize: 20, color: C.white, bold: true, valign: "middle",
    });
    s.addText("Distribution & growth", {
      x: rx + 0.4, y: ry + 1.1, w: rw - 0.8, h: 0.4,
      fontFace: "Arial", fontSize: 12, color: C.gold, italic: true,
    });

    const rightItems = [
      "Distribution to FIFA 2026 merchant network",
      "Thousands of new Cuenca-powered accounts",
      "Live QR merchant network across CDMX & host cities",
      "Full product, design & engineering team in-house",
      "10,000 active merchants pre-World Cup target",
    ];
    rightItems.forEach((t, i) => {
      const ity = ry + 1.6 + i * 0.55;
      s.addText(">>", {
        x: rx + 0.4, y: ity, w: 0.5, h: 0.4,
        fontFace: "Arial Black", fontSize: 14, color: C.teal, bold: true, valign: "middle",
      });
      s.addText(t, {
        x: rx + 0.95, y: ity, w: rw - 1.1, h: 0.4,
        fontFace: "Arial", fontSize: 13, color: C.white, valign: "middle",
      });
    });
  }

  // --------------------------------------------------- 5. BUSINESS MODEL
  {
    const s = pptx.addSlide();
    s.background = { color: C.navy };

    s.addText("Business Model", {
      x: 0.7, y: 0.4, w: 8, h: 0.6,
      fontFace: "Arial Black", fontSize: 32, color: C.white, bold: true,
    });
    s.addText("SaaS recurring revenue + interchange. Aligned with Arteria from day one.", {
      x: 0.7, y: 1.05, w: 12, h: 0.5,
      fontFace: "Arial", fontSize: 16, color: C.teal,
    });

    const plans = [
      {
        icon: ic.store, color: C.teal, accent: C.teal,
        name: "Merchant Plan",
        price: "$299",
        unit: "MXN / month",
        feats: [
          "QR acceptance unlimited",
          "Real-time SPEI deposits",
          "Basic dashboard",
          "Email support",
        ],
      },
      {
        icon: ic.rocket, color: C.gold, accent: C.gold,
        name: "Merchant Pro",
        price: "$599",
        unit: "MXN / month",
        badge: "MOST POPULAR",
        feats: [
          "Everything in Merchant Plan",
          "Multi-location & staff",
          "Analytics + reconciliation",
          "Priority support + Mastercard",
        ],
      },
      {
        icon: ic.card, color: C.mint, accent: C.mint,
        name: "Card Interchange",
        price: "0.5%",
        unit: "on card volume",
        feats: [
          "Via Arteria Mastercard rails",
          "Revenue share with Cuenca",
          "Zero merchant overhead",
          "Activated automatically",
        ],
      },
    ];

    const pY = 1.85, pH = 4.4, pW = 3.95, pGap = 0.25;
    plans.forEach((p, i) => {
      const x = 0.7 + i * (pW + pGap);
      s.addShape(pptx.ShapeType.roundRect, {
        x, y: pY, w: pW, h: pH,
        fill: { color: "0F2440" }, line: { color: p.accent, width: 2 },
        rectRadius: 0.18, shadow: makeShadow(),
      });
      if (p.badge) {
        s.addShape(pptx.ShapeType.roundRect, {
          x: x + pW - 1.7, y: pY - 0.2, w: 1.6, h: 0.4,
          fill: { color: p.accent }, line: { type: "none" },
          rectRadius: 0.2,
        });
        s.addText(p.badge, {
          x: x + pW - 1.7, y: pY - 0.2, w: 1.6, h: 0.4,
          fontFace: "Arial Black", fontSize: 9, color: C.navy,
          align: "center", valign: "middle", bold: true,
        });
      }
      s.addImage({ data: p.icon, x: x + 0.35, y: pY + 0.35, w: 0.7, h: 0.7 });
      s.addText(p.name, {
        x: x + 0.35, y: pY + 1.15, w: pW - 0.7, h: 0.5,
        fontFace: "Arial Black", fontSize: 18, color: C.white, bold: true,
      });
      s.addText(p.price, {
        x: x + 0.35, y: pY + 1.7, w: pW - 0.7, h: 0.9,
        fontFace: "Arial Black", fontSize: 44, color: p.accent, bold: true,
      });
      s.addText(p.unit, {
        x: x + 0.35, y: pY + 2.55, w: pW - 0.7, h: 0.35,
        fontFace: "Arial", fontSize: 12, color: C.cloud,
      });
      p.feats.forEach((f, fi) => {
        const fy = pY + 3.0 + fi * 0.32;
        s.addText("·", {
          x: x + 0.35, y: fy, w: 0.2, h: 0.3,
          fontFace: "Arial Black", fontSize: 16, color: p.accent, bold: true,
        });
        s.addText(f, {
          x: x + 0.55, y: fy, w: pW - 0.7, h: 0.3,
          fontFace: "Arial", fontSize: 11, color: C.white, valign: "middle",
        });
      });
    });

    // Bottom note
    const nY = 6.5;
    s.addShape(pptx.ShapeType.roundRect, {
      x: 0.7, y: nY, w: W - 1.4, h: 0.7,
      fill: { color: C.gold }, line: { type: "none" },
      rectRadius: 0.12,
    });
    s.addText("1,000 merchants × $299 MXN = $299K MXN / month recurring   ·   + interchange upside via Arteria Mastercard", {
      x: 0.7, y: nY, w: W - 1.4, h: 0.7,
      fontFace: "Arial Black", fontSize: 14, color: C.navy, bold: true,
      align: "center", valign: "middle",
    });
  }

  // ------------------------------------------------ 6. TRACTION & ROADMAP
  {
    const s = pptx.addSlide();
    s.background = { color: C.white };

    s.addText("Traction & Roadmap", {
      x: 0.7, y: 0.4, w: 10, h: 0.6,
      fontFace: "Arial Black", fontSize: 32, color: C.navy, bold: true,
    });
    s.addText("From scaffolded monorepo to FIFA 2026 launch in 14 months.", {
      x: 0.7, y: 1.05, w: 12, h: 0.5,
      fontFace: "Arial", fontSize: 16, color: C.slate,
    });

    // Timeline
    const milestones = [
      { q: "Q2 2025",  t: "Monorepo Scaffolded",      done: true,  color: C.mint },
      { q: "Q3 2025",  t: "STP/SPEI Exploration",     done: true,  color: C.mint },
      { q: "Q1 2026",  t: "Arteria API Integration",  done: false, color: C.teal },
      { q: "Q2 2026",  t: "Beta · 100 Merchants CDMX", done: false, color: C.teal },
      { q: "Jun 2026", t: "FIFA 2026 Launch",          done: false, color: C.gold },
    ];

    const tY = 2.4;
    const tStart = 1.0;
    const tEnd = W - 1.0;
    const tLen = tEnd - tStart;
    // Base line
    s.addShape(pptx.ShapeType.line, {
      x: tStart, y: tY, w: tLen, h: 0,
      line: { color: C.line, width: 4 },
    });
    milestones.forEach((m, i) => {
      const cx = tStart + (tLen / (milestones.length - 1)) * i;
      // Dot
      s.addShape(pptx.ShapeType.ellipse, {
        x: cx - 0.22, y: tY - 0.22, w: 0.44, h: 0.44,
        fill: { color: m.color }, line: { color: C.white, width: 3 },
        shadow: makeShadow(),
      });
      if (m.done) {
        s.addImage({ data: ic.checkW, x: cx - 0.13, y: tY - 0.13, w: 0.26, h: 0.26 });
      } else {
        s.addText(String(i + 1), {
          x: cx - 0.22, y: tY - 0.22, w: 0.44, h: 0.44,
          fontFace: "Arial Black", fontSize: 12, color: C.navy, bold: true,
          align: "center", valign: "middle",
        });
      }
      // Quarter label
      s.addText(m.q, {
        x: cx - 1.1, y: tY - 0.95, w: 2.2, h: 0.4,
        fontFace: "Arial Black", fontSize: 13, color: m.color, bold: true, align: "center",
      });
      // Title (alternating above/below for readability — all below for simplicity)
      s.addText(m.t, {
        x: cx - 1.1, y: tY + 0.4, w: 2.2, h: 0.7,
        fontFace: "Arial", fontSize: 12, color: C.ink, align: "center", valign: "top",
      });
    });

    // Asks box
    const aY = 4.5, aH = 2.5;
    s.addShape(pptx.ShapeType.roundRect, {
      x: 0.7, y: aY, w: W - 1.4, h: aH,
      fill: { color: C.cloud }, line: { color: C.teal, width: 2 },
      rectRadius: 0.15, shadow: makeShadow(),
    });
    s.addImage({ data: ic.rocket, x: 1.0, y: aY + 0.3, w: 0.55, h: 0.55 });
    s.addText("What We're Asking Arteria For", {
      x: 1.7, y: aY + 0.25, w: 10, h: 0.6,
      fontFace: "Arial Black", fontSize: 20, color: C.navy, bold: true, valign: "middle",
    });

    const asks = [
      { n: "1", t: "API Access",             d: "Full sandbox + production access to Arteria Connect for embedded wallets, SPEI, and Mastercard issuance." },
      { n: "2", t: "Commercial Terms",       d: "Preferential pricing aligned to a high-volume FIFA 2026 partner — interchange + per-account economics." },
      { n: "3", t: "Sandbox in 60 Days",     d: "Joint kickoff, sandbox keys, and integration support to ship our first end-to-end transaction within 60 days." },
    ];
    const askY = aY + 1.05;
    const askW = (W - 1.8) / 3;
    asks.forEach((a, i) => {
      const x = 0.9 + i * askW;
      s.addShape(pptx.ShapeType.ellipse, {
        x, y: askY, w: 0.55, h: 0.55,
        fill: { color: C.teal }, line: { type: "none" },
      });
      s.addText(a.n, {
        x, y: askY, w: 0.55, h: 0.55,
        fontFace: "Arial Black", fontSize: 18, color: C.white, bold: true,
        align: "center", valign: "middle",
      });
      s.addText(a.t, {
        x: x + 0.7, y: askY, w: askW - 0.9, h: 0.45,
        fontFace: "Arial Black", fontSize: 14, color: C.navy, bold: true, valign: "middle",
      });
      s.addText(a.d, {
        x, y: askY + 0.65, w: askW - 0.3, h: 0.9,
        fontFace: "Arial", fontSize: 11, color: C.slate, valign: "top",
      });
    });
  }

  // ----------------------------------------------------------- 7. CTA / CLOSE
  {
    const s = pptx.addSlide();
    s.background = { color: C.navy };

    // Decorative blobs
    s.addShape(pptx.ShapeType.ellipse, {
      x: -3, y: H - 3, w: 7, h: 7,
      fill: { color: C.teal, transparency: 88 }, line: { type: "none" },
    });
    s.addShape(pptx.ShapeType.ellipse, {
      x: W - 4, y: -3, w: 7, h: 7,
      fill: { color: C.mint, transparency: 90 }, line: { type: "none" },
    });

    s.addImage({ data: ic.handshake, x: W / 2 - 0.6, y: 1.0, w: 1.2, h: 1.2 });

    s.addText("Let's Build the Payment\nInfrastructure for FIFA 2026 Together", {
      x: 0.7, y: 2.4, w: W - 1.4, h: 2.0,
      fontFace: "Arial Black", fontSize: 40, color: C.white, bold: true, align: "center",
    });

    s.addText("MexiPay + Arteria + Cuenca = Mexico's first fully embedded, license-backed QR wallet.", {
      x: 0.7, y: 4.4, w: W - 1.4, h: 0.5,
      fontFace: "Arial", fontSize: 16, color: C.teal, align: "center", italic: true,
    });

    // CTA button
    const btnW = 5.5, btnH = 0.95;
    const btnX = (W - btnW) / 2, btnY = 5.2;
    s.addShape(pptx.ShapeType.roundRect, {
      x: btnX, y: btnY, w: btnW, h: btnH,
      fill: { color: C.teal }, line: { type: "none" },
      rectRadius: 0.45, shadow: makeShadow(),
    });
    s.addText("Schedule a Call  →  arteria.xyz/connect", {
      x: btnX, y: btnY, w: btnW, h: btnH,
      fontFace: "Arial Black", fontSize: 18, color: C.navy, bold: true,
      align: "center", valign: "middle",
    });

    // Footer
    s.addText("MexiPay  ·  picassoglitch/mexipay  ·  Mexico City, MX", {
      x: 0.7, y: H - 0.7, w: W - 1.4, h: 0.4,
      fontFace: "Arial", fontSize: 12, color: C.white, align: "center",
    });
  }

  // ---------------------------------------------------------- write file
  const outPath = path.join(__dirname, "mexipay_arteria_pitch.pptx");
  await pptx.writeFile({ fileName: outPath });
  console.log("Generated:", outPath);
}

build().catch(e => { console.error(e); process.exit(1); });
