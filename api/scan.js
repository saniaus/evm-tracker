// api/scan.js
// Scan EVM address via RPC:
// - eth_getBalance  -> total aset native per chain
// - eth_getTransactionCount -> jumlah tx outbound per chain

const CHAINS = [
  {
    id: "ethereum",
    label: "Ethereum",
    symbol: "ETH",
    decimals: 18,
    rpcEnv: "RPC_ETH_MAINNET",
    usd: 3500
  },
  {
    id: "arbitrum",
    label: "Arbitrum",
    symbol: "ETH",
    decimals: 18,
    rpcEnv: "RPC_ARBITRUM",
    usd: 3500
  },
  {
    id: "optimism",
    label: "Optimism",
    symbol: "ETH",
    decimals: 18,
    rpcEnv: "RPC_OPTIMISM",
    usd: 3500
  },
  {
    id: "base",
    label: "Base",
    symbol: "ETH",
    decimals: 18,
    rpcEnv: "RPC_BASE",
    usd: 3500
  },
  {
    id: "bsc",
    label: "BNB Chain",
    symbol: "BNB",
    decimals: 18,
    rpcEnv: "RPC_BSC",
    usd: 600
  },
  {
    id: "polygon",
    label: "Polygon",
    symbol: "MATIC",
    decimals: 18,
    rpcEnv: "RPC_POLYGON",
    usd: 0.7
  }
];

function hexToBigInt(hex) {
  if (!hex) return 0n;
  return BigInt(hex);
}

function bigIntToDecimal(bi, decimals) {
  if (bi === 0n) return 0;
  const base = 10n ** BigInt(decimals);
  const integer = bi / base;
  const fraction = bi % base;
  return Number(integer) + Number(fraction) / Number(base);
}

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

  let totalUsd = 0;
  let totalTx = 0;
  let activeChains = 0;
  const perChain = [];

  await Promise.all(
    CHAINS.map(async (chain, idx) => {
      const rpcUrl = process.env[chain.rpcEnv];
      if (!rpcUrl) {
        console.warn(`Missing RPC for ${chain.id} (${chain.rpcEnv})`);
        return;
      }

      try {
        const balanceBody = {
          jsonrpc: "2.0",
          id: idx * 2 + 1,
          method: "eth_getBalance",
          params: [address, "latest"]
        };

        const txCountBody = {
          jsonrpc: "2.0",
          id: idx * 2 + 2,
          method: "eth_getTransactionCount",
          params: [address, "latest"]
        };

        const [balResp, txResp] = await Promise.all([
          fetch(rpcUrl, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(balanceBody)
          }),
          fetch(rpcUrl, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(txCountBody)
          })
        ]);

        if (!balResp.ok || !txResp.ok) {
          console.error(
            `RPC error ${chain.id}`,
            balResp.status,
            txResp.status
          );
          return;
        }

        const balJson = await balResp.json();
        const txJson = await txResp.json();

        const balanceWei = hexToBigInt(balJson.result || "0x0");
        const txCount = parseInt(txJson.result || "0x0", 16) || 0;

        const balance = bigIntToDecimal(
          balanceWei,
          chain.decimals || 18
        );
        const balanceUsd = balance * (chain.usd || 0);

        if (balance > 0 || txCount > 0) {
          activeChains += 1;
        }

        totalUsd += balanceUsd;
        totalTx += txCount;

        perChain.push({
          id: chain.id,
          label: chain.label,
          symbol: chain.symbol,
          balance,
          balanceUsd,
          txCount
        });
      } catch (e) {
        console.error(`scan failed for ${chain.id}`, e);
      }
    })
  );

  let rank = "Shrimp";
  if (totalUsd > 1_000_000) rank = "Whale";
  else if (totalUsd > 200_000) rank = "Shark";
  else if (totalUsd > 25_000) rank = "Dolphin";
  else if (totalUsd > 2_500) rank = "Fish";

  return res.status(200).json({
    address,
    totalUsd: Math.round(totalUsd),
    totalTx,
    activeChains,
    rank,
    chains: perChain
  });
};
