interface CertificateData {
	certificate: string;
	privateKey: string;
	publicKey: string;
	csr: string;
	iat: number;
	exp: number;
	staging: boolean;
}

import fs from "fs/promises";

export const saveOnFs = async (certificate: CertificateData) => {
	console.log("Saving certificate on fs...");
	await Promise.all([
		fs.writeFile("./pems/certificate.pem", certificate.certificate),
		fs.writeFile("./pems/privateKey.pem", certificate.privateKey),
		fs.writeFile("./pems/publicKey.pem", certificate.publicKey),
		fs.writeFile("./pems/csr.pem", certificate.csr),
		fs.writeFile(
			"./pems/data.json",
			JSON.stringify(
				{
					iat: certificate.iat,
					exp: certificate.exp,
					staging: certificate.staging,
				},
				null,
				2,
			),
		),
	]);
};
