import * as d3 from "https://esm.sh/d3@7.8.5";

const format = Deno.args[0];

const games = Deno.readTextFileSync(`./processed-data/${format}_decks.jsonl`);
const names = Deno.readTextFileSync(`./metadata/${format}_names.txt`).split(
  "\n",
);
const basicLands = new Set(
  JSON.parse(Deno.readTextFileSync(`./metadata/${format}_lands.json`)),
);

type CardData = { count: number; outcome: number };

const cardData: Record<number, CardData> = {};
const cardPairData: Record<number, CardData> = {};

let totalOutcome = 0, totalGames = 0;
for (const line of games.split("\n")) {
  if (line === "") {
    continue;
  }
  const data = JSON.parse(line);
  data.outcome = (data.outcome + 1) / 2;
  totalOutcome += data.outcome;
  totalGames++;
  const unrolledCards: number[] = [];
  for (const card of data.cards) {
    for (let i = 0; i < card[1]; i++) {
      unrolledCards.push(card[0]);
    }
    if (!cardData[card[0]]) {
      cardData[card[0]] = { count: 0, outcome: 0 };
    }
    cardData[card[0]].count += card[1];
    cardData[card[0]].outcome += card[1] * data.outcome;
  }
  for (let i = 0; i < unrolledCards.length; i++) {
    for (let j = i + 1; j < unrolledCards.length; j++) {
      const key = unrolledCards[i] * 1000 + unrolledCards[j];
      if (!cardPairData[key]) {
        cardPairData[key] = { count: 0, outcome: 0 };
      }
      cardPairData[key].count++;
      cardPairData[key].outcome += data.outcome;
    }
  }
}

const wilsonScore = (p: number, n: number, z?: number, upper?: boolean) => {
  if (z === undefined) {
    z = 1.96;
  }
  const phat = p / n;
  if (upper) {
    return (phat + z * z / (2 * n) +
      z * Math.sqrt((phat * (1 - phat) + z * z / (4 * n)) / n)) /
      (1 + z * z / n);
  } else {
    return (phat + z * z / (2 * n) -
      z * Math.sqrt((phat * (1 - phat) + z * z / (4 * n)) / n)) /
      (1 + z * z / n);
  }
};

const wilsonScoreFromData = (data: CardData, z?: number, upper?: boolean) =>
  wilsonScore(data.outcome, data.count, z, upper);

console.log(`17l users win rate: ${totalOutcome / totalGames}`);
console.log("\nCards:");
const fmt = d3.format(".1f");
for (
  const [id, card] of Object.entries(cardData).toSorted((a, b) =>
    a[1].outcome / a[1].count - b[1].outcome / b[1].count
  )
) {
  console.log(`${fmt(100 * card.outcome / card.count)}: ${names[Number(id)]}`);
}

const wilsonScoreFromDataPair = (
  key: number,
  data: CardData,
  upper?: boolean,
) => {
  const id1 = Math.floor(Number(key) / 1000);
  const id2 = Number(key) % 1000;
  const adjustedZ2 = 4;
  const adjustedZ = 2;
  return wilsonScoreFromData(data, adjustedZ2, upper) -
    (wilsonScoreFromData(cardData[id1], adjustedZ, upper) +
        wilsonScoreFromData(cardData[id2], adjustedZ, upper)) / 2;
};

const nonLandPairs = Object.entries(cardPairData)
  .filter(([key, _]) => {
    const id1 = Math.floor(Number(key) / 1000);
    const id2 = Number(key) % 1000;
    return !basicLands.has(id1) && !basicLands.has(id2);
  });

console.log("\n\nBest card pairs (skipping basics, adjusted for many pairs):");
for (
  const [key, card] of nonLandPairs.toSorted((a, b) =>
    wilsonScoreFromDataPair(Number(b[0]), b[1]) -
    wilsonScoreFromDataPair(Number(a[0]), a[1])
  ).slice(0, 50)
) {
  const id1 = Math.floor(Number(key) / 1000);
  const id2 = Number(key) % 1000;
  const ws = wilsonScoreFromDataPair(Number(key), card);

  const wsPure = ws +
    (wilsonScoreFromData(cardData[id1], 2) +
        wilsonScoreFromData(cardData[id2], 2)) / 2;

  console.log(
    `${fmt(100 * ws)} (n=${card.count}, pure=${fmt(100 * wsPure)}): ${
      names[Number(id1)]
    }, ${names[Number(id2)]}`,
  );
}

console.log("\n\nWorst card pairs (skipping basics, adjusted for many pairs):");
for (
  const [key, card] of nonLandPairs.toSorted((a, b) =>
    wilsonScoreFromDataPair(Number(a[0]), a[1], true) -
    wilsonScoreFromDataPair(Number(b[0]), b[1], true)
  ).slice(0, 50)
) {
  const id1 = Math.floor(Number(key) / 1000);
  const id2 = Number(key) % 1000;
  const ws = wilsonScoreFromDataPair(Number(key), card, true);

  const wsPure = ws +
    (wilsonScoreFromData(cardData[id1], 2, true) +
        wilsonScoreFromData(cardData[id2], 2, true)) / 2;

  const unadjustedPure = card.outcome / card.count;
  const unadjustedLift = unadjustedPure -
    (cardData[id1].outcome / cardData[id1].count +
        cardData[id2].outcome / cardData[id2].count) / 2;

  console.log(
    `${fmt(100 * ws)} (n=${card.count}, pure=${fmt(100 * wsPure)}, un.lift=${
      fmt(100 * unadjustedLift)
    }, un.pure=${fmt(100 * unadjustedPure)}): ${names[Number(id1)]}, ${
      names[Number(id2)]
    }`,
  );
}
