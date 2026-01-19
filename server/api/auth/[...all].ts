import { auth } from "~/lib/auth"; // auth config

export default defineEventHandler((event) => {
  console.log("I am here");
  return auth.handler(toWebRequest(event));
});
