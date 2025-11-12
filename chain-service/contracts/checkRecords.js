import { ethers } from "ethers";
import fs from "fs";
import path, { dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const abiPath = path.join(__dirname,"../contracts/RecordStorage.json");
const abiJson = JSON.parse(fs.readFileSync(abiPath, "utf8"));

const provider = new ethers.JsonRpcProvider("http://127.0.0.1:8545");

const contract = new ethers.Contract("0x7651dDBf08043a3af8b4603F8EBB90733247BFa9", abiJson.abi, provider);

// Search and print all records
try {
const nextId = await contract.nextId();
for (let i = 0; i < nextId; i++) {
    const record = await contract.getRecord(i);
    console.log(`id=${record[0]}, content=${record[1]}, creator=${record[2]}`);
}
} catch (err) {
    console.error("Error fetching records:", err);
}