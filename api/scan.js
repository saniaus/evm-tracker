// api/scan.js
// Multi-chain balance scanner via DeBank Open API.
// - user/used_chain_list => daftar chain yang pernah dipakai
// - user/chain_balance   => usd_value per chain
// Output: totalUsd, activeChains, rank, chains[]

const USED_CHAIN_ENDPOINT =
  "https://pro-openapi.debank.com/v1/user/used_chain_list";
const CHAIN_BALANCE_ENDPOINT =
  "https://pro-openapi.debank.com/v1/user/chain_balance";

// batasi jumlah chain untuk jaga rate limit & latency
const MAX_CHAINS = 20;

function computeRank(totalUsd) {
  let rank = "Shrimp";
  if (totalUsd > 5_000_000) rank = "Blue Whale";
  else if (totalUsd > 1_000_000) rank = "Whale";
  else if (totalUsd > 200_000) rank = "Shark";
  else if (totalUsd > 25_000) rank = "Dolphin";
  else if (totalUsd > 2_500) rank = "Fish";
  return rank;
}

module.exports = async (req, res) => {
  // CORS untuk dipanggil dari Mini App (browser)
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
    console.error("Missing DEBANK_ACCESS_KEY env");
    return res
      .status(500)
      .json({ error: "Server missing DeBank access key" });
  }

  try {
    // 1) Ambil daftar chain yang pernah dipakai user
    const usedChainsResp = await fetch(
      `${USED_CHAIN_ENDPOINT}?id=${encodeURIComponent(address)}`,
      {
        headers: {
          accept: "application/json",
          AccessKey: accessKey
        }
      }
    );

    if (!usedChainsResp.ok) {
      const bodyText = await usedChainsResp.text().catch(() => "");
      console.error(
        "DeBank used_chain_list error",
        usedChainsResp.status,
        bodyText
      );
      return res.status(502).json({
        error: "DeBank used_chain_list failed",
        status: usedChainsResp.status
      });
    }

    const usedChainsJson = await usedChainsResp.json();
    const chainsArray = Array.isArray(usedChainsJson)
      ? usedChainsJson
      : [];

    // belum punya aktivitas di chain mana pun
    if (!chainsArray.length) {
      return res.status(200).json({
        address,
        totalUsd: 0,
        activeChains: 0,
        rank: "Shrimp",
        chains: []
      });
    }

    const limitedChains = chainsArray.slice(0, MAX_CHAINS);

    // 2) Ambil balance per chain paralel
    let totalUsd = 0;
    const chainBalances = [];

    await Promise.all(
      limitedChains.map(async (chainInfo) => {
        const chainId = chainInfo.id; // ex: "eth", "bsc", "arb"
        if (!chainId) return;

        const url =
          `${CHAIN_BALANCE_ENDPOINT}?` +
          `id=${encodeURIComponent(address)}&chain_id=${encodeURIComponent(
            chainId
          )}`;

        try {
          const balResp = await fetch(url, {
            headers: {
              accept: "application/json",
              AccessKey: accessKey
            }
          });

          if (!balResp.ok) {
            const errText = await balResp.text().catch(() => "");
            console.error(
              "DeBank chain_balance error",
              chainId,
              balResp.status,
              errText
            );
            return;
          }

          const balJson = await balResp.json();
          const usd =
            typeof balJson.usd_value === "number" ? balJson.usd_value : 0;

          if (usd > 0) {
            totalUsd += usd;
          }

          chainBalances.push({
            id: chainId,
            name: chainInfo.name || chainId,
            usd: Math.round(usd)
          });
        } catch (err) {
          console.error("DeBank chain_balance request failed", chainId, err);
        }
      })
    );

    // urutkan chain dari terbesar
    chainBalances.sort((a, b) => (b.usd || 0) - (a.usd || 0));

    const rank = computeRank(totalUsd);

    return res.status(200).json({
      address,
      totalUsd: Math.round(totalUsd),
      activeChains: chainBalances.filter((c) => c.usd > 0).length,
      rank,
      chains: chainBalances
    });
  } catch (e) {
    console.error("DeBank scan error", e);
    return res.status(500).json({ error: "Internal server error" });
  }
};
