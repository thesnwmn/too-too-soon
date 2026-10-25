// Spike for point-coords: which open sources give timing points a place on the map, reachable
// from GitHub's runners with no account. Run by probe.yml with `sample: coords`. Prints only.
const UA = { "User-Agent": "too-too-soon-probe/1 (+https://github.com/thesnwmn/too-too-soon)" };
const look = async (name, url) => {
  const t0 = Date.now();
  const r = await fetch(url, { headers: UA, redirect: "follow" }).catch((e) => ({ ok: false, status: String(e.cause?.code ?? e.message) }));
  const text = r.ok ? await r.text() : "";
  console.log(`\n## ${name}: ${r.status} in ${((Date.now() - t0) / 1000).toFixed(1)} s, ${Math.round(text.length / 1024)} KB, ${r.headers?.get?.("content-type") ?? ""}`);
  return text;
};
const grepLines = (text, re, n = 12) => text.split("\n").filter((l) => re.test(l)).slice(0, n).forEach((l) => console.log("  " + l.slice(0, 300)));

// NaPTAN: rail stops are 9100<TIPLOC>, with latitude and longitude.
const naptan = await look("NaPTAN stops, area 910 (rail)", "https://naptan.api.dft.gov.uk/v1/access-nodes?dataFormat=csv&atcoAreaCodes=910");
if (naptan) {
  const lines = naptan.split("\n");
  console.log("  header: " + lines[0].slice(0, 600));
  console.log(`  rows: ${lines.length - 1}`);
  grepLines(naptan, /9100(WOKING|BRKWOOD|CLPHMJ|WOKINGJ)/);
}

// BPLAN: Network Rail's geography, linked from the Open Rail Data wiki (a 403 to a bot's user agent).
const BROWSER = { "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36", Accept: "text/html,*/*" };
for (const page of ["https://wiki.openraildata.com/index.php?title=BPLAN_Geography_Data&action=raw", "https://wiki.openraildata.com/index.php/BPLAN_Geography_Data", "https://wiki.openraildata.com/index.php?title=Reference_Data&action=raw"]) {
  const r = await fetch(page, { headers: BROWSER }).catch(() => undefined);
  const w = r?.ok ? await r.text() : "";
  console.log(`\n## ${page}: ${r?.status}, ${w.length} chars`);
  for (const m of new Set(w.match(/https?:\/\/[^\s"'<>\]|]+/g) ?? [])) if (/networkrail|bplan|geograph|zip|gz|\.txt|github/i.test(m)) console.log("  link: " + m);
  grepLines(w, /bplan|easting|download/i, 20);
}
const nr = await look("Network Rail open data feeds", "https://publicdatafeeds.networkrail.co.uk/");
console.log(nr.slice(0, 1500));
