import { calculateComplexity } from "codehawk-cli";
import { readdirSync, readFileSync } from "fs";
import { join } from "path";

const utilsDir = "./chrome/player/utils";

// Get all .mjs files
const files = readdirSync(utilsDir).filter(f => f.endsWith(".mjs"));

for (const file of files) {
    const fullPath = join(utilsDir, file);
    const text = readFileSync(fullPath, "utf8");

    console.log(`=====${file}=====`);
    console.log(calculateComplexity(text));
    console.log(); // blank line for readability
}
