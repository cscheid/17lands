let header: string | undefined = "";

const names = Deno.readTextFileSync("./metadata/MOM_names.txt").split("\n");

const decoder = new TextDecoder();
let buffer = "";

type DeckData = {
  cards: [number, number][];
  draftId: string;
  outcome: number;
};

let nDecks = 0;
for await (const chunk of Deno.stdin.readable) {
  const textChunk = decoder.decode(chunk);
  buffer += textChunk;
  const thisLines = buffer.split("\n");
  if (buffer.endsWith("\n")) {
    thisLines.pop();
    buffer = "";
  } else {
    buffer = thisLines.pop()!;
  }

  for (const text of thisLines) {
    if (!header) {
      header = text;
      console.log(text);
      continue;
    }
    const line = text.split(",");
    const metadata = [...line.slice(0, 17), ...line.slice(-2)];
    const deck = line.slice(17, -2);
    const sparseDeck: [number, number][] = [];
    for (let i = 0; i < deck.length; i += 5) {
      const count = Number(deck[i]) + Number(deck[i + 1]) + Number(deck[i + 2]);
      if (count !== 0) {
        sparseDeck.push([i / 5, count]);
      }
    }
    const deckData: DeckData = {
      cards: sparseDeck,
      draftId: metadata[2],
      outcome: metadata[16] === "True" ? 1 : -1,
    };

    if (++nDecks % 10000 === 0) {
      console.log(nDecks);
    }
    // we should probably do this in chunks
    Deno.writeTextFile(
      "./processed-data/MOM_decks.jsonl",
      JSON.stringify(deckData) + "\n",
      {
        append: true,
      },
    );
  }
}
