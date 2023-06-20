import * as d3 from "https://esm.sh/d3@7.8.5";

const format = Deno.args[0];

const games = Deno.readTextFileSync(`./processed-data/${format}_decks.jsonl`);
const names = Deno.readTextFileSync(`./metadata/${format}_names.txt`).split(
  "\n",
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

const wilsonScore = (p: number, n: number) => {
  const z = 1.96;
  const phat = p / n;
  return (phat + z * z / (2 * n) -
    z * Math.sqrt((phat * (1 - phat) + z * z / (4 * n)) / n)) / (1 + z * z / n);
};

const wilsonScoreFromData = (data: CardData) =>
  wilsonScore(data.outcome, data.count);

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

const wilsonScoreFromDataPair = (key: number, data: CardData) => {
  const id1 = Math.floor(Number(key) / 1000);
  const id2 = Number(key) % 1000;
  return wilsonScoreFromData(data) - (wilsonScoreFromData(cardData[id1]) +
        wilsonScoreFromData(cardData[id2])) / 2;
};

console.log("\n\nCard pairs:");
const threshold = 1000;
for (
  const [key, card] of Object.entries(cardPairData).toSorted((a, b) =>
    wilsonScoreFromDataPair(Number(a[0]), a[1]) -
    wilsonScoreFromDataPair(Number(b[0]), b[1])
  )
) {
  if (card.count < threshold) {
    continue;
  }
  const id1 = Math.floor(Number(key) / 1000);
  const id2 = Number(key) % 1000;
  const ws = wilsonScoreFromDataPair(Number(key), card);

  const wsPure = ws +
    (wilsonScoreFromData(cardData[id1]) + wilsonScoreFromData(cardData[id2])) /
      2;

  console.log(
    `${fmt(100 * ws)} (n=${card.count}, pure=${fmt(100 * wsPure)}): ${
      names[Number(id1)]
    }, ${names[Number(id2)]}`,
  );
}
