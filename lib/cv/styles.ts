export const cvFontPath = "/fonts/inter-4.1-cv.woff2";
export const cvFontFace = (source: string) => `@font-face {
  font-family: "Jobvion CV"; font-weight: 100 900; font-style: normal;
  src: url("${source}") format("woff2");
}`;

export const cvStyles = `
.cv-sheet {
  --cv-paper: #ffffff;
  --cv-text: #182532;
  --cv-muted: #455560;
  --cv-rule: #d2dce0;
  --cv-font: "Jobvion CV", Arial, sans-serif;
  --cv-page-width: 210mm;
  --cv-page-height: 297mm;
  color: var(--cv-text);
  background: var(--cv-paper);
  font-family: var(--cv-font);
  width: var(--cv-page-width);
  min-height: var(--cv-page-height);
  padding: 15mm 16mm;
  font-size: 10.5pt;
  line-height: 1.42;
  box-sizing: border-box;
  overflow-wrap: anywhere;
  text-align: left;
  font-variant-ligatures: none;
  color-scheme: light;
}
.cv-sheet.cv-paper-Letter { --cv-page-width: 8.5in; --cv-page-height: 11in; }
.cv-sheet *, .cv-sheet *::before, .cv-sheet *::after { box-sizing: border-box; }
.cv-sheet :is(p, h1, h2, h3) { margin: 0; white-space: pre-wrap; }
.cv-sheet :is(h1, h2, h3) { font-family: var(--cv-font); color: var(--cv-accent); font-weight: 650; letter-spacing: 0; text-wrap: wrap; }
.cv-sheet h1 { font-size: 30pt; line-height: 1.1; letter-spacing: -.04em; }
.cv-sheet h2 { font-size: 12pt; line-height: 1.25; margin-bottom: .5em; break-after: avoid; }
.cv-sheet h3 { font-size: 10.75pt; line-height: 1.3; break-after: avoid; }
.cv-sheet .cv-role { margin-top: .45em; font-size: 14pt; }
.cv-sheet :is(.cv-contact, .cv-meta) { color: var(--cv-muted); font-size: 9pt; }
.cv-sheet .cv-contact { margin-top: .6em; }
.cv-sheet .cv-doc-header { padding-bottom: 1.2em; margin-bottom: 1.2em; border-bottom: 1px solid var(--cv-rule); break-inside: avoid; }
.cv-sheet .cv-photo-header { display: grid; grid-template-columns: minmax(0, 1fr) 25mm; gap: 7mm; align-items: start; }
.cv-sheet .cv-portrait { width: 25mm; height: 30mm; object-fit: cover; display: block; }
.cv-sheet .cv-section { margin-bottom: 1.05em; }
.cv-sheet .cv-entry { break-inside: avoid; margin-bottom: .72em; }
.cv-sheet .cv-entry :is(.cv-meta, h3) + p { margin-top: .2em; }
.cv-sheet .cv-doc-columns { display: grid; gap: 7mm; align-items: start; }
.cv-sheet.cv-layout-left .cv-doc-columns { grid-template-columns: minmax(0, 31%) minmax(0, 1fr); }
.cv-sheet.cv-layout-left .cv-doc-columns > div:first-child { grid-column: 2; grid-row: 1; }
.cv-sheet.cv-layout-left .cv-aside { grid-column: 1; grid-row: 1; padding-inline-end: 3mm; border-inline-end: 1px solid var(--cv-rule); }
.cv-sheet.cv-layout-right .cv-doc-columns { grid-template-columns: minmax(0, 1fr) minmax(0, 29%); }
.cv-sheet.cv-layout-right .cv-aside { padding-inline-start: 3mm; border-inline-start: 1px solid var(--cv-rule); }
.cv-sheet.cv-head-center .cv-doc-header { text-align: center; }
.cv-sheet.cv-head-hero .cv-doc-header { border-top: 5px solid var(--cv-accent); padding-top: 1.3em; }
.cv-sheet.cv-head-wide .cv-doc-header { border-bottom: 2px solid var(--cv-accent); padding-bottom: 1.5em; }
.cv-sheet.cv-head-boxed .cv-doc-header { border: 1px solid var(--cv-accent); padding: 1.1em; }
.cv-sheet.cv-label-line h2 { border-bottom: 1px solid var(--cv-rule); padding-bottom: .3em; }
.cv-sheet.cv-label-bar h2 { border-inline-start: 3px solid var(--cv-accent); padding-inline-start: .55em; }
.cv-sheet.cv-label-smallcaps h2 { font-weight: 750; letter-spacing: .1em; font-size: 10pt; text-transform: uppercase; }
.cv-sheet.cv-label-block h2 { background: color-mix(in srgb, var(--cv-accent) 8%, var(--cv-paper)); padding: .35em .55em; }
.cv-sheet.cv-type-modern { font-size: 10pt; line-height: 1.33; }
.cv-sheet.cv-type-modern h1 { font-size: 27pt; font-weight: 760; letter-spacing: -.05em; }
.cv-sheet.cv-type-editorial h1 { font-weight: 470; font-size: 34pt; letter-spacing: -.055em; }
.cv-sheet.cv-type-editorial h2 { font-weight: 530; font-size: 13pt; }
`;
