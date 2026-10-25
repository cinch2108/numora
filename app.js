"use strict";
(() => {
const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
const BASE = (document.body && document.body.dataset.base) || ""; // sub-folder prefix, set by build.js
const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
const fmt = (n, d = 2) => !isFinite(n) ? "—" : Math.abs(n) >= 1e15 || (Math.abs(n) < 1e-6 && n !== 0) ? n.toExponential(4) : n.toLocaleString(undefined, { maximumFractionDigits: d });
const money = n => !isFinite(n) ? "—" : n.toLocaleString(undefined, { style: "currency", currency: CUR(), maximumFractionDigits: 2 });
const CUR = () => store.get("cur") || "USD";
const clampNum = (v, min = -1e15, max = 1e15) => { const n = parseFloat(String(v).replace(/,/g, "")); return isFinite(n) ? Math.min(max, Math.max(min, n)) : NaN; };
const store = { get: k => { try { return JSON.parse(localStorage.getItem("numora:" + k)); } catch { return null; } }, set: (k, v) => { try { localStorage.setItem("numora:" + k, JSON.stringify(v)); } catch {} } };

// ---------- safe math expression parser (no eval) ----------
function evaluate(src, deg) {
  if (src.length > 500) throw Error("Expression too long");
  const toks = []; const re = /\s*(\d+\.?\d*(?:e[+-]?\d+)?|\.\d+|[a-zπ]+|\*\*|[-+*/^%()!,×÷])/giy; let m, pos = 0;
  while (pos < src.length) { re.lastIndex = pos; m = re.exec(src); if (!m) { if (/^\s*$/.test(src.slice(pos))) break; throw Error("Unexpected “" + src[pos] + "”"); } toks.push(m[1].replace("×", "*").replace("÷", "/").replace("**", "^")); pos = re.lastIndex; }
  let i = 0; const peek = () => toks[i], eat = t => { if (toks[i] === t) { i++; return true; } return false; };
  const toR = x => deg ? x * Math.PI / 180 : x, frR = x => deg ? x * 180 / Math.PI : x;
  const fact = n => { if (n < 0 || n > 170 || n % 1) return n % 1 ? gamma(n + 1) : NaN; let r = 1; for (let k = 2; k <= n; k++) r *= k; return r; };
  const gamma = z => { const g = 7, c = [0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61502916214059, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7]; if (z < .5) return Math.PI / (Math.sin(Math.PI * z) * gamma(1 - z)); z--; let x = c[0]; for (let k = 1; k < 9; k++) x += c[k] / (z + k); const t = z + g + .5; return Math.sqrt(2 * Math.PI) * t ** (z + .5) * Math.exp(-t) * x; };
  const F = { sin: x => Math.sin(toR(x)), cos: x => Math.cos(toR(x)), tan: x => Math.tan(toR(x)), asin: x => frR(Math.asin(x)), acos: x => frR(Math.acos(x)), atan: x => frR(Math.atan(x)), sqrt: Math.sqrt, cbrt: Math.cbrt, ln: Math.log, log: Math.log10, log2: Math.log2, abs: Math.abs, exp: Math.exp, round: Math.round, floor: Math.floor, ceil: Math.ceil, sinh: Math.sinh, cosh: Math.cosh, tanh: Math.tanh };
  const C = { pi: Math.PI, "π": Math.PI, e: Math.E, phi: (1 + Math.sqrt(5)) / 2 };
  const expr = () => { let v = term(); for (;;) { if (eat("+")) v += term(); else if (eat("-")) v -= term(); else return v; } };
  const term = () => { let v = unary(); for (;;) { if (eat("*")) v *= unary(); else if (eat("/")) v /= unary(); else if (eat("%")) v %= unary(); else if (peek() === "(" || (peek() && /^[a-zπ\d.]/i.test(peek()))) v *= unary(); else return v; } };
  const unary = () => eat("-") ? -unary() : eat("+") ? unary() : power();
  const power = () => { const b = postfix(); return eat("^") ? b ** unary() : b; };
  const postfix = () => { let v = atom(); while (eat("!")) v = fact(v); return v; };
  const atom = () => { const t = toks[i++]; if (t == null) throw Error("Incomplete expression");
    if (t === "(") { const v = expr(); if (!eat(")")) throw Error("Missing )"); return v; }
    if (/^[\d.]/.test(t)) return parseFloat(t);
    const k = t.toLowerCase(); if (k in C) return C[k];
    if (k in F) { if (!eat("(")) throw Error(k + " needs ( )"); const v = expr(); if (!eat(")")) throw Error("Missing )"); return F[k](v); }
    throw Error("Unknown “" + t + "”"); };
  const v = expr(); if (i < toks.length) throw Error("Unexpected “" + toks[i] + "”"); return v;
}

// ---------- unit data ----------
const UNITS = {
  Length: { m: 1, km: 1e3, cm: .01, mm: .001, "µm": 1e-6, nm: 1e-9, mi: 1609.344, yd: .9144, ft: .3048, in: .0254, "nautical mi": 1852, "light-year": 9.4607e15 },
  Mass: { kg: 1, g: .001, mg: 1e-6, "metric ton": 1000, lb: .45359237, oz: .028349523, stone: 6.35029318, "US ton": 907.18474, carat: .0002 },
  Temperature: { "°C": "c", "°F": "f", K: "k" },
  Volume: { L: 1, mL: .001, "m³": 1000, "US gal": 3.785411784, "US qt": .946352946, "US pt": .473176473, "US cup": .2365882365, "US fl oz": .0295735296, tbsp: .0147867648, tsp: .00492892159, "imp gal": 4.54609, "ft³": 28.316846592, "in³": .016387064 },
  Area: { "m²": 1, "km²": 1e6, "cm²": 1e-4, hectare: 1e4, acre: 4046.8564224, "ft²": .09290304, "in²": .00064516, "mi²": 2589988.110336, "yd²": .83612736 },
  Speed: { "m/s": 1, "km/h": 1 / 3.6, mph: .44704, knot: .514444, "ft/s": .3048, mach: 343 },
  Time: { s: 1, ms: .001, min: 60, h: 3600, day: 86400, week: 604800, month: 2629746, year: 31556952 },
  Data: { B: 1, KB: 1e3, MB: 1e6, GB: 1e9, TB: 1e12, KiB: 1024, MiB: 1048576, GiB: 1073741824, TiB: 1099511627776, bit: .125 },
  Pressure: { Pa: 1, kPa: 1e3, bar: 1e5, atm: 101325, psi: 6894.757, mmHg: 133.322, inHg: 3386.39 },
  Energy: { J: 1, kJ: 1e3, cal: 4.184, kcal: 4184, Wh: 3600, kWh: 3.6e6, BTU: 1055.06, eV: 1.602176634e-19 },
  Power: { W: 1, kW: 1e3, MW: 1e6, hp: 745.699872, "BTU/h": .29307107 },
  Angle: { degree: 1, radian: 180 / Math.PI, gradian: .9, turn: 360, arcminute: 1 / 60, arcsecond: 1 / 3600 },
  "Fuel economy": { "mpg (US)": "mpg", "mpg (UK)": "mpguk", "km/L": "kml", "L/100km": "l100" }
};
const tempTo = (v, f, t) => { const c = f === "c" ? v : f === "f" ? (v - 32) * 5 / 9 : v - 273.15; return t === "c" ? c : t === "f" ? c * 9 / 5 + 32 : c + 273.15; };
const fuelTo = (v, f, t) => { const kml = f === "kml" ? v : f === "mpg" ? v * .425144 : f === "mpguk" ? v * .354006 : 100 / v; return t === "kml" ? kml : t === "mpg" ? kml / .425144 : t === "mpguk" ? kml / .354006 : 100 / kml; };
function convert(cat, v, a, b) { const U = UNITS[cat]; if (cat === "Temperature") return tempTo(v, U[a], U[b]); if (cat === "Fuel economy") return fuelTo(v, U[a], U[b]); return v * U[a] / U[b]; }

// ---------- calculator definitions ----------
const today = () => new Date().toISOString().slice(0, 10);
const N = (id, label, def, o = {}) => ({ id, label, def, type: "number", ...o });
const CALCS = [
 // Finance
 { id: "loan", cat: "Finance", icon: "🏦", name: "Loan & Mortgage", desc: "Monthly payment, total interest and a full amortization schedule.",
   inputs: [N("p", "Loan amount", 300000, { pre: "$" }), N("r", "Interest rate (APR)", 6.5, { suf: "%" }), N("y", "Term", 30, { suf: "years" }), N("x", "Extra monthly payment", 0, { pre: "$" }), N("t", "Property tax + insurance / month", 0, { pre: "$" })],
   run: ({ p, r, y, x, t }) => { const n = Math.round(y * 12), i = r / 1200; const pay = i ? p * i / (1 - (1 + i) ** -n) : p / n; let bal = p, tot = 0, k = 0; const rows = [];
     while (bal > .005 && k < 1200) { const int = bal * i; let prin = Math.min(bal, pay - int + (x || 0)); if (prin <= 0) return { error: "The payment doesn't cover the interest." }; bal -= prin; tot += int; k++; if (k % 12 === 0 || bal <= .005) rows.push([Math.ceil(k / 12), money(tot), money(Math.max(0, bal))]); }
     return { big: money(pay + (x || 0) + (t || 0)), bigLabel: "Monthly payment", items: [["Principal & interest", money(pay)], ["Total interest", money(tot)], ["Total paid", money(p + tot)], ["Paid off in", `${Math.floor(k / 12)} yr ${k % 12} mo`], x ? ["Interest saved by extra payments", money(pay * n - p - tot)] : null], table: { head: ["Year", "Interest so far", "Balance"], rows }, chart: [["Principal", p], ["Interest", tot]] }; } },
 { id: "compound", cat: "Finance", icon: "📈", name: "Compound Interest", desc: "See how savings and investments grow with regular contributions.",
   inputs: [N("p", "Starting amount", 10000, { pre: "$" }), N("c", "Monthly contribution", 500, { pre: "$" }), N("r", "Annual return", 7, { suf: "%" }), N("y", "Years", 20), { id: "f", label: "Compounding", type: "select", def: "12", opts: [["1", "Yearly"], ["4", "Quarterly"], ["12", "Monthly"], ["365", "Daily"]] }],
   run: ({ p, c, r, y, f }) => { const per = +f, rate = r / 100; let bal = p, contrib = p; const rows = []; for (let m = 1; m <= y * 12; m++) { bal *= (1 + rate / per) ** (per / 12); bal += c; contrib += c; if (m % 12 === 0) rows.push([m / 12, money(contrib), money(bal - contrib), money(bal)]); }
     return { big: money(bal), bigLabel: `Balance after ${y} years`, items: [["Total contributed", money(contrib)], ["Interest earned", money(bal - contrib)]], table: { head: ["Year", "Contributed", "Interest", "Balance"], rows }, chart: [["Contributions", contrib], ["Interest", bal - contrib]] }; } },
 { id: "savings", cat: "Finance", icon: "🎯", name: "Savings Goal", desc: "How much to save each month to reach a target by a deadline.",
   inputs: [N("g", "Goal", 25000, { pre: "$" }), N("s", "Already saved", 2000, { pre: "$" }), N("y", "Years to goal", 3), N("r", "Annual interest", 4, { suf: "%" })],
   run: ({ g, s, y, r }) => { const n = y * 12, i = r / 1200, fv = s * (1 + i) ** n, need = i ? (g - fv) * i / ((1 + i) ** n - 1) : (g - s) / n; return { big: money(Math.max(0, need)), bigLabel: "Save per month", items: [["Total you deposit", money(Math.max(0, need) * n + s)], ["Interest helps with", money(Math.max(0, g - Math.max(0, need) * n - s))]] }; } },
 { id: "tip", cat: "Finance", icon: "🍽️", name: "Tip & Bill Split", desc: "Split a bill with tip between any number of people.",
   inputs: [N("b", "Bill", 86.5, { pre: "$" }), N("t", "Tip", 18, { suf: "%" }), N("n", "People", 4), { id: "rd", label: "Round each share up", type: "check", def: false }],
   run: ({ b, t, n, rd }) => { const tip = b * t / 100, tot = b + tip; let each = tot / Math.max(1, n); if (rd) each = Math.ceil(each); return { big: money(each), bigLabel: "Each person pays", items: [["Tip", money(tip)], ["Total", money(rd ? each * n : tot)]] }; } },
 { id: "discount", cat: "Finance", icon: "🏷️", name: "Discount & Sales Tax", desc: "Final price after a discount and tax, plus how much you save.",
   inputs: [N("p", "Original price", 120, { pre: "$" }), N("d", "Discount", 25, { suf: "%" }), N("d2", "Extra discount (stacked)", 0, { suf: "%" }), N("t", "Sales tax", 8.25, { suf: "%" })],
   run: ({ p, d, d2, t }) => { const after = p * (1 - d / 100) * (1 - d2 / 100), fin = after * (1 + t / 100); return { big: money(fin), bigLabel: "You pay", items: [["Price after discounts", money(after)], ["Tax", money(fin - after)], ["You save", money(p - after)], ["Effective discount", fmt((1 - after / p) * 100) + "%"]] }; } },
 { id: "salary", cat: "Finance", icon: "💼", name: "Salary ↔ Hourly", desc: "Convert pay between hourly, weekly, monthly and yearly.",
   inputs: [N("a", "Amount", 25, { pre: "$" }), { id: "per", label: "Per", type: "select", def: "h", opts: [["h", "Hour"], ["d", "Day"], ["w", "Week"], ["m", "Month"], ["y", "Year"]] }, N("hw", "Hours per week", 40), N("wy", "Weeks worked per year", 52)],
   run: ({ a, per, hw, wy }) => { const y = { h: a * hw * wy, d: a * 5 * wy, w: a * wy, m: a * 12, y: a }[per]; return { big: money(y), bigLabel: "Per year", items: [["Per month", money(y / 12)], ["Per week", money(y / wy)], ["Per day (5-day week)", money(y / wy / 5)], ["Per hour", money(y / wy / hw)]] }; } },
 { id: "roi", cat: "Finance", icon: "💹", name: "ROI & Profit Margin", desc: "Return on investment, annualized return, margin and markup.",
   inputs: [N("c", "Cost / invested", 1000, { pre: "$" }), N("v", "Revenue / final value", 1450, { pre: "$" }), N("y", "Years held (optional)", 2)],
   run: ({ c, v, y }) => ({ big: fmt((v - c) / c * 100) + "%", bigLabel: "ROI", items: [["Profit", money(v - c)], ["Annualized return", y > 0 ? fmt(((v / c) ** (1 / y) - 1) * 100) + "%" : "—"], ["Profit margin", fmt((v - c) / v * 100) + "%"], ["Markup", fmt((v - c) / c * 100) + "%"]] }) },
 { id: "inflation", cat: "Finance", icon: "🎈", name: "Inflation", desc: "What money today is worth in the future, or was worth in the past.",
   inputs: [N("a", "Amount", 100, { pre: "$" }), N("r", "Average inflation", 3, { suf: "%/yr" }), N("y", "Years", 10)],
   run: ({ a, r, y }) => ({ big: money(a * (1 + r / 100) ** y), bigLabel: `Cost of the same things in ${y} years`, items: [["Buying power of today's amount then", money(a / (1 + r / 100) ** y)], ["Total price increase", fmt(((1 + r / 100) ** y - 1) * 100) + "%"]] }) },
 { id: "debt", cat: "Finance", icon: "💳", name: "Credit Card Payoff", desc: "How long it takes to pay off a balance and what it costs.",
   inputs: [N("b", "Balance", 5000, { pre: "$" }), N("r", "APR", 22.9, { suf: "%" }), N("p", "Monthly payment", 200, { pre: "$" })],
   run: ({ b, r, p }) => { const i = r / 1200; if (p <= b * i) return { error: "The payment is too small to ever pay this off." }; const n = -Math.log(1 - b * i / p) / Math.log(1 + i), m = Math.ceil(n); return { big: `${Math.floor(m / 12)} yr ${m % 12} mo`, bigLabel: "Time to pay off", items: [["Total interest", money(p * n - b)], ["Total paid", money(p * n)]] }; } },
 // Health
 { id: "bmi", cat: "Health", icon: "⚖️", name: "BMI", desc: "Body Mass Index with category and healthy weight range.",
   inputs: [{ id: "u", label: "Units", type: "select", def: "i", opts: [["i", "US (lb, in)"], ["m", "Metric (kg, cm)"]] }, N("w", "Weight", 165), N("h", "Height", 69)],
   run: ({ u, w, h }) => { const kg = u === "i" ? w * .45359237 : w, m = (u === "i" ? h * 2.54 : h) / 100, b = kg / m / m; const cat = b < 18.5 ? "Underweight" : b < 25 ? "Healthy" : b < 30 ? "Overweight" : "Obese"; const lo = 18.5 * m * m, hi = 24.9 * m * m, cv = x => u === "i" ? fmt(x / .45359237, 0) + " lb" : fmt(x, 1) + " kg"; return { big: fmt(b, 1), bigLabel: cat, items: [["Healthy weight for your height", `${cv(lo)} – ${cv(hi)}`]], gauge: { v: b, min: 15, max: 40, marks: [18.5, 25, 30] } }; } },
 { id: "calories", cat: "Health", icon: "🔥", name: "Calories (BMR & TDEE)", desc: "Daily calories to maintain, lose, or gain weight.",
   inputs: [{ id: "s", label: "Sex", type: "select", def: "m", opts: [["m", "Male"], ["f", "Female"]] }, N("a", "Age", 30), { id: "u", label: "Units", type: "select", def: "i", opts: [["i", "US (lb, in)"], ["m", "Metric (kg, cm)"]] }, N("w", "Weight", 165), N("h", "Height", 69), { id: "act", label: "Activity", type: "select", def: "1.55", opts: [["1.2", "Sedentary"], ["1.375", "Light (1–3 days/wk)"], ["1.55", "Moderate (3–5 days/wk)"], ["1.725", "Very active"], ["1.9", "Athlete"]] }],
   run: ({ s, a, u, w, h, act }) => { const kg = u === "i" ? w * .45359237 : w, cm = u === "i" ? h * 2.54 : h, bmr = 10 * kg + 6.25 * cm - 5 * a + (s === "m" ? 5 : -161), t = bmr * act; return { big: fmt(t, 0) + " kcal", bigLabel: "To maintain weight", items: [["BMR (at rest)", fmt(bmr, 0) + " kcal"], ["Lose 0.5 lb / 0.25 kg per week", fmt(t - 250, 0) + " kcal"], ["Lose 1 lb / 0.5 kg per week", fmt(t - 500, 0) + " kcal"], ["Gain 0.5 lb / 0.25 kg per week", fmt(t + 250, 0) + " kcal"], ["Protein (1.6 g/kg)", fmt(kg * 1.6, 0) + " g"]] }; } },
 { id: "bodyfat", cat: "Health", icon: "📏", name: "Body Fat (US Navy)", desc: "Estimate body fat from a few tape measurements.",
   inputs: [{ id: "s", label: "Sex", type: "select", def: "m", opts: [["m", "Male"], ["f", "Female"]] }, N("h", "Height", 69, { suf: "in" }), N("n", "Neck", 15, { suf: "in" }), N("w", "Waist", 34, { suf: "in" }), N("hp", "Hip (women only)", 38, { suf: "in" })],
   run: ({ s, h, n, w, hp }) => { const bf = s === "m" ? 86.010 * Math.log10(w - n) - 70.041 * Math.log10(h) + 36.76 : 163.205 * Math.log10(w + hp - n) - 97.684 * Math.log10(h) - 78.387; return { big: fmt(bf, 1) + "%", bigLabel: "Estimated body fat" }; } },
 { id: "pace", cat: "Health", icon: "🏃", name: "Running Pace", desc: "Pace, finish time, and speed for any distance.",
   inputs: [N("d", "Distance", 5), { id: "u", label: "Unit", type: "select", def: "km", opts: [["km", "km"], ["mi", "miles"]] }, N("hh", "Hours", 0), N("mm", "Minutes", 27), N("ss", "Seconds", 30)],
   run: ({ d, u, hh, mm, ss }) => { const t = hh * 3600 + mm * 60 + ss, km = u === "km" ? d : d * 1.609344, p = s => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, "0")}`; return { big: p(t / km) + " /km", bigLabel: "Pace", items: [["Pace per mile", p(t / (km / 1.609344)) + " /mi"], ["Speed", fmt(km / t * 3600, 2) + " km/h · " + fmt(km / 1.609344 / t * 3600, 2) + " mph"], ["Marathon at this pace", new Date(t / km * 42.195 * 1000).toISOString().slice(11, 19)]] }; } },
 { id: "water", cat: "Health", icon: "💧", name: "Water Intake", desc: "A daily water target based on weight and exercise.",
   inputs: [N("w", "Weight", 165, { suf: "lb" }), N("e", "Exercise per day", 30, { suf: "min" })],
   run: ({ w, e }) => { const oz = w * .5 + e / 30 * 12; return { big: fmt(oz, 0) + " fl oz", bigLabel: "Per day", items: [["In liters", fmt(oz * .0295735, 1) + " L"], ["8-oz glasses", fmt(oz / 8, 0)]] }; } },
 // Math
 { id: "percent", cat: "Math", icon: "％", name: "Percentage", desc: "Percent of, percent change, and \"X is what % of Y\".",
   inputs: [N("a", "Value A", 45), N("b", "Value B", 180)],
   run: ({ a, b }) => ({ big: fmt(a / b * 100, 4) + "%", bigLabel: "A is this percent of B", items: [["A% of B", fmt(a / 100 * b, 4)], ["Change from A to B", fmt((b - a) / Math.abs(a) * 100, 4) + "%"], ["Difference (percent of average)", fmt(Math.abs(a - b) / ((a + b) / 2) * 100, 4) + "%"], ["B increased by A%", fmt(b * (1 + a / 100), 4)], ["B decreased by A%", fmt(b * (1 - a / 100), 4)]] }) },
 { id: "stats", cat: "Math", icon: "📊", name: "Statistics", desc: "Mean, median, mode, standard deviation, quartiles and more.",
   inputs: [{ id: "d", label: "Numbers (separate with commas, spaces or new lines)", type: "text", def: "12, 15, 15, 18, 21, 24, 30, 42" }],
   run: ({ d }) => { const a = String(d).split(/[\s,;]+/).map(Number).filter(isFinite).slice(0, 100000).sort((x, y) => x - y); if (!a.length) return { error: "Enter at least one number." }; const n = a.length, sum = a.reduce((s, x) => s + x, 0), mean = sum / n, q = p => { const k = (n - 1) * p, f = Math.floor(k); return a[f] + (a[Math.min(n - 1, f + 1)] - a[f]) * (k - f); }, v = a.reduce((s, x) => s + (x - mean) ** 2, 0); const cnt = {}; let mo = [], best = 0; a.forEach(x => { cnt[x] = (cnt[x] || 0) + 1; if (cnt[x] > best) best = cnt[x]; }); for (const k in cnt) if (cnt[k] === best && best > 1) mo.push(k);
     return { big: fmt(mean, 4), bigLabel: "Mean (average)", items: [["Count", n], ["Sum", fmt(sum, 4)], ["Median", fmt(q(.5), 4)], ["Mode", mo.length ? mo.join(", ") : "None"], ["Min / Max", `${fmt(a[0], 4)} / ${fmt(a[n - 1], 4)}`], ["Range", fmt(a[n - 1] - a[0], 4)], ["Std. deviation (sample)", n > 1 ? fmt(Math.sqrt(v / (n - 1)), 4) : "—"], ["Std. deviation (population)", fmt(Math.sqrt(v / n), 4)], ["Q1 / Q3", `${fmt(q(.25), 4)} / ${fmt(q(.75), 4)}`]] }; } },
 { id: "fraction", cat: "Math", icon: "➗", name: "Fractions", desc: "Add, subtract, multiply and divide fractions, simplified.",
   inputs: [N("a", "Numerator 1", 3), N("b", "Denominator 1", 4), { id: "op", label: "Operation", type: "select", def: "+", opts: [["+", "+"], ["-", "−"], ["*", "×"], ["/", "÷"]] }, N("c", "Numerator 2", 5), N("d", "Denominator 2", 6)],
   run: ({ a, b, op, c, d }) => { if (!b || !d) return { error: "Denominators can't be zero." }; let n, m; if (op === "+") { n = a * d + c * b; m = b * d; } else if (op === "-") { n = a * d - c * b; m = b * d; } else if (op === "*") { n = a * c; m = b * d; } else { n = a * d; m = b * c; } if (!m) return { error: "Division by zero." }; const g = (x, y) => y ? g(y, x % y) : Math.abs(x), k = g(n, m) || 1; n /= k; m /= k; if (m < 0) { n = -n; m = -m; } const w = Math.trunc(n / m), r = Math.abs(n % m); return { big: m === 1 ? String(n) : `${n}/${m}`, bigLabel: "Simplified", items: [["Mixed number", r && w ? `${w} ${r}/${m}` : m === 1 ? String(n) : `${n}/${m}`], ["Decimal", fmt(n / m, 8)]] }; } },
 { id: "ratio", cat: "Math", icon: "⚖", name: "Ratio & Proportion", desc: "Solve A : B = C : ? and simplify ratios.",
   inputs: [N("a", "A", 3), N("b", "B", 4), N("c", "C", 15)],
   run: ({ a, b, c }) => { const g = (x, y) => y ? g(y, x % y) : x, k = Number.isInteger(a) && Number.isInteger(b) ? g(Math.abs(a), Math.abs(b)) || 1 : 1; return { big: fmt(b * c / a, 6), bigLabel: `${fmt(a)} : ${fmt(b)} = ${fmt(c)} : ?`, items: [["Simplified A : B", `${a / k} : ${b / k}`], ["A / B", fmt(a / b, 6)]] }; } },
 { id: "random", cat: "Math", icon: "🎲", name: "Random Number", desc: "Cryptographically secure random numbers, with or without repeats.",
   inputs: [N("lo", "Min", 1), N("hi", "Max", 100), N("n", "How many", 1), { id: "u", label: "No repeats", type: "check", def: true }],
   run: ({ lo, hi, n, u }) => { lo = Math.ceil(lo); hi = Math.floor(hi); n = Math.min(10000, Math.max(1, Math.floor(n))); const span = hi - lo + 1; if (span < 1) return { error: "Max must be at least Min." }; if (u && n > span) return { error: "Not enough numbers in the range for no repeats." }; const rnd = () => { const b = new Uint32Array(1), lim = Math.floor(4294967296 / span) * span; let x; do { crypto.getRandomValues(b); x = b[0]; } while (x >= lim); return lo + x % span; }; const out = new Set(), arr = []; while (arr.length < n) { const x = rnd(); if (u) { if (out.has(x)) continue; out.add(x); } arr.push(x); } return { big: arr.length === 1 ? String(arr[0]) : arr.slice(0, 500).join(", "), bigLabel: arr.length > 500 ? "First 500 shown" : "Result", noAuto: true }; } },
 { id: "gpa", cat: "Math", icon: "🎓", name: "Grade & Final Exam", desc: "What you need on the final to get the grade you want.",
   inputs: [N("c", "Current grade", 85, { suf: "%" }), N("t", "Grade you want", 88, { suf: "%" }), N("w", "Final exam weight", 30, { suf: "%" })],
   run: ({ c, t, w }) => { const need = (t - c * (1 - w / 100)) / (w / 100); return { big: fmt(need, 1) + "%", bigLabel: need > 100 ? "Needed on the final (above 100%, so it's out of reach)" : "Needed on the final" }; } },
 // Date & time
 { id: "age", cat: "Date & Time", icon: "🎂", name: "Age", desc: "Exact age in years, months and days, plus your next birthday.",
   inputs: [{ id: "b", label: "Date of birth", type: "date", def: "1995-06-15" }, { id: "on", label: "Age on", type: "date", def: today() }],
   run: ({ b, on }) => { const d1 = new Date(b + "T00:00"), d2 = new Date(on + "T00:00"); if (isNaN(d1) || isNaN(d2) || d2 < d1) return { error: "Check the dates." }; let y = d2.getFullYear() - d1.getFullYear(), m = d2.getMonth() - d1.getMonth(), d = d2.getDate() - d1.getDate(); if (d < 0) { m--; d += new Date(d2.getFullYear(), d2.getMonth(), 0).getDate(); } if (m < 0) { y--; m += 12; } const days = Math.round((d2 - d1) / 864e5); let nb = new Date(d2.getFullYear(), d1.getMonth(), d1.getDate()); if (nb <= d2) nb.setFullYear(nb.getFullYear() + 1); return { big: `${y} years`, bigLabel: `${y} years, ${m} months, ${d} days`, items: [["Total months", fmt(y * 12 + m, 0)], ["Total weeks", fmt(days / 7, 0)], ["Total days", fmt(days, 0)], ["Next birthday in", fmt(Math.round((nb - d2) / 864e5), 0) + " days"], ["Born on a", d1.toLocaleDateString(undefined, { weekday: "long" })]] }; } },
 { id: "datediff", cat: "Date & Time", icon: "📅", name: "Days Between Dates", desc: "Count calendar days, weekdays and weeks between two dates.",
   inputs: [{ id: "a", label: "Start date", type: "date", def: today() }, { id: "b", label: "End date", type: "date", def: new Date(Date.now() + 90 * 864e5).toISOString().slice(0, 10) }, { id: "inc", label: "Include the end date", type: "check", def: false }],
   run: ({ a, b, inc }) => { let d1 = new Date(a + "T00:00"), d2 = new Date(b + "T00:00"); if (isNaN(d1) || isNaN(d2)) return { error: "Check the dates." }; const sign = d2 < d1 ? -1 : 1; if (sign < 0) [d1, d2] = [d2, d1]; let days = Math.round((d2 - d1) / 864e5) + (inc ? 1 : 0), wd = 0; const cur = new Date(d1); for (let k = 0; k < days && k < 40000; k++) { const g = cur.getDay(); if (g && g < 6) wd++; cur.setDate(cur.getDate() + 1); } return { big: fmt(days * sign, 0) + " days", bigLabel: "Between the dates", items: [["Weekdays (Mon–Fri)", fmt(wd, 0)], ["Weeks", `${Math.floor(days / 7)} weeks ${days % 7} days`], ["Hours", fmt(days * 24, 0)]] }; } },
 { id: "dateadd", cat: "Date & Time", icon: "➕", name: "Add or Subtract Days", desc: "Find the date a number of days, weeks or months from another.",
   inputs: [{ id: "a", label: "Start date", type: "date", def: today() }, N("n", "Amount", 30), { id: "u", label: "Unit", type: "select", def: "d", opts: [["d", "Days"], ["bd", "Business days"], ["w", "Weeks"], ["m", "Months"], ["y", "Years"]] }],
   run: ({ a, n, u }) => { const d = new Date(a + "T00:00"); if (isNaN(d)) return { error: "Check the date." }; n = Math.trunc(n); if (u === "d") d.setDate(d.getDate() + n); else if (u === "w") d.setDate(d.getDate() + 7 * n); else if (u === "m") d.setMonth(d.getMonth() + n); else if (u === "y") d.setFullYear(d.getFullYear() + n); else { let k = Math.abs(n); const s = Math.sign(n); while (k > 0) { d.setDate(d.getDate() + s); if (d.getDay() % 6) k--; } } return { big: d.toLocaleDateString(undefined, { weekday: "long", year: "numeric", month: "long", day: "numeric" }), bigLabel: "Result" }; } },
 { id: "hours", cat: "Date & Time", icon: "⏱️", name: "Work Hours", desc: "Hours between two times minus breaks, and pay for the shift.",
   inputs: [{ id: "s", label: "Start", type: "time", def: "09:00" }, { id: "e", label: "End", type: "time", def: "17:30" }, N("b", "Unpaid break", 30, { suf: "min" }), N("r", "Hourly rate (optional)", 0, { pre: "$" })],
   run: ({ s, e, b, r }) => { const t = x => { const [h, m] = String(x).split(":").map(Number); return h * 60 + m; }; let m = t(e) - t(s); if (m < 0) m += 1440; m -= b; return { big: `${Math.floor(m / 60)}h ${m % 60}m`, bigLabel: "Worked", items: [["Decimal hours", fmt(m / 60, 2)], r ? ["Pay", money(m / 60 * r)] : null] }; } },
 // Everyday
 { id: "fuel", cat: "Everyday", icon: "⛽", name: "Trip Fuel Cost", desc: "What a drive costs in fuel, split between passengers.",
   inputs: [N("d", "Distance", 350, { suf: "mi" }), N("e", "Fuel economy", 28, { suf: "mpg" }), N("p", "Fuel price", 3.45, { pre: "$", suf: "/gal" }), N("n", "People splitting", 1), { id: "rt", label: "Round trip", type: "check", def: false }],
   run: ({ d, e, p, n, rt }) => { const dist = d * (rt ? 2 : 1), gal = dist / e, cost = gal * p; return { big: money(cost), bigLabel: "Fuel cost", items: [["Fuel needed", fmt(gal, 1) + " gal"], ["Per person", money(cost / Math.max(1, n))], ["Cost per mile", money(cost / dist)]] }; } },
 { id: "unitprice", cat: "Everyday", icon: "🛒", name: "Unit Price Compare", desc: "Which package is the better deal per unit.",
   inputs: [N("p1", "Item A price", 4.99, { pre: "$" }), N("q1", "Item A quantity", 16), N("p2", "Item B price", 7.49, { pre: "$" }), N("q2", "Item B quantity", 28)],
   run: ({ p1, q1, p2, q2 }) => { const a = p1 / q1, b = p2 / q2, w = a < b ? "A" : b < a ? "B" : "Neither"; return { big: w === "Neither" ? "Same price" : `Item ${w} is cheaper`, bigLabel: w === "Neither" ? "Per unit" : `by ${fmt(Math.abs(a - b) / Math.max(a, b) * 100, 1)}% per unit`, items: [["Item A per unit", money(a)], ["Item B per unit", money(b)]] }; } },
 { id: "electric", cat: "Everyday", icon: "💡", name: "Electricity Cost", desc: "Running cost of any device per day, month and year.",
   inputs: [N("w", "Power", 150, { suf: "watts" }), N("h", "Hours per day", 5), N("r", "Price", 0.16, { pre: "$", suf: "/kWh" })],
   run: ({ w, h, r }) => { const d = w / 1000 * h * r; return { big: money(d * 30.44), bigLabel: "Per month", items: [["Per day", money(d)], ["Per year", money(d * 365)], ["Energy per year", fmt(w / 1000 * h * 365, 0) + " kWh"]] }; } },
 { id: "password", cat: "Everyday", icon: "🔐", name: "Password Generator", desc: "Strong random passwords made on your device and never sent anywhere.",
   inputs: [N("l", "Length", 20), { id: "up", label: "Uppercase", type: "check", def: true }, { id: "di", label: "Numbers", type: "check", def: true }, { id: "sy", label: "Symbols", type: "check", def: true }, { id: "am", label: "Skip look-alikes (0 O l 1)", type: "check", def: false }],
   run: ({ l, up, di, sy, am }) => { l = Math.min(256, Math.max(4, Math.floor(l))); let cs = "abcdefghijkmnopqrstuvwxyz" + (am ? "" : "l"); if (up) cs += "ABCDEFGHJKLMNPQRSTUVWXYZ" + (am ? "" : "IO"); if (di) cs += "23456789" + (am ? "" : "01"); if (sy) cs += "!@#$%^&*()-_=+[]{};:,.?"; const lim = Math.floor(4294967296 / cs.length) * cs.length, b = new Uint32Array(1); let out = ""; while (out.length < l) { crypto.getRandomValues(b); if (b[0] < lim) out += cs[b[0] % cs.length]; } const bits = l * Math.log2(cs.length); return { big: out, bigLabel: `${fmt(bits, 0)} bits of entropy · ${bits >= 80 ? "very strong" : bits >= 60 ? "strong" : "weak"}`, mono: true, noAuto: true }; } },
];
const SPECIAL = [
 { id: "scientific", cat: "Math", icon: "🧮", name: "Scientific Calculator", desc: "Type any expression, with trig, logs, powers, roots and factorials." },
 { id: "units", cat: "Converters", icon: "🔁", name: "Unit Converter", desc: `${Object.keys(UNITS).length} categories and ${Object.values(UNITS).reduce((s, u) => s + Object.keys(u).length, 0)} units, converted all at once.` },
];
const ALL = [...SPECIAL, ...CALCS];
const CATS = ["All", "Finance", "Health", "Math", "Date & Time", "Converters", "Everyday"];

// ---------- home ----------
let curCat = "All";
function renderHome() {
  const q = $("#search").value.trim().toLowerCase(), grid = $("#grid"); grid.replaceChildren();
  const recent = (store.get("recent") || []).filter(id => ALL.some(c => c.id === id));
  const list = ALL.filter(c => (curCat === "All" || c.cat === curCat) && (!q || (c.name + " " + c.desc + " " + c.cat).toLowerCase().includes(q)));
  if (!q && curCat === "All" && recent.length) list.sort((a, b) => (recent.indexOf(b.id) > -1) - (recent.indexOf(a.id) > -1));
  list.forEach((c, i) => { const a = el("a", "tile"); a.href = BASE + "/" + c.id + "/"; a.append(el("span", "ti", c.icon), el("b", null, c.name), el("p", null, c.desc), el("small", null, c.cat + (recent.includes(c.id) ? " · recent" : ""))); grid.append(a); if (i === 5) grid.append(adSlot("in-grid", "rect")); });
  if (!list.length) grid.append(el("p", "empty", "Nothing matches that. Try “loan”, “bmi” or “convert”."));
  $("#count").textContent = `${list.length} tools`;
}
function adSlot(name, size) { const d = el("div", "ad ad-" + size); d.dataset.slot = name; d.append(el("span", null, "Advertisement")); return d; }
CATS.forEach(c => { const b = el("button", "pill" + (c === "All" ? " on" : ""), c); b.type = "button"; b.addEventListener("click", () => { curCat = c; $$(".pill").forEach(p => p.classList.toggle("on", p === b)); renderHome(); }); $("#cats").append(b); });
$("#search").addEventListener("input", renderHome);
$("#search").addEventListener("keydown", e => { if (e.key === "Enter") { const t = $(".tile"); if (t) location.href = t.getAttribute("href"); } });
document.addEventListener("keydown", e => { if (e.key === "/" && document.activeElement.tagName !== "INPUT" && document.activeElement.tagName !== "TEXTAREA") { e.preventDefault(); if (PAGE_TOOL) { location.href = BASE + "/"; return; } if (location.hash) location.hash = ""; setTimeout(() => $("#search").focus()); } });

// ---------- calculator view ----------
function openCalc(id) {
  const c = ALL.find(x => x.id === id); if (!c) return showHome();
  const r = (store.get("recent") || []).filter(x => x !== id); r.unshift(id); store.set("recent", r.slice(0, 8));
  $("#home").hidden = true; $("#calc").hidden = false; window.scrollTo(0, 0);
  if (!PAGE_TOOL) document.title = `${c.name} · Numora`;
  $("#c-icon").textContent = c.icon; $("#c-name").textContent = c.name; $("#c-desc").textContent = c.desc; $("#c-cat").textContent = c.cat;
  const form = $("#c-form"), out = $("#c-out"); form.replaceChildren(); out.replaceChildren();
  if (id === "scientific") return buildSci(form, out);
  if (id === "units") return buildUnits(form, out);
  const params = new URLSearchParams(location.hash.split("?")[1] || "");
  c.inputs.forEach(f => {
    const wrap = el("label", "field" + (f.type === "check" ? " check" : "") + (f.type === "text" ? " wide" : "")); const lab = el("span", "lab", f.label); let inp;
    const pv = params.get(f.id), val = pv != null ? (f.type === "check" ? pv === "1" : pv.slice(0, 2000)) : f.def;
    if (f.type === "select") { inp = el("select"); f.opts.forEach(([v, t]) => { const o = el("option", null, t); o.value = v; inp.append(o); }); inp.value = val; }
    else if (f.type === "check") { inp = el("input"); inp.type = "checkbox"; inp.checked = !!val; }
    else if (f.type === "text") { inp = el("textarea"); inp.rows = 3; inp.maxLength = 200000; inp.value = val; }
    else { inp = el("input"); inp.type = f.type === "number" ? "text" : f.type; inp.inputMode = "decimal"; inp.autocomplete = "off"; inp.spellcheck = false; inp.value = val; if (f.type === "number") inp.maxLength = 24; }
    inp.id = "f-" + f.id; inp.addEventListener("input", () => compute(c)); inp.addEventListener("change", () => compute(c));
    if (f.type === "check") wrap.append(inp, lab); else { const box = el("div", "inbox"); if (f.pre) box.append(el("i", "pre", f.pre === "$" ? curSym() : f.pre)); box.append(inp); if (f.suf) box.append(el("i", "suf", f.suf)); wrap.append(lab, box); }
    form.append(wrap);
  });
  if (c.noAuto) { const b = el("button", "btn", "Generate again"); b.type = "button"; b.addEventListener("click", () => compute(c)); form.append(b); }
  compute(c);
}
const curSym = () => (0).toLocaleString(undefined, { style: "currency", currency: CUR() }).replace(/[\d.,\s]/g, "") || "$";
function read(c) { const v = {}; c.inputs.forEach(f => { const e = $("#f-" + f.id); v[f.id] = f.type === "check" ? e.checked : f.type === "number" ? clampNum(e.value) : e.value; }); return v; }
function compute(c) {
  const v = read(c), out = $("#c-out"); out.replaceChildren();
  const bad = c.inputs.find(f => f.type === "number" && !isFinite(v[f.id]));
  if (bad) { out.append(el("div", "err", `Enter a number for “${bad.label}”.`)); return; }
  let r; try { r = c.run(v); } catch (e) { r = { error: "Something about those inputs doesn't work." }; }
  if (r.error) { out.append(el("div", "err", r.error)); return; }
  const hero = el("div", "hero-res"); hero.append(el("small", null, r.bigLabel || "Result")); const big = el("div", "big" + (r.mono ? " mono" : ""), r.big); hero.append(big);
  const tools = el("div", "rtools"); const cp = el("button", "chip", "Copy result"); cp.type = "button"; cp.addEventListener("click", () => copy(r.big)); const sh = el("button", "chip", "Copy share link"); sh.type = "button";
  sh.addEventListener("click", () => { const p = new URLSearchParams(); c.inputs.forEach(f => { if (c.id === "password") return; const e = $("#f-" + f.id); p.set(f.id, f.type === "check" ? (e.checked ? "1" : "0") : e.value); }); const u = location.origin + BASE + "/" + c.id + "/#" + c.id + (p.toString() ? "?" + p : ""); copy(u, "Link copied"); });
  tools.append(cp); if (c.id !== "password") tools.append(sh); hero.append(tools); out.append(hero);
  if (r.gauge) { const g = r.gauge, gb = el("div", "gauge"); const pct = x => Math.min(100, Math.max(0, (x - g.min) / (g.max - g.min) * 100)); const dot = el("i", "dot"); dot.style.left = pct(g.v) + "%"; gb.append(dot); g.marks.forEach(m => { const t = el("b", null, m); t.style.left = pct(m) + "%"; gb.append(t); }); out.append(gb); }
  if (r.items) { const dl = el("dl", "items"); r.items.filter(Boolean).forEach(([k, val]) => { const row = el("div"); row.append(el("dt", null, k), el("dd", null, String(val))); dl.append(row); }); out.append(dl); }
  if (r.chart) { const tot = r.chart.reduce((s, x) => s + x[1], 0), bar = el("div", "split"), leg = el("div", "legend"); r.chart.forEach(([k, val], i) => { const s = el("i", "s" + i); s.style.width = (val / tot * 100) + "%"; bar.append(s); const l = el("span", "l" + i, `${k} ${fmt(val / tot * 100, 0)}%`); leg.append(l); }); out.append(bar, leg); }
  if (r.table && r.table.rows.length) { const det = el("details", "tbl"); det.append(el("summary", null, `Show yearly breakdown (${r.table.rows.length} rows)`)); const t = el("table"), hr = el("tr"); r.table.head.forEach(h => hr.append(el("th", null, h))); t.append(hr); r.table.rows.forEach(row => { const tr = el("tr"); row.forEach(x => tr.append(el("td", null, String(x)))); t.append(tr); }); const csv = el("button", "chip", "Download CSV"); csv.type = "button"; csv.addEventListener("click", () => download(c.id + ".csv", [r.table.head, ...r.table.rows].map(rw => rw.map(x => `"${String(x).replace(/"/g, '""')}"`).join(",")).join("\n"))); det.append(t, csv); out.append(det); }
}
function buildSci(form, out) {
  const wrap = el("div", "sci"), inp = el("input", "sci-in"); inp.placeholder = "e.g. 2^10 + sqrt(144) * sin(30)"; inp.autocomplete = "off"; inp.spellcheck = false; inp.maxLength = 500; inp.value = store.get("sci") || "";
  const res = el("div", "sci-res", "0"), mode = el("button", "chip", store.get("deg") === false ? "RAD" : "DEG"); mode.type = "button";
  const hist = el("ul", "hist"); const H = () => store.get("scihist") || [];
  const showHist = () => { hist.replaceChildren(); H().forEach(([e, v]) => { const li = el("li"); li.append(el("span", null, e), el("b", null, "= " + v)); li.addEventListener("click", () => { inp.value = e; run(); inp.focus(); }); hist.append(li); }); };
  const run = () => { store.set("sci", inp.value); if (!inp.value.trim()) { res.textContent = "0"; res.classList.remove("bad"); return null; } try { const v = evaluate(inp.value, mode.textContent === "DEG"); res.textContent = "= " + fmt(v, 12); res.classList.remove("bad"); return v; } catch (e) { res.textContent = e.message; res.classList.add("bad"); return null; } };
  const commit = () => { const v = run(); if (v == null || !isFinite(v)) return; const h = H().filter(x => x[0] !== inp.value); h.unshift([inp.value, fmt(v, 12)]); store.set("scihist", h.slice(0, 12)); showHist(); };
  inp.addEventListener("input", run); inp.addEventListener("keydown", e => { if (e.key === "Enter") commit(); });
  mode.addEventListener("click", () => { mode.textContent = mode.textContent === "DEG" ? "RAD" : "DEG"; store.set("deg", mode.textContent === "DEG"); run(); });
  const keys = ["sin(", "cos(", "tan(", "π", "e", "(", ")", "^", "sqrt(", "ln(", "log(", "!", "7", "8", "9", "÷", "4", "5", "6", "×", "1", "2", "3", "−", "0", ".", "%", "+", "C", "⌫", "ans", "="]; const pad = el("div", "pad");
  keys.forEach(k => { const b = el("button", "key" + (/^[\d.]$/.test(k) ? " num" : k === "=" ? " eq" : ""), k); b.type = "button"; b.addEventListener("click", () => { if (k === "=") commit(); else if (k === "C") inp.value = ""; else if (k === "⌫") inp.value = inp.value.slice(0, -1); else if (k === "ans") { const h = H()[0]; if (h) inp.value += "(" + h[1].replace(/,/g, "") + ")"; } else inp.value += k === "−" ? "-" : k; run(); inp.focus(); }); pad.append(b); });
  const top = el("div", "sci-top"); top.append(inp, mode); wrap.append(top, res, pad); form.append(wrap); const hh = el("div", "hero-res"); hh.append(el("small", null, "History (click to reuse)"), hist); out.append(hh); showHist(); run(); inp.focus();
}
function buildUnits(form, out) {
  const cat = el("select"), val = el("input"), from = el("select"); val.inputMode = "decimal"; val.maxLength = 24; val.value = "1";
  Object.keys(UNITS).forEach(k => { const o = el("option", null, k); o.value = k; cat.append(o); });
  const fill = () => { from.replaceChildren(); Object.keys(UNITS[cat.value]).forEach(u => { const o = el("option", null, u); o.value = u; from.append(o); }); go(); };
  const go = () => { out.replaceChildren(); const v = clampNum(val.value); if (!isFinite(v)) { out.append(el("div", "err", "Enter a number.")); return; } const grid = el("div", "conv"); Object.keys(UNITS[cat.value]).forEach(u => { if (u === from.value) return; const r = convert(cat.value, v, from.value, u), b = el("button", "cv"); b.type = "button"; b.append(el("b", null, fmt(r, 8)), el("span", null, u)); b.addEventListener("click", () => copy(String(r), `Copied ${fmt(r, 8)} ${u}`)); grid.append(b); }); const h = el("div", "hero-res"); h.append(el("small", null, `${fmt(v, 8)} ${from.value} equals (click any to copy)`), grid); out.append(h); };
  const mk = (l, i) => { const w = el("label", "field"); w.append(el("span", "lab", l)); const b = el("div", "inbox"); b.append(i); w.append(b); form.append(w); };
  mk("Category", cat); mk("Value", val); mk("From", from);
  cat.addEventListener("change", fill); from.addEventListener("change", go); val.addEventListener("input", go); fill();
}
function copy(t, msg = "Copied") { (navigator.clipboard ? navigator.clipboard.writeText(t) : Promise.reject()).then(() => toast(msg), () => toast("Couldn't copy here")); }
function download(name, text) { const a = el("a"); a.href = URL.createObjectURL(new Blob([text], { type: "text/csv" })); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 3000); }
let tt; function toast(m) { const t = $("#toast"); t.textContent = m; t.classList.add("on"); clearTimeout(tt); tt = setTimeout(() => t.classList.remove("on"), 1800); }
function showHome() { $("#home").hidden = false; $("#calc").hidden = true; renderHome(); }
const PAGE_TOOL = document.body.dataset.tool || "";
function route() { if (document.body.dataset.doc) return; const id = PAGE_TOOL || location.hash.slice(1).split("?")[0]; if (id && /^[a-z]+$/.test(id)) openCalc(id); else showHome(); }
window.addEventListener("hashchange", route);
$("#c-form").addEventListener("submit", e => e.preventDefault());
$("#back").addEventListener("click", () => { location.href = BASE + "/"; });

// theme + currency
const setTheme = t => { document.documentElement.dataset.theme = t; store.set("theme", t); $("#theme").textContent = t === "light" ? "🌙" : "☀️"; };
setTheme(store.get("theme") || (matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark"));
$("#theme").addEventListener("click", () => setTheme(document.documentElement.dataset.theme === "light" ? "dark" : "light"));
["USD", "EUR", "GBP", "INR", "CAD", "AUD", "JPY", "CNY", "MXN", "BRL", "CHF", "ZAR"].forEach(c => { const o = el("option", null, c); o.value = c; $("#cur").append(o); });
$("#cur").value = CUR(); $("#cur").addEventListener("change", e => { store.set("cur", e.target.value); route(); });
// cookie / ad consent (ads load only after a choice; non-personalized if rejected)
const consent = store.get("consent");
window.numoraConsent = () => store.get("consent");
if (!consent) { const bar = el("div", "consent"); bar.setAttribute("role", "dialog"); bar.setAttribute("aria-label", "Cookie consent"); const t = el("p"); t.append("We use cookies only to show ads that keep Numora free. Your calculations never leave your device. "); const a = el("a", null, "Privacy policy"); a.href = BASE + "/privacy/"; t.append(a); const acc = el("button", "btn sm", "Accept"), rej = el("button", "chip", "Only necessary"); [acc, rej].forEach(b => b.type = "button"); const done = v => { store.set("consent", { ads: v, at: Date.now() }); bar.remove(); document.dispatchEvent(new CustomEvent("numora:consent", { detail: v })); }; acc.addEventListener("click", () => done(true)); rej.addEventListener("click", () => done(false)); const bx = el("div", "cbtns"); bx.append(rej, acc); bar.append(t, bx); document.body.append(bar); }
$("#year").textContent = new Date().getFullYear();
route();

})();
