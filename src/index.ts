import { config } from "dotenv";
import { promises as fs } from "fs";
import { existsSync } from "fs";
import { X509Certificate } from "crypto";

import { generateCertificate } from "./app";
import { saveOnFs } from "./save";

console.log("Starting certificate generation script");
config();

if (!process.env.DOMAIN) {
	console.error("DOMAIN not set, exiting");
	process.exit(0);
}

if (!process.env.CLOUDFLARE_TOKEN) {
	console.error("CLOUDFLARE_TOKEN not set, exiting");
	process.exit(0);
}

if (!process.env.MAINTAINER_EMAIL) {
	console.error("MAINTAINER_EMAIL not set, exiting");
	process.exit(0);
}

if (!process.env.DAYS_BEFORE_RENEW) {
	console.log("DAYS_BEFORE_RENEW not set, defaulting to 30 days");
}

if (!process.env.KEY_SIZE) {
	console.log("KEY_SIZE not set, defaulting to 4096 bits");
}

if (!process.env.STAGING) {
	console.log("STAGING not set, defaulting to true");
}

if (!process.env.VERBOSE) {
	console.log("VERBOSE not set, defaulting to true");
}

const DAYS_BEFORE_RENEW = parseInt(process.env.DAYS_BEFORE_RENEW || "30");

const generateCertificateFiles = async () => {
	const { DOMAIN, CLOUDFLARE_TOKEN, MAINTAINER_EMAIL } = process.env;
	if (!DOMAIN || !CLOUDFLARE_TOKEN || !MAINTAINER_EMAIL) {
		console.error(
			"Missing environment variables\nMake sure you have a .env file with the following variables:\nDOMAIN\nCLOUDFLARE_TOKEN\nMAINTAINER_EMAIL",
		);
		process.exit(0);
	}

	try {
		const certificate = await generateCertificate({
			domain: DOMAIN,
			cloudflareToken: CLOUDFLARE_TOKEN,
			maintainerEmail: MAINTAINER_EMAIL,
			keySize: parseInt(process.env.KEY_SIZE || "4096") as 2048 | 4096,
			staging: process.env.STAGING?.toLowerCase() === "true",
			verbose: process.env.VERBOSE?.toLowerCase() === "true",
		});

		console.log(certificate);

		await saveOnFs(certificate);

		console.log("Done!");
	} catch (e) {
		console.error("Something went wrong while generating certificate", e);
		process.exit(1);
	}
};

const checkCertValidity = async () => {
	if (!existsSync("./pems/certificate.pem")) {
		console.log("Certificate not found, generating new one");
		return await generateCertificateFiles();
	}

	const certificate = await fs.readFile("./pems/certificate.pem", "utf8");
	const { validTo } = new X509Certificate(certificate);
	const validToDate = new Date(validTo);
	const now = new Date(Date.now());
	const validDays = Math.floor((validToDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

	console.log(`Certificate valid for ${validDays} days`);

	if (validDays < DAYS_BEFORE_RENEW) {
		console.log("Certificate is about to expire, generating new one");
		return await generateCertificateFiles();
	}

	console.log("Certificate is still valid, skipping generation checking again tomorrow");
};

checkCertValidity();
const daylyCheckInterval = setInterval(checkCertValidity, 1000 * 60 * 60 * 24); // Check every day

process.on("SIGINT", () => {
	clearInterval(daylyCheckInterval);
	process.exit(0);
});
