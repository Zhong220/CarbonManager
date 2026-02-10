import express from "express";
import { ethers } from "ethers";
import fs from "fs";
import axios from "axios";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// load .env
dotenv.config({ path: path.resolve(__dirname, "../.env") });

const app = express();
app.use(express.json());

app.get("/health", (req, res) => {
  res.status(200).json({ ok: true, msg: "chain-service running" });
});

// connect to Quorum node
const RPC_URL = process.env.QUORUM_RPC_URL || "http://127.0.0.1:8545";
const provider = new ethers.JsonRpcProvider(RPC_URL);

// load private key
if (!process.env.QUORUM_PRIVATE_KEY) {
  throw new Error("Missing QUORUM_PRIVATE_KEY in .env");
}
const wallet = new ethers.Wallet(process.env.QUORUM_PRIVATE_KEY, provider);

// load ABI & contract address
const contractPath = path.join(__dirname, "../contracts/RecordStorage.json");
const contractJson = JSON.parse(fs.readFileSync(contractPath, "utf8"));
if (!process.env.CONTRACT_ADDRESS) {
  throw new Error("Missing CONTRACT_ADDRESS in .env");
}
const contract = new ethers.Contract(process.env.CONTRACT_ADDRESS, contractJson, wallet);

// POST /send: 後端呼叫這個 API 觸發上鏈
app.post("/send", async (req, res) => {
  const { emission_id, payload } = req.body;

  if (!emission_id || !payload) {
    return res.status(400).json({ ok: false, error: "Missing emission_id or payload" });
  }

  try {
    console.log(`⬆ Uploading emission_id=${emission_id}, payload=${JSON.stringify(payload)}`);

    const tx = await contract.addRecord(JSON.stringify(payload));
    await tx.wait();

    console.log(`success: txHash=${tx.hash}`);

    await axios.put(
      process.env.CALLBACK_URL,
      { emission_id, status: "submitted", tx_hash: tx.hash },
      { headers: { "X-Chain-Secret": process.env.CHAIN_SECRET } }
    );

    res.json({ ok: true, txHash: tx.hash });
  } catch (err) {
    console.error(" Error uploading:", err);

    try {
      await axios.put(
        process.env.CALLBACK_URL,
        { emission_id, status: "failed", error_msg: err.message },
        { headers: { "X-Chain-Secret": process.env.CHAIN_SECRET || ""} }
      );
    } catch (callbackErr) {
      console.error("Callback failed:", callbackErr);
    }

    res.status(500).json({ ok: false, error: err.message });
  }
});

// GET /record/:id
// fetching record from blockchain
app.get("/record/:id", async(req, res) => {
  const recordId = req.params.id;

  if (recordId === undefined) {
    return res.status(400).json({ ok: false, error: "Missing record id" });
  }
  
  try {
    console.log(`Fetching record ${recordId} from blockchain`);
    const record = await contract.getRecord(recordId);

    const data = {
      id: record[0].toString(),
      content: record[1],
      creator: record[2],
    };

    res.json({ ok:true, record:data });
  } catch(err) {
    console.error("Error reading record:", err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.listen(3001,'0.0.0.0', () => {
  console.log("chain-service listening on port 3001");
});

