# Purchase Indents – IIT Jodhpur

Fills the Office of Stores and Purchase indent forms and generates the PDF in the browser:

- **SP01**: Non-Consumable Items
- **SP02**: Consumable Items

Everything runs client-side with [jsPDF](https://github.com/parallax/jsPDF) and jspdf-autotable (loaded from cdnjs). Nothing is uploaded or stored.

## Use

Serve the folder and open http://localhost:8000:

```
npm start        # or: python3 -m http.server 8000
```

Opening `index.html` directly via `file://` can block the logo from loading into the PDF.

## Files

- `index.html`: the forms and their styles
- `script.js`: form behaviour and PDF generation
- `iitj_logo.png`: logo printed in the PDF header

## Test

```
npm install
npm test
```

Renders both forms in Node and checks page counts (SP02 = 1 page, SP01 = 4 pages). Update `test.js` if you change the layout on purpose.
