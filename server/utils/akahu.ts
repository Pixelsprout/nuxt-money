import { AkahuClient } from "akahu";

export function getAkahuClient() {
  const config = useRuntimeConfig();
  const appToken = config.AKAHU_APP_TOKEN as string;

  return new AkahuClient({ appToken });
}

export function getAkahuUserToken() {
  const config = useRuntimeConfig();
  return config.AKAHU_USER_TOKEN as string;
}
