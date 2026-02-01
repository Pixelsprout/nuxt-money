import { auth } from "#root/lib/auth";

export default defineEventHandler((event) => {
  return auth.handler(toWebRequest(event));
});
