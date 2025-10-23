// src/formatPrinterText.ts
// Parser: markup -> ESC/POS bytes
// Trả về Uint8Array sẵn để gửi qua transferOut

export function formatPrinterText(input: string): Uint8Array {
  const ESC = 0x1b;
  const GS = 0x1d;
  const LF = 0x0a;
  const encoder = new TextEncoder();

  const bytes: number[] = [];

  // helpers
  const pushText = (text: string) => {
    const arr = Array.from(encoder.encode(text));
    bytes.push(...arr);
  };
  const push = (...vals: number[]) => bytes.push(...vals);

  // alignment: [L] [C] [R]
  const setAlign = (tag: "L" | "C" | "R") => {
    const val = tag === "L" ? 0 : tag === "C" ? 1 : 2;
    push(ESC, 0x61, val); // ESC a n
  };

  // font size: GS ! n  (n: bit mask: bit0..2 height, bit4..6 width)
  const setFontSize = (size: string) => {
    // map sizes to GS ! n values (common mapping)
    const map: Record<string, number> = {
      normal: 0x00,
      wide: 0x10,
      tall: 0x01,
      big: 0x11, // double width & height
      "big-2": 0x22, // 3x? approximated
      "big-3": 0x33,
      "big-4": 0x44,
      "big-5": 0x55,
      "big-6": 0x66,
      "big-7": 0x77,
    };
    const n = map[size] ?? 0x00;
    push(GS, 0x21, n);
  };

  const resetFontSize = () => push(GS, 0x21, 0x00);

  // bold on/off: ESC E n
  const setBold = (on: boolean) => push(ESC, 0x45, on ? 1 : 0);

  // underline: ESC - n  (n = 0 off, 1 single, 2 double)
  const setUnderline = (type: 0 | 1 | 2) => push(ESC, 0x2d, type);

  // barcode helpers (CODE128)
  const printBarcodeCODE128 = (code: string, opts?: { width?: number; height?: number; hri?: number }) => {
    const width = opts?.width ?? 3; // GS w n (1..6)
    const height = opts?.height ?? 100; // GS h n (1..255)
    const hri = opts?.hri ?? 2; // GS H n (0 none 1 above 2 below 3 both) - many printers: 2 = below

    // set HRI position
    push(GS, 0x48, hri);
    // set width
    push(GS, 0x77, width);
    // set height
    push(GS, 0x68, height);
    const dataBytes = Array.from(encoder.encode(code));
    push(GS, 0x6b, 0x49, dataBytes.length, ...dataBytes);
    push(LF);
  };

  // QR code helpers using common ESC/POS sequence
  // const printQRCode = (content: string, size = 6, ecc = 48 ) => {
  //   // 1) set module size: GS ( k pL pH 49 67 n
  //   push(GS, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x43, size);
  //   // 2) set error correction level: GS ( k 03 00 49 45 n
  //   // n=48..51 (48=L,49=M,50=Q,51=H) -> choose 49 (M) commonly; user can override ecc param
  //   push(GS, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x45, ecc);
  //   // 3) store data in symbol storage area: GS ( k pL pH 49 80 48 <data>
  //   const data = Array.from(encoder.encode(content));
  //   const len = data.length + 3;
  //   const pL = len & 0xff;
  //   const pH = (len >> 8) & 0xff;
  //   push(GS, 0x28, 0x6b, pL, pH, 0x31, 0x50, 0x30, ...data);
  //   // 4) print QR code: GS ( k 03 00 49 81 48
  //   push(GS, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x51, 0x30);
  //   push(LF);
  // };

  const printQRCode = (content: string, size = 6, ecc = 48) => {
    const data = Array.from(encoder.encode(unescape(encodeURIComponent(content))));
    const len = data.length + 3;
    const pL = len & 0xff;
    const pH = (len >> 8) & 0xff;
    // module size
    push(GS, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x43, size);
    // error correction
    push(GS, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x45, ecc);
    // store data
    push(GS, 0x28, 0x6b, pL, pH, 0x31, 0x50, 0x30, ...data);
    // print QR
    push(GS, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x51, 0x30);
    // flush
    push(LF, LF);
  };


  // image: assume <img> tag contains a hexadecimal string produced by your converter
  // The string should already be in "raster bytes" format (packed bits per row).
  // We'll send it as a raster bit image with GS v 0.
  // For safety, we implement a simple wrapper: ALIGN then send raw bytes as-is.
  // NOTE: If you want to convert a bitmap (width,height,bitmap) -> raster we must implement conversion.
  const printImageFromHex = (hex: string) => {
    // remove non-hex
    const cleaned = hex.replace(/[^0-9a-fA-F]/g, "");
    if (cleaned.length % 2 !== 0) {
      console.warn("Image hex length odd, trimming last nibble");
    }
    const bytesArr: number[] = [];
    for (let i = 0; i + 1 < cleaned.length; i += 2) {
      bytesArr.push(parseInt(cleaned.substr(i, 2), 16));
    }
    // If the hex was prepared to include raster header (xL xH yL yH etc.), just send raw with a newline.
    // Many helper libraries give you already the ESC/POS image command payload — if so just push it.
    // Here we conservatively wrap with a newline before/after.
    push(...bytesArr);
    push(LF);
  };

  // parse input by lines but we must handle some tags that can span single line (like <font>..</font>)
  // We'll split by "\n" but preserve empty lines (feed).
  const rawLines = input.split("\n");
console.log(rawLines);
  for (let rawLine of rawLines) {
    // Trim only edges — keep internal spaces
    let line = rawLine;

    // If empty line -> feed newline
    if (!line || /^\s*$/.test(line)) {
      push(LF);
      continue;
    }

    // detect alignment at line start
    const alignMatch = line.match(/^\s*(\[([LCR])\])/i);
    if (alignMatch) {
      const tag = alignMatch[2].toUpperCase() as "L" | "C" | "R";
      setAlign(tag);
      line = line.slice(alignMatch[0].length); // remove tag
    } else {
      // default left
      setAlign("L");
    }

    // handle pure barcode line: must be only alignment + <barcode ...>...</barcode>
    const barcodeMatch = line.match(/<barcode([^>]*)>([\s\S]*?)<\/barcode>/i);
    if (barcodeMatch) {
      // parse attributes: type, width, height, text (hri)
      const attrs = barcodeMatch[1];
      const content = barcodeMatch[2].trim();
      const typeMatch = attrs.match(/type=['"]([^'"]+)['"]/i);
      const widthMatch = attrs.match(/width=['"](\d+)['"]/i);
      const heightMatch = attrs.match(/height=['"](\d+)['"]/i);
      const textAttr = attrs.match(/text=['"]([^'"]+)['"]/i);
      // only implement CODE128 for now
      const type = typeMatch ? typeMatch[1].toLowerCase() : "code128";
      const width = widthMatch ? Number(widthMatch[1]) : 3;
      const height = heightMatch ? Number(heightMatch[1]) : 100;
      const hri = textAttr ? (textAttr[1].toLowerCase() === "above" ? 1 : textAttr[1].toLowerCase() === "none" ? 0 : 2) : 2;

      if (type === "128" || type === "code128" || type === "128c" || type === "code-128") {
        printBarcodeCODE128(content, { width, height, hri });
      } else {
        // fallback: print content as text if unsupported barcode type
        pushText(content);
        push(LF);
      }
      continue;
    }

    // handle pure qrcode line
    const qrMatch = line.match(/<qrcode([^>]*)>([\s\S]*?)<\/qrcode>/i);
    if (qrMatch) {
      const attrs = qrMatch[1];
      const content = qrMatch[2].trim();
      const sizeMatch = attrs.match(/size=['"](\d+)['"]/i);
      const size = sizeMatch ? Number(sizeMatch[1]) : 6;
      printQRCode(content, size);
      continue;
    }

    // handle image line
    const imgMatch = line.match(/<img[^>]*>([\s\S]*?)<\/img>/i);
    if (imgMatch) {
      const hex = imgMatch[1].trim();
      // image must be aligned and alone in the line per your rules; we assume alignment already set
      printImageFromHex(hex);
      continue;
    }

    // inline formatting: <font size='...'> ... </font>
    const fontMatch = line.match(/<font\s+[^>]*size=['"]([^'"]+)['"][^>]*>([\s\S]*?)<\/font>/i);
    if (fontMatch) {
      const size = fontMatch[1];
      const content = fontMatch[2];
      setFontSize(size);
      // allow nested bold/underline inside font
      // handle <b> and <u>
      let tmp = content;
      // bold
      tmp = tmp.replace(/<b>([\s\S]*?)<\/b>/gi, (_, inner) => {
        setBold(true);
        // push inner text, then disable bold
        pushText(inner);
        setBold(false);
        return ""; // we've manually consumed
      });
      // underline
      tmp = tmp.replace(/<u(?:\s+type=['"]?double['"]?)?>([\s\S]*?)<\/u>/gi, (_, inner) => {
        const dbl = /type=['"]?double['"]?/i.test(_);
        setUnderline(dbl ? 2 : 1);
        pushText(inner);
        setUnderline(0);
        return "";
      });
      // if anything remaining (plain text), push it
      if (tmp.trim()) pushText(tmp);
      resetFontSize();
      push(LF);
      continue;
    }

    // generic inline <b> and <u> for normal (non-font) lines
    // We'll process tokens sequentially to allow multiple inline tags
    const tokenRegex = /(<b>|<\/b>|<u(?:\s+type=['"]?double['"]?)?>|<\/u>)/gi;
    let m: RegExpExecArray | null;
    let lastPos = 0;
    while ((m = tokenRegex.exec(line)) !== null) {
      const token = m[0];
      const index = m.index;
      // text before token
      if (index > lastPos) {
        pushText(line.slice(lastPos, index));
      }
      if (/^<b>$/i.test(token)) setBold(true);
      else if (/^<\/b>$/i.test(token)) setBold(false);
      else if (/^<u(?:\s+type=['"]?double['"]?)?>$/i.test(token)) {
        const dbl = /type=['"]?double['"]?/i.test(token);
        setUnderline(dbl ? 2 : 1);
      } else if (/^<\/u>$/i.test(token)) setUnderline(0);
      lastPos = index + token.length;
    }
    if (lastPos < line.length) {
      pushText(line.slice(lastPos));
    }
    push(LF);

    // reset formatting for safety
    setBold(false);
    setUnderline(0);
    resetFontSize();
  }

  // finally ensure some feeds and cut (cut isn't standardized — we will not add automatic cut; let user call cut())
  return new Uint8Array(bytes);
}
