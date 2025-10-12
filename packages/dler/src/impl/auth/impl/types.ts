export interface AuthConfigImport {
  path: string;
  variables:
    | { asType?: boolean; name: string; as?: string }[]
    | { asType?: boolean; name: string; as?: string };
}
