// ---------- Tabs ----------
document.querySelectorAll(".tab-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tab-btn").forEach((b) => b.classList.remove("active"));
    document.querySelectorAll(".tab-panel").forEach((p) => p.classList.remove("active"));
    btn.classList.add("active");
    document.getElementById("tab-" + btn.dataset.tab).classList.add("active");
  });
});

const CATEGORY_LABELS = {
  victim: "Victim",
  defendant: "Defendant",
  system: "Justice system",
  security: "Security team",
  law_enforcement: "Law enforcement",
  investigator: "Investigator",
  judiciary_medical: "Judiciary / medical examiner",
  prosecution: "Prosecution",
  defense: "Defense",
  associate: "Associate / commentator",
  witness: "Witness / scene",
  other: "Other",
};

// ---------- Force-directed graph (no external deps) ----------
async function loadCaseMap() {
  const res = await fetch("data/case_map.json");
  const { nodes, edges } = await res.json();

  const svg = document.getElementById("graph");
  const wrap = svg.parentElement;
  const width = wrap.clientWidth || 900;
  const height = wrap.clientHeight || 600;
  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);

  const idIndex = {};
  nodes.forEach((n, i) => {
    idIndex[n.id] = i;
    const angle = (i / nodes.length) * Math.PI * 2;
    n.x = width / 2 + Math.cos(angle) * 250 + (Math.random() - 0.5) * 40;
    n.y = height / 2 + Math.sin(angle) * 250 + (Math.random() - 0.5) * 40;
    n.vx = 0;
    n.vy = 0;
  });
  // seed hubs near center, spread out
  const hubs = nodes.filter((n) => n.kind === "hub");
  hubs.forEach((h, i) => {
    h.x = width / 2 + (i - (hubs.length - 1) / 2) * 260;
    h.y = height / 2;
  });

  for (let iter = 0; iter < 350; iter++) {
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const a = nodes[i], b = nodes[j];
        let dx = a.x - b.x, dy = a.y - b.y;
        let distSq = dx * dx + dy * dy || 0.01;
        let dist = Math.sqrt(distSq);
        let force = 2200 / distSq;
        let fx = (dx / dist) * force, fy = (dy / dist) * force;
        a.vx += fx; a.vy += fy;
        b.vx -= fx; b.vy -= fy;
      }
    }
    edges.forEach((e) => {
      const a = nodes[idIndex[e.source]], b = nodes[idIndex[e.target]];
      let dx = b.x - a.x, dy = b.y - a.y;
      let dist = Math.sqrt(dx * dx + dy * dy) || 0.01;
      let targetLen = a.kind === "hub" && b.kind === "hub" ? 260 : 110;
      let force = (dist - targetLen) * 0.02;
      let fx = (dx / dist) * force, fy = (dy / dist) * force;
      a.vx += fx; a.vy += fy;
      b.vx -= fx; b.vy -= fy;
    });
    nodes.forEach((n) => {
      n.vx += (width / 2 - n.x) * 0.0015;
      n.vy += (height / 2 - n.y) * 0.0015;
      n.vx *= 0.82; n.vy *= 0.82;
      n.x += n.vx; n.y += n.vy;
      n.x = Math.max(40, Math.min(width - 40, n.x));
      n.y = Math.max(30, Math.min(height - 30, n.y));
    });
  }

  const NS = "http://www.w3.org/2000/svg";
  svg.innerHTML = "";
  const linkLayer = document.createElementNS(NS, "g");
  const nodeLayer = document.createElementNS(NS, "g");
  svg.appendChild(linkLayer);
  svg.appendChild(nodeLayer);

  const linkEls = edges.map((e) => {
    const line = document.createElementNS(NS, "line");
    line.setAttribute("class", "link" + (e.verified ? "" : " unverified"));
    linkLayer.appendChild(line);
    return { el: line, e };
  });

  function colorFor(cat) {
    return getComputedStyle(document.documentElement).getPropertyValue("--" + cat).trim() || "#888";
  }

  const nodeEls = nodes.map((n) => {
    const g = document.createElementNS(NS, "g");
    g.setAttribute("class", "node" + (n.kind === "hub" ? " hub-node" : ""));
    const r = n.kind === "hub" ? 34 : 16;
    const circle = document.createElementNS(NS, "circle");
    circle.setAttribute("r", r);
    circle.setAttribute("fill", colorFor(n.category));
    circle.setAttribute("stroke", "#0e1014");
    circle.setAttribute("stroke-width", "2");
    circle.setAttribute("fill-opacity", n.kind === "hub" ? "0.9" : "0.85");
    const text = document.createElementNS(NS, "text");
    text.setAttribute("text-anchor", "middle");
    text.setAttribute("dy", r + 13);
    text.textContent = n.label.split("\n")[0];
    g.appendChild(circle);
    g.appendChild(text);
    nodeLayer.appendChild(g);

    g.addEventListener("click", () => showDetail(n));

    let dragging = false;
    g.addEventListener("pointerdown", (ev) => {
      dragging = true;
      g.setPointerCapture(ev.pointerId);
    });
    g.addEventListener("pointermove", (ev) => {
      if (!dragging) return;
      const pt = svg.createSVGPoint();
      pt.x = ev.clientX; pt.y = ev.clientY;
      const loc = pt.matrixTransform(svg.getScreenCTM().inverse());
      n.x = loc.x; n.y = loc.y;
      render();
    });
    g.addEventListener("pointerup", () => (dragging = false));

    return { el: g, n };
  });

  function render() {
    linkEls.forEach(({ el, e }) => {
      const a = nodes[idIndex[e.source]], b = nodes[idIndex[e.target]];
      el.setAttribute("x1", a.x); el.setAttribute("y1", a.y);
      el.setAttribute("x2", b.x); el.setAttribute("y2", b.y);
    });
    nodeEls.forEach(({ el, n }) => {
      el.setAttribute("transform", `translate(${n.x},${n.y})`);
    });
  }
  render();

  function showDetail(n) {
    const panel = document.getElementById("map-detail");
    const catLabel = CATEGORY_LABELS[n.category] || n.category;
    panel.innerHTML = `
      <h3>${n.label.replace("\n", " ")}</h3>
      <span class="tag">${catLabel}</span>
      <dl>
        <dt>Case role</dt><dd>${n.role || "—"}</dd>
        <dt>Summary</dt><dd>${n.summary || "—"}</dd>
        ${n.crossover ? `<dt>Pre-shooting contact / crossover</dt><dd>${n.crossover}</dd>` : ""}
        <dt>Connection verified?</dt><dd>${n.verified || "—"}</dd>
        ${n.collision_risk ? `<dt>Name collision risk</dt><dd>${n.collision_risk}</dd>` : ""}
        <dt>Source</dt><dd>${n.source ? `<a href="${n.source}" target="_blank" rel="noopener">${n.source}</a>` : "Not individually sourced (see Sources tab)"}</dd>
      </dl>
    `;
  }

  // legend
  const legend = document.getElementById("map-legend");
  const seen = new Set();
  nodes.forEach((n) => seen.add(n.category));
  legend.innerHTML = [...seen]
    .map((c) => `<span><i style="background:${colorFor(c)}"></i>${CATEGORY_LABELS[c] || c}</span>`)
    .join("");
}

// ---------- Claims tracker ----------
async function loadClaims() {
  const [claims, controls] = await Promise.all([
    fetch("data/trends_master.json").then((r) => r.json()),
    fetch("data/controls.json").then((r) => r.json()),
  ]);

  const gradeCounts = { A: 0, B: 0, C: 0, D: 0 };
  const regionCounts = {};
  claims.forEach((c) => {
    gradeCounts[c["Evidence Grade"]] = (gradeCounts[c["Evidence Grade"]] || 0) + 1;
    const r = c["Reported Region"] || "Unspecified";
    regionCounts[r] = (regionCounts[r] || 0) + 1;
  });

  document.getElementById("claims-stats").innerHTML = `
    <div class="stat-tile"><div class="num">${claims.length}</div><div class="label">Total claim records</div></div>
    <div class="stat-tile grade-a"><div class="num">${gradeCounts.A || 0}</div><div class="label">Grade A (primary export)</div></div>
    <div class="stat-tile grade-b"><div class="num">${gradeCounts.B || 0}</div><div class="label">Grade B (secondary/archived)</div></div>
    <div class="stat-tile grade-c"><div class="num">${gradeCounts.C || 0}</div><div class="label">Grade C (tertiary/weak)</div></div>
    <div class="stat-tile"><div class="num">${regionCounts["Israel"] || 0}</div><div class="label">Tagged region: Israel</div></div>
  `;

  const regionSelect = document.getElementById("filter-region");
  Object.keys(regionCounts).sort().forEach((r) => {
    const opt = document.createElement("option");
    opt.value = r; opt.textContent = `${r} (${regionCounts[r]})`;
    regionSelect.appendChild(opt);
  });

  function renderGrid() {
    const q = document.getElementById("claims-search").value.toLowerCase();
    const grade = document.getElementById("filter-grade").value;
    const region = document.getElementById("filter-region").value;
    const grid = document.getElementById("claims-grid");

    const filtered = claims.filter((c) => {
      if (grade && c["Evidence Grade"] !== grade) return false;
      if (region && c["Reported Region"] !== region) return false;
      if (q) {
        const hay = `${c["Subject / Entity"]} ${c["Exact Query / Term"]} ${c["Source Type"]}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    grid.innerHTML = filtered
      .map((c) => {
        const grade = (c["Evidence Grade"] || "D").toLowerCase();
        return `
        <div class="claim-card grade-${grade}">
          <div class="badge grade-${grade}">${c["Evidence Grade"] || "D"}</div>
          <h4>${c["Subject / Entity"]}</h4>
          <div class="meta">"${c["Exact Query / Term"]}" · ${c["Reported Region"]} · ${c["Start Date"] || ""}${c["End Date"] && c["End Date"] !== c["Start Date"] ? " – " + c["End Date"] : ""} · ${c["Days Before Shooting"] ?? "?"}d before</div>
          <div class="meta">Role: ${c["Case Role / Connection"] || "—"}</div>
          <div class="meta">Source: ${c["Source Type"] || "—"}</div>
          ${c["Source URL"] ? `<a href="${c["Source URL"]}" target="_blank" rel="noopener">view source ↗</a>` : ""}
          ${c["Conflict / Caveat Notes"] ? `<div class="caveat">⚠ ${c["Conflict / Caveat Notes"]}</div>` : ""}
        </div>`;
      })
      .join("") || `<p class="placeholder">No records match those filters.</p>`;
  }

  document.getElementById("claims-search").addEventListener("input", renderGrid);
  document.getElementById("filter-grade").addEventListener("change", renderGrid);
  document.getElementById("filter-region").addEventListener("change", renderGrid);
  renderGrid();

  document.getElementById("filter-controls-only").addEventListener("change", (ev) => {
    document.getElementById("controls-panel").classList.toggle("hidden", !ev.target.checked);
  });

  const table = document.getElementById("controls-table");
  table.innerHTML = `
    <tr><th>Control person</th><th>Rationale</th><th>Regions tested</th><th>Result</th></tr>
    ${controls
      .map(
        (c) => `<tr>
        <td>${c["Control Name"]}</td>
        <td>${c["Control Rationale"]}</td>
        <td>${c["Regions"]}</td>
        <td>${c["Current Anomaly Status"]}</td>
      </tr>`
      )
      .join("")}
  `;
}

// ---------- Court record timeline ----------
async function loadTimeline() {
  const d = await fetch("data/timeline.json").then((r) => r.json());

  document.getElementById("case-header").innerHTML = `
    <h2>${d.case.caption}</h2>
    <div class="case-meta">
      <span><strong>Court:</strong> ${d.case.court}</span>
      <span><strong>Case No.:</strong> ${d.case.case_number}</span>
      <span><strong>Judge:</strong> ${d.case.judge}</span>
    </div>
    <div class="case-meta">
      <span><strong>Defense:</strong> ${d.case.defense}</span>
    </div>
    <div class="case-meta">
      <span><strong>Prosecution:</strong> ${d.case.prosecution}</span>
    </div>
    <div class="case-meta">
      <a href="${d.case.records_access}" target="_blank" rel="noopener">Official records access ↗</a>
      <a href="${d.case.document_repository}" target="_blank" rel="noopener">Document repository ↗</a>
    </div>
  `;

  document.getElementById("evidence-callout").innerHTML = `
    <h3>On the evidence-handling question</h3>
    <p>${d.evidence_handling_summary}</p>
  `;

  document.getElementById("overlay-note").innerHTML = `<strong>Note on the claim set:</strong> ${d.claim_overlay_note}`;

  const TRACK_LABEL = {
    institutional: "Institutional context",
    day_of: "Day of shooting",
    investigation: "Investigation",
    legal: "Legal process",
    evidence: "Evidence & challenges",
  };

  function render() {
    const active = [...document.querySelectorAll(".track-filter:checked")].map((c) => c.value);
    const el = document.getElementById("timeline");
    const shown = d.events.filter((e) => active.includes(e.track));

    el.innerHTML = shown
      .map((e) => {
        const flag = e.flag ? ` flag-${e.flag}` : "";
        return `
        <div class="tl-entry prov-${e.provenance}${flag}" data-track="${e.track}">
          <div class="tl-date">
            <span class="tl-d">${e.date}</span>
            ${e.time ? `<span class="tl-t">${e.time}</span>` : ""}
          </div>
          <div class="tl-body">
            <div class="tl-tags">
              <span class="tl-track">${TRACK_LABEL[e.track] || e.track}</span>
              <span class="prov-badge prov-${e.provenance}">${e.provenance}</span>
              ${e.flag === "defense_challenge" ? `<span class="tl-flag">defense challenge</span>` : ""}
              ${e.flag === "discrepancy" ? `<span class="tl-flag disc">date discrepancy</span>` : ""}
              ${e.flag === "key" ? `<span class="tl-flag key">key finding</span>` : ""}
            </div>
            <h4>${e.title}</h4>
            <p>${e.detail}</p>
            ${e.why_listed ? `<p class="tl-why"><strong>Why this is here:</strong> ${e.why_listed}</p>` : ""}
            <div class="tl-src">
              ${e.source ? `<a href="${e.source}" target="_blank" rel="noopener">source ↗</a>` : `<span class="nosrc">no direct source link — see repository</span>`}
              ${e.secondary_source ? `<a href="${e.secondary_source}" target="_blank" rel="noopener">corroborating ↗</a>` : ""}
            </div>
          </div>
        </div>`;
      })
      .join("");
  }

  document.querySelectorAll(".track-filter").forEach((c) => c.addEventListener("change", render));
  render();
}

// ---------- Normalization demo ----------
function initNormalizationDemo() {
  const VOLUMES = [1, 12, 340, 8900, 210000];
  // Same weekly shape every time -- only the absolute scale changes.
  const SHAPE = [0, 0, 0.02, 0, 0.05, 0, 0, 0.02, 0, 1, 0.08, 0.03, 0, 0.02];

  const slider = document.getElementById("volume-slider");
  const readout = document.getElementById("volume-readout");
  const NS = "http://www.w3.org/2000/svg";

  function drawBars(svg, values, maxLabel, color) {
    svg.innerHTML = "";
    const W = 320, H = 130, pad = 24;
    const max = Math.max(...values) || 1;
    const bw = (W - pad - 8) / values.length;

    // axis
    const axis = document.createElementNS(NS, "line");
    axis.setAttribute("x1", pad); axis.setAttribute("y1", H - 18);
    axis.setAttribute("x2", W - 4); axis.setAttribute("y2", H - 18);
    axis.setAttribute("stroke", "#3a4152");
    svg.appendChild(axis);

    const top = document.createElementNS(NS, "text");
    top.setAttribute("x", 2); top.setAttribute("y", 12);
    top.setAttribute("fill", "#9aa1b1"); top.setAttribute("font-size", "9");
    top.textContent = maxLabel;
    svg.appendChild(top);

    values.forEach((v, i) => {
      const h = (v / max) * (H - 36);
      const rect = document.createElementNS(NS, "rect");
      rect.setAttribute("x", pad + i * bw + 1);
      rect.setAttribute("y", H - 18 - h);
      rect.setAttribute("width", Math.max(bw - 2, 1));
      rect.setAttribute("height", Math.max(h, v > 0 ? 1 : 0));
      rect.setAttribute("fill", color);
      rect.setAttribute("rx", "1");
      svg.appendChild(rect);
    });
  }

  function update() {
    const idx = +slider.value;
    const peak = VOLUMES[idx];
    readout.textContent = peak.toLocaleString();

    const raw = SHAPE.map((s) => Math.round(s * peak));
    const normalized = SHAPE.map((s) => Math.round(s * 100));

    drawBars(document.getElementById("demo-chart-normalized"), normalized, "100", "#4ea1ff");
    drawBars(document.getElementById("demo-chart-raw"), raw, peak.toLocaleString(), "#e8b84b");

    document.getElementById("normalized-note").textContent =
      "Peak renders as 100. This chart is IDENTICAL at every slider position.";
    document.getElementById("raw-note").textContent =
      peak === 1
        ? "One single search in the entire region, all window."
        : `Peak week had ${peak.toLocaleString()} searches.`;

    const punch = document.getElementById("demo-punchline");
    if (peak === 1) {
      punch.className = "demo-punchline danger";
      punch.innerHTML =
        "<strong>⚠ This is the problem.</strong> One person — or one bot, or one data artifact — searching an obscure name " +
        "exactly once produces a chart that looks <em>exactly</em> like a genuine nationwide spike. " +
        "Trends gives you no way to tell these apart, because the absolute count is never shown.";
    } else if (peak <= 340) {
      punch.className = "demo-punchline warn";
      punch.innerHTML =
        "<strong>Still weak.</strong> At this volume, noise, bots, and sampling artifacts can easily dominate. " +
        "Google's own documentation warns that low-volume terms produce unstable graphs.";
    } else {
      punch.className = "demo-punchline ok";
      punch.innerHTML =
        "<strong>Now the shape means something.</strong> At this volume a spike reflects real aggregate behavior — " +
        "though it still tells you nothing about <em>who</em> searched or <em>why</em>.";
    }
  }

  slider.addEventListener("input", update);
  update();

  fetch("data/normalization_demo.json")
    .then((r) => r.json())
    .then((d) => {
      document.getElementById("demo-explainer").innerHTML = `
        <h4>Applying this to the 139 records above</h4>
        <table class="demo-table">
          <tr><th>Volume tier</th><th>Example</th><th>Reliability</th></tr>
          ${d.scenarios
            .map(
              (s) => `<tr>
                <td>${s.name}</td>
                <td>${s.example_interpretation}</td>
                <td>${s.reliability}</td>
              </tr>`
            )
            .join("")}
        </table>
        <p class="demo-lede"><strong>Why the control group is the decisive test.</strong> ${d.why_controls_matter_here}</p>
        <p class="chart-note">${d.this_dataset.interpretation}</p>
      `;
    });
}

// ---------- Official conduct tracker ----------
async function loadConduct() {
  const d = await fetch("data/conduct.json").then((r) => r.json());

  document.getElementById("conduct-case-header").innerHTML = `
    <h2>Official conduct — ${d.case.caption}</h2>
    <div class="case-meta">
      <span><strong>Case No.:</strong> ${d.case.number}</span>
      <span><strong>Court:</strong> ${d.case.court}</span>
      <span><strong>Judge:</strong> ${d.case.judge}</span>
    </div>
    <div class="case-meta">
      <a href="${d.case.records}" target="_blank" rel="noopener">Utah Court Xchange ↗</a>
      <a href="${d.case.repository}" target="_blank" rel="noopener">Document repository ↗</a>
    </div>`;

  document.getElementById("conduct-principle").innerHTML =
    `<strong>How to read this.</strong> ${d.principle}`;
  document.getElementById("conduct-access").innerHTML =
    `<strong>Records access.</strong> ${d.access_note}`;

  const counts = {};
  d.entries.forEach((e) => (counts[e.category] = (counts[e.category] || 0) + 1));
  const verif = {};
  d.entries.forEach((e) => (verif[e.verification] = (verif[e.verification] || 0) + 1));

  document.getElementById("conduct-stats").innerHTML = `
    <div class="stat-tile grade-c"><div class="num">${counts.sanctioned || 0}</div><div class="label">Court-sanctioned violations</div></div>
    <div class="stat-tile grade-c"><div class="num">${counts.evidence_gap || 0}</div><div class="label">Documented evidence gaps</div></div>
    <div class="stat-tile grade-b"><div class="num">${(counts.contested || 0) + (counts.transparency || 0)}</div><div class="label">Contested / transparency</div></div>
    <div class="stat-tile grade-a"><div class="num">${verif.direct || 0}</div><div class="label">Sources read directly</div></div>
    <div class="stat-tile"><div class="num">${(verif.needs_docket || 0) + (verif.reported || 0)}</div><div class="label">Need docket confirmation</div></div>`;

  const VERIF_LABEL = {
    direct: "source read directly",
    reported: "named reporting, not independently fetched",
    needs_docket: "needs docket confirmation",
  };

  function render() {
    const active = [...document.querySelectorAll(".cat-filter:checked")].map((c) => c.value);
    const order = ["sanctioned", "evidence_gap", "contested", "transparency", "unresolved"];
    const list = document.getElementById("conduct-list");

    const html = order
      .filter((cat) => active.includes(cat))
      .map((cat) => {
        const items = d.entries.filter((e) => e.category === cat);
        if (!items.length) return "";
        const meta = d.categories[cat];
        return `
        <div class="cat-block cat-${meta.color}">
          <div class="cat-head">
            <h3>${meta.label} <span class="cat-count">${items.length}</span></h3>
            <p>${meta.desc}</p>
          </div>
          ${items
            .map(
              (e) => `
            <div class="conduct-card sev-${e.severity}${e.flag ? " flag-" + e.flag : ""}">
              <div class="cc-head">
                <span class="cc-id">${e.id}</span>
                <h4>${e.title}</h4>
                <span class="cc-date">${e.date}</span>
              </div>
              <div class="cc-tags">
                <span class="actor-badge">${e.actor}</span>
                <span class="status-badge">${e.status}</span>
                <span class="verif-badge v-${e.verification}">${VERIF_LABEL[e.verification]}</span>
                ${e.flag === "key" ? `<span class="tl-flag key">key finding</span>` : ""}
                ${e.flag === "actionable" ? `<span class="tl-flag disc">actionable now</span>` : ""}
              </div>
              <p class="cc-what">${e.what_happened}</p>
              ${e.verification_note ? `<p class="cc-note cc-caution"><strong>Limit of what's established:</strong> ${e.verification_note}</p>` : ""}
              ${e.note ? `<p class="cc-note"><strong>Note:</strong> ${e.note}</p>` : ""}
              <p class="cc-resolve"><strong>What would resolve it:</strong> ${e.what_would_resolve}</p>
              <div class="cc-src">
                ${e.source ? `<a href="${e.source}" target="_blank" rel="noopener">source ↗</a>` : ""}
                ${e.secondary_source ? `<a href="${e.secondary_source}" target="_blank" rel="noopener">corroborating ↗</a>` : ""}
              </div>
            </div>`
            )
            .join("")}
        </div>`;
      })
      .join("");

    list.innerHTML = html || `<p class="placeholder">No categories selected.</p>`;
  }

  document.querySelectorAll(".cat-filter").forEach((c) => c.addEventListener("change", render));
  render();
}

// ---------- Aviation claims tracker ----------
async function loadAviationTracker() {
  const d = await fetch("data/aviation_claims.json?v=19").then((r) => r.json());
  const ex = d.extraction;

  const availRows = Object.values(d.data_availability)
    .map((s) => {
      const state =
        s.available === true ? "yes" : s.available === false ? "no" : "cond";
      const label =
        s.available === true ? "AVAILABLE" : s.available === false ? "NOT AVAILABLE" : "GATED";
      return `<tr>
        <td>${s.name}</td>
        <td><span class="avail-badge avail-${state}">${label}</span></td>
        <td>${s.detail || s.format || ""}${s.size ? ` <em>(${s.size}, ${s.license})</em>` : ""}
          ${s.caveats ? `<ul class="mini-list">${s.caveats.map((c) => `<li>${c}</li>`).join("")}</ul>` : ""}
          ${s.url ? `<a href="${s.url}" target="_blank" rel="noopener">source ↗</a>` : ""}
        </td>
      </tr>`;
    })
    .join("");

  const planes = d.aircraft
    .map((a) => {
      const r = a.registry;
      return `
      <div class="plane-card">
        <div class="plane-head">
          <h4>${a.tail}</h4>
          <span class="hex-badge">Mode S ${a.mode_s_hex}</span>
          <span class="avail-badge avail-yes">FAA REGISTRY VERIFIED</span>
        </div>

        <div class="plane-grid">
          <div>
            <h5>Authoritative registration <span class="checked">checked ${a.registry_checked_on}</span></h5>
            <table class="reg-table">
              <tr><th>Status</th><td>${r.status}</td></tr>
              <tr><th>Registered owner</th><td><strong>${r.registered_owner}</strong></td></tr>
              <tr><th>Address</th><td>${r.owner_address}</td></tr>
              <tr><th>Aircraft</th><td>${r.manufacturer} ${r.model}</td></tr>
              <tr><th>Type</th><td>${r.type}, ${r.mfr_year}</td></tr>
              <tr><th>Registration</th><td>${r.registration_type} · issued ${r.certificate_issue_date} · expires ${r.expiration_date}</td></tr>
            </table>
            <a class="reg-link" href="${a.registry_source}" target="_blank" rel="noopener">verify this yourself at registry.faa.gov ↗</a>
          </div>

          <div>
            <h5>What the sources actually claim</h5>
            <p class="plane-assert">${a.asserted_significance}</p>
            <table class="claims-mini">
              <tr><th>Record</th><th>Date</th><th>Region</th><th>Score</th><th>Grade</th><th>Scope</th></tr>
              ${a.claims
                .map(
                  (c) => `<tr class="${c.in_scope ? "" : "out-scope"}">
                    <td>${c.record}</td><td>${c.date}</td><td>${c.region}</td>
                    <td>${c.claimed_score}</td>
                    <td><span class="badge grade-${c.grade.toLowerCase()}">${c.grade}</span></td>
                    <td>${c.in_scope ? "in scope" : `out (${c.days_before}d before)`}</td>
                  </tr>`
                )
                .join("")}
            </table>
            <a class="reg-link" href="${a.source_url}" target="_blank" rel="noopener">claim source ↗</a>
            <p class="src-type">${a.source_type}</p>
          </div>
        </div>

        <div class="plane-verdict">
          <h5>${a.assessment.verdict}</h5>
          <ul class="evidence-list">${a.assessment.points.map((p) => `<li>${p}</li>`).join("")}</ul>
        </div>

        <details class="plane-next">
          <summary>How to take this further</summary>
          <ul class="evidence-list">${a.how_to_verify_further.map((x) => `<li>${x}</li>`).join("")}</ul>
        </details>
      </div>`;
    })
    .join("");

  const dc = d.dataset_character;

  document.getElementById("aviation-tracker").innerHTML = `
    <div class="tracker-block">
      <h3>Aviation claims — extracted from the source record</h3>
      <p class="demo-lede">${d.scope_note}</p>

      <div class="stat-row">
        <div class="stat-tile"><div class="num">${ex.records_scanned}</div><div class="label">Records scanned</div></div>
        <div class="stat-tile"><div class="num">${ex.distinct_tail_numbers_found}</div><div class="label">Distinct tail numbers found</div></div>
        <div class="stat-tile grade-c"><div class="num">${ex.aircraft_claims_on_2025_09_10}</div><div class="label">Aircraft claims on 2025-09-10</div></div>
      </div>

      <div class="negative-findings">
        <h4>Negative findings — stated explicitly</h4>
        <ul class="evidence-list">${ex.negative_findings.map((n) => `<li>${n}</li>`).join("")}</ul>
        <p class="extract-method"><strong>Extraction method:</strong> ${ex.method}</p>
      </div>

      ${planes}

      <div class="bottom-line">
        <h4>Bottom line</h4>
        <p>${d.bottom_line}</p>
      </div>

      <div class="charcheck">
        <h4>${dc.title}</h4>
        <div class="term-chips">${dc.terms.map((t) => `<span class="term-chip">${t}</span>`).join("")}</div>
        <p>${dc.finding}</p>
        <p><strong>Why it matters.</strong> ${dc.why_it_matters}</p>
      </div>

      ${d.adsb_archive ? buildAdsbPanel(d.adsb_archive, d.specific_aircraft, d.adelson_tail_search, d.private_jets_provo, d.flagged_aircraft, d.uvu_fleet_shutdown, d.external_aircraft_cross_check) : ""}

      ${d.flight_paths ? buildFlightPathsSection(d.flight_paths) : ""}
      ${d.base_rate_test ? buildBaseRateSection(d.base_rate_test) : ""}

      <h4 class="avail-head">Can the flight data actually be retrieved for 2025-09-10?</h4>
      <table class="avail-table"><tr><th>Source</th><th>Status</th><th>Detail</th></tr>${availRows}</table>
    </div>
  `;

  if (d.adsb_archive && d.adsb_archive.target.found) {
    drawFlightTrack(d.adsb_archive.target);
  }
  if (d.flight_paths) {
    drawAllFlightPaths(d.flight_paths);
  }
}

function buildAdsbPanel(arc, specificAircraft, adelsonSearch, privateJets, flaggedAircraft, uvuShutdown, externalCheck) {
  const t = arc.target;
  const u = arc.utah_summary;

  function fmtTime(ts) {
    const h = Math.floor(ts / 3600) - 6; // UTC to MDT
    const m = Math.floor((ts % 3600) / 60);
    const s = Math.floor(ts % 60);
    const hh = h < 0 ? h + 24 : h;
    return `${String(hh).padStart(2,"0")}:${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")} MDT`;
  }

  const phaseRows = t.phases.map(p =>
    `<tr><td>${p.type === "takeoff" ? "▲ Takeoff" : "▼ Landing"}</td>
         <td>${fmtTime(p.ts)}</td>
         <td>${p.lat.toFixed(4)}, ${p.lon.toFixed(4)}</td></tr>`
  ).join("");

  const topAircraft = u.top_provo_aircraft.slice(0, 10).map(a =>
    `<tr><td>${a.tail}</td><td>${a.type}</td><td>${a.desc}</td><td>${a.provo_points.toLocaleString()}</td></tr>`
  ).join("");

  return `
    <div class="adsb-archive-panel">
      <h3>🛰️ ADS-B archive results — 2025-09-10</h3>
      <p class="archive-source">Source: <a href="${arc.source.url}" target="_blank" rel="noopener">adsb.lol globe_history_2025</a>
        · License: ${arc.source.license} · Date: ${arc.source.date}</p>

      <div class="stat-row">
        <div class="stat-tile"><div class="num">${t.found ? "FOUND" : "NOT FOUND"}</div><div class="label">N888KG (AC3C75)</div></div>
        <div class="stat-tile"><div class="num">${t.total_points.toLocaleString()}</div><div class="label">Trace points</div></div>
        <div class="stat-tile"><div class="num">${t.max_altitude_ft.toLocaleString()} ft</div><div class="label">Max altitude</div></div>
        <div class="stat-tile"><div class="num">${u.total_aircraft_over_utah.toLocaleString()}</div><div class="label">Aircraft over Utah</div></div>
        <div class="stat-tile"><div class="num">${u.aircraft_near_provo}</div><div class="label">Near Provo</div></div>
      </div>

      <div class="flight-track-wrap">
        <h4>N888KG flight track — 2025-09-10</h4>
        <svg id="flight-track-svg" viewBox="0 0 700 400"></svg>
        <div class="flight-legend" id="flight-legend"></div>
      </div>

      <div class="plane-grid">
        <div>
          <h5>Flight phases</h5>
          <table class="reg-table">
            <tr><th>Event</th><th>Time</th><th>Position</th></tr>
            ${phaseRows}
          </table>
        </div>
        <div>
          <h5>Aircraft profile</h5>
          <table class="reg-table">
            <tr><th>Tail</th><td>${t.tail}</td></tr>
            <tr><th>ICAO Hex</th><td>${t.icao_hex}</td></tr>
            <tr><th>Type</th><td>${t.desc}</td></tr>
            <tr><th>Operator</th><td>${t.owner_operator}</td></tr>
            <tr><th>All points in Utah</th><td>${t.utah_points === t.total_points ? "Yes — 100%" : `${t.utah_points}/${t.total_points}`}</td></tr>
          </table>
        </div>
      </div>

      <div class="plane-verdict">
        <h5>Assessment</h5>
        <p>${arc.assessment}</p>
      </div>

      <div class="plane-verdict" style="border-left-color:var(--grade-b)">
        <h5>Significance</h5>
        <p>${arc.significance}</p>
      </div>

      ${buildSpecificAircraftHtml(specificAircraft, adelsonSearch, privateJets, flaggedAircraft, uvuShutdown)}

      ${buildExternalAircraftCheck(externalCheck)}

      <details class="plane-next">
        <summary>Other aircraft near Provo on 2025-09-10 (top 10 by trace density)</summary>
        <p class="demo-lede">These are the most-tracked aircraft in the Provo area that day — overwhelmingly
          flight-school trainers and local helicopters. This is what normal Provo airspace looks like.</p>
        <table class="reg-table">
          <tr><th>Tail</th><th>Type</th><th>Description</th><th>Provo points</th></tr>
          ${topAircraft}
        </table>
      </details>
    </div>
  `;
}

function buildSpecificAircraftHtml(aircraft, adelsonSearch, privateJets, flaggedAircraft, uvuShutdown) {
  if ((!aircraft || aircraft.length === 0) && !privateJets?.length && !flaggedAircraft?.length) return "";

  function fmtTime(ts) {
    const h = Math.floor(ts / 3600) - 6;
    const m = Math.floor((ts % 3600) / 60);
    const hh = h < 0 ? h + 24 : h;
    return `${String(hh).padStart(2,"0")}:${String(m).padStart(2,"0")} MDT`;
  }

  const flagColors = { significant: "#e8b84b", routine: "#52c7c1" };
  const flagLabels = { significant: "SIGNIFICANT", routine: "ROUTINE" };

  const cards = (aircraft || []).map(a => {
    const flagColor = flagColors[a.flag] || "#9aa1b1";
    const flagLabel = flagLabels[a.flag] || a.flag?.toUpperCase() || "";
    const firstPt = a.trace_sample?.[0];
    const lastPt = a.trace_sample?.[a.trace_sample.length - 1];

    const operatorRow = a.operator ? `<tr><th>Operator</th><td>${a.operator}${a.operator_verified ? ' <span class="flag-badge" style="background:#52c7c1;font-size:0.7em">VERIFIED</span>' : ''}</td></tr>` : "";
    const operatorSrcRow = a.operator_source ? `<tr><th>Operator source</th><td>${a.operator_source}</td></tr>` : "";

    const extCtx = a.extended_context ? `<div class="specific-ext-ctx"><h5>Extended context</h5><p>${a.extended_context}</p></div>` : "";

    const srcLinks = a.sources?.length ? `<div class="specific-sources"><h5>Verification sources</h5><ul>${a.sources.map(s => `<li><a href="${s.url}" target="_blank" rel="noopener">${s.label}</a></li>`).join("")}</ul></div>` : "";

    return `
      <div class="specific-card" style="border-left-color:${flagColor}">
        <div class="specific-head">
          <h5>${a.registration} <span class="hex-badge">ICAO ${a.icao_hex}</span>
            <span class="country-badge">${a.country}</span>
            ${flagLabel ? `<span class="flag-badge" style="background:${flagColor}">${flagLabel}</span>` : ""}
          </h5>
          <span class="specific-type">${a.desc}</span>
        </div>
        <p>${a.summary}</p>
        ${extCtx}
        <div class="plane-grid">
          <div>
            <table class="reg-table">
              ${operatorRow}
              <tr><th>Category</th><td>${a.category}</td></tr>
              <tr><th>Trace points</th><td>${a.total_points.toLocaleString()}</td></tr>
              ${operatorSrcRow}
              ${firstPt ? `<tr><th>First seen</th><td>${fmtTime(firstPt.ts)} at ${firstPt.lat.toFixed(4)}, ${firstPt.lon.toFixed(4)} (${firstPt.alt === "ground" ? "ground" : firstPt.alt + " ft"})</td></tr>` : ""}
              ${lastPt ? `<tr><th>Last seen</th><td>${fmtTime(lastPt.ts)} at ${lastPt.lat.toFixed(4)}, ${lastPt.lon.toFixed(4)} (${lastPt.alt === "ground" ? "ground" : lastPt.alt + " ft"})</td></tr>` : ""}
            </table>
          </div>
          <div>
            <h5>Assessment</h5>
            <p class="specific-assess">${a.assessment}</p>
            <h5>What would resolve it</h5>
            <p class="specific-assess">${a.what_would_resolve}</p>
          </div>
        </div>
        ${srcLinks}
      </div>`;
  }).join("");

  const adelsonHtml = adelsonSearch ? `
    <div class="adelson-search">
      <h5>Adelson / LVS Corp aircraft search</h5>
      <p>Searched for known Adelson-associated tail numbers across all 74,406 aircraft in the archive:
        <strong>${adelsonSearch.tails_searched.join(", ")}</strong></p>
      <p class="adelson-result">Matches found: <strong>${adelsonSearch.matches_found}</strong></p>
      <p class="specific-assess">${adelsonSearch.note}</p>
    </div>` : "";

  // --- Flagged aircraft section ---
  const catLabels = {
    surveillance_platform: "Surveillance-type platform",
    timing_anomaly: "Timing anomaly",
    foreign: "Foreign registration",
    unidentified: "Unidentified aircraft",
    helicopter: "Helicopter (response / notable)",
    llc_jet: "LLC-shielded jet",
  };
  const catColors = {
    surveillance_platform: "#e05252",
    timing_anomaly: "#e8b84b",
    foreign: "#6ea8e0",
    unidentified: "#9a6ee0",
    helicopter: "#52c7c1",
    llc_jet: "#e09a52",
  };

  let flaggedHtml = "";
  if (flaggedAircraft?.length) {
    const sorted = [...flaggedAircraft].sort((a, b) => (a.priority ?? 99) - (b.priority ?? 99));

    const flaggedCards = sorted.map(f => {
      const catColor = catColors[f.category] || "#9aa1b1";
      const catLabel = catLabels[f.category] || f.category;
      const prioTag = f.priority ? `<span class="flag-priority">#${f.priority}</span>` : "";

      return `
        <div class="flagged-card" style="border-left-color:${catColor}">
          <div class="flagged-head">
            <h5>${f.reg} <span class="hex-badge">ICAO ${f.icao_hex}</span>
              <span class="flag-badge" style="background:${catColor}">${catLabel}</span>
              ${prioTag}
            </h5>
            <span class="specific-type">${f.desc}</span>
          </div>
          <table class="reg-table flagged-details">
            <tr><th>Owner</th><td>${f.owner}</td></tr>
            <tr><th>Provo points</th><td>${f.provo_pts ?? "—"}</td></tr>
            <tr><th>First seen</th><td>${f.first_seen_mdt || "—"}</td></tr>
            <tr><th>Last seen</th><td>${f.last_seen_mdt || "—"}</td></tr>
            <tr><th>Altitude</th><td>${f.altitude_profile || "—"}</td></tr>
          </table>
          <div class="flagged-reason">
            <h5>Why flagged</h5>
            <p>${f.why_flagged}</p>
          </div>
        </div>`;
    }).join("");

    const survCount = flaggedAircraft.filter(f => f.category === "surveillance_platform").length;
    const timeCount = flaggedAircraft.filter(f => f.category === "timing_anomaly").length;
    const heliCount = flaggedAircraft.filter(f => f.category === "helicopter").length;
    const otherCount = flaggedAircraft.length - survCount - timeCount - heliCount;

    flaggedHtml = `
      <div class="flagged-section">
        <h4>Flagged aircraft — anomalies and leads</h4>
        <p class="demo-lede">These aircraft were flagged by scanning all 2,618 Utah aircraft for patterns
          that stand out from a lead-generation perspective: surveillance-type platforms (King Air 350, PC-12)
          with LLC ownership, aircraft with timing precisely bracketing the 12:25 PM shooting, foreign
          registrations, unidentified transponders, and notable helicopter activity. Ordered by investigative
          priority.</p>
        <div class="flagged-stats">
          <span class="flagged-stat" style="border-color:${catColors.surveillance_platform}">${survCount} surveillance-type</span>
          <span class="flagged-stat" style="border-color:${catColors.timing_anomaly}">${timeCount} timing anomalies</span>
          <span class="flagged-stat" style="border-color:${catColors.helicopter}">${heliCount} helicopters</span>
          <span class="flagged-stat" style="border-color:${catColors.unidentified}">${otherCount} other</span>
        </div>
        ${flaggedCards}
      </div>`;
  }

  // --- UVU fleet shutdown ---
  let uvuHtml = "";
  if (uvuShutdown) {
    uvuHtml = `
      <div class="uvu-shutdown">
        <h5>UVU flight school shutdown</h5>
        <p>${uvuShutdown.observation}</p>
        <p class="uvu-tail-list">Aircraft: <strong>${uvuShutdown.aircraft.join(", ")}</strong></p>
        <p class="specific-assess">${uvuShutdown.note}</p>
      </div>`;
  }

  const privateJetHtml = privateJets?.length ? `
    <details class="private-jets-section">
      <summary>Jet-powered aircraft near Provo — ${privateJets.length} tracked (click to expand)</summary>
      <p class="demo-lede">All jet-powered aircraft with ADS-B trace points in the Provo area on 2025-09-10,
        sorted by trace density. Includes commercial, charter/fractional, and private jets. Commercial
        operators are labeled.</p>
      <table class="reg-table private-jets-table">
        <tr><th>Tail</th><th>Type</th><th>Description</th><th>Registered owner</th><th>Provo pts</th><th>Notes</th></tr>
        ${privateJets.map(j => `<tr${j.note?.includes("Commercial") || j.note?.includes("Regional") ? ' class="pj-commercial"' : ""}>
          <td><strong>${j.reg}</strong></td><td>${j.type}</td><td>${j.desc}</td>
          <td>${j.owner}</td><td>${j.provo_pts}</td><td>${j.note || "—"}</td></tr>`).join("")}
      </table>
    </details>` : "";

  return `
    <div class="specific-aircraft-section">
      <h4>Aircraft of interest — 2025-09-10</h4>
      <p class="demo-lede">Identified by scanning all 74,406 traces in the archive for Egyptian
        registrations (SU- prefix), US military ICAO hex ranges (AE/AF), Adelson/LVS Corp tail
        numbers, and all jet-powered aircraft near Provo.</p>
      ${cards}
      ${adelsonHtml}
      ${flaggedHtml}
      ${uvuHtml}
      ${privateJetHtml}
    </div>`;
}

function buildExternalAircraftCheck(check) {
  if (!check) return "";
  const v = check.verdicts;
  const cards = check.claims.map((c) => {
    const verdict = v[c.verdict] || {};
    const evAgainst = (c.evidence_against || []).map((e) => `<li>${e}</li>`).join("");
    return `
      <div class="cf-plane-card">
        <div class="cf-plane-head">
          <h5>${c.title} ${c.tail && c.tail !== "N/A" ? `<span class="hex-badge">${c.tail}</span>` : ""}</h5>
          <span class="rating-chip" style="background:${verdict.color}">${verdict.label}</span>
        </div>
        ${c.verdict_note ? `<p class="cf-verdict-note">${c.verdict_note}</p>` : ""}
        ${evAgainst ? `<ul class="cf-evidence">${evAgainst}</ul>` : ""}
        ${c.sources?.length ? `<p class="cf-sources"><strong>Sources:</strong> ${c.sources.join("; ")}</p>` : ""}
        ${c.app_cross_reference ? `<div class="cf-cross-ref"><strong>Cross-checked against this app's own archive scan.</strong> ${c.app_cross_reference}</div>` : ""}
      </div>`;
  }).join("");

  return `
    <div class="cf-plane-section">
      <h4>External fact-check — ${check.source.site}</h4>
      <p class="demo-lede">Aircraft-related claims as adjudicated by an independent third-party research
        site (fetched ${check.source.fetched}), cross-checked here against this app's own adsb.lol
        archive extraction where the two overlap. Full source: <a href="${check.source.url}" target="_blank" rel="noopener">${check.source.url}</a></p>
      ${cards}
    </div>`;
}

function drawFlightTrack(t) {
  const svg = document.getElementById("flight-track-svg");
  if (!svg) return;
  const NS = "http://www.w3.org/2000/svg";
  const trace = t.summary_trace;
  if (!trace || trace.length === 0) return;

  // Map lat/lon to SVG coordinates
  let minLat = 90, maxLat = -90, minLon = 180, maxLon = -180;
  for (const p of trace) {
    if (p.lat && p.lon) {
      minLat = Math.min(minLat, p.lat);
      maxLat = Math.max(maxLat, p.lat);
      minLon = Math.min(minLon, p.lon);
      maxLon = Math.max(maxLon, p.lon);
    }
  }

  const pad = 50;
  const w = 700, h = 400;
  const latRange = maxLat - minLat || 1;
  const lonRange = maxLon - minLon || 1;
  const scale = Math.min((w - pad * 2) / lonRange, (h - pad * 2) / latRange);

  function toSvg(lat, lon) {
    return {
      x: pad + (lon - minLon) * scale,
      y: pad + (maxLat - lat) * scale,
    };
  }

  // Background — Utah outline approximation
  const utahCorners = [
    [42.0, -114.04], [42.0, -109.05], [37.0, -109.05], [37.0, -114.04]
  ];

  // PVU marker
  const pvu = toSvg(40.219, -111.719);

  // Draw flight path colored by altitude
  const airborne = trace.filter(p => p.alt !== "ground" && p.lat && p.lon);
  const ground = trace.filter(p => p.alt === "ground" && p.lat && p.lon);

  // Ground points
  if (ground.length > 0) {
    const gp = toSvg(ground[0].lat, ground[0].lon);
    const dot = document.createElementNS(NS, "circle");
    dot.setAttribute("cx", gp.x); dot.setAttribute("cy", gp.y);
    dot.setAttribute("r", 6); dot.setAttribute("fill", "#52c7c1");
    dot.setAttribute("stroke", "#fff"); dot.setAttribute("stroke-width", "1.5");
    svg.appendChild(dot);

    const label = document.createElementNS(NS, "text");
    label.setAttribute("x", gp.x + 10); label.setAttribute("y", gp.y + 4);
    label.setAttribute("fill", "#52c7c1"); label.setAttribute("font-size", "11");
    label.setAttribute("font-weight", "700");
    label.textContent = "PVU (Provo Airport)";
    svg.appendChild(label);
  }

  // Altitude color scale
  const maxAlt = t.max_altitude_ft || 31025;
  function altColor(alt) {
    if (typeof alt !== "number") return "#4ea1ff";
    const ratio = Math.min(alt / maxAlt, 1);
    const r = Math.round(78 + ratio * 177);  // 4e -> ff
    const g = Math.round(161 - ratio * 71);  // a1 -> 5a
    const b = Math.round(255 - ratio * 155); // ff -> 64
    return `rgb(${r},${g},${b})`;
  }

  // Draw path segments colored by altitude
  for (let i = 1; i < airborne.length; i++) {
    const p1 = toSvg(airborne[i-1].lat, airborne[i-1].lon);
    const p2 = toSvg(airborne[i].lat, airborne[i].lon);
    const line = document.createElementNS(NS, "line");
    line.setAttribute("x1", p1.x); line.setAttribute("y1", p1.y);
    line.setAttribute("x2", p2.x); line.setAttribute("y2", p2.y);
    line.setAttribute("stroke", altColor(airborne[i].alt));
    line.setAttribute("stroke-width", "2.5");
    line.setAttribute("stroke-linecap", "round");
    svg.appendChild(line);
  }

  // Mark the gap
  const outbound = airborne.filter(p => p.lat < 39);
  const inbound = airborne.filter(p => p.lat < 39);
  // Find gap: biggest timestamp jump
  let gapIdx = -1, gapSize = 0;
  for (let i = 1; i < airborne.length; i++) {
    const dt = airborne[i].ts - airborne[i-1].ts;
    if (dt > gapSize) { gapSize = dt; gapIdx = i; }
  }
  if (gapIdx > 0 && gapSize > 300) {
    const g1 = toSvg(airborne[gapIdx-1].lat, airborne[gapIdx-1].lon);
    const g2 = toSvg(airborne[gapIdx].lat, airborne[gapIdx].lon);
    const dashLine = document.createElementNS(NS, "line");
    dashLine.setAttribute("x1", g1.x); dashLine.setAttribute("y1", g1.y);
    dashLine.setAttribute("x2", g2.x); dashLine.setAttribute("y2", g2.y);
    dashLine.setAttribute("stroke", "#e05a5a"); dashLine.setAttribute("stroke-width", "1.5");
    dashLine.setAttribute("stroke-dasharray", "4 4");
    svg.appendChild(dashLine);

    const gapMid = { x: (g1.x + g2.x) / 2, y: (g1.y + g2.y) / 2 };
    const gapLabel = document.createElementNS(NS, "text");
    gapLabel.setAttribute("x", gapMid.x + 8); gapLabel.setAttribute("y", gapMid.y);
    gapLabel.setAttribute("fill", "#e05a5a"); gapLabel.setAttribute("font-size", "10");
    gapLabel.setAttribute("font-weight", "600");
    gapLabel.textContent = `~${Math.round(gapSize/60)}min coverage gap`;
    svg.appendChild(gapLabel);
  }

  // Altitude color bar legend
  const legendEl = document.getElementById("flight-legend");
  if (legendEl) {
    legendEl.innerHTML = `
      <span class="fl-legend-item"><span class="fl-swatch" style="background:#52c7c1"></span> Airport (PVU)</span>
      <span class="fl-legend-item"><span class="fl-swatch" style="background:#4ea1ff"></span> Low altitude</span>
      <span class="fl-legend-item"><span class="fl-swatch" style="background:#ff5a64"></span> FL310 (31,000 ft)</span>
      <span class="fl-legend-item"><span class="fl-swatch" style="background:#e05a5a;opacity:0.7"></span> Coverage gap</span>
    `;
  }
}

/* ================ MULTI-AIRCRAFT FLIGHT PATH GRID ================ */

const FP_CAT_LABELS = {
  surveillance_platform: "Surveillance-type platform",
  private_jet: "Private jet",
};
const FP_CAT_COLORS = {
  surveillance_platform: "#e05252",
  private_jet: "#e09a52",
};

function buildFlightPathsSection(fp) {
  const groundList = fp.on_ground_at_pvu_during_shooting || [];

  const cards = fp.aircraft.map((a) => {
    const catColor = FP_CAT_COLORS[a.category] || "#9aa1b1";
    const catLabel = FP_CAT_LABELS[a.category] || a.category;
    const onGround = a.position_at_shooting?.on_ground_at_pvu;
    const svgId = `fp-track-${a.icao_hex}`;

    return `
      <div class="fp-card" style="border-left-color:${catColor}">
        <div class="fp-card-head">
          <h5>${a.reg} <span class="hex-badge">ICAO ${a.icao_hex}</span></h5>
          <span class="flag-badge" style="background:${catColor}">${catLabel}</span>
          ${onGround ? '<span class="fp-shoot-badge">ON GROUND AT PVU DURING SHOOTING</span>' : ""}
        </div>
        <div class="fp-card-sub">${a.desc} — ${a.owner_operator || "unknown operator"}</div>
        <p class="fp-note">${a.note}</p>
        <div class="fp-svg-wrap">
          <svg id="${svgId}" viewBox="0 0 360 260" class="fp-track-svg"></svg>
        </div>
        <table class="reg-table fp-stats">
          <tr><th>First seen</th><td>${a.first_seen_mdt}</td><th>Last seen</th><td>${a.last_seen_mdt}</td></tr>
          <tr><th>Max altitude</th><td>${a.max_altitude_ft.toLocaleString()} ft</td><th>Trace points</th><td>${a.total_points.toLocaleString()}</td></tr>
          <tr><th colspan="1">At shooting (${a.position_at_shooting.time_mdt})</th><td colspan="3">${a.position_at_shooting.alt === "ground" ? "On the ground" : a.position_at_shooting.alt + " ft"} at ${a.position_at_shooting.lat.toFixed(2)}, ${a.position_at_shooting.lon.toFixed(2)}${a.position_at_shooting.near_pvu ? " (near PVU)" : ""}</td></tr>
        </table>
      </div>`;
  }).join("");

  return `
    <div class="flight-paths-section">
      <h4>Flight paths — filtered aircraft, 2025-09-10</h4>
      <p class="demo-lede">${fp.methodology}</p>
      <div class="fp-ground-callout">
        <strong>${groundList.length} aircraft in this filtered set were on the ground at Provo Airport
        at the moment closest to the shooting:</strong> ${groundList.join(", ")}.
        This is the baseline population of jets and surveillance-type aircraft physically present at
        PVU during the event — not evidence of involvement, but the correct population to check first
        against any future claim about a specific aircraft's presence.
      </div>
      <div class="fp-grid">${cards}</div>
    </div>`;
}

function buildBaseRateSection(br) {
  const total = br.pvu_area_count + br.elsewhere_utah_count;
  const pvuPct = total ? Math.round((br.pvu_area_count / total) * 100) : 0;
  const elsewherePct = 100 - pvuPct;
  return `
    <div class="base-rate-section">
      <h4>Base-rate test — is the "LLC jet, brief visit" pattern actually rare?</h4>
      <p class="demo-lede">${br.question}</p>
      <div class="br-method"><strong>Method.</strong> ${br.method}</div>
      <div class="br-compare">
        <div class="br-bar-row">
          <span class="br-bar-label">Near Provo</span>
          <div class="br-bar-track"><div class="br-bar-fill" style="width:${Math.max(pvuPct, 3)}%;background:#e05252"></div></div>
          <span class="br-bar-value">${br.pvu_area_count} stays (${br.unique_pvu_aircraft} aircraft)</span>
        </div>
        <div class="br-bar-row">
          <span class="br-bar-label">Elsewhere in Utah</span>
          <div class="br-bar-track"><div class="br-bar-fill" style="width:${Math.max(elsewherePct, 3)}%;background:#52c7c1"></div></div>
          <span class="br-bar-value">${br.elsewhere_utah_count} stays (${br.unique_elsewhere_aircraft} aircraft)</span>
        </div>
      </div>
      <div class="br-finding"><strong>Finding.</strong> ${br.finding}</div>
      <div class="br-conclusion"><strong>What this does and doesn't mean.</strong> ${br.conclusion}</div>
    </div>`;
}

function drawAllFlightPaths(fp) {
  for (const a of fp.aircraft) {
    const svg = document.getElementById(`fp-track-${a.icao_hex}`);
    if (svg) drawMiniTrack(svg, a);
  }
}

function drawMiniTrack(svg, a) {
  const NS = "http://www.w3.org/2000/svg";
  const trace = a.summary_trace;
  if (!trace || trace.length === 0) return;

  let minLat = 90, maxLat = -90, minLon = 180, maxLon = -180;
  for (const p of trace) {
    if (typeof p.lat === "number" && typeof p.lon === "number") {
      minLat = Math.min(minLat, p.lat);
      maxLat = Math.max(maxLat, p.lat);
      minLon = Math.min(minLon, p.lon);
      maxLon = Math.max(maxLon, p.lon);
    }
  }

  const pad = 24;
  const w = 360, h = 260;
  const latRange = (maxLat - minLat) || 0.1;
  const lonRange = (maxLon - minLon) || 0.1;
  const scale = Math.min((w - pad * 2) / lonRange, (h - pad * 2) / latRange);

  function toSvg(lat, lon) {
    return {
      x: pad + (lon - minLon) * scale + (w - pad * 2 - lonRange * scale) / 2,
      y: pad + (maxLat - lat) * scale + (h - pad * 2 - latRange * scale) / 2,
    };
  }

  const maxAlt = a.max_altitude_ft || 30000;
  function altColor(alt) {
    if (typeof alt !== "number") return "#52c7c1";
    const ratio = Math.min(alt / maxAlt, 1);
    const r = Math.round(78 + ratio * 177);
    const g = Math.round(161 - ratio * 71);
    const b = Math.round(255 - ratio * 155);
    return `rgb(${r},${g},${b})`;
  }

  const pts = trace.filter((p) => typeof p.lat === "number" && typeof p.lon === "number");

  for (let i = 1; i < pts.length; i++) {
    const p1 = toSvg(pts[i - 1].lat, pts[i - 1].lon);
    const p2 = toSvg(pts[i].lat, pts[i].lon);
    const line = document.createElementNS(NS, "line");
    line.setAttribute("x1", p1.x); line.setAttribute("y1", p1.y);
    line.setAttribute("x2", p2.x); line.setAttribute("y2", p2.y);
    line.setAttribute("stroke", altColor(pts[i].alt));
    line.setAttribute("stroke-width", "1.8");
    line.setAttribute("stroke-linecap", "round");
    svg.appendChild(line);
  }

  // PVU marker
  const pvuP = toSvg(40.2192, -111.7234);
  if (pvuP.x >= 0 && pvuP.x <= w && pvuP.y >= 0 && pvuP.y <= h) {
    const dot = document.createElementNS(NS, "circle");
    dot.setAttribute("cx", pvuP.x); dot.setAttribute("cy", pvuP.y);
    dot.setAttribute("r", 4); dot.setAttribute("fill", "#fff");
    dot.setAttribute("stroke", "#14171c"); dot.setAttribute("stroke-width", "1");
    svg.appendChild(dot);
  }

  // Ground/landing markers
  for (const ph of a.phases || []) {
    const p = toSvg(ph.lat, ph.lon);
    const dot = document.createElementNS(NS, "circle");
    dot.setAttribute("cx", p.x); dot.setAttribute("cy", p.y);
    dot.setAttribute("r", 3);
    dot.setAttribute("fill", ph.type === "landing" ? "#52c7c1" : "#e8b84b");
    svg.appendChild(dot);
  }

  // Start marker
  if (pts.length) {
    const start = toSvg(pts[0].lat, pts[0].lon);
    const s = document.createElementNS(NS, "circle");
    s.setAttribute("cx", start.x); s.setAttribute("cy", start.y);
    s.setAttribute("r", 3); s.setAttribute("fill", "#9aa1b1");
    svg.appendChild(s);
  }
}

// ---------- ADS-B flight data methods ----------
async function loadFlightMethods() {
  const d = await fetch("data/flight_methods.json").then((r) => r.json());
  const NS = "http://www.w3.org/2000/svg";

  document.getElementById("adsb-intro").innerHTML = d.intro;

  // ---- buttons ----
  const btnWrap = document.getElementById("cause-buttons");
  btnWrap.innerHTML = d.causes
    .map(
      (c, i) =>
        `<button class="cause-btn${i === 0 ? " active" : ""}" data-cause="${c.id}">
          <span class="cause-label">${c.label}</span>
          <span class="cause-short">${c.short}</span>
        </button>`
    )
    .join("");

  // ---- static track geometry: the gap is FIXED, never recomputed ----
  const PATH = [];
  for (let i = 0; i <= 60; i++) {
    const t = i / 60;
    PATH.push({ x: 40 + t * 560, y: 150 - Math.sin(t * Math.PI) * 70 });
  }
  const GAP_START = 24, GAP_END = 38; // identical for every cause

  function drawTrack(cause) {
    const svg = document.getElementById("adsb-track");
    svg.innerHTML = "";

    const hint = cause.visual_hint;

    // --- terrain silhouette ---
    const terrainLit = hint === "terrain";
    const terrain = document.createElementNS(NS, "path");
    terrain.setAttribute(
      "d",
      "M0,240 L0,205 L70,180 L120,196 L180,150 L240,178 L300,140 L360,172 L420,158 L490,190 L560,168 L640,200 L640,240 Z"
    );
    terrain.setAttribute("fill", terrainLit ? "#3d3320" : "#20242c");
    terrain.setAttribute("stroke", terrainLit ? "#e8b84b" : "#2a2f3a");
    terrain.setAttribute("stroke-width", terrainLit ? "2" : "1");
    svg.appendChild(terrain);

    // --- ground receivers ---
    const receiverDim = hint === "receiver";
    [90, 200, 330, 460, 570].forEach((x, i) => {
      // the middle receivers are the ones "missing" in the receiver-gap case
      const isMissing = receiverDim && i >= 1 && i <= 3;
      const g = document.createElementNS(NS, "g");
      const dot = document.createElementNS(NS, "circle");
      dot.setAttribute("cx", x);
      dot.setAttribute("cy", 212);
      dot.setAttribute("r", 4);
      dot.setAttribute("fill", isMissing ? "none" : "#52c7c1");
      dot.setAttribute("stroke", isMissing ? "#e05a5a" : "none");
      dot.setAttribute("stroke-dasharray", isMissing ? "2 2" : "none");
      dot.setAttribute("stroke-width", "1.5");
      g.appendChild(dot);
      if (!isMissing) {
        const arc = document.createElementNS(NS, "path");
        arc.setAttribute("d", `M${x - 14},206 Q${x},188 ${x + 14},206`);
        arc.setAttribute("fill", "none");
        arc.setAttribute("stroke", "#52c7c1");
        arc.setAttribute("stroke-opacity", "0.35");
        arc.setAttribute("stroke-width", "1");
        g.appendChild(arc);
      }
      svg.appendChild(g);
    });

    // --- actual flight path (ghost, always continuous) ---
    const ghost = document.createElementNS(NS, "path");
    ghost.setAttribute("d", PATH.map((p, i) => (i ? "L" : "M") + p.x + "," + p.y).join(" "));
    ghost.setAttribute("fill", "none");
    ghost.setAttribute("stroke", "#4a5262");
    ghost.setAttribute("stroke-width", "1.2");
    ghost.setAttribute("stroke-dasharray", "3 4");
    svg.appendChild(ghost);

    // --- observed track: two segments with the SAME fixed gap ---
    function seg(from, to, color) {
      const p = document.createElementNS(NS, "path");
      p.setAttribute("d", PATH.slice(from, to + 1).map((pt, i) => (i ? "L" : "M") + pt.x + "," + pt.y).join(" "));
      p.setAttribute("fill", "none");
      p.setAttribute("stroke", color);
      p.setAttribute("stroke-width", "2.6");
      p.setAttribute("stroke-linecap", "round");
      svg.appendChild(p);
    }

    const isPIA = hint === "pia";
    const isMilitary = hint === "military";

    if (isMilitary) {
      // never in the feed at all -- nothing observed
      const note = document.createElementNS(NS, "text");
      note.setAttribute("x", 320);
      note.setAttribute("y", 96);
      note.setAttribute("text-anchor", "middle");
      note.setAttribute("fill", "#7a7f8c");
      note.setAttribute("font-size", "12");
      note.setAttribute("font-style", "italic");
      note.textContent = "no civil ADS-B track exists for this aircraft";
      svg.appendChild(note);
    } else {
      seg(0, GAP_START, "#4ea1ff");
      seg(GAP_END, PATH.length - 1, isPIA ? "#c98be0" : "#4ea1ff");
    }

    // --- gap bracket (identical geometry every time) ---
    if (!isMilitary) {
      const gx1 = PATH[GAP_START].x, gx2 = PATH[GAP_END].x;
      const bracket = document.createElementNS(NS, "rect");
      bracket.setAttribute("x", gx1);
      bracket.setAttribute("y", 40);
      bracket.setAttribute("width", gx2 - gx1);
      bracket.setAttribute("height", 130);
      bracket.setAttribute("fill", "rgba(224,90,90,0.07)");
      bracket.setAttribute("stroke", "#e05a5a");
      bracket.setAttribute("stroke-width", "1");
      bracket.setAttribute("stroke-dasharray", "3 3");
      svg.appendChild(bracket);

      const glabel = document.createElementNS(NS, "text");
      glabel.setAttribute("x", (gx1 + gx2) / 2);
      glabel.setAttribute("y", 33);
      glabel.setAttribute("text-anchor", "middle");
      glabel.setAttribute("fill", "#e05a5a");
      glabel.setAttribute("font-size", "11");
      glabel.setAttribute("font-weight", "700");
      glabel.textContent = "GAP IN PUBLIC DATA";
      svg.appendChild(glabel);
    }

    if (isPIA) {
      const t = document.createElementNS(NS, "text");
      t.setAttribute("x", PATH[GAP_END].x + 6);
      t.setAttribute("y", PATH[GAP_END].y - 12);
      t.setAttribute("fill", "#c98be0");
      t.setAttribute("font-size", "10");
      t.textContent = "reappears as a 'different' aircraft";
      svg.appendChild(t);
    }

    // legend
    const legend = [
      { c: "#4ea1ff", t: "observed track" },
      { c: "#4a5262", t: "actual flight path" },
      { c: "#52c7c1", t: "ground receiver" },
    ];
    legend.forEach((l, i) => {
      const ln = document.createElementNS(NS, "line");
      ln.setAttribute("x1", 40 + i * 150); ln.setAttribute("y1", 232);
      ln.setAttribute("x2", 60 + i * 150); ln.setAttribute("y2", 232);
      ln.setAttribute("stroke", l.c); ln.setAttribute("stroke-width", "2.4");
      svg.appendChild(ln);
      const tx = document.createElementNS(NS, "text");
      tx.setAttribute("x", 65 + i * 150); tx.setAttribute("y", 236);
      tx.setAttribute("fill", "#9aa1b1"); tx.setAttribute("font-size", "10");
      tx.textContent = l.t;
      svg.appendChild(tx);
    });
  }

  function select(id) {
    const cause = d.causes.find((c) => c.id === id);
    document.querySelectorAll(".cause-btn").forEach((b) =>
      b.classList.toggle("active", b.dataset.cause === id)
    );
    drawTrack(cause);

    const isActual = cause.id === "actual";
    document.getElementById("adsb-verdict").className =
      "adsb-verdict " + (isActual ? "danger" : "ok");
    document.getElementById("adsb-verdict").innerHTML = isActual
      ? `<strong>This is the claim — and it is the one you cannot get from a tracking website.</strong>
         Every other explanation above produces an identical gap. To assert this one you must first
         exclude all of them, and then produce ATC or radar records that a public feed does not contain.`
      : `<strong>Same gap. Different cause.</strong> The visual is unchanged from every other option —
         which is exactly why a gap alone cannot tell you which of these happened.`;

    document.getElementById("adsb-detail").innerHTML = `
      <div class="adsb-card">
        <div class="adsb-card-head">
          <h4>${cause.label}</h4>
          <span class="freq-badge">${cause.frequency}</span>
        </div>
        <p>${cause.detail}</p>
        <dl>
          <dt>What the aircraft actually did</dt><dd>${cause.what_the_aircraft_did}</dd>
          <dt>How to rule it out</dt><dd>${cause.how_to_rule_out}</dd>
        </dl>
      </div>`;
  }

  btnWrap.querySelectorAll(".cause-btn").forEach((b) =>
    b.addEventListener("click", () => select(b.dataset.cause))
  );
  select(d.causes[0].id);

  // ---- base rates ----
  const br = d.base_rates;
  document.getElementById("baserate-block").innerHTML = `
    <h3>${br.title}</h3>
    <div class="stat-row">
      ${br.facts.map((f) => `<div class="stat-tile"><div class="num">${f.stat}</div><div class="label">${f.label}</div></div>`).join("")}
    </div>
    <p class="demo-lede">${br.the_problem}</p>
    <div class="causation-callout">
      <h4>The causation problem</h4>
      <p>${br.the_causation_problem}</p>
    </div>
    <h4>What would actually constitute evidence</h4>
    <ul class="evidence-list">
      ${br.what_would_actually_be_evidence.map((x) => `<li>${x}</li>`).join("")}
    </ul>
  `;

  // ---- registry ----
  const rc = d.registry_check;
  document.getElementById("registry-block").innerHTML = `
    <h3>${rc.title}</h3>
    <p class="demo-lede">${rc.why}</p>
    <div class="registry-steps">
      ${rc.steps
        .map(
          (s) => `<div class="registry-step">
            <h4><a href="${s.url}" target="_blank" rel="noopener">${s.step} ↗</a></h4>
            <p>${s.what_you_get}</p>
          </div>`
        )
        .join("")}
    </div>
    <h4>Reading the results correctly</h4>
    <ul class="evidence-list caveat-list">
      ${rc.caveats.map((c) => `<li>${c}</li>`).join("")}
    </ul>
    <div class="registry-example"><strong>Worked example from your own dataset:</strong> ${rc.example}</div>
  `;
}

// ---------- Sources & methodology ----------
async function loadSources() {
  const [sources, methodology] = await Promise.all([
    fetch("data/sources.json").then((r) => r.json()),
    fetch("data/methodology.json").then((r) => r.json()),
  ]);

  const sTable = document.getElementById("sources-table");
  sTable.innerHTML = `
    <tr><th>ID</th><th>Source</th><th>Type</th><th>Tier</th><th>Supports</th><th>Caution</th></tr>
    ${sources
      .sort((a, b) => (a["Reliability Tier"] || "").localeCompare(b["Reliability Tier"] || ""))
      .map(
        (s) => `<tr>
        <td>${s["Source ID"]}</td>
        <td>${s.URL ? `<a href="${s.URL}" target="_blank" rel="noopener">${s.Source}</a>` : s.Source}</td>
        <td>${s["Source Type"]}</td>
        <td><span class="tier-badge tier-${s["Reliability Tier"]}">${s["Reliability Tier"]}</span></td>
        <td>${s.Supports || ""}</td>
        <td>${s.Cautions || ""}</td>
      </tr>`
      )
      .join("")}
  `;

  const mTable = document.getElementById("methodology-table");
  mTable.innerHTML = `
    <tr><th>Rule</th><th>Definition / application</th></tr>
    ${methodology
      .map((m) => `<tr><td>${m["Methodology / Rule"]}</td><td>${m["Definition / Application"]}</td></tr>`)
      .join("")}
  `;
}

/* ============================ ASSESSMENT TAB ============================ */
async function loadAssessment() {
  const root = document.getElementById("assessment-root");
  if (!root) return;
  const d = await fetch("data/assessment.json?v=127").then((r) => r.json());

  const conf = d.confidence.map((c) => {
    const mid = (c.low + c.high) / 2;
    const barColor = c.inverted
      ? "#52c7c1"
      : mid >= 85 ? "#e05252" : mid >= 70 ? "#e8b84b" : "#6ea8e0";
    return `
      <div class="conf-row">
        <div class="conf-label">${c.proposition}</div>
        <div class="conf-track">
          <div class="conf-bar" style="left:${c.low}%;width:${c.high - c.low}%;background:${barColor}"></div>
          <span class="conf-range">${c.low}–${c.high}%</span>
        </div>
        <div class="conf-note">${c.note}</div>
      </div>`;
  }).join("");

  const anomalies = d.anomalies.map((a) => `
    <div class="anomaly-card sev-${a.severity}">
      <div class="anomaly-head">
        <h4>${a.title}</h4>
        <span class="anomaly-status">${a.status}</span>
      </div>
      <p class="anomaly-finding">${a.finding}</p>
      <div class="anomaly-why"><strong>Why it matters.</strong> ${a.why_it_matters.replace(/\n\n/g, "</p><p>")}</div>
      ${a.records_needed ? `<div class="records-needed"><strong>Records that would resolve it:</strong><ul>${a.records_needed.map((r) => `<li>${r}</li>`).join("")}</ul></div>` : ""}
    </div>`).join("");

  const streams = d.convergence.streams.map((s) => `
    <tr>
      <th>${s.stream}</th>
      <td>${s.detail}${s.weakness ? `<div class="stream-weak"><strong>Weakness:</strong> ${s.weakness}</div>` : ""}</td>
    </tr>`).join("");

  const rungs = d.institutional_distrust.evidentiary_ladder.rungs.map((r, i) => `
    <div class="ladder-rung${r.unproven ? " unproven" : ""}">
      <span class="rung-n">${i + 1}</span>
      <span class="rung-level">${r.level}</span>
      <span class="rung-claim">${r.claim}</span>
      ${r.unproven ? '<span class="rung-flag">NOT PROVEN</span>' : ""}
    </div>`).join("");

  const cases = d.precedent.cases.map((c) => `
    <div class="precedent-card">
      <h5>${c.name} <span class="prec-year">${c.year}</span> <span class="prec-fit">${c.fit}</span></h5>
      <p>${c.detail}</p>
    </div>`).join("");

  root.innerHTML = `
    <div class="panel-intro">
      <strong>This tab states a conclusion and shows its work — including the parts that cut against it.</strong>
      ${d.framing.standard} Confidence ranges are evidentiary judgments, not courtroom probabilities
      and not findings of guilt. Assessment current as of ${d.framing.as_of}.
    </div>

    <div class="assess-headline">
      <h3>Central finding</h3>
      <p>${d.framing.central_finding}</p>
      <div class="assess-bridge">
        <h4>The missing operational bridge</h4>
        <p>${d.framing.the_missing_bridge}</p>
      </div>
    </div>

    <h3 class="assess-h">Working reconstruction</h3>
    <div class="reconstruction">${d.reconstruction}</div>

    <h3 class="assess-h">Confidence ranking</h3>
    <div class="conf-block">${conf}</div>

    <h3 class="assess-h">${d.convergence.title}</h3>
    <p class="demo-lede">${d.convergence.note}</p>
    <table class="reg-table stream-table">${streams}</table>
    <div class="defense-posture"><strong>Defense posture.</strong> ${d.convergence.defense_posture}</div>

    <h3 class="assess-h">Genuine anomalies — ${d.anomalies.length} logged</h3>
    <p class="demo-lede">These are legitimate problems, not internet inventions. None individually clears
      Robinson. Collectively they are sufficient reason not to treat the state's case as beyond meaningful
      scrutiny before trial.</p>
    ${anomalies}

    <h3 class="assess-h">${d.security.title}</h3>
    <div class="security-block">
      <p class="demo-lede">${d.security.lede}</p>
      <ul class="security-facts">${d.security.facts.map((f) => `<li>${f}</li>`).join("")}</ul>
      <div class="security-warn"><strong>The claimed pre-event warning.</strong> ${d.security.harpole_warning}</div>
      <div class="security-counter"><strong>Countervailing.</strong> ${d.security.counterweight}</div>
      <p><strong>Outstanding accounting.</strong> ${d.security.accounting}</p>
      <p class="security-concl">${d.security.conclusion}</p>
    </div>

    <div class="control-case">
      <h4>${d.butler.title}</h4>
      <p>${d.butler.body}</p>
      <div class="control-lesson">${d.butler.why_it_matters.replace(/\n\n/g, "</div><div class='control-lesson'>")}</div>
    </div>

    <div class="control-case jfk-case">
      <h4>${d.jfk.title}</h4>
      <ul>${d.jfk.differences.map((x) => `<li>${x}</li>`).join("")}</ul>
      <div class="jfk-rule">${d.jfk.rule}</div>
      <p>${d.jfk.elaboration}</p>
    </div>

    <h3 class="assess-h">What would change this assessment</h3>
    <div class="would-change">
      <ul>${d.would_change.map((w) => `<li>${w}</li>`).join("")}</ul>
    </div>
    <div class="would-not-change">
      <h4>${d.would_not_change.title}</h4>
      <div class="wnc-chips">${d.would_not_change.items.map((i) => `<span class="wnc-chip">${i}</span>`).join("")}</div>
      <p>${d.would_not_change.note}</p>
    </div>

    <h3 class="assess-h">${d.institutional_distrust.title}</h3>
    <div class="distrust-block">
      <p>${d.institutional_distrust.body.replace(/\n\n/g, "</p><p>")}</p>
      <div class="ladder">
        <h4>${d.institutional_distrust.evidentiary_ladder.title}</h4>
        <p class="demo-lede">${d.institutional_distrust.evidentiary_ladder.note}</p>
        ${rungs}
        <p class="ladder-closing">${d.institutional_distrust.evidentiary_ladder.closing}</p>
      </div>
      <div class="better-question">
        <h4>The better question</h4>
        <p>${d.institutional_distrust.better_question}</p>
      </div>
    </div>

    <h3 class="assess-h">${d.precedent.title}</h3>
    <p class="demo-lede"><em>${d.precedent.question}</em> — ${d.precedent.answer}</p>
    ${cases}
    <p class="prec-non">${d.precedent.non_matches}</p>
    <p class="prec-caution"><strong>Caution.</strong> ${d.precedent.caution}</p>

    <div class="bottom-line">
      <h3>Bottom line</h3>
      <p>${d.bottom_line.replace(/\n\n/g, "</p><p>")}</p>
    </div>

    <div class="next-milestone">
      <h4>Next milestone — ${d.next_milestone.date}</h4>
      <p><strong>${d.next_milestone.event}.</strong> ${d.next_milestone.why}</p>
    </div>
  `;
}

/* ============================ NETWORK TAB ============================ */
async function loadNetwork() {
  const root = document.getElementById("network-root");
  if (!root) return;
  const d = await fetch("data/network.json?v=19").then((r) => r.json());

  const groupLabels = {
    board: "TPUSA board",
    media: "Media / inner circle",
    donor: "Major donors",
    family: "Family & pre-Charlie network",
    security: "Security & operations",
  };

  const tierChips = Object.entries(d.tiers).map(([k, t]) =>
    `<span class="tier-chip" style="border-color:${t.color}" title="${t.desc}">${t.label}</span>`).join("");

  const groups = Object.keys(groupLabels).map((g) => {
    const members = d.people.filter((p) => p.group === g);
    if (!members.length) return "";
    const cards = members.map((p) => {
      const tier = d.tiers[p.gov_mil] || {};
      return `
        <div class="person-card" style="border-left-color:${tier.color || "#9aa1b1"}">
          <div class="person-head">
            <h4>${p.name}</h4>
            <span class="tier-badge" style="background:${tier.color || "#9aa1b1"}">${tier.label || p.gov_mil}</span>
          </div>
          <div class="person-role">${p.role}</div>
          <div class="person-finding"><strong>Finding.</strong> ${p.finding}</div>
          ${p.detail ? `<div class="person-detail">${p.detail}</div>` : ""}
          ${p.significance ? `<div class="person-signif"><strong>Significance.</strong> ${p.significance.replace(/\n\n/g, "</div><div class='person-signif'>")}</div>` : ""}
          ${p.not_established ? `<div class="person-negative"><strong>Not established.</strong> ${p.not_established}</div>` : ""}
        </div>`;
    }).join("");
    return `<h3 class="net-group-h">${groupLabels[g]} <span class="net-count">${members.length}</span></h3>${cards}`;
  }).join("");

  const edgeRows = d.edges.map((e) => `
    <tr>
      <td class="edge-pair"><strong>${e.from}</strong> ↔ <strong>${e.to}</strong></td>
      <td><span class="edge-type" style="background:${d.edge_types[e.type] || "#9aa1b1"}">${e.type}</span></td>
      <td class="edge-strength">${e.strength}</td>
      <td class="edge-detail">${e.detail}</td>
    </tr>`).join("");

  const chrono = d.shillman_chronology.steps.map((s) => `
    <div class="chrono-step${s.flag ? " flagged" : ""}">
      <span class="chrono-date">${s.date}</span>
      <span class="chrono-event">${s.event}</span>
    </div>`).join("");

  const hammerRows = d.hammer_claims.map((c) => {
    const cls = c.rating === "high" ? "hr-high" : c.rating === "low" ? "hr-low" : "hr-none";
    return `
      <tr class="${cls}">
        <td class="hc-claim">${c.claim}</td>
        <td class="hc-finding">${c.finding}</td>
        <td class="hc-verdict">${c.verdict}</td>
      </tr>`;
  }).join("");

  const steps = d.next_steps.map((s) => `
    <div class="lead-row">
      <span class="lead-prio">${s.priority}</span>
      <div><strong>${s.lead}</strong><p>${s.why}</p></div>
    </div>`).join("");

  root.innerHTML = `
    <div class="panel-intro warn">
      <strong>Association is not conspiracy.</strong> ${d.principle}
    </div>

    <div class="tier-legend">
      <strong>Classification tiers — hover for definitions:</strong>
      <div class="tier-chips">${tierChips}</div>
      <p class="tier-note">The distinction between these tiers is the entire point. Collapsing
        "advocacy" into "service" is the single most common error in this subject area.</p>
    </div>

    ${groups}

    <h3 class="net-group-h">Relationship edges <span class="net-count">${d.edges.length}</span></h3>
    <p class="demo-lede">Every edge is classified by type so that a dense graph is not mistaken for a
      proven one. Negative findings are included deliberately — inflating weak edges to make the graph
      denser is exactly the failure mode this table exists to prevent.</p>
    <div class="edge-table-wrap">
      <table class="reg-table edge-table">
        <tr><th>Pair</th><th>Type</th><th>Strength</th><th>Basis</th></tr>
        ${edgeRows}
      </table>
    </div>

    <div class="chrono-block">
      <h3>${d.shillman_chronology.title}</h3>
      <p class="demo-lede">${d.shillman_chronology.why}</p>
      ${chrono}
      <div class="chrono-question"><strong>The testable question.</strong> ${d.shillman_chronology.key_question}</div>
      <div class="records-needed">
        <strong>Records that would resolve it:</strong>
        <ul>${d.shillman_chronology.records_needed.map((r) => `<li>${r}</li>`).join("")}</ul>
      </div>
    </div>

    <h3 class="net-group-h">Josh Hammer — claim-by-claim</h3>
    <p class="demo-lede">A widely circulated thread makes eight distinct claims about Hammer. They do not
      all survive equally, and the strongest findings are not the ones the thread emphasizes.</p>
    <div class="edge-table-wrap">
      <table class="reg-table hammer-table">
        <tr><th>Claim</th><th>What the record shows</th><th>Verdict</th></tr>
        ${hammerRows}
      </table>
    </div>

    <div class="donor-transparency">
      <h4>${d.donor_transparency.title}</h4>
      <p>${d.donor_transparency.body}</p>
    </div>

    <div class="not-established-block">
      <h4>Specifically checked and NOT established</h4>
      <p class="demo-lede">This list exists to prevent associations from hardening into conclusions.</p>
      <ul>${d.not_established.map((n) => `<li>${n}</li>`).join("")}</ul>
    </div>

    <h3 class="net-group-h">Highest-value next leads</h3>
    ${steps}

    <div class="bottom-line">
      <h3>Bottom line</h3>
      <p>${d.bottom_line}</p>
    </div>
  `;
}

/* ======================= CONTESTED CLAIMS TAB ======================= */
async function loadContested() {
  const root = document.getElementById("contested-root");
  if (!root) return;
  const d = await fetch("data/contested.json?v=117").then((r) => r.json());

  const ratingChips = Object.entries(d.ratings).map(([k, r]) =>
    `<span class="rating-chip" style="background:${r.color}" title="${r.desc}">${r.label}</span>`).join("");

  const disputes = d.disputes.map((dis) => {
    const problems = (dis.core_problems || []).map((p) => `
      <div class="core-problem">
        <span class="cp-n">${p.n}</span>
        <div><h5>${p.title}</h5><p>${p.body.replace(/\n\n/g, "</p><p>")}</p></div>
      </div>`).join("");

    const props = dis.propositions.map((p) => {
      const r = d.ratings[p.rating] || {};
      return `
        <tr>
          <td class="prop-claim">${p.claim}</td>
          <td><span class="rating-chip" style="background:${r.color}">${r.label}</span></td>
          <td class="prop-note">${p.note || "—"}</td>
        </tr>`;
    }).join("");

    const traj = dis.trajectory ? `
      <div class="trajectory">
        <h5>${dis.trajectory.title}</h5>
        <ol>${dis.trajectory.steps.map((s) => `<li>${s}</li>`).join("")}</ol>
      </div>` : "";

    return `
      <div class="dispute-block">
        <h3>${dis.title}</h3>
        <p class="dispute-summary">${dis.summary}</p>
        ${problems ? `<h4 class="dispute-sub">The core problems</h4>${problems}` : ""}
        ${traj}
        ${dis.access_mechanism ? `<div class="access-mech"><h5>The plausible influence mechanism</h5><p>${dis.access_mechanism}</p></div>` : ""}
        ${dis.nuance ? `<div class="dispute-nuance"><h5>What complicates the simple version</h5><p>${dis.nuance}</p></div>` : ""}
        ${dis.separate_question ? `<div class="separate-q"><h5>A separate question entirely</h5><p>${dis.separate_question}</p></div>` : ""}
        ${dis.snow_credibility ? `<div class="dispute-nuance"><h5>On the accuser's credibility</h5><p>${dis.snow_credibility}</p></div>` : ""}
        <h4 class="dispute-sub">Proposition-by-proposition</h4>
        <div class="edge-table-wrap">
          <table class="reg-table prop-table">
            <tr><th>Proposition</th><th>Rating</th><th>Note</th></tr>
            ${props}
          </table>
        </div>
        <div class="dispute-bottom"><strong>Bottom line.</strong> ${dis.bottom_line}</div>
        ${dis.next_step ? `<div class="dispute-next"><strong>Best next step.</strong> ${dis.next_step}</div>` : ""}
      </div>`;
  }).join("");

  const tm = d.trends_methodology;
  const expl = tm.explanations.map((e) => `
    <div class="trends-expl">
      <span class="te-rank">${e.rank}</span>
      <div><h5>${e.title}</h5><p>${e.body}</p></div>
    </div>`).join("");

  const contraCount = (d.contradictions || []).length;

  root.innerHTML = `
    <div class="panel-intro warn">
      <strong>Claims are rated one proposition at a time.</strong> ${d.principle}
    </div>

    <div class="tier-legend">
      <strong>Rating scale:</strong>
      <div class="tier-chips">${ratingChips}</div>
    </div>

    ${disputes}

    ${contraCount ? `
    <div class="contra-pointer">
      <strong>${contraCount} direct contradictions</strong> — two sources conflicting, or a source
      contradicting itself — have been compiled into their own dedicated tab.
      <button class="contra-goto-btn" onclick="document.querySelector('[data-tab=contradictions]').click()">
        Open Contradictions tab →
      </button>
    </div>` : ""}

    <div class="trends-method">
      <h3>${tm.title}</h3>
      <p class="demo-lede">${tm.lede}</p>
      ${expl}
      <div class="core-distinction"><strong>The core distinction.</strong> ${tm.core_distinction}</div>
      <div class="would-change">
        <h4>What would change this assessment</h4>
        <ul>${tm.what_would_change_it.map((w) => `<li>${w}</li>`).join("")}</ul>
      </div>
      <div class="proposed-exp"><strong>The experiment worth running.</strong> ${tm.proposed_experiment}</div>
    </div>
  `;
}

/* ======================= CONTRADICTIONS TAB ======================= */
async function loadContradictions() {
  const root = document.getElementById("contradictions-root");
  if (!root) return;
  const d = await fetch("data/contested.json?v=117").then((r) => r.json());
  const list = d.contradictions || [];

  const statusCounts = { resolved: 0, unresolved: 0, checkable: 0, other: 0 };
  for (const x of list) {
    const s = (x.status || "").toLowerCase();
    if (s.startsWith("resolved")) statusCounts.resolved++;
    else if (s.includes("checkable")) statusCounts.checkable++;
    else if (s.includes("unresolved")) statusCounts.unresolved++;
    else statusCounts.other++;
  }

  const cards = list.map((x) => {
    const isResolved = (x.status || "").toLowerCase().startsWith("resolved");
    return `
    <div class="contra-card${isResolved ? " contra-resolved" : ""}">
      <div class="contra-head">
        <h4>${x.id}. ${x.title}</h4>
        <span class="contra-status">${x.status}</span>
      </div>
      <div class="contra-sides">
        <div class="contra-side side-a">
          <span class="side-label">A</span>
          <div><strong>${x.side_a.source}</strong><p>${x.side_a.claim}</p></div>
        </div>
        <div class="contra-vs">vs.</div>
        <div class="contra-side side-b">
          <span class="side-label">B</span>
          <div><strong>${x.side_b.source}</strong><p>${x.side_b.claim}</p></div>
        </div>
      </div>
      <div class="contra-why"><strong>Why it matters.</strong> ${x.why_it_matters}</div>
      <div class="contra-ref">See: ${x.app_reference}</div>
    </div>`;
  }).join("");

  root.innerHTML = `
    <div class="panel-intro warn">
      <strong>Every direct contradiction found across this app's research, in one place.</strong>
      A contradiction here means two sources make incompatible factual claims about the same thing,
      or a single source's own statements fail to reconcile with each other — not merely that two
      people disagree in interpretation or opinion. Each card is preserved as an open conflict unless
      the record itself actually resolves it, in which case that's stated plainly rather than hidden.
    </div>

    <div class="stat-row">
      <div class="stat-tile"><div class="num">${list.length}</div><div class="label">Total contradictions</div></div>
      <div class="stat-tile grade-a"><div class="num">${statusCounts.resolved}</div><div class="label">Resolved</div></div>
      <div class="stat-tile grade-c"><div class="num">${statusCounts.unresolved}</div><div class="label">Unresolved</div></div>
      <div class="stat-tile grade-b"><div class="num">${statusCounts.checkable}</div><div class="label">Checkable against records</div></div>
    </div>

    <div class="contra-grid">${cards}</div>
  `;
}

/* ======================= EXTERNAL FACT-CHECK TAB ======================= */
async function loadFactCheck() {
  const root = document.getElementById("factcheck-root");
  if (!root) return;
  const d = await fetch("data/charliefiles.json?v=19").then((r) => r.json());

  const catOrder = [...new Set(d.claims.map((c) => c.category))];
  const sections = catOrder.map((cat) => {
    const items = d.claims.filter((c) => c.category === cat).map((c) => {
      const v = d.verdicts[c.verdict] || {};
      const forList = (c.for || []).map((f) => `<li>${f}</li>`).join("");
      const againstList = (c.against || []).map((a) => `<li>${a}</li>`).join("");
      const timeline = c.timeline ? `
        <div class="cf-mini-timeline">
          ${c.timeline.map((t) => `<div class="cf-tl-row"><span class="cf-tl-date">${t.date}</span><span>${t.event}</span></div>`).join("")}
        </div>` : "";
      return `
        <div class="cf-claim-card">
          <div class="cf-claim-head">
            <h4>${c.title}</h4>
            <span class="rating-chip" style="background:${v.color}">${v.label}</span>
          </div>
          <p class="cf-claim-text"><em>${c.claim}</em></p>
          ${c.verdict_note ? `<p class="cf-verdict-note">${c.verdict_note}</p>` : ""}
          ${c.note ? `<p class="cf-verdict-note">${c.note}</p>` : ""}
          <div class="cf-for-against">
            ${forList ? `<div class="cf-for"><h5>Evidence for</h5><ul>${forList}</ul></div>` : ""}
            ${againstList ? `<div class="cf-against"><h5>Evidence against</h5><ul>${againstList}</ul></div>` : ""}
          </div>
          ${timeline}
          ${c.sources?.length ? `<p class="cf-sources"><strong>Sources:</strong> ${c.sources.join("; ")}</p>` : ""}
          ${c.app_cross_reference ? `<div class="cf-cross-ref"><strong>Cross-checked against this app.</strong> ${c.app_cross_reference}</div>` : ""}
        </div>`;
    }).join("");
    return `<h3 class="net-group-h">${cat}</h3>${items}`;
  }).join("");

  root.innerHTML = `
    <div class="panel-intro warn">
      <strong>${d.source_note.site}</strong> is a third-party site, not this app's own research.
      ${d.source_note.description} Fetched ${d.source_note.fetched}. Full source:
      <a href="${d.source_note.url}" target="_blank" rel="noopener">${d.source_note.url}</a>
    </div>
    <div class="tier-legend">
      <p>${d.source_note.how_this_tab_uses_it}</p>
    </div>
    ${sections}
    <div class="donor-transparency">
      <h4>Methodology note</h4>
      <p>${d.methodology_note}</p>
    </div>
  `;
}

/* ========================= 48-HOUR WINDOW TAB ========================= */
async function loadPersonTimelines() {
  const root = document.getElementById("persontime-root");
  if (!root) return;
  const d = await fetch("data/person_timelines.json?v=19").then((r) => r.json());

  const confColors = { official: "#52c7c1", reported: "#6ea8e0", self_reported: "#e8b84b", disputed: "#e05252" };

  const people = d.people.map((p) => {
    const hasEntries = p.entries?.length > 0;
    const entries = (p.entries || []).map((e) => `
      <div class="pt-entry">
        <span class="pt-when">${e.when}</span>
        <div class="pt-event">
          ${e.event}
          <span class="conf-dot" style="background:${confColors[e.confidence] || "#9aa1b1"}" title="${d.confidence_legend[e.confidence] || ""}"></span>
        </div>
      </div>`).join("");

    return `
      <div class="pt-person-card${hasEntries ? "" : " pt-empty"}">
        <div class="pt-person-head">
          <h4>${p.name}</h4>
          <span class="pt-role">${p.role}</span>
        </div>
        ${p.coverage_note ? `<p class="pt-coverage">${p.coverage_note}</p>` : ""}
        ${hasEntries ? `<div class="pt-entries">${entries}</div>` : `<p class="pt-none">No public record located placing this person at a specific time or place in this 48-hour window.</p>`}
      </div>`;
  }).join("");

  const legendChips = Object.entries(d.confidence_legend).map(([k, desc]) =>
    `<span class="tier-chip" style="border-color:${confColors[k] || "#9aa1b1"}" title="${desc}">${k.replace("_", " ")}</span>`).join("");

  root.innerHTML = `
    <div class="panel-intro">
      <strong>Window: ${d.window.start} → ${d.window.end}</strong> (shooting at ${d.window.shooting}).
      ${d.window.note}
    </div>
    <div class="tier-legend">
      <strong>Source confidence:</strong>
      <div class="tier-chips">${legendChips}</div>
    </div>
    <p class="demo-lede">${d.methodology}</p>
    ${people}
  `;
}

/* ======================= SCENE SIMULATION TAB ======================= */

const SIM_CAT_COLORS = {
  foreign_government: "#e05252",
  military: "#e05252",
  surveillance_platform: "#e05252",
  private_jet: "#e09a52",
  resolved_false_lead: "#52c7c1",
};

let SIM_DATA = null;
let SIM_PLAYING = false;
let SIM_PLAY_TIMER = null;

async function loadSimulation() {
  const root = document.getElementById("simulation-root");
  if (!root) return;
  const sim = await fetch("data/simulation.json?v=21").then((r) => r.json());
  SIM_DATA = sim;

  function mdtLabel(h) {
    const hh = Math.floor(h);
    const mm = Math.round((h - hh) * 60);
    const period = hh >= 12 ? "PM" : "AM";
    const h12 = hh % 12 === 0 ? 12 : hh % 12;
    return `${h12}:${String(mm).padStart(2, "0")} ${period}`;
  }

  const startSec = (11 + 6) * 3600;
  const endSec = (15 + 6) * 3600;
  const shootSec = (12 + 6) * 3600 + 23 * 60;

  const phaseChips = sim.phases.map((p) =>
    `<span class="phase-chip" data-phase="${p.key}" title="Starts ~${p.start_mdt} MDT">${p.label}</span>`).join("");

  root.innerHTML = `
    <div class="panel-intro warn">
      <strong>Several different kinds of precision are shown here, and they are labeled, not blended.</strong>
      ${sim.precision_note}
    </div>

    <div class="sim-controls">
      <button id="sim-play-btn" class="sim-play-btn">▶ Play</button>
      <span class="sim-time-readout" id="sim-time-readout"></span>
      <input type="range" id="sim-slider" min="${startSec}" max="${endSec}" step="15" value="${shootSec}" class="sim-slider" />
      <button id="sim-reset-btn" class="sim-reset-btn">Jump to shot — 12:23 PM</button>
    </div>

    <div class="sim-phase-bar" id="sim-phase-bar">${phaseChips}</div>
    <div class="sim-now" id="sim-now"></div>

    <div class="sim-panels">
      <div class="sim-panel sim-panel-wide">
        <h4>UVU campus <span class="precision-chip gps">REAL SATELLITE IMAGE</span></h4>
        <p class="sim-panel-note">Real satellite imagery (Esri World Imagery / Maxar), not an illustration. The fountain courtyard is a real position identified directly from the visible fountain in this image; the Losee Center outline is its real building footprint (OpenStreetMap). The roof marker is placed at the building edge nearest the courtyard as a reasonable approximation, not a surveyed point — see the panel below the map for the exact reasoning. The ~30m security perimeter radius is sourced and to scale. The wooded escape route has no public coordinates and is deliberately not shown as a map pin.</p>
        <div class="sim-svg-wrap"><svg id="sim-campus-svg" viewBox="0 0 1000 1000"></svg></div>
      </div>
      <div class="sim-panel">
        <h4>Regional aircraft <span class="precision-chip gps">REAL GPS</span></h4>
        <p class="sim-panel-note">Actual ADS-B transponder coordinates from the adsb.lol 2025-09-10 archive. 26 aircraft tracked.</p>
        <div class="sim-svg-wrap"><svg id="sim-aircraft-svg" viewBox="0 0 320 420"></svg></div>
      </div>
    </div>

    <div class="sim-detail" id="sim-detail"></div>

    <div class="sim-legend">
      <strong>Precision key:</strong>
      <span class="precision-chip gps">REAL GPS</span> — actual transponder coordinates, aircraft only.
      <span class="precision-chip schematic">SCHEMATIC</span> — proportionally-scaled illustration; distance sourced, exact position/bearing not.
      <span class="precision-chip representative">REPRESENTATIVE</span> — count/posture sourced, no individual is located.
      <span class="precision-chip unknown">NO COORDS</span> — event is documented but no position of any kind is public.
    </div>
  `;

  const slider = document.getElementById("sim-slider");
  const readout = document.getElementById("sim-time-readout");

  function currentPhaseKey(ts) {
    let phase = sim.phases[0].key;
    for (const ev of sim.ground_events) {
      if (ev.ts <= ts) phase = ev.phase;
    }
    return phase;
  }

  function update() {
    const ts = Number(slider.value);
    const h = ts / 3600 - 6;
    readout.textContent = mdtLabel(h) + " MDT";
    renderSimAtTime(sim, ts);

    const phaseKey = currentPhaseKey(ts);
    document.querySelectorAll(".phase-chip").forEach((chip) => {
      chip.classList.toggle("active", chip.dataset.phase === phaseKey);
    });

    const past = sim.ground_events.filter((e) => e.ts <= ts).sort((a, b) => b.ts - a.ts);
    const nowEl = document.getElementById("sim-now");
    if (past.length) {
      nowEl.innerHTML = `<strong>Right now:</strong> ${past[0].headline}`;
    } else {
      nowEl.innerHTML = `<strong>Right now:</strong> Before documented event activity begins.`;
    }
  }

  slider.addEventListener("input", update);
  document.getElementById("sim-reset-btn").addEventListener("click", () => {
    slider.value = shootSec;
    update();
  });
  document.getElementById("sim-play-btn").addEventListener("click", () => {
    SIM_PLAYING = !SIM_PLAYING;
    const btn = document.getElementById("sim-play-btn");
    if (SIM_PLAYING) {
      btn.textContent = "⏸ Pause";
      SIM_PLAY_TIMER = setInterval(() => {
        let v = Number(slider.value) + 30;
        if (v > endSec) v = startSec;
        slider.value = v;
        update();
      }, 200);
    } else {
      btn.textContent = "▶ Play";
      clearInterval(SIM_PLAY_TIMER);
    }
  });

  update();
}

function simMdtFmt(ts) {
  let h = Math.floor(ts / 3600) - 6;
  const m = Math.floor((ts % 3600) / 60);
  if (h < 0) h += 24;
  const period = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, "0")} ${period} MDT`;
}

function renderSimAtTime(sim, ts) {
  drawSimCampus(sim, ts);
  drawSimAircraft(sim, ts);
  drawSimDetail(sim, ts);
}

function drawSimCampus(sim, ts) {
  const svg = document.getElementById("sim-campus-svg");
  if (!svg) return;
  svg.innerHTML = "";
  const NS = "http://www.w3.org/2000/svg";
  const sat = sim.venue.satellite;
  const pxPerMeter = 1 / sat.meters_per_pixel;
  const originPx = { x: sat.courtyard_px.x, y: sat.courtyard_px.y };

  // Real-world-anchored: (x,y) are meters (east, south) from the real courtyard position.
  function toSvg(x, y) {
    return { x: originPx.x + x * pxPerMeter, y: originPx.y + y * pxPerMeter };
  }
  function el(tag, attrs) {
    const e = document.createElementNS(NS, tag);
    for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
    svg.appendChild(e);
    return e;
  }

  const sc = sim.venue.schematic;

  // --- Real satellite base image ---
  const img = document.createElementNS(NS, "image");
  img.setAttribute("href", sat.image);
  img.setAttribute("x", 0); img.setAttribute("y", 0);
  img.setAttribute("width", sat.width_px); img.setAttribute("height", sat.height_px);
  img.setAttribute("preserveAspectRatio", "xMidYMid slice");
  svg.appendChild(img);

  // --- Real Losee Center building footprint (from OpenStreetMap) ---
  const polyPts = sat.losee_building_polygon_px.map(([lat_x, lon_y]) => `${lat_x},${lon_y}`).join(" ");
  el("polygon", { points: polyPts, fill: "rgba(224,82,82,0.18)", stroke: "#e05252", "stroke-width": 2 });
  el("text", { x: sat.courtyard_px.x + (sc.losee_center_roof.x) * pxPerMeter, y: sat.courtyard_px.y + (sc.losee_center_roof.y) * pxPerMeter - 14, fill: "#e05252", "font-size": 10, "font-weight": 700, "text-anchor": "middle" }).textContent = "Losee Center (real footprint)";

  // --- Security perimeter: concentric zones around the real courtyard, ~30m sourced radius ---
  const cS = toSvg(sc.courtyard.x, sc.courtyard.y);
  const secRadiusPx = sim.venue.security_zones.inner_radius_m * pxPerMeter;
  el("circle", { cx: cS.x, cy: cS.y, r: secRadiusPx, fill: "none", stroke: "#52c7c1", "stroke-width": 1, "stroke-dasharray": "2 3", opacity: 0.7 });
  el("circle", { cx: cS.x, cy: cS.y, r: secRadiusPx * 1.6, fill: "none", stroke: "#52c7c1", "stroke-width": 1, "stroke-dasharray": "2 5", opacity: 0.4 });

  // --- Rooftop marker + NE corner (approximate: real building edge nearest the real courtyard) ---
  const rS = toSvg(sc.losee_center_roof.x, sc.losee_center_roof.y);
  el("circle", { cx: rS.x, cy: rS.y, r: 5, fill: "#e05252", stroke: "#14171c", "stroke-width": 1.5 });
  const neS = toSvg(sc.losee_ne_corner.x, sc.losee_ne_corner.y);
  el("circle", { cx: neS.x, cy: neS.y, r: 3.5, fill: "#fff", stroke: "#e05252", "stroke-width": 1.5 });
  el("text", { x: neS.x + 8, y: neS.y - 8, fill: "#fff", "font-size": 9, "font-weight": 700 }).textContent = "NE corner descent (approx.)";

  // --- Distance line courtyard -> roof ---
  el("line", { x1: cS.x, y1: cS.y, x2: rS.x, y2: rS.y, stroke: "#fff", "stroke-width": 1.2, "stroke-dasharray": "3 3", opacity: 0.8 });
  el("text", { x: (cS.x + rS.x) / 2, y: (cS.y + rS.y) / 2 - 8, fill: "#fff", "font-size": 9, "font-weight": 700, "text-anchor": "middle" }).textContent = "~127m sourced (~90m measured on this image to the nearest building edge)";

  // --- Courtyard marker + label (real, visually-identified fountain position) ---
  el("circle", { cx: cS.x, cy: cS.y, r: 7, fill: "#e8b84b", stroke: "#14171c", "stroke-width": 1.5 });
  el("text", { x: cS.x, y: cS.y + 22, fill: "#e8b84b", "font-size": 10, "font-weight": 700, "text-anchor": "middle" }).textContent = "Fountain Courtyard (real position)";

  // --- Robinson's path trail: connect every robinson waypoint up to ts that has real coordinates ---
  const robinsonPts = sim.ground_events
    .filter((e) => e.entity === "robinson" && e.ts <= ts && e.x !== null && e.y !== null)
    .sort((a, b) => a.ts - b.ts);
  for (let i = 1; i < robinsonPts.length; i++) {
    const p1 = toSvg(robinsonPts[i - 1].x, robinsonPts[i - 1].y);
    const p2 = toSvg(robinsonPts[i].x, robinsonPts[i].y);
    el("line", { x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y, stroke: "#e05252", "stroke-width": 2, "stroke-dasharray": "4 2", opacity: 0.7 });
  }
  if (sim.ground_events.some((e) => e.entity === "robinson" && e.ts <= ts && e.x === null)) {
    el("text", { x: 10, y: 985, fill: "#9aa1b1", "font-size": 9 }).textContent = "Wooded escape route: no public coordinates — not shown as a map pin (see detail panel below)";
  }

  // --- SUV / evacuation direction arrow: real bearing toward the hospital, compressed length ---
  const suvEv = sim.ground_events.filter((e) => e.entity === "suv" && e.ts <= ts).sort((a, b) => b.ts - a.ts)[0];
  if (suvEv) {
    const evS = toSvg(0, 0);
    const dirS = toSvg(suvEv.x, suvEv.y);
    el("line", { x1: evS.x, y1: evS.y, x2: dirS.x, y2: dirS.y, stroke: "#e8b84b", "stroke-width": 2.5, "marker-end": "url(#simArrow)" });
    const defs = el("defs", {});
    const marker = document.createElementNS(NS, "marker");
    marker.setAttribute("id", "simArrow"); marker.setAttribute("markerWidth", "8"); marker.setAttribute("markerHeight", "8");
    marker.setAttribute("refX", "4"); marker.setAttribute("refY", "4"); marker.setAttribute("orient", "auto");
    const arrowPath = document.createElementNS(NS, "path");
    arrowPath.setAttribute("d", "M0,0 L8,4 L0,8 Z"); arrowPath.setAttribute("fill", "#e8b84b");
    marker.appendChild(arrowPath); defs.appendChild(marker);
    el("text", { x: dirS.x + 6, y: dirS.y, fill: "#e8b84b", "font-size": 10, "font-weight": 700 }).textContent = "→ Timpanogos Regional Hospital (real bearing, ~2.7km)";
  }

  // --- Entity positions: most recent ground_event at/before ts, per entity ---
  const entities = {};
  for (const e of sim.ground_events) {
    if (e.ts <= ts && (!entities[e.entity] || e.ts > entities[e.entity].ts)) {
      entities[e.entity] = e;
    }
  }

  const ENTITY_STYLE = {
    kirk: { color: "#4ea1ff", label: "Kirk", r: 8 },
    robinson: { color: "#e05252", label: "Robinson", r: 7 },
    shot: { color: "#fff", label: "Shot fired", r: 10 },
    suv: { color: "#e8b84b", label: "SUV", r: 8, shape: "rect" },
    security_perimeter: { color: "#52c7c1", label: "Private security + 6 UVU officers", r: 5, dashed: true },
    security_response: { color: "#52c7c1", label: "Security converges on Kirk", r: 6 },
    investigators: { color: "#9b7de0", label: "SBI/FBI evidence response", r: 6, shape: "diamond" },
    harpole: { color: "#35c46b", label: "Harpole (security chief)", r: 5 },
    turek: { color: "#e8b84b", label: "Turek", r: 5 },
    farnsworth: { color: "#c98be0", label: "Farnsworth (AV lead)", r: 5 },
    davis: { color: "#6ea8e0", label: "Davis (driver)", r: 5 },
    flood: { color: "#8fb8ff", label: "Flood (security director)", r: 5 },
    cutler: { color: "#4ecdc4", label: "Cutler", r: 5 },
  };

  for (const [key, ev] of Object.entries(entities)) {
    if (ev.x === null || ev.y === null) continue;
    const style = ENTITY_STYLE[key] || { color: "#fff", label: key, r: 6 };
    const s = toSvg(ev.x, ev.y);

    if (style.shape === "rect") {
      el("rect", { x: s.x - style.r, y: s.y - style.r, width: style.r * 2, height: style.r * 2, fill: style.color, stroke: "#14171c", "stroke-width": 1.5, rx: 2 });
    } else if (style.shape === "diamond") {
      el("polygon", {
        points: `${s.x},${s.y - style.r} ${s.x + style.r},${s.y} ${s.x},${s.y + style.r} ${s.x - style.r},${s.y}`,
        fill: style.color, stroke: "#14171c", "stroke-width": 1.2,
      });
    } else {
      const marker = el("circle", { cx: s.x, cy: s.y, r: style.r, fill: style.color, stroke: "#14171c", "stroke-width": 1.5 });
      if (key === "shot") marker.setAttribute("opacity", ts - ev.ts < 60 ? "0.9" : "0.15");
      if (style.dashed) { marker.setAttribute("fill", "none"); marker.setAttribute("stroke-dasharray", "2 2"); }
    }

    const lbl = el("text", { x: s.x + style.r + 4, y: s.y - style.r, fill: style.color, "font-size": 9, "font-weight": 700 });
    lbl.textContent = style.label;
  }
}

function drawSimAircraft(sim, ts) {
  const svg = document.getElementById("sim-aircraft-svg");
  if (!svg) return;
  svg.innerHTML = "";
  const NS = "http://www.w3.org/2000/svg";
  const w = 320, h = 420, pad = 20;

  // Fixed bounding box around Utah Valley for stable framing across the whole slider range
  const minLat = 39.9, maxLat = 40.6, minLon = -112.1, maxLon = -111.3;
  const scale = Math.min((w - pad * 2) / (maxLon - minLon), (h - pad * 2) / (maxLat - minLat));
  function toSvg(lat, lon) {
    return { x: pad + (lon - minLon) * scale, y: pad + (maxLat - lat) * scale };
  }

  // UVU + PVU reference markers
  const uvu = toSvg(sim.venue.uvu_center.lat, sim.venue.uvu_center.lon);
  const uvuDot = document.createElementNS(NS, "circle");
  uvuDot.setAttribute("cx", uvu.x); uvuDot.setAttribute("cy", uvu.y); uvuDot.setAttribute("r", 4);
  uvuDot.setAttribute("fill", "#e8b84b");
  svg.appendChild(uvuDot);
  const uvuLbl = document.createElementNS(NS, "text");
  uvuLbl.setAttribute("x", uvu.x + 7); uvuLbl.setAttribute("y", uvu.y + 3);
  uvuLbl.setAttribute("fill", "#e8b84b"); uvuLbl.setAttribute("font-size", "8"); uvuLbl.setAttribute("font-weight", "700");
  uvuLbl.textContent = "UVU";
  svg.appendChild(uvuLbl);

  const pvu = toSvg(sim.venue.pvu_airport.lat, sim.venue.pvu_airport.lon);
  const pvuDot = document.createElementNS(NS, "circle");
  pvuDot.setAttribute("cx", pvu.x); pvuDot.setAttribute("cy", pvu.y); pvuDot.setAttribute("r", 3);
  pvuDot.setAttribute("fill", "#fff"); pvuDot.setAttribute("stroke", "#14171c");
  svg.appendChild(pvuDot);
  const pvuLbl = document.createElementNS(NS, "text");
  pvuLbl.setAttribute("x", pvu.x + 6); pvuLbl.setAttribute("y", pvu.y + 3);
  pvuLbl.setAttribute("fill", "#9aa1b1"); pvuLbl.setAttribute("font-size", "7");
  pvuLbl.textContent = "PVU";
  svg.appendChild(pvuLbl);

  // For each aircraft, find nearest sample within +/-5min of ts; draw a short fading trail
  const TOLERANCE = 300;
  let visibleCount = 0;
  for (const ac of sim.aircraft) {
    if (!ac.trace || !ac.trace.length) continue;
    let nearest = null, nearestDelta = Infinity;
    const trail = [];
    for (const p of ac.trace) {
      const delta = Math.abs(p.ts - ts);
      if (delta < nearestDelta) { nearestDelta = delta; nearest = p; }
      if (p.ts <= ts && ts - p.ts <= 900 && typeof p.lat === "number") trail.push(p);
    }
    if (!nearest || nearestDelta > TOLERANCE || typeof nearest.lat !== "number") continue;
    visibleCount++;

    if (trail.length > 1) {
      for (let i = 1; i < trail.length; i++) {
        const p1 = toSvg(trail[i - 1].lat, trail[i - 1].lon);
        const p2 = toSvg(trail[i].lat, trail[i].lon);
        const line = document.createElementNS(NS, "line");
        line.setAttribute("x1", p1.x); line.setAttribute("y1", p1.y);
        line.setAttribute("x2", p2.x); line.setAttribute("y2", p2.y);
        line.setAttribute("stroke", SIM_CAT_COLORS[ac.category] || "#4ea1ff");
        line.setAttribute("stroke-width", "1"); line.setAttribute("opacity", "0.4");
        svg.appendChild(line);
      }
    }

    const s = toSvg(nearest.lat, nearest.lon);
    const dot = document.createElementNS(NS, "circle");
    dot.setAttribute("cx", s.x); dot.setAttribute("cy", s.y);
    dot.setAttribute("r", nearest.alt === "ground" ? 3.5 : 2.5);
    dot.setAttribute("fill", SIM_CAT_COLORS[ac.category] || "#4ea1ff");
    dot.setAttribute("stroke", nearest.alt === "ground" ? "#fff" : "none");
    dot.setAttribute("stroke-width", "1");
    dot.setAttribute("data-reg", ac.reg);
    svg.appendChild(dot);
  }

  const countLbl = document.createElementNS(NS, "text");
  countLbl.setAttribute("x", 6); countLbl.setAttribute("y", h - 8);
  countLbl.setAttribute("fill", "#9aa1b1"); countLbl.setAttribute("font-size", "8");
  countLbl.textContent = `${visibleCount} aircraft within 5min of this timestamp`;
  svg.appendChild(countLbl);
}

function drawSimDetail(sim, ts) {
  const el = document.getElementById("sim-detail");
  if (!el) return;

  const recentGround = sim.ground_events
    .filter((e) => Math.abs(e.ts - ts) < 180)
    .sort((a, b) => a.ts - b.ts);

  const nearbyAircraft = sim.aircraft
    .map((ac) => {
      if (!ac.trace || !ac.trace.length) return null;
      let nearest = null, delta = Infinity;
      for (const p of ac.trace) {
        const d = Math.abs(p.ts - ts);
        if (d < delta) { delta = d; nearest = p; }
      }
      return nearest && delta < 300 ? { ac, nearest, delta } : null;
    })
    .filter(Boolean)
    .sort((a, b) => a.delta - b.delta)
    .slice(0, 8);

  function precisionChipClass(p) {
    if (p === "schematic" || p === "schematic_direction_only") return "schematic";
    if (p === "representative_not_individual") return "representative";
    return "unknown";
  }

  const groundHtml = recentGround.length ? recentGround.map((e) => `
    <div class="sim-event-row">
      <span class="sim-event-time">${simMdtFmt(e.ts)}</span>
      <span class="conf-chip conf-${e.confidence}">${e.confidence}</span>
      <span class="precision-chip ${precisionChipClass(e.precision)}">${e.precision.replace(/_/g, ' ')}</span>
      <p><strong>${e.entity_label}:</strong> ${e.event}</p>
    </div>`).join("") : `<p class="sim-empty">No ground event within 3 minutes of this timestamp.</p>`;

  // Who's currently on scene — most recent state per entity, active as of ts
  const onScene = {};
  for (const e of sim.ground_events) {
    if (e.ts <= ts && (!onScene[e.entity] || e.ts > onScene[e.entity].ts)) onScene[e.entity] = e;
  }
  const onSceneHtml = Object.values(onScene).length ? `
    <div class="sim-onscene-grid">
      ${Object.values(onScene).map((e) => `
        <div class="sim-onscene-card">
          <div class="sim-onscene-head">
            <strong>${e.entity_label}</strong>
            <span class="precision-chip ${precisionChipClass(e.precision)}">${e.precision.replace(/_/g, ' ')}</span>
          </div>
          <span class="sim-onscene-headline">${e.headline}</span>
        </div>`).join("")}
    </div>` : `<p class="sim-empty">No entity has a documented position yet at this timestamp.</p>`;

  const acHtml = nearbyAircraft.length ? `
    <table class="reg-table sim-ac-table">
      <tr><th>Reg</th><th>Type</th><th>Category</th><th>Alt</th><th>Note</th></tr>
      ${nearbyAircraft.map((n) => `
        <tr>
          <td><strong>${n.ac.reg}</strong></td>
          <td>${n.ac.type}</td>
          <td>${n.ac.category.replace(/_/g, " ")}</td>
          <td>${n.nearest.alt === "ground" ? "ground" : n.nearest.alt + " ft"}</td>
          <td>${n.ac.note}</td>
        </tr>`).join("")}
    </table>` : `<p class="sim-empty">No aircraft within 5 minutes of this timestamp.</p>`;

  el.innerHTML = `
    <h4>Who's on scene at ${simMdtFmt(ts)}</h4>
    ${onSceneHtml}
    <h4>Ground events near ${simMdtFmt(ts)}</h4>
    ${groundHtml}
    <h4>Aircraft near ${simMdtFmt(ts)}</h4>
    ${acHtml}
  `;
}

/* ======================= DEEP DIVES TAB ======================= */
async function loadDeepDives() {
  const root = document.getElementById("deepdives-root");
  if (!root) return;
  let d;
  try { d = await fetch("data/deep_dives.json?v=134").then(r => r.json()); } catch { root.innerHTML = '<p class="placeholder">Deep dives data not yet available.</p>'; return; }

  const catLabels = {
    alibi_evidence: "Alibi Evidence", media_analysis: "Media Analysis", personnel: "Personnel",
    foreign_connections: "Foreign Connections", donor_network: "Donor Network", associates: "Associates",
    hearing_update: "Hearing Update", crossover_analysis: "Crossover Analysis",
    document_forensics: "Document Forensics", timeline_forensics: "Timeline Forensics", motive_analysis: "Motive Analysis",
    official_statements: "Official Statements", physical_evidence: "Physical Evidence",
    digital_evidence: "Digital Evidence", aviation: "Aviation"
  };
  const catColors = {
    alibi_evidence: "#e8b84b", media_analysis: "#c98be0", personnel: "#4ea1ff",
    foreign_connections: "#e05252", donor_network: "#e09a52", associates: "#52c7c1",
    hearing_update: "#6ea8e0", crossover_analysis: "#35c46b",
    document_forensics: "#d4a5ff", timeline_forensics: "#ff9d5c", motive_analysis: "#f07ba8",
    official_statements: "#5c9dff", physical_evidence: "#c4a35a",
    digital_evidence: "#4ecdc4", aviation: "#8fb8ff"
  };
  const assessColors = {
    verified: "#35c46b", supported: "#52c7c1", plausible: "#e8b84b",
    unproven: "#e09a52", not_established: "#e05252", refuted: "#7a7f8c"
  };

  const catCounts = {};
  d.forEach(dive => { catCounts[dive.category] = (catCounts[dive.category] || 0) + 1; });
  const catOrder = Object.keys(catCounts).sort((a, b) => catCounts[b] - catCounts[a]);

  const cardHtml = d.map((dive, idx) => {
    const catColor = catColors[dive.category] || "#9aa1b1";
    const catLabel = catLabels[dive.category] || dive.category;
    const findings = (dive.findings || []).map(f => {
      const ac = assessColors[f.assessment] || "#9aa1b1";
      return `<div class="dd-finding">
        <div class="dd-finding-head">
          <span class="dd-assess-badge" style="background:${ac}">${f.assessment.replace(/_/g," ")}</span>
          <span class="dd-claim">${f.claim}</span>
        </div>
        <p class="dd-detail">${f.detail}</p>
      </div>`;
    }).join("");

    const docComp = dive.document_comparison ? `
      <div class="dd-doc-compare">
        <h4>Document Comparison</h4>
        <div class="dd-doc-grid">
          <div class="dd-doc-ver">
            <strong>Original Version</strong>
            <div class="dd-doc-field"><span>Gregorian:</span> ${dive.document_comparison.original_version.gregorian_date}</div>
            <div class="dd-doc-field"><span>Hebrew:</span> ${dive.document_comparison.original_version.hebrew_date}</div>
            <div class="dd-doc-field"><span>Hebrew year correct:</span> <span class="${dive.document_comparison.original_version.hebrew_year_correct ? "dd-ok" : "dd-err"}">
              ${dive.document_comparison.original_version.hebrew_year_correct ? "Yes" : "No"}</span></div>
            <div class="dd-doc-note">${dive.document_comparison.original_version.note}</div>
            <div class="dd-doc-src">Source: ${dive.document_comparison.original_version.source}</div>
          </div>
          <div class="dd-doc-ver">
            <strong>Corrected Version</strong>
            <div class="dd-doc-field"><span>Gregorian:</span> ${dive.document_comparison.corrected_version.gregorian_date}</div>
            <div class="dd-doc-field"><span>Hebrew:</span> ${dive.document_comparison.corrected_version.hebrew_date}</div>
            <div class="dd-doc-field"><span>Hebrew year correct:</span> <span class="${dive.document_comparison.corrected_version.hebrew_year_correct ? "dd-ok" : "dd-err"}">
              ${dive.document_comparison.corrected_version.hebrew_year_correct ? "No — should be " + dive.document_comparison.corrected_version.correct_hebrew_year : "Yes"}</span></div>
            <div class="dd-doc-note">${dive.document_comparison.corrected_version.note}</div>
            <div class="dd-doc-src">Source: ${dive.document_comparison.corrected_version.source}</div>
          </div>
        </div>
      </div>` : "";

    const precedent = dive.precedent_research ? `
      <div class="dd-precedent">
        <h4>${dive.precedent_research.question}</h4>
        <div class="dd-precedent-answer"><strong>Answer:</strong> ${dive.precedent_research.answer}</div>
        <p>${dive.precedent_research.detail}</p>
        <ul>${dive.precedent_research.related_findings.map(f => `<li>${f}</li>`).join("")}</ul>
        <div class="dd-precedent-sig"><strong>Significance:</strong> ${dive.precedent_research.significance}</div>
      </div>` : "";

    const vbio = dive.verified_biography ? `
      <div class="dd-vbio">
        <h4>Verified Biography vs. Claimed Role</h4>
        ${Object.entries(dive.verified_biography).map(([k, v]) => {
          const label = k.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
          const isNull = /^(none|no )/i.test(String(v));
          return `<div class="dd-vbio-row">
            <span class="dd-vbio-key">${label}</span>
            <span class="dd-vbio-val${isNull ? " dd-vbio-none" : ""}">${v}</span>
          </div>`;
        }).join("")}
      </div>` : "";

    const hyps = dive.hypotheses ? `
      <div class="dd-hyps">
        <h4>Ranked motive hypotheses</h4>
        ${dive.hypotheses.map(h => `
          <div class="dd-hyp">
            <div class="dd-hyp-head">
              <span class="dd-hyp-rank">${h.rank}</span>
              <strong>${h.hypothesis}</strong>
              <span class="dd-hyp-conf">${h.confidence}</span>
            </div>
            <div class="dd-hyp-sum">${h.summary}</div>
            <div class="dd-hyp-cols">
              <div class="dd-hyp-for">
                <div class="dd-hyp-lbl">Supports</div>
                <ul>${h.supports.map(s => `<li>${s}</li>`).join("")}</ul>
              </div>
              <div class="dd-hyp-against">
                <div class="dd-hyp-lbl">Cuts against</div>
                <ul>${h.against.map(s => `<li>${s}</li>`).join("")}</ul>
              </div>
            </div>
          </div>`).join("")}
      </div>` : "";

    const variants = dive.claim_variants ? `
      <div class="dd-variants">
        <h4>Claim variants — mutually incompatible</h4>
        <p class="dd-var-note">${dive.claim_variants.note}</p>
        ${dive.claim_variants.variants.map(v => {
          const notFound = /NOT FOUND/i.test(v.status);
          return `<div class="dd-variant${notFound ? " dd-variant-none" : ""}">
            <div class="dd-var-head"><strong>${v.version}</strong><span class="dd-var-sim">${v.sim_country_implied}</span></div>
            <div class="dd-var-claim">${v.assertion}</div>
            <div class="dd-var-src"><strong>Source:</strong> ${v.source}</div>
            <div class="dd-var-status">${v.status}</div>
          </div>`;
        }).join("")}
      </div>` : "";

    const fcGap = dive.fact_check_gap ? `<div class="dd-fc-gap"><strong>Fact-check gap:</strong> ${dive.fact_check_gap}</div>` : "";

    const extSources = dive.external_sources ? `<div class="dd-ext-sources"><strong>Sources:</strong> ${dive.external_sources.join(" · ")}</div>` : "";

    const routeMath = dive.route_math ? `
      <div class="dd-route-math">
        <h4>Route / Time Math</h4>
        <div class="dd-route-grid">
          <div class="dd-route-point">
            <strong>${dive.route_math.location_a.name}</strong>
            <div class="dd-doc-field">${dive.route_math.location_a.claimed_time}</div>
            <div class="dd-doc-src">${dive.route_math.location_a.source}</div>
          </div>
          <div class="dd-route-arrow">→<br><span>${dive.route_math.distance_miles} mi</span></div>
          <div class="dd-route-point">
            <strong>${dive.route_math.location_b.name}</strong>
            <div class="dd-doc-field">${dive.route_math.location_b.claimed_time}</div>
            <div class="dd-doc-src">${dive.route_math.location_b.source}</div>
          </div>
        </div>
        <div class="dd-route-stats">
          <div class="dd-route-stat"><span>Minimum drive time</span><strong>${dive.route_math.minimum_drive_time}</strong></div>
          <div class="dd-route-stat"><span>Time actually available</span><strong>${dive.route_math.available_window}</strong></div>
          <div class="dd-route-stat dd-route-shortfall"><span>Shortfall</span><strong>${dive.route_math.shortfall}</strong></div>
        </div>
        <p class="dd-doc-note">${dive.route_math.note}</p>
      </div>` : "";

    const timelineSeq = dive.timeline_sequence ? `
      <div class="dd-timeline-seq">
        <h4>Timeline Sequence</h4>
        ${dive.timeline_sequence.map(t => `
          <div class="dd-tl-row">
            <div class="dd-tl-time">${t.time}</div>
            <div class="dd-tl-event">
              ${t.event}
              <span class="dd-tl-status">${t.status}</span>
            </div>
          </div>`).join("")}
      </div>` : "";

    const searchBlob = `${dive.title} ${dive.summary} ${catLabel}`.toLowerCase().replace(/"/g, "&quot;");

    return `
      <div class="dd-card dd-collapsed" data-idx="${idx}" data-cat="${dive.category}" data-search="${searchBlob}" style="border-left-color:${catColor}">
        <div class="dd-head">
          <h3>${dive.title}</h3>
          <span class="flag-badge" style="background:${catColor}">${catLabel}</span>
          <span class="dd-quality">Sources: ${dive.sources_quality || "—"}</span>
        </div>
        <p class="dd-summary">${dive.summary}</p>
        <button class="dd-toggle" type="button" aria-expanded="false">Show findings &amp; sources <span class="dd-toggle-arrow">▾</span></button>
        <div class="dd-card-body">
          ${findings ? `<div class="dd-findings">${findings}</div>` : ""}
          ${hyps}
          ${routeMath}
          ${timelineSeq}
          ${variants}
          ${vbio}
          ${docComp}
          ${precedent}
          ${fcGap}
          <div class="dd-takeaway"><strong>Key takeaway:</strong> ${dive.key_takeaway}</div>
          ${extSources}
          <div class="dd-updated">Last updated: ${dive.last_updated || "—"}</div>
        </div>
      </div>`;
  });

  const sections = catOrder.map(cat => {
    const catColor = catColors[cat] || "#9aa1b1";
    const catLabel = catLabels[cat] || cat;
    const idxsForCat = d.map((dive, idx) => dive.category === cat ? idx : -1).filter(i => i >= 0);
    const sectionCards = idxsForCat.map(i => cardHtml[i]).join("");
    return `
      <div class="dd-cat-block" id="dd-cat-${cat}" data-cat="${cat}" style="border-left-color:${catColor}">
        <div class="dd-cat-head">
          <h3>${catLabel} <span class="dd-cat-count">${catCounts[cat]}</span></h3>
        </div>
        <div class="dd-cat-cards">${sectionCards}</div>
      </div>`;
  }).join("");

  const jumpNav = catOrder.map(cat => `
    <a class="dd-jump-pill" href="#dd-cat-${cat}" style="border-color:${catColors[cat] || "#9aa1b1"}">
      ${catLabels[cat] || cat} <span>${catCounts[cat]}</span>
    </a>`).join("");

  const filterChecks = catOrder.map(cat => `
    <label class="chk"><input type="checkbox" class="dd-cat-filter" value="${cat}" checked /> ${catLabels[cat] || cat} (${catCounts[cat]})</label>`).join("");

  root.innerHTML = `
    <div class="panel-intro">
      <strong>Deep-dive investigations into specific case threads.</strong>
      Each section represents an independent research pass into a particular claim, person, or evidence question.
      Findings are rated individually: verified, supported, plausible, unproven, not established, or refuted.
    </div>
    <div class="stat-row">
      <div class="stat-tile"><div class="num">${d.length}</div><div class="label">Deep dives completed</div></div>
      <div class="stat-tile grade-a"><div class="num">${d.reduce((n,x) => n + (x.findings||[]).filter(f=>f.assessment==="verified").length, 0)}</div><div class="label">Verified findings</div></div>
      <div class="stat-tile grade-b"><div class="num">${d.reduce((n,x) => n + (x.findings||[]).filter(f=>f.assessment==="supported").length, 0)}</div><div class="label">Supported findings</div></div>
      <div class="stat-tile grade-c"><div class="num">${d.reduce((n,x) => n + (x.findings||[]).filter(f=>f.assessment==="not_established").length, 0)}</div><div class="label">Not established</div></div>
    </div>

    <div class="dd-jumpnav">${jumpNav}</div>

    <div class="dd-controls">
      <input type="search" id="dd-search" class="dd-search" placeholder="Search deep dives by title or summary…" />
      <div class="dd-expand-btns">
        <button type="button" id="dd-expand-all" class="dd-ec-btn">Expand all</button>
        <button type="button" id="dd-collapse-all" class="dd-ec-btn">Collapse all</button>
      </div>
      <div class="dd-cat-filters">${filterChecks}</div>
    </div>

    <div id="dd-sections">${sections}</div>
    <p class="placeholder" id="dd-empty" style="display:none">No deep dives match the current search and filters.</p>
  `;

  // ---- wiring: search + category filters ----
  function applyFilters() {
    const q = (document.getElementById("dd-search").value || "").trim().toLowerCase();
    const activeCats = [...document.querySelectorAll(".dd-cat-filter:checked")].map(c => c.value);
    let anyVisible = false;
    document.querySelectorAll(".dd-cat-block").forEach(block => {
      const cat = block.dataset.cat;
      const catActive = activeCats.includes(cat);
      let visibleInBlock = 0;
      block.querySelectorAll(".dd-card").forEach(card => {
        const matchesSearch = !q || card.dataset.search.includes(q);
        const show = catActive && matchesSearch;
        card.style.display = show ? "" : "none";
        if (show) visibleInBlock++;
      });
      block.style.display = visibleInBlock > 0 ? "" : "none";
      if (visibleInBlock > 0) anyVisible = true;
    });
    document.querySelectorAll(".dd-jump-pill").forEach(pill => {
      const cat = pill.getAttribute("href").replace("#dd-cat-", "");
      pill.style.display = activeCats.includes(cat) ? "" : "none";
    });
    document.getElementById("dd-empty").style.display = anyVisible ? "none" : "";
  }
  document.getElementById("dd-search").addEventListener("input", applyFilters);
  document.querySelectorAll(".dd-cat-filter").forEach(c => c.addEventListener("change", applyFilters));

  // ---- wiring: per-card expand/collapse ----
  root.addEventListener("click", (e) => {
    const btn = e.target.closest(".dd-toggle");
    if (!btn) return;
    const card = btn.closest(".dd-card");
    const collapsed = card.classList.toggle("dd-collapsed");
    btn.setAttribute("aria-expanded", collapsed ? "false" : "true");
    btn.innerHTML = collapsed
      ? `Show findings &amp; sources <span class="dd-toggle-arrow">▾</span>`
      : `Hide findings &amp; sources <span class="dd-toggle-arrow">▴</span>`;
  });

  // ---- wiring: expand all / collapse all ----
  function setAll(collapsed) {
    document.querySelectorAll(".dd-card").forEach(card => {
      card.classList.toggle("dd-collapsed", collapsed);
      const btn = card.querySelector(".dd-toggle");
      btn.setAttribute("aria-expanded", collapsed ? "false" : "true");
      btn.innerHTML = collapsed
        ? `Show findings &amp; sources <span class="dd-toggle-arrow">▾</span>`
        : `Hide findings &amp; sources <span class="dd-toggle-arrow">▴</span>`;
    });
  }
  document.getElementById("dd-expand-all").addEventListener("click", () => setAll(false));
  document.getElementById("dd-collapse-all").addEventListener("click", () => setAll(true));
}

/* ======================= STATEMENT LEDGER TAB ======================= */
async function loadLedger() {
  const root = document.getElementById("ledger-root");
  if (!root) return;
  let d;
  try { d = await fetch("data/statement_ledger.json?v=30").then(r => r.json()); }
  catch { root.innerHTML = '<p class="placeholder">Statement ledger not yet available.</p>'; return; }

  const stmts = d.statements || [];
  const conflicts = d.conflicts || [];
  const gts = d.ground_truth || [];
  const people = d.person_summary || [];
  const srcs = d.source_index || [];

  const sevColor = s => {
    const v = String(s || "").toLowerCase();
    if (v.startsWith("high")) return "#e05252";
    if (v.startsWith("medium-high")) return "#e0703a";
    if (v.startsWith("medium")) return "#e09a52";
    if (v.startsWith("low-medium")) return "#e8b84b";
    if (v.startsWith("low")) return "#c9c14b";
    if (v.startsWith("none")) return "#35c46b";
    return "#9aa1b1";
  };
  const isCorrob = c => /corrobor|no conflict/i.test(c.classification || "");

  const srcById = {};
  srcs.forEach(s => { srcById[s.id] = s; });
  const stmtById = {};
  stmts.forEach(s => { stmtById[s.id] = s; });

  // ---- CONFLICTS (severity-ordered, corroborations separated) ----
  const sevRank = s => {
    const v = String(s || "").toLowerCase();
    return v.startsWith("high") ? 0 : v.startsWith("medium-high") ? 1 : v.startsWith("medium") ? 2
      : v.startsWith("low-medium") ? 3 : v.startsWith("low") ? 4 : 5;
  };
  const realConf = conflicts.filter(c => !isCorrob(c)).sort((a, b) => sevRank(a.severity) - sevRank(b.severity));
  const corrob = conflicts.filter(isCorrob);

  const confCard = c => `
    <div class="lg-conflict" style="border-left-color:${sevColor(c.severity)}">
      <div class="lg-cf-head">
        <span class="lg-cf-id">${c.id}</span>
        <h4>${c.topic}</h4>
        <span class="lg-sev" style="background:${sevColor(c.severity)}">${c.severity || "—"}</span>
        <span class="lg-cf-class">${c.classification}</span>
      </div>
      <div class="lg-cf-row">
        <div class="lg-cf-person">${c.a_speaker}<span class="lg-sid">${c.a_id}</span></div>
        <div class="lg-cf-body">${c.a_claim}</div>
      </div>
      <div class="lg-cf-row">
        <div class="lg-cf-person">${c.b_speaker}<span class="lg-sid">${c.b_id}</span></div>
        <div class="lg-cf-body">${c.b_claim}</div>
      </div>
      ${c.reasoning ? `<div class="lg-cf-reason"><strong>Reasoning:</strong> ${c.reasoning}</div>` : ""}
      <div class="lg-cf-meta">Confidence: ${c.confidence || "—"}${c.source_ids ? ` · Sources: ${c.source_ids}` : ""}</div>
    </div>`;

  // ---- GROUND TRUTH ----
  const gtHtml = gts.map(g => `
    <div class="lg-gt">
      <div class="lg-gt-head"><span class="lg-gt-id">${g.id}</span><strong>${g.topic}</strong><span class="lg-gt-date">${g.date}</span></div>
      <div class="lg-gt-fact">${g.fact}</div>
      ${g.notes ? `<div class="lg-gt-note">${g.notes}</div>` : ""}
      <div class="lg-cf-meta">Confidence: ${g.confidence}${g.source_ids ? ` · ${g.source_ids}` : ""}</div>
    </div>`).join("");

  // ---- PEOPLE COVERAGE ----
  const peopleHtml = people.map(p => {
    const gap = /yes/i.test(p.more_needed || "");
    return `
      <div class="lg-pcov${gap ? " lg-pcov-gap" : ""}">
        <div class="lg-pcov-head">
          <strong>${p.person}</strong>
          <span class="lg-pcov-role">${p.role}</span>
          <span class="lg-pcov-comp">${p.completeness}</span>
        </div>
        <div class="lg-pcov-nums">
          <span>${p.logged} logged</span>
          <span class="${+p.conflicts ? "lg-neg" : ""}">${p.conflicts} conflicts</span>
          <span class="${+p.tensions ? "lg-warn" : ""}">${p.tensions} tensions</span>
          <span class="${+p.unsupported ? "lg-warn" : ""}">${p.unsupported} unsupported</span>
          <span class="${+p.corroborations ? "lg-pos" : ""}">${p.corroborations} corroborations</span>
        </div>
        <div class="lg-pcov-cov">${p.coverage}</div>
        <div class="lg-pcov-notes">${p.retrieval_notes}</div>
        ${gap ? `<div class="lg-pcov-need">Retrieval gap: ${p.more_needed}</div>` : ""}
      </div>`;
  }).join("");

  // ---- STATEMENTS BY PERSON ----
  const byPerson = {};
  stmts.forEach(s => { (byPerson[s.person] = byPerson[s.person] || []).push(s); });
  const conflictedIds = new Set();
  conflicts.filter(c => !isCorrob(c)).forEach(c => {
    String(c.a_id).split("/").forEach(x => conflictedIds.add(x.trim()));
    String(c.b_id).split("/").forEach(x => conflictedIds.add(x.trim()));
  });

  const personHtml = Object.entries(byPerson)
    .sort((a, b) => b[1].length - a[1].length)
    .map(([person, list]) => {
      const items = list.map(s => {
        const flagged = conflictedIds.has(s.id);
        const src = srcById[s.source_id];
        return `
          <div class="lg-stmt${flagged ? " lg-stmt-conflict" : ""}">
            <div class="lg-stmt-date">
              ${s.date}
              ${s.timecode ? `<span class="lg-prec">@ ${s.timecode}</span>` : ""}
              <span class="lg-prec">${s.id}</span>
            </div>
            <div class="lg-stmt-body">
              <div class="lg-stmt-claim">${s.claim}</div>
              <div class="lg-stmt-meta">
                <span class="lg-topic${flagged ? " lg-topic-conflict" : ""}">${s.topic}</span>
                <span class="lg-ctype">${s.claim_type}</span>
                <span class="lg-fh">${s.firsthand}</span>
                <span class="lg-venue">Confidence: ${s.confidence}</span>
              </div>
              <div class="lg-stmt-verif"><strong>Status:</strong> ${s.status}</div>
              ${s.notes ? `<div class="lg-stmt-verif"><strong>Analyst note:</strong> ${s.notes}</div>` : ""}
              ${src ? `<div class="lg-stmt-src">${s.source_id} · ${src.title} (${src.publisher})${src.url ? ` · <a href="${src.url}" target="_blank" rel="noopener noreferrer">link</a>` : ""}</div>` : `<div class="lg-stmt-src">${s.source_id}</div>`}
            </div>
          </div>`;
      }).join("");
      const meta = people.find(p => p.person === person);
      return `
        <div class="lg-person">
          <div class="lg-person-head">
            <h3>${person}</h3>
            <span class="lg-person-role">${list[0].role}</span>
            <span class="lg-person-stats">${list.length} statement${list.length > 1 ? "s" : ""}${meta ? ` · coverage ${meta.completeness}` : ""}</span>
          </div>
          ${items}
        </div>`;
    }).join("");

  const priHtml = (d.priorities || []).map(p => `
    <div class="lg-pri">
      <span class="lg-pri-n">${p.priority}</span>
      <div>
        <strong>${p.issue}</strong>
        <div class="lg-pri-assess">${p.assessment} <span class="lg-pri-conf">(confidence: ${p.confidence})</span></div>
        <div class="lg-pri-next"><strong>Best next record:</strong> ${p.best_next_record}</div>
      </div>
    </div>`).join("");

  root.innerHTML = `
    <div class="panel-intro"><strong>${d.scope}</strong></div>
    <div class="panel-intro" style="font-size:0.82rem">${d.provenance}</div>
    <div class="stat-row">
      <div class="stat-tile"><div class="num">${stmts.length}</div><div class="label">Statements logged</div></div>
      <div class="stat-tile"><div class="num">${people.length}</div><div class="label">Named speakers</div></div>
      <div class="stat-tile grade-c"><div class="num">${realConf.length}</div><div class="label">Conflicts / tensions</div></div>
      <div class="stat-tile grade-a"><div class="num">${corrob.length}</div><div class="label">Corroborations</div></div>
    </div>

    <h3 class="lg-h">Investigative priorities</h3>
    <p class="lg-sub">Ranked by the supplied audit, each with the specific record that would resolve it.</p>
    ${priHtml}

    <h3 class="lg-h">Conflicts and tensions (${realConf.length})</h3>
    <p class="lg-sub">Ordered by severity. Classification distinguishes direct speaker disagreement from internal wording tension, scope difference, and unresolved documentary discrepancy.</p>
    ${realConf.map(confCard).join("")}

    <h3 class="lg-h">Corroborations (${corrob.length})</h3>
    <p class="lg-sub">Points where independent speakers or the record agree — equally important for weighing the rest.</p>
    ${corrob.map(confCard).join("")}

    <h3 class="lg-h">Ground truth benchmarks</h3>
    <p class="lg-sub">Record facts used as the comparison baseline for speaker statements.</p>
    ${gtHtml}

    <h3 class="lg-h">Speaker coverage and retrieval gaps</h3>
    <p class="lg-sub">How complete the statement capture is per person, and where more retrieval is needed.</p>
    ${peopleHtml}

    <h3 class="lg-h">Full ledger by speaker</h3>
    <p class="lg-sub">Chronological per person, with program timecodes where available. Amber rows appear in a conflict above.</p>
    ${personHtml}
  `;
}

/* ======================= INVESTIGATION PRIORITIES TAB ======================= */
async function loadPriorities() {
  const root = document.getElementById("priorities-root");
  if (!root) return;
  let d;
  try { d = await fetch("data/investigation_priorities.json?v=20").then(r => r.json()); } catch { root.innerHTML = '<p class="placeholder">Investigation priorities data not yet available.</p>'; return; }

  const items = d.items || [];
  const topFive = d.top_five || [];
  const biometric = d.biometric_control || {};

  const tierColors = {
    1: "#e05252", 2: "#e09a52", 3: "#e8b84b", 4: "#6ea8e0",
    5: "#c98be0", 6: "#52c7c1", 7: "#9aa1b1", 8: "#4ea1ff",
    9: "#35c46b", 10: "#e05a5a", 11: "#9b7de0", 12: "#7a7f8c"
  };

  const tiers = {};
  items.forEach(item => {
    if (!tiers[item.tier]) tiers[item.tier] = { name: item.tier_name, items: [] };
    tiers[item.tier].items.push(item);
  });

  const topFiveHtml = topFive.map((t, i) => `
    <div class="prio-top-card">
      <span class="prio-top-n">#${i+1}</span>
      <div>
        <h4>${t.title}</h4>
        <p>${t.rationale}</p>
      </div>
    </div>`).join("");

  const biometricHtml = biometric.title ? `
    <div class="prio-biometric">
      <h3>${biometric.title}</h3>
      <p>${biometric.description || ""}</p>
      ${biometric.comparison_chain ? `<div class="prio-chain">${biometric.comparison_chain.join(" → ")}</div>` : ""}
      ${biometric.advantages ? `<ul>${biometric.advantages.map(a => `<li>${a}</li>`).join("")}</ul>` : ""}
    </div>` : "";

  const tierSections = Object.entries(tiers).sort((a,b) => +a[0] - +b[0]).map(([tier, data]) => {
    const color = tierColors[tier] || "#9aa1b1";
    const itemCards = data.items.map(item => {
      const prioColor = item.priority === "high" ? "#e05252" : item.priority === "medium" ? "#e8b84b" : "#52c7c1";
      return `
        <div class="prio-item">
          <span class="prio-id">${item.id}</span>
          <div class="prio-item-body">
            <div class="prio-item-head">
              <strong>${item.title}</strong>
              <span class="prio-badge" style="background:${prioColor}">${item.priority}</span>
            </div>
            <p>${item.detail}</p>
          </div>
        </div>`;
    }).join("");
    return `
      <details class="prio-tier" open>
        <summary style="border-left-color:${color}">
          <span class="prio-tier-label" style="color:${color}">Tier ${tier}</span>
          <span class="prio-tier-name">${data.name}</span>
          <span class="prio-tier-count">${data.items.length} items</span>
        </summary>
        <div class="prio-tier-items">${itemCards}</div>
      </details>`;
  }).join("");

  const highCount = items.filter(i => i.priority === "high").length;
  const medCount = items.filter(i => i.priority === "medium").length;
  const lowCount = items.filter(i => i.priority === "low").length;

  root.innerHTML = `
    <div class="panel-intro">
      <strong>150 investigative items organized by tier, derived from July 2026 preliminary hearing evidence.</strong>
      These represent angles that are either new, underdeveloped, or gained significance after testimony.
      The top five highest-payoff angles are highlighted first.
    </div>

    <div class="stat-row">
      <div class="stat-tile"><div class="num">${items.length}</div><div class="label">Total items</div></div>
      <div class="stat-tile grade-c"><div class="num">${highCount}</div><div class="label">High priority</div></div>
      <div class="stat-tile grade-b"><div class="num">${medCount}</div><div class="label">Medium priority</div></div>
      <div class="stat-tile grade-a"><div class="num">${lowCount}</div><div class="label">Lower priority</div></div>
      <div class="stat-tile"><div class="num">${Object.keys(tiers).length}</div><div class="label">Investigation tiers</div></div>
    </div>

    <div class="prio-top-section">
      <h3>Top 5 highest-payoff angles</h3>
      ${topFiveHtml}
    </div>

    ${biometricHtml}

    <h3 class="assess-h">All investigation items by tier</h3>
    ${tierSections}
  `;
}

/* ======================= VEHICLE ANALYSIS TAB ======================= */
async function loadVehicles() {
  const root = document.getElementById("vehicles-root");
  if (!root) return;
  let d;
  try { d = await fetch("data/vehicle_analysis.json?v=20").then(r => r.json()); } catch { root.innerHTML = '<p class="placeholder">Vehicle analysis data not yet available.</p>'; return; }

  const confirmed = d.robinsons_confirmed_vehicle || {};
  const survVehicles = (d.surveillance_vehicles || []).map(v => `
    <div class="va-surv-card">
      <h5>${v.id} — ${v.source}</h5>
      <table class="reg-table">
        <tr><th>Color</th><td>${v.color || "—"}</td></tr>
        <tr><th>Wheels</th><td>${v.wheels || "—"}</td></tr>
        ${v.front_bumper ? `<tr><th>Front bumper</th><td>${v.front_bumper}</td></tr>` : ""}
        ${v.rear ? `<tr><th>Rear</th><td>${v.rear}</td></tr>` : ""}
        ${v.notes ? `<tr><th>Notes</th><td>${v.notes}</td></tr>` : ""}
      </table>
    </div>`).join("");

  const discrepancies = (d.key_discrepancies || []).map(disc => `
    <div class="va-disc-card">
      <h4>${disc.category}</h4>
      <p>${disc.detail}</p>
    </div>`).join("");

  const person = d.person_comparison || {};
  const recs = (d.recommendations || []).map(r => `<li>${r}</li>`).join("");

  root.innerHTML = `
    <div class="panel-intro warn">
      <strong>${d.title || "Dodge Challenger Vehicle Analysis"}</strong> — ${d.summary || ""}
    </div>

    <div class="va-section">
      <h3>Robinson's confirmed vehicle (driveway photo)</h3>
      <div class="va-confirmed">
        <table class="reg-table">
          <tr><th>Description</th><td>${confirmed.description || "—"}</td></tr>
          <tr><th>Wheels</th><td><strong>${confirmed.wheels || "—"}</strong></td></tr>
          <tr><th>Front plate</th><td>${confirmed.front_plate || "—"}</td></tr>
          <tr><th>Appearance</th><td>${confirmed.appearance || "—"}</td></tr>
          <tr><th>Source</th><td>${confirmed.source || "—"}</td></tr>
        </table>
      </div>
    </div>

    <div class="va-section">
      <h3>Surveillance footage vehicles</h3>
      <p class="demo-lede">Each entry below represents a distinct vehicle appearance in the surveillance footage. Differences in wheel style, color, and trim suggest multiple Challengers may be present.</p>
      ${survVehicles}
    </div>

    <div class="va-section">
      <h3>Key discrepancies</h3>
      <div class="va-disc-grid">${discrepancies}</div>
    </div>

    <div class="va-section">
      <h3>Person comparison observations</h3>
      <div class="va-person-grid">
        ${person.surveillance_black_shirt ? `
        <div class="va-person-card" style="border-left-color:#4ea1ff">
          <h4>Surveillance — black eagle/flag shirt</h4>
          <table class="reg-table">
            <tr><th>Clothing</th><td>${person.surveillance_black_shirt.clothing}</td></tr>
            <tr><th>Accessories</th><td>${person.surveillance_black_shirt.accessories}</td></tr>
            <tr><th>Build</th><td>${person.surveillance_black_shirt.build}</td></tr>
          </table>
        </div>` : ""}
        ${person.surveillance_red_shirt ? `
        <div class="va-person-card" style="border-left-color:#e05252">
          <h4>Surveillance — red/maroon shirt</h4>
          <table class="reg-table">
            <tr><th>Clothing</th><td>${person.surveillance_red_shirt.clothing}</td></tr>
            <tr><th>Accessories</th><td>${person.surveillance_red_shirt.accessories}</td></tr>
            <tr><th>Distinguishing</th><td><strong>${person.surveillance_red_shirt.distinguishing}</strong></td></tr>
            <tr><th>Note</th><td>${person.surveillance_red_shirt.note}</td></tr>
          </table>
        </div>` : ""}
      </div>
      ${person.distortion_concern ? `
      <div class="va-distortion">
        <h4>Aspect ratio / distortion concern</h4>
        <p>${person.distortion_concern}</p>
      </div>` : ""}
    </div>

    <div class="bottom-line">
      <h3>Conclusion</h3>
      <p>${d.conclusion || ""}</p>
    </div>

    ${recs ? `
    <div class="records-needed">
      <strong>Recommendations for further analysis:</strong>
      <ul>${recs}</ul>
    </div>` : ""}
  `;
}

/* ======================= LATEST ASSESSMENT TAB ======================= */
async function loadLatestAssessment() {
  const root = document.getElementById("latest-root");
  if (!root) return;
  let d;
  try { d = await fetch("data/latest_assessment.json?v=98").then(r => r.json()); } catch { root.innerHTML = '<p class="placeholder">Latest assessment data not yet available.</p>'; return; }

  const oa = d.overall_assessment || {};
  const confItems = [
    { label: "Robinson as shooter", range: oa.confidence_shooter || "—", pct: 90 },
    { label: "Operating alone at scene", range: oa.confidence_alone_at_scene || "—", pct: 85 },
    { label: "Self-directed planning", range: oa.confidence_self_directed || "—", pct: 77 },
    { label: "Ideological motive", range: oa.confidence_ideological_motive || "—", pct: 60 },
    { label: "Conspiracy involvement", range: oa.confidence_conspiracy || "—", pct: 8, inverted: true },
    { label: "Security failure", range: oa.confidence_security_failure || "—", pct: 97 },
  ];

  const confBars = confItems.map(c => {
    const lo = parseInt(c.range) || 0;
    const parts = c.range.match(/(\d+)/g) || [lo];
    const hi = parts.length > 1 ? parseInt(parts[1]) : lo + 10;
    const color = c.inverted ? "#52c7c1" : (c.pct >= 85 ? "#e05252" : c.pct >= 70 ? "#e8b84b" : "#6ea8e0");
    return `
      <div class="conf-row">
        <div class="conf-label">${c.label}</div>
        <div class="conf-track">
          <div class="conf-bar" style="left:${lo}%;width:${hi-lo}%;background:${color}"></div>
          <span class="conf-range">${c.range}</span>
        </div>
      </div>`;
  }).join("");

  const streams = (d.evidence_streams || []).map(s => `
    <tr>
      <th>${s.stream || s.name || "—"}</th>
      <td>${s.detail || s.description || "—"}${s.weakness ? `<div class="stream-weak"><strong>Weakness:</strong> ${s.weakness}</div>` : ""}</td>
    </tr>`).join("");

  const anomalies = (d.genuine_anomalies || []).map(a => `
    <div class="anomaly-card sev-${a.severity || 2}">
      <div class="anomaly-head">
        <h4>${a.title || a.issue || "—"}</h4>
        <span class="anomaly-status">${a.status || "unresolved"}</span>
      </div>
      <p class="anomaly-finding">${a.finding || a.detail || a.description || "—"}</p>
    </div>`).join("");

  const sec = d.security_failure || {};
  const secFacts = (sec.facts || sec.details || []).map(f => `<li>${f}</li>`).join("");

  const changes = (d.what_would_change_conclusion || []).map(w => `<li>${w}</li>`).join("");

  const k9 = d.k9_rifle_search || {};
  const k9Records = (k9.what_would_resolve || []).map(r => `<li>${r}</li>`).join("");

  const gt = d.google_trends_assessment || {};
  const gtExpl = (gt.ranking || gt.explanations || []).map((e, i) => `
    <div class="trends-expl">
      <span class="te-rank">${i+1}</span>
      <div><h5>${e.title || e.explanation || "—"}</h5><p>${e.detail || e.body || ""}</p></div>
    </div>`).join("");

  root.innerHTML = `
    <div class="panel-intro">
      <strong>Updated case assessment as of ${oa.date || "August 2026"}.</strong>
      This reflects analysis incorporating July 2026 preliminary-hearing evidence.
      Confidence ranges are evidentiary judgments, not courtroom probabilities.
    </div>

    <div class="assess-headline">
      <h3>Central conclusion</h3>
      <p>${oa.conclusion || "—"}</p>
    </div>

    <h3 class="assess-h">Confidence ranking</h3>
    <div class="conf-block">${confBars}</div>

    ${streams ? `
    <h3 class="assess-h">Converging evidence streams</h3>
    <p class="demo-lede">The identity case rests on several largely independent evidence streams. No single one is dispositive; their convergence is what creates the weight.</p>
    <table class="reg-table stream-table">${streams}</table>` : ""}

    ${anomalies ? `
    <h3 class="assess-h">Genuine anomalies — ${(d.genuine_anomalies||[]).length} logged</h3>
    <p class="demo-lede">Legitimate forensic and procedural problems, not internet inventions.</p>
    ${anomalies}` : ""}

    ${sec.facts || sec.details ? `
    <h3 class="assess-h">UVU security failure</h3>
    <div class="security-block">
      <ul class="security-facts">${secFacts}</ul>
      ${sec.harpole_claim ? `<div class="security-warn"><strong>Pre-event warning claim:</strong> ${sec.harpole_claim}</div>` : ""}
      ${sec.butler_comparison ? `<div class="security-counter"><strong>Butler control case:</strong> ${sec.butler_comparison}</div>` : ""}
    </div>` : ""}

    ${k9.claim ? `
    <h3 class="assess-h">K9 / rifle search question</h3>
    <div class="va-distortion">
      <p><strong>Claim:</strong> ${k9.claim}</p>
      <table class="reg-table">
        <tr><th>Verification</th><td>${k9.current_verification || "—"}</td></tr>
        <tr><th>Importance if verified</th><td>${k9.importance_if_verified || "—"}</td></tr>
        <tr><th>Ordinary explanations</th><td>${k9.ordinary_explanations ? "Yes" : "No"}</td></tr>
        <tr><th>Planting implication</th><td>${k9.planting_implication_if_strongest_version_proven || "—"}</td></tr>
      </table>
      ${k9Records ? `<div class="records-needed"><strong>Records that would resolve it:</strong><ul>${k9Records}</ul></div>` : ""}
    </div>` : ""}

    ${gtExpl ? `
    <h3 class="assess-h">Google Trends assessment</h3>
    <p class="demo-lede">Explanations ranked from most to least likely for the reported Israel/DC search anomalies.</p>
    ${gtExpl}` : ""}

    ${changes ? `
    <h3 class="assess-h">What would change this conclusion</h3>
    <div class="would-change"><ul>${changes}</ul></div>` : ""}

    <div class="next-milestone">
      <h4>Next milestone — September 1, 2026</h4>
      <p><strong>Final preliminary-hearing arguments.</strong> The defense's integrated explanation of why discrepancies matter, rather than isolated cross-examination points.</p>
    </div>
  `;
}

loadCaseMap();
loadClaims();
loadSources();
loadTimeline();
loadConduct();
loadAviationTracker();
loadFlightMethods();
initNormalizationDemo();
loadAssessment();
loadNetwork();
loadContested();
loadContradictions();
loadFactCheck();
loadPersonTimelines();
loadSimulation();
loadLedger();
loadDeepDives();
loadPriorities();
loadVehicles();
loadLatestAssessment();
