// api/scan.js
// EVM multi-chain balance scanner via GoldRush (Covalent) API.
// Menggunakan endpoint: GET /v1/{chainName}/address/{walletAddress}/balances_v2/
//
// Dok: https://goldrush.dev/docs/api-reference/foundational-api/balances/get-token-balances-for-address
// Auth: header Authorization: Bearer <API_KEY>

const BASE_URL = "https://api.covalenthq.com/v1";

// Chain yang discan (bisa ditambah sesuai kebutuhan)
const CHAINS = [
  { id: "eth-mainnet", label: "Ethereum" },
  { id: "polygon-mainnet", label: "Polygon" },
  { id: "bsc-mainnet", label: "BNB Chain" },
  { id: "avalanche-mainnet", label: "Avalanche" },
  { id: "arbitrum-mainnet", label: "Arbitrum" },
  { id: "optimism-mainnet", label: "Optimism" },
  { id: "base-mainnet", label: "Base" }
];

// Ranking berdasarkan total USD balance
function computeRank(totalUsd) {
  if (totalUsd > 5_000_000) return "Blue Whale";
  if (totalUsd > 1_000_000) return "Whale";
  if (totalUsd > 200_000) return "Shark";
  if (totalUsd > 25_000) return "Dolphin";
  if (totalUsd > 2_500) return "Fish";
  return "Shrimp";
}

async function fetchChainBalance(chain, address, apiKey) {
  const url =
    `${BASE_URL}/v1/${encodeURIComponent(chain.id)}` +
    `/address/${encodeURIComponent(address)}/balances_v2/` +
    `?quote-currency=USD&no-spam=true`;

  const resp = await fetch(url, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      accept: "application/json"
    }
  });

  if (!resp.ok) {
    const text = await resp.text().catch(() => "");
    console.error(
      "GoldRush balances_v2 error",
      chain.id,
      resp.status,
      text.slice(0, 500)
    );
    // Kalau 404/500 untuk chain tertentu, kita skip chain itu saja.
    return { chainId: chain.id, label: chain.label, usd: 0, error: true };
  }

  const json = await resp.json();
  const items = json?.data?.items || json?.items || [];

  let usd = 0;
  for (const item of items) {
    const q = typeof item.quote === "number" ? item.quote : 0;
    if (q > 0) usd += q;
  }

  return {
    chainId: chain.id,
    label: chain.label,
    usd
  };
}

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type,Authorization");

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

  const apiKey = process.env.COVALENT_API_KEY;
  if (!apiKey) {
    console.error("Missing COVALENT_API_KEY env");
    return res.status(500).json({ error: "Server missing Covalent API key" });
  }

  try {
    // Panggil semua chain paralel
    const results = await Promise.all(
      CHAINS.map((c) => fetchChainBalance(c, address, apiKey))
    );

    let totalUsd = 0;
    const chains = [];

    for (const r of results) {
      const usd = Math.max(0, Math.round(r.usd || 0));
      if (usd > 0) {
        totalUsd += usd;
      }
      chains.push({
        id: r.chainId,
        name: r.label,
        usd
      });
    }

    chains.sort((a, b) => (b.usd || 0) - (a.usd || 0));

    const activeChains = chains.filter((c) => c.usd > 0).length;
    const rank = computeRank(totalUsd);

    return res.status(200).json({
      address,
      totalUsd: Math.round(totalUsd),
      activeChains,
      rank,
      chains
    });
  } catch (err) {
    console.error("GoldRush scan fatal error", err);
    return res
      .status(502)
      .json({ error: "fetch_failed", detail: err.message || String(err) });
  }
};
