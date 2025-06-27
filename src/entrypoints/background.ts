import { countTokens, saveTokenUsage } from "./tracker/tokeUsage";

export default defineBackground(() => {
  console.log("[tracker] Background script initialized");
});
