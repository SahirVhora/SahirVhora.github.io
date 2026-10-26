# Interactive resume

A dependency-free resume for Sahir Vhora, designed for GitHub Pages at `/resume/`.

## Preview

From the repository root:

```sh
python3 -m http.server 8765 --bind 127.0.0.1
```

Open `http://127.0.0.1:8765/resume/`.

## Verify

```sh
python3 resume/check.py
node --test resume/app.test.cjs
node --check resume/app.js
git diff --check
```

There is no package installation or build step. HTML contains the complete resume, including when JavaScript is disabled.

## Content and maintenance

Edit `index.html` for employment, qualifications and projects. Edit `style.css` for the layout and print presentation. `app.js` controls the illustration, active navigation and printing.

Employment and education came from the owner's supplied LinkedIn export on 26 October 2026. The owner corrected the transition dates: Capgemini began August 2024; Deloitte ended August 2024. Earlier HR ABAP work is summarized without invented dates. Certifications show historical issue dates, not a claim of current certification status. Project links and screenshots come from the existing public portfolio. Hindi proficiency comes from the public LinkedIn profile.

No client names, confidential delivery figures, private testimonials, tracking, analytics, remote scripts or contact forms are included. The visual is CSS 3D artwork, not a WebGL game. Motion can be paused and respects the operating system's reduced-motion preference.

Use **Print resume** and the browser's **Save as PDF** option for a document version. Printing expands role details and restores their previous states afterward.
