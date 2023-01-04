import { uuidDict } from "./constants";

function genRandomIntDesktop(min: number, max: number): number {       
    // Create byte array and fill with 1 random number
    var byteArray = new Uint8Array(1);
    window.crypto.getRandomValues(byteArray);

    var range = max - min + 1;
    var max_range = 256;
    if (byteArray[0] >= Math.floor(max_range / range) * range)
        return genRandomIntDesktop(min, max);
    return min + (byteArray[0] % range);
}

function genRandomIntMobile(min: number, max: number): number {
  min = Math.ceil(min);
  max = Math.floor(max);
  return Math.floor(Math.random() * (max - min + 1) + min);
}

export function genUUID(existingIds: Array<string>): string {
  let uuid = "";
  const max = uuidDict.length - 1;
  for (let i = 0; i < 6; i++) {
    console.log("mobile ? " + this.app.isMobile)
    uuid += uuidDict[this.app.isMobile ? genRandomIntMobile(0, max) : genRandomIntDesktop(0, max)];
  }
  if (existingIds.contains(uuid)) {
    return genUUID(existingIds)
  }
  return uuid;
}