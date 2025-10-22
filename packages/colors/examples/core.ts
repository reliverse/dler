import { chain, re, setColorLevel } from "../src/mod";

const COLOR_LEVEL_TRUECOLOR = 3;

function main() {
  setColorLevel(COLOR_LEVEL_TRUECOLOR);

  console.log("--- Basic Color Examples ---");
  console.log(re.bold.red.underline("Hello"));
  console.log(chain(re.bold, re.red)("world"));

  // Additional color tests
  console.log("\n--- Named Color Examples ---");
  console.log(re.blue("Blue text"));
  console.log(re.green.bold("Bold green text"));
  console.log(re.yellow.underline("Yellow underlined text"));
  console.log(re.magenta.italic("Magenta italic text"));
  console.log(re.bgRed.white("White text on red background"));
  console.log(re.bgBlue.yellow("Yellow text on blue background"));

  console.log("\n--- Extended Named Colors ---");
  console.log(re.orange.bold("Orange text"));
  console.log(re.pink.underline("Pink text"));
  console.log(re.purple.italic("Purple text"));
  console.log(re.teal.bold("Teal text"));
  console.log(re.lime("Lime text"));
  console.log(re.brown("Brown text"));
  console.log(re.navy("Navy text"));
  console.log(re.maroon("Maroon text"));
  console.log(re.olive("Olive text"));
  console.log(re.silver("Silver text"));

  console.log("\n--- Bright Color Variants ---");
  console.log(re.redBright("Bright red text"));
  console.log(re.greenBright.bold("Bold bright green text"));
  console.log(re.blueBright.underline("Underlined bright blue text"));
  console.log(re.yellowBright.italic("Italic bright yellow text"));

  console.log("\n--- Background Colors ---");
  console.log(re.bgOrange.white("White text on orange background"));
  console.log(re.bgPink.black("Black text on pink background"));
  console.log(re.bgPurple.white("White text on purple background"));
  console.log(re.bgTeal.white("White text on teal background"));

  console.log("\n--- Bright Background Colors ---");
  console.log(re.bgRedBright.white("White text on bright red background"));
  console.log(re.bgGreenBright.black("Black text on bright green background"));
  console.log(re.bgBlueBright.white("White text on bright blue background"));

  console.log("\n--- Style Combinations ---");
  console.log(re.bold.italic.underline.red("Bold italic underlined red text"));
  console.log(re.dim.strikethrough.cyan("Dim strikethrough cyan text"));
  console.log(re.inverse.magenta("Inverse magenta text"));
  console.log(re.hidden("Hidden text (you might not see this)"));

  console.log("\n--- Chaining Examples ---");
  console.log(chain(re.bold, re.red, re.underline)("Chained formatting"));
  console.log(
    chain(re.italic, re.blue, re.bgYellow)("Blue italic on yellow background"),
  );
  console.log(chain(re.dim, re.green)("Dim green text"));
}

main();
