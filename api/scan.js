// api/scan.js
// DeBank Open API - only total_balance endpoint (stable, pakai AccessKey)

const BASE = "https://pro-openapi.debank.com/v1";

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const address = (req.query && req.query.address) || "";
  if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
    return res.status(400).json({ error: "Invalid EVM address" });
  }

  const accessKey = process.env.DEBANK_ACCESS_KEY;
  if (!accessKey) {
    return res.status(500).json({ error: "Missing DEBANK_ACCESS_KEY" });
  }

  const url =
    `${BASE}/user/total_balance?id=${encodeURIComponent(address)}`;

  try {
    const resp = await fetch(url, {
      headers: {
        accept: "application/json",
        AccessKey: accessKey
      }
    });

    if (!resp.ok) {
      const text = await resp.text().catch(() => "");
      console.error("DeBank total_balance error", resp.status, text);
      return res
        .status(resp.status)
        .json({ error: "debank_error", status: resp.status, body: text });
    }

    const json = await resp.json();
    const usd = typeof json.total_usd_value === "number"
      ? json.total_usd_value
      : 0;

    // simple rank
    let rank = "Shrimp";
    if (usd > 5_000_000) rank = "Blue Whale";
    else if (usd > 1_000_000) rank = "Whale";
    else if (usd > 200_000) rank = "Shark";
    else if (usd > 25_000) rank = "Dolphin";
    else if (usd > 2_500) rank = "Fish";

    return res.status(200).json({
      address,
      totalUsd: Math.round(usd),
      activeChains: null, // tidak dihitung di mode ini
      rank,
      chains: []          // kosong (frontend aman, hanya tidak tampil list)
    });
  } catch (e) {
    console.error("DeBank fetch failed", e);
    return res.status(502).json({ error: "fetch_failed", detail: e.message });
  }
};
