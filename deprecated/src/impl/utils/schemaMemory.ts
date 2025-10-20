export interface EncryptedDataMemoryShape {
  code: string;
  key: string;
  githubKey?: string;
  vercelKey?: string;
  openaiKey?: string;
}

export interface UserDataMemoryShape {
  name?: string;
  email?: string;
  githubUsername?: string;
  vercelTeamId?: string;
  vercelTeamSlug?: string;
}

export type ReliverseMemory = EncryptedDataMemoryShape & UserDataMemoryShape;
export type EncryptedDataMemory = keyof EncryptedDataMemoryShape;
export type UserDataMemory = keyof UserDataMemoryShape;
