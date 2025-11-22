// api/webhook.js
module.exports = async (req, res) => {
  // Untuk test di browser (GET)
  if (req.method === "GET") {
    return res.status(200).json({ status: "ok", message: "EVM Volume Tracker webhook" });
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // Respon frame Farcaster vNext
  return res.status(200).json({
    type: "frame",
    version: "vNext",
    imageUrl: "https://evm-tracker-mauve.vercel.app/image.png",
    buttons: [
      {
        title: "Check Volume",
        action: "link",
        target: "https://evm-tracker-mauve.vercel.app"
      }
    ]
  });
};
