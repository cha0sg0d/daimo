import { EAccountSearchResult, getAccountName } from "@daimo/common";
import { Address, getAddress, isAddress } from "viem";
import { normalize } from "viem/ens";

import { NameRegistry } from "../contract/nameRegistry";
import { ViemClient } from "../network/viemClient";

// Search for "vitalik" or "vitalik.eth" matches vitalik.eth
// Search for "jesse.cb.id" matches jesse.cb.id
export async function search(
  prefix: string,
  vc: ViemClient,
  nameReg: NameRegistry
) {
  prefix = prefix.trim();
  if (prefix.startsWith("@")) prefix = prefix.slice(1);

  // Show a santized, simplified view of what the user entered
  // This is important when eg entering an address > matches reverse ENS
  // Othewise, you have no confirmation on send screen that it's the same addr.
  // Also important when entering an ENS > get a *different* reverse ENS.

  let ret: EAccountSearchResult[];
  if (isAddress(prefix)) {
    const addr = getAddress(prefix);
    const addrDisp = getAccountName({ addr });
    ret = [await getResultFromAddr(addr, addrDisp, nameReg)];
  } else if (prefix.includes(".")) {
    const addr = await tryGetEnsAddr(prefix, vc);
    if (addr == null) ret = [];
    else ret = [await getResultFromAddr(addr, prefix, nameReg)];
  } else {
    const dAccounts = await nameReg.search(prefix);
    ret = dAccounts.map((d) => ({ ...d, originalMatch: d.name }));
  }

  console.log(`[API] search: ${ret.length} results for '${prefix}'`);
  return ret;
}

async function getResultFromAddr(
  addr: Address,
  originalMatch: string,
  nameReg: NameRegistry
): Promise<EAccountSearchResult> {
  const eAcc = await nameReg.getEAccount(addr);
  return { ...eAcc, originalMatch };
}

async function tryGetEnsAddr(prefix: string, vc: ViemClient) {
  if (prefix.length < 3) return null;
  if (!prefix.includes(".")) return null;
  try {
    const ensName = normalize(prefix);
    return await vc.getEnsAddress({ name: ensName });
  } catch (e) {
    console.log(`[API] ens lookup '${prefix}' failed: ${e}`);
    return null;
  }
}
