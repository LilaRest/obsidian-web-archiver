import { uuidDict } from "./constants";

function genRandomInt(min: number, max: number): number {       
    // Create byte array and fill with 1 random number
    var byteArray = new Uint8Array(1);
    window.crypto.getRandomValues(byteArray);

    var range = max - min + 1;
    var max_range = 256;
    if (byteArray[0] >= Math.floor(max_range / range) * range)
        return genRandomInt(min, max);
    return min + (byteArray[0] % range);
}

export function genUUID(existingIds: Array<string>): string {
  let uuid = "";
  const max = uuidDict.length - 1;
  console.log(max);
  for (let i = 0; i < 6; i++) {
    const randomInt = genRandomInt(0, max);
    console.log(randomInt);
    uuid += uuidDict[randomInt];
  }
  if (existingIds.contains(uuid)) {
    return genUUID(existingIds)
  }
  return uuid;
}