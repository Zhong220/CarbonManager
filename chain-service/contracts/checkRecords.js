import { ethers } from "ethers";
import fs from "fs";

const provider = new ethers.JsonRpcProvider("http://127.0.0.1:8545");
const abi = JSON.parse(fs.readFileSync("./RecordStorage.json")).abi;
const contract = new ethers.Contract("0x7651dDBf08043a3af8b4603F8EBB90733247BFa9", abi, provider);

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