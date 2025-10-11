import Crypto from "crypto";

export const generateSecretHash = () => Crypto.randomBytes(32).toString("hex");
