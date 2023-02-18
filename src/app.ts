type KeySize = 1024 | 2048 | 3072 | 4096;

interface Config {
	domain: string;
	cloudflareToken: string;
	maintainerEmail: string;
	keySize?: KeySize;
	staging?: boolean;
	verbose?: boolean;
}

export const generateCertificate = async (config: Config) => {
	const { domain, cloudflareToken, maintainerEmail } = config;
	const keySize = config.keySize || 4096;
	const staging = config.staging === false ? false : true;
	const verbose = config.verbose || false;

	const returnObject = {
		certificate: "",
		privateKey: "",
		publicKey: "",
		csr: "",
		iat: 0,
		exp: 0,
		staging,
	};

	const verboseLog = (...args: any[]) => {
		if (verbose) {
			console.log(...args);
		}
	};

	//Generate jwk keypair
	verboseLog("Generating keypair...");
	const keypairs = require("keypairs");
	const keys = await keypairs.generate({ kty: "RSA", modulusLength: keySize });

	//Convert private jwk to pem
	verboseLog("Converting private key to pem...");
	returnObject.privateKey = await keypairs.export({
		jwk: keys.private,
		public: false,
		encoding: "pem",
	});

	//Convert public jwk to pem
	verboseLog("Converting public key to pem...");
	returnObject.publicKey = await keypairs.export({
		jwk: keys.public,
		public: true,
		encoding: "pem",
	});

	//Generate CSR
	verboseLog("Generating CSR...");
	const rsacsr = require("rsa-csr");
	const domains = [domain, `*.${domain}`];
	const csr = await rsacsr({ key: keys.private, domains: domains });
	returnObject.csr = csr;

	//Initiate ACME client
	verboseLog("Initiating ACME client...");
	const packageAgent = "quin-acme/v2.0.0";

	const ACME = require("acme");
	const acme = ACME.create({ maintainerEmail, packageAgent });

	await acme.init(staging ? "https://acme-staging-v02.api.letsencrypt.org/directory" : "https://acme-v02.api.letsencrypt.org/directory");

	//Register ACME account
	verboseLog("Registering ACME account...");
	const accountKeypair = await keypairs.generate({ kty: "EC", format: "jwk" });
	const accountKey = accountKeypair.private;
	const account = await acme.accounts.create({
		subscriberEmail: maintainerEmail,
		agreeToTerms: true,
		accountKey,
	});

	//Ready Cloudflare dns-01 challenger
	verboseLog("Preparing Cloudflare dns-01 challenger...");
	const acmeDnsCloudflare = require("acme-dns-01-cloudflare");

	const challenges = {
		"dns-01": new acmeDnsCloudflare({
			token: cloudflareToken,
			verifyPropagation: true,
			propagationDelay: 1000 * 60,
			verbose,
		}),
	};

	//Create certificate order and complete challenges
	verboseLog("Creating certificate order and completing challenges...");
	const pems = await acme.certificates.create({
		account,
		accountKey,
		csr,
		domains,
		challenges,
	});

	//Save certificate
	verboseLog("Saving certificate...");
	const fullchain = pems.cert + "\n" + pems.chain + "\n";
	returnObject.certificate = fullchain;
	returnObject.iat = Date.now();
	returnObject.exp = Date.now() + 1000 * 60 * 60 * 24 * 90;

	//Return certificate and keys, Good luck! :) & 💚 Let's Encrypt
	verboseLog("Done!");
	return returnObject;
};
