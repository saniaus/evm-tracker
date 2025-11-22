// api/scan.js – DeBank Cloud API v2
// Works with AccessKey: 95e7a1fd...

const BASE = "https://api.cloud.debank.com";

async function fetchJSON(url, key) {
  const resp = await fetch(url, {
    headers: {
      AccessKey: key,
      accept: "application/json"
    }
  });
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`HTTP ${resp.status} → ${text}`);
  }
  return resp.json();
}

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");

  const key = process.env.DEBANK_ACCESS_KEY;
  const address = req.query.address;

  if (!key) {
    return res.status(500).json({ error: "Missing DEBANK_ACCESS_KEY" });
  }
  if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
    return res.status(400).json({ error: "Invalid address" });
  }

  try {
    // 1. Total balance
    const total = await fetchJSON(
      `${BASE}/user/total_balance?id=${address}`,
      key
    );

    // 2. List chain balance
    const chains = await fetchJSON(
      `${BASE}/user/chain_balance_list?id=${address}`,
      key
    );

    const list = chains.data || [];
    const active = list.filter((c) => c.usd_value > 0);

    // ranking
    const usd = total.data?.usd_value || 0;
    let rank = "Shrimp";
    if (usd > 5_000_000) rank = "Blue Whale";
    else if (usd > 1_000_000) rank = "Whale";
    else if (usd > 200_000) rank = "Shark";
    else if (usd > 25_000) rank = "Dolphin";
    else if (usd > 2500) rank = "Fish";

    return res.status(200).json({
      address,
      totalUsd: Math.round(usd),
      activeChains: active.length,
      rank,
      chains: active.map((c) => ({
        id: c.chain_id,
        name: c.chain,
        usd: Math.round(c.usd_value)
      }))
    });
  } catch (err) {
    return res.status(502).json({ error: err.message });
  }
};
